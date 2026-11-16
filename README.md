<p align="center">
  <img src="public/brand/logo.svg" alt="Zelo" height="64">
</p>

<p align="center"><strong>Combinou? Registrou.</strong></p>

**Zelo** é uma plataforma web para prestadores de serviço (reformas, assistência técnica,
instalação, design e agências) enviarem propostas, escopos e entregas para o cliente aprovar
online. O cliente abre o link no celular, sem criar conta, e confirma com um código enviado por
e-mail. O aceite fica registrado com **trilha de auditoria** e **hash SHA-256 do documento**, o que
dá ao prestador uma prova do que foi combinado.

> Projeto acadêmico do curso de Análise e Desenvolvimento de Sistemas).

## Problemas que resolve

- Escopo mal definido ("eu não pedi isso").
- Combinados perdidos no WhatsApp.
- Cobrança de extras contestada e contestação na entrega.
- Orçamentos com pouca cara de profissional.

## Como funciona

1. O prestador monta a proposta a partir de um modelo do seu ramo: escopo, itens, o que **não**
   está incluso, valores, prazo, pagamento e garantia.
2. Envia o link pelo WhatsApp (botão `wa.me`) ou copia o link.
3. O cliente lê no celular e aceita, recusa ou pede ajuste, confirmando a identidade com um código
   de 6 dígitos enviado por e-mail.
4. O sistema gera um PDF comprovante com a trilha de auditoria e envia uma cópia aos dois.
5. Mudanças durante o serviço viram **aditivos**, e a conclusão vira um **aceite de entrega**,
   pelo mesmo fluxo.

## Andamento

O desenvolvimento segue fases revisadas uma a uma ([plano completo](docs/PLANO.md)).

| Fase | Conteúdo | Situação |
|---|---|---|
| 0 | Fundação: Next.js, Tailwind, shadcn/ui, identidade visual | ✅ Concluída |
| 1 | Banco de dados: tabelas, RLS, triggers de imutabilidade, seeds | ✅ Concluída |
| 2 | Autenticação, papéis, recuperação de senha, conta suspensa | ✅ Concluída |
| 3 | Design system e shell do app (desktop e celular) | ✅ Concluída |
| 4 | Propostas: listagem, assistente de criação, rascunho, versões | ✅ Concluída |
| 5 | Envio: hash da versão, token do link, WhatsApp | ✅ Concluída |
| 6 | Página pública do cliente com aceite por código (OTP) | ⏳ Próxima |
| 7 | PDF comprovante, e-mail e verificação de integridade | Planejada |
| 8 | Aditivo e aceite de entrega (com fotos) | Planejada |
| 9 | Painel do administrador | Planejada |
| 10 | Qualidade, CI, deploy na Vercel | Planejada |

## Stack

| Camada | Tecnologia |
|---|---|
| Aplicação | Next.js 16 (App Router), React 19, TypeScript |
| Interface | Tailwind CSS v4, shadcn/ui (Radix) com tema próprio, lucide-react, Manrope e JetBrains Mono |
| Dados e autenticação | Supabase: PostgreSQL, Row Level Security, Auth e Storage |
| Validação | Zod |
| E-mail | Resend, com alternativa por SMTP (Gmail via nodemailer) |
| PDF | @react-pdf/renderer (Fase 7) |
| Testes | Vitest (unitários e banco) e Playwright (navegador) |
| Hospedagem | Vercel (plano Hobby) e GitHub Actions |

## Segurança e integridade

A prova só vale se não puder ser alterada. Por isso, as regras principais ficam **no banco**, e não
só no código da aplicação:

- **Imutabilidade:** triggers bloqueiam `UPDATE`, `DELETE` e `TRUNCATE` nos aceites e na trilha de
  auditoria, e uma versão de proposta fica travada depois de enviada. Os triggers valem até para a
  chave de serviço do servidor, que ignora o RLS.
- **Aceite não pode ser forjado:** o status "aceita" só existe se houver o registro do cliente, para
  a versão atual, dentro da validade e com o hash igual ao do documento.
- **RLS em todas as tabelas:** um prestador não enxerga nada de outro; o visitante sem login não
  acessa nenhuma tabela; o administrador vê só a lista de prestadores e as contagens.
- **Envio atômico e selado:** ao enviar, uma função do banco trava a versão, grava o hash SHA-256 do
  documento (conteúdo + retrato das partes), gera o link e registra o evento, tudo de uma vez. O
  servidor revalida tudo e o detalhe da proposta recalcula o hash para provar que nada mudou.
- **Cliente sem conta acessa só pelo servidor:** o link carrega um token aleatório de 32 bytes, e o
  banco guarda apenas o hash dele.
- **Código por e-mail (OTP):** 6 dígitos, guardado como HMAC-SHA256, expira em 10 minutos, com no
  máximo 5 tentativas e limite de reenvio.
- **Autorização em três camadas:** o `proxy.ts` redireciona quem não está logado, a camada de acesso
  a dados (`lib/auth/dal.ts`) confere papel e conta suspensa no servidor, e o banco aplica o RLS.
