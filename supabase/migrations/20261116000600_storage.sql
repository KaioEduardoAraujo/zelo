-- Buckets privados: download só por URL assinada. A primeira pasta do caminho identifica o dono.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('comprovantes', 'comprovantes', false, 5 * 1024 * 1024, array['application/pdf']),
  ('entregas', 'entregas', false, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "comprovantes: prestador lê os seus"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Sem update/delete: foto anexada é prova.
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
