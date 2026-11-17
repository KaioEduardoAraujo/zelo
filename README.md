<p align="center">
  <img src="public/brand/logo.svg" alt="Zelo" height="64">
</p>

<p align="center"><strong>Combinou? Registrou.</strong></p>

<p align="center"><a href="https://zelo-propostas.vercel.app">zelo-propostas.vercel.app</a></p>

**Zelo** é uma plataforma web para prestadores de serviço (reformas, assistência técnica,
instalação, design e agências) enviarem propostas, escopos e entregas para o cliente aprovar
online. O cliente abre o link no celular, sem criar conta, e confirma com um código enviado por
e-mail. Cada aceite fica registrado com data, hora, dispositivo e uma "impressão digital" do
documento, o que dá ao prestador e ao cliente uma prova do que foi combinado.

> Projeto acadêmico do curso de Análise e Desenvolvimento de Sistemas da **UNINOVE**.

## Problemas que resolve

- **Escopo mal definido:** o famoso "eu não pedi isso". A proposta deixa claro o que está e o que
  **não** está incluso.
- **Combinados perdidos no WhatsApp:** o que foi aceito fica guardado num documento que não pode
  ser alterado depois.
- **Extras contestados:** mudanças durante o serviço viram um aditivo, aceito pelo cliente da mesma
  forma que a proposta.
- **Contestação na entrega:** ao terminar, o prestador registra o que foi entregue, com fotos, e o
  cliente confirma o recebimento.
- **Orçamentos com pouca cara de profissional:** modelos prontos por ramo e um documento limpo,
  fácil de ler no celular.

## Como funciona

1. O prestador monta a proposta a partir de um modelo do seu ramo: o que será feito, itens,
   valores, prazo, forma de pagamento e garantia.
2. Envia o link pelo WhatsApp ou copia e manda como preferir.
3. O cliente lê no celular e aceita, recusa ou pede ajuste, confirmando com um código de 6 dígitos
   enviado por e-mail.
4. Os dois recebem por e-mail um comprovante em PDF com o histórico de tudo o que aconteceu.
5. Mudanças durante o serviço viram **aditivos**, e a conclusão vira um **aceite de entrega**
   (checklist e fotos), pelo mesmo caminho.
6. Qualquer pessoa com o código do comprovante confere, no próprio site, se o documento é
   autêntico e não foi alterado.

## Stack

| Camada | Tecnologia |
|---|---|
| Aplicação | Next.js 16 (App Router), React 19, TypeScript |
| Interface | Tailwind CSS v4, shadcn/ui (Radix) |
| Dados e autenticação | Supabase: PostgreSQL, Row Level Security, Auth e Storage |
| Validação | Zod |
| E-mail | Resend, com alternativa por SMTP (Gmail via nodemailer) |
| PDF | @react-pdf/renderer, com Manrope e JetBrains Mono embutidas |
| Testes | Vitest (unitários e banco), Playwright (navegador) e axe-core (acessibilidade) |
| Hospedagem | Vercel |

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
- **Código por e-mail (OTP):** 6 dígitos, guardado como HMAC-SHA256 amarrado à proposta e à ação
  (um código pedido para recusar não serve para aceitar), expira em 10 minutos, com no máximo 5
  tentativas, 3 códigos por hora e uso único.
- **Página do cliente protegida:** link inválido, inexistente ou substituído dão a mesma resposta;
  a URL com o token não vaza por referrer, não fica em cache e não é indexada; a abertura só é
  registrada pelo navegador de verdade (a prévia de link do WhatsApp não marca "visualizada").
- **Autorização em três camadas:** o `proxy.ts` redireciona quem não está logado, a camada de acesso
  a dados (`lib/auth/dal.ts`) confere papel e conta suspensa no servidor, e o banco aplica o RLS.
- **Fotos da entrega e PDFs em buckets privados:** acesso só por URL assinada de curta duração; o
  servidor só assina caminhos da pasta do prestador dono do documento. No envio, cada foto é
  conferida pelos primeiros bytes e o SHA-256 dela entra no documento selado.
- **Limite de taxa** (no próprio Postgres, com o HMAC do IP, nunca o IP) para abrir o link, pedir
  código, responder, baixar o comprovante e usar o `/verificar`.
- **Cabeçalhos de segurança:** `X-Frame-Options`, CSP com `frame-ancestors 'none'`,
  `Permissions-Policy`, `nosniff`; na página do cliente, `no-referrer`, `no-store` e `noindex`.
- **Outros cuidados:** Zod em toda entrada (inclusive argumentos de Server Actions), proteção contra redirecionamento aberto, mensagens de
  login que não revelam se o e-mail existe, CPF mascarado na interface e segredos só em variáveis de
  ambiente.