- **Outros cuidados:** Zod em toda entrada, proteção contra redirecionamento aberto, mensagens de
  login que não revelam se o e-mail existe, CPF mascarado na interface e segredos só em variáveis de
  ambiente.

As decisões de arquitetura, com o motivo de cada uma, estão em [`CLAUDE.md`](CLAUDE.md).

## Como rodar localmente

### Pré-requisitos

- Node.js 22 ou mais recente
- Docker (para o Supabase local)
- Google Chrome (usado pelos testes de navegador no ambiente local)

### Passo a passo

```bash
# 1. Instale as dependências
npm install

# 2. Suba o Supabase local (Postgres, Auth, Storage e Mailpit no Docker)
npm run db:start

# 3. Crie o arquivo de ambiente e preencha com os valores do Supabase local
cp .env.example .env.local
npx supabase status        # mostra a URL e as chaves locais

# 4. Aplique as migrations e os modelos de proposta
npm run db:reset

# 5. (Opcional) Crie o administrador, com SEED_ADMIN_* definidos no .env.local
npm run db:seed-admin

# 6. Rode o app
npm run dev
```

Endereços locais:

| Serviço | URL |
|---|---|
| Aplicação | http://localhost:3000 |
| Supabase Studio (banco) | http://127.0.0.1:54323 |
| Mailpit (e-mails enviados no ambiente local) | http://127.0.0.1:54324 |
| Vitrine de componentes (só em desenvolvimento) | http://localhost:3000/dev/componentes |

No ambiente local, use `EMAIL_PROVIDER=smtp` apontando para o Mailpit (`127.0.0.1:54325`): nenhum
e-mail é entregue de verdade e todos aparecem no Mailpit.

### Variáveis de ambiente

A lista completa, sem valores, está em [`.env.example`](.env.example). Nunca commite o `.env.local`.
Em produção, as variáveis são configuradas no painel da Vercel.

| Variável | Onde é usada |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Navegador e servidor (chave pública, limitada pelo RLS) |
| `NEXT_PUBLIC_APP_URL` | Montagem dos links enviados |
| `SUPABASE_SERVICE_ROLE_KEY` | Só no servidor (ignora o RLS) |
| `HASH_PEPPER` | Segredo do HMAC dos códigos e tokens |
| `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`, `SMTP_*` | Envio de e-mails |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Script de criação do administrador |

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Gera os tipos de rota do Next e roda o TypeScript |
| `npm test` | Testes unitários |
| `npm run test:db` | Testes do banco: RLS, imutabilidade e seeds (exige o Supabase local) |
| `npm run test:e2e` | Testes no navegador, em desktop e celular de 375px |
| `npm run check` | Tudo acima, em sequência |
| `npm run format` | Prettier |
| `npm run db:start` / `db:stop` | Liga e desliga o Supabase local |
| `npm run db:reset` | Recria o banco local com migrations e seed |
| `npm run db:types` | Regenera os tipos TypeScript a partir do banco |
| `npm run db:advisors` | Verificações de segurança e desempenho do Supabase |
| `npm run db:seed-admin` | Cria ou promove o administrador |

## Testes

- **Unitários (Vitest):** validações, máscaras, CPF, formatação, redirecionamento seguro.
- **Banco (Vitest contra o Supabase local):** provam que um prestador não lê nem altera dados de
  outro e que aceites, auditoria e versões enviadas não podem ser alterados nem por quem tem a chave
  de serviço. Para conferir que esses testes detectam falhas de verdade, as proteções foram
  removidas de propósito num teste de mutação, e os testes quebraram como esperado.
- **Navegador (Playwright):** cadastro, login, logout, recuperação de senha lendo o e-mail no
  Mailpit, conta suspensa, proteção de rotas por papel e ausência de rolagem horizontal em 375px.

## Estrutura

```
app/                     rotas: (auth) acesso, (app) prestador, (admin) administração, auth/confirm
components/ui/           componentes shadcn/ui com o tema da Zelo
components/zelo/         componentes da marca (selo de aceite, status, trilha de auditoria, shell)
lib/                     autenticação, clientes Supabase, validação, formatação, máscaras
supabase/migrations/     esquema do banco versionado (tabelas, RLS, triggers, storage)
supabase/seed.sql        5 modelos de proposta, um por ramo
supabase/templates/      e-mails de autenticação em português
tests/                   unit/, db/ e e2e/
docs/PLANO.md            plano das fases
DESIGN.md                identidade visual e diretrizes de interface
CLAUDE.md                resumo técnico e registro de decisões
```

## Limitações conhecidas

- Sem domínio próprio verificado, o Resend só entrega e-mails para o dono da conta. Para
  demonstrações com clientes reais, use o provedor SMTP (Gmail com senha de app).
- O plano gratuito do Supabase pausa o projeto após cerca de 7 dias sem uso. Um agendamento no
  GitHub Actions para evitar isso está previsto na Fase 10.
- Sem modo escuro e sem contas com vários usuários por empresa no MVP.
