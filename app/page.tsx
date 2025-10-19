"use client";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import React, { useEffect, useState } from "react";
import "./globals.css";
import { supabase, hasSupabase } from "../lib/supabaseClient";

/* ===== helpers ===== */
const pad = (n: number, width = 8) => String(n).padStart(width, "0");
const money = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(
    isNaN(n as any) ? 0 : n || 0
  );
const parseNum = (v: any) => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? "0").replace(",", "."));
  return isNaN(x) ? 0 : x;
};
const todayISO = () => new Date().toISOString();
const clone = (obj: any) => JSON.parse(JSON.stringify(obj));

/* ===== seed inicial (solo UI mientras carga Supabase) ===== */
function seedState() {
  return {
   meta: {
  invoiceCounter: 1,
  budgetCounter: 1,
  lastSavedInvoiceId: null as null | string,
  cashFloat: 0,
  cashFloatByDate: {} as Record<string, number>,
  commissionsByDate: {} as Record<string, number>,   // 👈 NUEVO
},



    auth: { adminKey: "46892389" },
    vendors: [] as any[],
    clients: [] as any[],
    products: [] as any[],
    invoices: [] as any[],
    budgets: [] as any[],
    gastos: [] as any[],
    devoluciones: [] as any[],  // <--- AGREGAR ESTO
    queue: [] as any[],
  };
}


/* ===== Carga/actualización desde Supabase ===== */
async function loadFromSupabase(fallback: any) {
  if (!hasSupabase) return fallback;
  const out = clone(fallback);
  

// meta
const { data: meta, error: metaErr } = await supabase
  .from("meta").select("*").eq("key","counters").maybeSingle();
if (metaErr) { console.error("SELECT meta:", metaErr); alert("No pude leer 'meta' de Supabase."); }
if (meta?.value) out.meta = { ...out.meta, ...meta.value };

// 👇👇👇 AGREGAR AQUÍ - Cargar comisiones
const { data: commissionsData, error: commErr } = await supabase
  .from("commissions")
  .select("*");

if (commErr) {
  console.error("SELECT commissions:", commErr);
} else if (commissionsData) {
  const commissionsByDate: Record<string, number> = {};
  commissionsData.forEach((row: any) => {
    commissionsByDate[row.day] = parseNum(row.amount);
  });
  out.meta.commissionsByDate = commissionsByDate;
}
// 👆👆👆 HASTA AQUÍ

// vendors (esto ya existe, DEJARLO COMO ESTÁ)
const { data: vendors, error: vendErr } = await supabase.from("vendors").select("*");
if (vendErr) { console.error("SELECT vendors:", vendErr); alert("No pude leer 'vendors' de Supabase."); }
if (vendors) out.vendors = vendors;
  // clients
const { data: clients, error: cliErr } = await supabase.from("clients").select("*");
if (cliErr) { console.error("SELECT clients:", cliErr); alert("No pude leer 'clients' de Supabase."); }
if (clients) out.clients = clients;


// products
const { data: products, error: prodErr } = await supabase.from("products").select("*");
if (prodErr) { console.error("SELECT products:", prodErr); alert("No pude leer 'products' de Supabase."); }
if (products) out.products = products;

// invoices
const { data: invoices, error: invErr } = await supabase.from("invoices").select("*").order("number");
if (invErr) { console.error("SELECT invoices:", invErr); alert("No pude leer 'invoices' de Supabase."); }
if (invoices) out.invoices = invoices;

// devoluciones
const { data: devoluciones, error: devErr } = await supabase
  .from("devoluciones").select("*").order("date_iso",{ascending:false});
if (devErr) { console.error("SELECT devoluciones:", devErr); alert("No pude leer 'devoluciones' de Supabase."); }
if (devoluciones) out.devoluciones = devoluciones;

// budgets
const { data: budgets, error: budErr } = await supabase.from("budgets").select("*").order("number");
if (budErr) { console.error("SELECT budgets:", budErr); alert("No pude leer 'budgets' de Supabase."); }
if (budgets) out.budgets = budgets;


 // Si está vacío, NO sembrar datos de ejemplo (nada de demo).
if (!out.vendors?.length && !out.clients?.length && !out.products?.length) {

  // Solo aseguro counters en meta para que la app no falle.
  await supabase.from("meta").upsert({
    key: "counters",
    value: {
      invoiceCounter: 1,
      budgetCounter: 1,
      cashFloat: out.meta?.cashFloat ?? 0,
      cashFloatByDate: out.meta?.cashFloatByDate ?? {},
       commissionsByDate: out.meta?.commissionsByDate ?? {},  // 👈
    },
  });

  return out;
}
    return out;               // <-- agrega este return si faltaba
}   


async function saveCountersSupabase(meta: any) {
  if (!hasSupabase) return;
  await supabase.from("meta").upsert({
    key: "counters",
    value: {
      invoiceCounter: meta.invoiceCounter,
      budgetCounter: meta.budgetCounter,
      cashFloat: meta.cashFloat ?? 0,
      cashFloatByDate: meta.cashFloatByDate ?? {},
       commissionsByDate: meta.commissionsByDate ?? {},   // 👈
    },
  });
}



