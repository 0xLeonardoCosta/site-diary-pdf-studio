import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth, usePermissao } from '@/components/auth-context';
import { Button } from '@/components/ui/button';
import { useCampo } from '@/hooks/use-campo';
import { alterarDia, comLinha, type AnotacaoBanco, type AtividadeBanco, type EquipamentoBanco, type FotoBanco, type FrenteBanco } from '@/lib/rdo/queries';
import { mensagemErro, ordenarPorFrente, podeEditarLinha, quantidadeValida } from '@/lib/rdo/rules';
import { enviarFoto, excluirFoto, excluirLinha, inserirLinha, salvarLinha } from '@/lib/rdo/salvar';
import { iniciarEnvio, terminarEnvio } from '@/lib/rdo/sincronia';

type Contexto = { rdoId: string; userId: string; date: string };
type Lista = 'equipamentos' | 'atividades' | 'anotacoes' | 'fotos';

function useLinhas({ userId, date }: Contexto) {
  const client = useQueryClient();
  const gravar = <T extends { id: string }>(tabela: Lista, linha: T) =>
    alterarDia(client, userId, date, dia => ({ ...dia, [tabela]: comLinha(dia[tabela] as unknown as T[], linha) }));
  const retirar = (tabela: Lista, id: string) =>
    alterarDia(client, userId, date, dia => ({ ...dia, [tabela]: (dia[tabela] as { id: string }[]).filter(x => x.id !== id) }));
  // Reports through the shared status so "Exportar PDF" waits for the write.
  async function executar(acao: () => Promise<void>) {
    iniciarEnvio();
    try { await acao(); terminarEnvio(true); return true; }
    catch (error) {
      terminarEnvio(false);
      toast.error(mensagemErro(error));
      void client.invalidateQueries({ queryKey: ['rdo'] });
      return false;
    }
  }
  return { gravar, retirar, executar };
}
function useDonoDaLinha(criadoPor: string) {
  const { perfil } = useAuth();
  const editarDeOutros = usePermissao('editar_de_outros');
  return podeEditarLinha(criadoPor, perfil?.id ?? '', editarDeOutros);
}
function Remover({ tabela, id, ctx, disabled, antes }: { tabela: Lista; id: string; ctx: Contexto; disabled: boolean; antes?: () => Promise<void> }) {
  const { retirar, executar } = useLinhas(ctx);
  return <Button disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => void executar(async () => { await (antes ? antes() : excluirLinha(tabela, id)); retirar(tabela, id); })} className="w-9 shrink-0 rounded-md border text-muted-foreground hover:text-destructive" aria-label="Remover">×</Button>;
}

