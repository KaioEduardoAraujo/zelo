-- =============================================================================
-- Zelo · 0005 · Row Level Security (RLS), permissões, view e função do admin
--
-- Modelo:
--   * anon (visitante sem login): NENHUM acesso direto às tabelas. O cliente da proposta
--     só acessa pelo servidor, que valida o token e usa a service_role.
--   * authenticated (prestador/admin logado): só as linhas permitidas pelas políticas abaixo.
--   * service_role (servidor): ignora RLS, mas continua sujeita aos triggers da 0004.
-- =============================================================================

-- RLS ligado em todas as tabelas. Sem política = sem acesso.
alter table public.profiles          enable row level security;
alter table public.templates         enable row level security;
alter table public.propostas         enable row level security;
alter table public.proposta_versoes  enable row level security;
alter table public.aceites           enable row level security;
alter table public.auditoria_eventos enable row level security;
alter table public.otp_codigos       enable row level security;

-- Defesa em profundidade: além do RLS, tiramos os privilégios que não fazem sentido.
-- O Supabase concede tudo a anon/authenticated por padrão; aqui restringimos.
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke all on public.otp_codigos from authenticated;                       -- só o servidor
revoke insert, update, delete on public.aceites from authenticated;          -- só o servidor grava
revoke insert, update, delete on public.auditoria_eventos from authenticated;
revoke insert, delete on public.profiles from authenticated;                -- perfil nasce por trigger

-- Funções internas de trigger não devem ser chamadas pela API.
revoke execute on function public.gerar_codigo_comprovante() from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.handle_user_email_change() from anon, authenticated, public;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create policy "perfil: ver o próprio; admin vê todos"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

-- O trigger proteger_perfil limita QUAIS colunas cada um pode mudar.
create policy "perfil: editar o próprio; admin edita status de outros"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

-- -----------------------------------------------------------------------------
-- templates
-- -----------------------------------------------------------------------------
create policy "templates: ver globais ativos e os próprios; admin vê todos"
  on public.templates for select to authenticated
  using (
    (dono_id is null and ativo)
    or dono_id = (select auth.uid())
    or (select public.is_admin())
  );

create policy "templates: prestador ativo cria os próprios; admin cria globais"
  on public.templates for insert to authenticated
  with check (
    (dono_id = (select auth.uid()) and (select public.is_active_prestador()))
    or (dono_id is null and (select public.is_admin()))
  );

create policy "templates: editar os próprios; admin edita globais"
  on public.templates for update to authenticated
  using (
    (dono_id = (select auth.uid()) and (select public.is_active_prestador()))
    or (dono_id is null and (select public.is_admin()))
  )
  with check (
    (dono_id = (select auth.uid()) and (select public.is_active_prestador()))
    or (dono_id is null and (select public.is_admin()))
  );

create policy "templates: apagar os próprios; admin apaga globais"
  on public.templates for delete to authenticated
  using (
    (dono_id = (select auth.uid()) and (select public.is_active_prestador()))
    or (dono_id is null and (select public.is_admin()))
  );

-- -----------------------------------------------------------------------------
-- propostas — só o dono. O admin NÃO lê propostas (só contagens, via função abaixo).
-- Conta suspensa continua podendo LER (histórico), mas não cria nem altera.
-- -----------------------------------------------------------------------------
create policy "propostas: dono vê as suas"
  on public.propostas for select to authenticated
  using (prestador_id = (select auth.uid()));

create policy "propostas: prestador ativo cria em seu nome"
  on public.propostas for insert to authenticated
  with check (prestador_id = (select auth.uid()) and (select public.is_active_prestador()));

create policy "propostas: prestador ativo altera as suas"
  on public.propostas for update to authenticated
  using (prestador_id = (select auth.uid()) and (select public.is_active_prestador()))
  with check (prestador_id = (select auth.uid()) and (select public.is_active_prestador()));

create policy "propostas: apagar só rascunho"
  on public.propostas for delete to authenticated
  using (
    prestador_id = (select auth.uid())
    and status = 'rascunho'
    and (select public.is_active_prestador())
  );

-- -----------------------------------------------------------------------------
-- proposta_versoes — herda o dono da proposta. Imutabilidade garantida por trigger.
-- -----------------------------------------------------------------------------
create function public.eh_dono_da_proposta(p_proposta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.propostas
    where id = p_proposta_id and prestador_id = auth.uid()
  );
$$;

create policy "versoes: dono vê"
  on public.proposta_versoes for select to authenticated
  using ((select public.eh_dono_da_proposta(proposta_id)));

create policy "versoes: dono ativo cria"
  on public.proposta_versoes for insert to authenticated
  with check ((select public.eh_dono_da_proposta(proposta_id)) and (select public.is_active_prestador()));

create policy "versoes: dono ativo edita rascunho"
  on public.proposta_versoes for update to authenticated
  using ((select public.eh_dono_da_proposta(proposta_id)) and (select public.is_active_prestador()))
  with check ((select public.eh_dono_da_proposta(proposta_id)) and (select public.is_active_prestador()));

create policy "versoes: dono ativo apaga rascunho"
  on public.proposta_versoes for delete to authenticated
  using ((select public.eh_dono_da_proposta(proposta_id)) and (select public.is_active_prestador()));

-- -----------------------------------------------------------------------------
-- aceites e auditoria — o dono só LÊ. Gravação só pelo servidor (service_role).
-- -----------------------------------------------------------------------------
create policy "aceites: dono da proposta vê"
  on public.aceites for select to authenticated
  using (
    exists (
      select 1 from public.proposta_versoes pv
      where pv.id = versao_id and (select public.eh_dono_da_proposta(pv.proposta_id))
    )
  );

create policy "auditoria: dono da proposta vê"
  on public.auditoria_eventos for select to authenticated
  using ((select public.eh_dono_da_proposta(proposta_id)));

-- otp_codigos: RLS ligado e nenhuma política → inacessível pela API.

-- -----------------------------------------------------------------------------
-- View com o status "efetivo": 'expirada' calculada na leitura (decisão aprovada).
-- security_invoker = true → a view respeita o RLS de quem consulta.
-- -----------------------------------------------------------------------------
create view public.propostas_situacao
with (security_invoker = true) as
select
  p.*,
  case
    when p.status in ('enviada', 'visualizada') and p.validade_em < now()
      then 'expirada'::public.proposta_status
    else p.status
  end as status_efetivo
from public.propostas p;

revoke all on public.propostas_situacao from anon;
grant select on public.propostas_situacao to authenticated;

-- -----------------------------------------------------------------------------
-- Painel do admin: lista de prestadores com contagens, SEM expor o conteúdo das propostas.
-- SECURITY DEFINER para contar além do RLS, mas a primeira coisa que faz é exigir admin.
-- -----------------------------------------------------------------------------
create function public.admin_resumo_prestadores()
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
  if not public.is_admin() then
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

revoke execute on function public.admin_resumo_prestadores() from anon, public;
grant execute on function public.admin_resumo_prestadores() to authenticated;
