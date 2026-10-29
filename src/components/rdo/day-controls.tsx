import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { usePermissao } from '@/components/auth-context';
import { useReferencia } from './reference';
import { criarRdo, moverRdo, type RdoBanco } from '@/lib/rdo/queries';
import { dataParaNumero, dataValida, fmtData, hojeLocal, mensagemErro, numeroParaData, numeroValido, somaDias } from '@/lib/rdo/rules';

export function DayControls({ date, rdo, userId }: { date: string; rdo: RdoBanco | null; userId: string }) {
  const ref = useReferencia();
  const [data, setData] = useState(date);
  const [numero, setNumero] = useState(String(rdo?.numero ?? dataParaNumero(date, ref.ref_numero, ref.ref_data)));
  const alterar = usePermissao('alterar_numero_data');
  const navigate = useNavigate();
  const client = useQueryClient();
  const ir = (day: string) => { if (dataValida(day)) void navigate({ to: '/rdo/$data', params: { data: day } }); };
  const mutation = useMutation({
    mutationFn: (target: string) => rdo ? moverRdo(rdo.id, target) : criarRdo(target),
    onSuccess: async row => {
      await client.invalidateQueries({ queryKey: ['rdo', userId] });
      toast.success(rdo ? 'Data do RDO atualizada.' : 'RDO criado.');
      ir(row.data);
    },
    onError: (error: unknown) => {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      toast.error(code === '23505' ? 'Já existe um RDO nesse dia.' : !rdo && (code === '42501' || /permiss|negad|autoriz/i.test(mensagemErro(error))) ? 'Você não tem permissão para criar este RDO.' : mensagemErro(error));
      if (rdo) { setData(date); setNumero(String(rdo.numero)); }
    },
  });
  function editarNumero(value: string) {
    setNumero(value);
    if (numeroValido(value)) { try { const d = numeroParaData(Number(value), ref.ref_numero, ref.ref_data); if (dataValida(d)) setData(d); } catch { /* validated on submission */ } }
  }
  function editarData(value: string) {
    setData(value);
    if (dataValida(value)) setNumero(String(dataParaNumero(value, ref.ref_numero, ref.ref_data)));
  }
  function confirmar() {
    if (!numeroValido(numero) || !dataValida(data) || dataParaNumero(data, ref.ref_numero, ref.ref_data) !== Number(numero)) { toast.error('Informe um número inteiro e uma data válida.'); return; }
    if (rdo) {
      if (data === date) return;
      if (!confirm(`Mover o RDO nº ${rdo.numero} (${fmtData(date)}) para nº ${numero} (${fmtData(data)})?`)) return;
    } else if (data > hojeLocal() && !confirm(`Criar RDO nº ${numero} em ${fmtData(data)}, uma data futura?`)) return;
    mutation.mutate(data);
  }
  return <div className="space-y-4 border-b bg-card px-4 py-4"><div className="mx-auto max-w-4xl space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={() => ir(somaDias(date, -1))}><ChevronLeft />Dia anterior</Button>
      <Button variant="outline" onClick={() => ir(somaDias(date, 1))}>Próximo dia<ChevronRight /></Button>
      <Button variant="ghost" onClick={() => ir(hojeLocal())}><CalendarDays />Hoje</Button>
      <label className="min-w-0 text-xs font-semibold">Ir para data<input aria-label="Ir para data" type="date" className="field mt-1" value={date} onChange={e => ir(e.target.value)} /></label>
    </div>
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="text-sm font-semibold">Nº do RDO<input aria-label="Nº do RDO" className="field mt-1" inputMode="numeric" value={numero} disabled={mutation.isPending || Boolean(rdo && !alterar)} onChange={e => editarNumero(e.target.value)} /></label>
      <label className="text-sm font-semibold">Data<input aria-label="Data" className="field mt-1" type="date" value={data} disabled={mutation.isPending || Boolean(rdo && !alterar)} onChange={e => editarData(e.target.value)} /></label>
      {rdo && alterar && data !== date && <Button disabled={mutation.isPending} onClick={confirmar}>Confirmar mudança</Button>}
    </div>
    {!rdo ? <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-muted-foreground">Este dia ainda não tem RDO</p><Button disabled={mutation.isPending} onClick={confirmar}>{mutation.isPending ? 'Criando…' : `Criar RDO nº ${numero} — ${dataValida(data) ? fmtData(data) : '—'}`}</Button></div> : <p className="text-sm font-semibold">{rdo.status === 'fechado' ? 'Fechado' : 'Aberto'}</p>}
  </div></div>;
}