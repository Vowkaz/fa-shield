# Publicar o FA Shield nas lojas

As contas e o pagamento são do dono do projeto. Cada loja gera o ID que o app FuckAds precisa para oferecer a extensão.

Antes de começar:
1. Rode `scripts/build.sh` (ou baixe os .zip do último build do CI).
2. Tenha à mão:
   - o link do código: https://github.com/Vowkaz/fa-shield (o repositório precisa estar público: a GPL exige o código disponível);
   - uma política de privacidade. Pode ser o texto abaixo, publicado numa página do site:

> O FA Shield não coleta nem envia dados pessoais. Os filtros rodam no seu navegador. Se o app FuckAds estiver instalado no mesmo PC, a extensão troca com ele, apenas localmente, o estado ligado/pausado, as listas de liberar e bloquear e o número de bloqueios.

## 1. Chrome Web Store (taxa única de US$ 5)

1. Acesse https://chrome.google.com/webstore/devconsole com a conta Google que será a dona.
2. Aceite o contrato de desenvolvedor e pague a taxa única de US$ 5.
3. Em **Configurações da conta**, verifique o email de contato.
4. Clique em **Novo item** e envie `fa-shield-chromium-<versão>.zip`.
5. Preencha a ficha da loja:

| Campo | Valor |
|---|---|
| Nome | FA Shield |
| Categoria | Ferramentas (ou Produtividade) |
| Idiomas | Português (Brasil) e Inglês |
| Ícone | `overlay/img/icon_128.png` |
| Capturas de tela | 1280×800 do pop-up e do painel |

6. Em **Privacidade**:
   - **Finalidade única:** "Bloquear anúncios e rastreadores nas páginas".
   - **Justificativas das permissões:**

| Permissão | Justificativa |
|---|---|
| `declarativeNetRequest` / `declarativeNetRequestFeedback` | bloquear requisições e contar bloqueios |
| `scripting` / `userScripts` / acesso a todos os sites | esconder anúncios e neutralizar anti-adblock nas páginas |
| `nativeMessaging` | conversar com o app FuckAds no mesmo PC (ligar/pausar, listas) |
| `storage`, `alarms`, `offscreen` | configurações e atualização das listas |

   - **Coleta de dados:** não coleta.
   - **Política de privacidade:** o link da página.
7. Envie para revisão. Com acesso a todos os sites, pode levar de alguns dias a ~2 semanas.
8. Copie o **ID do item** (32 letras) e mande para quem mantém o app. Ele vai em `CHROME_STORE_ID`, em `crates/windows-client/src/config.rs`.

## 2. Edge Add-ons (grátis)

1. Acesse https://partner.microsoft.com/dashboard/microsoftedge e entre com uma conta Microsoft.
2. Faça o cadastro de desenvolvedor (grátis). Pode pedir verificação de email e de identidade.
3. Clique em **Criar nova extensão** e envie `fa-shield-edge-<versão>.zip`.
4. Preencha a ficha com os mesmos textos, a mesma política e as mesmas justificativas do Chrome.
5. Envie para certificação (costuma levar poucos dias úteis).
6. Copie o **ID do produto** da extensão publicada (32 letras, aparece na URL da loja). Ele vai em `EDGE_STORE_ID`.

## 3. Firefox (addons.mozilla.org, grátis)

1. Crie uma conta em https://addons.mozilla.org e entre no **Developer Hub**.
2. Clique em **Enviar um novo complemento**:
   - **Distribuição:** "No site" (listado no AMO).
   - **Arquivo:** `fa-shield-firefox-<versão>.zip`.
3. O AMO pede o **código-fonte**. Envie o .zip deste repositório e a instrução de build: `scripts/build.sh` gera `dist/firefox`.
4. Preencha nome, descrição, categoria (**Privacidade e segurança**) e a política de privacidade.
5. Depois de aprovado, copie o "slug" da página (ex.: `fa-shield`). O link de instalação, que vai em `FIREFOX_INSTALL_URL`, fica:
   `https://addons.mozilla.org/firefox/downloads/latest/<slug>/latest.xpi`

O ID `fa-shield@vowkaz` já está fixo no manifesto e no app.

## Depois de publicar

- Com os IDs no código do app, a próxima versão do instalador passa a:
  - oferecer a extensão no Chrome e no Edge (o navegador pergunta "Nova extensão adicionada");
  - instalar no Firefox por política;
  - remover tudo isso na desinstalação.
- Novas versões: aumente `revision` em `UPSTREAM` (ou troque `tag`), rode o build e envie o .zip em cada loja.
- As lojas atualizam os usuários sozinhas.
