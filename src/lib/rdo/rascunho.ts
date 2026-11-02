import { supabase } from '@/integrations/supabase/client';
import type { TablesUpdate } from '@/integrations/supabase/types';
import type { DiaRdo, FrenteBanco, ObraBanco, RdoBanco } from './queries';
import { TURNOS, COLETAS, normalizarFuncao, numeroParaTexto, textoParaNumero } from './rules';
import { enviarFoto, inserirLinha } from './salvar';

type ItemEquipamento = { a?: string; b?: string };
type ItemAtividade = { a?: string; local?: string };
type ItemFoto = { src?: string; legenda?: string };
export type Rascunho = {
  obra?: string; cliente?: string; endereco?: string; contrato?: string; responsavel?: string; inicio?: string; prazo?: string;
  clima?: Record<string, string>; pluvio?: Record<string, string>; mareHora?: string; mareNivel?: string; horario?: string;
  equipamentos?: ItemEquipamento[]; atividades?: ItemAtividade[];
  ocorrencias?: string; seguranca?: string; fotos?: ItemFoto[]; fotosNoPdf?: boolean;
  assResp?: string; assFiscal?: string;
};

// What the old form filled in by itself; it says nothing about what happened on the day.
const CLIMA_PADRAO = 'Bom';
const HORARIO_PADRAO = '07:00 às 17:00';
const ehEquipamentoPadrao = (x: ItemEquipamento) => x.a === 'Betoneira 400L' && x.b === '1';

const preenchido = (texto?: string) => Boolean(texto?.trim());
const numero = (texto?: string) => { try { return textoParaNumero(texto ?? ''); } catch { return null; } };
const norm = (texto?: string | null) => normalizarFuncao(texto ?? '').replace(/\s+/g, ' ');
const semFrente = (descricao: string, frente: string) => {
  const sufixo = ` - ${norm(frente)}`;
  const texto = norm(descricao);
  return texto.endsWith(sufixo) ? texto.slice(0, -sufixo.length) : texto;
};

/** Every visited day stored a draft holding only the form's defaults; those carry nothing worth importing. */
export function lerRascunho(json: string | null): Rascunho | null {
  if (!json) return null;
  let r: Rascunho;
  try { r = JSON.parse(json) as Rascunho; } catch { return null; }
  const textos = [r.obra, r.cliente, r.endereco, r.contrato, r.responsavel, r.inicio, r.prazo, r.mareHora, r.mareNivel, r.ocorrencias, r.seguranca, r.assResp, r.assFiscal, ...Object.values(r.pluvio ?? {}), ...(r.atividades ?? []).map(x => x.a)];
  const climaAlterado = Object.values(r.clima ?? {}).some(c => c !== CLIMA_PADRAO);
  const equipamentoReal = (r.equipamentos ?? []).some(x => preenchido(x.a) && !ehEquipamentoPadrao(x));
  return textos.some(preenchido) || climaAlterado || Boolean(r.fotos?.length) || equipamentoReal ? r : null;
}

export type Plano = {
  campos: TablesUpdate<'rdos'>;
  assinaturas: TablesUpdate<'rdos'>;
  obra: TablesUpdate<'obra'>;
  fotosForaDoPdf: boolean;
  equipamentos: { descricao: string; quantidade: number }[];
  atividades: { frente_id: string; descricao: string }[];
  anotacoes: { tipo: 'ocorrencia' | 'seguranca'; texto: string }[];
  fotos: ItemFoto[];
  semLocal: ItemAtividade[];
  /** Readable list of what importing would add. */
  novos: string[];
  /** Differs from the database and stays as the database has it. */
  diferencas: string[];
  jaExistem: number;
};
export const temConteudo = (p: Plano) => p.novos.length > 0 || p.semLocal.length > 0 || p.diferencas.length > 0;

