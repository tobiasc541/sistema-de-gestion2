"use client";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import React, { useEffect, useMemo, useState } from "react";
import { supabase, hasSupabase } from "../../lib/supabaseClient";

/** === Tipos mínimos según tu tabla tickets === */
type Ticket = {
  id: string;
  client_name?: string | null;
  client_number?: number | null;
  action?: string | null;
  status: "En cola" | "Aceptado" | "Cancelado";
  box?: number | null;
  accepted_by?: string | null;
  accepted_at?: string | null; // timestamptz en Supabase
};

/** === Utils === */
const pad2 = (n: number) => String(n).padStart(2, "0");
function hhmmss(d = new Date()) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function speak(text: string) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-AR";
    u.rate = 1;
    u.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}

/** === Página TV === */
export default function TVPage() {
  const [pending, setPending] = useState<Ticket[]>([]);
  const [accepted, setAccepted] = useState<Ticket[]>([]);
  const [now, setNow] = useState(new Date());
  const clock = useMemo(() => hhmmss(now), [now]);

  /** === Carga inicial + polling suave cada 5 s === */
  async function fetchTickets() {
    if (!hasSupabase) return;
    // Importante: NO filtramos por “hora actual” porque en tu tabla
    // no hay un created_at visible. Mostramos los últimos 30 relevantes.
    const { data, error } = await supabase
      .from("tickets")
      .select(
        "id, client_name, client_number, action, status, box, accepted_by, accepted_at"
      )
      .in("status", ["En cola", "Aceptado"])
      .order("accepted_at", { ascending: false, nullsFirst: true })
      .limit(60);
    if (error) return;

    const pend = (data || []).filter((t) => t.status === "En cola");
    const acc = (data || []).filter((t) => t.status === "Aceptado");

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** === Realtime (INSERT/UPDATE) sobre tickets === */
  useEffect(() => {
    if (!hasSupabase) return;
    const ch = supabase
      .channel("tv-tickets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        async (payload: any) => {
          // Actualizamos lista completa (más simple y robusto)
          await fetchTickets();

          // Si pasó a Aceptado, avisamos por voz
          const r = (payload.new || {}) as Ticket;
          if (r.status === "Aceptado") {
            const nombre = r.client_name || "Cliente";
            const caja = r.box || 1;
            speak(`${nombre}, puede pasar a la caja ${caja}`);
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(ch);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** === UI === */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Turnos — <span className="text-emerald-400">{clock}</span>
          </h1>
          <button
            onClick={fetchTickets}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 text-sm"
          >
            Actualizar
          </button>
        </div>

        {/* Grilla columnas */}
        <div className="grid md:grid-cols-2 gap-5">
          {/* En cola */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-lg font-semibold mb-3">En cola</div>

            {pending.length === 0 && (
              <div className="text-slate-400 text-sm">
                Sin turnos en esta hora.
              </div>
            )}

            <div className="space-y-3">
              {pending.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate text-lg">
                      {t.client_name || "Cliente"}
                    </div>
                    <div className="text-sm text-slate-300 truncate">
                      {t.action || "—"}{" "}
                      {t.client_number ? `— N° ${t.client_number}` : ""}
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex rounded-full border border-amber-700/40 bg-amber-800/30 px-3 py-1 text-xs font-semibold">
                    En cola
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Aceptados */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-lg font-semibold mb-3">Aceptados</div>

            {accepted.length === 0 && (
              <div className="text-slate-400 text-sm">Aún no hay aceptados.</div>
            )}

            <div className="space-y-3">
              {accepted.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-semibold truncate text-lg">
                        {t.client_name || "Cliente"} —{" "}
                        <span className="font-bold">
                          Caja {t.box || 1}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        Aceptado por {t.accepted_by || "—"} —{" "}
                        {t.accepted_at
                          ? new Date(t.accepted_at).toLocaleTimeString(
                              "es-AR",
                              { hour: "2-digit", minute: "2-digit", second: "2-digit" }
                            )
                          : "—"}
                      </div>
                    </div>
                    <span className="shrink-0 inline-flex rounded-full border border-emerald-700/40 bg-emerald-800/30 px-3 py-1 text-xs font-semibold">
                      Aceptado
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Marca inferior */}
        <div className="mt-8 text-[11px] text-slate-500">
          Sistema de Gestión — Pantalla de Turnos
        </div>
      </div>
    </div>
  );
}
