/**
 * Glossary — every variable used across the 12 structural element studios,
 * defined in plain Costa Rican Spanish for engineering students, junior
 * engineers, and non-engineer clients. Powers "Modo Aprendizaje" on every
 * studio page.
 *
 * Schema notes:
 *   The interface intentionally supports BOTH the spec-mandated field names
 *   (symbol / full_name / plain_definition / typical_value / see_also /
 *   reference) AND the legacy field names already consumed by
 *   ModoAprendizajeBlock (plain / typical / why). Keeping both lets the new
 *   <VariableChip /> render the full spec view while the existing inline
 *   block keeps working unchanged. The two are derived from the same fields:
 *
 *     plain_definition ≡ plain      (canonical: plain_definition)
 *     typical_value    ≡ typical    (canonical: typical_value)
 *
 *   New entries should set plain_definition + typical_value; legacy entries
 *   keep working via the back-compat getters below.
 */

// @lat: [[lat.md\glossary\glossary#Glosario de variables estructurales]]

export interface GlossaryEntry {
  /** Short symbol, e.g. "Mu", "ρ_min", "f'c". Defaults to the dictionary key. */
  symbol?: string;
  /** Long-form Spanish name, e.g. "Momento último". */
  full_name: string;
  /**
   * Canonical plain-Spanish definition. Write it like you're explaining to a
   * 2-year-old's parent who never studied engineering. (Spec field.)
   */
  plain_definition?: string;
  /** Legacy alias of plain_definition. Kept so old code keeps compiling. */
  plain?: string;
  /** Unit, e.g. "ton-m", "kg/cm²", "cm", "—" for dimensionless. */
  unit: string;
  /** Realistic value or range with CR context. (Spec field.) */
  typical_value?: string;
  /** Legacy alias of typical_value. */
  typical?: string;
  /** Engineering intuition: why this variable matters. */
  why?: string;
  /** Related variable keys for cross-linking. */
  see_also?: string[];
  /** Code reference, e.g. "ACI 318-14 §5.3" or "CSCR-10 §8.2". */
  reference?: string;
}

/** Resolve plain_definition with back-compat to legacy `plain`. */
export function getPlainDefinition(e: GlossaryEntry): string {
  return e.plain_definition ?? e.plain ?? "";
}

