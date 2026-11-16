# CLAUDE.md — Projeto Zelo

@AGENTS.md

> Fonte da verdade para quem trabalha no código (pessoas e IA). Leia também `DESIGN.md`
> (identidade visual e UX, obrigatório para qualquer tela) e `PROMPT-INICIAL.md` (escopo).
> Atualize este arquivo sempre que uma decisão mudar.

## O que é

**Zelo** é uma plataforma web para prestadores de serviço (reformas, assistência técnica,
instalação, design, agências) enviarem propostas, escopos e entregas para o cliente aprovar
online, sem conta, com **trilha de auditoria** e **PDF comprovante**. Assinatura: *Combinou? Registrou.*
Trabalho de faculdade (ADS): precisa estar hospedado e funcionando, só com planos gratuitos.

**Fluxo principal:** prestador cria proposta (a partir de template do nicho) → envia link por
WhatsApp (`wa.me`) ou copia → cliente abre no celular, lê, aceita / recusa / pede ajuste →
confirma identidade com OTP por e-mail → sistema gera PDF com auditoria e envia por e-mail aos
dois → painel mostra "Aceita" → no fim, aceite de entrega. Aditivos de escopo usam o mesmo fluxo.

## Como trabalhar

- Conversa e textos de interface em **português do Brasil** (tratamento por "você").
- Identificadores de código em **inglês**; tabelas e colunas do banco em **português, snake_case**.
- Trabalho **por fases** (`docs/PLANO.md`). Ao fim de cada fase: `npm run check`, commit,
  resumo curto e **parar para revisão**.
- Não inventar requisitos. Ambiguidade → pergunta objetiva ou opção mais simples registrada
  na seção "Decisões" abaixo.
- Comentar o **porquê** em trechos não óbvios (segurança, hash, RLS). O autor precisa
  conseguir explicar cada decisão na apresentação.
- Interface: skill `frontend-design` + `DESIGN.md`, mobile first (375px → 1280px).

## Stack

| Camada | Escolha |
|---|---|
| App | Next.js **16** (App Router, Turbopack) + TypeScript + React 19 |
| Estilo | Tailwind CSS v4 + shadcn/ui (base Radix, tema customizado) + `lucide-react` |
| Fontes | Manrope (UI) e JetBrains Mono (hash/códigos) via `next/font` |
| Dados | Supabase: Postgres + RLS + Auth + Storage (`@supabase/ssr`, `@supabase/supabase-js`) |
| Validação | Zod 4 |
| PDF | `@react-pdf/renderer` (Fase 7) |
| E-mail | Resend (padrão) ou SMTP/Gmail com `nodemailer`, por `EMAIL_PROVIDER` |
| Testes | Vitest (+ Playwright no fluxo principal, se der tempo) |
| Deploy | Vercel Hobby + GitHub Actions (CI e keep-alive do Supabase) |

**Atenção ao Next 16** (ver `AGENTS.md`): consulte `node_modules/next/dist/docs/` antes de usar
APIs. Diferenças já relevantes: `middleware.ts` agora é **`proxy.ts`**; `LayoutProps`/`PageProps`
são tipos globais gerados por `next typegen`.

## Perfis

Coluna `role` em `profiles`: `admin` | `prestador`.

- **Prestador:** cadastro/login; cria, envia e acompanha propostas, aditivos e aceites de entrega;
  baixa o PDF.
- **Admin:** lista prestadores, ativa/suspende contas, vê contagens. **Nunca** altera aceites.
- **Cliente (sem conta, por link):** vê a proposta; aceita, recusa ou pede ajuste com OTP por e-mail.
- Conta suspensa não loga nem cria propostas; links já enviados continuam válidos.

## Modelo de dados (Fase 1)

- `profiles` (id → `auth.users`, nome, email, telefone, empresa_nome, role, ativo, criado_em) —
  criado por trigger no cadastro.
- `templates` (id, nicho, titulo, conteudo jsonb, dono_id nulo = global, ativo).
- `propostas` (id, prestador_id, tipo `proposta|aditivo|entrega`, proposta_pai_id, cliente_nome,
  cliente_email, cliente_telefone, titulo, status, versao_atual, token_hash, validade_em, criado_em).
- `proposta_versoes` (id, proposta_id, numero, conteudo jsonb, hash_sha256, enviada_em) —
  imutável depois de enviada.
- `aceites` (id, versao_id, resultado `aceito|recusado|ajuste`, comentario, cliente_nome,
  cliente_cpf, ip, user_agent, otp_verificado_em, texto_consentimento, hash_documento, pdf_path,
  criado_em) — append-only.
- `auditoria_eventos` (id, proposta_id, versao_id, tipo, ip, user_agent, metadados jsonb,
  criado_em) — append-only.
- `otp_codigos` (id, proposta_id, email, codigo_hash, expira_em, tentativas, usado_em).

Status da proposta: `rascunho`, `enviada`, `visualizada`, `aceita`, `recusada`, `expirada`
(+ `ajuste_solicitado`, proposto no plano).

## Regras inegociáveis (segurança e integridade)

1. **Imutabilidade no banco:** versão enviada nunca é editada; `aceites` e `auditoria_eventos`
   são append-only. Garantido por **triggers** que bloqueiam `UPDATE`/`DELETE` + RLS (triggers
   valem até para a `service_role`, que ignora RLS).
2. **Hash:** SHA-256 (`node:crypto`) da **serialização canônica** (chaves ordenadas
   recursivamente, sem espaços) do conteúdo da versão. Gravado na versão, repetido no aceite e no
   PDF; o verificador recalcula e compara.