/* ---------- Equipamentos ---------- */
export function Equipamentos({ linhas, ctx }: { linhas: EquipamentoBanco[]; ctx: Contexto }) {
  const { gravar, executar } = useLinhas(ctx);
  const [descricao, setDescricao] = useState('');
  const [qtd, setQtd] = useState('1');
  const adicionar = () => {
    if (!descricao.trim()) { toast.error('Informe o equipamento.'); return; }
    if (!quantidadeValida(qtd)) { toast.error('Quantidade deve ser um inteiro maior ou igual a zero.'); return; }
    void executar(async () => {
      gravar('equipamentos', await inserirLinha('equipamentos', { rdo_id: ctx.rdoId, descricao: descricao.trim(), quantidade: Number(qtd) }));
      setDescricao(''); setQtd('1');
    });
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-xs font-semibold uppercase text-muted-foreground"><span className="flex-1">Equipamento</span><span className="w-24">Qtd.</span><span className="w-9" /></div>
      {linhas.map(x => <LinhaEquipamento key={x.id} linha={x} ctx={ctx} />)}
      <div className="flex gap-2">
        <input aria-label="Novo equipamento" className="field min-w-0 flex-1" placeholder="Novo equipamento" value={descricao} onChange={e => setDescricao(e.target.value)} />
        <input aria-label="Quantidade do novo equipamento" className="field w-24" inputMode="numeric" value={qtd} onChange={e => setQtd(e.target.value)} />
        <span className="w-9 shrink-0" />
      </div>
      <Button onClick={adicionar} className="text-sm font-semibold text-accent-foreground hover:underline">+ Adicionar equipamento</Button>
    </div>
  );
}
function LinhaEquipamento({ linha, ctx }: { linha: EquipamentoBanco; ctx: Contexto }) {
  const { gravar } = useLinhas(ctx);
  const dono = useDonoDaLinha(linha.created_by);
  const instantaneo = (x: EquipamentoBanco) => ({ descricao: x.descricao, qtd: String(x.quantidade), updated_at: x.updated_at });
  const c = useCampo(instantaneo(linha), async (novo, base) => {
    if (!novo.descricao.trim()) throw new Error('Informe o equipamento.');
    if (!quantidadeValida(novo.qtd)) throw new Error('Quantidade deve ser um inteiro maior ou igual a zero.');
    const salva = await salvarLinha('equipamentos', linha.id, base.updated_at, { descricao: novo.descricao.trim(), quantidade: Number(novo.qtd) });
    gravar('equipamentos', salva);
    return instantaneo(salva);
  }, { pronto: v => Boolean(v.descricao.trim()) && quantidadeValida(v.qtd) });
  return (
    <div className="flex gap-2">
      <input aria-label="Equipamento" disabled={!dono} className="field min-w-0 flex-1" value={c.valor.descricao} onChange={e => c.alterar({ ...c.valor, descricao: e.target.value })} onBlur={() => void c.confirmar()} />
      <input aria-label={`Quantidade ${c.valor.descricao}`} disabled={!dono} className="field w-24" inputMode="numeric" value={c.valor.qtd} onChange={e => c.alterar({ ...c.valor, qtd: e.target.value })} onBlur={() => void c.confirmar()} />
      <Remover tabela="equipamentos" id={linha.id} ctx={ctx} disabled={!dono} />
    </div>
  );
}

