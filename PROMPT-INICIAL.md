# Prompt inicial para o Claude Code — Projeto Zelo

> Cole tudo abaixo da linha no Claude Code, na pasta vazia do projeto. Coloque antes o `DESIGN.md` (e, se quiser, os arquivos da logo) na raiz.

---

Você é meu par de desenvolvimento no projeto **Zelo**, um trabalho de faculdade (Análise e Desenvolvimento de Sistemas) que precisa estar **hospedado e funcionando**, usando apenas planos **gratuitos**. Vou revisar e ajustar o que você fizer ao longo do caminho, então trabalhe em etapas pequenas e deixe tudo fácil de revisar.

## 1. Como trabalhar

- Fale comigo em **português do Brasil**. Textos da interface em PT-BR. Identificadores de código (variáveis, funções, componentes) em inglês. Tabelas e colunas do banco em português, em `snake_case`.
- **Antes de escrever código**, leia `DESIGN.md` (identidade visual e UX, obrigatório) e este prompt inteiro. Depois crie o `CLAUDE.md` na raiz com um resumo do projeto, da stack, dos perfis, do modelo de dados, das regras inegociáveis (seção 4) e dos comandos úteis. Atualize esse arquivo quando uma decisão mudar.
- Trabalhe **por fases** (seção 7). Ao fim de cada fase: rode lint, checagem de tipos e testes; faça um commit com mensagem clara; me entregue um resumo curto (o que foi feito, como testar, o que ficou pendente) e **pare para eu revisar** antes de seguir.
- Não invente requisitos. Se algo for ambíguo, faça uma pergunta objetiva ou escolha a opção mais simples e **registre a decisão** no `CLAUDE.md`.
- Prefira soluções simples e legíveis. É um projeto acadêmico: eu preciso conseguir **explicar cada decisão** na apresentação. Comente o "porquê" nos trechos não óbvios (segurança, hash, RLS).
- Use a skill `frontend-design` para toda a interface, seguindo o `DESIGN.md`. Mobile first.

## 2. O que é o Zelo

Plataforma web para **prestadores de serviço** (assistência técnica, instaladores, designers, agências e reformas) enviarem propostas, escopos e entregas para o cliente aprovar online. O aceite fica registrado com **trilha de auditoria**, o que dá ao prestador uma prova do que foi combinado.

**Dores que resolve:** escopo mal definido ("eu não pedi isso"); combinados perdidos no WhatsApp; cobrança de extras contestada; contestação na entrega; falta de profissionalismo nos orçamentos.

**Assinatura:** *Combinou? Registrou.*

## 3. Escopo funcional

### Fluxo principal
1. O prestador cria a proposta a partir de um **template do nicho**, com escopo, itens, valores, exclusões, prazo, pagamento e garantia.
2. Envia o link ao cliente por **WhatsApp** (botão que abre `https://wa.me/<numero>?text=<mensagem com o link>`; não usar a API oficial do WhatsApp) ou copia o link.
3. O cliente abre no celular, **sem criar conta**, lê o resumo e **aceita, recusa ou pede ajuste**.
4. A identidade é confirmada por **código (OTP) enviado por e-mail** (ver decisão na seção 5).
5. O sistema gera um **PDF comprovante** com a trilha de auditoria e envia uma cópia por e-mail ao cliente e ao prestador. O cliente também pode baixar o PDF na página de sucesso.
6. O prestador vê o status mudar para **Aceita** no painel.
7. Ao concluir o serviço, o prestador envia o **aceite de entrega** e o cliente confirma o recebimento.

### Funções
- Templates por nicho: reforma, assistência técnica, design, agência, instalação (templates globais criados via seed; o prestador pode duplicar e personalizar).
- **Proposta com versionamento**: depois de enviada ela é **imutável**; qualquer mudança gera uma nova versão.
- Aceite com OTP e texto de consentimento claro.
- **Trilha de auditoria**: data e hora, IP, dispositivo, hash SHA-256 do documento e log de abertura e ações.
- PDF comprovante gerado automaticamente.
- Painel de status: rascunho, enviada, visualizada, aceita, recusada, expirada.
- **Aditivo de escopo**: mini-aceite rápido para pedidos extras durante o serviço.
- Login com e-mail e senha, com **"esqueci a senha"** (recuperação por e-mail).

### Perfis (coluna `role` em `profiles`: `admin` | `prestador`)
- **Prestador:** cadastrar e fazer login; criar, enviar e acompanhar propostas, aditivos e aceites de entrega; baixar o PDF comprovante.
- **Administrador:** listar prestadores e **ativar/suspender** contas; ver quantidade de propostas e aceites. O admin **não** altera aceites.
- **Cliente (por link, sem conta):** ver a proposta; aceitar, recusar ou pedir ajuste com código por e-mail.
- Conta suspensa não consegue logar nem criar propostas; links de propostas já enviadas continuam válidos para o cliente.

## 4. Regras inegociáveis (segurança e integridade)

