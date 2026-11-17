-- Keep-alive do plano gratuito (GitHub Actions a cada 3 dias, com a chave pública). Não toca
-- em nenhuma tabela.

create function public.ping()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select 'ok'::text;
$$;

comment on function public.ping() is 'Keep-alive do plano gratuito: devolve ok, sem tocar em dados.';

revoke execute on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated, service_role;
