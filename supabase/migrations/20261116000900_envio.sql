-- =============================================================================
-- Zelo · 0009 · Envio da proposta (Fase 5)
--
-- enviar_versao()  → trava a versão atual, grava o hash, gera o link e registra o evento.
-- regenerar_link() → troca o link de uma proposta já enviada (o anterior deixa de valer).
--
-- Por que funções no banco, e não 4 chamadas da aplicação?
--   ATOMICIDADE: ou acontece tudo (versão travada + hash + status + link + evento de auditoria)
--   ou nada. Com chamadas separadas, uma falha no meio deixaria uma versão enviada sem evento
--   na trilha, ou um link sem versão travada.
--
-- Por que SECURITY DEFINER? O prestador não tem permissão de gravar em `auditoria_eventos`
-- (só o servidor grava provas). A função faz essa gravação em nome dele, mas só depois de
-- conferir, ela mesma, quem está chamando (auth.uid()) e se a proposta é dele.
--
-- Por que dois níveis? A lógica fica em `private` (não exposto pela API) e o que a API vê é um
-- invólucro SECURITY INVOKER. Assim os advisors de segurança não apontam uma função
-- DEFINER pública (ver 0007).
-- =============================================================================

create function private.enviar_versao(
  p_proposta_id uuid,
  p_documento jsonb,
  p_hash text,
  p_token_hash text,
  p_ip inet default null,
  p_user_agent text default null
)
returns table (
  r_versao_id uuid,
  r_numero integer,
  r_validade_em timestamptz,
  r_enviada_em timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_proposta record;
  v_versao record;
  v_dias integer;
  v_agora timestamptz := now();
  v_validade timestamptz;
begin
  if v_uid is null or not private.is_active_prestador() then
    raise exception 'apenas prestadores ativos enviam propostas' using errcode = '42501';
  end if;

  -- Trava a linha: duas chamadas ao mesmo tempo não enviam a mesma proposta duas vezes.
  select id, prestador_id, status, versao_atual into v_proposta
  from public.propostas where id = p_proposta_id for update;

  -- Mesma resposta para "não existe" e "é de outra pessoa": não revela a existência.
  if not found or v_proposta.prestador_id <> v_uid then
    raise exception 'proposta não encontrada' using errcode = '42501';
  end if;
  if v_proposta.status <> 'rascunho' then
    raise exception 'esta proposta não está em rascunho' using errcode = '23514';
  end if;

  select id, numero, enviada_em into v_versao
  from public.proposta_versoes
  where proposta_id = p_proposta_id and numero = v_proposta.versao_atual
  for update;
  if not found or v_versao.enviada_em is not null then
    raise exception 'a versão atual já foi enviada' using errcode = '23514';
  end if;

  if p_hash !~ '^[0-9a-f]{64}$' or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'hash em formato inválido' using errcode = '22023';
  end if;
  if jsonb_typeof(p_documento) <> 'object' then
    raise exception 'documento inválido' using errcode = '22023';
  end if;

  -- O documento precisa declarar a quem pertence: esta proposta e esta versão. Isso amarra o
  -- hash ao registro (dois documentos com o mesmo texto não geram o mesmo hash).
  if p_documento ->> 'proposta_id' is distinct from p_proposta_id::text
     or p_documento ->> 'versao' is distinct from v_versao.numero::text then
    raise exception 'o documento não corresponde a esta versão' using errcode = '22023';
  end if;

  if jsonb_typeof(p_documento -> 'validade_dias') is distinct from 'number' then
    raise exception 'validade inválida' using errcode = '22023';
  end if;
  v_dias := floor((p_documento ->> 'validade_dias')::numeric)::integer;
  if v_dias <> (p_documento ->> 'validade_dias')::numeric or v_dias not between 1 and 90 then
    raise exception 'validade inválida' using errcode = '22023';
  end if;

  v_validade := v_agora + make_interval(days => v_dias);

  -- 1) Trava a versão: conteúdo final + hash + data do envio (o trigger impede qualquer
  --    alteração depois disso).
  update public.proposta_versoes
     set conteudo = p_documento, hash_sha256 = p_hash, enviada_em = v_agora
   where id = v_versao.id;

  -- 2) A proposta passa a "enviada", com o novo link e a validade. Enviar a versão N+1 troca o
  --    token: o link da versão anterior deixa de funcionar.
  update public.propostas
     set status = 'enviada', token_hash = p_token_hash, validade_em = v_validade
   where id = p_proposta_id;

  -- 3) Trilha de auditoria.
  insert into public.auditoria_eventos (proposta_id, versao_id, tipo, ip, user_agent, metadados)
  values (
    p_proposta_id, v_versao.id, 'enviada', p_ip, left(p_user_agent, 512),
    jsonb_build_object('versao', v_versao.numero, 'hash_sha256', p_hash)
  );

  return query select v_versao.id, v_versao.numero, v_validade, v_agora;
