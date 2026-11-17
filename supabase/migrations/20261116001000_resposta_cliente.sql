-- Só a service_role executa (o cliente não tem conta; o servidor valida o token antes).
-- SECURITY INVOKER: os triggers continuam valendo.

-- Limite de taxa no Postgres: memória do servidor não serve na Vercel.
create table public.limites_taxa (
  chave          text not null check (char_length(chave) <= 200),
  janela_inicio  timestamptz not null,
  contagem       integer not null default 0,
  primary key (chave, janela_inicio)
);
comment on table public.limites_taxa is 'Contadores de limite de taxa. Chaves com IP guardam o HMAC do IP, nunca o IP.';

alter table public.limites_taxa enable row level security;
revoke all on public.limites_taxa from anon, authenticated;

create function public.consumir_limite(p_chave text, p_limite integer, p_janela_segundos integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inicio timestamptz;
  v_contagem integer;
begin
  if p_limite < 1 or p_janela_segundos < 1 then
    raise exception 'limite inválido' using errcode = '22023';
  end if;

  v_inicio := to_timestamp(floor(extract(epoch from now()) / p_janela_segundos) * p_janela_segundos);

  insert into public.limites_taxa (chave, janela_inicio, contagem)
  values (p_chave, v_inicio, 1)
  on conflict (chave, janela_inicio)
    do update set contagem = public.limites_taxa.contagem + 1
  returning contagem into v_contagem;

  delete from public.limites_taxa where chave = p_chave and janela_inicio < v_inicio;

  return v_contagem <= p_limite;
end;
$$;

-- Chamada pelo navegador depois de carregar: a prévia de link do WhatsApp não roda JS.
create function public.registrar_abertura(p_proposta_id uuid, p_ip inet, p_user_agent text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_p record;
  v_versao_id uuid;
  v_ua text := left(p_user_agent, 512);
begin
  select id, status, validade_em, versao_atual into v_p
  from public.propostas where id = p_proposta_id for update;

  if not found or v_p.status not in ('enviada', 'visualizada') or v_p.validade_em < now() then
    return;
  end if;

  select id into v_versao_id
  from public.proposta_versoes
  where proposta_id = p_proposta_id and numero = v_p.versao_atual;

  -- Uma abertura por dispositivo a cada 10 minutos.
  if not exists (
    select 1 from public.auditoria_eventos
    where proposta_id = p_proposta_id
      and tipo = 'aberta'
      and ip is not distinct from p_ip
      and user_agent is not distinct from v_ua
      and criado_em > now() - interval '10 minutes'
  ) then
    insert into public.auditoria_eventos (proposta_id, versao_id, tipo, ip, user_agent)
    values (p_proposta_id, v_versao_id, 'aberta', p_ip, v_ua);
  end if;

  if v_p.status = 'enviada' then
    update public.propostas set status = 'visualizada' where id = p_proposta_id;
  end if;
end;
$$;

-- Só o HMAC do código. Só o código mais recente vale.
create function public.registrar_otp(
  p_proposta_id uuid,
  p_email text,
  p_codigo_hash text,
  p_acao public.aceite_resultado,
  p_ip inet,
  p_user_agent text
)
returns table (r_expira_em timestamptz, r_restantes integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_p record;
  v_versao_id uuid;
  v_enviados integer;
  v_expira timestamptz := now() + interval '10 minutes';
begin
  if p_codigo_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'hash em formato inválido' using errcode = '22023';
  end if;

  select id, status, validade_em, versao_atual into v_p
  from public.propostas where id = p_proposta_id for update;
  if not found or v_p.status not in ('enviada', 'visualizada') or v_p.validade_em < now() then
    raise exception 'proposta indisponível' using errcode = '23514';
  end if;

  select count(*) into v_enviados
  from public.otp_codigos
  where proposta_id = p_proposta_id and criado_em > now() - interval '1 hour';
  if v_enviados >= 3 then
    raise exception 'limite de códigos atingido' using errcode = '54000';
  end if;

  insert into public.otp_codigos (proposta_id, email, codigo_hash, expira_em)
  values (p_proposta_id, p_email, p_codigo_hash, v_expira);

  select id into v_versao_id
  from public.proposta_versoes
  where proposta_id = p_proposta_id and numero = v_p.versao_atual;

  -- Sem o e-mail nos metadados (LGPD).
  insert into public.auditoria_eventos (proposta_id, versao_id, tipo, ip, user_agent, metadados)
  values (p_proposta_id, v_versao_id, 'otp_enviado', p_ip, left(p_user_agent, 512),
          jsonb_build_object('acao', p_acao));

  return query select v_expira, 3 - (v_enviados + 1);
end;
$$;

-- Código errado devolve status em vez de erro: um erro desfaria o +1 das tentativas e o limite
-- de 5 nunca seria atingido.
create function public.registrar_resposta(
  p_proposta_id uuid,
  p_codigo_hash text,
  p_resultado public.aceite_resultado,
  p_cliente_nome text,
  p_cliente_cpf text,
  p_comentario text,
  p_texto_consentimento text,
  p_ip inet,
  p_user_agent text
)
returns table (
  r_status text,              -- ok | codigo_incorreto | expirado | bloqueado | sem_codigo | indisponivel
  r_tentativas_restantes integer,
  r_aceite_id uuid,
  r_codigo_comprovante text,
  r_criado_em timestamptz,
  r_hash_documento text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_agora timestamptz := now();
  v_p record;
  v_versao record;
  v_otp record;
  v_ua text := left(p_user_agent, 512);
  v_aceite_id uuid := gen_random_uuid();
  v_codigo text;
begin
  select id, prestador_id, status, validade_em, versao_atual into v_p
  from public.propostas where id = p_proposta_id for update;
  if not found or v_p.status not in ('enviada', 'visualizada') or v_p.validade_em < v_agora then
    return query select 'indisponivel', 0, null::uuid, null::text, null::timestamptz, null::text;
    return;
  end if;

  select id, hash_sha256 into v_versao
  from public.proposta_versoes
  where proposta_id = p_proposta_id and numero = v_p.versao_atual;

  select id, codigo_hash, expira_em, tentativas, usado_em into v_otp
  from public.otp_codigos
  where proposta_id = p_proposta_id
  order by criado_em desc
  limit 1
  for update;

  if not found or v_otp.usado_em is not null then
    return query select 'sem_codigo', 0, null::uuid, null::text, null::timestamptz, null::text;
    return;
  end if;
  if v_otp.expira_em < v_agora then
    return query select 'expirado', 0, null::uuid, null::text, null::timestamptz, null::text;
    return;
  end if;
  if v_otp.tentativas >= 5 then
    return query select 'bloqueado', 0, null::uuid, null::text, null::timestamptz, null::text;
    return;
  end if;

  if v_otp.codigo_hash is distinct from p_codigo_hash then
    update public.otp_codigos set tentativas = tentativas + 1 where id = v_otp.id;
    insert into public.auditoria_eventos (proposta_id, versao_id, tipo, ip, user_agent, metadados)
    values (p_proposta_id, v_versao.id, 'otp_falhou', p_ip, v_ua,
            jsonb_build_object('tentativa', v_otp.tentativas + 1));
    return query select 'codigo_incorreto', 5 - (v_otp.tentativas + 1),
                        null::uuid, null::text, null::timestamptz, null::text;
    return;
  end if;

  update public.otp_codigos set usado_em = v_agora where id = v_otp.id;

  insert into public.auditoria_eventos (proposta_id, versao_id, tipo, ip, user_agent)
  values (p_proposta_id, v_versao.id, 'otp_verificado', p_ip, v_ua);

  -- pdf_path definido agora: o aceite é append-only.
  insert into public.aceites (
    id, versao_id, resultado, comentario, cliente_nome, cliente_cpf, ip, user_agent,
    otp_verificado_em, texto_consentimento, hash_documento, pdf_path
  )
  values (
    v_aceite_id, v_versao.id, p_resultado, nullif(btrim(p_comentario), ''), p_cliente_nome,
    p_cliente_cpf, p_ip, v_ua, v_agora, p_texto_consentimento, v_versao.hash_sha256,
    case when p_resultado = 'aceito'
      then v_p.prestador_id::text || '/' || v_aceite_id::text || '.pdf' end
  )
  returning codigo_comprovante into v_codigo;

  update public.propostas
     set status = case p_resultado
       when 'aceito' then 'aceita'::public.proposta_status
       when 'recusado' then 'recusada'::public.proposta_status
       else 'ajuste_solicitado'::public.proposta_status
     end
   where id = p_proposta_id;

  insert into public.auditoria_eventos (proposta_id, versao_id, tipo, ip, user_agent, metadados)
  values (
    p_proposta_id, v_versao.id,
    case p_resultado
      when 'aceito' then 'aceita'::public.evento_tipo
      when 'recusado' then 'recusada'::public.evento_tipo
      else 'ajuste_solicitado'::public.evento_tipo
    end,
    p_ip, v_ua,
    jsonb_build_object('aceite_id', v_aceite_id, 'codigo_comprovante', v_codigo)
  );

  return query select 'ok', 5 - v_otp.tentativas, v_aceite_id, v_codigo, v_agora, v_versao.hash_sha256;
end;
$$;

revoke execute on function public.consumir_limite(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.registrar_abertura(uuid, inet, text) from public, anon, authenticated;
revoke execute on function public.registrar_otp(uuid, text, text, public.aceite_resultado, inet, text) from public, anon, authenticated;
revoke execute on function public.registrar_resposta(uuid, text, public.aceite_resultado, text, text, text, text, inet, text) from public, anon, authenticated;

grant execute on function public.consumir_limite(text, integer, integer) to service_role;
grant execute on function public.registrar_abertura(uuid, inet, text) to service_role;
grant execute on function public.registrar_otp(uuid, text, text, public.aceite_resultado, inet, text) to service_role;
grant execute on function public.registrar_resposta(uuid, text, public.aceite_resultado, text, text, text, text, inet, text) to service_role;
