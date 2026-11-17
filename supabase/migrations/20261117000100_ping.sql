-- =============================================================================
-- Zelo · 0011 · ping() para o keep-alive (Fase 10)
--
-- O plano gratuito do Supabase pausa o projeto depois de ~7 dias sem uso. Um agendamento do
-- GitHub Actions chama esta função a cada 3 dias com a chave PÚBLICA, o que gera uma consulta
-- real no Postgres.
--
-- Por que uma função e não uma tabela? O papel `anon` não tem privilégio em nenhuma tabela
-- (decisão D20). Esta função não lê nem escreve dado algum: só devolve 'ok'. SECURITY INVOKER,
-- sem acesso a tabelas, não abre nada novo para o visitante.
-- =============================================================================

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
