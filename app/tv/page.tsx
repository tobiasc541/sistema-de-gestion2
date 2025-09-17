"use client";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { supabase, hasSupabase } from "../../lib/supabaseClient";


/* =========================
   Tipos y helpers
========================= */
type Ticket = {
  id: string;
  client_name?: string | null;
  client_number?: number | null;
  action?: string | null;
  status: "En cola" | "Aceptado" | "Cancelado";
  box?: number | null;
  accepted_by?: string | null;
  accepted_at?: string | null;
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const hhmmss = (d = new Date()) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

function speak(text: string) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-AR";
    u.rate = 1;   // voz normal
    u.pitch = 1;  // voz normal
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}

/* Paletas fijas (Tailwind JIT necesita clases explícitas) */
const PALETTES = [
  { ring: "ring-emerald-500", bg: "bg-emerald-900/60", title: "text-emerald-300", chip: "bg-emerald-500 text-black" },
  { ring: "ring-sky-500",     bg: "bg-sky-900/60",     title: "text-sky-300",     chip: "bg-sky-500 text-black" },
  { ring: "ring-fuchsia-500", bg: "bg-fuchsia-900/60", title: "text-fuchsia-300", chip: "bg-fuchsia-500 text-black" },
  { ring: "ring-amber-500",   bg: "bg-amber-900/60",   title: "text-amber-300",   chip: "bg-amber-500 text-black" },
  { ring: "ring-violet-500",  bg: "bg-violet-900/60",  title: "text-violet-300",  chip: "bg-violet-500 text-black" },
  { ring: "ring-rose-500",    bg: "bg-rose-900/60",    title: "text-rose-300",    chip: "bg-rose-500 text-black" },
  { ring: "ring-cyan-500",    bg: "bg-cyan-900/60",    title: "text-cyan-300",    chip: "bg-cyan-500 text-black" },
  { ring: "ring-lime-500",    bg: "bg-lime-900/60",    title: "text-lime-300",    chip: "bg-lime-500 text-black" },
];

const hashStr = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0) % PALETTES.length;
};
const pickPalette = (t: Ticket) => PALETTES[hashStr((t.client_name ?? t.id) + String(t.box ?? ""))];

/* =========================
   Wrapper con Suspense (arregla el error)
========================= */
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-3xl">Cargando…</div>}>
      <TVClient />
    </Suspense>
  );
}

