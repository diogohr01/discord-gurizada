# Discord da Gurizada

MVP privado de voz, chat e compartilhamento de tela para a gurizada. O frontend usa Next.js e Ant Design; voz, presença e entrega realtime usam LiveKit Cloud; canais, logs, mensagens e arquivos são persistidos no Supabase.

## Requisitos

- Node.js 20 ou superior (o projeto foi validado com Node 24)
- npm
- projeto gratuito no LiveKit Cloud
- Chrome ou Edge desktop para a experiência completa de mídia

No Windows com execução de scripts PowerShell bloqueada, use `npm.cmd` e `npx.cmd` nos comandos abaixo.

## Configuração

Além das credenciais do LiveKit, aplique `supabase/migrations/0001_discord_gurizada.sql` no SQL Editor do Supabase. A migration cria canais persistentes, logs, mensagens, índices, RLS e o bucket privado `chat-files`.

O servidor prefere `SUPABASE_SECRET_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`, legado). Se nenhuma estiver definida, o MVP usa a publishable key apenas nos Route Handlers e depende das policies da migration. Nunca exponha uma secret/service key no browser.

1. Copie `.env.example` para `.env.local`.
2. No painel do LiveKit Cloud, abra as configurações do projeto e copie a URL WebSocket, API Key e API Secret.
3. Defina um código privado forte e um segredo de sessão aleatório com pelo menos 32 caracteres.

```env
LIVEKIT_URL=wss://seu-projeto.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
MVP_ACCESS_CODE=um-codigo-privado-forte
MVP_SESSION_SECRET=um-segredo-aleatorio-longo-e-unico
MVP_ADMIN_TOKEN=outro-segredo-longo-exclusivo-do-admin
NEXT_PUBLIC_APP_NAME=Discord da Gurizada
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_... # recomendado no servidor; nunca exponha
```

Somente `NEXT_PUBLIC_APP_NAME` é exposta no bundle. As outras variáveis são lidas exclusivamente no Route Handler.

## Contas e sessão persistente

As contas usam Supabase Auth com persistência no armazenamento local do navegador. Para habilitar o cadastro, aplique também `supabase/migrations/0002_profile_avatars.sql` e `supabase/migrations/0003_user_accounts.sql`. O cadastro pede e-mail, usuário, senha e o código privado uma única vez; depois a sessão é restaurada automaticamente neste navegador.

O chat transforma URLs `http`/`https` em links clicáveis, aceita colar imagens e arquivos com `Ctrl+V` e oferece emojis no botão `+`.

## Executar

```bash
npm.cmd install
npm.cmd run dev
```

Abra `http://localhost:3000`. O catálogo interno do Design System fica em `http://localhost:3000/dev/ui` e retorna 404 em builds de produção.

## Como funciona

- O Supabase é a fonte de verdade para configuração, logs administrativos, histórico de mensagens e arquivos.
- O LiveKit continua responsável por voz, presença e entrega imediata do chat; o histórico é carregado do Supabase ao entrar e atualizado periodicamente.
- Arquivos de até 10 MB são enviados ao bucket privado e exibidos por URLs assinadas de curta duração.

- `POST /api/livekit/token` valida o código e cria uma sessão HttpOnly assinada.
- Todos permanecem conectados ao lobby `discord-gurizada:server:main:lobby`, usado para presença, atributos e Text Streams.
- Ao entrar em voz, o cliente abre uma segunda conexão para `discord-gurizada:server:main:voice:<canal>`.
- `voiceChannelId` é sincronizado pelos Participant Attributes do lobby.
- Chat público usa um Text Stream por canal; mensagens privadas usam destino por identidade LiveKit.
- Mensagens, arquivos de até 10 MB, tópicos e enquetes são persistidos no Supabase e recuperados ao entrar.
- Presença, atividade, mute e compartilhamento são publicados como Participant Attributes no lobby.
- Microfone só é solicitado ao entrar em uma sala. Câmera e compartilhamento nunca são ativados automaticamente.
- Compartilhamentos podem ser fixados, abertos em picture-in-picture e colocados em tela cheia quando o navegador oferecer essas APIs.

## Acesso administrativo

O `.env` criado localmente já possui um `MVP_ADMIN_TOKEN`. Para entrar como administrador:

1. Na tela de entrada, clique três vezes rapidamente no símbolo geométrico ao lado da marca.
2. Cole o valor de `MVP_ADMIN_TOKEN` e confirme.
3. Preencha normalmente o nickname e o código privado.
4. Dentro do servidor, use o botão de coroa no cabeçalho da sidebar.

