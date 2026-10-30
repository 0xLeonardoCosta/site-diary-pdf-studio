import { MaoObra } from "./labor";
import { chaveLocal, hojeLocal, CATEGORIAS, LOCAIS, ROTULOS, localValido, ordenarPorLocal, totalCategoria, totalEfetivo } from "@/lib/rdo/rules";
import { MARCA } from "@/lib/marca";
import type { MaoObraBanco, RdoBanco } from "@/lib/rdo/queries";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useIsMutating } from '@tanstack/react-query';
import { usePermissao } from "@/components/auth-context";
import { Button } from "@/components/ui/button";
import type { Permissao } from "@/lib/auth-rules";

type Clima = "Bom" | "Nublado" | "Chuva fraca" | "Chuva forte";
const CLIMAS: Clima[] = ["Bom", "Nublado", "Chuva fraca", "Chuva forte"];
const CLIMA_ICON: Record<Clima, string> = { Bom: "☀️", Nublado: "☁️", "Chuva fraca": "🌦️", "Chuva forte": "⛈️" };
const TURNOS = ["Manhã", "Tarde", "Noite anterior"] as const;
const climaIcon = (turno: string, c: Clima) => (turno === "Noite anterior" && c === "Bom" ? "🌙" : CLIMA_ICON[c]);
const COLETAS = ["07:00", "12:00", "17:00"] as const;

type Row = { id: string; a: string; b: string; c?: string };
type Atividade = { id: string; a: string; local: string };
type Foto = { id: string; src: string; legenda: string };
type RDO = {
  obra: string; cliente: string; endereco: string; contrato: string; responsavel: string;
  numero: string; data: string; inicio: string; prazo: string;
  clima: Record<string, Clima>;
  pluvio: Record<string, string>;
  mareHora: string; mareNivel: string;
  horario: string;
  maoDeObra: Row[]; equipamentos: Row[]; atividades: Atividade[];
  ocorrencias: string; seguranca: string;
  fotos: Foto[]; fotosNoPdf: boolean;
  assResp: string; assFiscal: string;
};

const uid = () => Math.random().toString(36).slice(2, 9);
const hoje = hojeLocal;
const vazio = (): RDO => ({
  obra: "", cliente: "", endereco: "", contrato: "", responsavel: "",
  numero: "001", data: hoje(), inicio: "", prazo: "",
  clima: { Manhã: "Bom", Tarde: "Bom", "Noite anterior": "Bom" },
  pluvio: { "07:00": "", "12:00": "", "17:00": "" },
  mareHora: "", mareNivel: "",
  horario: "07:00 às 17:00",
  maoDeObra: [],
  equipamentos: [{ id: uid(), a: "Betoneira 400L", b: "1" }],
  atividades: [{ id: uid(), a: "", local: "" }],
  ocorrencias: "", seguranca: "", fotos: [], fotosNoPdf: true, assResp: "", assFiscal: "",
});
// Older drafts used "Noite" and a "% avanço" column (b); map them to the current shape.
const carregar = (s: string | null): RDO => {
  const base = vazio();
  if (!s) return base;
  const salvo = JSON.parse(s) as Partial<RDO>;
  const clima: Record<string, Clima> = { ...base.clima, ...salvo.clima };
  if (clima["Noite"] && !salvo.clima?.["Noite anterior"]) clima["Noite anterior"] = clima["Noite"];
  delete clima["Noite"];
  const atividades = (salvo.atividades ?? base.atividades).map((x: Partial<Atividade>) => ({
    id: x.id ?? uid(), a: x.a ?? "", local: x.local && localValido(x.local) ? x.local : "",
  }));
  return { ...base, ...salvo, clima, atividades, maoDeObra: [] };
};
const mareTxt = (r: RDO) =>
  r.mareHora || r.mareNivel ? `${r.mareHora || "--:--"} - ${(r.mareNivel || "0").replace(".", ",")} m` : "—";
