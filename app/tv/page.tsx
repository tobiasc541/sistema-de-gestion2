"use client";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { supabase, hasSupabase } from "../../lib/supabaseClient";

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

export default function TVPage() {
  const [pending, setPending] = useState<Ticket[]>([]);
  const [accepted, setAccepted] = useState<Ticket[]>([]);
  const [now, setNow] = useState(new Date());
  const lastSpokenId = useRef<string | null>(null);

  const clock = useMemo(() => hhmmss(now), [now]);

  async function fetchTickets() {
    if (!hasSupabase) return;
    const { data, error } = await supabase
      .from("tickets")
      .select("id, client_name, client_number, action, status, box, accepted_by, accepted_at")
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
  }, []);

  useEffect(() => {
    if (!hasSupabase) return;
    const ch = supabase
      .channel("tv-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, async (payload: any) => {
        await fetchTickets();

        const r = (payload.new || {}) as Ticket;
        if (r.status === "Aceptado" && r.id !== lastSpokenId.current) {
          const nombre = r.client_name || "Cliente";
          const caja = r.box || 1;
          speak(`${nombre}, puede pasar a la caja ${caja}`);
          lastSpokenId.current = r.id;

          // auto-remover en 15 segundos
          setTimeout(() => {
            setAccepted((prev) => prev.filter((x) => x.id !== r.id));
          }, 15000);
        }
      })
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(ch);
      } catch {}
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-6 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-5xl font-extrabold">
          Turnos — <span className="text-emerald-400">{clock}</span>
        </h1>
        <button
          onClick={fetchTickets}
          className="rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-6 py-3 text-lg"
        >
          Actualizar
        </button>
      </div>

      {/* Grilla columnas */}
      <div className="flex-1 grid grid-cols-2 gap-8">
        {/* En cola */}
        <div className="rounded-2xl border-4 border-yellow-500 bg-slate-900/80 p-6">
          <div className="text-4xl font-bold mb-4 text-yellow-400">En cola</div>
          {pending.length === 0 && <div className="text-slate-400 text-2xl">Sin turnos pendientes.</div>}
          <div className="space-y-4">
            {pending.map((t) => (
              <div key={t.id} className="rounded-xl border-2 border-yellow-500 bg-black p-4">
                <div className="text-3xl font-extrabold">{t.client_name || "Cliente"}</div>
                <div className="text-xl text-slate-300">
                  {t.action || "—"} {t.client_number ? `— N° ${t.client_number}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Aceptados */}
        <div className="rounded-2xl border-4 border-green-500 bg-slate-900/80 p-6">
          <div className="text-4xl font-bold mb-4 text-green-400">Clientes aceptados</div>
          {accepted.length === 0 && <div className="text-slate-400 text-2xl">Aún no hay aceptados.</div>}
          <div className="space-y-4">
            {accepted.map((t) => (
              <div key={t.id} className="rounded-xl border-4 border-green-500 bg-black p-4 animate-pulse">
                <div className="text-4xl font-extrabold text-green-400">
                  {t.client_name || "Cliente"} — Caja {t.box || 1}
                </div>
                <div className="text-xl text-slate-400">
                  Aceptado por {t.accepted_by || "—"} —{" "}
                  {t.accepted_at
                    ? new Date(t.accepted_at).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })
                    : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-lg text-slate-500 text-center">
        Sistema de Gestión — Pantalla de Turnos
      </div>
    </div>
  );
}
