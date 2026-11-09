import { useRef } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LAYOUTS, type LayoutPdf } from "@/lib/rdo/layout-excel";

const ICONES = { atual: FileText, excel: FileSpreadsheet } as const;

/**
 * Asks which layout to export. The choice is reported only once the dialog has closed, so the
 * print snapshot never catches it on screen.
 */
export function EscolherLayout({ aberto, aoFechar, aoEscolher }: { aberto: boolean; aoFechar: () => void; aoEscolher: (layout: LayoutPdf) => void }) {
  const escolha = useRef<LayoutPdf | null>(null);
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => { if (!abrir) aoFechar(); }}>
      <DialogContent className="no-print max-w-md" onCloseAutoFocus={() => {
        const layout = escolha.current;
        escolha.current = null;
        if (layout) aoEscolher(layout);
      }}>
        <DialogHeader>
          <DialogTitle>Qual layout deseja exportar?</DialogTitle>
          <DialogDescription>Os dois trazem as mesmas informações do RDO.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {LAYOUTS.map((l) => {
            const Icone = ICONES[l.id];
            return (
              <button key={l.id} type="button" onClick={() => { escolha.current = l.id; aoFechar(); }}
                className="flex flex-col items-start gap-2 rounded-lg border bg-card p-4 text-left transition hover:border-safety hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
                <Icone className="size-6 text-safety" aria-hidden />
                <span className="font-display text-lg font-bold uppercase">{l.rotulo}</span>
                <span className="text-sm text-muted-foreground">{l.descricao}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
