// CostosProduccionTab.tsx
// 👇 PEGAR TODO ESTE CÓDIGO EN EL NUEVO ARCHIVO

import React, { useState } from "react";
import { calcularCostoProduccion, TipoProducto, MedidaFilm } from "./CostosProduccionHelper";

function Card({ title, children }: any) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      {title && <h3 className="text-sm font-semibold text-slate-200 mb-3">{title}</h3>}
      {children}
    </div>
  );
}

function NumberInput({ label, value, onChange, placeholder = "" }: any) {
  return (
    <label className="block w-full">
      {label && <div className="text-xs text-slate-300 mb-1">{label}</div>}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
      />
    </label>
  );
}

function Select({ label, value, onChange, options }: any) {
  return (
    <label className="block w-full">
      {label && <div className="text-xs text-slate-300 mb-1">{label}</div>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
      >
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  );
}

function Button({ children, onClick, tone = "emerald" }: any) {
  const colors: any = {
    emerald: "bg-emerald-600 hover:bg-emerald-500",
    slate: "bg-slate-700 hover:bg-slate-600",
  };
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-semibold ${colors[tone]}`}
    >
      {children}
    </button>
  );
}

export default function CostosProduccionTab() {
  const [tipo, setTipo] = useState<TipoProducto>("rollito_fondo");
  const [kgBobina, setKgBobina] = useState("");
  const [kgPorBulto, setKgPorBulto] = useState("");
  const [medidaFilm, setMedidaFilm] = useState<MedidaFilm>("45");
  const [metrosSolicitados, setMetrosSolicitados] = useState("");
  const [valorDolar, setValorDolar] = useState("1000");
  const [valorHoraPersona, setValorHoraPersona] = useState("");
  const [horasTrabajadas, setHorasTrabajadas] = useState("");
  const [costoLuzMensual, setCostoLuzMensual] = useState("520000");
  const [diasTrabajadosMes, setDiasTrabajadosMes] = useState("26");
  const [valorFunda, setValorFunda] = useState("");
  const [valorPackaging, setValorPackaging] = useState("");
  const [valorCono, setValorCono] = useState("");
  const [resultado, setResultado] = useState<any>(null);

  const handleCalcular = () => {
    const params = {
      tipo,
      kg_bobina: parseFloat(kgBobina) || 0,
      kg_por_bulto: parseFloat(kgPorBulto) || 0,
      medida_film: medidaFilm,
      metros_solicitados: parseFloat(metrosSolicitados) || 0,
      valor_dolar: parseFloat(valorDolar) || 1000,
      valor_hora_persona: parseFloat(valorHoraPersona) || 0,
      horas_trabajadas: parseFloat(horasTrabajadas) || 0,
      costo_luz_mensual: parseFloat(costoLuzMensual) || 520000,
      dias_trabajados_mes: parseFloat(diasTrabajadosMes) || 26,
      valor_funda: parseFloat(valorFunda) || 0,
      valor_packaging: parseFloat(valorPackaging) || 0,
      valor_cono: parseFloat(valorCono) || 0,
    };

    const res = calcularCostoProduccion(params);
    setResultado(res);
  };

  const limpiar = () => {
    setKgBobina("");
    setKgPorBulto("");
    setMetrosSolicitados("");
    setValorHoraPersona("");
    setHorasTrabajadas("");
    setValorFunda("");
    setValorPackaging("");
    setValorCono("");
    setResultado(null);
  };

  const formatMoney = (n: number) => {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <Card title="🏭 Calculadora de Costos de Producción">
        <div className="grid md:grid-cols-2 gap-4">
          <Select
            label="Tipo de producto"
            value={tipo}
            onChange={setTipo}
            options={[
              { value: "rollito_fondo", label: "📦 Rollito Fondo Estrella (3.5% scrap)" },
              { value: "bolsa_camiseta", label: "🛍️ Bolsa Camiseta (12% scrap)" },
              { value: "film", label: "📜 Film (sin scrap)" },
            ]}
          />

          {/* Sección MATERIAL según tipo */}
          {tipo === "rollito_fondo" || tipo === "bolsa_camiseta" ? (
            <>
              <NumberInput
                label="💰 Valor del kg de bobina (ARS)"
                value={kgBobina}
                onChange={setKgBobina}
                placeholder="Ej: 1000"
              />
              <NumberInput
                label="📦 Kg por bulto"
                value={kgPorBulto}
                onChange={setKgPorBulto}
                placeholder="Ej: 4"
              />
            </>
          ) : (
            <>
              <Select
                label="📏 Medida de la bobina"
                value={medidaFilm}
                onChange={setMedidaFilm}
                options={[
                  { value: "30", label: "30 cm - 5000 mts" },
                  { value: "38", label: "38 cm - 5000 mts" },
                  { value: "45", label: "45 cm - 5000 mts" },
                ]}
              />
              <NumberInput
                label="📏 Metros solicitados"
                value={metrosSolicitados}
                onChange={setMetrosSolicitados}
                placeholder="Ej: 1000"
              />
              <NumberInput
                label="💵 Valor del dólar (ARS)"
                value={valorDolar}
                onChange={setValorDolar}
                placeholder="Ej: 1000"
              />
            </>
          )}

          {/* Sección COSTOS GENERALES */}
          <NumberInput
            label="👤 Valor hora de persona (ARS)"
            value={valorHoraPersona}
            onChange={setValorHoraPersona}
            placeholder="Ej: 5000"
          />
          <NumberInput
            label="⏱️ Horas trabajadas"
            value={horasTrabajadas}
            onChange={setHorasTrabajadas}
            placeholder="Ej: 8"
          />
          <NumberInput
            label="💡 Costo luz mensual (ARS)"
            value={costoLuzMensual}
            onChange={setCostoLuzMensual}
            placeholder="Ej: 520000"
          />
          <NumberInput
            label="📅 Días trabajados por mes"
            value={diasTrabajadosMes}
            onChange={setDiasTrabajadosMes}
            placeholder="Ej: 26"
          />
          <NumberInput
            label="📦 Valor de funda (ARS)"
            value={valorFunda}
            onChange={setValorFunda}
            placeholder="Ej: 100"
          />
          <NumberInput
            label="📦 Valor de packaging (ARS)"
            value={valorPackaging}
            onChange={setValorPackaging}
            placeholder="Ej: 50"
          />
          <NumberInput
            label="🧵 Valor de cono (ARS)"
            value={valorCono}
            onChange={setValorCono}
            placeholder="Ej: 200"
          />
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={handleCalcular}>Calcular Costo</Button>
          <Button onClick={limpiar} tone="slate">Limpiar</Button>
        </div>

        {resultado && (
          <div className="mt-4 p-4 bg-slate-800/50 rounded-xl border border-emerald-700/50">
            <h4 className="font-bold text-emerald-400 mb-2">📊 RESULTADO FINAL</h4>
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-slate-400">💰 Costo Material</div>
                <div className="text-xl font-bold">{formatMoney(resultado.costo_material)}</div>
                {resultado.scrap > 0 && (
                  <div className="text-xs text-amber-400">+ Scrap: {formatMoney(resultado.scrap)}</div>
                )}
              </div>
              <div>
                <div className="text-slate-400">👤 Costo Persona</div>
                <div className="text-xl font-bold">{formatMoney(resultado.costo_persona)}</div>
              </div>
              <div>
                <div className="text-slate-400">💡 Costo Luz</div>
                <div className="text-xl font-bold">{formatMoney(resultado.costo_luz)}</div>
              </div>
              <div>
                <div className="text-slate-400">📦 Funda</div>
                <div className="font-bold">{formatMoney(resultado.costo_funda)}</div>
              </div>
              <div>
                <div className="text-slate-400">📦 Packaging</div>
                <div className="font-bold">{formatMoney(resultado.costo_packaging)}</div>
              </div>
              <div>
                <div className="text-slate-400">🧵 Cono</div>
                <div className="font-bold">{formatMoney(resultado.costo_cono)}</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-emerald-400">💰 COSTO TOTAL:</span>
                <span className="text-2xl font-bold text-emerald-400">
                  {formatMoney(resultado.costo_total)}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-2 whitespace-pre-line">
                {resultado.desglose}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
