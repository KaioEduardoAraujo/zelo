-- =============================================================================
-- Zelo · 0001 · Tipos enumerados
-- Enums deixam o banco recusar valores inválidos (ex.: status "aceito" digitado errado),
-- em vez de confiar só na validação da aplicação.
-- =============================================================================

create type public.papel as enum ('admin', 'prestador');

create type public.nicho as enum (
  'reforma',
  'assistencia_tecnica',
  'design',
  'agencia',
  'instalacao'
);

-- proposta: documento principal; aditivo: extra durante o serviço; entrega: aceite de conclusão.
create type public.proposta_tipo as enum ('proposta', 'aditivo', 'entrega');

-- 'expirada' existe no enum para a view propostas_situacao, mas NUNCA é gravada na tabela:
-- é calculada na leitura (validade_em < now()). Decisão aprovada na Fase 0.
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
  'enviada',           -- prestador travou a versão e gerou o link
  'link_regenerado',   -- prestador gerou um novo link (o anterior deixa de valer)
  'aberta',            -- cliente abriu o link
  'otp_enviado',
  'otp_verificado',
  'otp_falhou',
  'aceita',
  'recusada',
  'ajuste_solicitado',
  'pdf_gerado',
  'email_enviado'
);
