import { useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { MARCA } from '@/lib/marca';
import { assinaturaUrlQuery, diaQuery, fotosUrlsQuery, frentesQuery, logoUrlQuery, obraQuery } from '@/lib/rdo/queries';
import { fmtData, mensagemErro } from '@/lib/rdo/rules';
import { PrintView, imprimir, type DocumentoRdo } from './print-view';

export function ExportarLote({ userId, datas, children, acoes }: { userId: string; datas: string[]; children: ReactNode; acoes?: ReactNode }) {
  const client = useQueryClient();
  const [documentos, setDocumentos] = useState<DocumentoRdo[]>([]);
  const [progresso, setProgresso] = useState<string | null>(null);

  // Prints only after React has rendered the documents. The title becomes the suggested file name.
  useEffect(() => {
    const primeiro = documentos[0], ultimo = documentos[documentos.length - 1];
    if (!primeiro || !ultimo) return;
    const titulo = document.title;
    document.title = `${MARCA} - RDOs ${primeiro.rdo.numero} a ${ultimo.rdo.numero}`;
    const limpar = () => setDocumentos([]);
    window.addEventListener('afterprint', limpar);
    void imprimir();
    return () => { window.removeEventListener('afterprint', limpar); document.title = titulo; };
  }, [documentos]);

  async function exportar() {
    const ordenadas = [...datas].sort();
    try {
      const [obra, frentes] = await Promise.all([client.fetchQuery(obraQuery(userId)), client.fetchQuery(frentesQuery(userId))]);
      const logoUrl = obra.logo_path ? await client.fetchQuery(logoUrlQuery(userId, obra.logo_path)) : null;
      const prontos: DocumentoRdo[] = [];
      for (const [i, data] of ordenadas.entries()) {
        setProgresso(`Preparando ${i + 1} de ${ordenadas.length}…`);
        const dia = await client.fetchQuery(diaQuery(userId, data));
        if (!dia.rdo) throw new Error(`O RDO de ${fmtData(data)} não está mais disponível.`);
        const caminhos = dia.rdo.fotos_no_pdf ? dia.fotos.map(f => f.storage_path) : [];
        const urls = caminhos.length ? await client.fetchQuery(fotosUrlsQuery(userId, caminhos)) : {};
        const assinaturaUrl = dia.rdo.assinatura_path ? await client.fetchQuery(assinaturaUrlQuery(userId, dia.rdo.assinatura_path)) : null;
        prontos.push({ ...dia, rdo: dia.rdo, obra, frentes, urls, logoUrl, assinaturaUrl });
      }
      setDocumentos(prontos);
    } catch (error) { toast.error(mensagemErro(error)); }
    finally { setProgresso(null); }
  }
  return (
    <>
      <div className="no-print fixed inset-x-0 bottom-0 z-10 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-3">
          {children}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {acoes}
            <Button disabled={!datas.length || progresso !== null} onClick={() => void exportar()}><FileDown />{progresso ?? 'Gerar PDF dos RDOs selecionados'}</Button>
          </div>
        </div>
      </div>
      {documentos.map((doc, i) => <PrintView key={doc.rdo.id} doc={doc} novaPagina={i > 0} />)}
    </>
  );
}
