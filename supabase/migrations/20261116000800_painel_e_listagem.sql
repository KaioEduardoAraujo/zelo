-- SECURITY INVOKER: o RLS vale e cada prestador só soma as próprias propostas.

-- O jsonb é escrito pelo prestador: só lê o valor se for número, para não quebrar a listagem.
create or replace view public.propostas_situacao
with (security_invoker = true) as
select
  p.*,
  case
    when p.status in ('enviada', 'visualizada') and p.validade_em < now()
      then 'expirada'::public.proposta_status
    else p.status
  end as status_efetivo,
  (
    select case
      when jsonb_typeof(pv.conteudo -> 'valor_total_centavos') = 'number'
        then (pv.conteudo ->> 'valor_total_centavos')::numeric
    end
    from public.proposta_versoes pv
    where pv.proposta_id = p.id and pv.numero = p.versao_atual
  ) as valor_total_centavos
from public.propostas p;

revoke all on public.propostas_situacao from anon;
grant select on public.propostas_situacao to authenticated;

create function public.resumo_painel()
returns table (
  aguardando bigint,
  aceitas_mes bigint,
  valor_aceito_mes_centavos numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with aceitas as (
    select pv.conteudo
    from public.aceites a
    join public.proposta_versoes pv on pv.id = a.versao_id
    join public.propostas p on p.id = pv.proposta_id
    where a.resultado = 'aceito'
      and p.tipo in ('proposta', 'aditivo')
      and a.criado_em >= (
        date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
      )
  )
  select
    (
      select count(*)
      from public.propostas p
      where p.status in ('enviada', 'visualizada') and p.validade_em >= now()
    ),
    (select count(*) from aceitas),
    coalesce(
      (
        select sum(
          case
            when jsonb_typeof(conteudo -> 'valor_total_centavos') = 'number'
              then (conteudo ->> 'valor_total_centavos')::numeric
            else 0
          end
        )
        from aceitas
      ),
      0
    );
$$;

revoke execute on function public.resumo_painel() from anon, public;
grant execute on function public.resumo_painel() to authenticated;