1. **Imutabilidade:** uma versão enviada nunca é editada. Aceites e eventos de auditoria são **append-only**. Garantir isso no **banco** (triggers que bloqueiam `UPDATE`/`DELETE` e políticas RLS), não só no código da aplicação.
2. **Hash do documento:** SHA-256 calculado sobre a **serialização canônica** (chaves ordenadas, sem espaços) do conteúdo da versão, usando `crypto` do Node. Gravar o hash na versão e repeti-lo no aceite e no PDF. O verificador deve conseguir recalcular e comparar.
3. **RLS ligado em todas as tabelas.** O prestador só enxerga os próprios dados; o admin enxerga contagens e a lista de prestadores. Escrever as políticas e **testá-las** (um prestador não pode ler dados de outro).
4. **Cliente sem login = acesso só pelo servidor.** O link contém um token aleatório (≥ 32 bytes, base64url). No banco guardar apenas o **hash do token**. As rotas públicas validam o token no servidor e usam a chave de serviço (`service_role`) **somente no servidor**. Nunca expor `service_role` ao navegador nem em variável `NEXT_PUBLIC_*`.
5. **OTP:** 6 dígitos, gerado com `crypto.randomInt`, guardado apenas como **hash**, expira em 10 minutos, máximo de 5 tentativas e limite de reenvio (ex.: 3 por hora por proposta). Uso único.
6. **Validação com Zod** em todo formulário e toda rota/Server Action (entrada nunca é confiável). Sanitizar o que for renderizado.
7. **Storage privado.** Buckets de PDFs e fotos privados, acesso por **URL assinada** de curta duração.
8. **Segredos** só em variáveis de ambiente (`.env.local` fora do Git, painel da Vercel em produção). Manter um `.env.example` sem valores. Se algum segredo for parar no repositório, avise-me na hora.
9. **LGPD básica:** coletar o mínimo (nome, e-mail, CPF no aceite, IP, dispositivo), mostrar finalidade no texto de consentimento, mascarar CPF na interface (`***.123.456-**`), nunca logar dados pessoais em console.
10. **Rate limiting** simples nas rotas públicas (abertura de link, envio de OTP, confirmação).

## 5. Decisões já tomadas

- **Envio do link:** por WhatsApp via `wa.me` (manual pelo prestador, sem custo). O sistema pode também permitir copiar o link.
- **OTP por e-mail**, não por WhatsApp (a API oficial do WhatsApp é paga). Por isso o formulário da proposta pede o **e-mail do cliente** (obrigatório) e o telefone (opcional, usado para montar o `wa.me`).
- **E-mail com Resend**, isolado atrás de uma interface (`lib/email/`) para ser trocável. **Atenção:** sem domínio verificado, o Resend só entrega e-mails para o e-mail do dono da conta. Em desenvolvimento, use o meu e-mail para testes. Implemente também um **provedor alternativo via SMTP (Gmail com `nodemailer`)**, escolhido pela variável `EMAIL_PROVIDER` (`resend` | `smtp`), para o caso de eu não ter domínio na apresentação. Limite gratuito do Resend: 100 e-mails por dia.
- **Aditivo e aceite de entrega** reutilizam o mesmo fluxo da proposta (mesmas tabelas, campo `tipo` e `proposta_pai_id`), sem criar telas duplicadas.
- **Sem modo escuro e sem multiusuário/equipe** no MVP.

## 6. Stack (tudo gratuito)

TypeScript · Next.js (App Router) · Tailwind CSS v4 + shadcn/ui (tema customizado conforme `DESIGN.md`) · Supabase (PostgreSQL, RLS, Auth, Storage) · Zod · `@react-pdf/renderer` (ou `pdf-lib`, escolha e justifique) · `crypto` do Node · Resend (+ fallback SMTP) · Vercel (Hobby) · GitHub Actions · Vitest (e Playwright só para o fluxo principal, se der tempo) · `lucide-react`.

### Uso dos MCPs (apenas quando necessário)
- **MCP do Supabase:** use para inspecionar o projeto, aplicar migrations, conferir políticas RLS, gerar tipos TypeScript e rodar os advisors de segurança. **Mantenha as migrations versionadas no repositório** (`supabase/migrations/`), não faça alterações de esquema "por fora" que não fiquem em arquivo. Antes de qualquer operação destrutiva (apagar tabela, resetar dados), **peça minha confirmação**.
- **MCP do Resend:** use só para testar o envio e verificar a entrega dos e-mails (OTP, comprovante, recuperação de senha). A integração real no app usa a SDK/API com a chave em variável de ambiente.
- Se os MCPs **não** estiverem configurados quando você precisar deles, **não contorne**: me diga exatamente o que falta e como configurar.

## 7. Fases

