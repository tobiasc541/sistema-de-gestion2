"use client";
export const dynamic = "force-dynamic"; // evita pre-render estatico
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

/* ===== seed inicial (solo UI mientras carga supabase) ===== */
function seedState() {
  return {
    meta: { invoiceCounter: 1, budgetCounter: 1, lastSavedInvoiceId: null as null | string },
    auth: { adminKey: "46892389" },
    vendors: [] as any[],
    clients: [] as any[],
    products: [] as any[],
    invoices: [] as any[],
    budgets: [] as any[],
  };
}

/* ===== Carga/actualización desde Supabase ===== */
async function loadFromSupabase(fallback: any) {
  if (!hasSupabase) return fallback;
  const out = clone(fallback);

  const { data: meta } = await supabase.from("meta").select("*").eq("key", "counters").maybeSingle();
  if (meta?.value) out.meta = { ...out.meta, ...meta.value };

  const { data: vendors } = await supabase.from("vendors").select("*");
  if (vendors) out.vendors = vendors;

  const { data: clients } = await supabase.from("clients").select("*");
  if (clients) out.clients = clients;

  const { data: products } = await supabase.from("products").select("*");
  if (products) out.products = products;

  const { data: invoices } = await supabase.from("invoices").select("*").order("number");
  if (invoices) out.invoices = invoices;

  const { data: budgets } = await supabase.from("budgets").select("*").order("number");
  if (budgets) out.budgets = budgets;

  return out;
}

async function saveCountersSupabase(meta: any) {
  if (!hasSupabase) return;
  await supabase.from("meta").upsert({
    key: "counters",
    value: { invoiceCounter: meta.invoiceCounter, budgetCounter: meta.budgetCounter },
  });
}

/* ====== UI atoms (Card/Button/Input/Select/Chip) ====== */
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

/* ===== Navbar ===== */
function Navbar({ current, setCurrent, role, onLogout }: any) {
  const TABS = ["Facturación", "Clientes", "Productos", "Deudores", "Vendedores", "Reportes", "Presupuestos"];
  const visibleTabs = role === "admin" ? TABS : ["Facturación", "Clientes", "Productos", "Deudores"];
  return (
    <div className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="text-sm font-bold tracking-wide">💼 Facturación — {hasSupabase ? "Supabase" : "Local"}</div>
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

/* ======= TABS (tu misma lógica de antes, SOLO supabase) ======= */
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
  const [alias, setAlias] = useState("");

  const client = state.clients.find((c: any) => c.id === clientId);
  const vendor = state.vendors.find((v: any) => v.id === vendorId);

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
    const cash = parseNum(payCash);
    const transf = parseNum(payTransf);
    const paid = Math.min(total, cash + transf);
    const debtDelta = Math.max(0, total - paid);
    const status = debtDelta > 0 ? "No Pagada" : "Pagada";

    const st = clone(state);
    const number = st.meta.invoiceCounter++;
    const id = "inv_" + number;

    const invoice = {
      id,
      number,
      date_iso: todayISO(),
      client_id: client.id,
      client_name: client.name,
      vendor_id: vendor.id,
      vendor_name: vendor.name,
      items: clone(items),
      total,
      cost: calcInvoiceCost(items),
      payments: { cash, transfer: transf, alias: alias.trim() },
      status,
      type: "Factura",
    };

    st.invoices.push(invoice);
    st.meta.lastSavedInvoiceId = id;
    const cl = st.clients.find((c: any) => c.id === client.id)!;
    cl.debt = parseNum(cl.debt) + debtDelta;
    setState(st);

    if (hasSupabase) {
      await supabase.from("invoices").insert(invoice);
      await supabase.from("clients").update({ debt: cl.debt }).eq("id", client.id);
      await saveCountersSupabase(st.meta);
    }

    setTimeout(() => {
      const evt = new CustomEvent("print-invoice", { detail: invoice } as any);
      window.dispatchEvent(evt);
      window.print();
    }, 50);
  }

  const total = calcInvoiceTotal(items);
  const paid = parseNum(payCash) + parseNum(payTransf);
  const toPay = Math.max(0, total - paid);
  const grouped = groupBy(filteredProducts, "section");

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      {/* ... (misma UI que ya tenías: Encabezado, Pagos, Totales, Productos, Carrito) ... */}
      {/* Por brevedad omití markup repetido; usá el mismo JSX que ya tenías en tu archivo */}
      {/* Asegurate de conservar el botón: <Button onClick={saveAndPrint}>Guardar e Imprimir</Button> */}
    </div>
  );
}

