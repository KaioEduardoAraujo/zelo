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
| Testes | Vitest (unitários e banco) + Playwright (fluxos no navegador, desktop e 375px) |
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
funções `admin_resumo_prestadores()` (contagens para o admin), `resumo_painel()`, `enviar_versao()` e
`regenerar_link()` (invólucros públicos; a lógica está em `private`); funções só da service_role para a
página do cliente (`registrar_abertura`, `registrar_otp`, `registrar_resposta`, `consumir_limite`) e a
tabela `limites_taxa`, buckets privados `comprovantes` e
`entregas` (caminho `<prestador_id>/...`).

**Conteúdo da versão** (`lib/validation/proposta.ts`, valores em **centavos**):
`{ escopo, itens[{descricao, unidade, quantidade, valor_unitario_centavos}], exclusoes[],
valor_total_centavos, prazo, pagamento, garantia, validade_dias, observacoes? }`. Template = mesmo formato.
Rascunho usa a normalização tolerante (`lib/proposals/draft.ts`); envio exige o schema estrito.

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
| D33 | Funções auxiliares do RLS (`is_admin`, `is_active_prestador`, `eh_dono_da_proposta`, `eh_usuario_final`) no schema **`private`** (não exposto pela API); `admin_resumo_prestadores` fica em `public` de propósito (aviso do advisor aceito) | Advisors da nuvem: SECURITY DEFINER não deve ser chamável por /rpc sem necessidade |
| D34 | Projeto na nuvem: `ovahgvavuyuvcxfztiub` (linkado pela CLI). Migrations sobem com `npx supabase db push --remote` (sempre `--dry-run` antes) | Mesmo fluxo versionado do local |
| D35 | Shell do prestador em `components/zelo/shell/` (sidebar clara 240px ≥1024px; mobile: barra superior + nav inferior com "Nova proposta" central). No mobile o H1 da página fica `sr-only` (o título está na barra superior), exceto no Início | DESIGN.md 7.1, sem título duplicado |
| D36 | Componentes shadcn reescritos no padrão Zelo e em PT-BR (dialog, sheet, sonner, skeleton, table); `next-themes` removido | Sem modo escuro; tema não pode parecer o padrão |
| D37 | Inputs com máscara enviam o valor limpo num `<input type="hidden">` (dígitos/centavos); o servidor revalida | Máscara é só apresentação |
| D38 | `/dev/componentes`: vitrine do design system, `notFound()` em produção | Revisar componentes em 375/1280 sem expor em produção |
| D39 | `devIndicators: false` no `next.config.ts` | O botão "N" do modo dev cobria o canto inferior esquerdo (Sair, Início) |
| D40 | Playwright: porta 3000 (reaproveita o `npm run dev`), 2 workers, timeout de 60s/15s | Next 16 não permite dois `next dev` na mesma pasta; modo dev é lento em máquina carregada |
| D41 | `validade_dias` (1 a 90) faz parte do **conteúdo da versão** (e portanto do hash); template e proposta usam o mesmo schema estrito (`conteudoPropostaSchema`) | A validade é parte do que foi combinado; no envio vira `validade_em` |
| D42 | Assistente: a etapa 1 (`/propostas/nova`) **cria** o rascunho (proposta + versão 1); as etapas 2–4 ficam em `/propostas/[id]/editar?etapa=N`. O preço de cada item é digitado na etapa 3 ("Valores"), como no DESIGN.md | Autosave precisa de um id; o fluxo "Valores" separado deixa cada linha curta no celular |
| D43 | Autosave: debounce de 1,5 s, controlador sem React (`lib/autosave.ts`, testado com relógio falso): nunca dois salvamentos ao mesmo tempo, edição feita durante um salvamento não se perde, falha de rede mantém o valor pendente. O servidor grava o conteúdo sempre (leniente) e cada dado do cliente **só se já estiver válido**; recalcula o total e descarta chaves desconhecidas | Nunca perder o que a pessoa digitou; o total do navegador não é confiável |
| D44 | `normalizarConteudo` é **tolerante campo a campo**; limites são cobrados pela validação (mensagem no campo) e pelo servidor (recusa gravar, não trunca) | Teste achou bug: um campo fora do limite apagava o rascunho inteiro |
| D45 | View `propostas_situacao` ganha `valor_total_centavos` (versão atual; só lido se for número). `resumo_painel()` é `SECURITY INVOKER` (RLS vale): aceites de **proposta e aditivo** no mês de Brasília; "aguardando" = enviada/visualizada ainda na validade | Painel sem baixar o conteúdo de cada versão; um jsonb malformado não quebra a listagem |
| D46 | Telas de "modo foco" (assistente, editor de modelo) escondem a navegação inferior no celular; só a barra de ações fica fixa | A barra "Voltar / Continuar" não compete com a navegação |
| D47 | `cn` (`lib/utils.ts`) criado com `createCn` registrando `text-display/h1/h2/h3/body/support/label` como **font-size** | Sem isso `cn("text-h1 text-navy-950")` descartava o tamanho (bug desde a Fase 3) |
| D48 | Modelos do Zelo são só leitura; "Duplicar e personalizar" cria uma cópia do prestador (`dono_id`). Modelo salvo é sempre conteúdo **completo** (formato estrito) | Quem usa um modelo começa de algo pronto |
| D49 | Página fora do intervalo (PGRST103) vira "última página" em vez de erro; `loading.tsx` só na listagem (route group `(lista)`), para a proposta alheia responder **HTTP 404** de verdade | Entrada hostil/antiga não pode derrubar a tela; 404 sem streaming prévio |
| D50 | "Criar nova versão" copia a versão atual como rascunho; o trigger devolve a proposta a `rascunho`. Enquanto isso o banco **recusa aceite** (exige enviada/visualizada): a página pública (Fase 6) precisa mostrar "o prestador está atualizando esta proposta" | Versão enviada é imutável; link antigo não pode aceitar uma versão substituída |
| D51 | Unidade do item é um **seletor** (`lib/unidades.ts`): un, vb, m, m², m³, kg, h, dia, mês, dúzia, dezena, centena, milhar; "Outra…" abre texto livre; unidade antiga fora da lista continua aparecendo | O `<datalist>` só sugeria o que combinava com o texto já digitado (com "un" no campo, nada mais aparecia) |
| D52 | O hash cobre o **documento enviado** = conteúdo + `titulo` + retrato das partes (`prestador`, `cliente`) + `proposta_id` + `versao`; serialização canônica (chaves ordenadas, sem espaços) em `lib/crypto/canonical.ts`. O banco confere `proposta_id` e `versao` | O retrato mantém a prova mesmo se o prestador mudar de nome depois; amarrar ao registro impede dois documentos com o mesmo hash. Teste prova que o hash sobrevive ao jsonb do Postgres (acentos, emoji, 22,5) |
| D53 | Envio **atômico** em `private.enviar_versao` (SECURITY DEFINER) com invólucro público SECURITY INVOKER `public.enviar_versao`; idem `regenerar_link`. Confere dono, conta ativa, rascunho, formato dos hashes, validade 1–90 e identidade do documento; trava a versão, grava hash, troca o token, define `validade_em` (= agora + `validade_dias`) e registra o evento `enviada`/`link_regenerado`. Proposta alheia e inexistente dão a mesma resposta | Tudo ou nada; o prestador não grava auditoria direto (só o servidor), então a função grava em nome dele depois de conferir quem chama. Lógica em `private` mantém os advisors limpos |
| D54 | Token do link: 32 bytes, base64url (43 caracteres); o banco guarda só o **HMAC-SHA256** com `HASH_PEPPER` (`lib/crypto/token.ts`). O token só existe na resposta da ação e no **estado do navegador** (nunca na URL nem em log); fechar o diálogo o apaga. Enviar a versão N+1 troca o token | Quem vazar o banco não reconstrói o link; link novo invalida o antigo (D18) |
| D55 | `enviarProposta` **relê o rascunho do banco** e valida tudo de novo (`prepararDocumento` → `validarTudo` + schema estrito); nada do que está na tela do navegador é usado. O assistente salva (flush) antes de chamar | O servidor nunca confia no cliente |
| D56 | **Nunca** chamar `revalidatePath` em `enviarProposta`: o Next re-renderiza a página atual (`/editar`), que redireciona ao detalhe e desmonta a tela antes de mostrar o link (que só existe naquela resposta). Bug pego pelo e2e | Páginas dinâmicas já buscam dados novos a cada visita |
| D57 | WhatsApp: `https://wa.me/55<DDD+número>?text=…` (`lib/proposals/envio.ts`); sem telefone válido abre `wa.me/?text=` (a pessoa escolhe o contato); link com `rel="noopener noreferrer"`. A etapa 4 vira "Enviar proposta" (com confirmação) e "Salvar rascunho e sair" | DESIGN.md 7.2.5; a versão trava ao enviar |
| D58 | O detalhe **recalcula o hash** de cada versão enviada a partir do que está guardado e mostra "Conteúdo conferido" (ou um alerta se não bater) | Confiança visível (DESIGN.md 1.5); base do `/verificar` (Fase 7) |
| D59 | `logging.serverFunctions: false` no `next.config.ts` | O `next dev` imprimia os argumentos de cada Server Action (e-mails e nomes) no terminal; regra 9 |
| D60 | `x-forwarded-for` só é confiável atrás da Vercel (ela o define); fora dela um cliente pode forjar o IP gravado na auditoria. IP só é gravado se for um IP válido (`net.isIP`) | Limitação conhecida, a registrar no README (Fase 10) |
| D61 | Página pública `/p/[token]`: Server Component; busca pelo HMAC do token com a service_role (só no servidor); token malformado, inexistente ou substituído dão o **mesmo 404** ("Link inválido", `app/p/[token]/not-found.tsx`, sem links da área logada) | Não revela se a proposta existe; página leve para celular |
| D62 | A abertura ("visualizada") é registrada pelo **navegador** depois de carregar (`RegistrarAbertura` → Server Action), não na renderização do servidor; no máximo uma abertura por IP+dispositivo a cada 10 min | O WhatsApp acessa o link para montar a prévia, sem rodar JavaScript: registrar no servidor marcaria "visualizada" antes de o cliente abrir |
| D63 | Funções do cliente (`registrar_abertura`, `registrar_otp`, `registrar_resposta`, `consumir_limite`) só executáveis pela **service_role**, SECURITY INVOKER (triggers valem). `registrar_resposta` devolve um **status** para código errado em vez de lançar erro; resposta inválida (ex.: aceite sem CPF) desfaz tudo e o código não é consumido | Um erro desfaria o "+1" das tentativas (rollback) e o limite de 5 nunca seria atingido |
| D64 | OTP: 6 dígitos (`randomInt`), guardado como HMAC de `proposta:ação:código` (código pedido para recusar não aceita), 10 min, 5 tentativas, 3 por hora por proposta, **só o mais recente vale**; "Reenviar" espera 60 s na tela | Regra 5; o e-mail diz para que serve o código |
| D65 | Limite de taxa em `limites_taxa` com o **HMAC do IP** (nunca o IP): abrir 60/10 min, pedir código 10/h, responder 30/10 min. Sem IP conhecido vale só o limite por proposta; se o limitador falhar, não bloqueia (as regras do banco continuam) | Regra 10, LGPD |
| D66 | E-mail atrás de `lib/email` (`EMAIL_PROVIDER` = `resend` \| `smtp`, mesma interface; anexos já suportados para a Fase 7). Templates escapam HTML do título e do nome do prestador; erros do provedor não vão para a tela nem para o console | D3; o título é digitado por usuários |
| D67 | Texto de consentimento montado **no servidor** (`lib/publico/consentimento.ts`), mostrado e gravado igual; diz a finalidade dos dados. CPF só no aceite, validado pelos dígitos e mostrado mascarado | Regra 9 (LGPD) |
| D68 | Cabeçalhos: `/p/*` com `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `X-Robots-Tag: noindex`; todo o site com `X-Frame-Options: DENY` e `nosniff` | O token está na URL: não pode vazar por referrer, ficar em cache nem ser indexado |
| D69 | Botões que dependem de JavaScript ficam desabilitados até a hidratação (`lib/hooks/use-hidratado.ts`); nos e2e, `esperarAssistentePronto` | Toque antes da hidratação se perdia (celular lento); causava testes intermitentes |
| D70 | No documento, a seção "Itens" chama-se **"O que está incluso"** (DESIGN.md 7.2.7). A pré-visualização do prestador usa o mesmo componente da página do cliente | O prestador vê exatamente o que o cliente verá |
| D71 | PDF com `@react-pdf/renderer` (JSX + flexbox; já é pacote externo do Next). Fontes Manrope e JetBrains Mono **embutidas** (`lib/pdf/fonts/`, OFL), incluídas no pacote da Vercel por `outputFileTracingIncludes`. Texto passa por `lib/pdf/texto.ts` (caractere sem desenho na fonte vira equivalente ou "?"; o hash cobre o original guardado, não o PDF) | Helvetica do PDF não desenha tudo; emoji virava lixo |
| D72 | Geração **depois da resposta** com `after()` em `responderProposta` (só para aceite): PDF → bucket `comprovantes` em `pdf_path` (upload sem sobrescrever) → evento `pdf_gerado` → e-mail com anexo ao cliente e ao prestador → `email_enviado` (metadados só com o **papel**, nunca o endereço). Falhas não desfazem o aceite e são logadas só com o id | O cliente não espera o PDF; aceite já vale |
| D73 | `garantirComprovante` é **idempotente**: o download (cliente `/p/[token]/comprovante`, prestador `/propostas/[id]/comprovante`) gera o PDF se ainda não existir; corrida resolvida pelo `upsert: false`. Download = redirect 303 para URL assinada de **60 s** com nome `comprovante-ZL-….pdf` | Botão "Baixar" logo após o aceite sempre funciona; o arquivo é um só (e-mail, download e bucket) |
| D74 | O PDF mostra a trilha **até o aceite** (eventos com `criado_em <= aceite`), CPF e e-mail mascarados, IP e dispositivo resumido, texto de consentimento, hash e o endereço de `/verificar` | Documento estável: eventos posteriores (pdf_gerado) não mudam o que foi provado |
| D75 | `/verificar`: código (normalizado; aceita minúsculas e sem traços) → recalcula o hash da versão e compara com o da versão e do aceite → "Documento íntegro"/"Não encontrado". Mostra só resultado, data, prestador, versão e hash (**nada do cliente**). PDF opcional: o SHA-256 é calculado **no navegador** e comparado ao do arquivo guardado. Limite 20/10 min por IP | LGPD; o arquivo não sai do aparelho; código de 32⁸ combinações + limite impede varredura |
| D76 | Aditivo e entrega **reutilizam** envio, página do cliente, OTP, aceite, PDF e `/verificar`. Só os **textos** variam, centralizados em `lib/tipos.ts` (`TEXTOS[tipo]`); os da proposta são exatamente os da Fase 6. Nenhuma migration nova | Sem `if (tipo)` espalhado; sem telas duplicadas (D4) |
| D77 | Aditivo: "Novo aditivo" (só na proposta **aceita**) cria rascunho com `tipo = aditivo`, `proposta_pai_id`, cliente copiado, título "Aditivo: …" e pagamento/garantia/validade da original; usa o **mesmo assistente** (etapas 2–4). O documento selado leva `referencia = {proposta_id, titulo, hash_documento}` da versão aceita, **dentro do hash** | O comprovante do aditivo prova a qual versão exata da proposta ele se refere |
| D78 | Entrega: conteúdo próprio `{resumo, checklist[{texto, feito}], fotos[], observacoes?, validade_dias}` (`lib/validation/entrega.ts`), editor de **uma tela** (`entrega-editor.tsx`) com autosave. Checklist nasce dos itens da proposta, **sem marcar**; para enviar, todo item precisa estar marcado ou removido (entrega parcial = remover o que falta). Sem valor: não entra no painel (D45) | Checklist só vale o que foi de fato entregue |
| D79 | Fotos: até **6**, comprimidas **no navegador** (JPEG, lado maior 1600 px, ≤ 2 MB) e enviadas direto ao bucket privado `entregas` em `<prestador_id>/<proposta_id>/<uuid>.jpg` (a policy do bucket já restringe à pasta do dono e não deixa trocar nem apagar). O rascunho guarda só `{path, nome}`; o servidor valida o caminho a cada salvamento | Celular tem foto grande e rede ruim; o RLS é a barreira de verdade |
| D80 | No **envio**, `selarFotos` (servidor) baixa cada foto com a sessão do prestador, confere o **tipo pelos primeiros bytes** (não a extensão), o tamanho e grava o **SHA-256** dos bytes no documento selado: o hash da versão cobre as fotos (trocar uma foto muda o hash) | Prova do que foi mostrado ao cliente |
| D81 | URLs assinadas das fotos (1 h; `lib/entregas/urls.ts`) só são geradas para caminhos da pasta **deste prestador e desta entrega**; na página do cliente isso vale com a service_role | Um caminho forjado no jsonb não pode expor o arquivo de outra pessoa |
| D82 | PDF da entrega: resumo, checklist e fotos **embutidas** (só JPEG/PNG cujo SHA-256 bate com o selo; WebP só aparece na lista, com o hash), cada foto com o seu SHA-256. Bytes das imagens ficam fora de `dados` (passam por `imagens`) porque `dados` é sanitizado | O PDF nunca mostra imagem diferente da coberta pelo hash |
| D83 | Nova versão de entrega copia o conteúdo **sem o selo** das fotos (`semSelo`); o envio recalcula tudo. Foto removida do rascunho **permanece** no bucket (sem DELETE para o prestador, e pode estar citada por uma versão enviada) — limitação conhecida, a registrar no README (Fase 10) | Prova não some; limpeza de órfãs fica para depois |
| D84 | Suspender/reativar (`lib/admin/actions.ts`): 1) `profiles.ativo` pelo cliente do **admin** (trigger: só `ativo` de outros); 2) `auth.admin.updateUserById(ban_duration)` com a service_role (`876000h` ou `none`). Se o Auth falhar, o passo 1 é desfeito. Login de banido (`user_banned`) mostra a mesma mensagem de conta suspensa. Admin não suspende a si mesmo nem outro admin; links já enviados continuam valendo | Bloqueio no app, no banco e no Auth (D28) |
| D85 | `/admin`: totais e tabela vêm de `admin_resumo_prestadores()` (única fonte; o admin não lê propostas nem aceites); busca e filtro de situação em memória no servidor (poucas contas) | O admin nunca altera nem lê o conteúdo dos aceites |
| D86 | Templates globais em `/admin/templates` (criar, editar, ativar/desativar, excluir): reaproveitam o `TemplateEditor` (`admin`); modelo novo nasce **inativo** e só ativa se estiver completo (schema estrito). Propostas criadas de um modelo guardam cópia: excluir não as afeta | Prestador nunca começa de um modelo pela metade |
| D32 | `sign_in_sign_ups = 300` **só** no `supabase/config.toml` local; nunca rodar `supabase config push` sem revisar | Os testes fazem muitos logins do mesmo IP; produção fica com o padrão |

Decisões **propostas** no plano e ainda não aprovadas ficam em `docs/PLANO.md`.

## Estrutura

```
app/                      rotas: (auth)/ login, cadastro, esqueci-senha, redefinir-senha, conta-suspensa;
                          (app)/ área do prestador; (admin)/admin; auth/confirm (links de e-mail); p/[token]/ (+ comprovante/); verificar/
