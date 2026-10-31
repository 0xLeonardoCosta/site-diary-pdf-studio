import { queryOptions, infiniteQueryOptions, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { somaDias } from './rules';
import { BUCKET_FOTOS } from './salvar';

export type RdoBanco = Tables<'rdos'>;
export type MaoObraBanco = Tables<'mao_obra'>;
export type EquipamentoBanco = Tables<'equipamentos'>;
export type AtividadeBanco = Tables<'atividades'>;
export type AnotacaoBanco = Tables<'anotacoes'>;
export type FotoBanco = Tables<'fotos'>;
export type ObraBanco = Tables<'obra'>;
export type FrenteBanco = Tables<'frentes'>;
export type DiaRdo = {
  rdo: RdoBanco | null;
  maoObra: MaoObraBanco[];
  equipamentos: EquipamentoBanco[];
  atividades: AtividadeBanco[];
  anotacoes: AnotacaoBanco[];
  fotos: FotoBanco[];
};
export const referenciaQuery = (userId: string) => queryOptions({
  queryKey: ['rdo', userId, 'referencia'], staleTime: 60000,
  queryFn: async () => {
    const { data, error } = await supabase.from('obra').select('ref_numero, ref_data').single();
    if (error) throw error;
    return data;
  },
});
export const obraQuery = (userId: string) => queryOptions({
  queryKey: ['rdo', userId, 'obra'],
  queryFn: async () => {
    const { data, error } = await supabase.from('obra').select('*').single();
    if (error) throw error;
    return data;
  },
});
export const frentesQuery = (userId: string) => queryOptions({
  queryKey: ['rdo', userId, 'frentes'],
  queryFn: async () => {
    const { data, error } = await supabase.from('frentes').select('*').eq('ativa', true).order('ordem');
    if (error) throw error;
    return data;
  },
});
export const diaQuery = (userId: string, date: string) => queryOptions({
  queryKey: ['rdo', userId, 'dia', date],
  queryFn: async (): Promise<DiaRdo> => {
    const { data, error } = await supabase.from('rdos').select('*').eq('data', date).maybeSingle();
    if (error) throw error;
    if (!data) return { rdo: null, maoObra: [], equipamentos: [], atividades: [], anotacoes: [], fotos: [] };
    const rows: MaoObraBanco[] = [];
    for (let start = 0; ; start += 1000) {
      const result = await supabase.from('mao_obra').select('*').eq('rdo_id', data.id).order('created_at').order('id').range(start, start + 999);
      if (result.error) throw result.error;
      rows.push(...result.data);
      if (result.data.length < 1000) break;
    }
    const [equipamentos, atividades, anotacoes, fotos] = await Promise.all([
      supabase.from('equipamentos').select('*').eq('rdo_id', data.id).order('created_at').order('id'),
      supabase.from('atividades').select('*').eq('rdo_id', data.id).order('created_at').order('id'),
      supabase.from('anotacoes').select('*').eq('rdo_id', data.id).order('created_at').order('id'),
      supabase.from('fotos').select('*').eq('rdo_id', data.id).order('ordem').order('created_at'),
    ]);
    const falha = equipamentos.error ?? atividades.error ?? anotacoes.error ?? fotos.error;
    if (falha) throw falha;
    return { rdo: data, maoObra: rows, equipamentos: equipamentos.data ?? [], atividades: atividades.data ?? [], anotacoes: anotacoes.data ?? [], fotos: fotos.data ?? [] };
  },
});
export const fotosUrlsQuery = (userId: string, caminhos: string[]) => queryOptions({
  queryKey: ['rdo', userId, 'fotos-url', caminhos],
  enabled: caminhos.length > 0,
  staleTime: 30 * 60000,
  // Adding a photo changes the key; keep the images already on screen meanwhile.
  placeholderData: previous => previous,
  queryFn: async () => {
    const { data, error } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrls(caminhos, 3600);
    if (error) throw error;
    return Object.fromEntries(data.flatMap(item => (item.path && item.signedUrl ? [[item.path, item.signedUrl]] : []))) as Record<string, string>;
  },
});
export function alterarDia(client: QueryClient, userId: string, date: string, alterar: (dia: DiaRdo) => DiaRdo) {
  client.setQueryData(diaQuery(userId, date).queryKey, old => (old ? alterar(old) : old));
}
// A realtime re-read may already have delivered the row this client just wrote.
export const comLinha = <T extends { id: string }>(linhas: T[], linha: T) =>
  (linhas.some(x => x.id === linha.id) ? linhas.map(x => (x.id === linha.id ? linha : x)) : [...linhas, linha]);

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
  const { data: row, error } = await supabase.from('rdos').insert({ data } as Tables<'rdos'>).select('*').single();
  if (error) throw error;
  return row;
}
export async function moverRdo(id: string, data: string) {
  const result = await supabase.from('rdos').update({ data }).eq('id', id).select('*').single();
  if (result.error) throw result.error;
  return result.data;
}
