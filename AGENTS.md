<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- antd-cli setup start -->
## Ant Design CLI Skill

Use the shared Ant Design skill at `.agents/skills/antd/SKILL.md` before working on Ant Design code in this repository.

The skill teaches agents when and how to call `@ant-design/cli` commands such as `antd info`, `antd doc`, `antd demo`, `antd token`, `antd semantic`, and `antd changelog`.

<!-- antd-cli setup end -->

## Projeto Discord da Gurizada

Discord da Gurizada é um MVP privado de voz, chat efêmero e compartilhamento de tela para pequenos grupos. O objetivo desta fase é validar uso real com custo inicial zero, não construir billing, persistência ou infraestrutura definitiva.

### Arquitetura e stack

- Next.js App Router, React e TypeScript strict.
- Ant Design 6 com `@ant-design/nextjs-registry` e tema em `src/design-system`.
- LiveKit Cloud com uma Room permanente de lobby e uma Room de voz ativa por vez.
- Route Handler `POST/DELETE /api/livekit/token` como backend temporário.
- Estado com React, hooks e eventos LiveKit; não adicionar Redux, SignalR, Socket.IO ou outra UI library.

### Organização

- `src/app`: rotas, layout, token API e catálogo `/dev/ui`.
- `src/design-system`: tokens, tema e primitives reutilizáveis.
- `src/components`: componentes do domínio da aplicação por feature.
- `src/hooks`: lifecycle e estado realtime.
- `src/services`: fronteiras de API substituíveis.
- `src/lib`: segurança e integrações server-only.
- `docs`: arquitetura, Design System e evolução.

### Regras de UI

- Antes de criar um componente, procure equivalente na biblioteca interna.
- Use tokens; não espalhe cores, spacing ou radius hardcoded.
- Preserve a identidade slate/teal e nunca copie visual, logo ou assets do Discord.
- Não encapsule Ant Design sem padrão visual, comportamento comum ou regra de produto.
- Após alterações relevantes, valide `/dev/ui` e o fluxo real no navegador.
- Desktop é prioritário; canais e membros viram Drawers em telas menores. Nunca introduza scroll horizontal global.

### Regras realtime e segurança

- Segredos LiveKit, código de acesso e segredo de sessão permanecem no servidor.
- O frontend só solicita tokens por `getRealtimeToken()`; não chame a rota em componentes.
- A identidade é `slug_<uuid>` e o nickname fica em `Participant.name`.
- `voiceChannelId` é presença visual, nunca autorização.
- Microfone só é solicitado ao entrar em voz; câmera e tela nunca iniciam automaticamente.
- Chat não persiste e a interface deve deixar isso explícito.
- Preserve a troca transacional de sala: falha na candidata não pode derrubar a chamada atual.

### MCPs e documentação

- `antd`: consultar props, demos, tokens, semantic DOM e changelog antes de novas APIs Ant Design.
- `context7`: consultar documentação atual de Next.js, React e LiveKit quando a assinatura externa importar.
- `playwright`: navegar, interagir e revisar layout, acessibilidade e responsividade.
- Não adicionar MCPs sem benefício concreto.

### Validação obrigatória

Execute `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run test:e2e` e `npm.cmd run build`. Rode também `npx.cmd -y @ant-design/cli lint ./src --version 6.6.2 --format json` após mudanças Ant Design. Fluxos de voz e screen share exigem teste manual entre dois computadores com LiveKit real.
