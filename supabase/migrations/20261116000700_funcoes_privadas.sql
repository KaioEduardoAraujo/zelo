-- =============================================================================
-- Zelo · 0007 · Funções auxiliares fora da API
--
-- O PostgREST expõe tudo o que está no schema `public` em /rest/v1/rpc/<função>.
-- As funções usadas pelas políticas RLS (is_admin, is_active_prestador,
-- eh_dono_da_proposta) são SECURITY DEFINER e não precisam ser chamadas pela API.
-- Movê-las para o schema `private` (não exposto) as tira da API, e as políticas
-- continuam funcionando, porque guardam a referência interna (OID) da função.
-- Apontado pelos advisors de segurança do Supabase.
--
-- admin_resumo_prestadores continua em `public` DE PROPÓSITO: o painel do admin a chama
-- pela API, e a primeira coisa que ela faz é exigir admin.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.is_admin() set schema private;
alter function public.is_active_prestador() set schema private;
alter function public.eh_dono_da_proposta(uuid) set schema private;
alter function public.eh_usuario_final() set schema private;

-- Visitante anônimo nunca avalia políticas (todas são "to authenticated").
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

-- Corpos em PL/pgSQL referenciam as funções pelo NOME, então precisam ser recriados.
create or replace function public.proteger_perfil()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id or new.criado_em <> old.criado_em then
    raise exception 'id e criado_em do perfil são imutáveis' using errcode = '42501';
  end if;

  if not private.eh_usuario_final() then
    return new; -- servidor/migrations (ex.: seed do admin, sincronizar e-mail)
  end if;

  if new.role <> old.role then
    raise exception 'o papel do usuário não pode ser alterado pela aplicação' using errcode = '42501';
  end if;
  if new.email <> old.email then
    raise exception 'o e-mail do perfil acompanha o e-mail de login' using errcode = '42501';
  end if;

  if new.ativo <> old.ativo then
    if not private.is_admin() or new.id = auth.uid() then
      raise exception 'somente um administrador pode ativar ou suspender outra conta' using errcode = '42501';
    end if;
  end if;

  -- Admin mexendo no perfil de outra pessoa: só pode mudar `ativo`.
  if new.id <> auth.uid()
     and (new.nome, new.telefone, new.empresa_nome)
         is distinct from (old.nome, old.telefone, old.empresa_nome) then
    raise exception 'o administrador não altera dados do prestador, só o status da conta' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.admin_resumo_prestadores()
returns table (
  id uuid,
  nome text,
  email text,
  empresa_nome text,
  ativo boolean,
  criado_em timestamptz,
  total_propostas bigint,
  total_aceites bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'acesso restrito ao administrador' using errcode = '42501';
  end if;

  return query
  select
    pr.id, pr.nome, pr.email, pr.empresa_nome, pr.ativo, pr.criado_em,
    (select count(*) from public.propostas p where p.prestador_id = pr.id),
    (select count(*)
       from public.aceites a
       join public.proposta_versoes pv on pv.id = a.versao_id
       join public.propostas p on p.id = pv.proposta_id
      where p.prestador_id = pr.id and a.resultado = 'aceito')
  from public.profiles pr
  where pr.role = 'prestador'
  order by pr.criado_em desc;
end;
$$;

-- As demais funções de trigger usam eh_usuario_final pelo nome: recriadas também.
create or replace function public.proteger_proposta()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_versao_id uuid;
  v_enviada_em timestamptz;
  v_max integer;
  v_resultado public.aceite_resultado;
begin
  if new.id <> old.id or new.prestador_id <> old.prestador_id or new.tipo <> old.tipo
     or new.proposta_pai_id is distinct from old.proposta_pai_id or new.criado_em <> old.criado_em then
    raise exception 'dono, tipo e vínculo da proposta são imutáveis' using errcode = '42501';
  end if;

  if old.status <> 'rascunho'
     and (new.cliente_nome, new.cliente_email, new.cliente_telefone, new.titulo)
         is distinct from (old.cliente_nome, old.cliente_email, old.cliente_telefone, old.titulo) then
    raise exception 'dados do cliente e título só podem mudar em rascunho' using errcode = '42501';
  end if;

  select coalesce(max(numero), 1) into v_max from public.proposta_versoes where proposta_id = new.id;
  if new.versao_atual <> v_max then
    raise exception 'versao_atual deve ser sempre a última versão (%)', v_max using errcode = '23514';
  end if;

  select id, enviada_em into v_versao_id, v_enviada_em
  from public.proposta_versoes where proposta_id = new.id and numero = new.versao_atual;

  if new.status = 'rascunho' and v_enviada_em is not null then
    raise exception 'a versão atual já foi enviada; crie uma nova versão para editar' using errcode = '23514';
  end if;
  if new.status <> 'rascunho' and v_enviada_em is null then
    raise exception 'a versão atual ainda não foi enviada' using errcode = '23514';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'aceita' then
      raise exception 'proposta aceita não muda de status' using errcode = '42501';
    end if;

    if private.eh_usuario_final() and new.status not in ('rascunho', 'enviada') then
      raise exception 'status % só é definido pela resposta do cliente', new.status using errcode = '42501';
    end if;

    if new.status in ('aceita', 'recusada', 'ajuste_solicitado') then
      select resultado into v_resultado
      from public.aceites where versao_id = v_versao_id
      order by criado_em desc limit 1;

      if v_resultado is distinct from (case new.status
            when 'aceita' then 'aceito'
            when 'recusada' then 'recusado'
            else 'ajuste' end)::public.aceite_resultado then
        raise exception 'status % exige a resposta correspondente do cliente registrada', new.status
          using errcode = '23514';
      end if;
    end if;
  end if;

  new.atualizado_em := now();
  return new;
end;
$$;