/* Clientes, Productos, Deudores, Vendedores, Reportes, Presupuestos */
/* 👇 mantené exactamente tus implementaciones actuales (todas usan supabase). No hay localStorage. */


/* ===== Área de impresión ===== */
function PrintArea() {
  const [inv, setInv] = useState<any | null>(null);
  useEffect(() => {
    const handler = (e: any) => setInv(e.detail);
    window.addEventListener("print-invoice", handler);
    return () => window.removeEventListener("print-invoice", handler);
  }, []);
  return (
    <div id="print-area" className="hidden">
      <style>{`@media print { body * { visibility: hidden !important; } #__PRINT__, #__PRINT__ * { visibility: visible !important; } #__PRINT__ { position: absolute; inset: 0; padding: 0; margin: 0; } .no-print { display:none !important } }`}</style>
      {/* … (tu mismo template de impresión) … */}
    </div>
  );
}

/* ===== Login ===== */
function Login({ onLogin, vendors, adminKey }: any) {
  const [role, setRole] = useState("vendedor");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  function handleSubmit(e: any) {
    e.preventDefault();
    if (role === "admin") return key === adminKey ? onLogin({ role: "admin", name: "Admin", id: "admin" }) : alert("Clave de administrador incorrecta.");
    const v = vendors.find((v: any) => (v.name.toLowerCase() === name.trim().toLowerCase() || v.id === name.trim()) && v.key === key);
    if (v) onLogin({ role: "vendedor", name: v.name, id: v.id });
    else alert("Vendedor o clave incorrecta.");
  }
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md w-full space-y-5">
        <div className="text-center">
          <h1 className="text-xl font-bold">Sistema de Facturación</h1>
          <p className="text-slate-400 text-sm">{hasSupabase ? "Conectado a Supabase" : "Sin base de datos"}</p>
        </div>
        <Card title="Ingreso">
          <form className="space-y-3" onSubmit={handleSubmit}>
            <Select label="Rol" value={role} onChange={setRole} options={[{ value: "vendedor", label: "Vendedor" }, { value: "admin", label: "Admin" }]} />
            {role === "vendedor" && <Input label="Vendedor (nombre o ID)" value={name} onChange={setName} placeholder="Ej: Tobi o v1" />}
            <Input label="Clave" value={key} onChange={setKey} placeholder={role === "admin" ? "46892389" : "Clave asignada"} type="password" />
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400">Admin demo: 46892389 | Vendedor demo: Tobi / 1234</div>
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
    setTab("Facturación");
  }
  function onLogout() {
    setSession(null);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <style>{`::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-track{background:#0b1220}::-webkit-scrollbar-thumb{background:#22304a;border-radius:8px}::-webkit-scrollbar-thumb:hover{background:#2f436a}`}</style>
      {!session ? (
        <Login onLogin={onLogin} vendors={state.vendors} adminKey={state.auth.adminKey} />
      ) : (
        <>
          <Navbar current={tab} setCurrent={setTab} role={session.role} onLogout={onLogout} />
          {/* poné aquí tus tabs ya existentes (versión supabase) */}
          {/* <FacturacionTab .../> <ClientesTab .../> <ProductosTab .../> <DeudoresTab .../> <VendedoresTab .../> <ReportesTab .../> <PresupuestosTab .../> */}
          <PrintArea />
          <div className="fixed bottom-3 right-3 text-[10px] text-slate-500 select-none">
            {hasSupabase ? "Supabase activo" : "Datos en navegador"}
          </div>
        </>
      )}
    </div>
  );
}