const fmt = (d: string) => (d ? d.split("-").reverse().join("/") : "—");
const diaSemana = (d: string) =>
  d ? new Date(d + "T12:00").toLocaleDateString("pt-BR", { weekday: "long" }) : "";

export function DiaryForm({ date, rdo, maoObra, userId, numero }: { date: string; rdo: RdoBanco | null; maoObra: MaoObraBanco[]; userId: string; numero: number }) {
  const useObra = usePermissao("editar_obra");
  const exportar = usePermissao("exportar_pdf");
  const alterarData = usePermissao("alterar_numero_data");
  const salvandoMaoObra = useIsMutating({ mutationKey: ['rdo-labor', userId, date] }) > 0;
  const key = chaveLocal(date);
  const [r, setR] = useState<RDO>(vazio);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  useEffect(() => {
    try { setR(carregar(localStorage.getItem(key))); } catch { setR(vazio()); }
    setLoadedKey(key);
  }, [key]);
  useEffect(() => {
    if (loadedKey !== key) return;
    const { maoDeObra: _oldLabor, numero: _numero, data: _date, ...local } = r;
    try { localStorage.setItem(key, JSON.stringify(local)); } catch {}
  }, [r, loadedKey, key]);
  const set = <K extends keyof RDO>(k: K, v: RDO[K]) => setR((p) => ({ ...p, [k]: v }));
  const totalEquipe = totalEfetivo(maoObra);
  const documento = { ...r, numero: String(rdo?.numero ?? numero), data: date };

  const addFotos = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      const img = new Image();
      const url = URL.createObjectURL(f);
      img.onload = () => {
        const max = 1200, k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = img.width * k; c.height = img.height * k;
        const context = c.getContext("2d");
        if (!context) { URL.revokeObjectURL(url); return; }
        context.drawImage(img, 0, 0, c.width, c.height);
        const src = c.toDataURL("image/jpeg", 0.75);
        URL.revokeObjectURL(url);
        setR((p) => ({ ...p, fotos: [...p.fotos, { id: uid(), src, legenda: "" }] }));
      };
      img.src = url;
    });
  };

  return (
    <>
      <div className="no-print min-h-screen pb-28">
        <header className="bg-navy text-navy-foreground">
          <div className="stripes h-2" />
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-safety">{MARCA} – Diário de obra{r.obra.trim() ? `: ${r.obra.trim()}` : ""}</p>
              <h1 className="font-display text-3xl font-bold uppercase sm:text-4xl">RDO nº {documento.numero}</h1>
              <p className="text-sm opacity-80">{fmt(documento.data)} · {diaSemana(documento.data)}</p>
            </div>

          </div>
        </header>

        <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
          <Section n="1" title="Dados da obra">
            <div className="grid gap-3 sm:grid-cols-2">
              <F label="Obra"><input className="field" disabled={!useObra} value={r.obra} onChange={(e) => set("obra", e.target.value)} placeholder="Ex.: Residencial Bela Vista" /></F>
              <F label="Cliente / Contratante"><input className="field" disabled={!useObra} value={r.cliente} onChange={(e) => set("cliente", e.target.value)} /></F>
              <F label="Endereço" wide><input className="field" disabled={!useObra} value={r.endereco} onChange={(e) => set("endereco", e.target.value)} /></F>
              <F label="Responsável técnico"><input className="field" disabled={!useObra} value={r.responsavel} onChange={(e) => set("responsavel", e.target.value)} placeholder="Eng. Nome – CREA" /></F>
              <F label="Contrato / ART"><input className="field" disabled={!useObra} value={r.contrato} onChange={(e) => set("contrato", e.target.value)} /></F>
              <F label="Início da obra"><input type="date" className="field" disabled={!useObra} value={r.inicio} onChange={(e) => set("inicio", e.target.value)} /></F>
              <F label="Prazo previsto"><input type="date" className="field" disabled={!useObra} value={r.prazo} onChange={(e) => set("prazo", e.target.value)} /></F>
            </div>
          </Section>

          <Section permissao="lancar_clima" n="2" title="Condições climáticas">
            <div className="space-y-3">
              {TURNOS.map((t) => (
                <div key={t} className="flex flex-wrap items-center gap-2">
                  <span className="w-28 text-sm font-semibold">{t}</span>
                  {CLIMAS.map((c) => {
                    const on = r.clima[t] === c;
                    return (
                      <Button key={c} onClick={() => set("clima", { ...r.clima, [t]: c })}
                        className={`rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-safety bg-safety text-safety-foreground font-semibold" : "bg-card hover:border-safety"}`}>
                        {climaIcon(t, c)} {c}
                      </Button>
                    );
                  })}
                </div>
              ))}
              <F label="Horário de trabalho"><input className="field max-w-xs" value={r.horario} onChange={(e) => set("horario", e.target.value)} /></F>
              <div>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pluviômetro (mm)</span>
                <div className="grid grid-cols-3 gap-2">
                  {COLETAS.map((h) => (
                    <label key={h} className="block">
                      <span className="text-xs font-semibold">{h}</span>
                      <input className="field" inputMode="decimal" placeholder="0,0" value={r.pluvio?.[h] ?? ""} onChange={(e) => set("pluvio", { ...(r.pluvio ?? {}), [h]: e.target.value })} />
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tábua de maré · nível máximo</span>
                <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
                  <label className="block"><span className="text-xs font-semibold">Horário</span><input type="time" className="field" value={r.mareHora} onChange={(e) => set("mareHora", e.target.value)} /></label>
                  <label className="block"><span className="text-xs font-semibold">Nível (m)</span><input className="field" inputMode="decimal" placeholder="2,85" value={r.mareNivel} onChange={(e) => set("mareNivel", e.target.value)} /></label>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Registro: <b className="text-foreground">{mareTxt(r)}</b></p>
              </div>
            </div>
          </Section>

          <Section n="3" title="Mão de obra">
            <MaoObra rdo={rdo} rows={maoObra} userId={userId} date={date} />
          </Section>

          <Section permissao="lancar_equipamentos" n="4" title="Equipamentos">
            <Rows rows={r.equipamentos} onChange={(v) => set("equipamentos", v)} la="Equipamento" lb="Qtd." pb="0" numeric />
          </Section>

          <Section permissao="lancar_atividades" n="5" title="Atividades executadas">
            <Atividades rows={r.atividades} onChange={(v) => set("atividades", v)} />
          </Section>

          <Section permissao="lancar_atividades" n="6" title="Ocorrências e observações">
            <div className="grid gap-3">
              <F label="Ocorrências / observações gerais"><textarea rows={4} className="field" value={r.ocorrencias} onChange={(e) => set("ocorrencias", e.target.value)} placeholder="Atrasos de material, visitas, interferências..." /></F>
              <F label="Segurança do trabalho"><textarea rows={2} className="field" value={r.seguranca} onChange={(e) => set("seguranca", e.target.value)} placeholder="Uso de EPIs, DDS realizado, incidentes..." /></F>
            </div>
          </Section>

          <Section permissao="lancar_atividades" n="7" title={`Registro fotográfico · ${r.fotos.length}`} extra={
            <label className="flex cursor-pointer items-center gap-2 font-sans text-sm font-semibold normal-case text-foreground">
              <input type="checkbox" className="size-4 accent-safety" checked={r.fotosNoPdf} onChange={(e) => set("fotosNoPdf", e.target.checked)} />
              Incluir no PDF
            </label>
          }>
            <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-safety/60 bg-accent px-4 py-6 text-sm font-semibold text-accent-foreground hover:bg-accent/70">
              📷 Adicionar fotos
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFotos(e.target.files); e.target.value = ""; }} />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {r.fotos.map((f) => (
                <div key={f.id} className="overflow-hidden rounded-lg border bg-card">
                  <div className="relative">
                    <img src={f.src} alt={f.legenda || "Foto da obra"} className="aspect-[4/3] w-full object-cover" />
                    <Button onClick={() => set("fotos", r.fotos.filter((x) => x.id !== f.id))} className="absolute right-1 top-1 rounded bg-destructive px-2 text-sm text-destructive-foreground">×</Button>
                  </div>
                  <input className="w-full border-t bg-card px-2 py-1.5 text-sm outline-none" placeholder="Legenda" value={f.legenda}
                    onChange={(e) => set("fotos", r.fotos.map((x) => (x.id === f.id ? { ...x, legenda: e.target.value } : x)))} />
                </div>
              ))}
            </div>
          </Section>

          <Section permissao="fechar_reabrir" n="8" title="Assinaturas">
            <div className="grid gap-3 sm:grid-cols-2">
              <F label="Responsável pela obra"><input className="field" value={r.assResp} onChange={(e) => set("assResp", e.target.value)} /></F>
              <F label="Fiscalização / Cliente"><input className="field" value={r.assFiscal} onChange={(e) => set("assFiscal", e.target.value)} /></F>
            </div>
          </Section>
        </main>

        <div className="fixed inset-x-0 bottom-0 border-t bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl gap-3 px-4 py-3">
            <Button disabled={!useObra || !alterarData} onClick={() => confirm("Limpar todo o formulário?") && setR(vazio())} className="rounded-md border px-4 py-3 text-sm font-medium">Limpar</Button>
            <Button disabled={!exportar || salvandoMaoObra} onClick={() => window.print()} className="flex-1 rounded-md bg-safety px-4 py-3 font-display text-lg font-bold uppercase text-safety-foreground shadow-lg hover:brightness-105">
              Exportar PDF
            </Button>
          </div>
        </div>
      </div>

      {exportar && <PrintView r={documento} total={totalEquipe} maoObra={maoObra} />}
    </>
  );
}

