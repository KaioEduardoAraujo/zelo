# Zelo — Identidade visual e direção de frontend

> Leia este arquivo inteiro antes de criar qualquer tela ou componente. Se uma decisão de interface não estiver aqui, siga os princípios da seção 1.

## 0. Sobre o produto (contexto de design)

**Zelo** é uma plataforma de aceite digital para prestadores de serviço (reformas, assistência técnica, instalação, design, agências). O prestador envia uma proposta por link; o cliente lê no celular, aceita sem criar conta, e o sistema gera um comprovante com trilha de auditoria.

- **Significado do nome:** "zelo" = cuidado, capricho, atenção ao que foi combinado.
- **Assinatura (tagline):** *Combinou? Registrou.*
- **Perfis:** Prestador (usa mais no celular, em campo, e no desktop para montar propostas), Cliente final (quase sempre no celular, abre pelo WhatsApp, acesso sem login) e Admin (desktop, uso simples).
- **Tom:** confiável, direto, humano. Sem jargão jurídico desnecessário e sem tom de "startup descolada".

---

## 1. Princípios de design

1. **O documento é o herói.** A interface deve parecer um documento bem diagramado e um recibo confiável, não um dashboard de SaaS genérico. Superfícies brancas, bordas finas, hierarquia tipográfica clara.
2. **Clareza antes de enfeite.** Cada tela tem uma ação principal óbvia. Se precisa de explicação, redesenhe.
3. **Mobile primeiro.** Projete a 375px e depois expanda para desktop. A página do cliente é 100% pensada para o celular.
4. **Cor com significado.** O verde-azulado (teal) significa *confirmado, aceito, ação positiva*. Não use como decoração espalhada.
5. **Confiança visível.** Hash, data e hora, IP e selo de aceite aparecem como informação de verdade (em fonte monoespaçada), não escondidos.
6. **Sem cara de template de IA.** Veja a checklist da seção 9.

---

## 2. Marca

### 2.1 Arquivos
- `logo-zelo.jpeg` — símbolo + wordmark "zelo" (horizontal).
- `simbolo-zelo.jpeg` — símbolo isolado.

**Ação necessária (antes de usar no UI):** os arquivos estão em JPEG com fundo off-white, o que não serve para interface. Gerar:
- `public/brand/logo.svg` e `public/brand/symbol.svg` (vetorizados, fundo transparente);
- `public/brand/logo-negativo.svg` (versão branca, para fundos escuros);
- `app/favicon.ico`, `app/icon.svg` e `app/apple-icon.png` (180×180) a partir do símbolo.

Opções para vetorizar: Inkscape (Trace Bitmap) ou vectorizer.ai. Depois do trace, conferir manualmente as curvas do anel e do "Z". Enquanto isso não estiver pronto, use os JPEG apenas como placeholder.

### 2.2 Anatomia do símbolo
Um círculo dividido em duas metades (navy à esquerda e em cima, teal à direita e embaixo), com um "Z" interno e um **check diagonal em teal** que atravessa o anel. A ideia: *Z de Zelo + visto de aceite*.

### 2.3 Regras de uso
- Área de respiro mínima ao redor: a altura do "o" do wordmark.
- Tamanho mínimo do símbolo: 24px de altura. Abaixo disso, usar o **ícone simplificado de favicon** (anel + check, sem o "Z" interno).
- No UI use o SVG, nunca o wordmark como texto.
- Em fundo escuro, usar a versão negativa. Não recolorir o símbolo fora da paleta.
- Não aplicar gradiente, sombra ou contorno no logo.

### 2.4 Observação honesta sobre o símbolo
A diagonal que cruza o círculo, em tamanhos pequenos, pode lembrar um sinal de "proibido". O que evita essa leitura é o **gancho do check** e a cor teal da diagonal. Por isso: nunca fazer a diagonal em vermelho ou em navy, e usar a versão simplificada no favicon. Vale testar o favicon em 16px e 32px antes de fechar.

---

## 3. Cores

Os valores abaixo foram estimados a partir da logo. **Confirmar com conta-gotas (eyedropper) no arquivo original** e ajustar os tokens se divergirem.

### 3.1 Paleta

