create type public.papel as enum ('admin', 'prestador');

create type public.nicho as enum (
  'reforma',
  'assistencia_tecnica',
  'design',
  'agencia',
  'instalacao'
);

create type public.proposta_tipo as enum ('proposta', 'aditivo', 'entrega');

-- 'expirada' nunca é gravada: é calculada na leitura (view propostas_situacao).
create type public.proposta_status as enum (
  'rascunho',
  'enviada',
  'visualizada',
  'aceita',
  'recusada',
  'ajuste_solicitado',
  'expirada'
);

create type public.aceite_resultado as enum ('aceito', 'recusado', 'ajuste');

create type public.evento_tipo as enum (
  'enviada',
  'link_regenerado',
  'aberta',
  'otp_enviado',
  'otp_verificado',
  'otp_falhou',
  'aceita',
  'recusada',
  'ajuste_solicitado',
  'pdf_gerado',
  'email_enviado'
);