/** Compares the draft with the day: only what the RDO does not have yet is planned, and nothing is overwritten. */
export function planejarImportacao(r: Rascunho, dia: Omit<DiaRdo, 'rdo'> & { rdo: RdoBanco }, obra: ObraBanco, frentes: FrenteBanco[]): Plano {
  const { rdo } = dia;
  const p: Plano = { campos: {}, assinaturas: {}, obra: {}, fotosForaDoPdf: false, equipamentos: [], atividades: [], anotacoes: [], fotos: [], semLocal: [], novos: [], diferencas: [], jaExistem: 0 };
  const campo = <V extends string | number>(destino: Record<string, unknown>, coluna: string, rotulo: string, novo: V | null | undefined, atual: V | null, mostrar: (v: V) => string = String) => {
    if (novo === null || novo === undefined || novo === '') return;
    if (atual === null || atual === '') { destino[coluna] = novo; p.novos.push(`${rotulo}: ${mostrar(novo)}`); }
    else if (atual === novo) p.jaExistem += 1;
    else p.diferencas.push(`${rotulo}: ${mostrar(novo)} (no RDO: ${mostrar(atual)})`);
  };

  const clima = r.clima ?? {};
  for (const t of TURNOS) {
    const valor = clima[t.rotulo] ?? (t.rotulo === 'Noite anterior' ? clima['Noite'] : undefined);
    campo(p.campos, t.coluna, `Clima (${t.rotulo})`, valor === CLIMA_PADRAO ? null : valor, rdo[t.coluna]);
  }
  for (const c of COLETAS) campo(p.campos, c.coluna, `Precipitação ${c.hora} (mm)`, numero(r.pluvio?.[c.hora]), rdo[c.coluna], n => numeroParaTexto(n));
  const hora = (h: string) => h.slice(0, 5);
  campo(p.campos, 'mare_max_hora', 'Maré, horário', r.mareHora ? `${r.mareHora}:00` : null, rdo.mare_max_hora, hora);
  campo(p.campos, 'mare_max_nivel', 'Maré, nível (m)', numero(r.mareNivel), rdo.mare_max_nivel, n => numeroParaTexto(n));
  campo(p.campos, 'horario_trabalho', 'Horário de trabalho', r.horario === HORARIO_PADRAO ? null : r.horario, rdo.horario_trabalho);
  campo(p.assinaturas, 'assinante_obra', 'Contratada', r.assResp?.trim(), rdo.assinante_obra);
  campo(p.assinaturas, 'assinante_fiscalizacao', 'Gerenciadora', r.assFiscal?.trim(), rdo.assinante_fiscalizacao);

  // Contract data now has one official place, so a day's draft only fills what is still blank there.
  const obraVazia: [keyof Rascunho, string, string | null][] = [
    ['obra', 'nome', obra.nome === 'Nova obra' ? null : obra.nome], ['cliente', 'cliente', obra.cliente], ['endereco', 'endereco', obra.endereco],
    ['contrato', 'contrato', obra.contrato], ['responsavel', 'responsavel_tecnico', obra.responsavel_tecnico], ['inicio', 'data_inicio', obra.data_inicio], ['prazo', 'prazo_previsto', obra.prazo_previsto],
  ];
  for (const [chave, coluna, atual] of obraVazia) {
    const valor = r[chave];
    if (typeof valor === 'string' && valor.trim() && !atual) { (p.obra as Record<string, unknown>)[coluna] = valor.trim(); p.novos.push(`Dados da obra: ${valor.trim()}`); }
  }

  for (const item of r.equipamentos ?? []) {
    if (!preenchido(item.a) || ehEquipamentoPadrao(item)) continue;
    const descricao = (item.a ?? '').trim();
    const quantidade = numero(item.b) ?? 1;
    const existente = dia.equipamentos.find(x => norm(x.descricao) === norm(descricao));
    if (!existente) { p.equipamentos.push({ descricao, quantidade }); p.novos.push(`Equipamento: ${descricao} (${quantidade})`); }
    else if (existente.quantidade === quantidade) p.jaExistem += 1;
    else p.diferencas.push(`Equipamento ${descricao}: ${quantidade} (no RDO: ${existente.quantidade})`);
  }
  const nomeDaFrente = (id: string) => frentes.find(f => f.id === id)?.nome ?? '';
  for (const item of r.atividades ?? []) {
    if (!preenchido(item.a)) continue;
    const descricao = (item.a ?? '').trim();
    const local = norm(item.local);
    const frente = local ? frentes.find(f => norm(f.nome).includes(local)) : undefined;
    const igual = dia.atividades.find(x => semFrente(descricao, nomeDaFrente(x.frente_id)) === norm(x.descricao) && (!frente || x.frente_id === frente.id));
    if (igual) p.jaExistem += 1;
    else if (!frente) p.semLocal.push(item);
    else { p.atividades.push({ frente_id: frente.id, descricao }); p.novos.push(`Atividade: ${descricao} (${frente.nome})`); }
  }
  for (const [tipo, texto, rotulo] of [['ocorrencia', r.ocorrencias, 'Ocorrência'], ['seguranca', r.seguranca, 'Segurança do trabalho']] as const) {
    if (!preenchido(texto)) continue;
    const limpo = (texto ?? '').trim();
    if (dia.anotacoes.some(a => a.tipo === tipo && norm(a.texto) === norm(limpo))) p.jaExistem += 1;
    else { p.anotacoes.push({ tipo, texto: limpo }); p.novos.push(`${rotulo}: ${limpo}`); }
  }
  p.fotos = (r.fotos ?? []).filter(f => preenchido(f.src));
  if (p.fotos.length) {
    p.novos.push(p.fotos.length === 1 ? '1 foto' : `${p.fotos.length} fotos`);
    if (r.fotosNoPdf === false && !dia.fotos.length && rdo.fotos_no_pdf) { p.fotosForaDoPdf = true; p.novos.push('Fotos fora do PDF'); }
  }
  return p;
}

