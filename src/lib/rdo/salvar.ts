import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export class ConflitoEdicao extends Error {
  constructor() { super('Outra pessoa alterou este dado. A tela foi atualizada com a versão mais recente.'); }
}
export class SemPermissao extends Error {
  constructor() { super('Você não tem permissão para alterar este dado, ou o RDO está fechado.'); }
}

type Valor = string | number | boolean | null;
export type TabelaLinha = 'mao_obra' | 'equipamentos' | 'atividades' | 'anotacoes' | 'fotos';
export const BUCKET_FOTOS = 'rdo-fotos';
export const BUCKET_LOGOS = 'obra-logos';
export const BUCKET_ASSINATURAS = 'assinaturas';

// Compare-and-set per field: edits to different fields never collide, and a stale edit to the same field is refused.
// An update hidden by RLS also returns no row, so the current value tells a conflict apart from a denial.
export async function salvarCampo(tabela: 'rdos' | 'obra', id: string | boolean, campo: string, base: Valor, valor: Valor) {
  const nome = tabela as 'rdos';
  const coluna = campo as 'status';
  const alvo = supabase.from(nome).update({ [campo]: valor } as TablesUpdate<'rdos'>).eq('id', id as string);
  const { data, error } = await (base === null ? alvo.is(coluna, null) : alvo.eq(coluna, base as string)).select('id').maybeSingle();
  if (error) throw error;
  if (data) return;
  const atual = await supabase.from(nome).select(campo as '*').eq('id', id as string).maybeSingle();
  const linha = atual.data as unknown as Record<string, unknown> | null;
  if (linha && String(linha[campo] ?? '') !== String(base ?? '')) throw new ConflitoEdicao();
  throw new SemPermissao();
}

// Rows keep the last updated_at the user saw; the trigger bumps it on every write.
export async function salvarLinha<T extends TabelaLinha>(tabela: T, id: string, atualizadoEm: string | null, valores: TablesUpdate<T>) {
  const nome = tabela as 'equipamentos';
  const alvo = supabase.from(nome).update(valores as TablesUpdate<'equipamentos'>).eq('id', id);
  const { data, error } = await (atualizadoEm === null ? alvo.is('updated_at', null) : alvo.eq('updated_at', atualizadoEm)).select('*').maybeSingle();
  if (error) throw error;
  if (data) return data as unknown as Tables<T>;
  const atual = await supabase.from(nome).select('updated_at').eq('id', id).maybeSingle();
  if (!atual.data || atual.data.updated_at !== atualizadoEm) throw new ConflitoEdicao();
  throw new SemPermissao();
}

export async function inserirLinha<T extends TabelaLinha>(tabela: T, valores: TablesInsert<T>) {
  const { data, error } = await supabase.from(tabela as 'equipamentos').insert(valores as TablesInsert<'equipamentos'>).select('*').single();
  if (error) throw error;
  return data as unknown as Tables<T>;
}

export async function excluirLinha(tabela: TabelaLinha, id: string) {
  const { data, error } = await supabase.from(tabela as 'equipamentos').delete().eq('id', id).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new SemPermissao();
}

// Uploaded before its row exists, so nobody receives a row whose image is still missing.
export async function enviarFoto(rdoId: string, imagem: Blob, ordem: number, legenda: string | null = null) {
  const id = crypto.randomUUID();
  const storage_path = `${rdoId}/${id}.jpg`;
  const envio = await supabase.storage.from(BUCKET_FOTOS).upload(storage_path, imagem, { contentType: 'image/jpeg' });
  if (envio.error) throw envio.error;
  return inserirLinha('fotos', { id, rdo_id: rdoId, storage_path, ordem, legenda });
}

// The storage policy looks the photo row up, so the file has to go first.
export async function excluirFoto(foto: Pick<Tables<'fotos'>, 'id' | 'storage_path'>) {
  const remocao = await supabase.storage.from(BUCKET_FOTOS).remove([foto.storage_path]);
  if (remocao.error) throw remocao.error;
  await excluirLinha('fotos', foto.id);
}

// Signing happens only through these database functions, which check the signer and copy their name and image.
export async function assinarRdo(rdoId: string) {
  const { error } = await supabase.rpc('assinar_rdo', { p_rdo: rdoId });
  if (error) throw error;
}
export async function removerAssinaturaRdo(rdoId: string) {
  const { error } = await supabase.rpc('remover_assinatura_rdo', { p_rdo: rdoId });
  if (error) throw error;
}

const LOTE = 100;
const emLotes = <T,>(lista: T[]) => Array.from({ length: Math.ceil(lista.length / LOTE) }, (_, i) => lista.slice(i * LOTE, (i + 1) * LOTE));
export type ResumoExclusao = { rdos: { id: string; numero: number; data: string; assinado_nome: string | null }[]; caminhos: string[] };
// In batches: a long id list would not fit in one request's URL.
export async function resumoExclusao(ids: string[]): Promise<ResumoExclusao> {
  const resumo: ResumoExclusao = { rdos: [], caminhos: [] };
  for (const lote of emLotes(ids)) {
    const [rdos, fotos] = await Promise.all([
      supabase.from('rdos').select('id, numero, data, assinado_nome').in('id', lote),
      supabase.from('fotos').select('storage_path').in('rdo_id', lote),
    ]);
    if (rdos.error) throw rdos.error;
    if (fotos.error) throw fotos.error;
    resumo.rdos.push(...rdos.data);
    resumo.caminhos.push(...fotos.data.map(f => f.storage_path));
  }
  resumo.rdos.sort((a, b) => a.data.localeCompare(b.data));
  return resumo;
}
// Files first: the storage policy looks up the photo row, which the database function removes.
export async function excluirRdos(ids: string[], caminhos: string[]) {
  for (const lote of emLotes(caminhos)) {
    const remocao = await supabase.storage.from(BUCKET_FOTOS).remove(lote);
    if (remocao.error) throw remocao.error;
  }
  const { data, error } = await supabase.rpc('excluir_rdos', { p_ids: ids });
  if (error) throw error;
  return data;
}
