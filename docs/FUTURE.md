# Evolução futura

## Fase 1 — MVP gratuito

Next.js, Route Handler temporário, sessão por código, LiveKit Cloud Free, voz, chat efêmero e compartilhamento de tela.

## Fase 2 — Produto persistente

- API .NET substituindo o Route Handler.
- PostgreSQL para usuários, servidores, canais, mensagens e permissões.
- Login individual e sessões revogáveis.
- Histórico, moderação, rate limit distribuído e auditoria.

## Fase 3 — Infraestrutura própria

- VPS e domínio.
- LiveKit self-hosted.
- Backups, atualizações e estratégia de recuperação.
- Migração gradual sem alterar o contrato `getRealtimeToken()` do frontend.

## Fase 4 — Observabilidade do proprietário

Painel privado, nunca exibido aos amigos, para CPU, RAM, banda, usuários online/em chamada, screen shares, latência, reconexões e picos. Os dados devem apoiar decisões reais entre capacidades como 2 vCPU/4 GB, 4 vCPU/8 GB e 8 vCPU/16 GB.

Pagamentos, premium, assinatura e divisão de custos permanecem fora do produto até o grupo validar o MVP.
