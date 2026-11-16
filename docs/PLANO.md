# Plano de fases — Zelo

> Cada fase termina com `npm run check` verde, commit e parada para revisão.
> Itens marcados **[decisão proposta]** precisam do seu OK (ou ajuste) antes de virarem regra no `CLAUDE.md`.

## Fase 0 — Fundação ✅

Next.js 16 + TS + Tailwind v4 + shadcn (tema Zelo) · ESLint + Prettier · Vitest · Zod · clientes
Supabase (navegador, servidor, service) · Manrope e JetBrains Mono · logo em SVG + favicon ·
`CLAUDE.md`, `.env.example`, estrutura de pastas · página inicial na identidade.

---

## Fase 1 — Banco de dados ✅

> Feito conforme abaixo, com 43 testes de banco. Extras: código curto do comprovante, view
> `propostas_situacao`, triggers que impedem "forjar" aceite pelo status. Ver `CLAUDE.md`.

**Ambiente:** Supabase CLI via `npx supabase` (devDependency) + **Supabase local no Docker** para
desenvolver e testar; migrations aplicadas no projeto da nuvem com `supabase db push` (ou MCP).

1. `supabase init`; migrations numeradas em `supabase/migrations/`:
   - `0001_enums.sql` — `papel` (admin, prestador), `proposta_tipo`, `proposta_status`,
     `aceite_resultado`, `nicho`.
   - `0002_tabelas.sql` — as 7 tabelas do `CLAUDE.md`, com FKs, `check`s (e-mail, telefone,
     CPF com 11 dígitos), `not null` e defaults.
   - `0003_indices.sql` — `propostas(prestador_id, status)`, `propostas(token_hash)` único,
     `proposta_versoes(proposta_id, numero)` único, `auditoria_eventos(proposta_id, criado_em)`,
     `otp_codigos(proposta_id, criado_em)`.
   - `0004_triggers.sql`:
     - `handle_new_user` cria `profiles` no cadastro (sempre `role = 'prestador'`; o admin só via seed).
     - `bloquear_alteracao` em `aceites` e `auditoria_eventos`: qualquer `UPDATE`/`DELETE` → erro.
     - `proteger_versao_enviada`: em `proposta_versoes`, se `OLD.enviada_em is not null` → erro em
       `UPDATE`/`DELETE`. Permite um único `UPDATE` que preenche `enviada_em` + `hash_sha256`.
     - `proteger_perfil`: prestador não pode mudar o próprio `role` nem `ativo`.
   - `0005_rls.sql` — RLS em **todas** as tabelas. Funções `is_admin()` e `is_active_prestador()`
     (`security definer`, `search_path` fixo). Prestador: CRUD só onde `prestador_id = auth.uid()`;
     leitura de templates globais + próprios. Admin: lê `profiles` e atualiza `ativo`; contagens via
     **view/função agregada** (não lê conteúdo de propostas). `aceites`, `auditoria_eventos` e
     `otp_codigos`: **sem** política de escrita para `authenticated` — só o servidor (service_role)
     insere.
   - `0006_storage.sql` — buckets privados `comprovantes` e `entregas` + políticas.
