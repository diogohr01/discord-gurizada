# Design System do Discord da Gurizada

## Direção visual

O Discord da Gurizada usa neutros slate escuros e teal como único destaque de marca. O objetivo é permanecer confortável por horas: pouco brilho, animações curtas, superfícies tonais e bordas apenas quando explicam hierarquia.

## Tokens

Os tokens ficam em `src/design-system/tokens` e alimentam tanto o tema Ant Design quanto CSS variables globais.

- Cores: base, rail, sidebar, panel, elevated, texto, bordas, marca e estados.
- Spacing: escala de 4/8/12/16/24/32/48.
- Radius: 4/6/8/12 e circular.
- Tipografia: stack nativa, pesos 400/500/600 e escala compacta.
- Motion: 100/200/300 ms, respeitando `prefers-reduced-motion`.
- Sombras: apenas foco e elementos realmente elevados.

Não espalhe hex, spacing ou radius por componentes. Valores exclusivos de layout, como largura estrutural de sidebar, podem permanecer locais.

## Camadas de componentes

Design System genérico:

- `AppButton`, `AppIconButton`, `AppAvatar`, `AppTooltip`, `AppBadge`
- `Surface`, `EmptyState`, `ConnectionStatus`, `AppModal`, `AppScrollArea`, `StatusDot`

Domínio Discord da Gurizada:

- itens de canal de texto/voz;
- participantes e membro atual;
- chat, palco de mídia e controles de chamada;
- configurações de dispositivos.

Crie abstração somente quando houver padrão visual, comportamento comum ou regra de produto. Não crie wrappers que apenas repetem todas as props do Ant Design.

## Regras

1. Procure primeiro na biblioteca interna.
2. Consulte Ant Design MCP/CLI antes de usar props novas.
3. Use componentes Ant Design para comportamento complexo e tokens da marca para identidade.
4. Valide foco, teclado, nome acessível, contraste e estado disabled.
5. Revise `/dev/ui` e a tela real em desktop e mobile depois de mudanças relevantes.
6. Não copie identidade, assets ou estrutura visual exata do Discord.

## Catálogo

`/dev/ui` mostra tokens, tipografia, ações, avatares, status, canais, inputs, feedback, loading e empty states. A rota chama `notFound()` fora de desenvolvimento.
