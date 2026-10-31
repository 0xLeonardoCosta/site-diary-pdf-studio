import { supabase } from '@/integrations/supabase/client';
import type { TablesUpdate } from '@/integrations/supabase/types';
import type { FrenteBanco, ObraBanco, RdoBanco } from './queries';
import { normalizarFuncao, textoParaNumero } from './rules';
import { enviarFoto, inserirLinha } from './salvar';

export type Rascunho = {
  obra?: string; cliente?: string; endereco?: string; contrato?: string; responsavel?: string; inicio?: string; prazo?: string;
  clima?: Record<string, string>; pluvio?: Record<string, string>; mareHora?: string; mareNivel?: string; horario?: string;
  equipamentos?: { a?: string; b?: string }[]; atividades?: { a?: string; local?: string }[];
  ocorrencias?: string; seguranca?: string; fotos?: { src?: string; legenda?: string }[]; fotosNoPdf?: boolean;
  assResp?: string; assFiscal?: string;
};

const preenchido = (texto?: string) => Boolean(texto?.trim());
const numero = (texto?: string) => { try { return textoParaNumero(texto ?? ''); } catch { return null; } };
const sohPadrao = (r: Rascunho) => (r.equipamentos ?? []).every(x => !preenchido(x.a) || (x.a === 'Betoneira 400L' && x.b === '1'));

/** Every visited day stored a draft holding only the form's defaults; those carry nothing worth importing. */
export function lerRascunho(json: string | null): Rascunho | null {
  if (!json) return null;
  let r: Rascunho;
  try { r = JSON.parse(json) as Rascunho; } catch { return null; }
  const textos = [r.obra, r.cliente, r.endereco, r.contrato, r.responsavel, r.inicio, r.prazo, r.mareHora, r.mareNivel, r.ocorrencias, r.seguranca, r.assResp, r.assFiscal, ...Object.values(r.pluvio ?? {}), ...(r.atividades ?? []).map(x => x.a)];
  const climaAlterado = Object.values(r.clima ?? {}).some(c => c !== 'Bom');
  return textos.some(preenchido) || climaAlterado || Boolean(r.fotos?.length) || !sohPadrao(r) ? r : null;
}

/** Only fills what is still empty in the database. Returns whatever could not be imported, to keep it in the draft. */
export async function importarRascunho(r: Rascunho, rdo: RdoBanco, obra: ObraBanco, frentes: FrenteBanco[]) {
  const resto: Rascunho = {};
  const tentar = async (acao: () => PromiseLike<unknown>, falhou: () => void) => { try { await acao(); } catch { falhou(); } };
  const atualizar = async (valores: Record<string, unknown>) => {
    const limpos = Object.fromEntries(Object.entries(valores).filter(([, v]) => v !== null && v !== undefined && v !== ''));
    if (!Object.keys(limpos).length) return;
    const { error } = await supabase.from('rdos').update(limpos as TablesUpdate<'rdos'>).eq('id', rdo.id).select('id').single();
    if (error) throw error;
  };

  const dadosObra = {
    nome: obra.nome === 'Nova obra' ? r.obra : null, cliente: obra.cliente ? null : r.cliente, endereco: obra.endereco ? null : r.endereco,
    contrato: obra.contrato ? null : r.contrato, responsavel_tecnico: obra.responsavel_tecnico ? null : r.responsavel,
    data_inicio: obra.data_inicio ? null : r.inicio, prazo_previsto: obra.prazo_previsto ? null : r.prazo,
  };
  const obraLimpa = Object.fromEntries(Object.entries(dadosObra).filter(([, v]) => v));
  if (Object.keys(obraLimpa).length) {
    await tentar(async () => {
      const { error } = await supabase.from('obra').update(obraLimpa as TablesUpdate<'obra'>).eq('id', true).select('id').single();
      if (error) throw error;
    }, () => Object.assign(resto, { obra: r.obra, cliente: r.cliente, endereco: r.endereco, contrato: r.contrato, responsavel: r.responsavel, inicio: r.inicio, prazo: r.prazo }));
  }

  const clima = r.clima ?? {};
  await tentar(() => atualizar({
    clima_manha: rdo.clima_manha ? null : clima['Manhã'], clima_tarde: rdo.clima_tarde ? null : clima['Tarde'], clima_noite: rdo.clima_noite ? null : clima['Noite anterior'] ?? clima['Noite'],
    pluv_07h: rdo.pluv_07h ?? numero(r.pluvio?.['07:00']), pluv_12h: rdo.pluv_12h ?? numero(r.pluvio?.['12:00']), pluv_17h: rdo.pluv_17h ?? numero(r.pluvio?.['17:00']),
    mare_max_hora: rdo.mare_max_hora ?? (r.mareHora ? `${r.mareHora}:00` : null), mare_max_nivel: rdo.mare_max_nivel ?? numero(r.mareNivel), horario_trabalho: r.horario,
  }), () => Object.assign(resto, { clima: r.clima, pluvio: r.pluvio, mareHora: r.mareHora, mareNivel: r.mareNivel, horario: r.horario }));
  await tentar(() => atualizar({ assinante_obra: rdo.assinante_obra ? null : r.assResp, assinante_fiscalizacao: rdo.assinante_fiscalizacao ? null : r.assFiscal }), () => Object.assign(resto, { assResp: r.assResp, assFiscal: r.assFiscal }));
  if (r.fotosNoPdf === false) await tentar(() => atualizar({ fotos_no_pdf: false }), () => { resto.fotosNoPdf = false; });

  const pendente = <K extends 'equipamentos' | 'atividades' | 'fotos'>(chave: K, item: NonNullable<Rascunho[K]>[number]) => { (resto[chave] ??= [] as never as NonNullable<Rascunho[K]>).push(item as never); };
  for (const item of (r.equipamentos ?? []).filter(x => preenchido(x.a))) {
    await tentar(() => inserirLinha('equipamentos', { rdo_id: rdo.id, descricao: (item.a ?? '').trim(), quantidade: numero(item.b) ?? 1 }), () => pendente('equipamentos', item));
  }
  for (const item of (r.atividades ?? []).filter(x => preenchido(x.a))) {
    const local = normalizarFuncao(item.local ?? '');
    const frente = local ? frentes.find(f => normalizarFuncao(f.nome).includes(local)) : undefined;
    if (!frente) { pendente('atividades', item); continue; }
    await tentar(() => inserirLinha('atividades', { rdo_id: rdo.id, frente_id: frente.id, descricao: (item.a ?? '').trim() }), () => pendente('atividades', item));
  }
  if (preenchido(r.ocorrencias)) await tentar(() => inserirLinha('anotacoes', { rdo_id: rdo.id, tipo: 'ocorrencia', texto: (r.ocorrencias ?? '').trim() }), () => { resto.ocorrencias = r.ocorrencias ?? ''; });
  if (preenchido(r.seguranca)) await tentar(() => inserirLinha('anotacoes', { rdo_id: rdo.id, tipo: 'seguranca', texto: (r.seguranca ?? '').trim() }), () => { resto.seguranca = r.seguranca ?? ''; });
  for (const [ordem, foto] of (r.fotos ?? []).entries()) {
    await tentar(async () => {
      const imagem = await (await fetch(foto.src ?? '')).blob();
      await enviarFoto(rdo.id, imagem, ordem, foto.legenda || null);
    }, () => pendente('fotos', foto));
  }
  return resto;
}
