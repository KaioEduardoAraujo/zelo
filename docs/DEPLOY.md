# Deploy do Zelo (Vercel + Supabase na nuvem)

Guia para colocar o Zelo no ar só com planos gratuitos. A ordem importa: o Supabase precisa estar
pronto antes do primeiro deploy, e a URL da Vercel precisa voltar para o Supabase depois.

> **Segredos:** nada deste guia vai para o Git. Os valores ficam no painel da Vercel, no painel do
> Supabase, nos *secrets* do GitHub e, para o script do administrador, num arquivo `.env.nuvem`
> local (o `.gitignore` já ignora `.env*`).

## 1. Banco na nuvem (Supabase)

O projeto `ovahgvavuyuvcxfztiub` já está ligado pela CLI e tem as migrations até a Fase 9.

1. **Aplicar migrations pendentes** (a da Fase 10 é a `ping()` do keep-alive):

   ```bash
   npx supabase db push --remote --dry-run   # confere o que vai subir
   npx supabase db push --remote             # aplica (pede confirmação)
   npx supabase db advisors --remote         # deve sobrar só o aviso aceito na D33
   ```

2. **Authentication → URL Configuration**
   - *Site URL*: `https://<seu-app>.vercel.app`
   - *Redirect URLs*: `https://<seu-app>.vercel.app/**`

3. **Authentication → Sign In / Providers → Email**
   - *Confirm email*: **desligado** (decisão D27).
   - *Minimum password length*: 8; *Password requirements*: letras e números.

4. **Authentication → Emails → Templates** (copie o HTML de `supabase/templates/`):

   | Modelo | Assunto | Arquivo |
   |---|---|---|
   | Reset Password | `Crie uma nova senha no Zelo` | `recuperar-senha.html` |
   | Confirm signup | `Confirme seu e-mail no Zelo` | `confirmar-cadastro.html` |

5. **Authentication → Emails → SMTP Settings**: ative o SMTP próprio com o mesmo provedor do passo
   2 (o SMTP embutido do Supabase só entrega para a equipe do projeto e tem limite de poucos
   e-mails por hora).

6. **Project Settings → API Keys**: anote a *publishable key* (`sb_publishable_...`) e a
   *secret key* (`sb_secret_...`). A secret ignora o RLS: só vai para a Vercel, nunca para o
   navegador nem para o Git.

## 2. E-mail

Escolha um (decisões D3 e D66; o app usa a mesma interface para os dois):

- **Gmail por SMTP (recomendado sem domínio próprio):** ative a verificação em 2 etapas na conta
  Google e crie uma *senha de app* (16 caracteres). Entrega para qualquer destinatário,
  ~500 e-mails por dia.
  `EMAIL_PROVIDER=smtp`, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=<seu gmail>`,
  `SMTP_PASSWORD=<senha de app>`, `EMAIL_FROM=Zelo <seu gmail>`.
- **Resend:** só entrega para destinatários quaisquer com um **domínio verificado**. Sem domínio,
  só chega no e-mail do dono da conta (serve para testes, não para clientes reais).
  `EMAIL_PROVIDER=resend`, `RESEND_API_KEY=re_...`, `EMAIL_FROM=Zelo <nao-responda@seudominio>`.

## 3. Aplicação (Vercel)

1. Em vercel.com, **Add New → Project**, importe o repositório do GitHub. O framework é
   detectado (Next.js); não mude os comandos de build.
2. **Environment Variables** (ambiente *Production*):

   | Variável | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://ovahgvavuyuvcxfztiub.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | a publishable key |
   | `NEXT_PUBLIC_APP_URL` | `https://<seu-app>.vercel.app` (sem barra no fim) |
   | `SUPABASE_SERVICE_ROLE_KEY` | a secret key |
   | `HASH_PEPPER` | **novo**, gerado com `openssl rand -base64 48` (nunca reuse o local) |
   | `EMAIL_PROVIDER`, `EMAIL_FROM`, `SMTP_*` ou `RESEND_API_KEY` | conforme o passo 2 |

   > Trocar o `HASH_PEPPER` depois invalida todos os links e códigos já enviados: defina uma vez.

3. **Deploy.** Se a URL final for diferente da que você pôs em `NEXT_PUBLIC_APP_URL` e no Supabase,
   corrija os dois e faça *Redeploy*.

## 4. Administrador

Crie um arquivo `.env.nuvem` (fora do Git) com:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ovahgvavuyuvcxfztiub.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret key>
SEED_ADMIN_EMAIL=<e-mail do administrador>
SEED_ADMIN_PASSWORD=<senha forte, mínimo 12 caracteres>
```

e rode `npm run db:seed-admin:nuvem`. Depois apague o arquivo (a senha fica só no Supabase Auth,
como hash).

## 5. Keep-alive (GitHub Actions)

No GitHub: **Settings → Secrets and variables → Actions → New repository secret**:

- `SUPABASE_URL` = `https://ovahgvavuyuvcxfztiub.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY` = a publishable key

Depois, em **Actions → Keep-alive do Supabase → Run workflow**, rode uma vez à mão: o passo deve
terminar com `Resposta: "ok"`.

## 6. Conferência depois do deploy

1. Cadastre um prestador, crie uma proposta e envie.
2. Abra o link no celular (rede móvel), peça o código e confira que o e-mail chegou.
3. Aceite; baixe o comprovante na tela de sucesso e confira o e-mail com o PDF anexo (cliente e
   prestador).
4. Em `/verificar`, informe o código e o PDF baixado: deve dar "Documento íntegro" e "idêntico".
5. Registre uma entrega com foto e confirme como cliente (confere o bucket `entregas` e o PDF com
   fotos).
6. Entre como administrador, suspenda e reative o prestador de teste.
7. Confira os cabeçalhos: `curl -I https://<seu-app>.vercel.app/p/qualquer` deve trazer
   `referrer-policy: no-referrer` e `x-robots-tag: noindex, nofollow`.
