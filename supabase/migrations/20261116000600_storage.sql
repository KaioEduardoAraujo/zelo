-- =============================================================================
-- Zelo · 0006 · Storage privado
-- Buckets privados (public = false): nada é acessível por URL direta. O download é feito
-- por URL assinada de curta duração, gerada no servidor depois de checar a permissão.
-- Convenção de caminho: <prestador_id>/<...>. A 1ª pasta identifica o dono.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('comprovantes', 'comprovantes', false, 5 * 1024 * 1024, array['application/pdf']),
  ('entregas', 'entregas', false, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Comprovantes: o servidor gera e grava (service_role). O prestador só lê os seus.
create policy "comprovantes: prestador lê os seus"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Fotos de entrega: o prestador ativo envia e lê as suas (Fase 8). Sem update/delete:
-- foto anexada a um aceite de entrega é prova e não deve sumir.
create policy "entregas: prestador ativo envia as suas"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'entregas'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_active_prestador())
  );

create policy "entregas: prestador lê as suas"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'entregas'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
