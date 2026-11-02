-- RDO360 - Exclusão de RDOs pelo Histórico.
-- Rode uma vez no SQL Editor do Supabase. Pode ser repetido sem efeito colateral.
-- Este arquivo não apaga nenhum RDO: só cria a função usada pelo botão "Excluir RDO's".
begin;

-- Apaga o RDO e seus lançamentos de uma vez. Mantém a regra atual: só administrador exclui RDO.
-- Cada linha apagada fica copiada na tabela historico, pelo gatilho de auditoria já existente.
create or replace function public.excluir_rdos(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_total integer;
begin
  if not public.is_admin() then
    raise exception 'Só um administrador pode excluir RDOs.';
  end if;
  delete from public.mao_obra where rdo_id = any(p_ids);
  delete from public.equipamentos where rdo_id = any(p_ids);
  delete from public.atividades where rdo_id = any(p_ids);
  delete from public.anotacoes where rdo_id = any(p_ids);
  delete from public.fotos where rdo_id = any(p_ids);
  delete from public.rdos where id = any(p_ids);
  get diagnostics v_total = row_count;
  return v_total;
end $$;

revoke execute on function public.excluir_rdos(uuid[]) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.excluir_rdos(uuid[]) to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.excluir_rdos(uuid[]) from anon;
  end if;
end $$;

commit;
