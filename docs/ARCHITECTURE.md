# Arquitetura do Discord da Gurizada

## Visão geral

```text
Browser / Next.js
   ├── POST /api/livekit/token ── valida acesso e assina sessão
   ├── /api/admin ─────────────── moderação e configuração temporária
   ├── Room lobby ─────────────── presença, atributos e chat
   └── Room voz ativa ─────────── microfone, câmera e screen share
                    │
                    ▼
              LiveKit Cloud
```

Os Route Handlers são os únicos pontos que conhecem `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `MVP_ACCESS_CODE`, `MVP_SESSION_SECRET` e `MVP_ADMIN_TOKEN`. O frontend recebe apenas a URL pública do LiveKit, um JWT limitado e os dados da própria sessão.

## Entrada e sessão

`POST /api/livekit/token` usa um corpo discriminado:

```ts
{ action: "enter", nickname, accessCode, adminToken? }
{ action: "voice", channelId }
```

Na entrada, o servidor normaliza o nickname, compara o código em tempo constante, gera `slug_<uuid>` e grava `discord_gurizada_session`. O cookie é HMAC-SHA256, HttpOnly, SameSite=Lax, Secure em produção e expira em 12 horas. O token administrativo opcional também é comparado em tempo constante e define a role assinada; ele nunca vai para o LiveKit. Pedidos de token de voz usam essa sessão e uma whitelist de canais.

## Salas e grants

```text
discord-gurizada:server:main:lobby
  ├── canPublishData
  ├── canUpdateOwnMetadata
  └── sem publicação/assinatura de mídia

discord-gurizada:server:main:voice:general
discord-gurizada:server:main:voice:gaming
discord-gurizada:server:main:voice:afk
  ├── canPublish
  ├── canSubscribe
  └── sem atualização de metadata
```

O lobby permanece conectado durante toda a sessão. Só existe uma instância de voz ativa. A troca é transacional: o cliente conecta a candidata, atualiza `voiceChannelId`, encerra a sala anterior e só então promove a nova referência e solicita o microfone. Uma falha antes dessa promoção mantém a chamada anterior.

## Dados realtime

- Participantes online vêm diretamente do lobby.
- `voiceChannelId`, presença, atividade, mute e compartilhamento são Participant Attributes de baixa frequência e visuais.
- Cada canal de texto usa um Text Stream próprio.
- Mensagens privadas usam `destinationIdentities`; arquivo usa Byte Stream com limite de 10 MB no cliente.
- Tópicos e enquetes são envelopes tipados em Text Streams. Votos ainda são locais.
- Mensagens ficam na memória do navegador; participantes que entram depois não recebem histórico.
- O serviço `getRealtimeToken()` isola a API atual para futura substituição por .NET.

## Mídia

Microfone é ativado após entrar em voz. Câmera e compartilhamento exigem ação explícita. O estado visual deriva das publicações LiveKit, inclusive quando o compartilhamento termina pelo navegador. `RoomAudioRenderer` renderiza áudio remoto; deafen interrompe somente esse áudio e não altera o microfone.

## Falhas e reconexão

Os estados `offline`, `connecting`, `connected` e `reconnecting` ficam visíveis. Falhas de token, permissão, dispositivo e troca de sala usam mensagens consistentes e não deixam controles em estados falsos. O SDK LiveKit cuida da reconexão da room ativa.

## Administração temporária

`/api/admin` exige uma sessão assinada com role `admin`. O Route Handler usa `RoomServiceClient` para mutar uma track de microfone e mover um participante entre salas. Em seguida, atualiza os atributos correspondentes no lobby. Criação de canais e logs usam um singleton em memória do processo, consultado pelos clientes em `/api/server/config`; isso é deliberadamente temporário e deve migrar para PostgreSQL antes de uma implantação multi-instância.

## Evolução

O Route Handler temporário e `getRealtimeToken()` formam a fronteira a ser substituída pela API .NET. Nomes de salas, canais e tipos ficam centralizados para evitar dependências espalhadas.
