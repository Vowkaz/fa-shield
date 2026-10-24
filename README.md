# FA Shield

Bloqueador de anúncios para Chrome, Edge e Firefox. É o [uBlock Origin Lite](https://github.com/uBlockOrigin/uBOL-home) (MV3) com nome e ícones próprios e uma ponte para o app **FuckAds** do Windows:

- **Pausar/Ligar no app** pausa e retoma a extensão junto.
- **Sempre liberar / sempre bloquear** da sua conta valem também dentro das páginas.
- O painel do app mostra quantos bloqueios a extensão fez hoje.

Sem o app, a extensão funciona sozinha, igual ao uBOL.

O DNS do FuckAds barra domínios de anúncio. A extensão barra o que o DNS não alcança:
- anúncio servido pelo próprio site;
- intersticial e pop-under;
- vídeo-anúncio;
- avisos anti-adblock.

Medição no [canyoublockit](https://canyoublockit.com/testing/), em 24/10/2026:

| | Só DNS | DNS + FA Shield |
|---|---|---|
| Simple | intersticial aparece | passa |
| Extreme | anúncio sobreposto, vídeo-anúncios, pop-under | passa |
| Advanced (banners, native, pop-under, content blocker) | banners e pop-under passam | passa |

## Como é montada

Não há fork do código-fonte inteiro. O build pega a versão publicada do uBOL (tag em `UPSTREAM`) e aplica por cima:

| O quê | Onde |
|---|---|
| Ponte com o app (native messaging) | `overlay/js/fashield-bridge.js`, ligada no fim de `js/background.js` |
| Nome "FA Shield" nas telas e no manifesto | `scripts/build.sh` |
| Ícones (escudo próprio, sem marca do uBlock) | `overlay/img/` (gerados por `tools/make-icons.ps1`) |
| Permissões extras: `nativeMessaging` (o app) e `declarativeNetRequestFeedback` (contagem de bloqueios) | `scripts/build.sh` |
| ID no Firefox: `fa-shield@vowkaz` | `scripts/build.sh` |

Para gerar a extensão:

```bash
scripts/build.sh            # dist/chromium, dist/edge, dist/firefox (+ .zip de cada uma)
```

Requisitos: bash, curl, unzip e perl; para gerar os .zip, também `zip`. O CI (`.github/workflows/build.yml`) faz o mesmo e guarda os .zip.

Para atualizar o uBOL: troque `tag=` em `UPSTREAM` pela [versão mais nova](https://github.com/uBlockOrigin/uBOL-home/releases) e volte `revision=` para 1. Se o build acusar que `background.js` mudou, ajuste o gancho da ponte no script.

Para testar sem publicar: em `chrome://extensions` (ou `edge://extensions`), ligue o **Modo do desenvolvedor**, clique em **Carregar sem compactação** e escolha `dist/chromium` (ou `dist/edge`). No Firefox, abra `about:debugging` → **Carregar extensão temporária** e escolha `dist/firefox/manifest.json`. Para o app conversar com essa cópia, ponha o ID dela em `browser.chrome_id` (ou `edge_id`) no `client.yaml` e rode `FuckAds.exe install`.

- Protocolo com o app: [docs/protocol.md](docs/protocol.md).
- Publicar nas lojas: [docs/lojas.md](docs/lojas.md).

## Licença e créditos

GPL-3.0, a mesma do uBlock Origin Lite (veja `LICENSE`).

- **Código original:** Raymond Hill e colaboradores ([gorhill/uBlock](https://github.com/gorhill/uBlock)). As listas de filtros têm licenças próprias, citadas no painel da extensão.
- **Nossas mudanças:** © Vowkaz, GPL-3.0.
- **O app FuckAds** é um programa separado. Ele só troca mensagens JSON com a extensão (o protocolo acima) e tem licença própria.

"uBlock Origin" é nome do projeto original e não é usado no nome nem nos ícones do FA Shield. O FA Shield não tem vínculo com o projeto original.
