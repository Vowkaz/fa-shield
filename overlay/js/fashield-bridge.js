/*******************************************************************************

    FA Shield - uBlock Origin Lite with a bridge to the FuckAds Windows app
    Copyright (C) 2026-present Vowkaz

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see {http://www.gnu.org/licenses/}.

    Based on uBlock Origin Lite: https://github.com/gorhill/uBlock

*/

// Talks to the FuckAds app over native messaging (protocol: docs/protocol.md).
// - "enabled": false pauses all filtering (the app's on/off button); true restores the
//   user's own per-site modes.
// - "allow": hostnames put in no-filtering mode, like uBOL's trusted sites.
// - "deny": hostnames blocked by one dynamic DNR rule.
// - Every minute, reports how many requests were blocked.
// Without the app (host not installed, or app removed) the extension works on its own:
// a pause left behind is undone on disconnect.

import {
    getDefaultFilteringMode,
    getFilteringModeDetails,
    setFilteringModeDetails,
} from './mode-manager.js';

import { localRead, localWrite, runtime, webextFlavor } from './ext.js';
import { broadcastMessage } from './utils.js';
import { dnr } from './ext-compat.js';
import { registerContentScripts } from './scripting-manager.js';
import { registerUserScripts } from './compiled-filters.js';

/******************************************************************************/

const HOST_NAME = 'com.fashield.bridge';
// Between uBOL's own realms: < 5M are its regex rules, 8M trusted-site, 9M user rules.
const DENY_RULE_ID = 7000001;
const STORAGE_KEY = 'fashieldBridge';
// getMatchedRules() is rate-limited (about 20 calls per 10 minutes).
const STATS_PERIOD = 60 * 1000;
const RETRY_MIN = 5 * 1000;
const RETRY_MAX = 10 * 60 * 1000;
const MAX_HOSTNAMES = 1000;

let port;
let retryDelay = RETRY_MIN;
let statsTimer;
let lastStatsTime = Date.now();
let queue = Promise.resolve();

/******************************************************************************/

const hostnameRe = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

function cleanHostnames(list) {
    if ( Array.isArray(list) === false ) { return []; }
    const out = new Set();
    for ( const item of list ) {
        if ( typeof item !== 'string' ) { continue; }
        const hn = item.trim().toLowerCase();
        if ( hostnameRe.test(hn) ) { out.add(hn); }
        if ( out.size >= MAX_HOSTNAMES ) { break; }
    }
    return Array.from(out).sort();
}

async function readBridgeState() {
    const state = await localRead(STORAGE_KEY);
    return {
        managedAllow: Array.isArray(state?.managedAllow) ? state.managedAllow : [],
        paused: state?.paused === true,
        savedModes: state?.savedModes ?? null,
    };
}

const sameModes = (a, b) => {
    const norm = d => JSON.stringify([ 'none', 'basic', 'optimal', 'complete' ].map(k =>
        Array.from(d[k] || []).sort()
    ));
    return norm(a) === norm(b);
};

async function applyModes(details) {
    const current = await getFilteringModeDetails(true);
    if ( sameModes(current, details) ) { return; }
    await setFilteringModeDetails(details);
    await Promise.all([ registerContentScripts(), registerUserScripts() ]);
    const defaultFilteringMode = await getDefaultFilteringMode();
    broadcastMessage({ defaultFilteringMode });
}

async function applyDenyRule(hostnames) {
    if ( typeof dnr.updateDynamicRules !== 'function' ) { return; }
    const addRules = hostnames.length === 0 ? [] : [ {
        id: DENY_RULE_ID,
        // Above uBOL's allow rules: as in the app, "always block" wins over "always allow".
        priority: 1000000,
        action: { type: 'block' },
        condition: { requestDomains: hostnames },
    } ];
    await dnr.updateDynamicRules({ removeRuleIds: [ DENY_RULE_ID ], addRules });
}

/******************************************************************************/