/**
 * Applies a plan. Returns what must stay in the draft, or null when it can be cleared. Planning
 * skips what is already saved, so a retry is safe; only photos cannot be compared, so the ones
 * already sent are dropped from what remains.
 */
export async function importarPlano(r: Rascunho, p: Plano, rdoId: string): Promise<Rascunho | null> {
  let falhou = false;
  const tentar = async (acao: () => PromiseLike<unknown>) => { try { await acao(); return true; } catch { falhou = true; return false; } };
  const atualizar = async (valores: TablesUpdate<'rdos'>) => {
    if (!Object.keys(valores).length) return;
    const { error } = await supabase.from('rdos').update(valores).eq('id', rdoId).select('id').single();
    if (error) throw error;
  };
  await tentar(() => atualizar(p.campos));
  await tentar(() => atualizar(p.assinaturas));
  if (p.fotosForaDoPdf) await tentar(() => atualizar({ fotos_no_pdf: false }));
  if (Object.keys(p.obra).length) {
    await tentar(async () => {
      const { error } = await supabase.from('obra').update(p.obra).eq('id', true).select('id').single();
      if (error) throw error;
    });
  }
  for (const e of p.equipamentos) await tentar(() => inserirLinha('equipamentos', { rdo_id: rdoId, ...e }));
  for (const a of p.atividades) await tentar(() => inserirLinha('atividades', { rdo_id: rdoId, ...a }));
  for (const a of p.anotacoes) await tentar(() => inserirLinha('anotacoes', { rdo_id: rdoId, ...a }));
  const fotosComFalha: ItemFoto[] = [];
  for (const [ordem, foto] of p.fotos.entries()) {
    const ok = await tentar(async () => {
      const imagem = await (await fetch(foto.src ?? '')).blob();
      await enviarFoto(rdoId, imagem, ordem, foto.legenda || null);
    });
    if (!ok) fotosComFalha.push(foto);
  }
  if (falhou) return { ...r, fotos: fotosComFalha };
  return p.semLocal.length ? { atividades: p.semLocal } : null;
}