| Token | Hex | Uso |
|---|---|---|
| `navy-950` | `#0E1D2B` | Textos de maior destaque |
| `navy-900` | `#12263A` | Texto principal, títulos |
| `navy-800` | `#1A3349` | Cor da marca (logo), botão secundário escuro |
| `navy-700` | `#27465F` | Ícones, links secundários |
| `slate-600` | `#52667A` | Texto de apoio (contraste AA sobre o fundo) |
| `teal-600` | `#1F7A70` | **Ação primária**, links, texto de sucesso (contraste AA com branco) |
| `teal-500` | `#38A095` | Cor da marca (logo), decoração, ícones grandes |
| `teal-100` | `#DDF1EE` | Fundo de selo/estado "aceito" |
| `teal-50`  | `#EEF8F6` | Fundos suaves de destaque |
| `bg` | `#F1F5F5` | Fundo do app (o mesmo tom off-white da logo) |
| `surface` | `#FFFFFF` | Cartões, documentos, formulários |
| `surface-2` | `#F7FAFA` | Cabeçalhos de tabela, áreas secundárias |
| `border` | `#DCE5E6` | Bordas padrão (1px) |
| `border-strong` | `#C3D0D2` | Bordas de inputs em repouso |

### 3.2 Semântica

| Estado | Texto | Fundo |
|---|---|---|
| Sucesso / Aceito | `#1F7A70` | `#DDF1EE` |
| Atenção / Expirando | `#8A5A00` | `#FFF4DC` |
| Erro / Recusado | `#B3372D` | `#FDECEA` |
| Informação / Enviado | `#27465F` | `#E6EEF4` |
| Neutro / Rascunho | `#52667A` | `#EAF0F1` |

### 3.3 Regras de cor
- **Texto em teal só com `teal-600`.** O `teal-500` não passa no contraste AA sobre branco; usar só em decoração e ícones grandes.
- Botão primário: fundo `teal-600`, texto branco. Hover: escurecer ~8%.
- Não usar gradientes. Não usar roxo, magenta nem "azul neon".
- Modo escuro: **fora do escopo do MVP**. Estruturar os tokens em variáveis CSS para permitir depois.

---

## 4. Tipografia

- **Família principal: Manrope** (Google Fonts via `next/font`), pesos 400, 500, 600, 700, 800. É geométrica e tem a mesma personalidade do wordmark "zelo", mas tem boa legibilidade em textos longos.
- **Mono: JetBrains Mono** (400, 500), só para hash, códigos, IDs e dados da trilha de auditoria.
- Números de valor monetário com `font-variant-numeric: tabular-nums`.

### Escala

| Papel | Mobile | Desktop | Peso |
|---|---|---|---|
| Display (login, sucesso) | 32/38 | 44/50 | 800 |
| H1 (título de página) | 26/32 | 32/38 | 800 |
| H2 (seção) | 20/26 | 22/28 | 700 |
| H3 (bloco) | 17/24 | 18/26 | 700 |
| Corpo | 16/26 | 16/26 | 400–500 |
| Apoio | 14/20 | 14/20 | 500 |
| Rótulo / badge | 12/16 | 12/16 | 600, caixa normal |