2. **Seeds:** `supabase/seed.sql` com 5 templates globais realistas; script `scripts/seed-admin.ts`
   cria o admin pela Admin API com `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (senha nunca em SQL).
3. Tipos: `supabase gen types` → `lib/supabase/database.types.ts`; clientes passam a ser tipados.
4. **Testes** (`tests/db/*.test.ts`, Vitest contra o Supabase local): dois prestadores criados
   pela Admin API; prova que A não lê/edita propostas, versões, aceites e eventos de B; `UPDATE` e
   `DELETE` em `aceites`/`auditoria_eventos`/versão enviada falham **mesmo com service_role**;
   suspenso não insere proposta; prestador não vira admin.

**[decisão proposta] Dinheiro em centavos (inteiro)** no `conteudo` (`valor_centavos`). Evita erro
de ponto flutuante e deixa o hash estável (`8400` vs `8400.00`).

**[decisão proposta] Status extra `ajuste_solicitado`** — o fluxo permite "pedir ajuste" e o
painel precisa mostrar isso; sem ele, a proposta pareceria só "visualizada".

**[decisão proposta] `expirada` calculado na leitura** (`validade_em < now()` numa view), sem cron.
Mais simples e sempre correto.

*Pronto quando:* testes de RLS e de imutabilidade passando localmente.

## Fase 2 — Autenticação e papéis

- Telas `(auth)/login`, `cadastro`, `esqueci-senha`, `redefinir-senha` (DESIGN.md 7.2.1: formulário
  + painel da marca no desktop).
- Server Actions com Zod; mensagens de erro genéricas no login (não revelar se o e-mail existe).
- `proxy.ts` (antigo middleware) renova a sessão e faz o redirecionamento otimista;
  **checagem real no servidor** num Data Access Layer (`lib/auth/dal.ts`: `requireUser`,
  `requireAdmin`) chamado em cada layout/página/action protegida.
- Conta suspensa: bloqueio no DAL + RLS (`is_active_prestador()`), com tela explicando.
- Recuperação de senha pelo fluxo do Supabase Auth (`resetPasswordForEmail` + callback com PKCE).

## Fase 3 — Design system e shell

- Componentes shadcn necessários (input, label, form, dialog, sheet, sonner/toast, skeleton,
  table, tabs) com o tema da Zelo.
- `components/zelo/`: `StatusBadge`, `AcceptanceStamp` (completo), `ProposalCard`, `AuditTimeline`,
  `MoneyInput`, `CpfInput`, `PhoneInput` (máscaras), `EmptyState`, `BottomSheet`.
- Shell do prestador: sidebar clara 240px (≥1024px) e barra inferior com 4 itens + "Nova
  proposta" no mobile.
- Página interna `/dev/componentes` (só em desenvolvimento) para revisar tudo em 375/1280px.

## Fase 4 — Propostas

- Lista com busca e filtro por status (cards no mobile, tabela no desktop), paginação simples.
- Assistente em 4 etapas (Cliente e template → Escopo e itens → Valores, prazo e pagamento →
  Revisar) com pré-visualização ao vivo (desktop) e bottom sheet (mobile).
- Schema Zod único do `conteudo` (`lib/validation/proposta.ts`), usado no formulário, no servidor
  e no hash.
- Autosave do rascunho (debounce ~1,5 s via Server Action) + aviso ao sair com alterações.
- Versionamento: editar proposta enviada cria `numero + 1` como rascunho; a anterior fica intacta.
- Templates: listar globais/próprios, duplicar e personalizar.
- Painel inicial: 3 números + "Precisa de atenção" + recentes.

## Fase 5 — Envio

- `lib/crypto/canonical.ts` (JSON canônico) + `hash.ts` (SHA-256) — **com testes** (ordem das
  chaves não muda o hash; qualquer alteração muda).
- `lib/crypto/token.ts`: `randomBytes(32)` → base64url; banco guarda `HMAC(token)`.
- Ao enviar, o `conteudo` da versão recebe um **retrato dos dados do cliente e do prestador**
  (nome, e-mail, título, validade) antes do hash: assim o hash cobre tudo o que foi combinado.
- Action "Enviar": valida, calcula hash, grava `enviada_em` + `hash_sha256` (trava a versão),
  gera token, registra evento `enviada`, status `enviada`. Tudo numa função SQL (`rpc`) para ser
  atômico.
- Tela "Proposta criada": **Enviar por WhatsApp** (`wa.me/55…?text=…`), **Copiar link**,
  prévia da mensagem. O token só existe nessa resposta. **[decisão proposta]** Para reenviar o
  link depois, o prestador **gera um novo link** (o antigo deixa de valer), porque não guardamos o
  token em texto puro.

## Fase 6 — Página pública `/p/[token]`

- Server Component leve; valida token (HMAC → busca) com service_role; registra `aberta` e
  marca `visualizada` na primeira abertura.
- Resumo (valor, prazo, validade), escopo, incluso / **não incluso**, pagamento, garantia; barra
  fixa "Aceitar proposta" / "Tenho dúvidas" (WhatsApp do prestador).
- Bottom sheet: nome, CPF (validação de dígitos), consentimento, "Enviar código" → OTP por e-mail
  → "Confirmar aceite". Recusar e pedir ajuste (com comentário) seguem o mesmo OTP.
- `lib/email/`: interface `EmailProvider` + `resend.ts` + `smtp.ts` + templates de e-mail.
- **Rate limiting [decisão proposta]: tabela no Postgres** (`rate_limits` + função
  `check_rate_limit(chave, limite, janela)`), sem serviço extra. Em memória não funciona na
  Vercel (cada requisição pode cair numa instância diferente).
- IP pelo cabeçalho `x-forwarded-for` (definido pela Vercel); user agent resumido.
- Estados: link inválido, expirado, já respondida, cancelada.

## Fase 7 — Comprovante

- **`@react-pdf/renderer`** (escolha): o PDF é escrito em JSX com flexbox, igual ao resto do app,
  então fica fácil de manter e explicar; o `pdf-lib` exigiria posicionar texto por coordenadas.
  Roda no runtime Node da Vercel.
- PDF: dados da proposta e do aceite, CPF mascarado, trilha de auditoria, hash, código do
  comprovante. Salvo em `comprovantes/` (privado); download por URL assinada (60 s).
- E-mail com o PDF anexo para cliente e prestador.
- `/verificar`: código do comprovante (+ upload opcional do PDF) → recalcula o hash da versão e
  compara → "Documento íntegro" ou "Não encontrado".

## Fase 8 — Aditivo e aceite de entrega

- "Novo aditivo" numa proposta aceita (`tipo = aditivo`, `proposta_pai_id`), assistente curto.
- "Aceite de entrega": checklist + até N fotos (bucket `entregas`, compressão no navegador,
  limite de tamanho), mesmo fluxo de envio/aceite/PDF.

## Fase 9 — Admin

- `(admin)/admin`: tabela de prestadores (nome, empresa, e-mail, propostas, aceites, status),
  ativar/suspender com confirmação, contadores gerais, gestão de templates globais.

## Fase 10 — Qualidade e entrega

- Testes dos fluxos críticos (+ Playwright no fluxo principal se der tempo), checklist de
  segurança da seção 4, acessibilidade (teclado, contraste, `aria-live`), Lighthouse mobile ≥ 90
  em `/p/[token]`.
- `README.md` (arquitetura, como rodar, decisões, limitações, evolução).
- GitHub Actions: CI (lint, tipos, testes; testes de banco com Supabase local no runner) e
  **keep-alive** agendado a cada 3 dias (consulta leve com a chave pública).
- Deploy na Vercel com variáveis configuradas; checar URLs de redirecionamento do Supabase Auth.

---

## Riscos e dúvidas

1. **E-mail é o ponto mais frágil.**
   - Resend sem domínio verificado só entrega para o e-mail do dono da conta: na apresentação, um
     cliente real **não receberia o OTP**. Saídas: (a) `EMAIL_PROVIDER=smtp` com Gmail + senha de
     app (exige verificação em 2 etapas; ~500 e-mails/dia); (b) um domínio barato verificado no
     Resend (100/dia, 3.000/mês).
   - **Os e-mails do próprio Supabase Auth** (confirmação de cadastro e "esqueci a senha") usam o
     SMTP embutido, que só entrega para e-mails da equipe do projeto e tem limite de poucos
     e-mails por hora. Proposta: configurar
     SMTP próprio no painel do Supabase (o mesmo Gmail ou Resend) e **desligar a confirmação de
     e-mail no cadastro** no MVP.
2. **Supabase gratuito pausa após ~7 dias sem uso** → keep-alive na Fase 10 (já no plano). Limites:
   500 MB de banco, 1 GB de Storage (fotos de entrega precisam de compressão e limite).
3. **service_role ignora RLS** → por isso a imutabilidade fica em **triggers** (valem para todos) e
   o cliente service só existe em arquivos `server-only`.
4. **Hash estável:** o `jsonb` do Postgres reordena chaves e pode mudar a forma de números; a
   serialização canônica + valores em centavos resolve. Teste dedicado na Fase 5.
5. **OTP:** sem pepper, o hash de 6 dígitos seria quebrável; com HMAC + limite de tentativas +
   expiração curta fica seguro para o escopo.
6. **Next 16** é recente e mudou APIs (`proxy.ts`, tipos globais). Sigo a documentação que vem
   no próprio pacote.
7. **Logo:** reconstruí o símbolo geometricamente; vale você comparar com o original e dizer se
   algo deve mudar (espessuras, posição do check, wordmark).