3. **RLS ligado em todas as tabelas**, com políticas testadas (prestador A não lê dados de B).
4. **Cliente sem login = só pelo servidor.** Token do link: ≥ 32 bytes aleatórios, base64url; no
   banco só o **hash**. Rotas públicas validam o token no servidor e usam `service_role` **só no
   servidor** (`lib/supabase/service.ts`, protegido por `server-only`). Nunca `NEXT_PUBLIC_*`.
5. **OTP:** 6 dígitos com `crypto.randomInt`, só o hash, expira em 10 min, máx. 5 tentativas,
   reenvio limitado (3/hora por proposta), uso único.
6. **Zod** em todo formulário, rota e Server Action. Sanitizar o que é renderizado.
7. **Storage privado**, acesso por URL assinada de curta duração.
8. **Segredos** só em env (`.env.local` fora do Git; painel da Vercel). `.env.example` sem valores.
   Segredo no repositório → avisar o usuário na hora.
9. **LGPD:** coletar o mínimo; finalidade no texto de consentimento; CPF mascarado na UI
   (`***.456.789-**`, `lib/format.ts`); nunca logar dados pessoais.
10. **Rate limiting** nas rotas públicas (abertura de link, envio de OTP, confirmação).

## Decisões

| # | Decisão | Porquê |
|---|---|---|
| D1 | Link por WhatsApp via `wa.me` (manual) + copiar link | Sem custo; API oficial é paga |
| D2 | OTP por **e-mail**; e-mail do cliente obrigatório, telefone opcional | WhatsApp API é paga |
| D3 | E-mail atrás de interface em `lib/email/`, provedores `resend` e `smtp` | Resend sem domínio só entrega ao dono da conta |
| D4 | Aditivo e entrega reutilizam `propostas` (`tipo` + `proposta_pai_id`) | Sem telas/tabelas duplicadas |
| D5 | Sem modo escuro e sem multiusuário no MVP | Escopo |
| D6 | `cacheComponents` e `partialPrefetching` **desligados** (vinham ligados no template do Next 16) | App é dinâmico (sessão em cookie); modelo padrão é mais simples de explicar |
| D7 | shadcn com base **Radix**, preset nova, tema mapeado para tokens da Zelo em `app/globals.css` | Componentes acessíveis; tema não pode parecer o padrão |
| D8 | Env validado com Zod; segredos em `lib/env.server.ts` com `import "server-only"` | Build quebra se um segredo for importado no cliente |
| D9 | Hash de OTP e token com **HMAC-SHA256** usando o segredo `HASH_PEPPER` | OTP tem só 10⁶ combinações: SHA-256 puro seria quebrável por força bruta se o banco vazasse |
| D10 | Chave pública chamada `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (aceita a anon legada) e secreta `SUPABASE_SERVICE_ROLE_KEY` (aceita `sb_secret_...`) | Nomes atuais do Supabase, sem quebrar projetos antigos |
| D11 | Logo **reconstruída geometricamente** em SVG (`scripts/brand/build.mjs`), não trace do JPEG; wordmark em Manrope ExtraBold convertido em curvas | Curvas limpas e simétricas; reprodutível. Revisar com o autor |
| D12 | `@types/node@22` | Node local é 22; vitest 5 exige ≥ 22 |
| D13 | Utilitário `cn` vem do pacote oficial `cn` (shadcn-ui/cn), não de clsx + tailwind-merge | Padrão do shadcn atual |

Decisões **propostas** no plano e ainda não aprovadas ficam em `docs/PLANO.md`.

## Estrutura

```
app/                      rotas (App Router). Futuro: (auth)/, (app)/, (admin)/, p/[token]/, verificar/
components/ui/            shadcn customizado (button.tsx já com o tema da Zelo)
components/zelo/          componentes da marca: Logo, AcceptanceStamp (Fase 3: StatusBadge, ProposalCard, AuditTimeline…)
lib/env.ts                env públicas (Zod)
lib/env.server.ts         segredos (server-only)
lib/supabase/             client.ts (navegador), server.ts (usuário logado), service.ts (service_role, só servidor)
lib/email/                interface de e-mail + provedores (Fase 6)
lib/validation/           schemas Zod compartilhados
lib/format.ts             moeda, data/hora (America/Sao_Paulo), máscara de CPF
styles/tokens.css         tokens da marca (@theme do Tailwind)
supabase/migrations/      migrations versionadas (Fase 1)
public/brand/             logo.svg, symbol.svg, logo-negativo.svg
scripts/brand/            gerador da marca (ferramenta avulsa)
tests/unit/               testes Vitest
brand-original/           JPEGs originais da logo (referência)
docs/PLANO.md             plano das fases
```

## Comandos

```bash
npm run dev           # desenvolvimento em http://localhost:3000
npm run build         # build de produção
npm run lint          # ESLint (com eslint-config-prettier)
npm run typecheck     # next typegen + tsc --noEmit
npm test              # Vitest
npm run check         # lint + typecheck + testes (rodar antes de cada commit de fase)
npm run format        # Prettier (com ordenação de classes Tailwind)
```

## Convenções de UI (resumo do DESIGN.md)

- Tokens em `styles/tokens.css`: `navy-*`, `teal-*`, `bg`, `surface`, `surface-2`, `line`,
  `line-strong`, semânticos `success|warning|danger|info|neutral` (+ `-bg`).
- Tipografia: utilitários `text-display`, `text-h1`, `text-h2`, `text-h3`, `text-body`,
  `text-support`, `text-label`. Valores com classe `tabular`.
- Texto teal **só** `teal-600`; `teal-500` só decoração. Status sempre ícone + texto.
- Raio: `--radius-control` 8px, `--radius-card` 12px, `--radius-pill`. Inputs ≥ 16px.
- Única animação de marca: check se desenhando (`animate-draw-check`), respeitando reduced motion.