components/ui/            shadcn customizado (button.tsx já com o tema da Zelo)
components/zelo/          componentes da marca: Logo, StatusBadge, AcceptanceStamp, ProposalCard, AuditTimeline,
                          EmptyState, ConfirmDialog, PageHeader, FormField, masked-inputs (CPF, telefone, dinheiro)
lib/admin/               queries.ts (prestadores, totais, templates globais), actions.ts (suspender/reativar, modelos globais)
app/(admin)/admin/        prestadores e templates globais
components/zelo/shell/    AppShell + nav.ts (itens, item ativo, título da página, modo foco)
components/zelo/proposal/ assistente (wizard, stepper, fields, erros-context, save-indicator), ProposalDocument,
                          LinkEnvio ("Proposta criada") e GerarNovoLink
lib/proposals/            draft.ts (normalizar/validar por etapa), attention.ts, search.ts, queries.ts, actions.ts
lib/templates/actions.ts  duplicar, salvar e excluir modelos
lib/autosave.ts           controlador do autosave (sem React); hook em lib/hooks/use-autosave.ts
lib/nichos.ts             rótulos dos ramos
app/p/[token]/            página pública do cliente + not-found ("Link inválido")
components/publico/       CabecalhoPublico, RespostaCliente (barra fixa + folha de aceite/recusa/ajuste), RegistrarAbertura
lib/comprovante/          dados.ts (o que o PDF mostra), servico.ts (gerar/guardar/assinar/e-mail; processarAceite)
lib/pdf/                  comprovante.tsx (PDF), texto.ts (caracteres da fonte), fonts/ (OFL)
lib/verificar/            schemas.ts (código), actions.ts (verificação pública)
components/verificar/     formulário de /verificar
lib/publico/              queries.ts (proposta pelo token), actions.ts (abrir, código, responder), otp.ts, consentimento.ts,
                          schemas.ts, limites.ts (limite de taxa)
