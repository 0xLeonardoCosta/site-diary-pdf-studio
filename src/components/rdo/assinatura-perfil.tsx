import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import type { Perfil } from '@/lib/auth-rules';
import { removerFundo } from '@/lib/rdo/assinatura';
import { assinaturaUrlQuery } from '@/lib/rdo/queries';
import { mensagemErro } from '@/lib/rdo/rules';
import { BUCKET_ASSINATURAS } from '@/lib/rdo/salvar';

const LIMITE_MB = 10;

function prepararAssinatura(arquivo: File) {
  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(arquivo);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a imagem. Use PNG, JPG ou WEBP.')); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, 1800 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) { reject(new Error('Não foi possível processar a imagem.')); return; }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const dados = ctx.getImageData(0, 0, c.width, c.height);
      const limites = removerFundo(dados.data, c.width, c.height);
      if (!limites) { reject(new Error('Nenhuma assinatura encontrada na imagem.')); return; }
      ctx.putImageData(dados, 0, 0);
      const f = Math.min(1, 800 / limites.largura, 400 / limites.altura);
      const saida = document.createElement('canvas');
      saida.width = Math.round(limites.largura * f); saida.height = Math.round(limites.altura * f);
      saida.getContext('2d')?.drawImage(c, limites.x, limites.y, limites.largura, limites.altura, 0, 0, saida.width, saida.height);
      saida.toBlob(blob => { if (blob) resolve(blob); else reject(new Error('Não foi possível processar a imagem.')); }, 'image/png');
    };
    img.src = url;
  });
}

// Registered by the administrator: having one here is what lets the person sign RDOs.
export function AssinaturaUsuario({ usuario }: { usuario: Perfil }) {
  const client = useQueryClient();
  const { perfil, refresh } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const { data: url } = useQuery({ ...assinaturaUrlQuery(perfil?.id ?? '', usuario.assinatura_path), enabled: aberto && Boolean(usuario.assinatura_path) });
  async function gravar(assinatura_path: string | null) {
    const { error } = await supabase.from('profiles').update({ assinatura_path }).eq('id', usuario.id).select('id').single();
    if (error) throw error;
    await client.invalidateQueries({ queryKey: ['equipe'] });
    if (perfil?.id === usuario.id) await refresh();
  }
  async function executar(acao: () => Promise<void>) {
    setOcupado(true);
    try { await acao(); } catch (error) { toast.error(mensagemErro(error)); } finally { setOcupado(false); }
  }
  const trocar = (arquivo: File) => executar(async () => {
    if (arquivo.size > LIMITE_MB * 1024 * 1024) throw new Error(`A imagem deve ter no máximo ${LIMITE_MB} MB.`);
    const imagem = await prepararAssinatura(arquivo);
    const caminho = `${usuario.id}/${crypto.randomUUID()}.png`;
    const envio = await supabase.storage.from(BUCKET_ASSINATURAS).upload(caminho, imagem, { contentType: 'image/png' });
    if (envio.error) throw envio.error;
    await gravar(caminho);
    toast.success('Assinatura cadastrada.');
  });
  return (
    <>
      <Button variant="outline" onClick={() => setAberto(true)}><PenLine />Assinatura{usuario.assinatura_path ? ' ✓' : ''}</Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assinatura de {usuario.nome}</DialogTitle></DialogHeader>
          <div className="relative flex h-32 items-end justify-center overflow-hidden rounded-md border bg-white px-4 pb-6">
            {url && usuario.assinatura_path && <img src={url} alt={`Assinatura de ${usuario.nome}`} className="max-h-full max-w-full object-contain" />}
            {!usuario.assinatura_path && <span className="self-center text-sm text-muted-foreground">Nenhuma assinatura cadastrada</span>}
            <div className="absolute inset-x-6 bottom-5 border-t border-black" />
          </div>
          <p className="text-xs text-muted-foreground">Digitalize a assinatura carimbada sobre papel branco, em PNG, JPG ou WEBP, até {LIMITE_MB} MB. O fundo é removido automaticamente. RDOs já assinados continuam com a assinatura usada na época.</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className={`inline-flex items-center rounded-md border px-3 py-2 text-sm font-semibold ${ocupado ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted'}`}>
              {ocupado ? 'Processando…' : 'Escolher arquivo'}
              <input type="file" accept="image/png,image/jpeg,image/webp" disabled={ocupado} className="hidden" aria-label={`Escolher assinatura de ${usuario.nome}`} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void trocar(f); }} />
            </label>
            {usuario.assinatura_path && <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => { if (confirm(`Remover o cadastro? ${usuario.nome} deixará de poder assinar novos RDOs.`)) void executar(() => gravar(null)); }}>Remover</Button>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
