-- RDO360 - Gráficos rápidos: o efetivo de cada dia passa a ser somado no próprio banco.
-- Antes, o site baixava todas as linhas de mão de obra (dezenas de milhares) para somar no navegador.
-- Rode uma vez no SQL Editor do Supabase. Pode ser repetido sem efeito colateral. Não altera dados.
-- A função roda com o login de quem abre o site (security invoker): as regras de acesso de sempre
-- continuam valendo, e cada usuário só soma os RDOs que já pode ver.
begin;

-- Um item por RDO, em ordem de data: [data, indireto, direto, terceirizado].
create or replace function public.efetivo_diario()
returns json
language sql
stable
security invoker
set search_path to 'public'
as $$
  select coalesce(json_agg(json_build_array(r.data, coalesce(m.indireto, 0), coalesce(m.direto, 0), coalesce(m.terceirizado, 0)) order by r.data), '[]'::json)
    from public.rdos r
    left join (
      select rdo_id,
             sum(quantidade) filter (where categoria = 'indireto') as indireto,
             sum(quantidade) filter (where categoria = 'direto') as direto,
             sum(quantidade) filter (where categoria = 'terceirizado') as terceirizado
        from public.mao_obra
       group by rdo_id
    ) m on m.rdo_id = r.id
$$;

revoke all on function public.efetivo_diario() from public, anon;
grant execute on function public.efetivo_diario() to authenticated;

commit;

-- Avisa o site (PostgREST) que existe uma função nova.
notify pgrst, 'reload schema';
