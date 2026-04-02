// CostosProduccionHelper.ts

export type TipoProducto = "rollito_fondo" | "bolsa_camiseta" | "film";
export type MedidaFilm = "30" | "38" | "45";

const SCRAP_POR_TIPO: Record<TipoProducto, number> = {
  rollito_fondo: 0.035,
  bolsa_camiseta: 0.12,
  film: 0,
};

export interface CalcularCostoParams {
  tipo: TipoProducto;
  
  // Para rollito_fondo y bolsa_camiseta
  kg_bobina?: number;
  kg_por_bulto?: number;
  bultos_producidos?: number;
  
  // Para film
  medida_film?: MedidaFilm;
  valor_usd_bobina?: number;
  metros_solicitados?: number;
  valor_dolar?: number;
  metros_por_rollo?: number;
  
  // Costos generales
  valor_hora_persona?: number;
  horas_trabajadas?: number;
  cantidad_total_producida?: number;  // 👈 CUÁNTOS ROLLOS/BULTOS SALEN EN TOTAL
  costo_luz_mensual?: number;
  dias_trabajados_mes?: number;
  valor_funda?: number;
  valor_packaging?: number;
  valor_cono?: number;
}

export interface ResultadoCosto {
  costo_material_bruto: number;
  scrap: number;
  costo_material_total: number;
  costo_persona_total: number;
  costo_persona_por_unidad: number;  // 👈 NUEVO
  costo_luz_total: number;
  costo_luz_por_unidad: number;      // 👈 NUEVO
  costo_funda: number;
  costo_packaging: number;
  costo_cono: number;
  unidades_producidas: number;
  costo_total: number;
  costo_por_unidad: number;
  desglose: string;
}

