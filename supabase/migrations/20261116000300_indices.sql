create index propostas_prestador_status_idx on public.propostas (prestador_id, status, criado_em desc);
create index propostas_pai_idx on public.propostas (proposta_pai_id) where proposta_pai_id is not null;

create index templates_dono_idx on public.templates (dono_id, nicho) where ativo;

-- No máximo um aceite positivo por versão.
create index aceites_versao_idx on public.aceites (versao_id, criado_em);
create unique index aceites_um_aceito_por_versao on public.aceites (versao_id) where resultado = 'aceito';

create index auditoria_proposta_idx on public.auditoria_eventos (proposta_id, criado_em);
create index auditoria_versao_idx on public.auditoria_eventos (versao_id) where versao_id is not null;

create index otp_proposta_idx on public.otp_codigos (proposta_id, criado_em desc);