/** Resolve typical_value with back-compat to legacy `typical`. */
export function getTypicalValue(e: GlossaryEntry): string {
  return e.typical_value ?? e.typical ?? "";
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // ===========================================================
  // LOADS — what the structure has to resist
  // ===========================================================
  Mu: {
    symbol: "Mu",
    full_name: "Momento último",
    plain_definition:
      "Cuánto se quiere doblar la viga por las cargas, con los factores de seguridad ya aplicados (1.2·CP + 1.6·CV). Es la demanda contra la que se diseña.",
    unit: "ton·m",
    typical_value: "3–15 ton·m en vigas residenciales; 15–40 ton·m en vigas de edificios pequeños.",
    why: "Es la 'demanda' del análisis estructural. Se compara contra φMn (capacidad) para verificar.",
    see_also: ["Mn", "phi", "Mu_tonm"],
    reference: "ACI 318-14 §5.3",
  },
  Mu_tonm: {
    full_name: "Momento último (ton·m)",
    plain_definition: "Lo mismo que Mu, pero medido en toneladas-metro.",
    unit: "ton·m",
    see_also: ["Mu"],
  },
  Mn: {
    symbol: "Mn",
    full_name: "Momento nominal",
    plain_definition:
      "Cuánto puede aguantar la viga antes de fallar, calculado solo con las propiedades del material y la geometría, sin factor de seguridad. Es la capacidad 'bruta'.",
    unit: "ton·m",
    typical_value: "Suele ser un 15–30% mayor que Mu para que φMn ≥ Mu.",
    why: "Multiplicado por φ da la capacidad de diseño. Si φMn < Mu, hay que aumentar acero o sección.",
    see_also: ["Mu", "phi"],
    reference: "ACI 318-14 §22.3",
  },
  Vu: {
    symbol: "Vu",
    full_name: "Cortante último",
    plain_definition:
      "La fuerza horizontal factorizada que intenta cortar la viga en diagonal cerca de los apoyos. Si no hay estribos suficientes, falla de golpe sin aviso.",
    unit: "ton",
    typical_value: "5–25 ton en vigas residenciales.",
    why: "El cortante en concreto produce fallas frágiles (sin aviso). Por eso siempre se diseña con sobrecapacidad.",
    see_also: ["Vn", "phi_v"],
    reference: "ACI 318-14 §22.5",
  },
  Vn: {
    symbol: "Vn",
    full_name: "Cortante nominal",
    plain_definition:
      "La capacidad total a cortante de la sección, suma de lo que aporta el concreto (Vc) más los estribos (Vs).",
    unit: "ton",
    see_also: ["Vu", "phi_v"],
    reference: "ACI 318-14 §22.5",
  },
  Pu: {
    symbol: "Pu",
    full_name: "Carga axial última",
    plain_definition:
      "El peso vertical factorizado que llega a una columna o muro desde lo que está arriba (losas, vigas, otras columnas).",
    unit: "ton",
    typical_value: "Columna de casa de 2 pisos: 50–150 ton.",
    why: "Define cuánto acero longitudinal necesita la columna y si hay riesgo de pandeo.",
    see_also: ["Pn", "phi_c"],
    reference: "ACI 318-14 §22.4",
  },
  Pn: {
    symbol: "Pn",
    full_name: "Capacidad axial nominal",
    plain_definition:
      "Cuánta carga vertical puede aguantar la columna antes de aplastarse, sin factor de seguridad.",
    unit: "ton",
    see_also: ["Pu", "phi_c"],
    reference: "ACI 318-14 §22.4",
  },
  Tu: {
    symbol: "Tu",
    full_name: "Torsión última",
    plain_definition:
      "El momento de torsión factorizado que retuerce la viga alrededor de su propio eje longitudinal, como si se tratara de exprimir un trapo.",
    unit: "ton·m",
    why: "Aparece en vigas perimetrales, dinteles excéntricos y escaleras helicoidales. Genera grietas en espiral.",
    reference: "ACI 318-14 §22.7",
  },
  wu: {
    symbol: "wu",
    full_name: "Carga distribuida última",
    plain_definition:
      "La carga repartida por metro lineal de viga (o m² de losa), ya factorizada. Es como el 'peso por metro' que tiene que cargar el elemento.",
    unit: "ton/m o kPa",
    typical_value: "Viga residencial: 1.5–3.5 ton/m. Losa de vivienda: 6–10 kPa.",
    see_also: ["Mu", "Vu"],
  },
  Fpx: {
    symbol: "Fpx",
    full_name: "Fuerza sísmica en el diafragma",
    plain_definition:
      "La fuerza horizontal de sismo que tiene que repartir la losa de un piso a los muros y columnas. Cuanto más arriba en el edificio, más grande.",
    unit: "ton",
    why: "Define el refuerzo de tracción/compresión que la losa necesita para no rasgarse durante un sismo.",
    reference: "CSCR-10 §10.3 / ASCE 7-16 §12.10",
  },

  // ===========================================================
  // MATERIALS — concrete and steel properties
  // ===========================================================
  fc: {
    symbol: "f'c",
    full_name: "Resistencia del concreto a compresión",
    plain_definition:
      "Qué tan fuerte es el concreto cuando lo aplastas. Se mide rompiendo un cilindro de prueba a los 28 días.",
    unit: "kg/cm²",
    typical_value: "210 mín. en zonas I–II, 245 en zona III, 280 en zona IV (CSCR §6 + INTE C85:2017).",
    why: "Sube f'c → más capacidad sin aumentar tamaño. Pero también más rígido y frágil; el balance importa.",
    see_also: ["Ec", "fr", "beta1"],
    reference: "ACI 318-14 §19.2",
  },
  fy: {
    symbol: "fy",
    full_name: "Esfuerzo de fluencia del acero",
    plain_definition:
      "Cuánto puedes estirar el acero antes de que se deforme permanentemente. Es como cuando estiras un alambre y ya no vuelve a su forma original.",
    unit: "kg/cm²",
    typical_value: "4200 kg/cm² (Grado 60). En zona III-IV usar A706 que garantiza fy ≤ 5600 kg/cm².",
    why: "La capacidad del acero a tracción es lo que sostiene la fibra inferior de una viga en flexión.",
    see_also: ["Es", "fyt"],
    reference: "ACI 318-14 §20.2",
  },
  fyt: {
    symbol: "fyt",
    full_name: "Esfuerzo de fluencia del acero transversal",
    plain_definition:
      "Lo mismo que fy pero medido en el acero de los estribos (los aros transversales), no en las barras longitudinales.",
    unit: "kg/cm²",
    typical_value: "4200 kg/cm². Algunos códigos limitan fyt ≤ 5600 para corte en sismo.",
    see_also: ["fy", "Av", "Ash"],
    reference: "ACI 318-14 §20.2.2.4",
  },
  Ec: {
    symbol: "Ec",
    full_name: "Módulo de elasticidad del concreto",
    plain_definition:
      "Qué tan rígido es el concreto: cuánto se deforma cuando le aplicas una carga. Más alto = más rígido = menos deflexión.",
    unit: "kg/cm²",
    typical_value: "Ec ≈ 15100·√f'c ≈ 219,000 kg/cm² para f'c=210.",
    why: "Gobierna la deflexión de vigas y la rigidez de la estructura en sismo.",
    see_also: ["fc", "Es", "n"],
    reference: "ACI 318-14 §19.2.2",
  },
  Es: {
    symbol: "Es",
    full_name: "Módulo de elasticidad del acero",
    plain_definition:
      "Qué tan rígido es el acero. Es una constante: 2,040,000 kg/cm². Es casi 10 veces más rígido que el concreto.",
    unit: "kg/cm²",
    typical_value: "2,040,000 kg/cm² (29,000 ksi).",
    see_also: ["Ec", "n"],
    reference: "ACI 318-14 §20.2.2.2",
  },
  fr: {
    symbol: "fr",
    full_name: "Módulo de rotura del concreto",
    plain_definition:
      "El esfuerzo de tracción con el que el concreto se agrieta por primera vez. Es bajo, porque el concreto es malo en tracción.",
    unit: "kg/cm²",
    typical_value: "fr = 2·√f'c ≈ 29 kg/cm² para f'c=210.",
    why: "Define cuándo aparece la primera grieta y dispara el cálculo de Mcr para deflexión y refuerzo mínimo.",
    see_also: ["fc"],
    reference: "ACI 318-14 §19.2.3",
  },
  beta1: {
    symbol: "β1",
    full_name: "Factor del bloque de Whitney",
    plain_definition:
      "Un factor que convierte la curva real de compresión del concreto en un rectángulo equivalente fácil de usar. Vale 0.85 para concretos normales y baja con f'c muy alto.",
    unit: "—",
    typical_value: "0.85 para f'c ≤ 280 kg/cm². Baja 0.05 por cada 70 kg/cm² adicional, mínimo 0.65.",
    see_also: ["fc"],
    reference: "ACI 318-14 §22.2.2.4.3",
  },
  lambda: {
    symbol: "λ",
    full_name: "Factor de concreto liviano",
    plain_definition:
      "Un castigo que se aplica si usas concreto liviano (más ligero pero menos fuerte en tracción). Para concreto normal vale 1.0.",
    unit: "—",
    typical_value: "1.0 para concreto normal; 0.75 para concreto liviano todo agregado.",
    reference: "ACI 318-14 §19.2.4",
  },
  n: {
    symbol: "n",
    full_name: "Relación modular Es/Ec",
    plain_definition:
      "Cuántas veces es más rígido el acero que el concreto. Sirve para convertir una sección mixta en una sola sección equivalente de concreto.",
    unit: "—",
    typical_value: "n ≈ 8–10 para f'c entre 210 y 280.",
    see_also: ["Es", "Ec"],
    reference: "ACI 318-14 §24.2.3.5",
  },

  // ===========================================================
  // GEOMETRY — sizes and distances
  // ===========================================================
  b: {
    symbol: "b",
    full_name: "Ancho de la sección",
    plain_definition:
      "Qué tan ancha es la viga (o columna) vista por encima. El ancho de su sección rectangular.",
    unit: "cm",
    typical_value: "25–40 cm en vigas; 25 cm mínimo en vigas dúctiles (CSCR §8.2.1).",
    why: "Más ancho = más concreto resistiendo compresión + más espacio para barras → puedes meter más acero sin amontonarlo.",
    see_also: ["h", "d"],
  },
  h: {
    symbol: "h",
    full_name: "Peralte total",
    plain_definition:
      "Qué tan alta es la viga vista de lado. Incluye el concreto, el recubrimiento y el acero.",
    unit: "cm",
    typical_value: "Vigas: h ≈ L/10 a L/12. Para luz de 5 m → h ≈ 45 cm.",
    why: "Más peralte = brazo interno mayor = más capacidad a flexión. La capacidad crece con d² (no lineal).",
    see_also: ["b", "d", "L"],
  },
  d: {
    symbol: "d",
    full_name: "Peralte efectivo",
    plain_definition:
      "Distancia desde la cara superior comprimida hasta el centro del acero abajo. Es la altura que realmente trabaja en flexión.",
    unit: "cm",
    typical_value: "d ≈ h − 5 cm para vigas con recubrimiento normal.",
    why: "Es EL parámetro de diseño. Mn crece con d² → doblar el peralte cuadruplica la capacidad a flexión.",
    see_also: ["h", "recubrimiento", "dt"],
  },
  dt: {
    symbol: "dt",
    full_name: "Distancia a la capa extrema de acero",
    plain_definition:
      "Distancia desde la fibra extrema a compresión hasta la barra de acero MÁS LEJANA en tracción. Usada para determinar si la falla es dúctil o frágil.",
    unit: "cm",
    typical_value: "dt ≈ d cuando hay una sola capa de acero; mayor cuando hay varias capas.",
    see_also: ["d", "eps_t"],
    reference: "ACI 318-14 §21.2.2",
  },
  r: {
    symbol: "r",
    full_name: "Radio de giro",
    plain_definition:
      "Una medida geométrica que mide qué tan 'desparramada' está la sección. Sirve para calcular si una columna larga puede pandearse.",
    unit: "cm",
    typical_value: "r = h/√12 ≈ 0.289·h para sección rectangular.",
    see_also: ["L", "kl_r"],
  },
  recubrimiento: {
    symbol: "rec",
    full_name: "Recubrimiento de concreto",
    plain_definition:
      "La capa de concreto que cubre las barras de acero por fuera, como la corteza de un pan. Protege el acero del fuego, la humedad y la corrosión.",
    unit: "cm",
    typical_value: "2 cm losas interiores, 4 cm vigas/columnas, 5 cm muros, 7.5 cm cimientos en contacto con suelo.",
    why: "Sin recubrimiento adecuado, el acero se corroe con la humedad y el elemento falla mucho antes de llegar a su capacidad.",
    reference: "ACI 318-14 §20.6",
  },
  lo: {
    symbol: "lo",
    full_name: "Longitud de zona confinada",
    plain_definition:
      "Tramo cerca de los nodos (donde la columna se junta con la viga) donde los estribos van mucho más juntos para 'abrazar' el concreto en un sismo.",
    unit: "cm",
    typical_value: "lo = máx(h, L/6, 45 cm) según ACI §18.7.5.1.",
    why: "En sismo, la rótula plástica se forma cerca del nodo. Allí el confinamiento extra evita que el concreto se desmorone.",
    see_also: ["s_conf", "s_central"],
    reference: "ACI 318-14 §18.7.5.1",
  },
  ld: {
    symbol: "ld",
    full_name: "Longitud de desarrollo",
    plain_definition:
      "Qué tan larga tiene que estar la barra metida en el concreto para que pueda 'agarrar' su fuerza completa antes de salir. Si la dejas corta, se desliza.",
    unit: "cm",
    typical_value: "30·db a 60·db según condiciones.",
    see_also: ["ldh", "db"],
    reference: "ACI 318-14 §25.4.2",
  },
  ldh: {
    symbol: "ldh",
    full_name: "Longitud de desarrollo del gancho a 90°",
    plain_definition:
      "Cuánto tiene que medir la cola doblada de una barra para que el gancho aporte su capacidad total. Es más corto que ld porque el gancho ayuda.",
    unit: "cm",
    typical_value: "Aproximadamente la mitad de ld para barras con gancho estándar.",
    see_also: ["ld", "db"],
    reference: "ACI 318-14 §25.4.3",
  },
  s: {
    symbol: "s",
    full_name: "Separación de estribos / refuerzo",
    plain_definition:
      "Cuánto espacio se deja entre dos estribos consecutivos. Más juntos = más resistencia al corte y mejor confinamiento.",
    unit: "cm",
    typical_value: "5–10 cm en zona confinada; 15 cm en zona central; máximo d/2 por corte.",
    see_also: ["s_conf", "s_central"],
    reference: "ACI 318-14 §9.7.6",
  },
  s_conf: {
    full_name: "Separación de estribos en zona confinada",
    plain_definition:
      "El espaciamiento entre estribos dentro de la longitud lo, cerca del nodo. Mucho más cerca que en zona central.",
    unit: "cm",
    typical_value: "5–10 cm.",
    see_also: ["lo", "s_central"],
    reference: "ACI 318-14 §18.7.5",
  },
  s_central: {
    full_name: "Separación de estribos en zona central",
    plain_definition:
      "El espaciamiento de estribos fuera de la zona confinada, en la mitad del tramo de columna o viga donde el confinamiento es menos crítico.",
    unit: "cm",
    typical_value: "15 cm, máximo d/2.",
    see_also: ["lo", "s_conf"],
  },
  db: {
    symbol: "db",
    full_name: "Diámetro de la barra",
    plain_definition:
      "El grosor de la varilla de acero. Las barras se llaman por números: #3 (3/8\"=0.95 cm), #4 (1/2\"=1.27 cm), #5 (5/8\"=1.59 cm), etc.",
    unit: "cm",
    typical_value: "#3 (0.95), #4 (1.27), #5 (1.59), #6 (1.91), #8 (2.54).",
    see_also: ["ld", "As"],
  },
  Ag: {
    symbol: "Ag",
    full_name: "Área bruta de la sección",
    plain_definition:
      "El área total de la sección de concreto (b × h), sin restar el acero. Es la sección 'completa' vista de frente.",
    unit: "cm²",
    typical_value: "Columna 30×30: Ag = 900 cm².",
    see_also: ["Ach", "b", "h"],
  },
  Ach: {
    symbol: "Ach",
    full_name: "Área del núcleo confinado",
    plain_definition:
      "El área del concreto QUE QUEDA DENTRO de los estribos. Es el 'corazón' que está protegido por el confinamiento.",
    unit: "cm²",
    typical_value: "Ach ≈ (b − 2·rec)·(h − 2·rec) midiendo desde el exterior del estribo.",
    why: "Es el área que se confía bajo sismo. El cascarón externo se descascara y se pierde.",
    see_also: ["Ag", "Ash"],
    reference: "ACI 318-14 §18.7.5.3",
  },
  L: {
    symbol: "L",
    full_name: "Luz / longitud",
    plain_definition:
      "Distancia de apoyo a apoyo en vigas/losas, o altura libre en columnas/muros.",
    unit: "cm o m",
    typical_value: "Vigas residenciales: 3–7 m. Columnas: 2.5–3.5 m libres.",
    see_also: ["h"],
  },

  // ===========================================================
  // STEEL — reinforcement areas and ratios
  // ===========================================================
  As: {
    symbol: "As",
    full_name: "Área de acero longitudinal en tracción",
    plain_definition:
      "Cuánto acero (sumando todas las barras inferiores) tiene la sección para resistir el momento. Es el resultado principal del diseño a flexión.",
    unit: "cm²",
    typical_value: "Viga típica: 6–20 cm². Columna típica: 20–80 cm².",
    why: "Es el output principal del diseño. Define cuántas barras y de qué tamaño se ponen.",
    see_also: ["As_min", "rho", "db"],
    reference: "ACI 318-14 §22.2",
  },
  "As'": {
    symbol: "As'",
    full_name: "Área de acero en compresión",
    plain_definition:
      "Acero adicional en la parte de arriba de la viga, en la zona comprimida. Se usa cuando el momento positivo es muy alto y el concreto solo no alcanza.",
    unit: "cm²",
    see_also: ["As", "rho_max"],
  },
  As_min: {
    full_name: "Acero mínimo",
    plain_definition:
      "Lo MENOS que el código deja poner, sin importar lo bajita que sea la demanda. Evita que la primera grieta rompa la viga inmediatamente.",
    unit: "cm²",
    typical_value: "As_min = máx(14/fy · b·d ; 0.8·√f'c/fy · b·d).",
    why: "Sin este mínimo, una viga con poco momento podría tener un acero TAN pequeño que se rompería al primer cracking.",
    see_also: ["As", "rho_min"],
    reference: "ACI 318-14 §9.6.1.2",
  },
  Av: {
    symbol: "Av",
    full_name: "Área de acero de cortante por estribo",
    plain_definition:
      "Cuánto acero hay en un estribo completo (suma de todas sus ramas verticales). Es lo que se opone al corte que intenta partir la viga en diagonal.",
    unit: "cm²",
    typical_value: "Estribo #3 de 2 ramas: Av = 2·0.71 = 1.42 cm².",
    see_also: ["Vn", "s", "fyt"],
    reference: "ACI 318-14 §22.5.10",
  },
  Ash: {
    symbol: "Ash",
    full_name: "Área de acero de confinamiento",
    plain_definition:
      "Cuánto acero transversal (estribo + ganchos suplementarios) atraviesa el núcleo de la columna en una dirección. Es lo que 'abraza' el concreto para que no se rompa en sismo.",
    unit: "cm²",
    see_also: ["Ach", "Ag"],
    reference: "ACI 318-14 §18.7.5.4",
  },
  Avf: {
    symbol: "Avf",
    full_name: "Área de acero de cortante por fricción",
    plain_definition:
      "Acero que cruza una superficie potencial de deslizamiento (junta fría, encuentro muro-cimiento). Trabaja por fricción, no por flexión.",
    unit: "cm²",
    reference: "ACI 318-14 §22.9",
  },
  rho: {
    symbol: "ρ",
    full_name: "Cuantía de acero",
    plain_definition:
      "Qué fracción de la sección de concreto está ocupada por acero. Se calcula As / (b·d). Se da como porcentaje.",
    unit: "— (porcentaje)",
    typical_value: "ρ = 0.5%–2% en vigas. Mayor = más capacidad pero más caro y más rígido.",
    see_also: ["rho_min", "rho_max", "As"],
  },
  rho_min: {
    symbol: "ρ_min",
    full_name: "Cuantía mínima",
    plain_definition:
      "El porcentaje más bajo de acero permitido por código. Asegura que al agrietarse el concreto, el acero no se rompa de golpe.",
    unit: "—",
    typical_value: "ρ_min ≈ 0.0033 para fy = 4200 (ACI §9.6).",
    see_also: ["As_min", "rho"],
    reference: "ACI 318-14 §9.6.1",
  },
  rho_max: {
    symbol: "ρ_max",
    full_name: "Cuantía máxima",
    plain_definition:
      "El acero MÁXIMO que permite una falla dúctil (acero fluye primero, después aplasta el concreto). Pasarse implica falla frágil sin aviso.",
    unit: "—",
    typical_value: "ρ_max ≈ 0.0214 para f'c=210 y fy=4200 (sección controlada por tracción).",
    why: "Si ρ > ρ_max, la viga se vuelve sobrearmada: falla frágil sin aviso. Siempre se diseña por debajo.",
    see_also: ["rho", "rho_bal"],
    reference: "ACI 318-14 §21.2.2",
  },
  rho_bal: {
    symbol: "ρ_bal",
    full_name: "Cuantía balanceada",
    plain_definition:
      "El acero teórico que haría fluir el acero y aplastar el concreto AL MISMO TIEMPO. Es la frontera entre falla dúctil y falla frágil.",
    unit: "—",
    typical_value: "Para f'c=210, fy=4200: ρ_bal ≈ 0.0214.",
    see_also: ["rho_max", "beta1"],
    reference: "ACI 318-14 §22.2",
  },
  rho_s: {
    symbol: "ρ_s",
    full_name: "Cuantía volumétrica de espiral",
    plain_definition:
      "Cuánto acero en espiral lleva una columna circular, medido como volumen de acero por volumen de concreto confinado.",
    unit: "—",
    typical_value: "ρ_s ≥ 0.45·(Ag/Ach − 1)·(f'c/fy) según ACI §25.7.3.3.",
    see_also: ["Ag", "Ach"],
    reference: "ACI 318-14 §25.7.3",
  },

  // ===========================================================
  // STRENGTH REDUCTION — code-mandated safety factors
  // ===========================================================
  phi: {
    symbol: "φ",
    full_name: "Factor de reducción de resistencia",
    plain_definition:
      "Un castigo a la capacidad calculada para cubrir incertidumbres en materiales y construcción. La capacidad de diseño es φ·Mn.",
    unit: "—",
    typical_value: "0.90 flexión dúctil, 0.75 corte, 0.65 columna estribada, 0.75 columna con espiral.",
    why: "Refleja qué tan crítica es una falla: 0.65 en columnas porque su falla colapsa todo el edificio.",
    see_also: ["phi_v", "phi_c"],
    reference: "ACI 318-14 §21.2",
  },
  phi_v: {
    symbol: "φv",
    full_name: "Factor de reducción para cortante",
    plain_definition:
      "El castigo que se aplica a Vn. Es más bajo (0.75) que el de flexión porque la falla por cortante es frágil.",
    unit: "—",
    typical_value: "0.75",
    see_also: ["phi", "Vn"],
    reference: "ACI 318-14 §21.2.1",
  },
  phi_c: {
    symbol: "φc",
    full_name: "Factor de reducción para columna en compresión",
    plain_definition:
      "El castigo a la capacidad axial de una columna. Más estricto que en flexión porque el colapso de una columna se lleva el edificio entero.",
    unit: "—",
    typical_value: "0.65 (estribos), 0.75 (espiral).",
    see_also: ["phi", "Pn"],
    reference: "ACI 318-14 §21.2.2",
  },
  alpha: {
    symbol: "α",
    full_name: "Coeficiente α (varía por contexto)",
    plain_definition:
      "Coeficiente que cambia según el cálculo: ángulo del estribo en corte, factor del bloque de Whitney, factor de modificación de adherencia, etc.",
    unit: "— o grados",
    typical_value: "Depende del uso. En corte α = 90° para estribos verticales.",
    reference: "ACI 318-14 (varios)",
  },
  gamma: {
    symbol: "γ",
    full_name: "Factor de carga / coeficiente γ",
    plain_definition:
      "Factor con que se mayoran las cargas (por ejemplo 1.2 para carga permanente, 1.6 para carga viva) para llegar a las cargas últimas de diseño.",
    unit: "—",
    typical_value: "γ_CP = 1.2; γ_CV = 1.6; γ_S = 1.0 con sismo (CSCR §6.2).",
    see_also: ["Mu", "Vu", "Pu"],
    reference: "CSCR-10 §6.2",
  },

  // ===========================================================
  // GEOTECH — soil capacity, settlement, in-situ tests
  // ===========================================================
  qa: {
    symbol: "qa",
    full_name: "Capacidad portante admisible del suelo",
    plain_definition:
      "Cuánta presión aguanta el suelo bajo la zapata sin hundirse demasiado ni romperse. Es lo que dice el estudio de suelos.",
    unit: "kg/cm² o kPa",
    typical_value: "1.0–3.0 kg/cm² en CR (la mayoría 1.5–2.0).",
    why: "La presión real bajo la zapata debe ser menor que qa, sino la cimentación se hunde.",
    see_also: ["qu", "FS"],
    reference: "CFIA Código de Cimentaciones",
  },
  qu: {
    symbol: "qu",
    full_name: "Capacidad portante última del suelo",
    plain_definition:
      "La presión a la que el suelo se rompe definitivamente bajo la zapata. Se divide entre un FS de 3 para obtener qa.",
    unit: "kg/cm² o kPa",
    typical_value: "qu ≈ 3·qa.",
    see_also: ["qa", "FS"],
    reference: "Terzaghi / Meyerhof",
  },
  N60: {
    symbol: "N60",
    full_name: "Número de golpes SPT corregido por energía",
    plain_definition:
      "El número de golpes que se necesita para hundir el muestreador SPT 30 cm en el suelo, corregido por la energía real del martillo (60%).",
    unit: "golpes/30cm",
    typical_value: "N60 < 10 suelo flojo; 10–30 medio; 30–50 denso; > 50 muy denso.",
    see_also: ["N1_60", "Ce", "Cn"],
    reference: "ASTM D1586",
  },
  N1_60: {
    symbol: "N1_60",
    full_name: "SPT corregido por energía y por sobrecarga",
    plain_definition:
      "El N60 corregido además por la presión vertical efectiva del suelo. Permite comparar muestras tomadas a profundidades distintas.",
    unit: "golpes/30cm",
    typical_value: "N1_60 < 15 susceptible a licuefacción en arena saturada.",
    see_also: ["N60", "CSR", "CRR"],
    reference: "Youd et al. 2001",
  },
  phi_deg: {
    symbol: "φ°",
    full_name: "Ángulo de fricción interna del suelo",
    plain_definition:
      "Qué tanto se traban los granos del suelo entre sí. Más alto = el suelo se sostiene mejor en pendientes. Las arenas tienen alto φ; las arcillas, bajo.",
    unit: "grados",
    typical_value: "Arena suelta: 28°; arena densa: 38°; grava: 40°+; arcilla blanda: ~0°.",
    see_also: ["Ka", "Kp", "c"],
  },
  c: {
    symbol: "c",
    full_name: "Cohesión del suelo",
    plain_definition:
      "Qué tan pegajosos están los granos del suelo entre sí, incluso sin presión que los apriete. Las arcillas tienen cohesión; las arenas no.",
    unit: "kPa o kg/cm²",
    typical_value: "Arcilla blanda: 10–25 kPa; arcilla dura: 100+ kPa; arena: 0.",
    see_also: ["phi_deg"],
  },
  gamma_soil: {
    symbol: "γ_suelo",
    full_name: "Peso unitario del suelo",
    plain_definition:
      "Cuánto pesa un metro cúbico de suelo. Define la presión vertical en cada profundidad.",
    unit: "kN/m³",
    typical_value: "16–20 kN/m³ para suelos típicos; 9–11 kN/m³ sumergido.",
  },
  k: {
    symbol: "k",
    full_name: "Coeficiente de balasto",
    plain_definition:
      "Qué tan rígido es el suelo: cuánta presión se necesita para hundirlo 1 cm. Sirve para modelar zapatas y losas sobre suelo.",
    unit: "kN/m³ o kg/cm³",
    typical_value: "10–50 MN/m³ para suelos competentes.",
    reference: "Bowles Foundation Analysis",
  },
  FS: {
    symbol: "FS",
    full_name: "Factor de seguridad",
    plain_definition:
      "Cuántas veces la capacidad supera a la demanda. Si FS = 3 significa que el suelo aguanta 3 veces lo que tiene que aguantar.",
    unit: "—",
    typical_value: "FS ≥ 3 para capacidad portante; ≥ 1.5 deslizamiento; ≥ 2.0 volcamiento sísmico.",
    see_also: ["qa", "qu"],
  },
  Cn: {
    symbol: "Cn",
    full_name: "Corrección SPT por sobrecarga",
    plain_definition:
      "Un multiplicador que ajusta N por la profundidad de la muestra. A más profundidad, el suelo está más confinado y N parece más alto de lo que es.",
    unit: "—",
    typical_value: "Cn = (1/σ'v)^0.5, típicamente entre 0.5 y 2.0.",
    see_also: ["N60", "N1_60"],
    reference: "Liao & Whitman 1986",
  },
  Ce: {
    symbol: "Ce",
    full_name: "Corrección SPT por energía",
    plain_definition:
      "Un factor que ajusta N según la eficiencia real del martillo SPT. Los martillos de seguridad transmiten ~60%; los donut ~45%.",
    unit: "—",
    typical_value: "Ce = ER/60, donde ER = % de energía teórica.",
    see_also: ["N60"],
  },
  Cr: {
    symbol: "Cr",
    full_name: "Corrección SPT por longitud de barra",
    plain_definition:
      "Un factor que ajusta N porque las barras cortas (cerca de superficie) disipan parte de la energía al rebotar.",
    unit: "—",
    typical_value: "0.75–1.0 según longitud de varillaje.",
  },
  Cs: {
    symbol: "Cs",
    full_name: "Corrección SPT por tipo de muestreador",
    plain_definition:
      "Un factor que ajusta N si el muestreador tiene liners (cazoleta interior) o no.",
    unit: "—",
    typical_value: "1.0 sin liners; 1.1–1.3 con liners.",
  },
  Cb: {
    symbol: "Cb",
    full_name: "Corrección SPT por diámetro del sondeo",
    plain_definition:
      "Un factor que ajusta N por el diámetro de la perforación. Sondeos muy anchos sobreestiman N.",
    unit: "—",
    typical_value: "1.0 estándar; 1.05–1.15 para sondeos más anchos.",
  },

  // ===========================================================
  // SEISMIC — earthquake demand and liquefaction
  // ===========================================================
  k_h: {
    symbol: "k_h",
    full_name: "Coeficiente sísmico horizontal",
    plain_definition:
      "Una fracción de g (aceleración de gravedad) que representa el sismo como una fuerza horizontal estática para diseñar muros y taludes.",
    unit: "—",
    typical_value: "k_h ≈ PGA/2 ≈ 0.15–0.25 en CR.",
    see_also: ["PGA"],
    reference: "Mononobe-Okabe",
  },
  PGA: {
    symbol: "PGA",
    full_name: "Aceleración pico del suelo",
    plain_definition:
      "El máximo zarandeo horizontal que se espera del suelo durante un sismo. Se mide en fracción de g.",
    unit: "g",
    typical_value: "0.30g zona III; 0.40g zona IV (CSCR-10 §2.1).",
    see_also: ["k_h", "MSF"],
    reference: "CSCR-10 §2.1",
  },
  R: {
    symbol: "R",
    full_name: "Coeficiente de reducción sísmica",
    plain_definition:
      "Un divisor que reduce la fuerza sísmica elástica considerando la capacidad de la estructura para deformarse y disipar energía sin colapsar.",
    unit: "—",
    typical_value: "R = 6 marcos dúctiles especiales; R = 3 marcos ordinarios.",
    why: "Estructuras con buen detallado dúctil pueden absorber sismos grandes deformándose. R alto = menos fuerza de diseño pero requiere detallado riguroso.",
    reference: "CSCR-10 §4",
  },
  Mw: {
    symbol: "Mw",
    full_name: "Magnitud momento del sismo",
    plain_definition:
      "Qué tan grande es el sismo en la escala momento (la moderna). Cada unidad multiplica por ~32 la energía liberada.",
    unit: "—",
    typical_value: "5.0 leve; 6.5 fuerte; 7.5 mayor; 8.0+ gigante.",
    see_also: ["PGA", "MSF"],
  },
  MSF: {
    symbol: "MSF",
    full_name: "Factor de escala por magnitud",
    plain_definition:
      "Un ajuste para licuefacción que considera que sismos más grandes duran más y aplican más ciclos al suelo saturado.",
    unit: "—",
    typical_value: "1.0 para Mw=7.5; mayor a 1.0 para sismos más pequeños.",
    see_also: ["Mw", "CSR", "CRR"],
    reference: "Youd et al. 2001",
  },
  CSR: {
    symbol: "CSR",
    full_name: "Razón de esfuerzo cíclico",
    plain_definition:
      "La demanda sísmica sobre el suelo: cuánto esfuerzo cortante cíclico aplica el sismo, expresado como fracción del confinamiento.",
    unit: "—",
    typical_value: "0.15–0.35 en zonas sísmicas activas.",
    see_also: ["CRR", "MSF"],
    reference: "Seed & Idriss 1971",
  },
  CRR: {
    symbol: "CRR",
    full_name: "Razón de resistencia cíclica",
    plain_definition:
      "La capacidad del suelo para resistir licuefacción. Se obtiene del SPT o CPT. Si CRR ≥ CSR, el suelo no licua.",
    unit: "—",
    see_also: ["CSR", "N1_60"],
    reference: "Youd et al. 2001",
  },
  xi: {
    symbol: "ξ",
    full_name: "Razón de amortiguamiento",
    plain_definition:
      "Cuánto se 'tranquiliza' la estructura entre cada oscilación durante un sismo. 5% es el valor estándar de diseño.",
    unit: "—",
    typical_value: "0.05 (5%) para concreto reforzado en diseño sísmico.",
    reference: "CSCR-10 §2.5",
  },
  beta_dns: {
    symbol: "βdns",
    full_name: "Factor de carga sostenida en columnas esbeltas",
    plain_definition:
      "La fracción de carga axial que es sostenida (no transitoria). Cuanto más sostenida la carga, más fluencia plástica del concreto reduce la rigidez.",
    unit: "—",
    typical_value: "0.6 cuando la carga muerta domina la combinación.",
    see_also: ["Pu"],
    reference: "ACI 318-14 §6.6.4.4.4",
  },

  // ===========================================================
  // Legacy / element-specific entries retained for back-compat
  // (Existing studio pages already reference these keys.)
  // ===========================================================
  hx: {
    full_name: "Espaciamiento entre barras lateralmente sujetadas",
    plain_definition:
      "Distancia horizontal entre dos barras longitudinales atadas por un estribo o crossie. Si es muy grande, las barras intermedias se pandean en sismo.",
    unit: "cm",
    typical_value: "≤ 35 cm en zona III-IV.",
    why: "Si hx es muy grande, las barras intermedias se pandean afuera bajo compresión cíclica y el confinamiento se pierde.",
    reference: "ACI 318-14 §18.7.5.2",
  },
  Ka: {
    symbol: "Ka",
    full_name: "Coeficiente activo de Rankine",
    plain_definition:
      "Qué fracción de la presión vertical del suelo se traduce en empuje horizontal contra el muro de retención.",
    unit: "—",
    typical_value: "0.20–0.35 para suelos típicos (arena con φ = 30°–35°).",
    why: "Suelo con más fricción interna empuja menos. Por eso un relleno granular limpio es mejor que arcilla.",
    see_also: ["Kp", "phi_deg"],
    reference: "Rankine 1857",
  },
  Kp: {
    symbol: "Kp",
    full_name: "Coeficiente pasivo de Rankine",
    plain_definition:
      "El recíproco de Ka. Representa el empuje del suelo en FRENTE del muro cuando el muro empuja contra él.",
    unit: "—",
    typical_value: "3–4 para suelos típicos.",
    why: "El suelo de frente al muro AYUDA al muro a no deslizar, pero solo si está bien compactado y permanente.",
    see_also: ["Ka"],
    reference: "Rankine 1857",
  },
  E1: {
    full_name: "Empuje activo",
    plain_definition:
      "Fuerza horizontal total por metro lineal de muro, debida al peso del relleno detrás. Crece con H².",
    unit: "kN/m",
    why: "Es la carga principal contra la que se diseña el muro. Actúa a H/3 desde la base.",
    see_also: ["Ka"],
  },
  E2: {
    full_name: "Empuje por sobrecarga",
    plain_definition:
      "Fuerza horizontal adicional cuando hay carga (tránsito, almacenaje) encima del relleno.",
    unit: "kN/m",
    why: "Actúa uniforme en toda la altura (rectangular), centroide a H/2.",
  },
  FS_v: {
    full_name: "Factor de seguridad al volcamiento",
    plain_definition:
      "Cuántas veces el momento resistente supera al momento volcador alrededor de la punta del muro.",
    unit: "—",
    typical_value: "≥ 1.5 (estático), ≥ 2.0 (con sismo).",
    why: "Si FS_v < 1, el muro literalmente se voltea. Margen alto porque las consecuencias son catastróficas.",
  },
  FS_d: {
    full_name: "Factor de seguridad al deslizamiento",
    plain_definition:
      "Cuántas veces la resistencia al deslizamiento (fricción + empuje pasivo) supera al empuje horizontal.",
    unit: "—",
    typical_value: "≥ 1.5 (estático).",
    why: "Si FS_d < 1, el muro desliza horizontalmente. Soluciones: aumentar B, agregar diente o un puntal.",
  },
  e: {
    symbol: "e",
    full_name: "Excentricidad de la resultante",
    plain_definition:
      "Distancia entre el centro de la zapata y el punto donde efectivamente actúa la carga vertical resultante (peso + empujes).",
    unit: "m",
    typical_value: "Se desea e ≤ B/6 (distribución trapezoidal todavía positiva).",
  },
  Cm: {
    full_name: "Coeficiente ACI para momentos en losas",
    plain_definition:
      "Un número fijo entre 1/9 y 1/16 que multiplica w·L² para obtener el momento en una losa continua, sin hacer análisis modal.",
    unit: "—",
    typical_value: "−1/16 apoyo exterior empotrado; −1/10 primer apoyo interior; +1/14 primer claro; +1/16 claros interiores.",
    reference: "ACI 318-14 §6.5.2",
  },
  qmax: {
    full_name: "Presión máxima bajo la zapata",
    plain_definition:
      "La presión más alta que llega del fondo de la zapata al suelo. Ocurre en la fibra extrema cuando hay momento.",
    unit: "kPa o kg/cm²",
    see_also: ["qa", "e"],
  },
};