/* ---------- Atividades ---------- */
export function Atividades({ linhas, frentes, ctx }: { linhas: AtividadeBanco[]; frentes: FrenteBanco[]; ctx: Contexto }) {
  const { gravar, executar } = useLinhas(ctx);
  const [descricao, setDescricao] = useState('');
  const [frente, setFrente] = useState('');
  const adicionar = () => {
    if (!frente) { toast.error('Selecione o local do serviço.'); return; }
    if (!descricao.trim()) { toast.error('Informe a descrição do serviço.'); return; }
    void executar(async () => {
      gravar('atividades', await inserirLinha('atividades', { rdo_id: ctx.rdoId, frente_id: frente, descricao: descricao.trim() }));
      setDescricao('');
    });
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-xs font-semibold uppercase text-muted-foreground"><span className="flex-1">Descrição do serviço</span><span className="w-36">Local</span><span className="w-9" /></div>
      {ordenarPorFrente(linhas, frentes).map(x => <LinhaAtividade key={x.id} linha={x} frentes={frentes} ctx={ctx} />)}
      <div className="flex gap-2">
        <input aria-label="Nova atividade" className="field min-w-0 flex-1" placeholder="Nova atividade" value={descricao} onChange={e => setDescricao(e.target.value)} />
        <SelectFrente rotulo="Local da nova atividade" frentes={frentes} valor={frente} alterar={setFrente} />
        <span className="w-9 shrink-0" />
      </div>
      <Button onClick={adicionar} className="text-sm font-semibold text-accent-foreground hover:underline">+ Adicionar atividade</Button>
    </div>
  );
}
function SelectFrente({ rotulo, frentes, valor, alterar, disabled }: { rotulo: string; frentes: FrenteBanco[]; valor: string; alterar: (v: string) => void; disabled?: boolean }) {
  return (
    <select aria-label={rotulo} disabled={disabled} className="field w-36" value={valor} onChange={e => alterar(e.target.value)}>
      <option value="" disabled>Selecione…</option>
      {frentes.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
    </select>
  );
}
function LinhaAtividade({ linha, frentes, ctx }: { linha: AtividadeBanco; frentes: FrenteBanco[]; ctx: Contexto }) {
  const { gravar } = useLinhas(ctx);
  const dono = useDonoDaLinha(linha.created_by);
  const instantaneo = (x: AtividadeBanco) => ({ descricao: x.descricao, frente_id: x.frente_id, updated_at: x.updated_at });
  const c = useCampo(instantaneo(linha), async (novo, base) => {
    if (!novo.descricao.trim()) throw new Error('Informe a descrição do serviço.');
    const salva = await salvarLinha('atividades', linha.id, base.updated_at, { descricao: novo.descricao.trim(), frente_id: novo.frente_id });
    gravar('atividades', salva);
    return instantaneo(salva);
  }, { pronto: v => Boolean(v.descricao.trim()) });
  return (
    <div className="flex gap-2">
      <input aria-label="Descrição do serviço" disabled={!dono} className="field min-w-0 flex-1" value={c.valor.descricao} onChange={e => c.alterar({ ...c.valor, descricao: e.target.value })} onBlur={() => void c.confirmar()} />
      <SelectFrente rotulo="Local do serviço" disabled={!dono} frentes={frentes} valor={c.valor.frente_id} alterar={frente_id => c.alterar({ ...c.valor, frente_id })} />
      <Remover tabela="atividades" id={linha.id} ctx={ctx} disabled={!dono} />
    </div>
  );
}

/* ---------- Ocorrências e segurança ---------- */
// One row per entry: the database only lets each author edit their own, so nobody overwrites a colleague's text.
export function Anotacoes({ tipo, rotulo, placeholder, linhas, ctx }: { tipo: 'ocorrencia' | 'seguranca'; rotulo: string; placeholder: string; linhas: AnotacaoBanco[]; ctx: Contexto }) {
  const { gravar, executar } = useLinhas(ctx);
  const [texto, setTexto] = useState('');
  const adicionar = () => {
    if (!texto.trim()) { toast.error('Escreva o texto antes de adicionar.'); return; }
    void executar(async () => {
      gravar('anotacoes', await inserirLinha('anotacoes', { rdo_id: ctx.rdoId, tipo, texto: texto.trim() }));
      setTexto('');
    });
  };
  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</span>
      {linhas.filter(x => x.tipo === tipo).map(x => <LinhaAnotacao key={x.id} linha={x} rotulo={rotulo} ctx={ctx} />)}
      <textarea aria-label={`Nova anotação: ${rotulo}`} rows={2} className="field" placeholder={placeholder} value={texto} onChange={e => setTexto(e.target.value)} />
      <Button onClick={adicionar} className="text-sm font-semibold text-accent-foreground hover:underline">+ Adicionar</Button>
    </div>
  );
}
function LinhaAnotacao({ linha, rotulo, ctx }: { linha: AnotacaoBanco; rotulo: string; ctx: Contexto }) {
  const { gravar } = useLinhas(ctx);
  const dono = useDonoDaLinha(linha.created_by);
  const instantaneo = (x: AnotacaoBanco) => ({ texto: x.texto, updated_at: x.updated_at });
  const c = useCampo(instantaneo(linha), async (novo, base) => {
    const salva = await salvarLinha('anotacoes', linha.id, base.updated_at, { texto: novo.texto });
    gravar('anotacoes', salva);
    return instantaneo(salva);
  });
  return (
    <div className="flex items-start gap-2">
      <textarea aria-label={rotulo} rows={3} disabled={!dono} className="field min-w-0 flex-1" value={c.valor.texto} onChange={e => c.alterar({ ...c.valor, texto: e.target.value })} onBlur={() => void c.confirmar()} />
      <Remover tabela="anotacoes" id={linha.id} ctx={ctx} disabled={!dono} />
    </div>
  );
}