**Fase 0 — Fundação.** Criar o projeto Next.js + TS + Tailwind v4 + shadcn. Configurar ESLint, Prettier, Vitest, Zod, clientes Supabase (browser, server, service) e fontes (Manrope, JetBrains Mono). Criar `CLAUDE.md`, `.env.example` e a estrutura de pastas. Entregar também o **plano detalhado** das fases seguintes para eu aprovar.
*Pronto quando:* o app sobe local com uma página inicial na identidade da Zelo.

**Fase 1 — Banco de dados.** Migrations, enums, índices, RLS, triggers e seeds. Tabelas mínimas:
- `profiles` (id → `auth.users`, nome, email, telefone, empresa_nome, role, ativo, criado_em). Trigger que cria o perfil no cadastro.
- `templates` (id, nicho, titulo, conteudo jsonb, dono_id nulo = global, ativo).
- `propostas` (id, prestador_id, tipo `proposta|aditivo|entrega`, proposta_pai_id, cliente_nome, cliente_email, cliente_telefone, titulo, status, versao_atual, token_hash, validade_em, criado_em).
- `proposta_versoes` (id, proposta_id, numero, conteudo jsonb [escopo, itens, exclusões, valor_total, prazo, pagamento, garantia], hash_sha256, enviada_em) — imutável após o envio.
- `aceites` (id, versao_id, resultado `aceito|recusado|ajuste`, comentario, cliente_nome, cliente_cpf, ip, user_agent, otp_verificado_em, texto_consentimento, hash_documento, pdf_path, criado_em) — append-only.
- `auditoria_eventos` (id, proposta_id, versao_id, tipo, ip, user_agent, metadados jsonb, criado_em) — append-only.
- `otp_codigos` (id, proposta_id, email, codigo_hash, expira_em, tentativas, usado_em).
Seeds: 1 admin (credenciais via variável de ambiente) e 5 templates globais com conteúdo realista em português.
*Pronto quando:* testes de RLS provam o isolamento entre prestadores e o bloqueio de `UPDATE`/`DELETE` nas tabelas imutáveis.

**Fase 2 — Autenticação e papéis.** Cadastro, login, logout, **esqueci a senha / redefinição**, proteção de rotas por papel (middleware + checagem no servidor), bloqueio de conta suspensa. Telas conforme `DESIGN.md`.

**Fase 3 — Design system e shell do app.** Tokens, componentes (`StatusBadge`, `AcceptanceStamp`, `ProposalCard`, `AuditTimeline`, botões, inputs com máscara), barra lateral no desktop e navegação inferior no mobile.

**Fase 4 — Propostas.** Listagem com busca e filtro por status; assistente de criação em 4 etapas com pré-visualização; templates; rascunho com autosave; versionamento; detalhe da proposta. Painel inicial com os números e "precisa de atenção".

**Fase 5 — Envio.** Gerar token, calcular hash da versão, travar a versão (`enviada`), tela "Proposta criada" com **Enviar por WhatsApp** e **Copiar link**.

**Fase 6 — Página pública do cliente (`/p/[token]`).** Mobile first e leve. Registrar evento de abertura (marcar *visualizada*), exibir a proposta, **aceitar / recusar / pedir ajuste**, OTP por e-mail, consentimento, registro do aceite com trilha de auditoria. Estados: link inválido, expirado, já respondida.

**Fase 7 — Comprovante.** PDF com dados do aceite, trilha de auditoria e hash; salvar no Storage privado; e-mail com cópia ao cliente e ao prestador; download na página de sucesso e no detalhe da proposta. Página opcional `/verificar` para conferir o hash.

**Fase 8 — Aditivo e aceite de entrega.** Reutilizar o fluxo: aditivo vinculado à proposta aceita; aceite de entrega com checklist e fotos (Storage).

**Fase 9 — Admin.** Lista de prestadores com ativar/suspender, contadores de propostas e aceites.

**Fase 10 — Qualidade e entrega.** Testes dos fluxos críticos (criação, envio, aceite, imutabilidade, RLS), revisão de segurança (checklist da seção 4), acessibilidade, `README` (arquitetura, como rodar, decisões, limitações conhecidas e evolução futura), GitHub Actions (CI com lint, tipos e testes) e **agendamento que faz uma consulta leve ao Supabase a cada poucos dias** para o projeto gratuito não pausar por inatividade. Deploy na Vercel com variáveis de ambiente configuradas.

## 8. Definição de pronto (vale para toda fase)

- Funciona no celular (375px) e no desktop (1280px).
- Lint, tipos e testes passando; sem segredos no repositório.
- Entradas validadas com Zod; permissões checadas no servidor e no banco.
- Estados de carregamento, erro e vazio tratados, com os textos do `DESIGN.md`.
- `CLAUDE.md` atualizado se uma decisão mudou.

## 9. Comece agora

1. Leia `DESIGN.md` e este prompt.
2. Faça a **Fase 0** e crie o `CLAUDE.md`.
3. Me entregue o plano das demais fases, aponte dúvidas ou riscos que enxergar (principalmente sobre OTP por e-mail, limites gratuitos e segurança) e **aguarde meu OK** antes de começar a Fase 1.
