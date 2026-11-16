-- =============================================================================
-- Zelo · 0003 · Índices
-- Pensados nas consultas reais: painel do prestador, busca pelo token do link,
-- timeline de auditoria e controle de reenvio do OTP.
-- =============================================================================

-- Painel e listagem: "minhas propostas por status, mais recentes primeiro".
create index propostas_prestador_status_idx on public.propostas (prestador_id, status, criado_em desc);
-- Aditivos/entregas de uma proposta.
create index propostas_pai_idx on public.propostas (proposta_pai_id) where proposta_pai_id is not null;
-- (token_hash já tem índice único pela constraint UNIQUE.)

-- Templates: globais ativos e os do prestador.
create index templates_dono_idx on public.templates (dono_id, nicho) where ativo;

-- (proposta_versoes (proposta_id, numero) já tem índice único.)

-- Respostas de uma versão; no máximo UM aceite positivo por versão.
create index aceites_versao_idx on public.aceites (versao_id, criado_em);
create unique index aceites_um_aceito_por_versao on public.aceites (versao_id) where resultado = 'aceito';

-- Timeline de auditoria de uma proposta.
create index auditoria_proposta_idx on public.auditoria_eventos (proposta_id, criado_em);
create index auditoria_versao_idx on public.auditoria_eventos (versao_id) where versao_id is not null;

-- OTP: último código da proposta e contagem de reenvios na última hora.
create index otp_proposta_idx on public.otp_codigos (proposta_id, criado_em desc);
