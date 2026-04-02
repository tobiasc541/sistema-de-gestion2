// CostosProduccionHelper.ts

export type TipoProducto = "rollito_fondo" | "bolsa_camiseta" | "film";
export type MedidaFilm = "30" | "38" | "45";

// Scrap por tipo de producto
const SCRAP_POR_TIPO: Record<TipoProducto, number> = {
  rollito_fondo: 0.035,  // 3.5%
  bolsa_camiseta: 0.12,  // 12%
  film: 0,               // 0%
};

export interface CalcularCostoParams {
  tipo: TipoProducto;
  
  // Para rollito_fondo y bolsa_camiseta (por KG)
  kg_bobina?: number;      // Precio por KG de la bobina
  kg_por_bulto?: number;   // KG que pesa cada bulto
  bultos_producidos?: number; // Cantidad de bultos que salen en esas horas
  
  // Para film (por METRO)
  medida_film?: MedidaFilm;
  valor_usd_bobina?: number;  // MANUAL: valor en USD de la bobina
  metros_solicitados?: number;
  valor_dolar?: number;
  metros_por_rollo?: number;  // Cuántos metros tiene CADA ROLLO que sale
  
  // Costos generales
  valor_hora_persona?: number;
  horas_trabajadas?: number;
  
  costo_luz_mensual?: number;
  dias_trabajados_mes?: number;
  
  // Otros costos fijos (por unidad producida)
  valor_funda?: number;
  valor_packaging?: number;
  valor_cono?: number;
}

export interface ResultadoCosto {
  // Material
  costo_material_bruto: number;
  scrap: number;
  costo_material_total: number;
  
  // Mano de obra
  costo_persona_total: number;
  
  // Luz
  costo_luz_total: number;
  
  // Otros
  costo_funda: number;
  costo_packaging: number;
  costo_cono: number;
  
  // Cantidad de unidades que salen
  unidades_producidas: number;  // 👈 CLAVE: cuántos rollos/bultos/camisetas salen
  
  // Totales
  costo_total: number;
  costo_por_unidad: number;  // 👈 CLAVE: costo TOTAL / unidades_producidas
  
  desglose: string;
}

