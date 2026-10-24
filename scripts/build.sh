#!/usr/bin/env bash
# Builds FA Shield: a uBlock Origin Lite release (tag in UPSTREAM) + overlay/ (bridge to the FuckAds app,
# own name and icons). Output, one unpacked folder and one zip per store:
#
#   dist/chromium   dist/fa-shield-chromium-<version>.zip   Chrome Web Store (also Brave, Opera, Vivaldi)
#   dist/edge       dist/fa-shield-edge-<version>.zip       Edge Add-ons
#   dist/firefox    dist/fa-shield-firefox-<version>.zip    addons.mozilla.org (AMO signs it)
#
#   scripts/build.sh [OUT_DIR]
#
# Needs bash, curl, unzip, perl (JSON::PP ships with perl) and, for the zips, zip.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT="${1:-$ROOT/dist}"
mkdir -p "$OUT"
OUT=$(cd "$OUT" && pwd)  # absolute: the zip step runs from inside each target folder
TAG=$(sed -n 's/^tag=//p' "$ROOT/UPSTREAM")
REVISION=$(sed -n 's/^revision=//p' "$ROOT/UPSTREAM")
VERSION="$TAG.$REVISION"
FIREFOX_ID="fa-shield@vowkaz"
HOMEPAGE="https://github.com/Vowkaz/fa-shield"
CACHE="$ROOT/build/upstream/$TAG"
BASE="https://github.com/uBlockOrigin/uBOL-home/releases/download/$TAG"

die() { echo "::error::$*" >&2; exit 1; }

fetch() { # target asset
  local file="$CACHE/$2"
  if [ ! -s "$file" ]; then
    mkdir -p "$CACHE"
    echo "downloading $2" >&2
    curl -fsSL --retry 3 -o "$file.part" "$BASE/$2"
    mv "$file.part" "$file"
  fi
  echo "$file"
}

# Manifest changes, in perl so the build needs no node or jq.
patch_manifest() { # manifest target
  MANIFEST="$1" TARGET="$2" VERSION="$VERSION" FIREFOX_ID="$FIREFOX_ID" HOMEPAGE="$HOMEPAGE" perl -MJSON::PP -e '
    local $/; open my $fh, "<", $ENV{MANIFEST} or die $!; my $m = decode_json(<$fh>); close $fh;
    $m->{version} = $ENV{VERSION};
    $m->{short_name} = "FA Shield";
    $m->{author} = "Vowkaz (based on uBlock Origin Lite by Raymond Hill)";
    $m->{homepage_url} = $ENV{HOMEPAGE};
    delete $m->{key}; delete $m->{update_url};
    my %have = map { $_ => 1 } @{ $m->{permissions} };
    # nativeMessaging: the FuckAds app. declarativeNetRequestFeedback: the blocked count it shows.
    for my $p ("nativeMessaging", "declarativeNetRequestFeedback") { push @{ $m->{permissions} }, $p unless $have{$p} }
    if ($ENV{TARGET} eq "firefox") {
      $m->{browser_specific_settings}{gecko}{id} = $ENV{FIREFOX_ID};
      delete $m->{browser_specific_settings}{gecko}{update_url};
    }
    open $fh, ">", $ENV{MANIFEST} or die $!; print $fh JSON::PP->new->utf8->pretty->canonical->encode($m); close $fh;
  '
}

build() { # target asset
  local target="$1" archive dest
  archive=$(fetch "$target" "$2")
  dest="$OUT/$target"
  rm -rf "$dest"
  mkdir -p "$dest"
  unzip -q "$archive" -d "$dest"
  # Store signatures of the original package; ours is signed again by each store.
  rm -rf "$dest/_metadata" "$dest/META-INF"
  [ -f "$dest/manifest.json" ] || die "$target: no manifest.json in $2"

  cp -R "$ROOT/overlay/." "$dest/"

  local bg="$dest/js/background.js"
  grep -q 'const isFullyInitialized = start()' "$bg" || die "$target: background.js changed upstream; check the bridge hook"
  perl -0pi -e 's/^import /import { startBridge } from ".\/fashield-bridge.js";\nimport /m' "$bg"
  printf '\n// FA Shield: bridge to the FuckAds app (js/fashield-bridge.js).\nisFullyInitialized.then(( ) => { startBridge(); });\n' >> "$bg"

  # Own name everywhere the user sees it; credits and links to uBlock Origin stay.
  perl -pi -e 's/uBlock Origin Lite/FA Shield/g; s/uBO Lite/FA Shield/g' "$dest"/_locales/*/messages.json "$dest"/*.html
  patch_manifest "$dest/manifest.json" "$target"

  if grep -q '"message": "uBlock' "$dest/_locales/en/messages.json"; then die "$target: upstream name left in extName"; fi
  if command -v zip >/dev/null; then
    rm -f "$OUT/fa-shield-$target-$VERSION.zip"
    (cd "$dest" && zip -qr -X "$OUT/fa-shield-$target-$VERSION.zip" .)
  fi
  echo "built $target $VERSION -> $dest"
}

mkdir -p "$OUT"
build chromium "uBOLite_$TAG.chromium.zip"
build edge "uBOLite_$TAG.edge.zip"
build firefox "uBOLite_$TAG.firefox.signed.xpi"
