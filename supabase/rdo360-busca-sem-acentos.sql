-- RDO360 - Autocompletar: a busca passa a ignorar acentos ("execucao" encontra "Execução").
-- Rode uma vez no SQL Editor do Supabase. Pode ser repetido sem efeito colateral. Não altera dados.
-- Mantém os mesmos parâmetros e as mesmas regras de acesso da função atual; o site não precisa mudar.
begin;

create extension if not exists unaccent with schema extensions;

create or replace function public.sugestoes_atividades(p_frente uuid, p_busca text default '', p_limite integer default 10)
returns table(descricao text, ultima_vez date)
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.descricao, max(r.data) as ultima_vez
    from public.atividades a
    join public.rdos r on r.id = a.rdo_id
   where public.is_active()
     and a.frente_id = p_frente
     and extensions.unaccent('extensions.unaccent'::regdictionary, a.descricao)
         ilike '%' || extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_busca, '')) || '%'
   group by a.descricao
   order by max(r.data) desc
   limit least(coalesce(p_limite, 10), 30)
$$;

commit;
