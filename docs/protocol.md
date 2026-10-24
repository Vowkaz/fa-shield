# Protocolo entre o FA Shield e o app FuckAds

Native messaging padrão do Chrome, Edge e Firefox. O navegador inicia o `FuckAds.exe` como host `com.fashield.bridge`. Cada mensagem é JSON precedido do tamanho (u32, ordem de bytes nativa). O host roda como o usuário logado e só existe enquanto a extensão mantém a porta aberta.

## Extensão → app

```json
{"type":"hello","version":"2026.1021.1354.1","browser":"edge"}
{"type":"stats","blocked":12}
```

- `hello`: enviada ao conectar.
- `stats`: requisições bloqueadas desde o último envio, mandada no máximo uma vez por minuto (limite de `getMatchedRules`). A contagem é aproximada: soma as regras dos conjuntos estáticos e a regra de "sempre bloquear".
- Mensagens maiores que 64 KB fecham a conexão. Tipos desconhecidos são ignorados.

## App → extensão

```json
{"type":"state","enabled":true,"allow":["exemplo.com"],"deny":["tracker.exemplo"]}
```

Enviada após o `hello` e sempre que muda. O app confere a cada 3 s se o serviço está ligado e a cada 30 s busca as listas no núcleo.

| Campo | O que a extensão faz |
|---|---|
| `enabled: false` | Guarda os modos por site do usuário e põe tudo em "sem filtragem" (o botão Pausar/Desligar do app). |
| `enabled: true` | Restaura os modos guardados. |
| `allow` | Os domínios entram em "sem filtragem", como os sites confiáveis do uBOL. Só os que a ponte acrescentou são removidos depois. |
| `deny` | Uma regra DNR dinâmica (id 7000001, prioridade alta) bloqueia os domínios e seus subdomínios. "Sempre bloquear" vence "sempre liberar", como no DNS. |

Se o app sumir (desinstalado ou host ausente), a extensão desfaz uma pausa pendente e segue funcionando sozinha. Ela tenta reconectar com espera crescente, até 10 min entre tentativas.

## Registro do host (feito pelo instalador do app)

| Navegador | Chave (HKLM) | Manifesto |
|---|---|---|
| Chrome | `SOFTWARE\Google\Chrome\NativeMessagingHosts\com.fashield.bridge` | `%ProgramData%\FuckAds\browser\host-chromium.json` (`allowed_origins` = IDs das lojas) |
| Edge | `SOFTWARE\Microsoft\Edge\NativeMessagingHosts\com.fashield.bridge` | o mesmo |
| Firefox | `SOFTWARE\Mozilla\NativeMessagingHosts\com.fashield.bridge` | `host-firefox.json` (`allowed_extensions` = `fa-shield@vowkaz`) |