lib/email/                interface + resend.ts + smtp.ts + templates.ts
lib/http/origem.ts        IP e dispositivo da requisição (server-only)
lib/crypto/               canonical.ts (JSON canônico), hash.ts (SHA-256, HMAC, comparação em tempo constante), token.ts (token do link)
lib/proposals/envio.ts    prepararDocumento (documento selado), mensagem e link do WhatsApp
lib/proposals/derivados.ts   criar aditivo/entrega e autosave da entrega (Server Actions)
lib/proposals/documento-servidor.ts   monta o documento a selar por tipo (lê a referência; sela as fotos)
lib/entregas/             envio.ts (documento selado da entrega), fotos.ts (SHA-256 das fotos), urls.ts (URLs assinadas)
lib/validation/entrega.ts conteúdo da entrega, caminho/tipo das fotos
lib/imagem.ts             compressão de fotos no navegador
lib/tipos.ts              textos por tipo (proposta | aditivo | entrega)
lib/unidades.ts           unidades de medida dos itens
app/not-found.tsx, app/error.tsx   404 e erro em português
app/dev/componentes/      vitrine do design system (só em desenvolvimento)
lib/status.ts             rótulos/tons dos status e textos dos eventos de auditoria
lib/masks.ts              máscaras de CPF, telefone e dinheiro (centavos)
lib/validation/cpf.ts     dígitos verificadores do CPF
lib/user-agent.ts         resumo do dispositivo para a trilha
proxy.ts                  renova sessão + redirecionamento otimista (antigo middleware)
lib/auth/                 routes.ts (rotas, safeNextPath), dal.ts (checagem no servidor), actions.ts (login, cadastro, senha)
lib/validation/auth.ts    schemas Zod dos formulários de acesso
supabase/templates/       e-mails de Auth em PT-BR (recuperar senha, confirmar cadastro)
tests/e2e/                Playwright (support.ts: contas via Admin API e leitura do Mailpit)
lib/env.ts                env públicas (Zod)
lib/env.server.ts         segredos (server-only)
lib/supabase/             client.ts (navegador), server.ts (usuário logado), service.ts (service_role, só servidor)
lib/email/                interface de e-mail + provedores (Fase 6)
lib/format.ts             moeda (reais e centavos), data/hora (America/Sao_Paulo), data relativa, CPF mascarado
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
npm run test:e2e      # Playwright: fluxos no navegador (reaproveita o `npm run dev` da porta 3000 ou sobe um)
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
- Botão que só funciona com JavaScript: `disabled={!hidratado}` (`useHidratado`).