function Section({ n, title, children, permissao, extra }: { n: string; title: string; children: ReactNode; permissao?: Permissao; extra?: ReactNode }) {
  const permitido = usePermissao(permissao ?? "editar_obra");
  const bloqueado = Boolean(permissao && !permitido);
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

function Rows({ rows, onChange, la, lb, pb, numeric }: { rows: Row[]; onChange: (r: Row[]) => void; la: string; lb: string; pb: string; numeric?: boolean }) {
  const up = (id: string, k: "a" | "b", v: string) => onChange(rows.map((x) => (x.id === id ? { ...x, [k]: v } : x)));
  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-xs font-semibold uppercase text-muted-foreground"><span className="flex-1">{la}</span><span className="w-24">{lb}</span><span className="w-9" /></div>
      {rows.map((x) => (
        <div key={x.id} className="flex gap-2">
          <input className="field flex-1" value={x.a} onChange={(e) => up(x.id, "a", e.target.value)} />
          <input className="field w-24" inputMode={numeric ? "numeric" : undefined} placeholder={pb} value={x.b} onChange={(e) => up(x.id, "b", e.target.value)} />
          <Button onClick={() => onChange(rows.filter((y) => y.id !== x.id))} className="w-9 rounded-md border text-muted-foreground hover:text-destructive" aria-label="Remover">×</Button>
        </div>
      ))}
      <Button onClick={() => onChange([...rows, { id: uid(), a: "", b: "" }])} className="text-sm font-semibold text-accent-foreground hover:underline">+ Adicionar linha</Button>
    </div>
  );
}