/* ====== UI atoms ====== */
function Card({ title, actions, className = "", children }: any) {
  return (
    <div className={"rounded-2xl border border-slate-800 bg-slate-900/60 p-4 " + className}>
      {(title || actions) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h3 className="text-sm font-semibold text-slate-200">{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
function Button({ children, onClick, type = "button", tone = "emerald", className = "", disabled }: any) {
  const map: any = {
    emerald: "bg-emerald-600 hover:bg-emerald-500 border-emerald-700/50",
    slate: "bg-slate-700 hover:bg-slate-600 border-slate-700",
    red: "bg-red-600 hover:bg-red-500 border-red-700/50",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold shadow-sm border disabled:opacity-60 ${map[tone]} ${className}`}
    >
      {children}
    </button>
  );
}
function Input({ label, value, onChange, placeholder = "", type = "text", className = "", disabled }: any) {
  return (
    <label className="block w-full">
      {label && <div className="text-xs text-slate-300 mb-1">{label}</div>}
      <input
        value={value}
        type={type}
        onChange={(e) => onChange && onChange((e.target as HTMLInputElement).value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60 ${className}`}
      />
    </label>
  );
}
const NumberInput = (props: any) => <Input {...props} type="text" />;
function Select({ label, value, onChange, options, className = "" }: any) {
  return (
    <label className="block w-full">
      {label && <div className="text-xs text-slate-300 mb-1">{label}</div>}
      <select
        value={value}
        onChange={(e) => onChange && onChange((e.target as HTMLSelectElement).value)}
        className={`w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 ${className}`}
      >
        {options.map((o: any) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
const Chip = ({ children, tone = "slate" }: any) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
      tone === "emerald" ? "bg-emerald-800/40 text-emerald-200 border-emerald-700/40" : "bg-slate-800/60 text-slate-200 border-slate-700/50"
    } border`}
  >
    {children}
  </span>
);

/* ===== helpers de negocio ===== */
function ensureUniqueNumber(clients: any[]) {
  const max = clients.reduce((m, c) => Math.max(m, c.number || 0), 1000);
  return max + 1;
}
function calcInvoiceTotal(items: any[]) {
  return items.reduce((s, it) => s + parseNum(it.qty) * parseNum(it.unitPrice), 0);
}
function calcInvoiceCost(items: any[]) {
  return items.reduce((s, it) => s + parseNum(it.qty) * parseNum(it.cost || 0), 0);
}
function groupBy(arr: any[], key: string) {
  return arr.reduce((acc: any, it: any) => {
    const k = it[key] || "Otros";
    (acc[k] = acc[k] || []).push(it);
    return acc;
  }, {} as any);
}
// === Gasto del mes por cliente ===
function gastoMesCliente(state: any, clientId: string, refDate = new Date()) {
  const y = refDate.getFullYear();
  const m = refDate.getMonth();
  const start = new Date(y, m, 1, 0, 0, 0, 0).getTime();
  const end   = new Date(y, m + 1, 0, 23, 59, 59, 999).getTime();

  // Ventas del mes (solo Facturas)
  const factMes = (state.invoices || [])
    .filter((f: any) =>
      f.type === "Factura" &&
      f.client_id === clientId &&
      (() => { const t = new Date(f.date_iso).getTime(); return t >= start && t <= end; })()
    )
    .reduce((s: number, f: any) => s + parseNum(f.total), 0);

  // Devoluciones del mes del cliente
  const devsMes = (state.devoluciones || [])
    .filter((d: any) =>
      d.client_id === clientId &&
      (() => { const t = new Date(d.date_iso).getTime(); return t >= start && t <= end; })()
    );

  // Restan al gasto si son devolución en efectivo/transferencia/saldo
  const devRestables = devsMes
    .filter((d: any) => ["efectivo", "transferencia", "saldo"].includes(String(d.metodo)))
    .reduce((s: number, d: any) => s + parseNum(d.total), 0);

  // En intercambio por OTRO producto, sumamos solo la diferencia que abonó
  const extrasIntercambio = devsMes
    .filter((d: any) => d.metodo === "intercambio_otro")
    .reduce(
      (s: number, d: any) =>
        s + parseNum(d.extra_pago_efectivo || 0) + parseNum(d.extra_pago_transferencia || 0),
      0
    );

  // Intercambio del mismo producto no cambia el gasto
  return Math.max(0, factMes - devRestables + extrasIntercambio);
}


/* ===== Navbar ===== */
function Navbar({ current, setCurrent, role, onLogout }: any) {
 const TABS = [
  "Facturación",
  "Clientes",
  "Productos",
  "Deudores",
  "Vendedores",
  "Reportes",
  "Presupuestos",
  "Gastos y Devoluciones", // <-- AGREGAR ESTA
  "Cola"
];


   const visibleTabs =
    role === "admin"
      ? TABS
      : role === "vendedor"
     ? ["Facturación", "Clientes", "Productos", "Deudores", "Presupuestos", "Gastos y Devoluciones", "Cola"]
      : ["Panel"];


  return (
    <div className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="text-sm font-bold tracking-wide">💼 Facturación — {hasSupabase ? "By : Tobias carrizo" : "Local"}</div>
        <nav className="flex-1 flex gap-1 flex-wrap">
          {visibleTabs.map((t) => (
            <button
              key={t}
              onClick={() => setCurrent(t)}
              className={`px-3 py-1.5 rounded-xl text-sm border ${
                current === t ? "bg-emerald-600 border-emerald-700" : "bg-slate-900/60 border-slate-800 hover:bg-slate-800"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
        <button onClick={onLogout} className="ml-auto text-xs text-slate-400 hover:text-slate-200">
          Salir
        </button>
      </div>
    </div>
  );
}

/* ===== Panel del cliente ===== */
function ClientePanel({ state, setState, session }: any) {
  const [accion, setAccion] = useState<"COMPRAR POR MAYOR" | "COMPRAR POR MENOR">("COMPRAR POR MAYOR");

  function genTicketCode() {
    const a = Math.random().toString(36).slice(2, 6);
    const b = Date.now().toString(36).slice(-5);
    return ("T-" + a + "-" + b).toUpperCase();
  }

  async function continuar() {
    const code = genTicketCode();
    const ticket = {
      id: code,
      date_iso: todayISO(),
      client_id: session.id,
      client_number: session.number,
      client_name: session.name,
      action: accion,
      status: "En cola" as const,
    };

    // guardar ticket en la cola local
    const st = clone(state);
    st.queue = Array.isArray(st.queue) ? st.queue : [];
    st.queue.push(ticket);
    setState(st);

    // guardar en Supabase (si está disponible)
    if (hasSupabase) {
      await supabase.from("tickets").insert(ticket);
    }

    // imprimir ticket
    window.dispatchEvent(new CustomEvent("print-ticket", { detail: ticket } as any));
    await nextPaint();
    window.print();
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <Card title="Bienvenido/a">
        <div className="text-sm mb-2">
          Cliente: <b>{session.name}</b> — N° <b>{session.number}</b>
        </div>
        <div className="grid gap-3">
          <Select
            label="¿Qué desea hacer?"
            value={accion}
            onChange={setAccion}
            options={[
              { value: "COMPRAR POR MENOR", label: "COMPRAR POR MENOR" },
              { value: "COMPRAR POR MAYOR", label: "COMPRAR POR MAYOR" },
            ]}
          />
          <div className="flex justify-end">
            <Button onClick={continuar}>Continuar</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* =====================  TABS  ===================== */
/* Facturación */
function FacturacionTab({ state, setState, session }: any) {
  
  const [clientId, setClientId] = useState(state.clients[0]?.id || "");
  const [vendorId, setVendorId] = useState(session.role === "admin" ? state.vendors[0]?.id : session.id);
  const [priceList, setPriceList] = useState("1");
  const [sectionFilter, setSectionFilter] = useState("Todas");
  const [listFilter, setListFilter] = useState("Todas");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
 const [payCash, setPayCash] = useState("");
const [payTransf, setPayTransf] = useState("");
const [payChange, setPayChange] = useState(""); // vuelto (opcional)
const [alias, setAlias] = useState("");

  const client = state.clients.find((c: any) => c.id === clientId);
  const vendor = state.vendors.find((v: any) => v.id === vendorId);

  const sections = ["Todas", ...Array.from(new Set(state.products.map((p: any) => p.section || "Otros")))];
  const lists = ["Todas", ...Array.from(new Set(state.products.map((p: any) => p.list_label || "General")))];

  const filteredProducts = state.products.filter((p: any) => {
    const okS = sectionFilter === "Todas" || p.section === sectionFilter;
    const okL = listFilter === "Todas" || p.list_label === listFilter;
    const okQ = !query || p.name.toLowerCase().includes(query.toLowerCase());
    return okS && okL && okQ;
  });

  function addItem(p: any) {
    const existing = items.find((it: any) => it.productId === p.id);
    const unit = priceList === "1" ? p.price1 : p.price2;
    if (existing) setItems(items.map((it) => (it.productId === p.id ? { ...it, qty: parseNum(it.qty) + 1 } : it)));
    else setItems([...items, { productId: p.id, name: p.name, section: p.section, qty: 1, unitPrice: unit, cost: p.cost }]);
  }

  async function saveAndPrint() {
    if (!client || !vendor) return alert("Seleccioná cliente y vendedor.");
    if (items.length === 0) return alert("Agregá productos al carrito.");
    

 const total = calcInvoiceTotal(items);
const cash  = parseNum(payCash);
const transf = parseNum(payTransf);
const suggestedChange = Math.max(0, cash - Math.max(0, total - transf));
const change = payChange.trim() === "" ? suggestedChange : Math.max(0, parseNum(payChange));
if (change > cash) return alert("El vuelto no puede ser mayor al efectivo entregado.");

const st = clone(state);
const number = st.meta.invoiceCounter++;
const id = "inv_" + number;

// 1) Consumir saldo a favor del cliente ANTES de calcular deuda
const cl = st.clients.find((c:any) => c.id === client.id)!;
const saldoActual = parseNum(cl.saldo_favor || 0);
const saldoAplicado = Math.min(total, saldoActual);
const totalTrasSaldo = total - saldoAplicado;

// 2) Lo efectivamente aplicado por pagos (efectivo+transf - vuelto)
const applied = Math.max(0, cash + transf - change);

// 3) Deuda que queda luego de aplicar saldo y pagos
const debtDelta = Math.max(0, totalTrasSaldo - applied);
const status = debtDelta > 0 ? "No Pagada" : "Pagada";

// 4) Actualizar cliente: bajar saldo_favor, subir deuda si corresponde
cl.saldo_favor = saldoActual - saldoAplicado;
cl.debt = parseNum(cl.debt) + debtDelta;

const invoice = {
  id,
  number,
  date_iso: todayISO(),
  client_id: client.id,
  client_name: client.name,
  vendor_id: vendor.id,
  vendor_name: vendor.name,
  items: clone(items),
  total,                              // total original
  total_after_credit: totalTrasSaldo, // NUEVO (opcional, para saber el impacto)
  cost: calcInvoiceCost(items),
  payments: { cash, transfer: transf, change, alias: alias.trim(), saldo_aplicado: saldoAplicado }, // NUEVO campo informativo
  status,
  type: "Factura",
  client_debt_total: cl.debt,
};

st.invoices.push(invoice);
st.meta.lastSavedInvoiceId = id;
setState(st);

if (hasSupabase) {
  await supabase.from("invoices").insert(invoice);
  await supabase.from("clients").update({ debt: cl.debt, saldo_favor: cl.saldo_favor }).eq("id", client.id);
  await saveCountersSupabase(st.meta);
}




    window.dispatchEvent(new CustomEvent("print-invoice", { detail: invoice } as any));
    await nextPaint();
    window.print();
     // 🔽 AHORA sí, limpiar la UI
  setPayCash("");
  setPayTransf("");
  setPayChange("");
  setAlias("");
  setItems([]);
  }

const total = calcInvoiceTotal(items);
const cash = parseNum(payCash);
const transf = parseNum(payTransf);

// Vuelto sugerido automáticamente: solo sale del EFECTIVO
const suggestedChange = Math.max(0, cash - Math.max(0, total - transf));
// Si el usuario no escribió nada, usamos el sugerido
const change = payChange.trim() === "" ? suggestedChange : Math.max(0, parseNum(payChange));

const paid = cash + transf;                               // lo que ENTREGÓ el cliente
const applied = Math.max(0, cash + transf - change);      // lo que realmente se aplica a la factura
const toPay = Math.max(0, total - applied);

  const grouped = groupBy(filteredProducts, "section");

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      <div className="grid md:grid-cols-3 gap-4">
        <Card title="Encabezado">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Cliente"
              value={clientId}
              onChange={setClientId}
              options={state.clients.map((c: any) => ({ value: c.id, label: `${c.number} — ${c.name}` }))}
            />
            <Select
              label="Vendedor"
              value={vendorId}
              onChange={setVendorId}
              options={state.vendors.map((v: any) => ({ value: v.id, label: v.name }))}
            />
      <div className="col-span-2 text-xs text-slate-300 mt-1">
  Deuda del cliente: <span className="font-semibold">
    {money(state.clients.find((c:any)=>c.id===clientId)?.debt || 0)}
  </span>
  <span className="mx-2">·</span>
  Saldo a favor: <span className="font-semibold">
    {money(state.clients.find((c:any)=>c.id===clientId)?.saldo_favor || 0)}
  </span>
  <span className="mx-2">·</span>
  Gastado este mes: <span className="font-semibold">{money(gastoMesCliente(state, clientId))}</span>
</div>


            <Select
              label="Lista de precios"
              value={priceList}
              onChange={setPriceList}
              options={[
                { value: "1", label: "Mitobicel" },
                { value: "2", label: "ElshoppingDlc" },
              ]}
            />
          </div>
        </Card>

       <Card title="Pagos">
  <div className="grid grid-cols-2 gap-3 items-end">
    <NumberInput label="Efectivo" value={payCash} onChange={setPayCash} placeholder="0" />
    <NumberInput label="Transferencia" value={payTransf} onChange={setPayTransf} placeholder="0" />

    {/* Vuelto + ayuda (sugerido) */}
    <div className="space-y-1">
      <NumberInput
        label="Vuelto (efectivo)"
        value={payChange}
        onChange={setPayChange}
        placeholder="0"
      />
      {payChange.trim() === "" && (
        <div className="text-[11px] text-slate-400">
          Sugerido: {money(suggestedChange)}
        </div>
      )}
    </div>

    {/* Alias/CVU alineado con Vuelto */}
    <div className="self-end">
      <Input
        label="Alias / CVU destino"
        value={alias}
        onChange={setAlias}
        placeholder="ej: mitobicel.algo.banco"
      />
    </div>

    <div className="col-span-2 text-xs text-slate-300">
      Pagado: <span className="font-semibold">{money(paid)}</span> — Falta:{" "}
      <span className="font-semibold">{money(toPay)}</span> — Vuelto:{" "}
      <span className="font-semibold">{money(change)}</span>
    </div>
  </div>
</Card>


        <Card title="Totales">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Subtotal</span>
              <span>{money(total)}</span>
            </div>
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button onClick={saveAndPrint} className="shadow-lg">
                Guardar e Imprimir
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Productos">
        <div className="grid md:grid-cols-4 gap-2 mb-3">
          <Select label="Sección" value={sectionFilter} onChange={setSectionFilter} options={sections.map((s: any) => ({ value: s, label: s }))} />
          <Select label="Lista" value={listFilter} onChange={setListFilter} options={lists.map((s: any) => ({ value: s, label: s }))} />
          <Input label="Buscar" value={query} onChange={setQuery} placeholder="Nombre del producto..." />
          <div className="pt-6">
            <Chip tone="emerald">Total productos: {filteredProducts.length}</Chip>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            {Object.entries(grouped).map(([sec, arr]: any) => (
              <div key={sec} className="border border-slate-800 rounded-xl">
                <div className="px-3 py-2 text-xs font-semibold bg-slate-800/70">{sec}</div>
                <div className="divide-y divide-slate-800">
                  {arr.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-xs text-slate-400">
                          Mitobicel: {money(p.price1)} · ElshoppingDlc: {money(p.price2)} <span className="text-[10px] text-slate-500 ml-1">{p.list_label}</span>
                        </div>
                      </div>
                      <Button onClick={() => addItem(p)} tone="slate" className="shrink-0">
                        Añadir
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold">Carrito</div>
            <div className="rounded-xl border border-slate-800 divide-y divide-slate-800">
              {items.length === 0 && <div className="p-3 text-sm text-slate-400">Vacío</div>}
              {items.map((it, idx) => (
                <div key={idx} className="p-3 grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-6">
                    <div className="text-sm font-medium">{it.name}</div>
                    <div className="text-xs text-slate-400">{it.section}</div>
                  </div>
                  <div className="col-span-2">
                    <NumberInput
                      label="Cant."
                      value={it.qty}
                      onChange={(v: any) => {
                        const q = Math.max(0, parseNum(v));
                        setItems(items.map((x, i) => (i === idx ? { ...x, qty: q } : x)));
                      }}
                    />
                  </div>
                  <div className="col-span-3">
                    <NumberInput
                      label="Precio"
                      value={it.unitPrice}
                      onChange={(v: any) => {
                        const q = Math.max(0, parseNum(v));
                        setItems(items.map((x, i) => (i === idx ? { ...x, unitPrice: q } : x)));
                      }}
                    />
                  </div>
                  <div className="col-span-1 flex items-end justify-end pb-0.5">
                    <button onClick={() => setItems(items.filter((_: any, i: number) => i !== idx))} className="text-xs text-red-400 hover:text-red-300">
                      ✕
                    </button>
                  </div>
                  <div className="col-span-12 text-right text-xs text-slate-300 pt-1">
                    Subtotal ítem: {money(parseNum(it.qty) * parseNum(it.unitPrice))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* Clientes */
function ClientesTab({ state, setState }: any) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState(ensureUniqueNumber(state.clients));

  async function addClient() {
    if (!name.trim()) return;
  const newClient = {
  id: "c" + Math.random().toString(36).slice(2, 8),
  number: parseInt(String(number), 10),
  name: name.trim(),
  debt: 0,
  saldo_favor: 0, // <--- NUEVO (saldo a favor)
};


    const st = clone(state);
    st.clients.push(newClient);
    setState(st);
    setName("");
    setNumber(ensureUniqueNumber(st.clients));

    if (hasSupabase) {
      await supabase.from("clients").insert(newClient);
    }
  }

  // Ordeno opcionalmente por número para que quede prolijo
  const clients = Array.isArray(state.clients)
    ? [...state.clients].sort((a: any, b: any) => (a.number || 0) - (b.number || 0))
    : [];

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <Card title="Agregar cliente">
        <div className="grid md:grid-cols-3 gap-3">
          <NumberInput label="N° cliente" value={number} onChange={setNumber} />
          <Input label="Nombre" value={name} onChange={setName} placeholder="Ej: Kiosco 9 de Julio" />
          <div className="pt-6">
            <Button onClick={addClient}>Agregar</Button>
          </div>
        </div>
      </Card>

     <Card title="Listado">
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm">
      <thead className="text-left text-slate-400">
        <tr>
          <th className="py-2 pr-4">N°</th>
          <th className="py-2 pr-4">Nombre</th>
          <th className="py-2 pr-4">Deuda</th>
          <th className="py-2 pr-4">Saldo a favor</th>
          <th className="py-2 pr-4">Gasto mes</th>
        </tr>
      </thead>

      <tbody className="divide-y divide-slate-800">
        {clients.map((c: any) => (
          <tr key={c.id}>
            <td className="py-2 pr-4">{c.number}</td>
            <td className="py-2 pr-4">{c.name}</td>
            <td className="py-2 pr-4">{money(c.debt || 0)}</td>
            <td className="py-2 pr-4">{money(c.saldo_favor || 0)}</td> {/* aquí va */}
            <td className="py-2 pr-4">{money(gastoMesCliente(state, c.id))}</td>
          </tr>
        ))}

        {clients.length === 0 && (
          <tr>
            <td className="py-2 pr-4 text-slate-400" colSpan={5}>
              Sin clientes cargados.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
      </Card>
    </div>
  );
}



/* Productos */
function ProductosTab({ state, setState, role }: any) {
    // Filtrar productos que están bajo el stock mínimo
  const productosBajoStock = state.products.filter(
    (p: any) => parseNum(p.stock) < parseNum(p.stock_minimo || 0)
  );

  const [name, setName] = useState("");
  const [section, setSection] = useState("");
  const [list_label, setListLabel] = useState("MITOBICEL");
  const [price1, setPrice1] = useState("");
  const [price2, setPrice2] = useState("");
  const [cost, setCost] = useState("");
  const [stock, setStock] = useState("");

  const [secFilter, setSecFilter] = useState("Todas");
  const [listFilter, setListFilter] = useState("Todas");
  const [q, setQ] = useState("");

  // creación dinámica de secciones
  const [newSection, setNewSection] = useState("");
  const [extraSections, setExtraSections] = useState<string[]>([]);

// Sin secciones predefinidas: solo las que existen en tu DB o las que agregues
const derivedSections: string[] = Array.from(
  new Set(
    state.products
      .map((p: any) => String(p.section ?? "").trim())
      .filter((s: string) => !!s)
  )
);
const sections: string[] = Array.from(new Set<string>([...derivedSections, ...extraSections]));


  const lists = ["MITOBICEL", "ELSHOPPINGDLC", "General"];

  async function addProduct() {
    if (!name.trim()) return;
    if (!section.trim()) {
  alert("Elegí una sección o creá una nueva.");
  return;
}

   const product = {
  id: "p" + Math.random().toString(36).slice(2, 8),
  name: name.trim(),
  section,
  list_label,
  price1: parseNum(price1),
  price2: parseNum(price2),
  cost: parseNum(cost),
  stock: parseNum(stock),
  stock_minimo: 0,
};


    const st = clone(state);
    st.products.push(product);
    setState(st);
    setName("");
    setPrice1("");
    setPrice2("");
    setCost("");
    if (hasSupabase) await supabase.from("products").insert(product);
  }

  function addSection() {
    const s = newSection.trim();
    if (!s) return;
    const exists = sections.some((x: string) => x.toLowerCase() === s.toLowerCase());
    if (exists) {
      alert("Esa sección ya existe.");
      return;
    }
    setExtraSections([...extraSections, s]);
    setNewSection("");
    setSection(s);
  }

  const filtered = state.products.filter((p: any) => {
    const okS = secFilter === "Todas" || p.section === secFilter;
    const okL = listFilter === "Todas" || p.list_label === listFilter;
    const okQ = !q || p.name.toLowerCase().includes(q.toLowerCase());
    return okS && okL && okQ;
  });
  

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      {productosBajoStock.length > 0 && (
  <Card title="⚠️ Productos con bajo stock">
    <ul className="list-disc pl-5 text-sm text-red-400">
      {productosBajoStock.map((p: any) => (
        <li key={p.id}>
          {p.name} – Stock actual: {p.stock}, Mínimo: {p.stock_minimo}
        </li>
      ))}
    </ul>
  </Card>
)}
      <Card title="Crear sección">
        <div className="grid md:grid-cols-3 gap-3">
          <Input label="Nombre de la sección" value={newSection} onChange={setNewSection} placeholder="Ej: Perfumería, Librería…" />
          <div className="pt-6">
            <Button onClick={addSection}>Agregar sección</Button>
          </div>
        </div>
      </Card>

      <Card title="Crear producto">
        <div className="grid md:grid-cols-6 gap-3">
          <Input label="Nombre" value={name} onChange={setName} className="md:col-span-2" />
          <Select
  label="Sección"
  value={section}
  onChange={setSection}
  options={[
    { value: "", label: "— Elegí una sección —" },
    ...sections.map((s: string) => ({ value: s, label: s })),
  ]}
/>

          <Select label="Lista" value={list_label} onChange={setListLabel} options={lists.map((s) => ({ value: s, label: s }))} />
          <NumberInput label="Precio lista Mitobicel" value={price1} onChange={setPrice1} />
          <NumberInput label="Precio lista Elshopping" value={price2} onChange={setPrice2} />
          <NumberInput label="Stock" value={stock} onChange={setStock} />
          {role === "admin" && <NumberInput label="Costo (solo admin)" value={cost} onChange={setCost} />}
          <div className="md:col-span-6">
            <Button onClick={addProduct}>Agregar</Button>
          </div>
        </div>
      </Card>

      <Card title="Listado de productos">
        <div className="grid md:grid-cols-4 gap-2 mb-3">
          <Select label="Sección" value={secFilter} onChange={setSecFilter} options={["Todas", ...sections].map((s: string) => ({ value: s, label: s }))} />
          <Select label="Lista" value={listFilter} onChange={setListFilter} options={["Todas", ...lists].map((s) => ({ value: s, label: s }))} />
          <Input label="Buscar" value={q} onChange={setQ} placeholder="Nombre..." />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
           <thead className="text-left text-slate-400">
  <tr>
    <th className="py-2 pr-4">Nombre</th>
    <th className="py-2 pr-4">Sección</th>
    <th className="py-2 pr-4">Lista</th>
    <th className="py-2 pr-4">Lista 1</th>
    <th className="py-2 pr-4">Lista 2</th>
    {role === "admin" && <th className="py-2 pr-4">Costo</th>}
    <th className="py-2 pr-4">Stock</th>
    <th className="py-2 pr-4">Stock mínimo</th>
  </tr>
</thead>

<tbody className="divide-y divide-slate-800">
  {filtered.map((p: any) => (
    <tr key={p.id}>
      <td className="py-2 pr-4">{p.name}</td>
      <td className="py-2 pr-4">{p.section}</td>
      <td className="py-2 pr-4">{p.list_label}</td>
      <td className="py-2 pr-4">{money(p.price1)}</td>
      <td className="py-2 pr-4">{money(p.price2)}</td>
      {role === "admin" && <td className="py-2 pr-4">{money(p.cost)}</td>}

      {/* Stock actual editable */}
      <td className="py-2 pr-4">
        <NumberInput
          value={p.stock}
          onChange={async (v: any) => {
            const newStock = parseNum(v);
            const st = clone(state);

            const prod = st.products.find((x) => x.id === p.id);
            if (prod) prod.stock = newStock;
            setState(st);

            if (hasSupabase) {
              await supabase.from("products").update({ stock: newStock }).eq("id", p.id);
            }
          }}
        />
      </td>

        {/* Stock mínimo editable */}
      <td className="py-2 pr-4">
        <NumberInput
          value={p.stock_minimo}
          onChange={async (v: any) => {
            const newMin = parseNum(v);
            const st = clone(state);

            const prod = st.products.find((x: any) => x.id === p.id);
            if (prod) prod.stock_minimo = newMin;
            setState(st);

            if (hasSupabase) {
              await supabase.from("products").update({ stock_minimo: newMin }).eq("id", p.id);
            }
          }}
        />
      </td>
    </tr>
  ))}
</tbody>
</table>
</div>
</Card>
</div>
  );
}






/* Deudores */
function DeudoresTab({ state, setState }: any) {
  const clients = state.clients.filter((c: any) => parseNum(c.debt) > 0);
  const [active, setActive] = useState<string | null>(null);
  const [cash, setCash] = useState("");
  const [transf, setTransf] = useState("");
  const [alias, setAlias] = useState("");

  async function registrarPago() {
    const cl = state.clients.find((c: any) => c.id === active);
    if (!cl) return;
    const totalPago = parseNum(cash) + parseNum(transf);
    if (totalPago <= 0) return alert("Importe inválido.");

    const st = clone(state);
    const client = st.clients.find((c: any) => c.id === active)!;

    const aplicado = Math.min(totalPago, client.debt);
    client.debt = Math.max(0, parseNum(client.debt) - aplicado);

    const number = st.meta.invoiceCounter++;
    const id = "inv_" + number;

    const invoice = {
      id,
      number,
      date_iso: todayISO(),
      client_id: client.id,
      client_name: client.name,
      vendor_id: "admin",
      vendor_name: "Admin",
      items: [{ productId: "pago", name: "Cancelación de deuda", section: "Deudas", qty: 1, unitPrice: aplicado, cost: 0 }],
      total: aplicado,
      cost: 0,
      payments: { cash: parseNum(cash), transfer: parseNum(transf), alias: alias.trim() },
      status: "Pago",
      type: "Recibo",
      client_debt_total: client.debt,
    };

    st.invoices.push(invoice);
    st.meta.lastSavedInvoiceId = id;
    setState(st);

    setCash("");
    setTransf("");
    setAlias("");
    setActive(null);

    if (hasSupabase) {
      await supabase.from("invoices").insert(invoice);
      await supabase.from("clients").update({ debt: client.debt }).eq("id", client.id);
      await saveCountersSupabase(st.meta);


    }

    window.dispatchEvent(new CustomEvent("print-invoice", { detail: invoice } as any));
    await nextPaint();
    window.print();
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <Card title="Deudores">
        {clients.length === 0 && <div className="text-sm text-slate-400">Sin deudas.</div>}
        <div className="divide-y divide-slate-800">
          {clients.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between py-2">
              <div className="text-sm">
                <span className="font-medium">{c.name}</span> — <span className="text-slate-300">{money(c.debt)}</span>
              </div>
              <div>
                <Button tone="slate" onClick={() => setActive(c.id)}>
                  Registrar pago
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {active && (
        <Card title="Registrar pago">
          <div className="grid md:grid-cols-4 gap-3">
            <NumberInput label="Efectivo" value={cash} onChange={setCash} />
            <NumberInput label="Transferencia" value={transf} onChange={setTransf} />
            <Input label="Alias/CVU" value={alias} onChange={setAlias} />
            <div className="pt-6">
              <Button onClick={registrarPago}>Guardar e imprimir recibo</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* Cola (vendedor/admin): aceptar / cancelar turnos de la hora actual) */
function ColaTab({ state, setState, session }: any) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Rango de la HORA actual
  function hourRange(d = new Date()) {
    const s = new Date(d);
    s.setMinutes(0, 0, 0);
    const e = new Date(d);
    e.setMinutes(59, 59, 999);
    return { startISO: s.toISOString(), endISO: e.toISOString() };
  }

  async function refresh() {
    setLoading(true);
    const { startISO, endISO } = hourRange();

    if (hasSupabase) {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .gte("date_iso", startISO)
        .lte("date_iso", endISO)
        .order("date_iso", { ascending: true });

      if (!error) setTickets(data || []);
    } else {
      // sin supabase: uso la cola local
      const list = (state.queue || [])
        .filter((t: any) => t.date_iso >= startISO && t.date_iso <= endISO)
        .sort((a: any, b: any) => a.date_iso.localeCompare(b.date_iso));
      setTickets(list);
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();

    // Realtime (si hay Supabase)
    if (hasSupabase) {
      const ch = supabase
        .channel("rt-tickets")
        .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => refresh())
        .subscribe();
      return () => {
        supabase.removeChannel(ch);
      };
    }
  }, []);

  async function accept(t: any, caja = "1") {
    const now = new Date().toISOString();
    const boxVal = Number(caja);

    if (hasSupabase) {
      // Persistir y traer el row actualizado
      const { data, error } = await supabase
        .from("tickets")
        .update({
          status: "Aceptado",
          box: boxVal,
          accepted_by: session?.name ?? "-",
          accepted_at: now,
        })
        .eq("id", t.id)
        .select("*")
        .single();

      if (error) {
        console.error("Supabase UPDATE tickets error:", error);
        alert("No pude marcar el ticket como ACEPTADO en la base.");
        await refresh();
        return;
      }

      // Sincronizar UI con la verdad del server
      setTickets((prev) => prev.map((x) => (x.id === t.id ? data : x)));
      const st = clone(state);
      st.queue = Array.isArray(st.queue) ? st.queue : [];
      const i = st.queue.findIndex((x: any) => x.id === t.id);
      if (i >= 0) st.queue[i] = data;
      setState(st);
    } else {
      // Modo local (sin Supabase)
      const st = clone(state);
      st.queue = Array.isArray(st.queue) ? st.queue : [];
      const i = st.queue.findIndex((x: any) => x.id === t.id);
      if (i >= 0) {
        st.queue[i] = {
          ...st.queue[i],
          status: "Aceptado",
          box: boxVal,
          accepted_by: session?.name ?? session?.id ?? "-",
          accepted_at: now,
        };
      }
      setState(st);
      setTickets((prev) =>
        prev.map((x) =>
          x.id === t.id ? { ...x, status: "Aceptado", box: boxVal, accepted_by: session?.name ?? "-", accepted_at: now } : x
        )
      );
    }

    // Aviso a la TV
    try {
      const bc = new BroadcastChannel("turnos-tv");
      bc.postMessage({ type: "announce", client_name: t.client_name, caja: boxVal });
    } catch {}
    alert(`${t.client_name} puede pasar a la CAJA ${boxVal}`);
  }

  async function cancel(t: any) {
    if (hasSupabase) {
      // Persistir y traer el row actualizado
      const { data, error } = await supabase.from("tickets").update({ status: "Cancelado" }).eq("id", t.id).select("*").single();

      if (error) {
        console.error("Supabase UPDATE tickets cancel:", error);
        alert("No pude CANCELAR el ticket en la base.");
        await refresh();
        return;
      }

      // Sincronizar UI con server
      setTickets((prev) => prev.map((x) => (x.id === t.id ? data : x)));
      const st = clone(state);
      st.queue = Array.isArray(st.queue) ? st.queue : [];
      const i = st.queue.findIndex((x: any) => x.id === t.id);
      if (i >= 0) st.queue[i] = data;
      setState(st);
    } else {
      // Modo local
      const st = clone(state);
      st.queue = Array.isArray(st.queue) ? st.queue : [];
      const i = st.queue.findIndex((x: any) => x.id === t.id);
      if (i >= 0) st.queue[i] = { ...st.queue[i], status: "Cancelado" };
      setState(st);
      setTickets((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: "Cancelado" } : x)));
    }
  }

  const pendientes = tickets.filter((t) => t.status === "En cola");
  const aceptados = tickets.filter((t) => t.status === "Aceptado");

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <Card
        title="Turnos — Hora actual"
        actions={
          <Button tone="slate" onClick={refresh}>
            Actualizar
          </Button>
        }
      >
        {loading && <div className="text-sm text-slate-400">Cargando…</div>}

        {!loading && (
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-semibold mb-2">En cola</div>
              <div className="rounded-xl border border-slate-800 divide-y divide-slate-800">
                {pendientes.length === 0 && <div className="p-3 text-sm text-slate-400">Sin turnos en esta hora.</div>}
                {pendientes.map((t) => (
                  <div key={t.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{t.client_name}</div>
                      <div className="text-xs text-slate-400">
                        #{t.id} · {new Date(t.date_iso).toLocaleTimeString("es-AR")} · {t.action}
                      </div>
                    </div>
                    <div className="shrink-0 flex gap-2">
                      <Button onClick={() => accept(t, "1")}>Aceptar (Caja 1)</Button>
                      <Button tone="red" onClick={() => cancel(t)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-2">Aceptados</div>
              <div className="rounded-xl border border-slate-800 divide-y divide-slate-800">
                {aceptados.length === 0 && <div className="p-3 text-sm text-slate-400">Nadie aceptado aún.</div>}
                {aceptados.map((t) => (
                  <div key={t.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{t.client_name} — Caja {t.box ?? "1"}</div>
                      <div className="text-xs text-slate-400">
                        Aceptado por {t.accepted_by || "—"} · {t.accepted_at ? new Date(t.accepted_at).toLocaleTimeString("es-AR") : "—"}
                      </div>
                    </div>
                    <Chip tone="emerald">Aceptado</Chip>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* Vendedores */
function VendedoresTab({ state, setState }: any) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  async function add() {
    if (!name.trim() || !key.trim()) return;
    const vendor = { id: "v" + Math.random().toString(36).slice(2, 8), name: name.trim(), key: key.trim() };
    const st = clone(state);
    st.vendors.push(vendor);
    setState(st);
    setName("");
    setKey("");
    if (hasSupabase) await supabase.from("vendors").insert(vendor);
  }
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <Card title="Agregar vendedor">
        <div className="grid md:grid-cols-3 gap-3">
          <Input label="Nombre" value={name} onChange={setName} />
          <Input label="Clave" value={key} onChange={setKey} />
          <div className="pt-6">
            <Button onClick={add}>Agregar</Button>
          </div>
        </div>
      </Card>
      <Card title="Listado">
        <div className="divide-y divide-slate-800">
          {state.vendors.map((v: any) => (
            <div key={v.id} className="flex items-center justify-between py-2">
              <div className="text-sm">
                <span className="font-semibold">{v.name}</span> <span className="text-slate-500">({v.id})</span>
              </div>
              <span className="inline-flex text-xs bg-slate-800/60 border border-slate-700/50 rounded-full px-2 py-0.5">Clave: {v.key}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>

  );
}

/* Reportes */
/* Reportes */
/* Reportes */
/* Reportes */
function ReportesTab({ state, setState }: any) {
  // ====== Filtros de fecha ======
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  const thisMonthStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}`;

  const [periodo, setPeriodo] = useState<"dia" | "mes" | "anio">("dia");
  const [dia, setDia] = useState<string>(todayStr);
  const [mes, setMes] = useState<string>(thisMonthStr);
  const [anio, setAnio] = useState<string>(String(today.getFullYear()));

  // --- helpers para vuelto por día ---
  const diaClave = dia; // YYYY-MM-DD del selector
  const cashFloatByDate = (state?.meta?.cashFloatByDate ?? {}) as Record<string, number>;
  const cashFloatTarget = periodo === "dia" ? parseNum(cashFloatByDate[diaClave] ?? 0) : 0;

  async function setCashFloatForDay(nuevo: number) {
    const st = clone(state);
    st.meta.cashFloatByDate = st.meta.cashFloatByDate || {};
    st.meta.cashFloatByDate[diaClave] = nuevo;
    setState(st);

    if (hasSupabase) {
      // dentro de ReportesTab
      await supabase
        .from("cash_floats")
        .upsert(
          { day: diaClave, amount: nuevo, updated_by: "app" }, // <- actualizado
          { onConflict: "day" }
        );
    } else {
      // fallback local (por si no hay supabase)
      await saveCountersSupabase?.(st.meta);
    }
  }

  // --- helpers para comisiones por día ---
  const commissionsByDate = (state?.meta?.commissionsByDate ?? {}) as Record<string, number>;
  const commissionTarget =
    periodo === "dia" ? parseNum(commissionsByDate[diaClave] ?? 0) : 0;

  // Sumar comisiones en el período (sirve para mes/año)
  // ⚠️ Se calcula más abajo porque usa {start, end}
  // const commissionsPeriodo = Object.entries(commissionsByDate).reduce((sum, [k, v]) => {
  //   const t = new Date(`${k}T00:00:00`).getTime();
  //   return t >= start && t <= end ? sum + parseNum(v) : sum;
  // }, 0);

  async function setCommissionForDay(nuevo: number) {
    const st = clone(state);
    st.meta.commissionsByDate = st.meta.commissionsByDate || {};
    st.meta.commissionsByDate[diaClave] = nuevo;
    setState(st);

    if (hasSupabase) {
      await supabase
        .from("commissions")
        .upsert(
          { day: diaClave, amount: nuevo, updated_by: "app" }, // <- session no existe acá
          { onConflict: "day" } // clave única por día
        );
    } else {
      await saveCountersSupabase?.(st.meta);
    }
  }

  // Rango según período
  function rangoActual() {
    let start = new Date(0);
    let end = new Date();
    if (periodo === "dia") {
      const d = new Date(`${dia}T00:00:00`);
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    } else if (periodo === "mes") {
      const [yStr, mStr] = mes.split("-");
      const y = parseInt(yStr || String(today.getFullYear()), 10);
      const m = (parseInt(mStr || String(today.getMonth() + 1), 10) - 1) as number;
      start = new Date(y, m, 1, 0, 0, 0, 0);
      end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    } else {
      const y = parseInt(anio || String(today.getFullYear()), 10);
      start = new Date(y, 0, 1, 0, 0, 0, 0);
      end = new Date(y, 11, 31, 23, 59, 59, 999);
    }
    return { start: start.getTime(), end: end.getTime() };
  }
  const { start, end } = rangoActual();
  // ===== NUEVO: estados para listados traídos por rango =====
const [docsEnRango, setDocsEnRango] = useState<any[]>([]);
const [devolucionesPeriodo, setDevolucionesPeriodo] = useState<any[]>([]);
const [cargandoListados, setCargandoListados] = useState(false);

// ===== NUEVO: mismos límites pero en ISO para consultar a Supabase =====
function rangoActualISO() {
  const { start, end } = rangoActual();
  return { isoStart: new Date(start).toISOString(), isoEnd: new Date(end).toISOString() };
}

// ===== NUEVO: traer facturas y devoluciones por rango, con fallback local =====
useEffect(() => {
  const { isoStart, isoEnd } = rangoActualISO();

  async function fetchListados() {
    setCargandoListados(true);

    if (hasSupabase) {
      // FACTURAS
      const { data: inv, error: e1 } = await supabase
        .from("invoices")
        .select("*")
        .gte("date_iso", isoStart)
        .lte("date_iso", isoEnd)
        .order("date_iso", { ascending: false });
      if (e1) { console.error("SELECT invoices (rango):", e1); alert("No pude leer facturas del período."); }

      // DEVOLUCIONES
      const { data: dev, error: e2 } = await supabase
        .from("devoluciones")
        .select("*")
        .gte("date_iso", isoStart)
        .lte("date_iso", isoEnd)
        .order("date_iso", { ascending: false });
      if (e2) { console.error("SELECT devoluciones (rango):", e2); alert("No pude leer devoluciones del período."); }

      setDocsEnRango(inv || []);
      setDevolucionesPeriodo(dev || []);
    } else {
      // Fallback local si no hay Supabase
      const docs = (state.invoices || []).filter((f:any) => {
        const t = new Date(f.date_iso).getTime();
        return t >= start && t <= end;
      });
      const devs = (state.devoluciones || []).filter((d:any) => {
        const t = new Date(d.date_iso).getTime();
        return t >= start && t <= end;
      });
      setDocsEnRango(docs);
      setDevolucionesPeriodo(devs);
    }

    setCargandoListados(false);
  }

  fetchListados();
  // refresca cuando cambia el período o cuando guardaste una venta
}, [periodo, dia, mes, anio, state.meta?.lastSavedInvoiceId]);


  // ✅ Ahora sí: comisiones del período usando start/end
  const commissionsPeriodo = Object.entries(commissionsByDate).reduce((sum, [k, v]) => {
    const t = new Date(`${k}T00:00:00`).getTime();
    return t >= start && t <= end ? sum + parseNum(v) : sum;
  }, 0);

  // Documentos dentro del rango


  // Ventas (solo Facturas)
  const invoices = docsEnRango.filter((f: any) => f.type === "Factura");
  const totalVentas = invoices.reduce((s: number, f: any) => s + parseNum(f.total), 0);

  // Pagos
  const totalVuelto  = invoices.reduce((s: number, f: any) => s + parseNum(f?.payments?.change), 0);
  const totalEfectivo = invoices.reduce((s: number, f: any) => s + parseNum(f?.payments?.cash), 0);
  const totalEfectivoNeto = totalEfectivo - totalVuelto; // flujo real de caja
  const totalTransf = invoices.reduce((s: number, f: any) => s + parseNum(f?.payments?.transfer), 0);
  // Vuelto restante para el día (solo aplica si periodo === "dia")
  const vueltoRestante = periodo === "dia" ? Math.max(0, cashFloatTarget - totalVuelto) : 0;

  // Ganancia estimada
  const ganancia = invoices.reduce((s: number, f: any) => s + (parseNum(f.total) - parseNum(f.cost)), 0);

  // GASTOS del período
  const gastosPeriodo = (state.gastos || []).filter((g: any) => {
    const t = new Date(g.date_iso).getTime();
    return t >= start && t <= end;
  });
  const totalGastos = gastosPeriodo.reduce((s: number, g: any) => s + parseNum(g.efectivo) + parseNum(g.transferencia), 0);
  const totalGastosEfectivo = gastosPeriodo.reduce((s: number, g: any) => s + parseNum(g.efectivo), 0);
  const totalGastosTransferencia = gastosPeriodo.reduce((s: number, g: any) => s + parseNum(g.transferencia), 0);

  // Transferencias de GASTOS agrupadas por alias
  const transferenciasPorAlias = (() => {
    const m: Record<string, number> = {};
    gastosPeriodo.forEach((g: any) => {
      const tr = parseNum(g.transferencia);
      if (tr > 0) {
        const a = String(g.alias ?? "Sin alias");
        m[a] = (m[a] ?? 0) + tr;
      }
    });
    return Object.entries(m).map(([alias, total]) => ({ alias, total }));
  })();


  const devolucionesMontoEfectivo = devolucionesPeriodo.reduce((s: number, d: any) => s + parseNum(d?.efectivo), 0);
  const devolucionesMontoTransfer = devolucionesPeriodo.reduce((s: number, d: any) => s + parseNum(d?.transferencia), 0);
  const devolucionesMontoTotal    = devolucionesPeriodo.reduce((s: number, d: any) => s + parseNum(d?.total), 0);

  // Flujo final de caja (efectivo) incluyendo el vuelto restante del día
  const flujoCajaEfectivoFinal =
    totalEfectivoNeto
    - totalGastosEfectivo
    - devolucionesMontoEfectivo
    - commissionsPeriodo      // 👈 RESTA comisiones del período
    + vueltoRestante;

  // Agrupados
  const porVendedor = Object.values(
    invoices.reduce((acc: any, f: any) => {
      const k = f.vendor_name || "Sin vendedor";
      acc[k] = acc[k] || { vendedor: k, total: 0 };
      acc[k].total += parseNum(f.total);
      return acc;
    }, {})
  ).sort((a: any, b: any) => b.total - a.total);

  const porSeccion = (() => {
    const m: Record<string, number> = {};
    invoices.forEach((f: any) =>
      (f.items || []).forEach((it: any) => {
        m[it.section] = (m[it.section] || 0) + parseNum(it.qty) * parseNum(it.unitPrice);
      })
    );
    return Object.entries(m).map(([section, total]) => ({ section, total })).sort((a, b) => b.total - a.total);
  })();

  // Transferencias por alias (ventas)
  const porAlias = (() => {
    const m: Record<string, number> = {};
    docsEnRango.forEach((f: any) => {
      const tr = parseNum(f?.payments?.transfer);
      if (tr > 0) {
        const alias = String(f?.payments?.alias || "Sin alias").trim() || "Sin alias";
        m[alias] = (m[alias] || 0) + tr;
      }
    });
    return Object.entries(m).map(([alias, total]) => ({ alias, total })).sort((a, b) => b.total - a.total);
  })();

  async function imprimirReporte() {
    const data = {
      type: "Reporte",
      periodo,
      rango: { start, end },
      resumen: {
        ventas: totalVentas,
        efectivoCobrado: totalEfectivo,
        vueltoEntregado: totalVuelto,
        efectivoNeto: totalEfectivoNeto,
        transferencias: totalTransf,

        gastosTotal: totalGastos,
        gastosEfectivo: totalGastosEfectivo,
        gastosTransfer: totalGastosTransferencia,

        devolucionesCantidad: devolucionesPeriodo.length,
        devolucionesEfectivo: devolucionesMontoEfectivo,
        devolucionesTransfer: devolucionesMontoTransfer,
        devolucionesTotal: devolucionesMontoTotal,

        // NUEVO: info de vuelto por día
        cashFloatTarget,
        vueltoRestante,

        flujoCajaEfectivo: flujoCajaEfectivoFinal,

        // 👇 NUEVO
        comisionesPeriodo: commissionsPeriodo,
      },

      ventas: invoices,
      gastos: gastosPeriodo,
      devoluciones: devolucionesPeriodo,
      porVendedor,
      porSeccion,
      transferenciasPorAlias: porAlias,
      transferGastosPorAlias: transferenciasPorAlias,
    };

    window.dispatchEvent(new CustomEvent("print-invoice", { detail: data } as any));
    await nextPaint();
    window.print();
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <Card title="Filtros">
        <div className="grid md:grid-cols-4 gap-3">
          <Select
            label="Período"
            value={periodo}
            onChange={setPeriodo}
            options={[
              { value: "dia", label: "Día" },
              { value: "mes", label: "Mes" },
              { value: "anio", label: "Año" },
            ]}
          />
          {periodo === "dia" && <Input label="Día" type="date" value={dia} onChange={setDia} />}
          {periodo === "mes" && <Input label="Mes" type="month" value={mes} onChange={setMes} />}
          {periodo === "anio" && <Input label="Año" type="number" value={anio} onChange={setAnio} />}
        </div>
      </Card>

      <Card title="Acciones" actions={<Button onClick={imprimirReporte}>Imprimir reporte</Button>}>
        <div className="text-sm text-slate-400">Genera un reporte imprimible con el rango seleccionado.</div>
      </Card>

      {periodo === "dia" && (
        <Card
          title="Vuelto en caja (por día)"
          actions={
            <Button onClick={async () => {
              await setCashFloatForDay(cashFloatTarget);
              alert("Vuelto del día guardado.");
            }}>
              Guardar
            </Button>
          }
        >
          <div className="grid md:grid-cols-3 gap-3">
            <NumberInput
              label={`Vuelto configurado para ${diaClave}`}
              value={String(cashFloatTarget)}
              onChange={(v: any) => {
                // se edita en memoria; se persiste al tocar Guardar
                const st = clone(state);
                st.meta.cashFloatByDate = st.meta.cashFloatByDate || {};
                st.meta.cashFloatByDate[diaClave] = parseNum(v);
                setState(st);
              }}
              placeholder="Ej: 10000"
            />
            <div className="md:col-span-2 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-400 mb-1">Vuelto entregado (en el período)</div>
                <div className="text-xl font-bold">{money(totalVuelto)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Vuelto restante</div>
                <div className="text-xl font-bold">{money(vueltoRestante)}</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {periodo === "dia" && (
        <Card
          title="Comisiones (por día)"
          actions={
            <Button onClick={async () => {
              await setCommissionForDay(commissionTarget);
              alert("Comisiones del día guardadas.");
            }}>
              Guardar
            </Button>
          }
        >
          <div className="grid md:grid-cols-3 gap-3">
            <NumberInput
              label={`Comisiones configuradas para ${diaClave}`}
              value={String(commissionTarget)}
              onChange={(v: any) => {
                const st = clone(state);
                st.meta.commissionsByDate = st.meta.commissionsByDate || {};
                st.meta.commissionsByDate[diaClave] = parseNum(v);
                setState(st);
              }}
              placeholder="Ej: 5000"
            />
            <div className="md:col-span-2 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-400 mb-1">Comisiones en el período</div>
                <div className="text-xl font-bold">{money(commissionsPeriodo)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Impacto en flujo de caja</div>
                <div className="text-xl font-bold">– {money(commissionsPeriodo)}</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-4 gap-3">
        <Card title="Ventas totales"><div className="text-2xl font-bold">{money(totalVentas)}</div></Card>

        <Card title="Efectivo (cobrado)">
          <div className="text-2xl font-bold">{money(totalEfectivo)}</div>
          <div className="text-xs text-slate-400 mt-1">Sin descontar vuelto</div>
        </Card>

        <Card title="Vuelto entregado">
          <div className="text-2xl font-bold">{money(totalVuelto)}</div>
        </Card>

        <Card title="Transferencias">
          <div className="text-2xl font-bold">{money(totalTransf)}</div>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card title="Efectivo (neto)">
          <div className="text-2xl font-bold">{money(totalEfectivoNeto)}</div>
          <div className="text-xs text-slate-400 mt-1">
            Efectivo neto - Gastos (ef.) - Devoluciones (ef.) - Comisiones + Vuelto restante
          </div>
        </Card>

        <Card title="Ganancia estimada">
          <div className="text-2xl font-bold">{money(ganancia)}</div>
          <div className="text-xs text-slate-400 mt-1">Total - Costos</div>
        </Card>

        <Card title="Flujo final de caja (efectivo)">
          <div className="text-2xl font-bold">{money(flujoCajaEfectivoFinal)}</div>
          <div className="text-xs text-slate-400 mt-1">
            Efectivo neto - Gastos (ef.) - Devoluciones (ef.) + Vuelto restante
          </div>
        </Card>
      </div>

      <Card title="Gastos y Devoluciones">
        <div className="space-y-3 text-sm">
          <div>Total de gastos: <b>{money(totalGastos)}</b></div>
          <div>- En efectivo: {money(totalGastosEfectivo)}</div>
          <div>- En transferencia: {money(totalGastosTransferencia)}</div>

          <h4 className="mt-2 font-semibold">Transferencias por alias</h4>
          {transferenciasPorAlias.length === 0 ? (
            <div className="text-slate-400">Sin transferencias registradas.</div>
          ) : (
            <ul className="list-disc pl-5">
              {transferenciasPorAlias.map((t) => (
                <li key={t.alias}>{t.alias}: {money(t.total)}</li>
              ))}
            </ul>
          )}

          <h4 className="mt-4 font-semibold">Devoluciones registradas</h4>
          <div>Cantidad: <b>{devolucionesPeriodo.length}</b></div>
          <div>- En efectivo: {money(devolucionesMontoEfectivo)}</div>
          <div>- En transferencia: {money(devolucionesMontoTransfer)}</div>
          <div>- Monto total: <b>{money(devolucionesMontoTotal)}</b></div>
        </div>
        <div className="mt-2">Vuelto entregado en el período: <b>{money(totalVuelto)}</b></div>
      </Card>

      <Card title="Por vendedor">
        <div className="grid md:grid-cols-3 gap-3">
          {porVendedor.map((v: any) => (
            <div key={v.vendedor} className="rounded-xl border border-slate-800 p-3 flex items-center justify-between">
              <div className="text-sm font-medium">{v.vendedor}</div>
              <div className="text-sm">{money(v.total as number)}</div>
            </div>
          ))}
          {porVendedor.length === 0 && <div className="text-sm text-slate-400">Sin datos en el período.</div>}
        </div>
      </Card>

      <Card title="Por sección">
        <div className="grid md:grid-cols-3 gap-3">
          {porSeccion.map((s: any) => (
            <div key={s.section} className="rounded-xl border border-slate-800 p-3 flex items-center justify-between">
              <div className="text-sm font-medium">{s.section}</div>
              <div className="text-sm">{money(s.total as number)}</div>
            </div>
          ))}
          {porSeccion.length === 0 && <div className="text-sm text-slate-400">Sin datos en el período.</div>}
        </div>
      </Card>

      <Card title="Transferencias por alias (ventas)">
        {porAlias.length === 0 ? (
          <div className="text-sm text-slate-400">Sin transferencias en el período.</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            {porAlias.map((a: any) => (
              <div key={a.alias} className="rounded-xl border border-slate-800 p-3 flex items-center justify-between">
                <div className="text-sm font-medium truncate max-w-[60%]">{a.alias}</div>
                <div className="text-sm">{money(a.total as number)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

<Card title="Listado de facturas">
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm">
      <thead className="text-left text-slate-400">
        <tr>
          <th className="py-2 pr-3">#</th>
          <th className="py-2 pr-3">Fecha</th>
          <th className="py-2 pr-3">Cliente</th>
          <th className="py-2 pr-3">Vendedor</th>
          <th className="py-2 pr-3">Total</th>
          <th className="py-2 pr-3">Efectivo</th>
          <th className="py-2 pr-3">Transf.</th>
          <th className="py-2 pr-3">Vuelto</th>
          <th className="py-2 pr-3">Alias/CVU</th>
          <th className="py-2 pr-3">Tipo</th>
          <th className="py-2 pr-3">Estado</th>
          <th className="py-2 pr-3">Acciones</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800">
        {docsEnRango
          .slice()
          .sort((a: any, b: any) => new Date(b.date_iso).getTime() - new Date(a.date_iso).getTime())
          .map((f: any) => {
            const cash = parseNum(f?.payments?.cash);
            const tr = parseNum(f?.payments?.transfer);
            const ch = parseNum(f?.payments?.change);
            const alias = (f?.payments?.alias || "").trim() || "—";

            // Función para ver PDF usando la misma lógica de presupuestos
            const viewInvoicePDF = (invoice: any) => {
              window.dispatchEvent(new CustomEvent("print-invoice", { detail: { ...invoice, type: "Factura" } } as any));
              setTimeout(() => window.print(), 0);
            };

            // Función para eliminar factura (solo admin)
            const deleteInvoice = async (invoice: any) => {
              if (!confirm(`¿Seguro que deseas eliminar la factura Nº ${pad(invoice.number)}?`)) return;
              const st = clone(state);
              st.invoices = st.invoices.filter((x: any) => x.id !== invoice.id);
              setState(st);
              if (hasSupabase) {
                await supabase.from("invoices").delete().eq("id", invoice.id);
              }
              alert(`Factura Nº ${pad(invoice.number)} eliminada.`);
            };

            return (
              <tr key={f.id}>
                <td className="py-2 pr-3">{pad(f.number || 0)}</td>
                <td className="py-2 pr-3">{new Date(f.date_iso).toLocaleString("es-AR")}</td>
                <td className="py-2 pr-3">{f.client_name}</td>
                <td className="py-2 pr-3">{f.vendor_name}</td>
                <td className="py-2 pr-3">{money(parseNum(f.total))}</td>
                <td className="py-2 pr-3">{money(cash)}</td>
                <td className="py-2 pr-3">{money(tr)}</td>
                <td className="py-2 pr-3">{money(ch)}</td>
                <td className="py-2 pr-3 truncate max-w-[180px]">{alias}</td>
                <td className="py-2 pr-3">{f.type || "—"}</td>
                <td className="py-2 pr-3">{f.status || "—"}</td>
                <td className="py-2 pr-3 space-x-2">
                  {/* Botón ver PDF */}
                  <button
                    onClick={() => viewInvoicePDF(f)}
                    className="text-blue-500 hover:text-blue-700"
                    title="Ver PDF"
                  >
                    📄
                  </button>
                  {/* 👇 AGREGAR ESTO - Botón eliminar (solo admin) */}
  {session?.role === "admin" && (
    <button
      onClick={async () => {
        if (!confirm(`¿Seguro que deseas eliminar la factura Nº ${pad(f.number)}?`)) return;
        
        const st = clone(state);
        st.invoices = st.invoices.filter((x: any) => x.id !== f.id);
        setState(st);
        
        if (hasSupabase) {
          await supabase.from("invoices").delete().eq("id", f.id);
        }
        
        alert(`Factura Nº ${pad(f.number)} eliminada.`);
      }}
      className="text-red-500 hover:text-red-700"
      title="Eliminar"
    >
      🗑️
    </button>
  )}
</td>

     {state.user?.role === "admin" && (
  <button
    onClick={async () => {
      if (!confirm(`¿Eliminar factura #${f.number}?`)) return;
      const st = clone(state);
      st.invoices = st.invoices.filter((x: any) => x.id !== f.id);
      setState(st);
      if (hasSupabase) {
        await supabase.from("invoices").delete().eq("id", f.id);
      }
      alert(`Factura #${f.number} eliminada.`);
    }}
    className="text-red-500 hover:text-red-700"
    title="Eliminar"
  >
    🗑️
  </button>
)}


                </td>
              </tr>
            );
          })}
        {docsEnRango.length === 0 && (
          <tr>
            <td className="py-3 text-slate-400" colSpan={12}>
              Sin documentos en el período.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
</Card>




<Card title="Listado de devoluciones">
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm">
      <thead className="text-left text-slate-400">
        <tr>
          <th className="py-2 pr-3">Fecha</th>
          <th className="py-2 pr-3">Cliente</th>
          <th className="py-2 pr-3">Método</th>
          <th className="py-2 pr-3">Efectivo</th>
          <th className="py-2 pr-3">Transf.</th>
          <th className="py-2 pr-3">Total</th>
          <th className="py-2 pr-3">Detalle</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800">
        {devolucionesPeriodo
          .slice()
          .sort((a: any, b: any) => new Date(b.date_iso).getTime() - new Date(a.date_iso).getTime())
          .map((d: any) => (
            <tr key={d.id}>
              <td className="py-2 pr-3">{new Date(d.date_iso).toLocaleString("es-AR")}</td>
              <td className="py-2 pr-3">{d.client_name}</td>
              <td className="py-2 pr-3 capitalize">{d.metodo}</td>
              <td className="py-2 pr-3">{money(parseNum(d.efectivo))}</td>
              <td className="py-2 pr-3">{money(parseNum(d.transferencia))}</td>
              <td className="py-2 pr-3">{money(parseNum(d.total))}</td>
              <td className="py-2 pr-3">
                {(d.items || []).map((it: any, i: number) => (
                  <div key={i} className="text-xs">
                    {it.name} — dev.: {parseNum(it.qtyDevuelta)} × {money(parseNum(it.unitPrice))}
                  </div>
                ))}
                {d.metodo === "intercambio_otro" && (
                  <div className="text-xs text-slate-400 mt-1">
                    Dif. abonada: ef. {money(parseNum(d.extra_pago_efectivo || 0))} · tr. {money(parseNum(d.extra_pago_transferencia || 0))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        {devolucionesPeriodo.length === 0 && (
          <tr>
            <td className="py-3 text-slate-400" colSpan={7}>
              Sin devoluciones en el período.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
</Card>

</div>
);
}


     

/* Presupuestos */
function PresupuestosTab({ state, setState, session }: any) {
  const [clientId, setClientId] = useState(state.clients[0]?.id || "");
  const [vendorId, setVendorId] = useState(session.role === "admin" ? state.vendors[0]?.id : session.id);
  const [priceList, setPriceList] = useState("1");
  const [items, setItems] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const client = state.clients.find((c: any) => c.id === clientId);
  const vendor = state.vendors.find((v: any) => v.id === vendorId);
  const filteredProducts = state.products.filter((p: any) => !query || p.name.toLowerCase().includes(query.toLowerCase()));
  function addItem(p: any) {
    const existing = items.find((it: any) => it.productId === p.id);
    const unit = priceList === "1" ? p.price1 : p.price2;
    if (existing) setItems(items.map((it) => (it.productId === p.id ? { ...it, qty: parseNum(it.qty) + 1 } : it)));
    else setItems([...items, { productId: p.id, name: p.name, section: p.section, qty: 1, unitPrice: unit, cost: p.cost }]);
  }
  async function guardarPresupuesto() {
    if (!client || !vendor || items.length === 0) return;
    const st = clone(state);
    const number = st.meta.budgetCounter++;
    const id = "pr_" + number;
    const total = calcInvoiceTotal(items);
    const b = {
      id,
      number,
      date_iso: todayISO(),
      client_id: client.id,
      client_name: client.name,
      vendor_id: vendor.id,
      vendor_name: vendor.name,
      items: clone(items),
      total,
      status: "Pendiente",
    };
    st.budgets.push(b);
    setState(st);
    if (hasSupabase) {
      await supabase.from("budgets").insert(b);
      await saveCountersSupabase(st.meta);
    }
    alert("Presupuesto guardado.");
    setItems([]);
  }
  async function convertirAFactura(b: any) {
  const efectivoStr = prompt("¿Cuánto paga en EFECTIVO?", "0") ?? "0";
  const transferenciaStr = prompt("¿Cuánto paga por TRANSFERENCIA?", "0") ?? "0";
  const aliasStr = prompt("Alias/CVU destino de la transferencia (opcional):", "") ?? "";

  const efectivo = parseNum(efectivoStr);
  const transferencia = parseNum(transferenciaStr);
  const alias = aliasStr.trim();

  const st = clone(state);
  const number = st.meta.invoiceCounter++;
  const id = "inv_" + number;

  const invoice = {
    id,
    number,
    date_iso: todayISO(),
    client_id: b.client_id,
    client_name: b.client_name,
    vendor_id: b.vendor_id,
    vendor_name: b.vendor_name,
    items: clone(b.items),
    total: b.total,
    cost: calcInvoiceCost(b.items),
    payments: { cash: efectivo, transfer: transferencia, alias },
  status: (efectivo + transferencia) >= b.total ? "Pagada" : "No Pagada",

    type: "Factura",
  };

  st.invoices.push(invoice);
  const budget = st.budgets.find((x: any) => x.id === b.id)!;
  budget.status = "Convertido";
  setState(st);

  if (hasSupabase) {
    await supabase.from("invoices").insert(invoice);
    await supabase.from("budgets").update({ status: "Convertido" }).eq("id", b.id);
    await saveCountersSupabase(st.meta);
  }

  window.dispatchEvent(new CustomEvent("print-invoice", { detail: invoice } as any));
  await nextPaint();
  window.print();
}

  const total = calcInvoiceTotal(items);
  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <Card title="Nuevo presupuesto">
        <div className="grid md:grid-cols-4 gap-3">
          <Select label="Cliente" value={clientId} onChange={setClientId} options={state.clients.map((c: any) => ({ value: c.id, label: `${c.number} — ${c.name}` }))} />
          <Select label="Vendedor" value={vendorId} onChange={setVendorId} options={state.vendors.map((v: any) => ({ value: v.id, label: v.name }))} />
          <Select label="Lista de precios" value={priceList} onChange={setPriceList} options={[{ value: "1", label: "Mitobicel" }, { value: "2", label: "ElshoppingDlc" }]} />
          <Input label="Buscar producto" value={query} onChange={setQuery} placeholder="Nombre..." />
        </div>
        <div className="grid md:grid-cols-2 gap-4 mt-3">
          <div className="space-y-2">
            <div className="text-sm font-semibold">Productos</div>
            <div className="rounded-xl border border-slate-800 divide-y divide-slate-800">
              {filteredProducts.map((p: any) => (
                <div key={p.id} className="px-3 py-2 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-slate-400">L1: {money(p.price1)} L2: {money(p.price2)}</div>
                  </div>
                  <Button tone="slate" onClick={() => addItem(p)}>
                    Añadir
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold">Ítems</div>
            <div className="rounded-xl border border-slate-800 divide-y divide-slate-800">
              {items.length === 0 && <div className="p-3 text-sm text-slate-400">Vacío</div>}
         {items.map((it: any, idx: number) => (
  <div key={idx} className="p-3 grid grid-cols-12 gap-2 items-center">
    <div className="col-span-6">
      <div className="text-sm font-medium">{it.name}</div>
      <div className="text-xs text-slate-400">{it.section}</div>
    </div>
    <div className="col-span-2">
      <NumberInput
        label="Cant."
        value={it.qty}
        onChange={(v: any) => {
          const q = Math.max(0, parseNum(v));
          setItems(items.map((x: any, i: number) => (i === idx ? { ...x, qty: q } : x)));
        }}
      />
    </div>
    <div className="col-span-3">
      <NumberInput
        label="Precio"
        value={it.unitPrice}
        onChange={(v: any) => {
          const q = Math.max(0, parseNum(v));
          setItems(items.map((x: any, i: number) => (i === idx ? { ...x, unitPrice: q } : x)));
        }}
      />
    </div>
    <div className="col-span-1 flex items-end justify-end pb-0.5">
      <button
        onClick={() => setItems(items.filter((_: any, i: number) => i !== idx))}
        className="text-xs text-red-400 hover:text-red-300"
      >
        ✕
      </button>
    </div>
    <div className="col-span-12 text-right text-xs text-slate-300 pt-1">
      Subtotal ítem: {money(parseNum(it.qty) * parseNum(it.unitPrice))}
    </div>
  </div>
))}
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm">Total</div>
              <div className="text-lg font-bold">{money(total)}</div>
            </div>
            <div className="flex justify-end">
              <Button onClick={guardarPresupuesto}>Guardar presupuesto</Button>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Presupuestos guardados">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2 pr-4">N°</th>
                <th className="py-2 pr-4">Fecha</th>
                <th className="py-2 pr-4">Cliente</th>
                <th className="py-2 pr-4">Vendedor</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {state.budgets
                .slice()
                .reverse()
                .map((b: any) => (
                  <tr key={b.id}>
                    <td className="py-2 pr-4">{pad(b.number)}</td>
                    <td className="py-2 pr-4">{new Date(b.date_iso).toLocaleString("es-AR")}</td>
                    <td className="py-2 pr-4">{b.client_name}</td>
                    <td className="py-2 pr-4">{b.vendor_name}</td>
                    <td className="py-2 pr-4">{money(b.total)}</td>
                    <td className="py-2 pr-4 flex gap-2 items-center">
  {/* Botón Editar */}
  <button
    title="Editar"
    onClick={() => {
      setClientId(b.client_id);
      setVendorId(b.vendor_id);
      setItems(clone(b.items));
      alert(`Editando presupuesto Nº ${pad(b.number)}`);
    }}
    className="text-blue-400 hover:text-blue-300 text-lg"
  >
    ✏️
  </button>

  {/* Botón Descargar PDF */}
  <button
    title="Descargar PDF"
    onClick={() => {
      const data = { ...b, type: "Presupuesto" };
      window.dispatchEvent(new CustomEvent("print-invoice", { detail: data } as any));
      setTimeout(() => window.print(), 0);
    }}
    className="text-red-400 hover:text-red-300 text-lg"
  >
    📄
  </button>

  {/* Botón Convertir o estado convertido */}
  {b.status === "Pendiente" ? (
    <Button onClick={() => convertirAFactura(b)} tone="emerald">
      Convertir a factura
    </Button>
  ) : (
    <span className="text-xs">Convertido</span>
  )}
{/* Botón Eliminar */}
  <button
    title="Eliminar presupuesto"
    onClick={() => {
      if (confirm(`¿Seguro que deseas eliminar el presupuesto Nº ${pad(b.number)}?`)) {
        const st = clone(state);
        st.budgets = st.budgets.filter((x: any) => x.id !== b.id);
        setState(st);
        if (hasSupabase) {
          supabase.from("budgets").delete().eq("id", b.id);
        }
        alert(`Presupuesto Nº ${pad(b.number)} eliminado.`);
      }
    }}
    className="text-red-500 hover:text-red-400 text-lg ml-2"
  >
    🗑️
  </button>
</td>


                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
/* Gastos y Devoluciones */
function GastosDevolucionesTab({ state, setState, session }: any) {
  const [productoNuevoId, setProductoNuevoId] = useState(""); // Producto elegido para entregar
const [cantidadNuevo, setCantidadNuevo] = useState("");     // Cantidad a entregar
  const [modo, setModo] = useState("Gasto"); // "Gasto" o "Devolución"
  const [tipoGasto, setTipoGasto] = useState("Proveedor");
  const [detalle, setDetalle] = useState("");
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [montoTransferencia, setMontoTransferencia] = useState("");
  const [alias, setAlias] = useState("");

  const [clienteSeleccionado, setClienteSeleccionado] = useState("");
  const [productosDevueltos, setProductosDevueltos] = useState<any[]>([]);
  const [facturasCliente, setFacturasCliente] = useState<any[]>([]);
  const [metodoDevolucion, setMetodoDevolucion] = useState("efectivo");


useEffect(() => {
  if (!clienteSeleccionado) return;

  async function cargarFacturas() {
    if (hasSupabase) {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("client_id", clienteSeleccionado)
        .order("date_iso", { ascending: false });

      if (error) {
        console.error("Error cargando facturas:", error);
        return;
      }

      setFacturasCliente(data || []);
    } else {
      // Si no hay supabase, buscar en el estado local
      const filtradas = state.invoices.filter(
        (f: any) => f.client_id === clienteSeleccionado
      );
      setFacturasCliente(filtradas);
    }
  }

  cargarFacturas();
}, [clienteSeleccionado, state.invoices]);


  // ==============================
  // Funciones para guardar Gasto y Devolución
  // ==============================
  async function guardarGasto() {
    if (!detalle.trim()) {
      alert("El campo 'Detalle' es obligatorio.");
      return;
    }

    // Si los campos están vacíos, tratarlos como 0 automáticamente
    const efectivoFinal = montoEfectivo.trim() === "" ? 0 : parseNum(montoEfectivo);
    const transferenciaFinal = montoTransferencia.trim() === "" ? 0 : parseNum(montoTransferencia);

    // Si ambos son 0, mostrar error
    if (efectivoFinal === 0 && transferenciaFinal === 0) {
      alert("Debes ingresar al menos un monto en efectivo o transferencia.");
      return;
    }

    const gasto = {
      id: "g" + Math.random().toString(36).slice(2, 8),
      tipo: tipoGasto,
      detalle,
      efectivo: efectivoFinal,
      transferencia: transferenciaFinal,
      alias,
      date_iso: todayISO(),
    };

    const st = clone(state);
    st.gastos = st.gastos || [];
    st.gastos.push(gasto);
    setState(st);

    if (hasSupabase) await supabase.from("gastos").insert(gasto);

    alert("Gasto guardado correctamente.");
    setDetalle("");
    setMontoEfectivo("");
    setMontoTransferencia("");
    setAlias("");
  }

 /* ==============================
   FUNCIÓN guardarDevolucion
============================== */
async function guardarDevolucion() {
  // Intercambio por otro producto
if (metodoDevolucion === "intercambio_otro") {
  if (!productoNuevoId || parseNum(cantidadNuevo) <= 0) {
    alert("Debes seleccionar un producto nuevo y la cantidad.");
    return;
  }

  alert("Intercambio por otro producto iniciado. Luego implementaremos la lógica.");
}
  if (!clienteSeleccionado) {
    alert("Selecciona un cliente antes de guardar la devolución.");
    return;
  }

  if (productosDevueltos.length === 0) {
    alert("Debes seleccionar al menos un producto para devolver.");
    return;
  }

  const clientName =
    state.clients.find((c: any) => c.id === clienteSeleccionado)?.name || "Cliente desconocido";

  // Total calculado según cantidades devueltas
  const totalDevolucion = productosDevueltos.reduce(
    (s, it) => s + parseNum(it.qtyDevuelta) * parseNum(it.unitPrice),
    0
  );

const devolucion = {
  id: "d" + Math.random().toString(36).slice(2, 8),
  client_id: clienteSeleccionado,
  client_name: clientName,
  items: productosDevueltos,
  metodo: metodoDevolucion,
  efectivo: metodoDevolucion === "efectivo" ? parseNum(montoEfectivo) : 0,
  transferencia: metodoDevolucion === "transferencia" ? parseNum(montoTransferencia) : 0,
  // === NUEVO: diferencia abonada cuando es "intercambio_otro"
  extra_pago_efectivo: metodoDevolucion === "intercambio_otro" ? parseNum(montoEfectivo) : 0,
  extra_pago_transferencia: metodoDevolucion === "intercambio_otro" ? parseNum(montoTransferencia) : 0,
  extra_pago_total:
    (metodoDevolucion === "intercambio_otro"
      ? parseNum(montoEfectivo) + parseNum(montoTransferencia)
      : 0),
  // total de lo que se devuelve (solo para restar si NO es intercambio)
  total: totalDevolucion,
  date_iso: todayISO(),
};


const st = clone(state);
st.devoluciones.push(devolucion);

// 1) Ajuste de saldo a favor (si corresponde)
if (metodoDevolucion === "saldo") {
  const cli = st.clients.find((c:any)=>c.id === clienteSeleccionado);
  if (cli) cli.saldo_favor = parseNum(cli.saldo_favor) + parseNum(totalDevolucion);
}

// 2) Stock: entra lo devuelto
productosDevueltos.forEach((it) => {
  const prod = st.products.find((p:any) => p.id === it.productId);
  if (prod) prod.stock = parseNum(prod.stock) + parseNum(it.qtyDevuelta);
});

// 3) Stock: sale lo entregado en intercambio_otro
if (metodoDevolucion === "intercambio_otro" && productoNuevoId) {
  const nuevo = st.products.find((p:any) => p.id === productoNuevoId);
  if (nuevo) nuevo.stock = parseNum(nuevo.stock) - parseNum(cantidadNuevo);
}

setState(st);

// ==== Persistencia ====
if (hasSupabase) {
  await supabase.from("devoluciones").insert(devolucion);

  // actualizar saldo_favor si se acreditó
  if (metodoDevolucion === "saldo") {
    const cli = st.clients.find((c:any)=>c.id===clienteSeleccionado);
    await supabase.from("clients")
      .update({ saldo_favor: cli?.saldo_favor ?? 0 })
      .eq("id", clienteSeleccionado);
  }

  // persistir stocks tocados
  for (const it of productosDevueltos) {
    const nuevoStock = st.products.find((p:any) => p.id === it.productId)?.stock;
    await supabase.from("products").update({ stock: nuevoStock }).eq("id", it.productId);
  }
  if (metodoDevolucion === "intercambio_otro" && productoNuevoId) {
    const stockNuevo = st.products.find((p:any) => p.id === productoNuevoId)?.stock;
    await supabase.from("products").update({ stock: stockNuevo }).eq("id", productoNuevoId);
  }
}



  alert("Devolución registrada con éxito.");
  setProductosDevueltos([]);
  setClienteSeleccionado("");
  setMontoEfectivo("");
  setMontoTransferencia("");
  setMetodoDevolucion("efectivo");
}

/* ==============================
   UI — Renderizado
============================== */
return (
  <div className="max-w-5xl mx-auto p-4 space-y-4">
    <Card title="Gastos y Devoluciones">
      <div className="grid md:grid-cols-2 gap-3">
        <Select
          label="Modo"
          value={modo}
          onChange={setModo}
          options={[
            { value: "Gasto", label: "Registrar Gasto" },
            { value: "Devolución", label: "Registrar Devolución" },
          ]}
        />
      </div>
    </Card>

    {modo === "Gasto" && (
      <Card title="Registrar Gasto">
        <div className="grid md:grid-cols-2 gap-3">
          <Select
            label="Tipo de gasto"
            value={tipoGasto}
            onChange={setTipoGasto}
            options={[
              { value: "Proveedor", label: "Proveedor" },
              { value: "Otro", label: "Otro" },
            ]}
          />
          <Input
            label="Detalle"
            value={detalle}
            onChange={setDetalle}
            placeholder="Ej: Coca-Cola, Luz, Transporte..."
          />
          <NumberInput
            label="Monto en efectivo"
            value={montoEfectivo}
            onChange={setMontoEfectivo}
            placeholder="0"
          />
          <NumberInput
            label="Monto en transferencia"
            value={montoTransferencia}
            onChange={setMontoTransferencia}
            placeholder="0"
          />
          <Input
            label="Alias / CVU (opcional)"
            value={alias}
            onChange={setAlias}
            placeholder="alias.cuenta.banco"
          />
          <div className="pt-6">
            <Button onClick={guardarGasto}>Guardar gasto</Button>
          </div>
        </div>
      </Card>
    )}

    {modo === "Devolución" && (
      <Card title="Registrar Devolución">
        {/* Selección de cliente */}
        <div className="grid md:grid-cols-2 gap-3">
          <Select
            label="Cliente"
            value={clienteSeleccionado}
            onChange={setClienteSeleccionado}
            options={state.clients.map((c: any) => ({
              value: c.id,
              label: `${c.number} - ${c.name}`,
            }))}
          />
        </div>

        {/* Listado de productos de facturas */}
        {facturasCliente.length > 0 ? (
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">Productos comprados</h4>
            {facturasCliente.map((factura) => (
              <div
                key={factura.id}
                className="mb-4 border border-slate-800 rounded-lg p-3"
              >
                <div className="text-xs text-slate-400 mb-2">
                  Factura #{factura.number} —{" "}
                  {new Date(factura.date_iso).toLocaleDateString("es-AR")}
                </div>
                <table className="min-w-full text-sm">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="text-left py-1">Producto</th>
                      <th className="text-right py-1">Cant.</th>
                      <th className="text-right py-1">Precio</th>
                      <th className="text-right py-1">Devolver</th>
                    </tr>
                  </thead>
                  <tbody>
                    {factura.items.map((item: any, idx: number) => (
                      <tr key={idx} className="border-t border-slate-800">
                        <td className="py-1">{item.name}</td>
                        <td className="text-right py-1">{item.qty}</td>
                        <td className="text-right py-1">${item.unitPrice}</td>
                        <td className="text-right py-1">
                          <input
                            type="number"
                            min={1}
                            max={item.qty}
                            placeholder="0"
                            className="w-16 text-center border border-slate-700 rounded bg-slate-900"
                            onChange={(e) => {
                              const cantidad = parseNum(e.target.value);
                              if (cantidad > 0 && cantidad <= item.qty) {
                                setProductosDevueltos((prev) => {
                                  const existe = prev.find(
                                    (p) =>
                                      p.productId === item.productId &&
                                      p.facturaId === factura.id
                                  );
                                  if (existe) {
                                    return prev.map((p) =>
                                      p.productId === item.productId &&
                                      p.facturaId === factura.id
                                        ? { ...p, qtyDevuelta: cantidad }
                                        : p
                                    );
                                  }
                                  return [
                                    ...prev,
                                    {
                                      ...item,
                                      facturaId: factura.id,
                                      qtyDevuelta: cantidad,
                                    },
                                  ];
                                });
                              }
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : (
          clienteSeleccionado && (
            <div className="text-xs text-slate-400 mt-4">
              Este cliente no tiene compras registradas.
            </div>
          )
        )}

        {/* Resumen total */}
        {productosDevueltos.length > 0 && (
          <div className="mt-6 border-t border-slate-700 pt-4">
            <h4 className="text-sm font-semibold mb-2">Resumen</h4>
            <div className="text-sm">
              Total devolución:{" "}
              <span className="font-bold">
                $
                {productosDevueltos.reduce(
                  (s, it) => s + parseNum(it.qtyDevuelta) * parseNum(it.unitPrice),
                  0
                )}
              </span>
            </div>
          </div>
        )}

        {/* Selección del método de devolución */}
        {productosDevueltos.length > 0 && (
          <div className="mt-6 border-t border-slate-700 pt-4">
            <h4 className="text-sm font-semibold mb-2">Método de devolución</h4>
           <Select
  label="Seleccionar método"
  value={metodoDevolucion}
  onChange={setMetodoDevolucion}
  options={[
    { value: "efectivo", label: "Efectivo" },
    { value: "transferencia", label: "Transferencia" },
    { value: "saldo", label: "Saldo a favor" },
    { value: "intercambio_mismo", label: "Intercambio mismo producto" },
    { value: "intercambio_otro", label: "Intercambio por otro producto" },
  ]}
/>


            {metodoDevolucion !== "saldo" && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <NumberInput
                  label="Monto en efectivo"
                  value={montoEfectivo}
                  onChange={setMontoEfectivo}
                  placeholder="0"
                />
                <NumberInput
                  label="Monto en transferencia"
                  value={montoTransferencia}
                  onChange={setMontoTransferencia}
                  placeholder="0"
                />
              </div>
            )}
          </div>
        )}
{/* Campos adicionales si es intercambio por otro producto */}
{metodoDevolucion === "intercambio_otro" && (
  <div className="mt-4 space-y-3">
    <h4 className="text-sm font-semibold">Producto nuevo a entregar</h4>
    <Select
      label="Seleccionar producto nuevo"
      value={productoNuevoId}
      onChange={setProductoNuevoId}
      options={state.products.map((p: any) => ({
        value: p.id,
        label: `${p.name} — Stock: ${p.stock || 0}`,
      }))}
    />
    <NumberInput
      label="Cantidad"
      value={cantidadNuevo}
      onChange={setCantidadNuevo}
      placeholder="0"
    />

    <h4 className="text-sm font-semibold mt-4">Pago de diferencia (opcional)</h4>
    <div className="grid grid-cols-2 gap-3">
      <NumberInput
        label="Pago en efectivo"
        value={montoEfectivo}
        onChange={setMontoEfectivo}
        placeholder="0"
      />
      <NumberInput
        label="Pago en transferencia"
        value={montoTransferencia}
        onChange={setMontoTransferencia}
        placeholder="0"
      />
      <Input
        className="col-span-2"
        label="Alias / CVU destino"
        value={alias}
        onChange={setAlias}
        placeholder="ej: mitobicel.banco"
      />
    </div>
  </div>
)}

          {/* Botón para confirmar devolución */}
        {productosDevueltos.length > 0 && (
          <div className="mt-4 text-right">
            <Button onClick={guardarDevolucion} tone="emerald">
              Confirmar devolución
            </Button>
          </div>
        )}
      </Card>
    )}
  </div>
  );
}



/* ===== helpers para impresión ===== */
const APP_TITLE = "Sistema de Gestión y Facturación — By Tobias Carrizo";
function nextPaint() {
  return new Promise<void>((res) =>
    requestAnimationFrame(() => requestAnimationFrame(() => res()))
  );
}


/* ===== Área de impresión ===== */
function PrintArea() {
  const [inv, setInv] = useState<any | null>(null);
  const [ticket, setTicket] = useState<any | null>(null);

  useEffect(() => {
    const hInv = (e: any) => {
      setTicket(null);
      setInv(e.detail);
    };
    const hTic = (e: any) => {
      setInv(null);
      setTicket(e.detail);
    };
    window.addEventListener("print-invoice", hInv);
    window.addEventListener("print-ticket", hTic);
    return () => {
      window.removeEventListener("print-invoice", hInv);
      window.removeEventListener("print-ticket", hTic);
    };
  }, []);

  if (!inv && !ticket) return null;
  // ==== PLANTILLA: REPORTE ====
if (inv?.type === "Reporte") {
  const fmt = (n: number) => money(parseNum(n));
  const rangoStr = (() => {
    const s = new Date(inv?.rango?.start || Date.now());
    const e = new Date(inv?.rango?.end || Date.now());
    const toDate = (d: Date) => d.toLocaleString("es-AR");
    return `${toDate(s)}  —  ${toDate(e)}`;
  })();

  return (
    <div className="only-print print-area p-14">
      <div className="max-w-[780px] mx-auto text-black">
        <div className="flex items-start justify-between">
          <div>
            <div style={{ fontWeight: 800, letterSpacing: 1 }}>REPORTE</div>
            <div style={{ marginTop: 2 }}>MITOBICEL</div>
          </div>
          <div className="text-right">
            <div><b>Período:</b> {String(inv?.periodo || "").toUpperCase()}</div>
            <div><b>Rango:</b> {rangoStr}</div>
            <div><b>Emitido:</b> {new Date().toLocaleString("es-AR")}</div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #000", margin: "10px 0 8px" }} />

{/* RESUMEN */}
<div className="grid grid-cols-2 gap-3 text-sm">
  <div>
    <div style={{ fontWeight: 700 }}>Resumen</div>
    <div>Ventas totales: {fmt(inv.resumen.ventas)}</div>
    <div>Efectivo cobrado: {fmt(inv.resumen.efectivoCobrado)}</div>
    <div>Vuelto entregado: {fmt(inv.resumen.vueltoEntregado)}</div>
    <div>Vuelto configurado: {fmt(inv.resumen.cashFloatTarget || 0)}</div>
    <div>Vuelto restante: {fmt(inv.resumen.vueltoRestante || 0)}</div>
    <div><b>Efectivo neto: {fmt(inv.resumen.efectivoNeto)}</b></div>
    <div>Transferencias: {fmt(inv.resumen.transferencias)}</div>
  </div>

  <div>
    <div style={{ fontWeight: 700 }}>Gastos y Devoluciones</div>
    <div>Gastos (total): {fmt(inv.resumen.gastosTotal)}</div>
    <div>— en efectivo: {fmt(inv.resumen.gastosEfectivo)}</div>
    <div>— por transferencia: {fmt(inv.resumen.gastosTransfer)}</div>
    <div>Devoluciones: {inv.resumen.devolucionesCantidad}</div>
    <div>— en efectivo: {fmt(inv.resumen.devolucionesEfectivo)}</div>
    <div>— por transferencia: {fmt(inv.resumen.devolucionesTransfer)}</div>
    <div>— monto total: {fmt(inv.resumen.devolucionesTotal)}</div>

    {/* 👇 AÑADIR AQUÍ */}
    <div>Comisiones (período): {fmt(inv.resumen.comisionesPeriodo)}</div>
  </div>
</div>


        {/* SECCIÓN: VENTAS (detalle similar a factura) */}
        <div style={{ borderTop: "1px solid #000", margin: "12px 0 6px" }} />
        <div className="text-sm" style={{ fontWeight: 700, marginBottom: 6 }}>Ventas del período</div>
        <table className="print-table text-sm">
          <thead>
            <tr>
              <th style={{ width: "8%" }}>#</th>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th style={{ width: "14%" }}>Total</th>
              <th style={{ width: "14%" }}>Efectivo</th>
              <th style={{ width: "14%" }}>Transf.</th>
              <th style={{ width: "12%" }}>Vuelto</th>
            </tr>
          </thead>
          <tbody>
            {(inv.ventas || []).map((f: any, i: number) => {
              const c = parseNum(f?.payments?.cash || 0);
              const t = parseNum(f?.payments?.transfer || 0);
              const vu = parseNum(f?.payments?.change || 0);
              return (
                <tr key={f.id}>
                  <td style={{ textAlign: "right" }}>{String(f.number || i + 1).padStart(4, "0")}</td>
                  <td>{f.client_name}</td>
                  <td>{f.vendor_name}</td>
                  <td style={{ textAlign: "right" }}>{fmt(f.total)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(c)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(t)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(vu)}</td>
                </tr>
              );
            })}
            {(!inv.ventas || inv.ventas.length === 0) && (
              <tr><td colSpan={7}>Sin ventas en el período.</td></tr>
            )}
          </tbody>
        </table>

        {/* SECCIÓN: GASTOS */}
        <div style={{ borderTop: "1px solid #000", margin: "12px 0 6px" }} />
        <div className="text-sm" style={{ fontWeight: 700, marginBottom: 6 }}>Gastos</div>
        <table className="print-table text-sm">
          <thead>
            <tr>
              <th style={{ width: "14%" }}>Fecha</th>
              <th>Detalle</th>
              <th style={{ width: "14%" }}>Efectivo</th>
              <th style={{ width: "14%" }}>Transf.</th>
              <th style={{ width: "24%" }}>Alias</th>
            </tr>
          </thead>
          <tbody>
            {(inv.gastos || []).map((g: any, i: number) => (
              <tr key={g.id || i}>
                <td>{new Date(g.date_iso).toLocaleString("es-AR")}</td>
                <td>{g.tipo} — {g.detalle}</td>
                <td style={{ textAlign: "right" }}>{fmt(g.efectivo)}</td>
                <td style={{ textAlign: "right" }}>{fmt(g.transferencia)}</td>
                <td>{g.alias || "—"}</td>
              </tr>
            ))}
            {(!inv.gastos || inv.gastos.length === 0) && (
              <tr><td colSpan={5}>Sin gastos.</td></tr>
            )}
          </tbody>
        </table>

        {/* SECCIÓN: DEVOLUCIONES */}
        <div style={{ borderTop: "1px solid #000", margin: "12px 0 6px" }} />
        <div className="text-sm" style={{ fontWeight: 700, marginBottom: 6 }}>Devoluciones</div>
        <table className="print-table text-sm">
          <thead>
            <tr>
              <th style={{ width: "14%" }}>Fecha</th>
              <th>Cliente</th>
              <th style={{ width: "14%" }}>Método</th>
              <th style={{ width: "14%" }}>Efectivo</th>
              <th style={{ width: "14%" }}>Transf.</th>
              <th style={{ width: "14%" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(inv.devoluciones || []).map((d: any, i: number) => (
              <tr key={d.id || i}>
                <td>{new Date(d.date_iso).toLocaleString("es-AR")}</td>
                <td>{d.client_name}</td>
                <td style={{ textTransform: "capitalize" }}>{d.metodo}</td>
                <td style={{ textAlign: "right" }}>{fmt(d.efectivo)}</td>
                <td style={{ textAlign: "right" }}>{fmt(d.transferencia)}</td>
                <td style={{ textAlign: "right" }}>{fmt(d.total)}</td>
              </tr>
            ))}
            {(!inv.devoluciones || inv.devoluciones.length === 0) && (
              <tr><td colSpan={6}>Sin devoluciones.</td></tr>
            )}
          </tbody>
        </table>

        {/* SECCIÓN: Transferencias por alias (ventas) */}
        <div style={{ borderTop: "1px solid #000", margin: "12px 0 6px" }} />
        <div className="text-sm" style={{ fontWeight: 700, marginBottom: 6 }}>Transferencias por alias (ventas)</div>
        <table className="print-table text-sm">
          <thead>
            <tr>
              <th>Alias</th>
              <th style={{ width: "18%" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(inv.transferenciasPorAlias || []).map((a: any, i: number) => (
              <tr key={a.alias || i}>
                <td>{a.alias}</td>
                <td style={{ textAlign: "right" }}>{fmt(a.total)}</td>
              </tr>
            ))}
            {(!inv.transferenciasPorAlias || inv.transferenciasPorAlias.length === 0) && (
              <tr><td colSpan={2}>Sin transferencias en ventas.</td></tr>
            )}
          </tbody>
        </table>

        {/* FINAL: FLUJO DE CAJA (EFECTIVO) */}
        <div style={{ borderTop: "1px solid #000", margin: "14px 0 8px" }} />
        <div className="text-center" style={{ fontWeight: 900, fontSize: 24, letterSpacing: 1 }}>
          FLUJO DE CAJA (EFECTIVO): {fmt(inv.resumen.flujoCajaEfectivo)}
        </div>

        <div className="mt-10 text-xs text-center">{APP_TITLE}</div>
      </div>
    </div>
  );
}


  // ==== PLANTILLA: TICKET ====
  if (ticket) {
    return (
      <div className="only-print print-area p-14">
        <div className="max-w-[520px] mx-auto text-black">
          <div className="text-center">
            <div style={{ fontWeight: 800, letterSpacing: 1, fontSize: 20 }}>TICKET DE TURNO</div>
            <div style={{ marginTop: 2, fontSize: 12 }}>MITOBICEL</div>
          </div>

          <div style={{ borderTop: "1px solid #000", margin: "10px 0 8px" }} />

          <div className="text-sm space-y-1">
            <div>
              <b>Código:</b> {ticket.id}
            </div>
            <div>
              <b>Cliente:</b> {ticket.client_name} (N° {ticket.client_number})
            </div>
            <div>
              <b>Acción:</b> {ticket.action}
            </div>
            <div>
              <b>Fecha:</b> {new Date(ticket.date_iso).toLocaleString("es-AR")}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #000", margin: "10px 0 8px" }} />

          <div className="text-sm" style={{ lineHeight: 1.35 }}>
            POR FAVOR ESPERE A VER SU NÚMERO EN PANTALLA PARA INGRESAR A HACER SU PEDIDO
            O GESTIONAR SU DEVOLUCIÓN.
          </div>

          <div className="mt-10 text-xs text-center">{APP_TITLE}</div>
        </div>
      </div>
    );
  }

  // ==== PLANTILLA: FACTURA ====
  const paidCash = parseNum(inv?.payments?.cash || 0);
  const paidTransf = parseNum(inv?.payments?.transfer || 0);
 const change = parseNum(inv?.payments?.change || 0);
const paid   = paidCash + paidTransf;                   // lo que entregó
const net    = Math.max(0, paid - change);              // lo que aplica
const balance = Math.max(0, parseNum(inv.total) - net);
const fullyPaid = balance <= 0.009;

 
  const clientDebtTotal = parseNum(inv?.client_debt_total ?? 0);

 return (
  <div className="only-print print-area p-14">
    <div className="max-w-[780px] mx-auto text-black">
      <div className="flex items-start justify-between">
        <div>
          <div style={{ fontWeight: 800, letterSpacing: 1 }}>
            {inv?.type === "Presupuesto" ? "PRESUPUESTO" : "FACTURA"}
          </div>
          <div style={{ marginTop: 2 }}>MITOBICEL</div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #000", margin: "10px 0 6px" }} />

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <div style={{ fontWeight: 700 }}>Cliente</div>
          <div>{inv.client_name}</div>
        </div>
        <div className="text-right">
          <div>
            <b>Factura Nº:</b> {pad(inv.number)}
          </div>
          <div>
            <b>Fecha:</b> {new Date(inv.date_iso).toLocaleDateString("es-AR")}
          </div>
          <div>
            <b>Estado del pago:</b> {fullyPaid ? "Pagado" : "Pendiente"}
          </div>
        </div>
      </div>

      <table className="print-table text-sm" style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th style={{ width: "6%" }}>#</th>
            <th>Descripción de artículo</th>
            <th style={{ width: "12%" }}>Cantidad</th>
            <th style={{ width: "18%" }}>Precio</th>
            <th style={{ width: "18%" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((it: any, i: number) => (
            <tr key={i}>
              <td style={{ textAlign: "right" }}>{i + 1}</td>
              <td>{it.name}</td>
              <td style={{ textAlign: "right" }}>{parseNum(it.qty)}</td>
              <td style={{ textAlign: "right" }}>{money(parseNum(it.unitPrice))}</td>
              <td style={{ textAlign: "right" }}>
                {money(parseNum(it.qty) * parseNum(it.unitPrice))}
              </td>
            </tr>
          ))}
        </tbody>

        {/* ===== tfoot corregido (un solo tfoot, sin anidar) ===== */}
        <tfoot>
          <tr>
            <td colSpan={4} style={{ textAlign: "right", fontWeight: 600 }}>
              Total
            </td>
            <td style={{ textAlign: "right", fontWeight: 700 }}>{money(inv.total)}</td>
          </tr>

          {/* debajo de la fila Total */}
          {typeof inv?.payments?.saldo_aplicado === "number" &&
            inv.payments.saldo_aplicado > 0 && (
              <>
                <tr>
                  <td colSpan={4} style={{ textAlign: "right" }}>
                    Saldo a favor aplicado
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {money(parseNum(inv.payments.saldo_aplicado))}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ textAlign: "right", fontWeight: 600 }}>
                    Total luego de saldo
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>
                    {money(
                      parseNum(
                        inv.total_after_credit ??
                          (inv.total - inv.payments.saldo_aplicado)
                      )
                    )}
                  </td>
                </tr>
              </>
            )}
        </tfoot>
      </table>

      <div className="grid grid-cols-2 gap-2 text-sm" style={{ marginTop: 8 }}>
        <div />
        <div>
          <div>
            <b>Método de pago:</b>
          </div>
          <div>CONTADO: {money(paidCash)}</div>
          <div>TRANSFERENCIA: {money(paidTransf)}</div>
          {inv?.payments?.change ? (
            <div>VUELTO: {money(parseNum(inv.payments.change))}</div>
          ) : null}
          {inv?.payments?.alias && (
            <div>Alias/CVU destino: {inv.payments.alias}</div>
          )}
          <div style={{ marginTop: 6 }}>
            <b>Cantidad pagada:</b> {money(paid)}
          </div>

          <div>
            <b>Cantidad adeudada:</b> {money(balance)}
          </div>
          <div style={{ marginTop: 6 }}>
            <b>Total adeudado como cliente:</b> {money(clientDebtTotal)}
          </div>
        </div>
      </div>

      {fullyPaid && (
        <div
          style={{
            position: "fixed",
            top: "55%",
            left: "50%",
            transform: "translate(-50%, -50%) rotate(-20deg)",
            fontSize: 64,
            fontWeight: 900,
            letterSpacing: 4,
            opacity: 0.08,
          }}
        >
          PAGADO
        </div>
      )}

      <div className="mt-10 text-xs text-center">{APP_TITLE}</div>
    </div>
  </div>
);
  } 

/* ===== Login ===== */
function Login({ onLogin, vendors, adminKey, clients }: any) {
  const [role, setRole] = useState("vendedor");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [clientNumber, setClientNumber] = useState("");

  const APP_TITLE = "Sistema de Gestión y Facturación — By Tobias Carrizo";

  function handleSubmit(e: any) {
    e.preventDefault();

    if (role === "admin") {
      if (key === adminKey) onLogin({ role: "admin", name: "Admin", id: "admin" });
      else alert("Clave de administrador incorrecta.");
      return;
    }

    if (role === "vendedor") {
      const v = vendors.find(
        (v: any) =>
          (v.name.toLowerCase() === name.trim().toLowerCase() || v.id === name.trim()) &&
          v.key === key
      );
      if (v) onLogin({ role: "vendedor", name: v.name, id: v.id });
      else alert("Vendedor o clave incorrecta.");
      return;
    }

    // CLIENTE
    if (role === "cliente") {
      const num = parseInt(String(clientNumber), 10);
      if (!num) {
        alert("Ingrese un número de cliente válido.");
        return;
      }
      const cl = clients.find((c: any) => parseInt(String(c.number), 10) === num);
      if (!cl) {
        alert("N° de cliente no encontrado.");
        return;
      }
      onLogin({ role: "cliente", name: cl.name, id: cl.id, number: cl.number });
      return;
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md w-full space-y-5">
        <div className="text-center">
          <h1 className="text-xl font-bold">{APP_TITLE}</h1>
          <p className="text-slate-400 text-sm">
            {hasSupabase ? "Conectado a Supabase" : "Sin base de datos"}
          </p>
        </div>

        <Card title="Ingreso">
          <form className="space-y-3" onSubmit={handleSubmit}>
            <Select
              label="Rol"
              value={role}
              onChange={setRole}
              options={[
                { value: "vendedor", label: "Vendedor" },
                { value: "admin", label: "Admin" },
                { value: "cliente", label: "Cliente" },
              ]}
            />

            {role === "vendedor" && (
              <>
                <Input
                  label="Vendedor (nombre o ID)"
                  value={name}
                  onChange={setName}
                  placeholder="Ej: Tobi o v1"
                />
                <Input
                  label="Clave"
                  value={key}
                  onChange={setKey}
                  placeholder="Clave asignada"
                  type="password"
                />
              </>
            )}

            {role === "admin" && (
              <Input
                label="Clave admin"
                value={key}
                onChange={setKey}
                placeholder="Clave de administrador"
                type="password"
              />
            )}

            {role === "cliente" && (
              <NumberInput
                label="N° de cliente"
                value={clientNumber}
                onChange={setClientNumber}
                placeholder="Ej: 1001"
              />
            )}

            <div className="flex items-center justify-end">
              <Button type="submit">Entrar</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

/* ===== Página principal ===== */
export default function Page() {
  const [state, setState] = useState<any>(seedState());
  const [session, setSession] = useState<any | null>(null);
  const [tab, setTab] = useState("Facturación");

  useEffect(() => {
    if (!hasSupabase) return;
    (async () => {
      const s = await loadFromSupabase(seedState());
      setState(s);
    })();
  }, []);

  function onLogin(user: any) {
    setSession(user);
    setTab(user.role === "cliente" ? "Panel" : "Facturación");
  }
  function onLogout() {
    setSession(null);
  }

  return (
    <>
      {/* App visible (no se imprime) */}
      <div className="min-h-screen bg-slate-950 text-slate-100 no-print">
        <style>{`::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-track{background:#0b1220}::-webkit-scrollbar-thumb{background:#22304a;border-radius:8px}::-webkit-scrollbar-thumb:hover{background:#2f436a}`}</style>

        {!session ? (
          <Login
            onLogin={onLogin}
            vendors={state.vendors}
            adminKey={state.auth.adminKey}
            clients={state.clients}
          />
        ) : (
          <>
            <Navbar current={tab} setCurrent={setTab} role={session.role} onLogout={onLogout} />

            {/* Panel de cliente */}
            {session.role === "cliente" && tab === "Panel" && (
              <ClientePanel state={state} setState={setState} session={session} />
            )}

            {/* Vendedor / Admin */}
            {session.role !== "cliente" && tab === "Facturación" && (
              <FacturacionTab state={state} setState={setState} session={session} />
            )}
            {session.role !== "cliente" && tab === "Clientes" && (
              <ClientesTab state={state} setState={setState} />
            )}
            {session.role !== "cliente" && tab === "Productos" && (
              <ProductosTab state={state} setState={setState} role={session.role} />
            )}
            {session.role !== "cliente" && tab === "Deudores" && (
              <DeudoresTab state={state} setState={setState} />
            )}
            {/* Cola */}
            {session.role !== "cliente" && tab === "Cola" && (
              <ColaTab state={state} setState={setState} session={session} />
            )}
            {session.role === "admin" && tab === "Vendedores" && (
              <VendedoresTab state={state} setState={setState} />
            )}
            {session.role === "admin" && tab === "Reportes" && (
              <ReportesTab state={state} setState={setState} />
            )}
                       {session.role !== "cliente" && tab === "Presupuestos" && (
              <PresupuestosTab state={state} setState={setState} session={session} />
            )}
            {session.role !== "cliente" && tab === "Gastos y Devoluciones" && (
  <GastosDevolucionesTab state={state} setState={setState} session={session} />
)}



            <div className="fixed bottom-3 right-3 text-[10px] text-slate-500 select-none">
              {hasSupabase ? "Supabase activo" : "Datos en navegador"}
            </div>
          </>
        )}
      </div>

      {/* Plantillas que sí se imprimen */}
      <PrintArea />
    </>
  );
}
