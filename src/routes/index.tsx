import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RDO – Relatório Diário de Obra | Preencha e exporte em PDF" },
      { name: "description", content: "Formulário intuitivo de Relatório Diário de Obra com clima, equipe, atividades, fotos e exportação em PDF." },
      { property: "og:title", content: "RDO – Relatório Diário de Obra" },
      { property: "og:description", content: "Preencha o RDO no canteiro e exporte um PDF profissional." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Clima = "Bom" | "Nublado" | "Chuva fraca" | "Chuva forte";
const CLIMAS: Clima[] = ["Bom", "Nublado", "Chuva fraca", "Chuva forte"];
const CLIMA_ICON: Record<Clima, string> = { Bom: "☀️", Nublado: "☁️", "Chuva fraca": "🌦️", "Chuva forte": "⛈️" };
const TURNOS = ["Manhã", "Tarde", "Noite"] as const;
const COLETAS = ["07:00", "12:00", "17:00"] as const;

type Row = { id: string; a: string; b: string; c?: string };
type Foto = { id: string; src: string; legenda: string };
type RDO = {
  obra: string; cliente: string; endereco: string; contrato: string; responsavel: string;
  numero: string; data: string; inicio: string; prazo: string;
  clima: Record<string, Clima>;
  pluvio: Record<string, string>;
  mareHora: string; mareNivel: string;
  horario: string;
  maoDeObra: Row[]; equipamentos: Row[]; atividades: Row[];
  ocorrencias: string; seguranca: string;
  fotos: Foto[];
  assResp: string; assFiscal: string;
};

const uid = () => Math.random().toString(36).slice(2, 9);
const hoje = () => new Date().toISOString().slice(0, 10);
const vazio = (): RDO => ({
  obra: "", cliente: "", endereco: "", contrato: "", responsavel: "",
  numero: "001", data: hoje(), inicio: "", prazo: "",
  clima: { Manhã: "Bom", Tarde: "Bom", Noite: "Bom" },
  pluvio: { "07:00": "", "12:00": "", "17:00": "" },
  mareHora: "", mareNivel: "",
  horario: "07:00 às 17:00",
  maoDeObra: [
    { id: uid(), a: "Pedreiro", b: "4", c: "Direto" },
    { id: uid(), a: "Servente", b: "6", c: "Direto" },
    { id: uid(), a: "Mestre de obras", b: "1", c: "Indireto" },
  ],
  equipamentos: [{ id: uid(), a: "Betoneira 400L", b: "1" }],
  atividades: [{ id: uid(), a: "", b: "" }],
  ocorrencias: "", seguranca: "", fotos: [], assResp: "", assFiscal: "",
});
const somaTipo = (r: RDO, t: string) =>
  r.maoDeObra.filter((m) => (m.c ?? "Direto") === t).reduce((s, m) => s + (Number(m.b) || 0), 0);
const mareTxt = (r: RDO) =>
  r.mareHora || r.mareNivel ? `${r.mareHora || "--:--"} - ${(r.mareNivel || "0").replace(".", ",")} m` : "—";
const KEY = "rdo-atual-v2";
const fmt = (d: string) => (d ? d.split("-").reverse().join("/") : "—");
const diaSemana = (d: string) =>
  d ? new Date(d + "T12:00").toLocaleDateString("pt-BR", { weekday: "long" }) : "";

function Index() {
  const [r, setR] = useState<RDO>(vazio);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    try { const s = localStorage.getItem(KEY); if (s) setR({ ...vazio(), ...JSON.parse(s) }); } catch {}
    setOk(true);
  }, []);
  useEffect(() => {
    if (!ok) return;
    try { localStorage.setItem(KEY, JSON.stringify(r)); } catch {}
  }, [r, ok]);

  const set = <K extends keyof RDO>(k: K, v: RDO[K]) => setR((p) => ({ ...p, [k]: v }));
  const totalEquipe = r.maoDeObra.reduce((s, m) => s + (Number(m.b) || 0), 0);

  const addFotos = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      const img = new Image();
      const url = URL.createObjectURL(f);
      img.onload = () => {
        const max = 1200, k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = img.width * k; c.height = img.height * k;
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        const src = c.toDataURL("image/jpeg", 0.75);
        URL.revokeObjectURL(url);
        setR((p) => ({ ...p, fotos: [...p.fotos, { id: uid(), src, legenda: "" }] }));
      };
      img.src = url;
    });
  };

  const novoDia = () => {
    if (!confirm("Iniciar o RDO do próximo dia? Dados da obra e equipe serão mantidos.")) return;
    setR((p) => ({
      ...p, numero: String((Number(p.numero) || 0) + 1).padStart(3, "0"), data: hoje(),
      atividades: [{ id: uid(), a: "", b: "" }], ocorrencias: "", seguranca: "", fotos: [],
    }));
  };

  return (
    <>
      <div className="no-print min-h-screen pb-28">
        <header className="bg-navy text-navy-foreground">
          <div className="stripes h-2" />
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-safety">Relatório Diário de Obra</p>
              <h1 className="font-display text-3xl font-bold uppercase sm:text-4xl">RDO nº {r.numero || "—"}</h1>
              <p className="text-sm opacity-80">{fmt(r.data)} · {diaSemana(r.data)}</p>
            </div>
            <button onClick={novoDia} className="rounded-md border border-navy-foreground/30 px-3 py-2 text-sm font-medium hover:bg-navy-foreground/10">
              + Próximo dia
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
          <Section n="1" title="Dados da obra">
            <div className="grid gap-3 sm:grid-cols-2">
              <F label="Obra"><input className="field" value={r.obra} onChange={(e) => set("obra", e.target.value)} placeholder="Ex.: Residencial Bela Vista" /></F>
              <F label="Cliente / Contratante"><input className="field" value={r.cliente} onChange={(e) => set("cliente", e.target.value)} /></F>
              <F label="Endereço" wide><input className="field" value={r.endereco} onChange={(e) => set("endereco", e.target.value)} /></F>
              <F label="Responsável técnico"><input className="field" value={r.responsavel} onChange={(e) => set("responsavel", e.target.value)} placeholder="Eng. Nome – CREA" /></F>
              <F label="Contrato / ART"><input className="field" value={r.contrato} onChange={(e) => set("contrato", e.target.value)} /></F>
              <F label="Nº do RDO"><input className="field" value={r.numero} onChange={(e) => set("numero", e.target.value)} /></F>
              <F label="Data"><input type="date" className="field" value={r.data} onChange={(e) => set("data", e.target.value)} /></F>
              <F label="Início da obra"><input type="date" className="field" value={r.inicio} onChange={(e) => set("inicio", e.target.value)} /></F>
              <F label="Prazo previsto"><input type="date" className="field" value={r.prazo} onChange={(e) => set("prazo", e.target.value)} /></F>
            </div>
          </Section>

          <Section n="2" title="Condições climáticas">
            <div className="space-y-3">
              {TURNOS.map((t) => (
                <div key={t} className="flex flex-wrap items-center gap-2">
                  <span className="w-16 text-sm font-semibold">{t}</span>
                  {CLIMAS.map((c) => {
                    const on = r.clima[t] === c;
                    return (
                      <button key={c} onClick={() => set("clima", { ...r.clima, [t]: c })}
                        className={`rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-safety bg-safety text-safety-foreground font-semibold" : "bg-card hover:border-safety"}`}>
                        {CLIMA_ICON[c]} {c}
                      </button>
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
                      <input className="field" inputMode="decimal" placeholder="0,0" value={r.pluvio[h] ?? ""} onChange={(e) => set("pluvio", { ...r.pluvio, [h]: e.target.value })} />
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

          <Section n="3" title={`Mão de obra · Efetivo ${totalEquipe}`}>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              {[["Direto", somaTipo(r, "Direto")], ["Indireto", somaTipo(r, "Indireto")], ["Efetivo total", totalEquipe]].map(([l, v], i) => (
                <div key={l} className={`rounded-lg border px-2 py-2 ${i === 2 ? "bg-navy text-navy-foreground" : "bg-muted"}`}>
                  <div className="text-[10px] font-semibold uppercase opacity-80">{l}</div>
                  <div className="font-display text-2xl font-bold">{v}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex gap-2 text-xs font-semibold uppercase text-muted-foreground"><span className="flex-1">Função</span><span className="w-28">Efetivo</span><span className="w-20">Qtd.</span><span className="w-9" /></div>
              {r.maoDeObra.map((x) => {
                const up = (k: "a" | "b" | "c", v: string) => set("maoDeObra", r.maoDeObra.map((y) => (y.id === x.id ? { ...y, [k]: v } : y)));
                return (
                  <div key={x.id} className="flex gap-2">
                    <input className="field flex-1" value={x.a} onChange={(e) => up("a", e.target.value)} />
                    <select className="field w-28" value={x.c ?? "Direto"} onChange={(e) => up("c", e.target.value)}>
                      <option>Direto</option><option>Indireto</option>
                    </select>
                    <input className="field w-20" inputMode="numeric" placeholder="0" value={x.b} onChange={(e) => up("b", e.target.value)} />
                    <button onClick={() => set("maoDeObra", r.maoDeObra.filter((y) => y.id !== x.id))} className="w-9 rounded-md border text-muted-foreground hover:text-destructive" aria-label="Remover">×</button>
                  </div>
                );
              })}
              <button onClick={() => set("maoDeObra", [...r.maoDeObra, { id: uid(), a: "", b: "", c: "Direto" }])} className="text-sm font-semibold text-accent-foreground hover:underline">+ Adicionar função</button>
            </div>
          </Section>

          <Section n="4" title="Equipamentos">
            <Rows rows={r.equipamentos} onChange={(v) => set("equipamentos", v)} la="Equipamento" lb="Qtd." pb="0" numeric />
          </Section>

          <Section n="5" title="Atividades executadas">
            <Rows rows={r.atividades} onChange={(v) => set("atividades", v)} la="Descrição do serviço" lb="% avanço" pb="0-100" numeric />
          </Section>

          <Section n="6" title="Ocorrências e observações">
            <div className="grid gap-3">
              <F label="Ocorrências / observações gerais"><textarea rows={4} className="field" value={r.ocorrencias} onChange={(e) => set("ocorrencias", e.target.value)} placeholder="Atrasos de material, visitas, interferências..." /></F>
              <F label="Segurança do trabalho"><textarea rows={2} className="field" value={r.seguranca} onChange={(e) => set("seguranca", e.target.value)} placeholder="Uso de EPIs, DDS realizado, incidentes..." /></F>
            </div>
          </Section>

          <Section n="7" title={`Registro fotográfico · ${r.fotos.length}`}>
            <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-safety/60 bg-accent px-4 py-6 text-sm font-semibold text-accent-foreground hover:bg-accent/70">
              📷 Adicionar fotos
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFotos(e.target.files); e.target.value = ""; }} />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {r.fotos.map((f) => (
                <div key={f.id} className="overflow-hidden rounded-lg border bg-card">
                  <div className="relative">
                    <img src={f.src} alt={f.legenda || "Foto da obra"} className="aspect-[4/3] w-full object-cover" />
                    <button onClick={() => set("fotos", r.fotos.filter((x) => x.id !== f.id))} className="absolute right-1 top-1 rounded bg-destructive px-2 text-sm text-destructive-foreground">×</button>
                  </div>
                  <input className="w-full border-t bg-card px-2 py-1.5 text-sm outline-none" placeholder="Legenda" value={f.legenda}
                    onChange={(e) => set("fotos", r.fotos.map((x) => (x.id === f.id ? { ...x, legenda: e.target.value } : x)))} />
                </div>
              ))}
            </div>
          </Section>

          <Section n="8" title="Assinaturas">
            <div className="grid gap-3 sm:grid-cols-2">
              <F label="Responsável pela obra"><input className="field" value={r.assResp} onChange={(e) => set("assResp", e.target.value)} /></F>
              <F label="Fiscalização / Cliente"><input className="field" value={r.assFiscal} onChange={(e) => set("assFiscal", e.target.value)} /></F>
            </div>
          </Section>
        </main>

        <div className="fixed inset-x-0 bottom-0 border-t bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl gap-3 px-4 py-3">
            <button onClick={() => confirm("Limpar todo o formulário?") && setR(vazio())} className="rounded-md border px-4 py-3 text-sm font-medium">Limpar</button>
            <button onClick={() => window.print()} className="flex-1 rounded-md bg-safety px-4 py-3 font-display text-lg font-bold uppercase text-safety-foreground shadow-lg hover:brightness-105">
              Exportar PDF
            </button>
          </div>
        </div>
      </div>

      <PrintView r={r} total={totalEquipe} />
    </>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="mb-4 flex items-center gap-3 font-display text-xl font-bold uppercase text-primary">
        <span className="grid h-8 w-8 place-items-center rounded bg-safety text-base text-safety-foreground">{n}</span>
        {title}
      </h2>
      {children}
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
          <button onClick={() => onChange(rows.filter((y) => y.id !== x.id))} className="w-9 rounded-md border text-muted-foreground hover:text-destructive" aria-label="Remover">×</button>
        </div>
      ))}
      <button onClick={() => onChange([...rows, { id: uid(), a: "", b: "" }])} className="text-sm font-semibold text-accent-foreground hover:underline">+ Adicionar linha</button>
    </div>
  );
}

/* ---------- PDF / impressão ---------- */
function PH({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 mt-4 border-l-4 border-safety bg-navy px-2 py-1 font-display text-sm font-bold uppercase text-navy-foreground">{children}</div>;
}
function PrintView({ r, total }: { r: RDO; total: number }) {
  const filled = (rows: Row[]) => rows.filter((x) => x.a.trim());
  return (
    <div className="print-only text-[11px] text-foreground">
      <div className="stripes h-2" />
      <div className="flex items-end justify-between bg-navy px-4 py-3 text-navy-foreground">
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-widest text-safety">Relatório Diário de Obra</div>
          <div className="font-display text-2xl font-bold uppercase">{r.obra || "Obra"}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-xl font-bold">RDO Nº {r.numero}</div>
          <div>{fmt(r.data)} · {diaSemana(r.data)}</div>
        </div>
      </div>

      <table className="mt-2 w-full border-collapse">
        <tbody>
          {[["Cliente", r.cliente, "Contrato / ART", r.contrato], ["Endereço", r.endereco, "Resp. técnico", r.responsavel], ["Início", fmt(r.inicio), "Prazo previsto", fmt(r.prazo)]].map((l, i) => (
            <tr key={i} className="border-b">
              <td className="w-24 bg-muted px-2 py-1 font-semibold">{l[0]}</td><td className="px-2 py-1">{l[1] || "—"}</td>
              <td className="w-28 bg-muted px-2 py-1 font-semibold">{l[2]}</td><td className="px-2 py-1">{l[3] || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <PH>Condições climáticas · Horário: {r.horario}</PH>
      <div className="grid grid-cols-3 gap-2">
        {TURNOS.map((t) => (
          <div key={t} className="rounded border px-2 py-1.5 text-center">
            <div className="text-[9px] uppercase text-muted-foreground">{t}</div>
            <div className="font-semibold">{CLIMA_ICON[r.clima[t] ?? "Bom"]} {r.clima[t] ?? "Bom"}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {COLETAS.map((h) => (
          <div key={h} className="rounded border px-2 py-1.5 text-center">
            <div className="text-[9px] uppercase text-muted-foreground">Pluviômetro {h}</div>
            <div className="font-semibold">{r.pluvio[h] ? `${r.pluvio[h]} mm` : "—"}</div>
          </div>
        ))}
        <div className="rounded border border-safety px-2 py-1.5 text-center">
          <div className="text-[9px] uppercase text-muted-foreground">Maré máxima</div>
          <div className="font-semibold">{mareTxt(r)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="avoid-break">
          <PH>Mão de obra · Efetivo {total}</PH>
          <table className="w-full border-collapse">
            <thead><tr className="bg-muted text-left"><th className="px-2 py-1">Função</th><th className="px-2 py-1">Efetivo</th><th className="w-12 px-2 py-1 text-right">Qtd.</th></tr></thead>
            <tbody>
              {filled(r.maoDeObra).map((x) => <tr key={x.id} className="border-b"><td className="px-2 py-1">{x.a}</td><td className="px-2 py-1">{x.c ?? "Direto"}</td><td className="px-2 py-1 text-right font-semibold">{x.b}</td></tr>)}
              <tr className="bg-muted"><td className="px-2 py-1 font-semibold" colSpan={2}>Direto</td><td className="px-2 py-1 text-right font-semibold">{somaTipo(r, "Direto")}</td></tr>
              <tr className="bg-muted"><td className="px-2 py-1 font-semibold" colSpan={2}>Indireto</td><td className="px-2 py-1 text-right font-semibold">{somaTipo(r, "Indireto")}</td></tr>
              <tr className="bg-navy text-navy-foreground"><td className="px-2 py-1 font-bold" colSpan={2}>Efetivo total</td><td className="px-2 py-1 text-right font-bold">{total}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="avoid-break">
          <PH>Equipamentos</PH>
          <PTable rows={filled(r.equipamentos)} ha="Equipamento" hb="Qtd." />
        </div>
      </div>

      <div className="avoid-break">
        <PH>Atividades executadas</PH>
        <table className="w-full border-collapse">
          <thead><tr className="bg-muted text-left"><th className="px-2 py-1">Descrição</th><th className="w-40 px-2 py-1">Avanço</th></tr></thead>
          <tbody>
            {filled(r.atividades).map((x) => {
              const p = Math.max(0, Math.min(100, Number(x.b) || 0));
              return (
                <tr key={x.id} className="border-b">
                  <td className="px-2 py-1">{x.a}</td>
                  <td className="px-2 py-1"><div className="flex items-center gap-2"><div className="h-2 flex-1 rounded bg-muted"><div className="h-2 rounded bg-safety" style={{ width: `${p}%` }} /></div><span className="w-8 text-right font-semibold">{p}%</span></div></td>
                </tr>
              );
            })}
            {!filled(r.atividades).length && <tr><td className="px-2 py-1 text-muted-foreground" colSpan={2}>Nenhuma atividade registrada.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="avoid-break">
        <PH>Ocorrências e observações</PH>
        <p className="min-h-8 whitespace-pre-wrap rounded border px-2 py-1.5">{r.ocorrencias || "Sem ocorrências."}</p>
        {r.seguranca && (<><div className="mt-2 font-semibold">Segurança do trabalho</div><p className="whitespace-pre-wrap rounded border px-2 py-1.5">{r.seguranca}</p></>)}
      </div>

      {r.fotos.length > 0 && (
        <>
          <PH>Registro fotográfico</PH>
          <div className="grid grid-cols-3 gap-2">
            {r.fotos.map((f, i) => (
              <figure key={f.id} className="avoid-break overflow-hidden rounded border">
                <img src={f.src} alt={f.legenda} className="aspect-[4/3] w-full object-cover" />
                <figcaption className="px-1.5 py-1 text-[9px]"><b>Foto {i + 1}.</b> {f.legenda}</figcaption>
              </figure>
            ))}
          </div>
        </>
      )}

      <div className="avoid-break mt-12 grid grid-cols-2 gap-10 text-center">
        {[["Responsável pela obra", r.assResp], ["Fiscalização / Cliente", r.assFiscal]].map(([l, n]) => (
          <div key={l}><div className="border-t border-foreground pt-1 font-semibold">{n || " "}</div><div className="text-[9px] uppercase text-muted-foreground">{l}</div></div>
        ))}
      </div>
      <div className="stripes mt-6 h-1.5" />
    </div>
  );
}
function PTable({ rows, ha, hb }: { rows: Row[]; ha: string; hb: string }) {
  return (
    <table className="w-full border-collapse">
      <thead><tr className="bg-muted text-left"><th className="px-2 py-1">{ha}</th><th className="w-12 px-2 py-1 text-right">{hb}</th></tr></thead>
      <tbody>
        {rows.map((x) => <tr key={x.id} className="border-b"><td className="px-2 py-1">{x.a}</td><td className="px-2 py-1 text-right font-semibold">{x.b}</td></tr>)}
        {!rows.length && <tr><td colSpan={2} className="px-2 py-1 text-muted-foreground">—</td></tr>}
      </tbody>
    </table>
  );
}
