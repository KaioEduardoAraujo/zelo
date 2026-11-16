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

Status gravados: `rascunho`, `enviada`, `visualizada`, `aceita`, `recusada`, `ajuste_solicitado`.
`expirada` é **calculada na leitura** pela view `propostas_situacao` (coluna `status_efetivo`).
Extras: `aceites.codigo_comprovante` (`ZL-XXXX-XXXX`, gerado pelo banco), `propostas.atualizado_em`,
função `admin_resumo_prestadores()` (contagens para o admin), buckets privados `comprovantes` e
`entregas` (caminho `<prestador_id>/...`).

**Conteúdo da versão** (`lib/validation/proposta.ts`, valores em **centavos**):
`{ escopo, itens[{descricao, unidade, quantidade, valor_unitario_centavos}], exclusoes[],
valor_total_centavos, prazo, pagamento, garantia, observacoes? }`. Templates têm também `validade_dias`.

**Regras garantidas por trigger** (`supabase/migrations/*_triggers.sql`): perfil nasce como
prestador (metadados do cadastro ignorados); prestador não muda `role`/`ativo`; admin só muda `ativo`
de outros; versões nascem rascunho, numeradas pelo banco, uma em rascunho por vez, imutáveis após
envio; nova versão volta a proposta a rascunho; dados do cliente só mudam em rascunho;
`aceita/recusada/ajuste_solicitado` exigem o registro em `aceites`; prestador só move status para
rascunho/enviada; aceite exige versão atual enviada, dentro da validade e com hash igual; aditivo/entrega
só apontam para proposta aceita do mesmo prestador; `criado_em` de aceites/eventos é sempre `now()`;
TRUNCATE bloqueado nas tabelas de prova.

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
| D14 | Valores monetários em **centavos** (inteiros) | Sem erro de ponto flutuante; hash estável (aprovado) |
| D15 | Status `ajuste_solicitado` | Painel precisa mostrar pedido de ajuste (aprovado) |
| D16 | `expirada` calculada na leitura (view), sem cron | Mais simples e sempre correto (aprovado) |
| D17 | Rate limiting em tabela do Postgres (Fase 6) | Sem serviço extra; memória não funciona na Vercel (aprovado) |
| D18 | Reenviar link = gerar link novo (antigo deixa de valer) | Banco só guarda o hash do token (aprovado) |
| D19 | Desenvolvimento e testes de banco no **Supabase local (Docker)** via `npx supabase`; nuvem só recebe migrations prontas | Testes rápidos e isolados; não gasta o plano gratuito |
| D20 | `anon` sem nenhum privilégio nas tabelas (além do RLS); `authenticated` sem INSERT/UPDATE/DELETE em `aceites`/`auditoria_eventos` e sem acesso a `otp_codigos` | Defesa em profundidade: só o servidor grava provas |
| D21 | `pdf_path` do aceite é definido **antes** de gerar o PDF (`<prestador_id>/<aceite_id>.pdf`) | Aceite é append-only: não pode receber UPDATE depois |
| D22 | Admin criado por script (`npm run db:seed-admin`), não por SQL | Senha não fica em arquivo versionado |
| D23 | E-mails locais vão para o **Mailpit** do Supabase (SMTP 127.0.0.1:54325, UI :54324) | Testar e-mails sem gastar cota do Resend |
| D24 | Snapshot dos dados do cliente/prestador dentro do `conteudo` antes do hash (Fase 5) | O hash cobre tudo o que foi combinado (aprovado) |
| D25 | Autorização em 3 camadas: `proxy.ts` (redirecionamento otimista + renovação de sessão) → DAL `lib/auth/dal.ts` (`requireUser/requirePrestador/requireAdmin`, usa `getUser()`) em cada layout, página e action → RLS no banco | Proxy não é barreira de segurança; layouts não re-renderizam em toda navegação |
| D26 | Links de e-mail com **token_hash** → `/auth/confirm` (templates PT-BR em `supabase/templates/`), não PKCE | PKCE só funciona no mesmo navegador; o cliente pode pedir no PC e abrir no celular |
| D27 | Confirmação de e-mail no cadastro **desligada** no MVP | SMTP gratuito do Supabase é limitado; reduz atrito |
| D28 | Conta suspensa: login encerra a sessão e explica; sessão já aberta é mandada para `/conta-suspensa` pelo DAL. Na Fase 9, suspender também bane o usuário no Supabase Auth | Bloqueio no app, no banco (RLS) e no Auth |
| D29 | Parâmetro `next` validado por `safeNextPath` (só caminhos internos) | Evita redirecionamento aberto (phishing) |
| D30 | Mensagens de login/recuperação não revelam se o e-mail existe | Evita enumeração de contas |
| D31 | Playwright adiantado da Fase 10: e2e com o Chrome do sistema (local) e Chromium (CI), desktop + 375px | Prova os fluxos de autenticação de ponta a ponta |
| D32 | `sign_in_sign_ups = 300` **só** no `supabase/config.toml` local; nunca rodar `supabase config push` sem revisar | Os testes fazem muitos logins do mesmo IP; produção fica com o padrão |

