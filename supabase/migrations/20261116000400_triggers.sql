-- Triggers valem até para a service_role, que ignora o RLS: um aceite gravado não pode ser
-- alterado nem apagado, nem por um bug no servidor.

-- Usuário final via API (o PostgREST usa SET ROLE authenticated/anon), e não o servidor nem
-- uma migration.
create function public.eh_usuario_final()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('authenticated', 'anon');
$$;

-- SECURITY DEFINER para ler profiles sem recursão no RLS; search_path vazio evita sequestro de
-- funções.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and ativo
  );
$$;

create function public.is_active_prestador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'prestador' and ativo
  );
$$;

-- O papel é sempre prestador: um "role" enviado no cadastro é ignorado.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text := trim(coalesce(new.raw_user_meta_data ->> 'nome', ''));
  v_telefone text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'telefone', ''), '\D', '', 'g');
  v_empresa text := trim(coalesce(new.raw_user_meta_data ->> 'empresa_nome', ''));
begin
  if char_length(v_nome) < 2 then
    v_nome := 'Prestador';
  end if;

  insert into public.profiles (id, nome, email, telefone, empresa_nome, role)
  values (
    new.id,
    left(v_nome, 120),
    new.email,
    nullif(v_telefone, ''),
    nullif(left(v_empresa, 120), ''),
    'prestador'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- role nunca muda pela API; ativo só muda por um admin, e não no próprio perfil.
create function public.proteger_perfil()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id or new.criado_em <> old.criado_em then
    raise exception 'id e criado_em do perfil são imutáveis' using errcode = '42501';
  end if;

  if not public.eh_usuario_final() then
    return new;
  end if;

  if new.role <> old.role then
    raise exception 'o papel do usuário não pode ser alterado pela aplicação' using errcode = '42501';
  end if;
  if new.email <> old.email then
    raise exception 'o e-mail do perfil acompanha o e-mail de login' using errcode = '42501';
  end if;

  if new.ativo <> old.ativo then
    if not public.is_admin() or new.id = auth.uid() then
      raise exception 'somente um administrador pode ativar ou suspender outra conta' using errcode = '42501';
    end if;
  end if;

  if new.id <> auth.uid()
     and (new.nome, new.telefone, new.empresa_nome)
         is distinct from (old.nome, old.telefone, old.empresa_nome) then
    raise exception 'o administrador não altera dados do prestador, só o status da conta' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger proteger_perfil
  before update on public.profiles
  for each row execute function public.proteger_perfil();

-- Append-only: aceites e auditoria_eventos.
create function public.bloquear_alteracao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'a tabela % é somente inclusão (append-only): % não é permitido',
    tg_table_name, tg_op
    using errcode = '42501';
end;
$$;

create trigger aceites_append_only
  before update or delete on public.aceites
  for each row execute function public.bloquear_alteracao();
create trigger aceites_sem_truncate
  before truncate on public.aceites
  for each statement execute function public.bloquear_alteracao();

create trigger auditoria_append_only
  before update or delete on public.auditoria_eventos
  for each row execute function public.bloquear_alteracao();
create trigger auditoria_sem_truncate
  before truncate on public.auditoria_eventos
  for each statement execute function public.bloquear_alteracao();

-- TRUNCATE ignora triggers de linha: bloqueado nas tabelas de prova.
create trigger versoes_sem_truncate
  before truncate on public.proposta_versoes
  for each statement execute function public.bloquear_alteracao();
create trigger propostas_sem_truncate
  before truncate on public.propostas
  for each statement execute function public.bloquear_alteracao();

-- Horário sempre do banco.
create function public.forcar_criado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.criado_em := now();
  return new;
end;
$$;

create trigger auditoria_criado_em
  before insert on public.auditoria_eventos
  for each row execute function public.forcar_criado_em();

create function public.validar_nova_versao()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.proposta_status;
  v_proximo integer;
begin
  -- Trava a proposta para duas versões não ganharem o mesmo número.
  select status into v_status from public.propostas where id = new.proposta_id for update;

  if v_status = 'aceita' then
    raise exception 'proposta aceita não recebe nova versão; use um aditivo' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.proposta_versoes
    where proposta_id = new.proposta_id and enviada_em is null
  ) then
    raise exception 'já existe uma versão em rascunho para esta proposta' using errcode = '23514';
  end if;

  select coalesce(max(numero), 0) + 1 into v_proximo
  from public.proposta_versoes where proposta_id = new.proposta_id;

  new.numero := v_proximo;
  new.enviada_em := null;
  new.hash_sha256 := null;
  new.criado_em := now();
  return new;