end;
$$;

create function private.regenerar_link(
  p_proposta_id uuid,
  p_token_hash text,
  p_ip inet default null,
  p_user_agent text default null
)
returns table (
  r_versao_id uuid,
  r_numero integer,
  r_validade_em timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_proposta record;
  v_versao_id uuid;
begin
  if v_uid is null or not private.is_active_prestador() then
    raise exception 'apenas prestadores ativos geram links' using errcode = '42501';
  end if;

  select id, prestador_id, status, versao_atual, validade_em into v_proposta
  from public.propostas where id = p_proposta_id for update;
  if not found or v_proposta.prestador_id <> v_uid then
    raise exception 'proposta não encontrada' using errcode = '42501';
  end if;

  -- Só faz sentido enquanto o cliente ainda pode responder. Proposta vencida pede uma nova
  -- versão (a validade só se renova enviando de novo).
  if v_proposta.status not in ('enviada', 'visualizada') then
    raise exception 'esta proposta não aceita um novo link' using errcode = '23514';
  end if;
  if v_proposta.validade_em < now() then
    raise exception 'esta proposta venceu' using errcode = '23514';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'hash em formato inválido' using errcode = '22023';
  end if;

  select id into v_versao_id
  from public.proposta_versoes
  where proposta_id = p_proposta_id and numero = v_proposta.versao_atual;

  update public.propostas set token_hash = p_token_hash where id = p_proposta_id;

  insert into public.auditoria_eventos (proposta_id, versao_id, tipo, ip, user_agent, metadados)
  values (
    p_proposta_id, v_versao_id, 'link_regenerado', p_ip, left(p_user_agent, 512),
    jsonb_build_object('versao', v_proposta.versao_atual)
  );

  return query select v_versao_id, v_proposta.versao_atual, v_proposta.validade_em;
end;
$$;

-- Funções novas nascem executáveis por todos (PUBLIC): fecha e abre só para quem precisa.
revoke execute on function private.enviar_versao(uuid, jsonb, text, text, inet, text) from public, anon;
revoke execute on function private.regenerar_link(uuid, text, inet, text) from public, anon;
grant execute on function private.enviar_versao(uuid, jsonb, text, text, inet, text) to authenticated;
grant execute on function private.regenerar_link(uuid, text, inet, text) to authenticated;

-- O que a API enxerga: invólucros SECURITY INVOKER (rodam como o usuário logado).
create function public.enviar_versao(
  p_proposta_id uuid,
  p_documento jsonb,
  p_hash text,
  p_token_hash text,
  p_ip inet default null,
  p_user_agent text default null
)
returns table (
  r_versao_id uuid,
  r_numero integer,
  r_validade_em timestamptz,
  r_enviada_em timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.enviar_versao(p_proposta_id, p_documento, p_hash, p_token_hash, p_ip, p_user_agent);
$$;

create function public.regenerar_link(
  p_proposta_id uuid,
  p_token_hash text,
  p_ip inet default null,
  p_user_agent text default null
)
returns table (
  r_versao_id uuid,
  r_numero integer,
  r_validade_em timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.regenerar_link(p_proposta_id, p_token_hash, p_ip, p_user_agent);
$$;

revoke execute on function public.enviar_versao(uuid, jsonb, text, text, inet, text) from public, anon;
revoke execute on function public.regenerar_link(uuid, text, inet, text) from public, anon;
grant execute on function public.enviar_versao(uuid, jsonb, text, text, inet, text) to authenticated;
grant execute on function public.regenerar_link(uuid, text, inet, text) to authenticated;