O painel permite criar canais persistentes, mutar/liberar microfones publicados, arrastar pessoas entre canais de voz e consultar logs administrativos persistidos. O token é validado apenas no servidor e a função de administrador é gravada no cookie assinado.

Detalhes adicionais estão em [Arquitetura](docs/ARCHITECTURE.md) e [Design System](docs/DESIGN_SYSTEM.md).

## Testes e qualidade

```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

Os testes E2E usam o Google Chrome instalado no Windows. Os testes básicos usam configuração local descartável e não simulam o produto. O teste realtime entre dois peers só roda quando as credenciais reais estão no ambiente e `E2E_REALTIME=1`.

As capturas de referência geradas pelo teste visual ficam em `docs/screenshots`, nas resoluções 1440×900, 1024×768, 768×1024 e 390×844.

## Teste obrigatório com dois computadores

1. Publique a mesma build em HTTPS e abra a URL em Chrome/Edge nos dois computadores.
2. Entre com nicknames diferentes e o mesmo código.
3. Confirme que ambos aparecem em Participantes.
4. Envie uma mensagem em `#geral` e confirme o recebimento imediato.
5. Entre em `Geral` nos dois computadores e permita o microfone.
6. Valide voz, mute e deafen.
7. Em um computador, compartilhe uma tela ou janela; confirme o vídeo no outro.
8. Pare o compartilhamento pelo indicador nativo do navegador e confirme que o palco volta ao grid.
9. Troque `Geral → Jogando → Geral` e confirme áudio e agrupamento na sidebar.

Áudio da tela é best effort: depende do navegador, sistema e superfície escolhida. Vídeo compartilhado é o requisito obrigatório.

## MCPs do projeto

Os servidores registrados no Codex são:

- `antd`: documentação, props, tokens, semantic DOM e changelog do Ant Design.
- `context7`: documentação atual de Next.js, React e LiveKit.
- `playwright`: navegação e revisão interativa da aplicação.

O `AGENTS.md` descreve quando cada um deve ser usado. A skill oficial do Ant Design está em `.agents/skills/antd`.

## Publicar gratuitamente na Vercel

Antes do deploy, execute a migration no projeto Supabase e cadastre `SUPABASE_SECRET_KEY` como variável sensível no projeto Vercel. As variáveis `NEXT_PUBLIC_*` são públicas; não coloque secret/service keys em componentes client.

1. Faça login com `npx.cmd vercel login`.
2. Na raiz, execute `npx.cmd vercel` para criar/vincular o projeto.
3. Cadastre todas as variáveis do `.env.example` em Project Settings → Environment Variables; marque chaves, código e segredo como sensíveis.
4. Execute `npx.cmd vercel --prod`.
5. Faça o smoke test na URL HTTPS e depois o teste com dois computadores.

Nunca envie `.env.local`, chaves LiveKit ou o código do grupo ao Git.

## Limitações atuais

- O acesso sem conta continua sendo uma sessão anônima baseada em nickname e expira em 12 horas; contas Supabase restauram a entrada neste navegador.
- DMs de contas são recuperadas pelo histórico do Supabase; sessões anônimas continuam renovando a identidade LiveKit a cada entrada.
- Mensagens privadas só chegam enquanto as duas pessoas estão conectadas ao mesmo lobby.
- Votos de enquete são locais nesta versão; a publicação da pergunta e opções é realtime.
- Voz e presença continuam dependentes do LiveKit; o Supabase é a fonte de verdade dos dados persistentes, não o transporte realtime.
- Atributos indicam presença visual e não são autorização de segurança.
- A opção **Mostrar minha atividade** fica desligada por padrão e salva a escolha neste navegador. Quando ligada, publica somente atividades observáveis pelo app: chamada de voz, câmera e compartilhamento de tela.
- Um site não pode enumerar os processos do computador. Detectar automaticamente jogos externos, como CS2, exigirá futuramente um cliente desktop (Electron/Tauri ou nativo) ou uma integração autenticada com a plataforma do jogo; o MVP não inventa nem pede atividade manual.
- Não há rate limit distribuído no endpoint do MVP; use código forte e troque-o se vazar.
- Firefox, Safari e mobile recebem suporte em melhor esforço; mídia é validada em Chrome/Edge desktop.
- A seleção de saída de áudio depende de suporte do navegador.
- Bot de música não está embutido: ele exige um processo de bot/worker separado, fonte de áudio licenciada e política própria de filas e reconexão.

O roadmap pós-validação está em [Futuro](docs/FUTURE.md).