/* =========================
   Componente cliente real
========================= */
function TVClient() {
const [isDark, setIsDark] = useState(true);

useEffect(() => {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const theme = (params.get("theme") || "dark").toLowerCase();
    setIsDark(theme !== "light");
  }
}, []);


  const [pending, setPending] = useState<Ticket[]>([]);
  const [accepted, setAccepted] = useState<Ticket[]>([]);
  const [now, setNow] = useState(new Date());

  // ids ocultos luego del anuncio de 5s (no vuelven a renderizar aunque sigan en la DB)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const hiddenIdsRef = useRef(hiddenIds);
  useEffect(() => { hiddenIdsRef.current = hiddenIds; }, [hiddenIds]);

  // spotlight: anuncio gigante durante 5s
  const [spotlight, setSpotlight] = useState<Ticket | null>(null);

  const lastSpokenId = useRef<string | null>(null);
  const clock = useMemo(() => hhmmss(now), [now]);

  async function fetchTickets() {
    if (!hasSupabase) return;
    const { data, error } = await supabase
      .from("tickets")
      .select("id, client_name, client_number, action, status, box, accepted_by, accepted_at")
      .in("status", ["En cola", "Aceptado"])
      .order("accepted_at", { ascending: false, nullsFirst: true })
      .limit(100);

    if (error) return;

    const hid = hiddenIdsRef.current;
    const pend = (data || []).filter((t) => t.status === "En cola" && !hid.has(t.id));
    const acc  = (data || []).filter((t) => t.status === "Aceptado" && !hid.has(t.id));

    setPending(pend);
    setAccepted(acc);
  }

  /* Poll suave + reloj */
  useEffect(() => {
    fetchTickets();
    const t = setInterval(() => { setNow(new Date()); fetchTickets(); }, 5000);
    return () => clearInterval(t);
  }, []);

  /* Suscripción en tiempo real */
  useEffect(() => {
    if (!hasSupabase) return;
    const ch = supabase
      .channel("tv-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, async (payload: any) => {
        const r = (payload.new || {}) as Ticket;
        await fetchTickets();

        // Cuando pasa a Aceptado => voz + anuncio gigante 5s + ocultar luego
        if (r.status === "Aceptado" && r.id !== lastSpokenId.current && !hiddenIdsRef.current.has(r.id)) {
          const nombre = r.client_name || "Cliente";
          const caja = r.box || 1;

          speak(`${nombre}, puede pasar a la caja ${caja}`);
          lastSpokenId.current = r.id;
          setSpotlight(r);

          setTimeout(() => {
            // al terminar el anuncio: ocultamos de ambas columnas
            setHiddenIds((prev) => {
              const next = new Set(prev);
              next.add(r.id);
              return next;
            });
            setAccepted((prev) => prev.filter((x) => x.id !== r.id));
            setPending((prev) => prev.filter((x) => x.id !== r.id));
            setSpotlight(null);
          }, 5000);
        }
      })
      .subscribe();

    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, []);

  /* =========================
     Render
  ========================= */
  return (
    <div className={`min-h-screen p-6 flex flex-col ${isDark ? "bg-black text-white" : "bg-white text-slate-900"}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-6xl font-extrabold tracking-tight">
          Turnos — <span className="text-emerald-400">{clock}</span>
        </h1>
        <button
          onClick={fetchTickets}
          className={`rounded-2xl px-6 py-3 text-xl border transition
            ${isDark ? "bg-slate-800 hover:bg-slate-700 border-slate-700" : "bg-slate-100 hover:bg-slate-200 border-slate-300"}
          `}
        >
          Actualizar
        </button>
      </div>

      {/* Dos columnas */}
      <div className="flex-1 grid grid-cols-2 gap-8">
        {/* En cola */}
        <section className={`rounded-3xl p-6 border-4 ${isDark ? "border-yellow-500 bg-slate-900/80" : "border-yellow-400 bg-yellow-50"}`}>
          <header className="text-5xl font-black mb-4 flex items-center gap-3">
            <span className="text-yellow-400">En cola</span>
            <span className="text-sm font-semibold px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
              {pending.length}
            </span>
          </header>

          {pending.length === 0 ? (
            <div className={`text-2xl ${isDark ? "text-slate-400" : "text-slate-500"}`}>Sin turnos pendientes.</div>
          ) : (
            <div className="space-y-4">
              {pending.map((t) => {
                const p = pickPalette(t);
                return (
                  <article
                    key={t.id}
                    className={`rounded-2xl ring-4 p-5 ${p.ring} ${isDark ? p.bg : "bg-white"} shadow-lg`}
                  >
                    <div className={`text-4xl font-extrabold ${p.title} break-words`}>
                      {t.client_name || "Cliente"}
                    </div>
                    <div className={`mt-1 text-xl ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                      {t.action || "—"} {t.client_number ? `— N° ${t.client_number}` : ""}
                    </div>
                    <div className="mt-3 inline-flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${p.chip}`}>En cola</span>
                      {t.box ? <span className="px-3 py-1 rounded-full text-sm bg-slate-700/30 border border-slate-600/40">Caja {t.box}</span> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Aceptados */}
        <section className={`rounded-3xl p-6 border-4 ${isDark ? "border-green-500 bg-slate-900/80" : "border-green-400 bg-green-50"}`}>
          <header className="text-5xl font-black mb-4 flex items-center gap-3">
            <span className="text-green-400">Clientes aceptados</span>
            <span className="text-sm font-semibold px-3 py-1 rounded-full bg-green-500/20 text-green-300 border border-green-500/40">
              {accepted.length}
            </span>
          </header>

          {accepted.length === 0 ? (
            <div className={`text-2xl ${isDark ? "text-slate-400" : "text-slate-600"}`}>Aún no hay aceptados.</div>
          ) : (
            <div className="space-y-4">
              {accepted.map((t) => {
                const p = pickPalette(t);
                return (
                  <article
                    key={t.id}
                    className={`rounded-2xl ring-4 p-5 ${p.ring} ${isDark ? "bg-black" : "bg-white"} shadow-lg`}
                  >
                    <div className={`text-4xl font-extrabold ${p.title} break-words`}>
                      {t.client_name || "Cliente"} — Caja {t.box || 1}
                    </div>
                    <div className={`mt-1 text-xl ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                      Aceptado {t.accepted_by ? `por ${t.accepted_by}` : ""}{" "}
                      {t.accepted_at
                        ? `— ${new Date(t.accepted_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                        : ""}
                    </div>
                    <div className="mt-3 inline-flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${p.chip}`}>¡Aceptado!</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer className={`mt-6 text-center ${isDark ? "text-slate-500" : "text-slate-500"}`}>
        Sistema de Gestión — Pantalla de Turnos
      </footer>

      {/* Spotlight: anuncio gigante 5s al aceptar */}
      {spotlight && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80">
          <div className="text-center px-8">
            <div className="text-7xl md:text-9xl font-black text-white drop-shadow">
              {spotlight.client_name || "Cliente"}
            </div>
            <div className="mt-6 text-5xl md:text-7xl font-extrabold text-emerald-400">
              Pase a la <span className="underline decoration-emerald-500">Caja {spotlight.box || 1}</span>
            </div>
            <div className="mt-4 text-2xl text-slate-300">
              {spotlight.action || ""}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
