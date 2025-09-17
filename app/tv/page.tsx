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
const hhmm = (d = new Date()) =>
  `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

const SHOW_ACCEPTED_MS = 120_000; // 2 minutos visibles
const SPOTLIGHT_MS = 5_000; // Spotlight 5s

function speak(text: string, enabled: boolean) {
  try {
    if (!enabled) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-AR";
    u.rate = 1;
    u.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}

/* Paletas fijas */
const PALETTES = [
  { ring: "ring-emerald-500", bg: "bg-emerald-900/60", title: "text-emerald-300" },
  { ring: "ring-sky-500", bg: "bg-sky-900/60", title: "text-sky-300" },
  { ring: "ring-fuchsia-500", bg: "bg-fuchsia-900/60", title: "text-fuchsia-300" },
  { ring: "ring-amber-500", bg: "bg-amber-900/60", title: "text-amber-300" },
  { ring: "ring-violet-500", bg: "bg-violet-900/60", title: "text-violet-300" },
  { ring: "ring-rose-500", bg: "bg-rose-900/60", title: "text-rose-300" },
  { ring: "ring-cyan-500", bg: "bg-cyan-900/60", title: "text-cyan-300" },
  { ring: "ring-lime-500", bg: "bg-lime-900/60", title: "text-lime-300" },
];

const hashStr = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0) % PALETTES.length;
};
const pickPalette = (t: Ticket) =>
  PALETTES[hashStr((t.client_name ?? t.id) + String(t.box ?? ""))];

/* =========================
   Wrapper con Suspense
========================= */
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xl md:text-2xl">Cargando…</div>}>
      <TVClient />
    </Suspense>
  );
}

/* =========================
   Componente cliente real
========================= */
function TVClient() {
  const [isDark, setIsDark] = useState(true);
  const [soundOn, setSoundOn] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const theme = (params.get("theme") || "dark").toLowerCase();
      setIsDark(theme !== "light");

      const saved = localStorage.getItem("tv-sound-on");
      if (saved !== null) setSoundOn(saved === "1");
    }
  }, []);

  const toggleSound = () => {
    setSoundOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("tv-sound-on", next ? "1" : "0");
      } catch {}
      return next;
    });
    try {
      window?.speechSynthesis?.resume?.();
    } catch {}
  };

  const [pending, setPending] = useState<Ticket[]>([]);
  const [accepted, setAccepted] = useState<Ticket[]>([]);
  const [now, setNow] = useState(new Date());

  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const hiddenIdsRef = useRef(hiddenIds);
  useEffect(() => {
    hiddenIdsRef.current = hiddenIds;
  }, [hiddenIds]);

  const [spotlight, setSpotlight] = useState<Ticket | null>(null);
  const lastSpokenId = useRef<string | null>(null);
  const clock = useMemo(() => hhmm(now), [now]);

  async function fetchTickets() {
    if (!hasSupabase) return;
    const { data, error } = await supabase
      .from("tickets")
      .select(
        "id, client_name, client_number, action, status, box, accepted_by, accepted_at"
      )
      .in("status", ["En cola", "Aceptado"])
      .order("accepted_at", { ascending: false, nullsFirst: true })
      .limit(100);
    if (error) return;

    const nowTs = Date.now();
    const hid = hiddenIdsRef.current;

    const pend = (data || []).filter(
      (t) => t.status === "En cola" && !hid.has(t.id)
    );

    const acc = (data || []).filter((t) => {
      if (t.status !== "Aceptado" || hid.has(t.id)) return false;
      if (!t.accepted_at) return true;
      const ts = new Date(t.accepted_at).getTime();
      return nowTs - ts < SHOW_ACCEPTED_MS;
    });

    setPending(pend);
    setAccepted(acc);
  }

  useEffect(() => {
    fetchTickets();
    const t = setInterval(() => {
      setNow(new Date());
      fetchTickets();
    }, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!hasSupabase) return;
    const ch = supabase
      .channel("tv-tickets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        async (payload: any) => {
          const r = (payload.new || {}) as Ticket;
          await fetchTickets();

          if (
            r.status === "Aceptado" &&
            r.id !== lastSpokenId.current &&
            !hiddenIdsRef.current.has(r.id)
          ) {
            const nombre = r.client_name || "Cliente";
            const caja = r.box || 1;

            speak(`${nombre}, puede pasar a la caja ${caja}`, soundOn);
            lastSpokenId.current = r.id;
            setSpotlight(r);

            setTimeout(
              () => setSpotlight((s) => (s?.id === r.id ? null : s)),
              SPOTLIGHT_MS
            );

            setTimeout(() => {
              setHiddenIds((prev) => {
                const next = new Set(prev);
                next.add(r.id);
                return next;
              });
              setAccepted((prev) => prev.filter((x) => x.id !== r.id));
            }, SHOW_ACCEPTED_MS);
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(ch);
      } catch {}
    };
  }, [soundOn]);

  /* =========================
     Render principal
  ========================= */
  return (
    <div
      className={`h-screen overflow-hidden flex flex-col ${
        isDark ? "bg-black text-white" : "bg-white text-slate-900"
      }`}
    >
      <div className="max-w-screen-2xl w-full mx-auto flex-1 min-h-0 flex flex-col">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight">
            Turnos — <span className="text-emerald-400">{clock}</span>
          </h1>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleSound}
              title={soundOn ? "Desactivar sonido" : "Activar sonido"}
              className={`rounded-lg px-3 py-2 text-sm border transition ${
                isDark
                  ? "bg-slate-800 hover:bg-slate-700 border-slate-700"
                  : "bg-slate-100 hover:bg-slate-200 border-slate-300"
              }`}
            >
              {soundOn ? "🔊" : "🔈"}
            </button>

            <button
              onClick={fetchTickets}
              className={`rounded-lg px-4 py-2 text-sm md:text-base border transition ${
                isDark
                  ? "bg-slate-800 hover:bg-slate-700 border-slate-700"
                  : "bg-slate-100 hover:bg-slate-200 border-slate-300"
              }`}
            >
              Actualizar
            </button>
          </div>
        </div>

        {/* Dos columnas */}
        <div className="grid grid-cols-2 gap-6 px-6 pb-6 flex-1 min-h-0 overflow-hidden">
          {/* En fila */}
          <section
            className={`rounded-2xl p-6 border-4 ${
              isDark
                ? "border-yellow-500 bg-slate-900/80"
                : "border-yellow-400 bg-yellow-50"
            } flex flex-col min-h-0`}
          >
            <header className="shrink-0 text-xl font-black mb-3 flex items-center gap-2">
              <span className="text-yellow-400">En fila</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                {pending.length}
              </span>
            </header>

            {/* Lista con scroll infinito */}
            <div className="flex-1 overflow-y-auto pr-2">
              {pending.length === 0 ? (
                <div
                  className={`text-base ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Sin turnos pendientes.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {pending.map((t) => {
                    const p = pickPalette(t);
                    return (
                      <article
                        key={t.id}
                        className={`rounded-lg ring-1 p-2 ${p.ring} ${
                          isDark ? p.bg : "bg-white"
                        } shadow-md`}
                      >
                        <div
                          className={`text-lg font-extrabold ${p.title} break-words`}
                        >
                          {t.client_name || "Cliente"}
                        </div>
                        <div
                          className={`mt-1 text-sm ${
                            isDark ? "text-slate-300" : "text-slate-600"
                          }`}
                        >
                          {t.action || ""}{" "}
                          {t.client_number ? `— N° ${t.client_number}` : ""}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Aceptados */}
          <section
            className={`rounded-2xl p-6 border-4 ${
              isDark
                ? "border-green-500 bg-slate-900/80"
                : "border-green-400 bg-green-50"
            } flex flex-col min-h-0`}
          >
            <header className="shrink-0 text-xl font-black mb-3 flex items-center gap-2">
              <span className="text-green-400">Clientes aceptados</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/40">
                {accepted.length}
              </span>
            </header>

            <div className="flex-1 overflow-y-auto pr-2">
              {accepted.length === 0 ? (
                <div
                  className={`text-base ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  Aún no hay aceptados.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {accepted.map((t) => {
                    const p = pickPalette(t);
                    return (
                      <article
                        key={t.id}
                        className={`rounded-lg ring-1 p-2 ${p.ring} ${
                          isDark ? "bg-black" : "bg-white"
                        } shadow-md`}
                      >
                        <div className="text-lg font-extrabold break-words">
                          {t.client_name || "Cliente"} — Caja {t.box || 1}
                        </div>
                        <div
                          className={`mt-1 text-sm ${
                            isDark ? "text-slate-400" : "text-slate-600"
                          }`}
                        >
                          Aceptado {t.accepted_by ? `por ${t.accepted_by}` : ""}{" "}
                          {t.accepted_at
                            ? `— ${new Date(t.accepted_at).toLocaleTimeString(
                                "es-AR",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                }
                              )}`
                            : ""}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 pb-4 text-center text-xs text-slate-500">
          Sistema de Gestión — Pantalla de Turnos
        </div>
      </div>

      {/* Spotlight */}
      {spotlight && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80">
          <div className="text-center px-8">
            <div className="text-4xl font-black text-white drop-shadow">
              {spotlight.client_name || "Cliente"}
            </div>
            <div className="mt-4 text-2xl font-extrabold text-emerald-400">
              Pase a la{" "}
              <span className="underline decoration-emerald-500">
                Caja {spotlight.box || 1}
              </span>
            </div>
            <div className="mt-3 text-lg text-slate-300">
              {spotlight.action || ""}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