// The user's own modes: what is stored now (or before the pause), minus the
// hostnames the bridge added.
async function userModes(bridge) {
    const base = bridge.paused && bridge.savedModes
        ? bridge.savedModes
        : await getFilteringModeDetails(true);
    const managed = new Set(bridge.managedAllow);
    return {
        none: (base.none || []).filter(hn => managed.has(hn) === false),
        basic: base.basic || [],
        optimal: base.optimal || [],
        complete: base.complete || [],
    };
}

async function applyHostState(msg) {
    const enabled = msg.enabled !== false;
    const allow = cleanHostnames(msg.allow);
    const deny = cleanHostnames(msg.deny);
    const bridge = await readBridgeState();
    const user = await userModes(bridge);
    const userNone = new Set(user.none);
    const managedAllow = allow.filter(hn => userNone.has(hn) === false);
    const withAllow = { ...user, none: [ ...user.none, ...managedAllow ] };
    if ( enabled ) {
        await applyModes(withAllow);
        await applyDenyRule(deny);
        await localWrite(STORAGE_KEY, { managedAllow, paused: false, savedModes: null });
        return;
    }
    await localWrite(STORAGE_KEY, { managedAllow, paused: true, savedModes: withAllow });
    await applyModes({ none: [ 'all-urls' ], basic: [], optimal: [], complete: [] });
    await applyDenyRule([]);
}

// Host gone: do not leave the user paused by an app that is no longer there.
async function releasePause() {
    const bridge = await readBridgeState();
    if ( bridge.paused === false ) { return; }
    await applyModes(bridge.savedModes || await userModes(bridge));
    await localWrite(STORAGE_KEY, { ...bridge, paused: false, savedModes: null });
}

function enqueue(fn) {
    queue = queue.then(fn).catch(reason => {
        console.info(`FA Shield bridge: ${reason}`);
    });
}

/******************************************************************************/

async function reportStats() {
    if ( port === undefined ) { return; }
    if ( typeof dnr.getMatchedRules !== 'function' ) { return; }
    const since = lastStatsTime;
    let details;
    try {
        details = await dnr.getMatchedRules({ minTimeStamp: since });
    } catch {
        return;
    }
    let blocked = 0;
    let newest = since;
    for ( const info of details?.rulesMatchedInfo || [] ) {
        newest = Math.max(newest, info.timeStamp + 1);
        const { rulesetId, ruleId } = info.rule;
        // Dynamic and session rules are mostly uBOL's own allow rules (trusted sites).
        if ( rulesetId === '_session' ) { continue; }
        if ( rulesetId === '_dynamic' && ruleId !== DENY_RULE_ID ) { continue; }
        blocked += 1;
    }
    lastStatsTime = newest;
    if ( blocked !== 0 && port !== undefined ) {
        port.postMessage({ type: 'stats', blocked });
    }
}

/******************************************************************************/

function scheduleConnect() {
    setTimeout(connect, retryDelay);
    retryDelay = Math.min(retryDelay * 2, RETRY_MAX);
}

function connect() {
    if ( port !== undefined ) { return; }
    if ( typeof runtime.connectNative !== 'function' ) { return; }
    let p;
    try {
        p = runtime.connectNative(HOST_NAME);
    } catch {
        scheduleConnect();
        return;
    }
    port = p;
    p.onMessage.addListener(msg => {
        retryDelay = RETRY_MIN;
        if ( msg instanceof Object && msg.type === 'state' ) {
            enqueue(( ) => applyHostState(msg));
        }
    });
    p.onDisconnect.addListener(( ) => {
        void runtime.lastError;
        port = undefined;
        clearInterval(statsTimer);
        enqueue(releasePause);
        scheduleConnect();
    });
    const browserName = /\bEdg\//.test(self.navigator?.userAgent || '')
        ? 'edge'
        : webextFlavor;
    p.postMessage({
        type: 'hello',
        version: runtime.getManifest().version,
        browser: browserName,
    });
    clearInterval(statsTimer);
    statsTimer = setInterval(reportStats, STATS_PERIOD);
}

export function startBridge() {
    connect();
}
