-- CHECKs no banco: dado inválido é recusado mesmo sem passar pelo Zod.

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  nome          text not null check (char_length(nome) between 2 and 120),
  email         text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefone      text check (telefone ~ '^\d{10,13}$'),
  empresa_nome  text check (char_length(empresa_nome) <= 120),
  role          public.papel not null default 'prestador',
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);
comment on table public.profiles is 'Perfil do prestador ou admin. role/ativo só mudam por admin ou servidor.';

create table public.templates (
  id         uuid primary key default gen_random_uuid(),
  nicho      public.nicho not null,
  titulo     text not null check (char_length(titulo) between 3 and 120),
  conteudo   jsonb not null check (jsonb_typeof(conteudo) = 'object'),
  dono_id    uuid references public.profiles (id) on delete cascade,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

create table public.propostas (
  id                uuid primary key default gen_random_uuid(),
  -- restrict: a prova precisa continuar existindo.
  prestador_id      uuid not null references public.profiles (id) on delete restrict,
  tipo              public.proposta_tipo not null default 'proposta',
  proposta_pai_id   uuid references public.propostas (id) on delete restrict,
  cliente_nome      text not null check (char_length(cliente_nome) between 2 and 120),
  cliente_email     text not null check (cliente_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  cliente_telefone  text check (cliente_telefone ~ '^\d{10,13}$'),
  titulo            text not null check (char_length(titulo) between 3 and 140),
  status            public.proposta_status not null default 'rascunho',
  versao_atual      integer not null default 1 check (versao_atual >= 1),
  -- Só o HMAC do token; o token nunca é gravado.
  token_hash        text unique check (token_hash ~ '^[0-9a-f]{64}$'),
  validade_em       timestamptz,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),

  constraint propostas_pai_coerente check ((tipo = 'proposta') = (proposta_pai_id is null)),
  constraint propostas_status_gravavel check (status <> 'expirada'),
  constraint propostas_enviada_tem_link check (
    status = 'rascunho' or (token_hash is not null and validade_em is not null)
  )
);

create table public.proposta_versoes (
  id           uuid primary key default gen_random_uuid(),
  proposta_id  uuid not null references public.propostas (id) on delete cascade,
  numero       integer not null check (numero >= 1),
  conteudo     jsonb not null default '{}'::jsonb check (jsonb_typeof(conteudo) = 'object'),
  hash_sha256  text check (hash_sha256 ~ '^[0-9a-f]{64}$'),
  enviada_em   timestamptz,
  criado_em    timestamptz not null default now(),

  constraint proposta_versoes_numero_unico unique (proposta_id, numero),
  constraint proposta_versoes_envio_com_hash check ((enviada_em is null) = (hash_sha256 is null))
);

-- Sem caracteres ambíguos (0/O, 1/I/L): fácil de ditar e digitar.
create function public.gerar_codigo_comprovante()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  bytes bytea := extensions.gen_random_bytes(8);
  codigo text := '';
begin
  for i in 0..7 loop
    codigo := codigo || substr(alfabeto, (get_byte(bytes, i) % length(alfabeto)) + 1, 1);
  end loop;
  return 'ZL-' || substr(codigo, 1, 4) || '-' || substr(codigo, 5, 4);
end;
$$;

create table public.aceites (
  id                   uuid primary key default gen_random_uuid(),
  versao_id            uuid not null references public.proposta_versoes (id) on delete restrict,
  resultado            public.aceite_resultado not null,
  comentario           text check (char_length(comentario) <= 2000),
  cliente_nome         text not null check (char_length(cliente_nome) between 2 and 120),
  cliente_cpf          text check (cliente_cpf ~ '^\d{11}$'),
  ip                   inet,
  user_agent           text check (char_length(user_agent) <= 512),
  otp_verificado_em    timestamptz not null,
  texto_consentimento  text not null,
  hash_documento       text not null check (hash_documento ~ '^[0-9a-f]{64}$'),
  codigo_comprovante   text not null unique default public.gerar_codigo_comprovante()
                       check (codigo_comprovante ~ '^ZL-[2-9A-Z]{4}-[2-9A-Z]{4}$'),
  -- Definido antes de gerar o PDF: o aceite nunca precisa de UPDATE.
  pdf_path             text,
  criado_em            timestamptz not null default now(),

  constraint aceites_aceito_tem_cpf check (resultado <> 'aceito' or cliente_cpf is not null),
  constraint aceites_ajuste_tem_comentario check (
    resultado <> 'ajuste' or char_length(coalesce(comentario, '')) > 0
  )
);

create table public.auditoria_eventos (
  id           uuid primary key default gen_random_uuid(),
  proposta_id  uuid not null references public.propostas (id) on delete restrict,
  versao_id    uuid references public.proposta_versoes (id) on delete restrict,
  tipo         public.evento_tipo not null,
  ip           inet,
  user_agent   text check (char_length(user_agent) <= 512),
  -- Nada de dados pessoais aqui (LGPD).
  metadados    jsonb not null default '{}'::jsonb check (jsonb_typeof(metadados) = 'object'),
  criado_em    timestamptz not null default now()
);

create table public.otp_codigos (
  id           uuid primary key default gen_random_uuid(),
  proposta_id  uuid not null references public.propostas (id) on delete cascade,
  email        text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  codigo_hash  text not null check (codigo_hash ~ '^[0-9a-f]{64}$'),  -- HMAC, nunca o código
  expira_em    timestamptz not null,
  tentativas   integer not null default 0 check (tentativas between 0 and 5),
  usado_em     timestamptz,
  criado_em    timestamptz not null default now()
);