Decisões **propostas** no plano e ainda não aprovadas ficam em `docs/PLANO.md`.

## Estrutura

```
app/                      rotas: (auth)/ login, cadastro, esqueci-senha, redefinir-senha, conta-suspensa;
                          (app)/ área do prestador; (admin)/admin; auth/confirm (links de e-mail). Futuro: p/[token]/, verificar/
components/ui/            shadcn customizado (button.tsx já com o tema da Zelo)
components/zelo/          componentes da marca: Logo, AcceptanceStamp (Fase 3: StatusBadge, ProposalCard, AuditTimeline…)
proxy.ts                  renova sessão + redirecionamento otimista (antigo middleware)
lib/auth/                 routes.ts (rotas, safeNextPath), dal.ts (checagem no servidor), actions.ts (login, cadastro, senha)
lib/validation/auth.ts    schemas Zod dos formulários de acesso
supabase/templates/       e-mails de Auth em PT-BR (recuperar senha, confirmar cadastro)
tests/e2e/                Playwright (support.ts: contas via Admin API e leitura do Mailpit)
lib/env.ts                env públicas (Zod)
lib/env.server.ts         segredos (server-only)
lib/supabase/             client.ts (navegador), server.ts (usuário logado), service.ts (service_role, só servidor)
lib/email/                interface de e-mail + provedores (Fase 6)
lib/format.ts             moeda, data/hora (America/Sao_Paulo), máscara de CPF
styles/tokens.css         tokens da marca (@theme do Tailwind)
supabase/migrations/      migrations versionadas: tipos, tabelas, índices, triggers, RLS, storage
supabase/seed.sql         5 templates globais
supabase/config.toml      config do Supabase local
lib/supabase/database.types.ts  tipos gerados (npm run db:types) — não editar à mão
lib/validation/proposta.ts      schema Zod do conteúdo da proposta/template
scripts/seed-admin.ts     cria o admin
tests/db/                 testes contra o Supabase local (helpers.ts cria usuários e propostas)
public/brand/             logo.svg, symbol.svg, logo-negativo.svg
scripts/brand/            gerador da marca (ferramenta avulsa)
tests/unit/               testes unitários
brand-original/           JPEGs originais da logo (referência)
docs/PLANO.md             plano das fases
```

## Comandos

```bash
npm run dev           # desenvolvimento em http://localhost:3000
npm run build         # build de produção
npm run lint          # ESLint (com eslint-config-prettier)
npm run typecheck     # next typegen + tsc --noEmit
npm test              # testes unitários (Vitest, projeto "unit")
npm run test:db       # testes de banco: RLS, imutabilidade, seeds (exige Supabase local)
npm run test:e2e      # Playwright: fluxos no navegador (sobe `next dev` na porta 3100)
npm run check         # lint + typecheck + unit + db + e2e (rodar antes de cada commit de fase)
npm run format        # Prettier (com ordenação de classes Tailwind)

npm run db:start      # sobe o Supabase local (Docker). Studio: http://127.0.0.1:54323
npm run db:reset      # recria o banco local: migrations + supabase/seed.sql
npm run db:types      # regenera lib/supabase/database.types.ts
npm run db:advisors   # advisors de segurança/desempenho do Supabase
npm run db:seed-admin # cria/promove o admin (SEED_ADMIN_* do .env.local)
npm run db:stop       # desliga o Supabase local
```

## Convenções de UI (resumo do DESIGN.md)

- Tokens em `styles/tokens.css`: `navy-*`, `teal-*`, `bg`, `surface`, `surface-2`, `line`,
  `line-strong`, semânticos `success|warning|danger|info|neutral` (+ `-bg`).
- Tipografia: utilitários `text-display`, `text-h1`, `text-h2`, `text-h3`, `text-body`,
  `text-support`, `text-label`. Valores com classe `tabular`.
- Texto teal **só** `teal-600`; `teal-500` só decoração. Status sempre ícone + texto.
- Raio: `--radius-control` 8px, `--radius-card` 12px, `--radius-pill`. Inputs ≥ 16px.
- Única animação de marca: check se desenhando (`animate-draw-check`), respeitando reduced motion.
