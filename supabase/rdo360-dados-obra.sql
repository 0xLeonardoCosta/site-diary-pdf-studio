-- RDO360 - Aba Dados: novos campos da obra e logo da contratada.
-- Rode uma vez no SQL Editor do Supabase. Pode ser repetido sem efeito colateral. Não apaga dados.
-- O site publicado continua funcionando depois de rodar.
begin;

alter table public.obra
  add column if not exists fiscalizacao text,
  add column if not exists gerenciadora text,
  add column if not exists logo_path text;

-- Valores que já constam nos RDOs da obra. Só preenche o que está vazio; tudo pode ser alterado na aba Dados.
update public.obra set
  fiscalizacao = coalesce(fiscalizacao, 'SECRETARIA DE OBRAS PÚBLICAS - SEOP/PA'),
  gerenciadora = coalesce(gerenciadora, 'CONSÓRCIO INFRA COP 30'),
  responsavel_tecnico = coalesce(responsavel_tecnico, 'CONSÓRCIO CANAL MURUTUCU');

-- Logo em bucket próprio e privado: o bucket de fotos exige que a pasta seja o id de um RDO.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('obra-logos', 'obra-logos', false, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists obra_logos_select on storage.objects;
create policy obra_logos_select on storage.objects for select
  using (bucket_id = 'obra-logos' and public.is_active());

drop policy if exists obra_logos_insert on storage.objects;
create policy obra_logos_insert on storage.objects for insert
  with check (bucket_id = 'obra-logos' and public.has_perm('editar_obra'));

drop policy if exists obra_logos_delete on storage.objects;
create policy obra_logos_delete on storage.objects for delete
  using (bucket_id = 'obra-logos' and public.has_perm('editar_obra'));

commit;
