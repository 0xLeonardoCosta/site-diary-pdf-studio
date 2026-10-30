import { queryOptions, infiniteQueryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { somaDias } from './rules';

export type RdoBanco = Pick<Tables<'rdos'>, 'id' | 'data' | 'numero' | 'status'>;
export type MaoObraBanco = Tables<'mao_obra'>;
export const referenciaQuery = (userId: string) => queryOptions({
  queryKey: ['rdo', userId, 'referencia'], staleTime: 60000,
  queryFn: async () => {
    const { data, error } = await supabase.from('obra').select('ref_numero, ref_data').single();
    if (error) throw error;
    return data;
  },
});
export const diaQuery = (userId: string, date: string) => queryOptions({
  queryKey: ['rdo', userId, 'dia', date],
  queryFn: async () => {
    const { data, error } = await supabase.from('rdos').select('id, data, numero, status').eq('data', date).maybeSingle();
    if (error) throw error;
    const rows: MaoObraBanco[] = [];
    if (data) {
      for (let start = 0; ; start += 1000) {
        const result = await supabase.from('mao_obra').select('*').eq('rdo_id', data.id).order('created_at').order('id').range(start, start + 999);
        if (result.error) throw result.error;
        rows.push(...result.data);
        if (result.data.length < 1000) break;
      }
    }
    return { rdo: data, maoObra: rows };
  },
});
export const TAMANHO_PAGINA = 30;
export const historicoQuery = (userId: string, mes: string) => infiniteQueryOptions({
  queryKey: ['rdo', userId, 'historico', mes], initialPageParam: 0,
  queryFn: async ({ pageParam }) => {
    let query = supabase.from('rdos').select('id, data, numero, status').order('data', { ascending: false });
    if (mes) {
      const inicio = `${mes}-01`;
      const fim = somaDias(inicio, 32).slice(0, 7) + '-01';
      query = query.gte('data', inicio).lt('data', fim);
    }
    const { data, error } = await query.range(pageParam, pageParam + TAMANHO_PAGINA - 1);
    if (error) throw error;
    const ids = data.map(r => r.id);
    const totais: Record<string, number> = {};
    if (ids.length) {
      const mao = await supabase.from('mao_obra').select('rdo_id, quantidade', { count: 'exact' }).in('rdo_id', ids);
      if (mao.error) throw mao.error;
      // The API caps responses: do not display a silently truncated total.
      if (mao.count !== null && mao.count > mao.data.length) throw new Error('O efetivo deste lote excedeu o limite de consulta. Selecione um mês com menos registros.');
      for (const row of mao.data) totais[row.rdo_id] = (totais[row.rdo_id] ?? 0) + row.quantidade;
    }
    return { rows: data.map(r => ({ ...r, total: totais[r.id] ?? 0 })), next: data.length === TAMANHO_PAGINA ? pageParam + TAMANHO_PAGINA : undefined };
  },
  getNextPageParam: page => page.next,
});

// Database trigger supplies numero. The generated table type predates this contract.
export async function criarRdo(data: string) {
  const { data: row, error } = await supabase.from('rdos').insert({ data } as Tables<'rdos'>).select('id, data, numero, status').single();
  if (error) throw error;
  return row;
}
export async function moverRdo(id: string, data: string) {
  const result = await supabase.from('rdos').update({ data }).eq('id', id).select('id, data, numero, status').single();
  if (result.error) throw result.error;
  return result.data;
}