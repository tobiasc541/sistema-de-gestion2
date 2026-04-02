// CostosProduccionTab.tsx

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
  
  // Campos para Rollito y Bolsa Camiseta
  const [kgBobina, setKgBobina] = useState("");
  const [kgPorBulto, setKgPorBulto] = useState("");
  const [bultosProducidos, setBultosProducidos] = useState("");
  
  // Campos para Film (SOLO PARA FILM)
  const [medidaFilm, setMedidaFilm] = useState<MedidaFilm>("45");
  const [valorUsdBobina, setValorUsdBobina] = useState("");
  const [metrosSolicitados, setMetrosSolicitados] = useState("");
  const [metrosPorRollo, setMetrosPorRollo] = useState("");
  const [valorDolar, setValorDolar] = useState("1000");
  
  // Campos COMUNES para TODOS los tipos
  const [valorHoraPersona, setValorHoraPersona] = useState("");
  const [horasTrabajadas, setHorasTrabajadas] = useState("");
  const [cantidadProducidaAprox, setCantidadProducidaAprox] = useState("");
  const [costoLuzMensual, setCostoLuzMensual] = useState("520000");
  const [diasTrabajadosMes, setDiasTrabajadosMes] = useState("26");
  const [valorFunda, setValorFunda] = useState("");
  const [valorPackaging, setValorPackaging] = useState("");
  const [valorCono, setValorCono] = useState("");
  
  const [resultado, setResultado] = useState<any>(null);

  const handleCalcular = () => {
    const params: any = {
      tipo,
      // Generales
      valor_hora_persona: parseFloat(valorHoraPersona) || 0,
      horas_trabajadas: parseFloat(horasTrabajadas) || 0,
      cantidad_producida_aprox: parseFloat(cantidadProducidaAprox) || 0,
      costo_luz_mensual: parseFloat(costoLuzMensual) || 520000,
      dias_trabajados_mes: parseFloat(diasTrabajadosMes) || 26,
      valor_funda: parseFloat(valorFunda) || 0,
      valor_packaging: parseFloat(valorPackaging) || 0,
      valor_cono: parseFloat(valorCono) || 0,
    };

    if (tipo === "rollito_fondo" || tipo === "bolsa_camiseta") {
      params.kg_bobina = parseFloat(kgBobina) || 0;
      params.kg_por_bulto = parseFloat(kgPorBulto) || 0;
      params.bultos_producidos = parseFloat(bultosProducidos) || 0;
    } 
    else if (tipo === "film") {
      params.medida_film = medidaFilm;
      params.valor_usd_bobina = parseFloat(valorUsdBobina) || 0;
      params.metros_solicitados = parseFloat(metrosSolicitados) || 0;
      params.metros_por_rollo = parseFloat(metrosPorRollo) || 0;
      params.valor_dolar = parseFloat(valorDolar) || 1000;
    }

    const res = calcularCostoProduccion(params);
    setResultado(res);
  };

  const limpiar = () => {
    setKgBobina("");
    setKgPorBulto("");
    setBultosProducidos("");
    setValorUsdBobina("");
    setMetrosSolicitados("");
    setMetrosPorRollo("");
    setValorHoraPersona("");
    setHorasTrabajadas("");
    setCantidadProducidaAprox("");
    setValorFunda("");
    setValorPackaging("");
    setValorCono("");
    setResultado(null);
  };

  const formatMoney = (n: number) => {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);
  };

  // Determinar qué campos mostrar según el tipo
  const esRollitoOBolsa = tipo === "rollito_fondo" || tipo === "bolsa_camiseta";
  const esFilm = tipo === "film";

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <Card title="🏭 Calculadora de Costos de Producción">
        
        {/* SELECTOR DE TIPO DE PRODUCTO */}
        <div className="mb-6">
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
        </div>

        {/* SECCIÓN MATERIAL - SOLO PARA ROLLITO Y BOLSA */}
        {esRollitoOBolsa && (
          <div className="mb-6 p-4 bg-slate-800/30 rounded-lg">
            <h4 className="text-sm font-semibold text-emerald-400 mb-3">📦 Material (Bobina por KG)</h4>
            <div className="grid md:grid-cols-3 gap-4">
              <NumberInput
                label="💰 Valor del kg de bobina (ARS)"
                value={kgBobina}
                onChange={setKgBobina}
                placeholder="Ej: 1000"
              />
              <NumberInput
                label="⚖️ Kg por bulto"
                value={kgPorBulto}
                onChange={setKgPorBulto}
                placeholder="Ej: 4"
              />
              <NumberInput
                label="📦 Cantidad de bultos producidos"
                value={bultosProducidos}
                onChange={setBultosProducidos}
                placeholder="Ej: 50"
              />
            </div>
          </div>
        )}

        {/* SECCIÓN MATERIAL - SOLO PARA FILM */}
        {esFilm && (
          <div className="mb-6 p-4 bg-slate-800/30 rounded-lg">
            <h4 className="text-sm font-semibold text-emerald-400 mb-3">📜 Film (Bobina por Metro)</h4>
            <div className="grid md:grid-cols-2 gap-4">
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
                label="💰 Valor de la bobina (USD) - MANUAL"
                value={valorUsdBobina}
                onChange={setValorUsdBobina}
                placeholder="Ej: 100"
              />
              <NumberInput
                label="📏 Metros solicitados"
                value={metrosSolicitados}
                onChange={setMetrosSolicitados}
                placeholder="Ej: 140"
              />
              <NumberInput
                label="📏 Metros por rollo (aprox)"
                value={metrosPorRollo}
                onChange={setMetrosPorRollo}
                placeholder="Ej: 50"
              />
              <NumberInput
                label="💵 Valor del dólar (ARS)"
                value={valorDolar}
                onChange={setValorDolar}
                placeholder="Ej: 1000"
              />
            </div>
          </div>
        )}

        {/* SECCIÓN COMÚN PARA TODOS: MANO DE OBRA */}
        <div className="mb-6 p-4 bg-slate-800/30 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-400 mb-3">👤 Mano de Obra</h4>
          <div className="grid md:grid-cols-3 gap-4">
            <NumberInput
              label="💰 Valor hora de persona (ARS)"
              value={valorHoraPersona}
              onChange={setValorHoraPersona}
              placeholder="Ej: 5000"
            />
            <NumberInput
              label="⏱️ Horas trabajadas"
              value={horasTrabajadas}
              onChange={setHorasTrabajadas}
              placeholder="Ej: 12"
            />
            <NumberInput
              label="📦 Cantidad aprox producida (rollos/camisetas/rollos film)"
              value={cantidadProducidaAprox}
              onChange={setCantidadProducidaAprox}
              placeholder="Ej: 100"
            />
          </div>
          <div className="text-xs text-slate-400 mt-2">
            💡 La cantidad aprox se usa para dividir el costo de mano de obra por unidad
          </div>
        </div>

        {/* SECCIÓN COMÚN PARA TODOS: LUZ */}
        <div className="mb-6 p-4 bg-slate-800/30 rounded-lg">
          <h4 className="text-sm font-semibold text-amber-400 mb-3">💡 Costo de Luz</h4>
          <div className="grid md:grid-cols-2 gap-4">
            <NumberInput
              label="💰 Costo luz mensual (ARS)"
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
          </div>
        </div>

        {/* SECCIÓN COMÚN PARA TODOS: OTROS COSTOS */}
        <div className="mb-6 p-4 bg-slate-800/30 rounded-lg">
          <h4 className="text-sm font-semibold text-purple-400 mb-3">📦 Otros Costos</h4>
          <div className="grid md:grid-cols-3 gap-4">
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
        </div>

        {/* BOTONES */}
        <div className="flex gap-2">
          <Button onClick={handleCalcular}>Calcular Costo</Button>
          <Button onClick={limpiar} tone="slate">Limpiar</Button>
        </div>

        {/* RESULTADO */}
        {resultado && (
          <div className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-emerald-700/50">
            <h4 className="font-bold text-emerald-400 mb-3 text-lg">📊 RESULTADO FINAL</h4>
            
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              {/* Material */}
              <div className="p-3 bg-slate-900/50 rounded-lg">
                <div className="text-slate-400 font-semibold mb-2">💰 Material</div>
                <div>Bruto: {formatMoney(resultado.costo_material_bruto)}</div>
                {resultado.scrap > 0 && (
                  <div className="text-amber-400">+ Scrap: {formatMoney(resultado.scrap)}</div>
                )}
                <div className="font-bold text-emerald-400 mt-1">
                  Total: {formatMoney(resultado.costo_material_total)}
                </div>
              </div>

              {/* Mano de obra */}
              <div className="p-3 bg-slate-900/50 rounded-lg">
                <div className="text-slate-400 font-semibold mb-2">👤 Mano de Obra</div>
                <div>Total: {formatMoney(resultado.costo_persona_total)}</div>
                {resultado.costo_persona_por_unidad > 0 && (
                  <div className="text-blue-400">Por unidad: {formatMoney(resultado.costo_persona_por_unidad)}</div>
                )}
              </div>

              {/* Luz */}
              <div className="p-3 bg-slate-900/50 rounded-lg">
                <div className="text-slate-400 font-semibold mb-2">💡 Luz</div>
                <div>Total: {formatMoney(resultado.costo_luz_total)}</div>
                {resultado.costo_luz_por_unidad > 0 && (
                  <div className="text-amber-400">Por unidad: {formatMoney(resultado.costo_luz_por_unidad)}</div>
                )}
              </div>

              {/* Otros costos */}
              <div className="p-3 bg-slate-900/50 rounded-lg">
                <div className="text-slate-400 font-semibold mb-2">📦 Otros</div>
                <div>Funda: {formatMoney(resultado.costo_funda)}</div>
                <div>Packaging: {formatMoney(resultado.costo_packaging)}</div>
                <div>Cono: {formatMoney(resultado.costo_cono)}</div>
              </div>
            </div>

            {/* TOTALES */}
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-emerald-400">💰 COSTO TOTAL:</span>
                <span className="text-2xl font-bold text-emerald-400">
                  {formatMoney(resultado.costo_total)}
                </span>
              </div>
              {resultado.costo_por_unidad > 0 && (
                <div className="flex justify-between items-center mt-2">
                  <span className="text-md font-bold text-blue-400">💰 COSTO POR UNIDAD:</span>
                  <span className="text-xl font-bold text-blue-400">
                    {formatMoney(resultado.costo_por_unidad)}
                  </span>
                </div>
              )}
            </div>

            {/* DESGLOSE DETALLADO */}
            <div className="mt-4 p-3 bg-slate-900/30 rounded-lg">
              <div className="text-xs text-slate-400 whitespace-pre-line font-mono">
                {resultado.desglose}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
