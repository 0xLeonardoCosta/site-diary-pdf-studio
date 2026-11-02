import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { usePermissao } from '@/components/auth-context';
import { Button } from '@/components/ui/button';
import type { DiaRdo, FrenteBanco, ObraBanco, RdoBanco } from '@/lib/rdo/queries';
import { importarPlano, lerRascunho, planejarImportacao, temConteudo, type Rascunho } from '@/lib/rdo/rascunho';
import { chaveLocal, mensagemErro, rdoEditavel } from '@/lib/rdo/rules';

const ler = (date: string) => { try { return lerRascunho(localStorage.getItem(chaveLocal(date))); } catch { return null; } };

function Lista({ titulo, itens }: { titulo: string; itens: string[] }) {
  if (!itens.length) return null;
  return (
    <div className="mt-2">
      <p className="font-semibold">{titulo}</p>
      <ul className="ml-5 list-disc break-words">{itens.map((item, i) => <li key={i}>{item}</li>)}</ul>
    </div>
  );
}

export function ImportarRascunho({ date, rdo, dia, obra, frentes }: { date: string; rdo: RdoBanco; dia: DiaRdo; obra: ObraBanco; frentes: FrenteBanco[] }) {
  const client = useQueryClient();
  const fechar = usePermissao('fechar_reabrir');
  const alterarAssinados = usePermissao('alterar_assinados');
  const [rascunho, setRascunho] = useState<Rascunho | null>(() => ler(date));
  const [ocupado, setOcupado] = useState(false);
  const plano = useMemo(() => (rascunho ? planejarImportacao(rascunho, { ...dia, rdo }, obra, frentes) : null), [rascunho, dia, rdo, obra, frentes]);
  const guardar = (resto: Rascunho | null) => {
    try {
      if (resto) localStorage.setItem(chaveLocal(date), JSON.stringify(resto));
      else localStorage.removeItem(chaveLocal(date));
    } catch { /* The banner reappears on the next visit. */ }
    setRascunho(resto);
  };
  // Everything in the draft is already saved, so keeping it would only nag the team.
  const redundante = Boolean(plano && !temConteudo(plano));
  useEffect(() => {
    if (!redundante) return;
    try { localStorage.removeItem(chaveLocal(date)); } catch { /* Checked again on the next visit. */ }
    setRascunho(null);
  }, [redundante, date]);
  if (!rascunho || !plano || redundante) return null;

  const podeImportar = rdoEditavel(rdo.status, fechar, Boolean(rdo.assinado_em), alterarAssinados) && plano.novos.length > 0;
  async function importar() {
    if (!rascunho || !plano) return;
    setOcupado(true);
    try {
      const resto = await importarPlano(rascunho, plano, rdo.id);
      guardar(resto);
      if (resto?.fotos !== undefined) toast.error('Parte do rascunho não foi importada. Confira o que restou no aviso.');
      else toast.success('Rascunho importado para o banco.');
      await client.invalidateQueries({ queryKey: ['rdo'] });
    } catch (error) { toast.error(mensagemErro(error)); }
    finally { setOcupado(false); }
  }
  return (
    <section role="status" className="rounded-xl border-2 border-safety bg-accent p-4 text-sm text-accent-foreground">
      <p className="font-semibold">Este navegador guarda dados antigos deste dia.</p>
      <p className="mt-1">Só entra o que ainda não está no RDO: nada é duplicado nem substituído. Confira a lista antes de decidir.</p>
      <Lista titulo="Será importado:" itens={plano.novos} />
      {plano.fotos.length > 0 && (
        <div className="mt-2">
          <div className="flex flex-wrap gap-2">{plano.fotos.map((f, i) => <img key={i} src={f.src} alt={f.legenda || `Foto ${i + 1} do rascunho`} className="h-16 w-20 rounded border object-cover" />)}</div>
          <p className="mt-1">Fotos não têm como ser comparadas: confira se já não estão no RDO.</p>
        </div>
      )}
      <Lista titulo="Diferente do RDO (não será alterado):" itens={plano.diferencas} />
      <Lista titulo="Sem local, não será importado (lance manualmente no RDO):" itens={plano.semLocal.map(x => x.a ?? '')} />
      {plano.novos.length > 0 && !podeImportar && <p className="mt-2 font-semibold">Este RDO está travado. Para importar, é preciso reabri-lo ou remover a assinatura, ou usar um perfil com essa permissão.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {plano.novos.length > 0 && <Button disabled={ocupado || !podeImportar} onClick={() => void importar()}>{ocupado ? 'Importando…' : 'Importar para o banco'}</Button>}
        <Button variant="outline" disabled={ocupado} onClick={() => { if (confirm('Descartar os dados antigos deste navegador? O RDO não muda, mas isso não pode ser desfeito.')) guardar(null); }}>Descartar</Button>
      </div>
    </section>
  );
}