end;
$$;

create trigger validar_nova_versao
  before insert on public.proposta_versoes
  for each row execute function public.validar_nova_versao();

create function public.apontar_versao_atual()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.propostas
     set versao_atual = new.numero, status = 'rascunho'
   where id = new.proposta_id
     and (versao_atual <> new.numero or status <> 'rascunho');
  return null;
end;
$$;

create trigger apontar_versao_atual
  after insert on public.proposta_versoes
  for each row execute function public.apontar_versao_atual();

create function public.proteger_versao_enviada()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.enviada_em is not null then
    raise exception 'versão % já foi enviada e é imutável; crie uma nova versão', old.numero
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.id <> old.id or new.proposta_id <> old.proposta_id or new.numero <> old.numero
     or new.criado_em <> old.criado_em then
    raise exception 'id, proposta, número e data de criação da versão são imutáveis' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger proteger_versao_enviada
  before update or delete on public.proposta_versoes
  for each row execute function public.proteger_versao_enviada();

create function public.validar_nova_proposta()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_pai record;
begin
  new.status := 'rascunho';
  new.versao_atual := 1;
  new.token_hash := null;
  new.validade_em := null;
  new.criado_em := now();
  new.atualizado_em := now();

  if new.proposta_pai_id is not null then
    select prestador_id, tipo, status into v_pai
    from public.propostas where id = new.proposta_pai_id;

    if not found
       or v_pai.prestador_id <> new.prestador_id
       or v_pai.tipo <> 'proposta'
       or v_pai.status <> 'aceita' then
      raise exception 'aditivo e entrega precisam apontar para uma proposta aceita do mesmo prestador'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger validar_nova_proposta
  before insert on public.propostas
  for each row execute function public.validar_nova_proposta();

-- aceita/recusada/ajuste só existem com o registro em aceites: o prestador não forja um aceite
-- mudando o status.
create function public.proteger_proposta()
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

    if public.eh_usuario_final() and new.status not in ('rascunho', 'enviada') then
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

create trigger proteger_proposta
  before update on public.propostas
  for each row execute function public.proteger_proposta();

-- Aceite só para a versão atual, enviada, na validade e com o hash certo.
create function public.validar_aceite()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v record;
begin
  select pv.hash_sha256, pv.enviada_em, pv.numero, p.versao_atual, p.status, p.validade_em
    into v
  from public.proposta_versoes pv
  join public.propostas p on p.id = pv.proposta_id
  where pv.id = new.versao_id;

  if not found or v.enviada_em is null then
    raise exception 'só é possível responder a uma versão enviada' using errcode = '23514';
  end if;
  if v.numero <> v.versao_atual then
    raise exception 'esta versão foi substituída por uma mais nova' using errcode = '23514';
  end if;
  if v.status not in ('enviada', 'visualizada') then
    raise exception 'esta proposta não aceita mais respostas (status %)', v.status using errcode = '23514';
  end if;
  if v.validade_em < now() then
    raise exception 'proposta expirada' using errcode = '23514';
  end if;
  if new.hash_documento <> v.hash_sha256 then
    raise exception 'hash do documento não confere com a versão enviada' using errcode = '23514';
  end if;
  if new.otp_verificado_em > now() then
    raise exception 'otp_verificado_em no futuro' using errcode = '23514';
  end if;

  new.criado_em := now();
  return new;
end;
$$;

create trigger validar_aceite
  before insert on public.aceites
  for each row execute function public.validar_aceite();
