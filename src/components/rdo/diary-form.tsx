import { useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { MaoObra } from "./labor";
import { Anotacoes, Atividades, Equipamentos, Fotos } from "./lancamentos";
import { ImportarRascunho } from "./importar-rascunho";
import { PrintView, imprimir } from "./print-view";
import { usePermissao } from "@/components/auth-context";
import { Button } from "@/components/ui/button";
import { useCampo } from "@/hooks/use-campo";
import type { Permissao } from "@/lib/auth-rules";
import { MARCA } from "@/lib/marca";
import { alterarDia, fotosUrlsQuery, frentesQuery, obraQuery, type DiaRdo, type FrenteBanco, type ObraBanco, type RdoBanco } from "@/lib/rdo/queries";
import { CLIMAS, COLETAS, TURNOS, climaIcone, diaSemana, fmtData, numeroParaTexto, rdoEditavel, textoParaNumero } from "@/lib/rdo/rules";
import { salvarCampo } from "@/lib/rdo/salvar";
import { useSincronia, type EstadoSincronia } from "@/lib/rdo/sincronia";

const STATUS: Record<EstadoSincronia, string> = { salvo: "Tudo salvo", salvando: "Salvando…", erro: "Erro ao salvar" };

export function DiaryForm({ date, dia, userId, numero }: { date: string; dia: DiaRdo; userId: string; numero: number }) {
  const { data: obra } = useSuspenseQuery(obraQuery(userId));
  const { data: frentes } = useSuspenseQuery(frentesQuery(userId));
  const urls = useQuery(fotosUrlsQuery(userId, dia.fotos.map((f) => f.storage_path))).data ?? {};
  const exportar = usePermissao("exportar_pdf");
  const sincronia = useSincronia();
  const { rdo } = dia;

  // Closing the tab would drop whatever is still debouncing.
  useEffect(() => {
    if (sincronia !== "salvando") return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sincronia]);

  return (
    <>
      <div className="no-print min-h-screen pb-28">
        <header className="bg-navy text-navy-foreground">
          <div className="stripes h-2" />
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-safety">{MARCA} – Diário de obra: {obra.nome}</p>
              <h1 className="font-display text-3xl font-bold uppercase sm:text-4xl">RDO nº {rdo?.numero ?? numero}</h1>
              <p className="text-sm opacity-80">{fmtData(date)} · {diaSemana(date)}</p>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
          {rdo && <ImportarRascunho key={rdo.id} date={date} rdo={rdo} obra={obra} frentes={frentes} />}
          <DadosObra obra={obra} userId={userId} />
          {rdo
            ? <SecoesDoDia key={rdo.id} rdo={rdo} dia={dia} date={date} userId={userId} frentes={frentes} urls={urls} />
            : <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Crie o RDO deste dia, no topo da página, para começar o preenchimento.</p>}
        </main>

        <div className="fixed inset-x-0 bottom-0 border-t bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
            <span role="status" className={`w-28 shrink-0 text-sm font-semibold ${sincronia === "erro" ? "text-destructive" : "text-muted-foreground"}`}>{STATUS[sincronia]}</span>
            <Button disabled={!exportar || !rdo || sincronia === "salvando"} onClick={() => void imprimir()} className="flex-1 rounded-md bg-safety px-4 py-3 font-display text-lg font-bold uppercase text-safety-foreground shadow-lg hover:brightness-105">
              Exportar PDF
            </Button>
          </div>
        </div>
      </div>

      {exportar && rdo && <PrintView doc={{ ...dia, rdo, obra, frentes, urls }} />}
    </>
  );
}

function DadosObra({ obra, userId }: { obra: ObraBanco; userId: string }) {
  const props = { obra, userId };
  return (
    <Section permissao="editar_obra" n="1" title="Dados da obra">
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="Obra"><CampoObra {...props} campo="nome" placeholder="Ex.: Residencial Bela Vista" /></F>
        <F label="Cliente / Contratante"><CampoObra {...props} campo="cliente" /></F>
        <F label="Endereço" wide><CampoObra {...props} campo="endereco" /></F>
        <F label="Responsável técnico"><CampoObra {...props} campo="responsavel_tecnico" placeholder="Eng. Nome – CREA" /></F>
        <F label="Contrato / ART"><CampoObra {...props} campo="contrato" /></F>
        <F label="Início da obra"><CampoObra {...props} campo="data_inicio" tipo="date" /></F>
        <F label="Prazo previsto"><CampoObra {...props} campo="prazo_previsto" tipo="date" /></F>
      </div>
    </Section>
  );
}
type ColunaObra = "nome" | "cliente" | "endereco" | "responsavel_tecnico" | "contrato" | "data_inicio" | "prazo_previsto";
function CampoObra({ obra, userId, campo, tipo = "text", placeholder }: { obra: ObraBanco; userId: string; campo: ColunaObra; tipo?: string; placeholder?: string }) {
  const client = useQueryClient();
  const c = useCampo(obra[campo] ?? "", async (novo, base) => {
    const texto = novo.trim();
    // "nome" is the only required column.
    if (campo === "nome" && !texto) throw new Error("Informe o nome da obra.");
    await salvarCampo("obra", true, campo, base || null, texto || null);
    client.setQueryData(obraQuery(userId).queryKey, (old) => (old ? { ...old, [campo]: texto || null } : old));
    return texto;
  // A partially typed date is not a value to save yet.
  }, { atraso: tipo === "date" ? null : 700, pronto: (v) => campo !== "nome" || Boolean(v.trim()) });
  return <input type={tipo} className="field" placeholder={placeholder} value={c.valor} onChange={(e) => c.alterar(e.target.value)} onBlur={() => void c.confirmar()} />;
}

type PropsDia = { rdo: RdoBanco; dia: DiaRdo; date: string; userId: string; frentes: FrenteBanco[]; urls: Record<string, string> };
function SecoesDoDia({ rdo, dia, date, userId, frentes, urls }: PropsDia) {
  const fechar = usePermissao("fechar_reabrir");
  const travado = !rdoEditavel(rdo.status, fechar);
  const ctx = { rdoId: rdo.id, userId, date };
  const campo = { rdo, userId, date };
  return (
    <>
      <Section permissao="lancar_clima" travado={travado} n="2" title="Condições climáticas">
        <div className="space-y-3">
          {TURNOS.map((t) => <TurnoClima key={t.coluna} turno={t} {...campo} />)}
          <F label="Horário de trabalho"><CampoRdo {...campo} coluna="horario_trabalho" className="field max-w-xs" /></F>
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pluviômetro (mm)</span>
            <div className="grid grid-cols-3 gap-2">
              {COLETAS.map((c) => (
                <label key={c.hora} className="block">
                  <span className="text-xs font-semibold">{c.hora}</span>
                  <CampoRdo {...campo} coluna={c.coluna} numerico placeholder="0,0" />
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tábua de maré · nível máximo</span>
            <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
              <label className="block"><span className="text-xs font-semibold">Horário</span><CampoHora {...campo} /></label>
              <label className="block"><span className="text-xs font-semibold">Nível (m)</span><CampoRdo {...campo} coluna="mare_max_nivel" numerico placeholder="2,85" /></label>
            </div>
          </div>
        </div>
      </Section>

      <Section n="3" title="Mão de obra">
        <MaoObra rdo={rdo} rows={dia.maoObra} userId={userId} date={date} />
      </Section>

      <Section permissao="lancar_equipamentos" travado={travado} n="4" title="Equipamentos">
        <Equipamentos linhas={dia.equipamentos} ctx={ctx} />
      </Section>

      <Section permissao="lancar_atividades" travado={travado} n="5" title="Atividades executadas">
        <Atividades linhas={dia.atividades} frentes={frentes} ctx={ctx} />
      </Section>

      <Section permissao="lancar_atividades" travado={travado} n="6" title="Ocorrências e observações">
        <div className="grid gap-4">
          <Anotacoes tipo="ocorrencia" rotulo="Ocorrências / observações gerais" placeholder="Atrasos de material, visitas, interferências..." linhas={dia.anotacoes} ctx={ctx} />
          <Anotacoes tipo="seguranca" rotulo="Segurança do trabalho" placeholder="Uso de EPIs, DDS realizado, incidentes..." linhas={dia.anotacoes} ctx={ctx} />
        </div>
      </Section>

      <Section permissao="lancar_atividades" travado={travado} n="7" title={`Registro fotográfico · ${dia.fotos.length}`} extra={<FotosNoPdf {...campo} />}>
        <Fotos linhas={dia.fotos} urls={urls} ctx={ctx} />
      </Section>

      <Section permissao="fechar_reabrir" travado={travado} n="8" title="Assinaturas">
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Responsável pela obra"><CampoRdo {...campo} coluna="assinante_obra" /></F>
          <F label="Fiscalização / Cliente"><CampoRdo {...campo} coluna="assinante_fiscalizacao" /></F>
        </div>
      </Section>
    </>
  );
}

type PropsCampo = { rdo: RdoBanco; userId: string; date: string };
function useGravarRdo({ rdo, userId, date }: PropsCampo) {
  const client = useQueryClient();
  return async (coluna: keyof RdoBanco, base: string | number | boolean | null, valor: string | number | boolean | null) => {
    await salvarCampo("rdos", rdo.id, coluna, base, valor);
    alterarDia(client, userId, date, (dia) => (dia.rdo ? { ...dia, rdo: { ...dia.rdo, [coluna]: valor } } : dia));
  };
}
type ColunaTexto = "horario_trabalho" | "assinante_obra" | "assinante_fiscalizacao";
type ColunaNumero = "pluv_07h" | "pluv_12h" | "pluv_17h" | "mare_max_nivel";
function CampoRdo({ coluna, numerico, placeholder, className = "field", ...campo }: PropsCampo & { coluna: ColunaTexto | ColunaNumero; numerico?: boolean; placeholder?: string; className?: string }) {
  const gravar = useGravarRdo(campo);
  const atual = campo.rdo[coluna];
  const de = (texto: string) => (numerico ? textoParaNumero(texto) : texto.trim() || null);
  const c = useCampo(typeof atual === "number" ? numeroParaTexto(atual) : atual ?? "", async (novo, base) => {
    await gravar(coluna, de(base), de(novo));
    return novo;
  // A partially typed number such as "2," would be reformatted under the cursor.
  }, { atraso: numerico ? null : 700 });
  return <input className={className} inputMode={numerico ? "decimal" : undefined} placeholder={placeholder} value={c.valor} onChange={(e) => c.alterar(e.target.value)} onBlur={() => void c.confirmar()} />;
}
function CampoHora(campo: PropsCampo) {
  const gravar = useGravarRdo(campo);
  const de = (hora: string) => (hora ? `${hora}:00` : null);
  const c = useCampo(campo.rdo.mare_max_hora?.slice(0, 5) ?? "", async (novo, base) => {
    await gravar("mare_max_hora", de(base), de(novo));
    return novo;
  }, { atraso: null });
  return <input type="time" className="field" value={c.valor} onChange={(e) => c.alterar(e.target.value)} onBlur={() => void c.confirmar()} />;
}
function TurnoClima({ turno, ...campo }: PropsCampo & { turno: (typeof TURNOS)[number] }) {
  const gravar = useGravarRdo(campo);
  const c = useCampo<string | null>(campo.rdo[turno.coluna], async (novo, base) => {
    await gravar(turno.coluna, base, novo);
    return novo;
  }, { atraso: 0 });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-28 text-sm font-semibold">{turno.rotulo}</span>
      {CLIMAS.map((clima) => (
        <Button key={clima} aria-pressed={c.valor === clima} onClick={() => c.alterar(clima)}
          className={`rounded-full border px-3 py-1.5 text-sm transition ${c.valor === clima ? "border-safety bg-safety text-safety-foreground font-semibold" : "bg-card hover:border-safety"}`}>
          {climaIcone(turno.rotulo, clima)} {clima}
        </Button>
      ))}
    </div>
  );
}
function FotosNoPdf(campo: PropsCampo) {
  const gravar = useGravarRdo(campo);
  const c = useCampo(campo.rdo.fotos_no_pdf, async (novo, base) => {
    await gravar("fotos_no_pdf", base, novo);
    return novo;
  }, { atraso: 0 });
  return (
    <label className="flex cursor-pointer items-center gap-2 font-sans text-sm font-semibold normal-case text-foreground">
      <input type="checkbox" className="size-4 accent-safety" checked={c.valor} onChange={(e) => c.alterar(e.target.checked)} />
      Incluir no PDF
    </label>
  );
}

function Section({ n, title, children, permissao, extra, travado }: { n: string; title: string; children: ReactNode; permissao?: Permissao; extra?: ReactNode; travado?: boolean }) {
  const permitido = usePermissao(permissao ?? "editar_obra");
  const bloqueado = Boolean((permissao && !permitido) || travado);
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-3 font-display text-xl font-bold uppercase text-primary">
          <span className="grid h-8 w-8 place-items-center rounded bg-safety text-base text-safety-foreground">{n}</span>
          {title}
        </h2>
        {extra && <fieldset disabled={bloqueado} className="ml-auto">{extra}</fieldset>}
      </div>
      <fieldset disabled={bloqueado} className="min-w-0">{children}</fieldset>
    </section>
  );
}

function F({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
