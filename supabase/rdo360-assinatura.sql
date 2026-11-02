-- RDO360 - Assinatura da contratada nos RDOs e permissão "Alterar RDOs assinados".
-- Rode uma vez no SQL Editor do Supabase. Pode ser repetido sem efeito colateral. Não apaga dados.
-- O site publicado continua funcionando depois de rodar.
begin;

-- Só o administrador cadastra a assinatura e concede a permissão (regra já existente em profiles).
alter table public.profiles
  add column if not exists assinatura_path text,
  add column if not exists alterar_assinados boolean not null default false;

-- Cópia do nome e da imagem no momento da assinatura: trocar a assinatura depois não altera RDOs antigos.
alter table public.rdos
  add column if not exists assinado_por uuid references public.profiles(id),
  add column if not exists assinado_nome text,
  add column if not exists assinado_em timestamptz,
  add column if not exists assinatura_path text;

-- Bucket privado. Arquivos antigos ficam guardados porque RDOs já assinados continuam usando-os.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assinaturas', 'assinaturas', false, 2097152, array['image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists assinaturas_select on storage.objects;
create policy assinaturas_select on storage.objects for select
  using (bucket_id = 'assinaturas' and public.is_active());

drop policy if exists assinaturas_insert on storage.objects;
create policy assinaturas_insert on storage.objects for insert
  with check (bucket_id = 'assinaturas' and public.is_admin());

-- A assinatura só muda pelas funções abaixo, nunca por uma alteração direta no RDO.
create or replace function public.rdos_assinatura_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(current_setting('app.assinando', true), '') = '1' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.assinado_por is not null or new.assinado_nome is not null or new.assinado_em is not null or new.assinatura_path is not null then
      raise exception 'A assinatura só pode ser feita pelo botão Assinar.';
    end if;
  elsif row(new.assinado_por, new.assinado_nome, new.assinado_em, new.assinatura_path)
        is distinct from row(old.assinado_por, old.assinado_nome, old.assinado_em, old.assinatura_path) then
    raise exception 'A assinatura só pode ser alterada pelo botão Assinar.';
  end if;
  return new;
end $$;

drop trigger if exists rdos_assinatura_guard on public.rdos;
create trigger rdos_assinatura_guard
  before insert or update on public.rdos
  for each row execute function public.rdos_assinatura_guard();

-- RDO assinado só pode ser alterado por quem tem a permissão; os demais seguem a regra de aberto/fechado.
create or replace function public.rdo_editavel(p_rdo uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select case when r.assinado_em is not null then public.has_perm('alterar_assinados')
                 else r.status = 'aberto' or public.has_perm('fechar_reabrir') end
       from public.rdos r where r.id = p_rdo),
    false)
$$;

create or replace function public.assinar_rdo(p_rdo uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_perfil public.profiles;
  v_assinado text;
begin
  select * into v_perfil from public.profiles where id = auth.uid();
  if v_perfil.id is null or not v_perfil.ativo then
    raise exception 'Não autorizado.';
  end if;
  if v_perfil.assinatura_path is null then
    raise exception 'Sua assinatura ainda não foi cadastrada. Fale com o administrador.';
  end if;
  if not public.can_see_rdo(p_rdo) then
    raise exception 'Você não tem acesso a este RDO.';
  end if;
  select assinado_nome into v_assinado from public.rdos where id = p_rdo and assinado_em is not null for update;
  if v_assinado is not null then
    raise exception 'Este RDO já foi assinado por %.', v_assinado;
  end if;
  perform set_config('app.assinando', '1', true);
  update public.rdos
     set assinado_por = v_perfil.id, assinado_nome = v_perfil.nome, assinado_em = now(), assinatura_path = v_perfil.assinatura_path
   where id = p_rdo;
  perform set_config('app.assinando', '0', true);
end $$;

-- Só quem assinou ou um administrador pode remover.
create or replace function public.remover_assinatura_rdo(p_rdo uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_assinante uuid;
begin
  select assinado_por into v_assinante from public.rdos where id = p_rdo;
  if not public.is_active() or not (public.is_admin() or v_assinante = auth.uid()) then
    raise exception 'Só quem assinou ou um administrador pode remover a assinatura.';
  end if;
  perform set_config('app.assinando', '1', true);
  update public.rdos
     set assinado_por = null, assinado_nome = null, assinado_em = null, assinatura_path = null
   where id = p_rdo;
  perform set_config('app.assinando', '0', true);
end $$;

revoke execute on function public.assinar_rdo(uuid) from public;
revoke execute on function public.remover_assinatura_rdo(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.assinar_rdo(uuid) to authenticated;
    grant execute on function public.remover_assinatura_rdo(uuid) to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.assinar_rdo(uuid) from anon;
    revoke execute on function public.remover_assinatura_rdo(uuid) from anon;
  end if;
end $$;

commit;