export function calcularCostoProduccion(params: CalcularCostoParams): ResultadoCosto {
  const {
    tipo,
    // Rollito y bolsa
    kg_bobina = 0,
    kg_por_bulto = 0,
    bultos_producidos = 0,
    // Film
    medida_film = "45",
    valor_usd_bobina = 0,
    metros_solicitados = 0,
    valor_dolar = 1000,
    metros_por_rollo = 0,
    // Generales
    valor_hora_persona = 0,
    horas_trabajadas = 0,
    costo_luz_mensual = 520000,
    dias_trabajados_mes = 26,
    valor_funda = 0,
    valor_packaging = 0,
    valor_cono = 0,
  } = params;

  let costo_material_bruto = 0;
  let scrap = 0;
  let costo_material_total = 0;
  let unidades_producidas = 0;  // 👈 Acá guardamos cuántas unidades salen
  let desglose = "";

  // ============================================
  // 1. CALCULAR COSTO DE MATERIAL según tipo
  // ============================================
  if (tipo === "rollito_fondo" || tipo === "bolsa_camiseta") {
    // Costo por KG de bobina × KG por bulto × cantidad de bultos
    const costo_por_bulto = kg_bobina * kg_por_bulto;
    costo_material_bruto = costo_por_bulto * bultos_producidos;
    const porcentaje_scrap = SCRAP_POR_TIPO[tipo];
    scrap = costo_material_bruto * porcentaje_scrap;
    costo_material_total = costo_material_bruto + scrap;
    
    // 📦 UNIDADES QUE SALEN = bultos producidos
    unidades_producidas = bultos_producidos;
    
    desglose = `📦 MATERIAL (${tipo === "rollito_fondo" ? "Rollito Fondo" : "Bolsa Camiseta"}):\n`;
    desglose += `   Costo por bulto: ${money(kg_bobina)}/kg × ${kg_por_bulto}kg = ${money(costo_por_bulto)}\n`;
    desglose += `   × ${bultos_producidos} bultos = ${money(costo_material_bruto)}\n`;
    desglose += `   + ${porcentaje_scrap * 100}% scrap (${money(scrap)}) = ${money(costo_material_total)}\n`;
    desglose += `   → Salen ${unidades_producidas} bultos\n`;
  } 
  else if (tipo === "film") {
    // Film: valor en USD de la bobina × cotización dólar
    const valor_bobina_ars = valor_usd_bobina * valor_dolar;
    const metros_totales_bobina = 5000;
    const valor_por_metro = valor_bobina_ars / metros_totales_bobina;
    costo_material_bruto = valor_por_metro * metros_solicitados;
    scrap = 0;
    costo_material_total = costo_material_bruto;
    
    // 🎞️ UNIDADES QUE SALEN = cantidad de rollos de film
    // Si cada rollo tiene X metros, cuántos rollos salen de los metros solicitados?
    if (metros_por_rollo > 0 && metros_solicitados > 0) {
      unidades_producidas = metros_solicitados / metros_por_rollo;  // Puede dar decimal (ej: 140 / 7.8 = 17.94)
    } else {
      unidades_producidas = 0;
    }
    
    desglose = `📦 FILM ${medida_film}cm:\n`;
    desglose += `   Bobina: ${valor_usd_bobina} USD × ${valor_dolar} = ${money(valor_bobina_ars)}\n`;
    desglose += `   / ${metros_totales_bobina}m = ${money(valor_por_metro)}/m\n`;
    desglose += `   × ${metros_solicitados}m = ${money(costo_material_bruto)}\n`;
    if (metros_por_rollo > 0) {
      desglose += `   → Salen ${unidades_producidas.toFixed(2)} rollos de ${metros_por_rollo}m c/u\n`;
    }
  }

  // ============================================
  // 2. CALCULAR COSTO DE PERSONA (TOTAL)
  // ============================================
  const costo_persona_total = valor_hora_persona * horas_trabajadas;
  
  desglose += `\n👤 MANO DE OBRA:\n`;
  desglose += `   ${money(valor_hora_persona)}/h × ${horas_trabajadas}h = ${money(costo_persona_total)}\n`;

  // ============================================
  // 3. CALCULAR COSTO DE LUZ (TOTAL)
  // ============================================
  const costo_luz_por_hora = costo_luz_mensual / (dias_trabajados_mes * 24);
  const costo_luz_total = costo_luz_por_hora * horas_trabajadas;
  
  desglose += `\n💡 LUZ:\n`;
  desglose += `   ${money(costo_luz_por_hora)}/h × ${horas_trabajadas}h = ${money(costo_luz_total)}\n`;

  // ============================================
  // 4. OTROS COSTOS (por unidad, se multiplican por la cantidad de unidades)
  // ============================================
  const costo_funda_total = valor_funda * unidades_producidas;
  const costo_packaging_total = valor_packaging * unidades_producidas;
  const costo_cono_total = valor_cono * unidades_producidas;
  
  if (valor_funda > 0) desglose += `\n📦 Funda: ${money(valor_funda)} × ${unidades_producidas.toFixed(2)} = ${money(costo_funda_total)}`;
  if (valor_packaging > 0) desglose += `\n📦 Packaging: ${money(valor_packaging)} × ${unidades_producidas.toFixed(2)} = ${money(costo_packaging_total)}`;
  if (valor_cono > 0) desglose += `\n🧵 Cono: ${money(valor_cono)} × ${unidades_producidas.toFixed(2)} = ${money(costo_cono_total)}`;

  // ============================================
  // 5. COSTO TOTAL (suma de todo)
  // ============================================
  const costo_total = costo_material_total + costo_persona_total + costo_luz_total + costo_funda_total + costo_packaging_total + costo_cono_total;
  
  // ============================================
  // 6. COSTO POR UNIDAD (TOTAL ÷ UNIDADES QUE SALEN)
  // ============================================
  let costo_por_unidad = 0;
  if (unidades_producidas > 0) {
    costo_por_unidad = costo_total / unidades_producidas;
  }
  
  desglose += `\n\n💰 COSTO TOTAL: ${money(costo_total)}`;
  if (unidades_producidas > 0) {
    desglose += `\n💰 COSTO POR UNIDAD (${unidades_producidas.toFixed(2)} unidades): ${money(costo_por_unidad)}`;
  }

  return {
    costo_material_bruto,
    scrap,
    costo_material_total,
    costo_persona_total,
    costo_luz_total,
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