- Títulos com `letter-spacing: -0.02em`.
- **Nunca usar fonte menor que 16px em inputs** (evita zoom automático no iOS).
- Formatar dinheiro com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` e datas em `dd/MM/yyyy HH:mm`.

---

## 5. Forma, espaço e movimento

- **Raio:** 8px (botões, inputs), 12px (cartões, modais), 999px (badges, chips). Evitar `rounded-2xl` em tudo.
- **Bordas:** 1px sólida em `border`. Sombra mínima: `0 1px 2px rgba(18,38,58,.06)`. Sombra maior apenas em modais e bottom sheets.
- **Espaçamento:** grade de 4px. Padding de cartão 16px (mobile) e 24px (desktop). Entre seções 32px a 48px.
- **Largura de leitura:** conteúdo de documento com no máximo 720px.
- **Ícones:** `lucide-react`, traço 1.75, tamanho 20px (16px em badges). Sempre acompanhados de texto em ações importantes.
- **Movimento:** transições de 150ms (`ease-out`). Única animação "de marca": o **check se desenhando** (`stroke-dashoffset`, ~400ms) na confirmação do aceite, junto com o selo. Respeitar `prefers-reduced-motion`.

### Motivo gráfico assinatura: "o corte diagonal"
Derivado da diagonal do símbolo (45°). Usar com parcimônia:
- faixa diagonal teal no canto do cabeçalho da página do cliente;
- separador diagonal discreto em estados vazios e na tela de login;
- **Selo de aceite**: componente `<AcceptanceStamp />` — anel com o check, data e código curto do comprovante. É o elemento mais "da marca" do produto.

---

## 6. Componentes-chave

- **Botões:** primário (teal-600), secundário (borda navy + texto navy), terciário (texto), destrutivo (vermelho, sempre com confirmação). Altura 48px no mobile, 40px no desktop. Alvo de toque mínimo 44×44px.
- **Inputs:** altura 48px, rótulo sempre visível acima (nunca só placeholder), mensagem de erro abaixo com ícone, foco com anel teal de 2px. Máscaras para CPF, telefone e valor.
- **StatusBadge:** ícone + texto + cor (nunca só cor):
  - Rascunho (lápis), Enviado (enviar), Visualizado (olho), **Aceito (check)**, Recusado (x), Expirado (relógio).
- **Card de proposta (mobile):** cliente, título, valor em destaque, badge, data relativa.
- **Tabela (desktop):** cabeçalho `surface-2`, linhas de 56px, ação rápida na linha.
- **Timeline de auditoria:** linha vertical fina, pontos por evento, hora em fonte mono.
- **BottomSheet (mobile):** usado para o aceite e para a pré-visualização.
- **Toast:** canto inferior no mobile e superior direito no desktop, fecha sozinho em 5s, nunca bloqueia ação.
- **Skeletons** nas listas e **estados vazios com ação** (ex.: "Você ainda não enviou propostas. Criar a primeira").

---

## 7. Telas e layouts

### 7.1 Estrutura do app do prestador
- **Desktop (≥1024px):** barra lateral **clara** de 240px (logo no topo, navegação, perfil embaixo) e conteúdo à direita. A barra é clara para a logo atual funcionar sem versão negativa.
- **Mobile:** barra superior enxuta (símbolo + título da página) e **navegação inferior** com 4 itens: Início, Propostas, Templates, Conta. Botão central destacado **"Nova proposta"** (teal).

### 7.2 Telas do MVP

1. **Login / Cadastro.** Desktop: formulário à esquerda, painel da marca à direita (símbolo grande recortado + exemplo de comprovante). Mobile: só o formulário, com logo no topo.
2. **Início (painel).** Três números: *Aguardando resposta*, *Aceitas no mês*, *Valor aceito no mês*. Abaixo, **"Precisa de atenção"** (visualizadas sem resposta e perto de vencer) e propostas recentes.
3. **Propostas.** Busca, filtros por status em chips e lista (cards no mobile, tabela no desktop).
4. **Nova proposta (assistente em 4 etapas):** Cliente e template → Escopo e itens → Valores, prazo e pagamento → Revisar e enviar.
   - Desktop: formulário à esquerda e **pré-visualização ao vivo do documento** à direita.
   - Mobile: botão "Ver como o cliente verá" abre a pré-visualização em bottom sheet.
   - Salvar rascunho automaticamente.
5. **Proposta criada.** Ação principal: **"Enviar por WhatsApp"** (abre `wa.me` com a mensagem pronta). Secundária: "Copiar link". Mostrar a mensagem que será enviada.
6. **Detalhe da proposta.** Documento + status + **Trilha de auditoria** (timeline) + botão "Baixar comprovante (PDF)". Hash em fonte mono com botão copiar.
7. **Página pública do cliente (`/p/[token]`) — a tela mais importante.**
   - Cabeçalho: nome/logo do prestador e "via Zelo" discreto, com o corte diagonal teal.
   - Resumo no topo: **valor, prazo e validade** em cartão.
   - Em seguida: escopo, o que está incluso e o que **não** está incluso (destacado), condições de pagamento e garantia.
   - **Barra fixa no rodapé**: botão "Aceitar proposta" (primário) e "Tenho dúvidas" (secundário, abre o WhatsApp do prestador).
   - Ao aceitar: bottom sheet com nome, CPF, texto de consentimento em caixa de seleção e botão "Confirmar aceite".
   - Sucesso: selo de aceite com o check animado, resumo do que foi aceito e botão "Baixar comprovante".
   - Estados: link expirado, proposta já aceita, proposta cancelada.
   - Prioridade de performance: página leve (Server Components, quase nenhum JS no carregamento), pois é aberta em celular com rede ruim.
8. **Verificação pública (`/verificar`)** *(opcional)*. Campo de código do comprovante, resposta "Documento íntegro" ou "Não encontrado".
9. **Admin.** Lista de prestadores com ativar/suspender, contadores gerais e gestão de templates. Pode ser visualmente mais simples (tabela e formulários).

---

## 8. UX, acessibilidade e microcopy

### UX
- Uma ação principal por tela. Botão primário sempre no mesmo lugar (rodapé no mobile).
- Formulários curtos, divididos em etapas, com progresso visível e validação no momento certo (ao sair do campo).
- Nunca perder dados do usuário: autosave de rascunho e confirmação antes de sair com alterações.
- Feedback imediato em toda ação (estado de carregamento no botão, toast de confirmação).
- Operações destrutivas pedem confirmação e explicam o efeito.

### Acessibilidade (nível AA)
- Contraste mínimo 4,5:1 para texto; usar só `teal-600` para texto verde.
- Estado de foco visível em todos os elementos interativos; navegação completa por teclado.
- Status nunca só por cor (ícone + texto).
- Rótulos associados a inputs, mensagens de erro com `aria-live`, `lang="pt-BR"`.
- Respeitar `prefers-reduced-motion`.

### Microcopy (português do Brasil, tratamento por "você")
- Direto e caloroso, frases curtas. Evitar "Oops", exclamações em excesso e jargão técnico.
- Exemplos:
  - Botão: "Enviar por WhatsApp", "Aceitar proposta", "Confirmar aceite", "Baixar comprovante".
  - Vazio: "Nenhuma proposta por aqui ainda. Crie a primeira em 2 minutos."
  - Erro: "Não conseguimos salvar agora. Seus dados continuam aqui, tente de novo."
  - Consentimento: "Li a proposta e aceito os termos acima. Entendo que este aceite fica registrado com data, hora e dispositivo."
  - Sucesso: "Aceite registrado. Guarde o comprovante."

---

## 9. Checklist anti "cara de IA"

Evitar:
- gradientes roxo/azul, brilhos, glassmorphism e "blobs" decorativos;
- hero centralizado com três cartões idênticos de "features" com emoji;
- sombras grandes e `rounded-2xl` em tudo;
- ícones soltos em círculos coloridos sem função;
- textos genéricos ("Revolucione seu negócio", "Potencialize sua gestão");
- dados falsos óbvios ("John Doe", "Empresa XYZ"). Usar exemplos reais do universo do produto (ex.: "Reforma do banheiro — R$ 8.400,00", "Troca de tela iPhone 12").

Preferir:
- estrutura de documento, tipografia bem trabalhada, alinhamentos consistentes;
- poucos elementos, bem espaçados, com hierarquia clara;
- detalhes de confiança reais (hash, carimbo de data e hora, selo de aceite);
- ilustrações simples feitas com as formas da marca, ou nenhuma.

---

## 10. Implementação (stack)

- **Next.js (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui.**
- Definir tokens em `@theme` (variáveis CSS) a partir das seções 3 a 5; **customizar o tema do shadcn** (cores, raio de 8/12px, anel de foco teal) para não parecer o padrão.
- Fontes com `next/font` (Manrope e JetBrains Mono), `display: swap`.
- Ícones: `lucide-react`.
- Estrutura sugerida:
  ```
  app/
    (auth)/login, cadastro
    (app)/inicio, propostas, propostas/nova, propostas/[id], templates, conta
    (admin)/admin/...
    p/[token]/          ← página pública do cliente
    verificar/
  components/ui/        ← shadcn customizado
  components/zelo/      ← StatusBadge, AcceptanceStamp, ProposalCard, AuditTimeline...
  styles/tokens.css
  ```
- Testar nos breakpoints 375px, 768px e 1280px. Meta: página pública com ótimo desempenho em celular intermediário (Lighthouse mobile ≥ 90).

---

## 11. Prompt sugerido para o Claude Code

> Leia `DESIGN.md` e `CLAUDE.md`. Usando a skill frontend-design, implemente o design system da Zelo: tokens de cor e tipografia (Tailwind v4 + shadcn customizado), fontes Manrope e JetBrains Mono, e os componentes `StatusBadge`, `AcceptanceStamp`, `ProposalCard` e `AuditTimeline`. Em seguida construa a **página pública do cliente (`/p/[token]`)** mobile-first, conforme a seção 7.2, usando dados de exemplo realistas em português. Siga a checklist anti "cara de IA" e as regras de acessibilidade. Ao terminar, mostre como rodar e liste o que ficou pendente.