/* ---------- Fotos ---------- */
const LIMITE_FOTOS = 20;
const LIMITE_BYTES = 2 * 1024 * 1024;
function comprimir(arquivo: File) {
  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(arquivo);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Não foi possível ler ${arquivo.name}.`)); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, 1200 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = img.width * k; c.height = img.height * k;
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      const gerar = (qualidade: number) => c.toBlob(blob => {
        if (!blob) { reject(new Error(`Não foi possível processar ${arquivo.name}.`)); return; }
        if (blob.size > LIMITE_BYTES && qualidade > 0.4) gerar(qualidade - 0.2);
        else resolve(blob);
      }, 'image/jpeg', qualidade);
      gerar(0.75);
    };
    img.src = url;
  });
}
export function Fotos({ linhas, urls, ctx }: { linhas: FotoBanco[]; urls: Record<string, string>; ctx: Contexto }) {
  const { gravar, executar } = useLinhas(ctx);
  const [enviando, setEnviando] = useState(0);
  async function adicionar(arquivos: FileList | null) {
    if (!arquivos) return;
    const lista = Array.from(arquivos);
    const espaco = LIMITE_FOTOS - linhas.length;
    if (lista.length > espaco) toast.error(`Limite de ${LIMITE_FOTOS} fotos por RDO: ${Math.max(espaco, 0)} ainda cabem.`);
    const aceitas = lista.slice(0, Math.max(espaco, 0));
    setEnviando(aceitas.length);
    for (const [i, arquivo] of aceitas.entries()) {
      await executar(async () => { gravar('fotos', await enviarFoto(ctx.rdoId, await comprimir(arquivo), linhas.length + i)); });
      setEnviando(n => n - 1);
    }
  }
  return (
    <>
      <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-safety/60 bg-accent px-4 py-6 text-sm font-semibold text-accent-foreground hover:bg-accent/70">
        {enviando > 0 ? `Enviando ${enviando} foto(s)…` : '📷 Adicionar fotos'}
        <input type="file" accept="image/*" multiple className="hidden" onChange={e => { void adicionar(e.target.files); e.target.value = ''; }} />
      </label>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {linhas.map(f => <LinhaFoto key={f.id} linha={f} url={urls[f.storage_path]} ctx={ctx} />)}
      </div>
    </>
  );
}
function LinhaFoto({ linha, url, ctx }: { linha: FotoBanco; url: string | undefined; ctx: Contexto }) {
  const { gravar } = useLinhas(ctx);
  const dono = useDonoDaLinha(linha.created_by);
  const instantaneo = (x: FotoBanco) => ({ legenda: x.legenda ?? '', updated_at: x.updated_at });
  const c = useCampo(instantaneo(linha), async (novo, base) => {
    const salva = await salvarLinha('fotos', linha.id, base.updated_at, { legenda: novo.legenda || null });
    gravar('fotos', salva);
    return instantaneo(salva);
  });
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="relative">
        <img {...(url ? { src: url } : {})} alt={c.valor.legenda || 'Foto da obra'} className="aspect-[4/3] w-full bg-muted object-cover" />
        <div className="absolute right-1 top-1 rounded bg-card"><Remover tabela="fotos" id={linha.id} ctx={ctx} disabled={!dono} antes={() => excluirFoto(linha)} /></div>
      </div>
      <input aria-label="Legenda da foto" disabled={!dono} className="w-full border-t bg-card px-2 py-1.5 text-sm outline-none" placeholder="Legenda" value={c.valor.legenda} onChange={e => c.alterar({ ...c.valor, legenda: e.target.value })} onBlur={() => void c.confirmar()} />
    </div>
  );
}
