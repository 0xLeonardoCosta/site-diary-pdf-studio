-- RDO360 - Etapas 1 a 3: persistência completa, tempo real e proteção de campos.
-- Rode uma vez no SQL Editor do Supabase. Pode ser repetido sem efeito colateral.
-- Não apaga dados. O site publicado continua funcionando depois de rodar.
begin;

-- 1. Campos do diário que ainda não tinham lugar no banco.
alter table public.rdos
  add column if not exists horario_trabalho text default '07:00 às 17:00',
  add column if not exists fotos_no_pdf boolean not null default true;

-- 2. Mesmas permissões que o formulário já aplica a esses campos.
create or replace function public.rdos_extras_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.horario_trabalho is distinct from old.horario_trabalho and not public.has_perm('lancar_clima') then
    raise exception 'Você não tem permissão para alterar o horário de trabalho.';
  end if;
  if new.fotos_no_pdf is distinct from old.fotos_no_pdf and not public.has_perm('lancar_atividades') then
    raise exception 'Você não tem permissão para alterar as fotos do PDF.';
  end if;
  return new;
end $$;

drop trigger if exists rdos_extras_guard on public.rdos;
create trigger rdos_extras_guard
  before update on public.rdos
  for each row execute function public.rdos_extras_guard();

-- 3. Liga o Realtime nas tabelas do diário. As regras de leitura (RLS) continuam valendo.
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['obra', 'frentes', 'rdos', 'mao_obra', 'equipamentos', 'atividades', 'anotacoes', 'fotos'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- 4. Nome da frente conforme a lista definida para o RDO360.
update public.frentes set nome = 'Murutucu' where nome = 'Canal Murutucu';

commit;