export function calcularCostoProduccion(params: CalcularCostoParams): ResultadoCosto {
  const {
    tipo,
    kg_bobina = 0,
    kg_por_bulto = 0,
    bultos_producidos = 0,
    medida_film = "45",
    valor_usd_bobina = 0,
    metros_solicitados = 0,
    valor_dolar = 1000,
    metros_por_rollo = 0,
    valor_hora_persona = 0,
    horas_trabajadas = 0,
    cantidad_total_producida = 0,  // 👈 TOTAL de rollos/bultos que salen
    costo_luz_mensual = 520000,
    dias_trabajados_mes = 26,
    valor_funda = 0,
    valor_packaging = 0,
    valor_cono = 0,
  } = params;

  let costo_material_bruto = 0;
  let scrap = 0;
  let costo_material_total = 0;
  let unidades_producidas = 0;
  let desglose = "";

  // ============================================
  // 1. MATERIAL
  // ============================================
  if (tipo === "rollito_fondo" || tipo === "bolsa_camiseta") {
    const costo_por_bulto = kg_bobina * kg_por_bulto;
    costo_material_bruto = costo_por_bulto * bultos_producidos;
    const porcentaje_scrap = SCRAP_POR_TIPO[tipo];
    scrap = costo_material_bruto * porcentaje_scrap;
    costo_material_total = costo_material_bruto + scrap;
    unidades_producidas = bultos_producidos;
    
    desglose = `📦 MATERIAL (${tipo === "rollito_fondo" ? "Rollito Fondo" : "Bolsa Camiseta"}):\n`;
    desglose += `   Costo por bulto: ${money(kg_bobina)}/kg × ${kg_por_bulto}kg = ${money(costo_por_bulto)}\n`;
    desglose += `   × ${bultos_producidos} bultos = ${money(costo_material_bruto)}\n`;
    desglose += `   + ${porcentaje_scrap * 100}% scrap (${money(scrap)}) = ${money(costo_material_total)}\n`;
    desglose += `   → Salen ${unidades_producidas} bultos\n`;
  } 
  else if (tipo === "film") {
    const valor_bobina_ars = valor_usd_bobina * valor_dolar;
    const metros_totales_bobina = 5000;
    const valor_por_metro = valor_bobina_ars / metros_totales_bobina;
    costo_material_bruto = valor_por_metro * metros_solicitados;
    scrap = 0;
    costo_material_total = costo_material_bruto;
    
    if (metros_por_rollo > 0 && metros_solicitados > 0) {
      unidades_producidas = metros_solicitados / metros_por_rollo;
    } else {
      unidades_producidas = 0;
    }
    
    desglose = `📦 FILM ${medida_film}cm:\n`;
    desglose += `   Bobina: ${valor_usd_bobina} USD × ${valor_dolar} = ${money(valor_bobina_ars)}\n`;
    desglose += `   / ${metros_totales_bobina}m = ${money(valor_por_metro)}/m\n`;
    desglose += `   × ${metros_solicitados}m = ${money(costo_material_bruto)}\n`;
    desglose += `   → Salen ${unidades_producidas.toFixed(2)} rollos de ${metros_por_rollo}m c/u\n`;
  }

  // ============================================
  // 2. MANO DE OBRA - POR UNIDAD
  // ============================================
  // 🔥 NUEVA LÓGICA: El costo por hora se divide por la cantidad de unidades que salen POR HORA
  const costo_persona_total = valor_hora_persona * horas_trabajadas;
  
  // Calcular cuántas unidades salen por hora
  const unidades_por_hora = cantidad_total_producida > 0 && horas_trabajadas > 0
    ? cantidad_total_producida / horas_trabajadas
    : 0;
  
  // Costo de mano de obra por unidad = (valor hora) / (unidades por hora)
  const costo_persona_por_unidad = unidades_por_hora > 0
    ? valor_hora_persona / unidades_por_hora
    : 0;
  
  desglose += `\n👤 MANO DE OBRA:\n`;
  desglose += `   Valor hora: ${money(valor_hora_persona)}/h\n`;
  desglose += `   En ${horas_trabajadas}h salen ${cantidad_total_producida} unidades\n`;
  desglose += `   → Unidades por hora: ${unidades_por_hora.toFixed(2)}\n`;
  desglose += `   → Costo mano de obra por unidad: ${money(valor_hora_persona)} ÷ ${unidades_por_hora.toFixed(2)} = ${money(costo_persona_por_unidad)}\n`;
  desglose += `   Total mano de obra: ${money(costo_persona_total)}\n`;

  // ============================================
  // 3. LUZ - POR UNIDAD
  // ============================================
  const costo_luz_por_hora = costo_luz_mensual / (dias_trabajados_mes * 24);
  const costo_luz_total = costo_luz_por_hora * horas_trabajadas;
  
  // Costo de luz por unidad = (costo luz por hora) / (unidades por hora)
  const costo_luz_por_unidad = unidades_por_hora > 0
    ? costo_luz_por_hora / unidades_por_hora
    : 0;
  
  desglose += `\n💡 LUZ:\n`;
  desglose += `   Costo luz por hora: ${money(costo_luz_por_hora)}/h\n`;
  desglose += `   → Costo luz por unidad: ${money(costo_luz_por_hora)} ÷ ${unidades_por_hora.toFixed(2)} = ${money(costo_luz_por_unidad)}\n`;
  desglose += `   Total luz: ${money(costo_luz_total)}\n`;

  // ============================================
  // 4. OTROS COSTOS (por unidad, se multiplican por unidades totales)
  // ============================================
  const costo_funda_total = valor_funda * unidades_producidas;
  const costo_packaging_total = valor_packaging * unidades_producidas;
  const costo_cono_total = valor_cono * unidades_producidas;
  
  if (valor_funda > 0) desglose += `\n📦 Funda: ${money(valor_funda)} × ${unidades_producidas.toFixed(2)} = ${money(costo_funda_total)}`;
  if (valor_packaging > 0) desglose += `\n📦 Packaging: ${money(valor_packaging)} × ${unidades_producidas.toFixed(2)} = ${money(costo_packaging_total)}`;
  if (valor_cono > 0) desglose += `\n🧵 Cono: ${money(valor_cono)} × ${unidades_producidas.toFixed(2)} = ${money(costo_cono_total)}`;

  // ============================================
  // 5. COSTO POR UNIDAD (suma de todos los costos por unidad)
  // ============================================
  // 🔥 NUEVO: El costo por unidad se calcula sumando:
  // - Costo material por unidad
  // - Costo mano de obra por unidad
  // - Costo luz por unidad
  // - Funda + packaging + cono (estos ya son por unidad)
  
  const costo_material_por_unidad = unidades_producidas > 0
    ? costo_material_total / unidades_producidas
    : 0;
  
  const costo_por_unidad = costo_material_por_unidad + costo_persona_por_unidad + costo_luz_por_unidad + valor_funda + valor_packaging + valor_cono;
  
  // Costo total = costo por unidad × unidades producidas
  const costo_total = costo_por_unidad * unidades_producidas;
  
  desglose += `\n\n📊 RESUMEN COSTO POR UNIDAD:\n`;
  desglose += `   Material por unidad: ${money(costo_material_por_unidad)}\n`;
  desglose += `   Mano de obra por unidad: + ${money(costo_persona_por_unidad)}\n`;
  desglose += `   Luz por unidad: + ${money(costo_luz_por_unidad)}\n`;
  desglose += `   Funda: + ${money(valor_funda)}\n`;
  desglose += `   Packaging: + ${money(valor_packaging)}\n`;
  desglose += `   Cono: + ${money(valor_cono)}\n`;
  desglose += `   = ${money(costo_por_unidad)} por unidad\n`;
  desglose += `\n💰 COSTO TOTAL (${unidades_producidas.toFixed(2)} unidades): ${money(costo_total)}`;

  return {
    costo_material_bruto,
    scrap,
    costo_material_total,
    costo_persona_total,
    costo_persona_por_unidad,
    costo_luz_total,
    costo_luz_por_unidad,
    costo_funda: costo_funda_total,
    costo_packaging: costo_packaging_total,
    costo_cono: costo_cono_total,
    unidades_producidas,
    costo_total,
    costo_por_unidad,
    desglose,
  };
}

function money(n: number): string {
  return new Intl.NumberFormat("es-AR", { 
    style: "currency", 
    currency: "ARS", 
    maximumFractionDigits: 2 
  }).format(n || 0);
}
