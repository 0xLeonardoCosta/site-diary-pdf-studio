import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useCampo } from '@/hooks/use-campo';
import { supabase } from '@/integrations/supabase/client';
import { logoUrlQuery, obraQuery, type ObraBanco } from '@/lib/rdo/queries';
import { mensagemErro } from '@/lib/rdo/rules';
import { BUCKET_LOGOS, salvarCampo } from '@/lib/rdo/salvar';
import { iniciarEnvio, terminarEnvio } from '@/lib/rdo/sincronia';

export const LIMITE_LOGO_MB = 5;
// Twice the printed box, so the logo stays sharp in the PDF.
const LOGO_LARGURA = 600;
const LOGO_ALTURA = 240;

function redimensionarLogo(arquivo: File) {
  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(arquivo);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a imagem. Use PNG, JPG ou WEBP.')); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, LOGO_LARGURA / img.width, LOGO_ALTURA / img.height);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      // PNG keeps the transparency most logos rely on.
      c.toBlob(blob => { if (blob) resolve(blob); else reject(new Error('Não foi possível processar a imagem.')); }, 'image/png');
    };
    img.src = url;
  });
}

type Coluna = 'nome' | 'cliente' | 'fiscalizacao' | 'endereco' | 'gerenciadora' | 'responsavel_tecnico' | 'contrato' | 'data_inicio' | 'prazo_previsto';
function CampoObra({ obra, userId, campo, rotulo, tipo = 'text', largo, disabled }: { obra: ObraBanco; userId: string; campo: Coluna; rotulo: string; tipo?: string; largo?: boolean; disabled: boolean }) {
  const client = useQueryClient();
  const c = useCampo(obra[campo] ?? '', async (novo, base) => {
    const texto = novo.trim();
    // "nome" is the only required column.
    if (campo === 'nome' && !texto) throw new Error('Informe o nome da obra.');
    await salvarCampo('obra', true, campo, base || null, texto || null);
    client.setQueryData(obraQuery(userId).queryKey, old => (old ? { ...old, [campo]: texto || null } : old));
    return texto;
  // A partially typed date is not a value to save yet.
  }, { atraso: tipo === 'date' ? null : 700, pronto: v => campo !== 'nome' || Boolean(v.trim()) });
  return (
    <label className={`block ${largo ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</span>
      <input type={tipo} disabled={disabled} className="field" value={c.valor} onChange={e => c.alterar(e.target.value)} onBlur={() => void c.confirmar()} />
    </label>
  );
}

function CampoLogo({ obra, userId, disabled }: { obra: ObraBanco; userId: string; disabled: boolean }) {
  const client = useQueryClient();
  const { data: url } = useQuery(logoUrlQuery(userId, obra.logo_path));
  const [ocupado, setOcupado] = useState(false);
  const aplicar = (logo_path: string | null) => client.setQueryData(obraQuery(userId).queryKey, old => (old ? { ...old, logo_path } : old));
  async function executar(acao: () => Promise<void>) {
    setOcupado(true); iniciarEnvio();
    try { await acao(); terminarEnvio(true); }
    catch (error) {
      terminarEnvio(false);
      toast.error(mensagemErro(error));
      void client.invalidateQueries({ queryKey: obraQuery(userId).queryKey });
    } finally { setOcupado(false); }
  }
  const trocar = (arquivo: File) => executar(async () => {
    if (arquivo.size > LIMITE_LOGO_MB * 1024 * 1024) throw new Error(`A logo deve ter no máximo ${LIMITE_LOGO_MB} MB.`);
    const imagem = await redimensionarLogo(arquivo);
    const caminho = `logo/${crypto.randomUUID()}.png`;
    const envio = await supabase.storage.from(BUCKET_LOGOS).upload(caminho, imagem, { contentType: 'image/png' });
    if (envio.error) throw envio.error;
    try { await salvarCampo('obra', true, 'logo_path', obra.logo_path, caminho); }
    catch (error) { await supabase.storage.from(BUCKET_LOGOS).remove([caminho]); throw error; }
    aplicar(caminho);
    // The new logo is already saved, so a leftover old file is harmless.
    if (obra.logo_path) await supabase.storage.from(BUCKET_LOGOS).remove([obra.logo_path]);
  });
  const remover = () => executar(async () => {
    if (!obra.logo_path) return;
    await salvarCampo('obra', true, 'logo_path', obra.logo_path, null);
    aplicar(null);
    await supabase.storage.from(BUCKET_LOGOS).remove([obra.logo_path]);
  });
  return (
    <div className="sm:col-span-2">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Logo da empresa contratada</span>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-16 w-40 shrink-0 items-center justify-center rounded-md border bg-white p-1">
          {url ? <img src={url} alt="Logo da empresa contratada" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">Sem logo</span>}
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <label className={`inline-flex items-center rounded-md border px-3 py-2 text-sm font-semibold ${disabled || ocupado ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted'}`}>
              {ocupado ? 'Enviando…' : 'Escolher arquivo'}
              <input type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled || ocupado} className="hidden" aria-label="Escolher logo" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void trocar(f); }} />
            </label>
            {obra.logo_path && <Button variant="ghost" size="sm" disabled={disabled || ocupado} onClick={() => { if (confirm('Remover a logo? Ela deixa de aparecer em todos os RDOs.')) void remover(); }}>Remover</Button>}
          </div>
          <p className="text-xs text-muted-foreground">PNG, JPG ou WEBP, até {LIMITE_LOGO_MB} MB. A imagem é ajustada automaticamente ao cabeçalho.</p>
        </div>
      </div>
    </div>
  );
}

export function DadosObra({ obra, userId, editavel }: { obra: ObraBanco; userId: string; editavel: boolean }) {
  const props = { obra, userId, disabled: !editavel };
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="font-display text-3xl font-bold uppercase">Dados</h1>
        <p className="text-sm text-muted-foreground">Estas informações aparecem em todos os RDOs da obra selecionada.</p>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Obra selecionada</span>
        <select className="field" aria-label="Obra selecionada" value="atual" onChange={() => undefined}>
          <option value="atual">{obra.nome}</option>
        </select>
      </label>
      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 font-display text-xl font-bold uppercase text-primary">Dados da obra</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoObra {...props} campo="nome" rotulo="Obra" largo />
          <CampoObra {...props} campo="cliente" rotulo="Cliente" />
          <CampoObra {...props} campo="fiscalizacao" rotulo="Fiscalização" />
          <CampoObra {...props} campo="endereco" rotulo="Local" />
          <CampoObra {...props} campo="gerenciadora" rotulo="Gerenciadora" />
          <CampoObra {...props} campo="responsavel_tecnico" rotulo="Contratada" largo />
          <CampoLogo {...props} />
          <CampoObra {...props} campo="contrato" rotulo="Contrato nº" largo />
          <CampoObra {...props} campo="data_inicio" rotulo="Início contratual" tipo="date" />
          <CampoObra {...props} campo="prazo_previsto" rotulo="Término contratual" tipo="date" />
        </div>
      </section>
    </main>
  );
}