export function explainVariable(varName: string): GlossaryEntry | undefined {
  return GLOSSARY[varName];
}

/**
 * Pedagogical step explanations — "why we do this step" for each unique
 * step ID across all 12 elements. Optional: if a step doesn't have an entry
 * here, Modo Aprendizaje falls back to just rendering the formula.
 */
export const STEP_EXPLANATIONS: Record<string, { what: string; why: string }> = {
  "flexure.step_01_Mu_kgcm": {
    what: "Convertimos el momento de toneladas-metro a kilogramos-centímetro para trabajar en las mismas unidades que f'c (kg/cm²) y d (cm).",
    why: "El concreto se ensaya en kg/cm² y las dimensiones se dan en cm. Mantener una sola unidad evita errores numéricos de factor 100 o 1000.",
  },
  "flexure.step_02_phi": {
    what: "Definimos el factor de reducción de resistencia. Para flexión controlada por tracción, φ = 0.90.",
    why: "Las normas reducen la capacidad calculada para cubrir las incertidumbres del material y la construcción. En flexión la falla es dúctil (con aviso), por eso φ = 0.90 (no muy bajo).",
  },
  "flexure.step_15_As_diseno": {
    what: "Tomamos el mayor entre el acero por momento, el acero mínimo por flexión y el acero por temperatura. Ese es el acero final de diseño.",
    why: "Las tres condiciones existen por razones diferentes (momento, agrietamiento, retracción). El elemento debe cumplirlas todas, no solo la que parece más exigente.",
  },
  "rect_col.step_03_phi": {
    what: "φ = 0.65 para columnas con estribos (no espirales). Es más bajo que en flexión.",
    why: "La falla de columna por compresión es frágil y catastrófica (colapso global). El factor más bajo refleja que la consecuencia es peor que una grieta en una viga.",
  },
  "rw.step_01_Ka": {
    what: "Calculamos cuánta fracción de la presión vertical del suelo se transforma en empuje horizontal.",
    why: "Si el suelo no tuviera fricción interna, todo el peso se transformaría en empuje (Ka = 1). La fricción interna φ reduce ese empuje. Suelos granulares limpios → Ka pequeño → muro más esbelto.",
  },
  "rw.step_10_FSv": {
    what: "Comparamos la suma de momentos resistentes (peso del muro + relleno + sobrecarga, cada uno por su brazo a la punta) contra los momentos volcadores (empuje activo + empuje sobrecarga).",
    why: "Si la razón es menor que 1.5, el muro está peligrosamente cerca de volcarse. En sismo se exige 2.0 porque la aceleración multiplica las fuerzas horizontales.",
  },
  "rw.step_13_qmax": {
    what: "Determinamos la presión máxima que la zapata aplica al suelo en su borde más cargado.",
    why: "Esta presión debe ser menor que la admisible del suelo, sino la zapata se hunde. Si la excentricidad supera B/6, la distribución cambia de trapezoidal a rectangular efectiva (parte de la zapata se levanta del suelo).",
  },
};