function Atividades({ rows, onChange }: { rows: Atividade[]; onChange: (r: Atividade[]) => void }) {
  const up = (id: string, k: "a" | "local", v: string) => {
    const novas = rows.map((x) => (x.id === id ? { ...x, [k]: v } : x));
    onChange(k === "local" ? ordenarPorLocal(novas) : novas);
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-xs font-semibold uppercase text-muted-foreground"><span className="flex-1">Descrição do serviço</span><span className="w-36">Local</span><span className="w-9" /></div>
      {rows.map((x) => (
        <div key={x.id} className="flex gap-2">
          <input aria-label="Descrição do serviço" className="field min-w-0 flex-1" value={x.a} onChange={(e) => up(x.id, "a", e.target.value)} />
          <select aria-label="Local do serviço" className="field w-36" value={x.local} onChange={(e) => up(x.id, "local", e.target.value)}>
            <option value="">Selecione…</option>
            {LOCAIS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <Button onClick={() => onChange(rows.filter((y) => y.id !== x.id))} className="w-9 rounded-md border text-muted-foreground hover:text-destructive" aria-label="Remover">×</Button>
        </div>
      ))}
      <Button onClick={() => onChange([...rows, { id: uid(), a: "", local: "" }])} className="text-sm font-semibold text-accent-foreground hover:underline">+ Adicionar linha</Button>
    </div>
  );
}

/* ---------- PDF / impressão ---------- */
function PH({ n, children }: { n: number; children: ReactNode }) {
  return <div className="mb-1 mt-3 break-after-avoid border-l-4 border-safety bg-navy px-2 py-0.5 font-display text-sm font-bold uppercase text-navy-foreground">{n}. {children}</div>;
}
// Compact "name … qty" entries meant to flow across columns, so long lists fill the page width instead of one tall table.
function PLista({ itens }: { itens: { id: string; nome: string; qtd: ReactNode }[] }) {
  return <>{itens.map((x) => <div key={x.id} className="flex break-inside-avoid justify-between gap-2 border-b border-dotted px-1 py-px"><span className="min-w-0">{x.nome}</span><b>{x.qtd}</b></div>)}</>;
}
function PrintView({ r, total, maoObra }: { r: RDO; total: number; maoObra: MaoObraBanco[] }) {
  const equipamentos = r.equipamentos.filter((x) => x.a.trim());
  const atividades = ordenarPorLocal(r.atividades.filter((x) => x.a.trim()));
  const ocorrencias = r.ocorrencias.trim(), seguranca = r.seguranca.trim();
  const fotos = r.fotosNoPdf ? r.fotos : [];
  return (
    <div className="print-only text-[11px] text-foreground">
      <div className="stripes h-2" />
      <div className="flex items-end justify-between bg-navy px-4 py-2.5 text-navy-foreground">
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-widest text-safety">{MARCA} – Diário de obra:</div>
          <div className="font-display text-2xl font-bold uppercase">{r.obra || "Obra"}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-xl font-bold">RDO Nº {r.numero}</div>
          <div>{fmt(r.data)} · {diaSemana(r.data)}</div>
        </div>
      </div>

      <PH n={1}>Dados da obra</PH>
      <table className="w-full border-collapse">
        <tbody>
          {[["Cliente", r.cliente, "Contrato / ART", r.contrato], ["Endereço", r.endereco, "Resp. técnico", r.responsavel], ["Início", fmt(r.inicio), "Prazo previsto", fmt(r.prazo)]].map((l, i) => (
            <tr key={i} className="border-b">
              <td className="w-24 bg-muted px-2 py-0.5 font-semibold">{l[0]}</td><td className="px-2 py-0.5">{l[1] || "—"}</td>
              <td className="w-28 bg-muted px-2 py-0.5 font-semibold">{l[2]}</td><td className="px-2 py-0.5">{l[3] || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <PH n={2}>Condições climáticas · Horário: {r.horario}</PH>
      <div className="grid grid-cols-7 gap-1.5">
        {TURNOS.map((t) => (
          <div key={t} className="rounded border px-1 py-1 text-center">
            <div className="text-[8px] uppercase text-muted-foreground">{t}</div>
            <div className="font-semibold">{climaIcon(t, r.clima[t] ?? "Bom")} {r.clima[t] ?? "Bom"}</div>
          </div>
        ))}
        {COLETAS.map((h) => (
          <div key={h} className="rounded border px-1 py-1 text-center">
            <div className="text-[8px] uppercase text-muted-foreground">Pluviôm. {h}</div>
            <div className="font-semibold">{r.pluvio?.[h] ? `${r.pluvio?.[h]} mm` : "—"}</div>
          </div>
        ))}
        <div className="rounded border border-safety px-1 py-1 text-center">
          <div className="text-[8px] uppercase text-muted-foreground">Maré máxima</div>
          <div className="font-semibold">{mareTxt(r)}</div>
        </div>
      </div>

      <PH n={3}>Mão de obra · {CATEGORIAS.map((c) => `${ROTULOS[c]} ${totalCategoria(maoObra, c)}`).join(" · ")} · Efetivo total {total}</PH>
      {maoObra.length ? (
        <div className="columns-3 gap-4">
          {CATEGORIAS.map((c) => {
            const linhas = maoObra.filter((x) => x.categoria === c);
            if (!linhas.length) return null;
            return (
              <Fragment key={c}>
                <div className="mt-1 flex break-inside-avoid break-after-avoid justify-between bg-muted px-1 py-px font-bold uppercase first:mt-0"><span>{ROTULOS[c]}</span><span>{totalCategoria(maoObra, c)}</span></div>
                <PLista itens={linhas.map((x) => ({ id: x.id, nome: x.funcao, qtd: x.quantidade }))} />
              </Fragment>
            );
          })}
        </div>
      ) : <p className="px-1 text-muted-foreground">Nenhum efetivo registrado.</p>}

      <PH n={4}>Equipamentos</PH>
      {equipamentos.length
        ? <div className="columns-3 gap-4"><PLista itens={equipamentos.map((x) => ({ id: x.id, nome: x.a, qtd: x.b }))} /></div>
        : <p className="px-1 text-muted-foreground">Nenhum equipamento registrado.</p>}

      <PH n={5}>Atividades executadas</PH>
      {atividades.length ? (
        <table className="w-full border-collapse">
          <thead><tr className="bg-muted text-left"><th className="w-28 px-2 py-0.5">Local</th><th className="px-2 py-0.5">Descrição do serviço</th></tr></thead>
          <tbody>
            {atividades.map((x, i) => (
              <tr key={x.id} className="break-inside-avoid border-b">
                <td className="px-2 py-0.5 align-top font-semibold">{i === 0 || atividades[i - 1]?.local !== x.local ? x.local || "Sem local" : ""}</td>
                <td className="px-2 py-0.5">{x.a}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="px-1 text-muted-foreground">Nenhuma atividade registrada.</p>}

      <PH n={6}>Ocorrências e observações</PH>
      {!ocorrencias && !seguranca && <p className="px-1 text-muted-foreground">Sem ocorrências ou observações.</p>}
      {ocorrencias && (<><div className="font-semibold">Ocorrências / observações gerais</div><p className="whitespace-pre-wrap rounded border px-2 py-1">{ocorrencias}</p></>)}
      {seguranca && (<><div className="mt-1.5 font-semibold">Segurança do trabalho</div><p className="whitespace-pre-wrap rounded border px-2 py-1">{seguranca}</p></>)}

      {fotos.length > 0 && (
        <>
          <PH n={7}>Registro fotográfico</PH>
          <div className="grid grid-cols-3 gap-2">
            {fotos.map((f, i) => (
              <figure key={f.id} className="avoid-break overflow-hidden rounded border">
                <img src={f.src} alt={f.legenda} className="aspect-[4/3] w-full object-cover" />
                <figcaption className="px-1.5 py-1 text-[9px]"><b>Foto {i + 1}.</b> {f.legenda}</figcaption>
              </figure>
            ))}
          </div>
        </>
      )}

      <div className="avoid-break">
        <PH n={fotos.length > 0 ? 8 : 7}>Assinaturas</PH>
        <div className="mt-10 grid grid-cols-2 gap-10 text-center">
          {[["Responsável pela obra", r.assResp], ["Fiscalização / Cliente", r.assFiscal]].map(([l, n]) => (
            <div key={l}><div className="border-t border-foreground pt-1 font-semibold">{n || " "}</div><div className="text-[9px] uppercase text-muted-foreground">{l}</div></div>
          ))}
        </div>
      </div>
      <div className="stripes mt-4 h-1.5" />
    </div>
  );
}
