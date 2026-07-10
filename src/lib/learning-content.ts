/**
 * learning-content.ts — Modo Aprendizaje narratives for every studio step.
 *
 * Central registry keyed by `step.id` (e.g. `"rect_col.step_04_Ast_req"`).
 * The ModoAprendizaje block reads this map and, if a narrative exists for
 * the current step, renders it instead of the generic "Explicación
 * pendiente" fallback.
 *
 * Narrative voice rules (apply to every entry):
 *  • PLAIN Spanish — an architect, contractor, or homeowner should "get it"
 *  • Start with WHAT we are calculating (a physical question, not a formula)
 *  • Explain WHY the formula is used and what intuition it captures
 *  • End with a memorable rule of thumb or analogy
 *  • Drop the ACI/CSCR § in passing so engineers can look it up
 */

export interface StepNarrative {
  /** What is being computed in this step, in plain Spanish (~50 words) */
  que: string;
  /** Why this formula is used, with intuition (~50 words) */
  porque: string;
  /** A memorable analogy or rule of thumb (~30 words) */
  intuicion: string;
}

/* eslint-disable max-len */
export const STEP_NARRATIVES: Record<string, StepNarrative> = {
  // ═══════════════════════════════════════════════════════════════════════
  // 1. RECTANGULAR COLUMN (rect_col.*) — 11 steps
  // ═══════════════════════════════════════════════════════════════════════
  "rect_col.step_01_Ag": {
    que: "Calculamos el área transversal (bruta) de la columna en cm². Es simplemente base por altura de la sección, sin descontar el acero.",
    porque: "Casi todas las verificaciones siguientes — capacidad axial, cuantía de acero, confinamiento — necesitan referirse al tamaño bruto del concreto. Ag es la 'cancha de juego' donde compiten las cargas y el refuerzo.",
    intuicion: "Si la columna mide 30×40 cm, Ag = 1200 cm². Mientras más Ag, más carga aguanta antes de pedir acero extra.",
  },
  "rect_col.step_02_ecc": {
    que: "Medimos qué tanto se desvía la carga del centro de la columna comparando el momento (Mu) con el axial (Pu·h). Es la relación e/h.",
    porque: "Si e/h ≤ 0.10 la columna trabaja casi en compresión pura y se puede usar la fórmula simplificada. Si es mayor, la flexión manda y hay que recurrir a un diagrama de interacción P-M (ACI §10.5).",
    intuicion: "Piensa en una persona cargando un saco: si lo lleva sobre la cabeza es axial puro; si lo lleva en la mano estirada, el momento la tumba. e/h mide ese 'estirón'.",
  },
  "rect_col.step_03_phi": {
    que: "Fijamos el factor de reducción de resistencia φ = 0.65 para columnas con estribos. Es un castigo de seguridad sobre la capacidad teórica.",
    porque: "ACI 318-14 §21.2.2 obliga a reducir la resistencia para cubrir incertidumbres en materiales, mano de obra y geometría. Las columnas con estribos tienen menos confinamiento que las espirales, por eso 0.65 (vs 0.75 espiral).",
    intuicion: "φ es el 'margen de error del constructor': nunca confíes en el 100% teórico, deja 35% de colchón.",
  },
  "rect_col.step_04_Ast_req": {
    que: "Calculamos cuántos cm² de acero longitudinal necesita la columna para resistir la carga axial sin que el concreto se chafe.",
    porque: "El concreto resiste compresión, pero a partir de cierto Pu necesita acero embebido que comparta la carga. La ecuación combina la contribución del concreto (0.85·f'c·Ag) con la del acero (fy·Ast). El factor 0.80 de ACI §22.4.2.1 castiga columnas con estribos por su menor confinamiento vs espirales.",
    intuicion: "Más Pu → más acero. Si te queda poco acero por sección, probablemente la columna queda por debajo del 1% mínimo (CSCR §18.7) — agrandala antes de meterle más barras.",
  },
  "rect_col.step_05_As_min": {
    que: "Calculamos el acero mínimo absoluto: 1% del área bruta. Aunque la carga sea baja, ACI nunca permite menos.",
    porque: "Por debajo del 1% la columna se comporta como concreto simple frágil y puede agrietarse por fluencia lenta (creep) o por momentos secundarios no calculados. ACI §10.6.1.1 protege contra esto.",
    intuicion: "Una columna sin al menos 1% de acero es como una pierna sin músculo: aguanta el peso solo un rato, luego se desmorona.",
  },
  "rect_col.step_06_As_max": {
    que: "Calculamos el acero máximo permitido: 8% en zona sísmica baja, 6% en zona sísmica alta (zona 3 o 4 de Costa Rica).",
    porque: "Demasiado acero crea problemas de constructibilidad: las barras chocan entre sí, el concreto no fluye en el colado, y la columna se vuelve frágil al perder ductilidad. ACI §18.7.4.1 baja el límite en zona sísmica para asegurar comportamiento dúctil.",
    intuicion: "Más allá del 6-8% la columna parece una jaula de barras: imposible vibrar el concreto. Si llegas al máximo, agranda la sección.",
  },
  "rect_col.step_07_rho": {
    que: "Calculamos la cuantía real ρ = As_provisto / Ag. Es el porcentaje de acero que efectivamente vamos a colocar.",
    porque: "ρ tiene que vivir entre ρmin (1%) y ρmax (6-8%). Es el indicador clave para saber si la columna está bien proporcionada o si conviene cambiar la geometría.",
    intuicion: "Cuantías típicas en CR: 1.5-3%. Si te da 5%+, probablemente la sección es muy chica; si te da 1%, está sobrada.",
  },
  "rect_col.step_08_lo": {
    que: "Calculamos la longitud lo donde van los estribos juntos (zona confinada) en cada extremo de la columna. Toma el mayor de tres valores: h, L/6, 45 cm.",
    porque: "ACI §18.7.5.1 protege la zona donde se forma la rótula plástica en sismo. Esa franja necesita confinamiento extra para que la columna sea dúctil y no falle frágil al primer ciclo sísmico.",
    intuicion: "Imagina que la columna se va a 'doblar' en sus extremos durante un sismo. lo es la zona donde le ponemos 'corsé' extra para que aguante el doblez sin reventarse.",
  },
  "rect_col.step_09_s_conf": {
    que: "Calculamos la separación máxima entre estribos en la zona confinada (los extremos). Toma el mínimo entre varias limitaciones: 6·db, b/4, hx/3, sAsh, 10 cm.",
    porque: "ACI §18.7.5.3 amarra los estribos lo más cerca posible para confinar el concreto y evitar el pandeo de las barras longitudinales en sismo. Mientras más juntos los estribos, más dúctil la columna.",
    intuicion: "En zona confinada los estribos van a 10 cm o menos. Si los pones a 15 cm 'porque ahorras un par de aros', cuando llegue el sismo la columna se desnuda y pandea.",
  },
  "rect_col.step_10_s_central": {
    que: "Calculamos la separación entre estribos en la parte central de la columna (fuera de las zonas confinadas). Toma el mínimo entre 6·db y 15 cm.",
    porque: "Fuera de la rótula plástica los estribos solo cumplen función de amarre y cortante, no de confinamiento sísmico. ACI §10.7.6.5.2 permite separaciones mayores que en zona confinada, pero nunca más de 15 cm.",
    intuicion: "Piensa en la columna como una empanada: los extremos (relleno) llevan más amarre, el centro lleva amarre normal. Casi siempre se usa 15 cm.",
  },
  "rect_col.step_11_kl_r": {
    que: "Calculamos la esbeltez kl/r — qué tan delgada y larga es la columna respecto a su radio de giro. Para sección rectangular, r ≈ 0.30·h.",
    porque: "Si kl/r es bajo (típicamente < 22 ó < 34 según ACI §6.2.5), la columna es CORTA y no pandea. Si es alto, hay que magnificar el momento por efectos P-Δ o usar análisis no lineal — ver el módulo de Esbeltez.",
    intuicion: "Una columna corta es como un dado: resiste compresión pura. Una columna esbelta es como un lápiz parado: se 'arquea' antes de aplastarse. Regla rápida: H/h > 10 ya empieza a ser esbelta.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 2. ISOLATED FOOTING (iso_ftg.*) — 13 steps
  // ═══════════════════════════════════════════════════════════════════════
  "iso_ftg.step_01_A": {
    que: "Calculamos el área en planta de la zapata (B·L). Es el 'plato' de concreto que reparte la carga de la columna sobre el suelo.",
    porque: "El suelo aguanta solo cierta presión (qcap). Si la columna le mete demasiada carga concentrada, se hunde. La zapata reparte esa carga sobre un área suficiente para que la presión baje del límite admisible.",
    intuicion: "Es como caminar en nieve: con zapatos te hundes, con raquetas no. La zapata es la raqueta de la columna.",
  },
  "iso_ftg.step_02_e": {
    que: "Calculamos la excentricidad e = Mu/Pu: cuánto se desvía la resultante del centro de la zapata.",
    porque: "Si e ≤ B/6 la presión bajo la zapata es trapezoidal (todo el área trabaja). Si e > B/6 hay levantamiento en un lado, lo cual es inaceptable para zapatas aisladas. Regla del tercio medio: e debe quedar dentro del tercio central.",
    intuicion: "Una zapata con la columna descentrada es como un trípode con una pata corta: se vuelca. Mantén e < B/6 o agranda la zapata.",
  },
  "iso_ftg.step_03_qu": {
    que: "Calculamos la presión última máxima qu = Pu/A·(1 + 6e/B) bajo la esquina más cargada de la zapata.",
    porque: "Es la presión real que verá el suelo en su punto más comprometido. Hay que compararla contra la capacidad admisible (qcap) del estudio de suelos para saber si la zapata aguanta o se hunde.",
    intuicion: "Suelos típicos en CR: qcap entre 10 y 20 t/m² (100-200 kPa). Si te da qu > 250 kPa, agranda la zapata o pide pilotes.",
  },
  "iso_ftg.step_04_q_cap": {
    que: "Recuperamos la capacidad admisible del suelo qcap del estudio de suelos. Es el límite que el suelo aguanta sin asentarse más de lo permitido.",
    porque: "ACI §13.3.1.1 manda comparar qu vs qcap. Si qu > qcap, la zapata es chica o el suelo malo. No es opción 'apretar' al suelo: se hunde y arrastra toda la estructura.",
    intuicion: "qcap es lo que el geotecnista te garantiza después de haber metido un SPT y haber visto el subsuelo. Sin estudio formal, no inventes — pide uno.",
  },
  "iso_ftg.step_05_d": {
    que: "Calculamos el peralte efectivo d = h - recubrimiento - db. Es la distancia desde la fibra comprimida arriba hasta el centro del acero abajo.",
    porque: "d es la palanca de la zapata: a mayor d, más capacidad a flexión y cortante. ACI §22.5 y §22.6 usan d en todas las fórmulas porque el acero solo trabaja efectivamente desde su centroide.",
    intuicion: "Si tienes h = 40 cm y recubrimiento 7.5 cm + barra de 5/8, d ≈ 31 cm. Una zapata de menos de 20 cm de d casi siempre falla a cortante.",
  },
  "iso_ftg.step_06_Vu_1d": {
    que: "Calculamos el cortante en una dirección (cortante de viga) que pasa a una distancia d del borde de la columna.",
    porque: "ACI §22.5 modela la zapata como una viga ancha que se 'corta' en un plano vertical a distancia d. Es la primera revisión obligatoria antes de cortante en dos direcciones (punzonamiento).",
    intuicion: "Imagina cortar la zapata con una sierra perpendicular al lado: el Vu_1d es la fuerza que tiene que aguantar el concreto en esa rebanada.",
  },
  "iso_ftg.step_07_phiVc_1d": {
    que: "Calculamos la capacidad a cortante 1-D: φ·Vc = 0.75·0.53·√f'c·b·d (en sistema MKS). Es lo que el concreto solo (sin estribos) aguanta.",
    porque: "Las zapatas casi nunca llevan estribos. Si φVc no alcanza, la única salida es subir el peralte h (más d) o agrandar la planta. ACI §22.5.5 prohíbe confiar en el concreto si se excede esta capacidad.",
    intuicion: "El concreto solo aguanta cortante hasta aprox. 8-9 kg/cm². Si te exiges más, sube h: 5 cm extra de h pueden duplicar la capacidad.",
  },
  "iso_ftg.step_08_bo": {
    que: "Calculamos el perímetro crítico bo a punzonamiento: un rectángulo a d/2 alrededor de la columna.",
    porque: "ACI §22.6.4.1 define bo como el contorno donde el concreto se 'parte' en forma de pirámide invertida cuando la columna intenta perforarlo. Mientras más grande bo, más capacidad de punzonamiento.",
    intuicion: "Visualízalo: la columna actúa como un palo hundido en arena, la falla sale en forma de cono invertido. bo es el perímetro del cono justo bajo la zapata.",
  },
  "iso_ftg.step_09_phiVc_pun": {
    que: "Calculamos la capacidad a punzonamiento φ·Vc = 0.75·1.06·√f'c·bo·d (cuando β = 1 y columna interior).",
    porque: "Es la falla más peligrosa de las zapatas: la columna 'punza' a través del concreto. ACI §22.6.5 ofrece tres fórmulas y manda usar la menor. Sin estribos especiales, no hay segunda oportunidad — falla frágil.",
    intuicion: "Una zapata que falla a punzonamiento se ve como un dónut: el cilindro de concreto se hunde con la columna. Si no pasa, sube el peralte SIEMPRE.",
  },
  "iso_ftg.step_10_Mu_B": {
    que: "Calculamos el momento último a flexión en la dirección B (lado corto), tomando el voladizo desde la cara de la columna hasta el borde de la zapata.",
    porque: "La presión del suelo intenta 'doblar' la zapata hacia arriba como un trampolín al revés. ACI §13.3.4 manda calcular Mu en el plano de la cara de la columna, que es donde se concentra el esfuerzo de flexión.",
    intuicion: "Imagina la zapata como un cuatrojo en el suelo, cada lado en voladizo. Cuanto más voladizo, mayor Mu — por eso conviene que la columna quede centrada.",
  },
  "iso_ftg.step_11_As_B": {
    que: "Calculamos el acero requerido en la dirección B (barras perpendiculares al lado B, repartidas uniformemente).",
    porque: "El acero abajo absorbe la tracción que genera el momento Mu_B. ACI §13.3.4 usa la misma fórmula de flexión que las losas: As = Mu / (φ·fy·0.9d). Casi siempre rige el acero mínimo por temperatura.",
    intuicion: "En zapatas pequeñas (≤ 2 m) el acero rara vez sale más del mínimo. Pon Ø3/8 @ 20 cm en cada dirección y casi siempre alcanza.",
  },
  "iso_ftg.step_12_Mu_L": {
    que: "Calculamos el momento último a flexión en la dirección L (lado largo), igual que Mu_B pero perpendicular.",
    porque: "Toda zapata cuadrada o rectangular se diseña en dos direcciones porque trabaja como placa en ambas. Si la zapata es alargada, Mu_L será mayor que Mu_B porque el voladizo es más largo.",
    intuicion: "Si L > B, el acero de la dirección L (paralelo al lado corto) será mayor — el voladizo más largo manda. Por eso conviene siempre tener zapatas lo más cuadradas posible.",
  },
  "iso_ftg.step_13_As_L": {
    que: "Calculamos el acero requerido en la dirección L (barras perpendiculares al lado L). En zapatas alargadas, ACI §13.3.4.3 manda concentrar acero en la franja central.",
    porque: "El momento no se distribuye uniformemente — se concentra cerca de la columna. La franja central de ancho B recibe una proporción mayor de acero. En zapatas casi cuadradas (L/B ≤ 1.5), la distribución uniforme funciona bien.",
    intuicion: "Si L/B > 2 (zapata muy alargada) acuérdate de meter más acero en la franja del medio: es donde más se dobla.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 3. ONE-WAY SLAB (ow_slab.*) — 7 steps
  // ═══════════════════════════════════════════════════════════════════════
  "ow_slab.step_01_d": {
    que: "Calculamos el peralte efectivo de la losa d = h - recubrimiento - db/2. Es la altura útil entre la fibra comprimida y el centro del acero.",
    porque: "La capacidad de la losa depende de d, no del espesor total. Más d = más capacidad. ACI §7.7 manda 2 cm de recubrimiento en losas (3 cm si está expuesta a tierra).",
    intuicion: "En una losa de 12 cm, d ≈ 9.5 cm. Si recortas recubrimiento porque 'sobra', el acero se oxida y la losa se hace polvo en 20 años.",
  },
  "ow_slab.step_02_Cm": {
    que: "Tomamos el coeficiente ACI Cm según la condición de apoyo (simple, continua, voladizo, etc.). Es un número entre 8 y 24 que sale de la tabla §6.5.2.",
    porque: "Los coeficientes ACI son una forma rápida de calcular momentos sin hacer análisis estructural completo. Cada Cm representa qué fracción del wu·ℓn² ocurre en ese punto (apoyo o claro).",
    intuicion: "Para losa simple: Cm=8 (Mu=wℓ²/8). Para voladizo: Cm=2 (Mu=wℓ²/2). Memoriza estos dos: cubren el 80% de los casos en vivienda.",
  },
  "ow_slab.step_03_Mu": {
    que: "Calculamos el momento por metro de losa: Mu = wu·ℓn² / Cm. ℓn es la luz libre entre apoyos.",
    porque: "Es el dato de entrada para el diseño a flexión. Como la losa se analiza por franjas de 1 m de ancho, el Mu sale en ton·m/m. ACI §6.5 valida este método para luces parecidas y cargas distribuidas uniformes.",
    intuicion: "Mu sube con el cuadrado de la luz: doblar la luz cuadruplica el momento. Por eso es mucho mejor dividir un claro grande con una viga intermedia que aumentar el espesor.",
  },
  "ow_slab.step_04_As": {
    que: "Calculamos el acero principal por metro: As = Mu / (φ·fy·0.9d). Estas son las barras paralelas a la luz (perpendiculares a las vigas de apoyo).",
    porque: "El acero abajo (o arriba en zona de momento negativo) absorbe la tracción del momento. La fórmula simplificada ACI §22.2 usa brazo = 0.9d como aproximación segura del verdadero brazo interno.",
    intuicion: "Losas de vivienda típicas en CR: Ø3/8 @ 15 cm dan As ≈ 4.7 cm²/m, suficiente para luces de hasta 4 m. Si necesitas más, sube a Ø1/2 antes que apretar más la separación.",
  },
  "ow_slab.step_05_Astemp": {
    que: "Calculamos el acero por temperatura perpendicular al acero principal: As_temp = 0.0018·b·h (con fy = 4200 kg/cm²).",
    porque: "Aunque ese eje 'no necesite' acero estructural, ACI §24.4.3 obliga a poner acero por temperatura para controlar el agrietamiento por retracción del concreto. Sin este acero la losa se raja en franjas regulares al curar.",
    intuicion: "Es el 'seguro' contra grietas térmicas. Típico: Ø3/8 @ 25 cm. Nunca lo omitas aunque la losa sea de un solo tramo.",
  },
  "ow_slab.step_06_Vu": {
    que: "Calculamos el cortante por metro de losa: Vu = wu·ℓn / 2 (para simple) o ajustado por coeficiente para tramo continuo.",
    porque: "Las losas casi nunca fallan a cortante porque el concreto solo basta. Pero hay que verificarlo: si Vu se acerca a φVc, conviene engrosar la losa porque las losas NO llevan estribos.",
    intuicion: "Si Vu > 75% de φVc, sube el espesor. Meter estribos a una losa de 12 cm es una pesadilla constructiva.",
  },
  "ow_slab.step_07_phiVc": {
    que: "Calculamos la capacidad a cortante φVc = 0.75·0.53·√f'c·b·d. Es lo que el concreto solo soporta sin necesidad de refuerzo transversal.",
    porque: "ACI §22.5.5.1 permite usar el concreto solo en losas porque la profundidad de losa hace difícil colocar estribos efectivos. Por eso el espesor mínimo controla — si φVc no alcanza, hay que subir h.",
    intuicion: "Una losa de 12 cm con f'c = 210 da φVc ≈ 6 t/m de ancho. Más que suficiente para vivienda residencial estándar.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 4. TWO-WAY SLAB (tw_slab.*) — 8 steps
  // ═══════════════════════════════════════════════════════════════════════
  "tw_slab.step_01_m": {
    que: "Calculamos la relación de lados m = a/b, donde a es el lado corto y b el largo. Es un número entre 0.5 y 1.0.",
    porque: "Los coeficientes ACI para losa en dos direcciones (método 3) dependen de m. Mientras más cuadrada (m → 1.0), más uniforme se reparte la carga entre los dos ejes. Si m < 0.5 la losa trabaja en una sola dirección.",
    intuicion: "Una losa 5×5 (m=1.0) reparte la carga 50/50. Una losa 5×8 (m=0.625) manda más carga al lado corto. Mientras más cuadrada, más eficiente.",
  },
  "tw_slab.step_02_wu": {
    que: "Calculamos la carga última por m² de losa: wu = 1.2·CM + 1.6·CV (ACI §5.3.1) — peso propio + acabados + cargas vivas amplificadas.",
    porque: "Es la 'carga de diseño' que la losa tiene que aguantar con seguridad. Los factores 1.2 y 1.6 cubren la incertidumbre: la carga muerta es más conocida que la viva, por eso lleva menor factor.",
    intuicion: "Losa de vivienda típica: CM ≈ 350 kg/m², CV = 200 kg/m². wu ≈ 740 kg/m². Si te da más de 1000, revisa que no estés contando dos veces el peso propio.",
  },
  "tw_slab.step_03_Ma_neg": {
    que: "Calculamos el momento negativo en la dirección a (lado corto), usando coeficiente Ca_neg de las tablas ACI método 3.",
    porque: "El momento negativo (tracción arriba) ocurre en los bordes continuos de la losa, donde la losa intenta levantarse. Es típicamente mayor que el momento positivo del centro, por eso se calcula primero.",
    intuicion: "El momento negativo manda en losas continuas. Si tu losa termina en viga (no en otro tramo), Ma_neg = 0 — no hay continuidad para resistir.",
  },
  "tw_slab.step_04_Mb_neg": {
    que: "Calculamos el momento negativo en la dirección b (lado largo), análogo a Ma_neg pero perpendicular.",
    porque: "La losa trabaja en las DOS direcciones; cada eje tiene su propio acero superior en los bordes continuos. ACI §6.5 tabula los coeficientes por separado porque dependen de la condición de apoyo de cada lado.",
    intuicion: "Mb_neg suele ser MENOR que Ma_neg porque el lado largo es más flexible. Pero igual hay que ponerle acero — no lo omitas.",
  },
  "tw_slab.step_05_Mu_a": {
    que: "Elegimos el momento gobernante en la dirección a — el mayor entre Ma_pos (centro) y Ma_neg (borde) — para dimensionar el acero.",
    porque: "El acero pasa por toda la losa, no por puntos. Una sola elección de barra y separación tiene que cubrir el punto más exigido. Por eso se diseña para el momento crítico.",
    intuicion: "En la práctica los planos muestran acero positivo abajo (cubre Mpos) y acero negativo arriba en los bordes (cubre Mneg). Cada uno con su Mu_a.",
  },
  "tw_slab.step_06_Mu_b": {
    que: "Elegimos el momento gobernante en la dirección b. Mismo criterio que Mu_a pero para el lado largo.",
    porque: "Como la losa trabaja en dos direcciones, cada eje se diseña independientemente. Mu_b suele ser menor que Mu_a porque el lado largo absorbe menos carga al ser más flexible.",
    intuicion: "Relación típica en losa 5×6: Mu_a ≈ 1.5·Mu_b. Por eso el acero del lado corto manda y suele ser la barra inferior 'principal'.",
  },
  "tw_slab.step_07_As_a": {
    que: "Calculamos el acero en la dirección corta a: As = Mu_a / (φ·fy·0.9d). Estas barras van paralelas al lado corto y se colocan en la capa INFERIOR de la losa.",
    porque: "ACI §13.3 manda que el acero del lado corto vaya por debajo del lado largo, porque al ser el que más trabaja necesita el mayor d posible. La diferencia de d puede ser pequeña pero matemáticamente importante.",
    intuicion: "Regla constructiva: 'el primer acero abajo es el del lado corto'. Si los maestros lo invierten, la losa pierde 5-10% de capacidad.",
  },
  "tw_slab.step_08_As_b": {
    que: "Calculamos el acero en la dirección larga b: As = Mu_b / (φ·fy·0.9d), usando d ligeramente menor porque va encima del acero a.",
    porque: "Las barras del lado largo se colocan encima del acero corto, por eso su d es db menor. La fórmula es la misma, solo cambia el d efectivo.",
    intuicion: "En losa de 12 cm: d_a ≈ 9.5 cm, d_b ≈ 8.8 cm. La diferencia de 7 mm cambia ~8% la capacidad — por eso importa el orden de armado.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 5. SHEAR WALL (wall.*) — 7 steps
  // ═══════════════════════════════════════════════════════════════════════
  "wall.step_01_Acv": {
    que: "Calculamos el área de corte del muro Acv = espesor · longitud. Es la sección horizontal del muro que resiste el cortante sísmico.",
    porque: "ACI §18.10 define Acv como la 'cancha' donde se calculan los esfuerzos cortantes. Mientras más grueso y largo el muro, más cortante aguanta. Es la primera dimensión que define la capacidad del muro estructural.",
    intuicion: "Un muro de 20 cm × 4 m tiene Acv = 8000 cm². Como referencia, suele aguantar 40-60 ton de cortante sísmico. Si necesitas más, engruesa antes que alargar.",
  },
  "wall.step_02_hwlw": {
    que: "Calculamos la relación de aspecto hw/lw — altura total del muro entre su longitud en planta. Define si es muro alto y esbelto o bajo y robusto.",
    porque: "ACI §18.10.4 distingue dos comportamientos: si hw/lw ≤ 2 el muro es 'corto' y rige cortante; si hw/lw > 2 es 'esbelto' y rige flexión. Los coeficientes αc y las fórmulas de capacidad cambian según el régimen.",
    intuicion: "Muro de cocina de 2.5 m de alto × 4 m de largo: hw/lw = 0.625 → muro corto. Muro de cuatro pisos en escalera: hw/lw ≈ 3 → muro esbelto.",
  },
  "wall.step_03_alpha": {
    que: "Calculamos el coeficiente αc que entra en la fórmula de capacidad a cortante. Es 0.80 si hw/lw ≤ 1.5, 0.53 si hw/lw ≥ 2.0, e interpola en medio.",
    porque: "Los muros bajos resisten más cortante por unidad de área porque el flujo de fuerzas es más directo (acción de panel/diagonal de compresión). ACI §18.10.4.1 reconoce esta ventaja con un αc más alto.",
    intuicion: "Muro chaparro = patada de mula (αc grande). Muro alto y delgado = se dobla antes de cortarse (αc chico, manda flexión).",
  },
  "wall.step_04_phiVn": {
    que: "Calculamos la capacidad nominal a cortante del muro: φVn = φ·Acv·(αc·√f'c + ρt·fy). Junta el aporte del concreto y del acero horizontal.",
    porque: "ACI §18.10.4.1 reconoce que tanto el concreto (por su αc·√f'c) como el acero horizontal (cuantía ρt) trabajan juntos para resistir el cortante. φ = 0.75 (o 0.6 para muros frágiles).",
    intuicion: "El concreto aporta el grueso de Vn; el acero solo añade ~20-30%. Si te falta capacidad, engrosar el muro multiplica más que apretar el acero.",
  },
  "wall.step_05_phiVn_max": {
    que: "Calculamos el tope absoluto φVn,max = φ·Acv·2.65·√f'c. No importa cuánto acero le metas: el muro no puede pasar de este límite porque se rompe el concreto en compresión diagonal.",
    porque: "Cuando el cortante se concentra, el concreto falla por aplastamiento de bielas diagonales — falla frágil y catastrófica. ACI §18.10.4.4 prohíbe diseñar muros por encima de este límite; obliga a engrosar.",
    intuicion: "Si Vu se acerca a φVn,max, ya estás 'exprimiendo' el muro. Engrosar 5 cm es casi siempre más eficaz que pasar a doble cortina de acero.",
  },
  "wall.step_06_Vu_2curt": {
    que: "Calculamos el Vu a partir del cual ACI obliga a usar DOS cortinas de acero (una en cada cara del muro) en lugar de una sola al centro.",
    porque: "ACI §18.10.2.2 manda doble cortina cuando Vu > 0.53·Acv·√f'c o cuando el espesor es ≥ 25 cm. Dos cortinas mejoran el confinamiento, controlan mejor el agrietamiento y dan redundancia ante carga cíclica.",
    intuicion: "Regla práctica: muros de fachada ≥ 20 cm en zona sísmica → doble cortina automática. Es más caro, pero el comportamiento sísmico es mucho mejor.",
  },
  "wall.step_07_As_min": {
    que: "Calculamos el acero mínimo vertical y horizontal del muro: cuantía mínima 0.0025·b por metro de muro, en cada dirección.",
    porque: "ACI §18.10.2.1 fija un mínimo absoluto porque el muro tiene que controlar agrietamiento por retracción y flexión inducida. Sin este mínimo, el muro se raja en horizontales como un cárcel hostigado.",
    intuicion: "Para muro de 15 cm: ~3.75 cm²/m. Eso es Ø3/8 @ 15 cm o Ø1/2 @ 25 cm. Pon el horizontal igual al vertical — son cantidades parecidas.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 6. TIE BEAM (tie_beam.*) — 4 steps
  // ═══════════════════════════════════════════════════════════════════════
  "tie_beam.step_01_Pu_amarre": {
    que: "Calculamos la tracción de amarre Pu = 0.10·Pu_columna que la viga de amarre tiene que aguantar entre zapatas.",
    porque: "ACI §18.13.3.2 manda que las vigas de amarre entre zapatas resistan al menos el 10% de la carga axial de la columna más cargada. Esto sirve para evitar movimiento relativo entre cimientos en caso de sismo o asentamiento diferencial.",
    intuicion: "Es la 'corbata' que mantiene las zapatas unidas. Sin amarre, en un sismo cada zapata se mueve por su cuenta y la estructura colapsa en planta baja.",
  },
  "tie_beam.step_02_As_long_req": {
    que: "Calculamos el acero longitudinal requerido por la tracción: As = Pu / (φ·fy). Es el acero que aguanta el 'tirón' entre columnas.",
    porque: "Una viga de amarre trabaja como un tirante: la carga axial demanda acero longitudinal continuo. La fórmula es directa porque no hay flexión significativa, solo tracción pura. φ = 0.90 (tracción pura, ACI §21.2).",
    intuicion: "Para columna de 50 ton, Pu_amarre = 5 ton → As ≈ 1.4 cm² = una Ø1/2 alcanza. Casi siempre el mínimo (4 #5) rige sobre el cálculo.",
  },
  "tie_beam.step_03_As_min": {
    que: "Fijamos el acero mínimo por código: 4 barras #5 (4 × 1.98 cm² = 7.9 cm² total).",
    porque: "ACI §18.13.3.2 y CFIA exigen este mínimo en vigas de amarre por razones de constructibilidad y control de fisuras: 4 barras #5 en las esquinas, con estribos cerrados, es el estándar mínimo de práctica.",
    intuicion: "El mínimo gana en el 90% de casos. No pierdas tiempo calculando: pon 4 #5 + estribo #3 @ 20 cm y queda.",
  },
  "tie_beam.step_04_As_diseno": {
    que: "Comparamos As_req con As_min y tomamos el mayor — es el acero de diseño final.",
    porque: "El acero realmente colocado debe satisfacer ambos criterios: el cálculo por carga (As_req) y el mínimo normativo (As_min). El máximo de los dos garantiza seguridad estructural y cumplimiento de código.",
    intuicion: "Si tu cálculo te da menos de 7.9 cm², usa los 4 #5 mínimos. Si te da más, agranda barras (4 #6 = 11.4 cm²) antes que aumentar el conteo.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 7. STRIP FOOTING (strip_ftg.*) — 8 steps
  // ═══════════════════════════════════════════════════════════════════════
  "strip_ftg.step_01_qu": {
    que: "Calculamos la presión última que el muro/columna hace sobre el suelo por metro lineal: qu = Pu / (B·1m).",
    porque: "La zapata corrida reparte la carga lineal del muro. ACI §13.3.1 manda usar carga factorizada para diseño estructural (acero, cortante) y carga de servicio para verificar el suelo. qu es la entrada estructural.",
    intuicion: "Muro perimetral típico de vivienda: 4 ton/m lineal sobre B = 60 cm → qu ≈ 6.7 t/m². Suelo común aguanta sin problema.",
  },
  "strip_ftg.step_02_qcap": {
    que: "Recuperamos la capacidad admisible del suelo qcap del estudio geotécnico. Es lo que el suelo aguanta sin asentarse más de lo permitido (típicamente 2.5 cm).",
    porque: "Comparamos q_servicio vs qcap. Si q_servicio > qcap, la zapata es chica o el suelo malo. La capacidad última suelo viene de Terzaghi o Brinch Hansen aplicada en el estudio de suelos.",
    intuicion: "Suelos volcánicos sanos en CR: qcap 15-25 t/m². Suelos arcillosos blandos: 5-10 t/m². Sin estudio no inventes — el costo de un SPT es ridículo comparado con el de la zapata.",
  },
  "strip_ftg.step_03_d": {
    que: "Calculamos el peralte efectivo d = h - recubrimiento - db/2. Es la altura útil del talón hacia abajo desde la fibra comprimida.",
    porque: "Mismo concepto que en zapata aislada: d es la palanca de resistencia a flexión y cortante. ACI §22.5 y §22.6 usan d en todas las fórmulas. Recubrimiento típico para contacto con suelo: 7.5 cm.",
    intuicion: "Zapata corrida común: h = 25-30 cm, d ≈ 18-23 cm. Más delgado que eso pierde cortante; más grueso es desperdicio.",
  },
  "strip_ftg.step_04_Mu": {
    que: "Calculamos el momento transversal por metro: Mu = qu·a²/2, donde a es el voladizo desde la cara del muro hasta el borde de la zapata.",
    porque: "La presión del suelo intenta doblar la zapata hacia arriba. ACI §13.3.4 manda calcular Mu en el plano de la cara del muro. Como la carga es uniforme y el voladizo corto, la fórmula es simple.",
    intuicion: "Si el voladizo es 25 cm: Mu = qu·0.0625/2. Muy poco momento, casi siempre rige el acero mínimo por temperatura.",
  },
  "strip_ftg.step_05_As": {
    que: "Calculamos el acero transversal requerido: As = Mu / (φ·fy·0.9d). Estas barras van perpendiculares al muro y son las que 'absorben' la flexión hacia arriba.",
    porque: "El acero transversal es el principal de la zapata corrida. Va en la cara inferior porque el momento genera tracción abajo (la zapata se 'pandea' hacia arriba en los voladizos).",
    intuicion: "Acero típico: Ø3/8 @ 20 cm transversal cubre casi cualquier zapata corrida de vivienda. Si necesitas más, casi siempre falla cortante o capacidad de suelo primero.",
  },
  "strip_ftg.step_06_Vu": {
    que: "Calculamos el cortante transversal en la cara del muro a distancia d: Vu = qu·(a - d).",
    porque: "ACI §22.5 toma la sección crítica a distancia d de la cara del apoyo. Si Vu > φVc hay que subir el peralte porque las zapatas no llevan estribos (es impráctico constructivamente).",
    intuicion: "Si tu voladizo a es menor que d, ¡no hay cortante crítico! El cortante 'se sale' del cuerpo de la zapata. Aprovéchalo: zapatas anchas con d generoso casi nunca fallan a cortante.",
  },
  "strip_ftg.step_07_phiVc": {
    que: "Calculamos la capacidad a cortante φVc = 0.75·0.53·√f'c·b·d (por metro de ancho). Es lo que el concreto solo aguanta sin refuerzo transversal.",
    porque: "Las zapatas corridas casi nunca tienen estribos por costo y constructibilidad. ACI §22.5.5 permite usar solo concreto. Si no alcanza, la única salida es engrosar la zapata o angostar el voladizo.",
    intuicion: "f'c = 210, d = 20 cm → φVc ≈ 5.7 ton/m. Más que suficiente para zapatas de vivienda normal. Si no pasa, sube h antes que cambiar la geometría en planta.",
  },
  "strip_ftg.step_08_As_temp": {
    que: "Calculamos el acero por temperatura longitudinal (paralelo al muro): As_temp = 0.0018·b·h.",
    porque: "El eje longitudinal de la zapata no recibe flexión significativa, pero ACI §24.4.3 manda acero por retracción del concreto. Sin él, la zapata se raja en grietas transversales al curar.",
    intuicion: "Mínimo: 3-4 Ø3/8 longitudinales en zapata de 60 cm de ancho. Es barato y evita fisuras visibles después de unos meses.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 8. CIRCULAR COLUMN (circ_col.*) — 9 steps
  // ═══════════════════════════════════════════════════════════════════════
  "circ_col.step_01_Ag": {
    que: "Calculamos el área bruta de la columna circular: Ag = π·D²/4. Es la sección total de concreto sin descontar acero.",
    porque: "Igual que en columna rectangular, Ag es la referencia para todas las cuantías y capacidades. La circular tiene la ventaja de ser igual de resistente en cualquier dirección — no hay 'lado fuerte'.",
    intuicion: "D = 30 cm → Ag = 707 cm². Como referencia: una columna circular de D=30 ≈ rectangular de 25×30. Misma capacidad, menos acero longitudinal.",
  },
  "circ_col.step_02_Dc": {
    que: "Calculamos el diámetro del núcleo confinado Dc = D - 2·recubrimiento - 2·d_espiral. Es la zona de concreto que la espiral mantiene confinada.",
    porque: "Solo el concreto dentro de la espiral es 'dúctil'. ACI §18.7.5.4 usa Dc para calcular la cuantía de espiral mínima. El concreto fuera de la espiral (recubrimiento) se desprende en sismo y se pierde.",
    intuicion: "Visualiza la columna como una salchicha: la 'piel' (recubrimiento) se desprende, queda solo el 'relleno' (núcleo confinado). Por eso Dc < D pero es lo que importa estructuralmente.",
  },
  "circ_col.step_03_Ac": {
    que: "Calculamos el área del núcleo confinado Ac = π·Dc²/4. Es la sección que realmente aguanta en estado último.",
    porque: "Bajo carga máxima el recubrimiento se desprende y solo trabaja el núcleo. La cuantía mínima de espiral (ρs ≥ 0.45·(Ag/Ac - 1)·f'c/fy) se calcula para que la ganancia de confinamiento compense la pérdida del recubrimiento.",
    intuicion: "Mientras más relación Ag/Ac, más castigo: una columna con recubrimiento generoso (y por tanto Ac pequeño respecto a Ag) necesita más espiral.",
  },
  "circ_col.step_04_phi": {
    que: "Fijamos el factor de reducción φ = 0.75 para columnas con refuerzo helicoidal (espiral).",
    porque: "ACI §21.2.2 reconoce que las columnas con espiral tienen mayor ductilidad que las estribadas (φ=0.65). La espiral 'abraza' al concreto y mantiene la sección integra incluso después del primer agrietamiento.",
    intuicion: "La espiral te da 'crédito' de 0.10 en φ. En proyectos sísmicos importantes (hospitales, torres), las circulares con espiral son la primera opción.",
  },
  "circ_col.step_05_Ast_req": {
    que: "Calculamos el acero longitudinal requerido para resistir Pu: Ast = (Pu/φ - 0.85·f'c·Ag)/(fy - 0.85·f'c).",
    porque: "Mismo principio que en columna rectangular pero con el coeficiente 0.85 (vs 0.80 rectangular) — ACI §22.4.2.1 reconoce mejor comportamiento de las circulares. La ecuación distribuye la carga entre concreto y acero.",
    intuicion: "Las circulares necesitan ~6% menos acero longitudinal que rectangulares para la misma Pu. Por eso son la elección eficiente cuando el espacio lo permite.",
  },
  "circ_col.step_06_rho": {
    que: "Calculamos la cuantía longitudinal real ρ = As_provisto / Ag.",
    porque: "Tiene que cumplir 0.01 ≤ ρ ≤ 0.08 (o 0.06 en zona sísmica alta). Es el mismo rango que en columna rectangular: por debajo es frágil, por encima es impráctico de colar.",
    intuicion: "Cuantía típica circular: 1.5-2.5%. Si te sale más de 4%, considera agrandar el diámetro: las circulares grandes son visualmente esbeltas pero estructuralmente generosas.",
  },
  "circ_col.step_07_rho_s_min": {
    que: "Calculamos la cuantía mínima de espiral ρs ≥ 0.45·(Ag/Ac - 1)·f'c/fy según ACI §25.7.3.2.",
    porque: "Es la cantidad mínima de espiral para garantizar que la ganancia de confinamiento iguale o supere la pérdida del recubrimiento. Sin esta cuantía, la columna pierde capacidad neta al desprenderse el recubrimiento.",
    intuicion: "ρs típica: 1-2%. Es bastante espiral, pero el resultado es una columna increíblemente dúctil. En sismo se 'arruga' pero no se desploma.",
  },
  "circ_col.step_08_s_espiral": {
    que: "Calculamos la separación máxima de la espiral (paso): se = As_espiral·π·Dc / (ρs_req·Ac).",
    porque: "Es el espaciamiento entre vueltas consecutivas de la espiral. ACI §25.7.3.1 limita a entre 25 mm y 75 mm para que el efecto de confinamiento sea efectivo y constructivamente colable.",
    intuicion: "Espirales típicas: Ø3/8 @ 4-5 cm de paso. Más juntas no se puede colar bien; más separadas pierden efecto. El maestro tiene que sostener la espiral con grapas para que no se 'caiga'.",
  },
  "circ_col.step_09_lo": {
    que: "Calculamos la longitud de zona confinada lo en los extremos = max(h, L/6, 45 cm). En la zona lo va espiral más cerrada.",
    porque: "Mismo concepto que en columna rectangular: ACI §18.7.5.1 manda confinar extra los extremos donde se forma la rótula plástica. En la zona central la espiral puede ir más espaciada.",
    intuicion: "Si la columna mide 3 m, lo ≈ 50 cm en cada extremo. En esos 50 cm pon espiral al paso mínimo; en el metro central puedes relajar a 8-10 cm.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 9. STAIR SLAB (stair.*) — 8 steps
  // ═══════════════════════════════════════════════════════════════════════
  "stair.step_01_ergo": {
    que: "Verificamos la regla ergonómica 2C + H = 60-64 cm, donde C es contrahuella (alto del escalón) y H es huella (largo del paso).",
    porque: "No es estructural, es ergonomía. Ningún código sísmico te exigirá esto, pero si no lo cumples la escalera será incómoda o insegura. La regla viene de Blondel (1675) y representa el paso natural humano.",
    intuicion: "Vivienda cómoda: C=17, H=28 → 2·17+28 = 62 ✓. Si te da más de 64, los pasos son muy cortos; menos de 60, muy largos.",
  },
  "stair.step_02_pendiente": {
    que: "Calculamos la pendiente de la escalera α = atan(C/H) y el factor de inclinación 1/cos(α). Determina cómo se reparten las cargas verticales sobre la losa inclinada.",
    porque: "La losa inclinada tiene una proyección horizontal menor que su longitud real. Toda la carga del peso propio se 'concentra' en la proyección, lo que aumenta efectivamente la carga por metro horizontal en factor 1/cos(α).",
    intuicion: "Escalera típica α ≈ 31°, factor ≈ 1.17. O sea: tu losa de 12 cm pesa 17% más por metro horizontal de lo que parece.",
  },
  "stair.step_03_PP_losa": {
    que: "Calculamos el peso propio de la losa inclinada por metro horizontal: PP_losa = γ_concreto·h_losa / cos(α).",
    porque: "Es la primera carga muerta. Como la losa va inclinada, su peso real se 'proyecta' al plano horizontal con factor 1/cos(α). ACI §5.3 manda incluir este peso real en la combinación de cargas.",
    intuicion: "Para h_losa=12 cm: PP_losa ≈ 350 kg/m². Si te sale mucho menos, probablemente olvidaste el factor de inclinación.",
  },
  "stair.step_04_PP_esc": {
    que: "Calculamos el peso de los escalones (triángulos de concreto encima de la losa): PP_esc = γ·C/2 por metro horizontal.",
    porque: "Los escalones son una sobrecarga muerta extra sobre la losa inclinada. Cada escalón es un prisma triangular de concreto. Sin contarlos subestimas la carga en ~150 kg/m².",
    intuicion: "Para C=17: PP_esc = 2400·0.17/2 ≈ 200 kg/m². Es casi tan importante como el peso propio de la losa — nunca lo omitas.",
  },
  "stair.step_05_wu": {
    que: "Calculamos la carga última distribuida: wu = 1.2·(PP_losa + PP_esc + acabados) + 1.6·CV.",
    porque: "Es la carga de diseño que verá la losa de escalera, con los factores ACI §5.3.1. La CV de escaleras de vivienda es 300 kg/m² (alta porque considera tránsito con cargas: muebles, equipo).",
    intuicion: "Escalera típica vivienda: wu ≈ 1100-1300 kg/m². Más que una losa plana porque suma escalones + CV alta de tránsito.",
  },
  "stair.step_06_Mu": {
    que: "Calculamos el momento como una losa simplemente apoyada: Mu = wu·L²/8, donde L es la luz horizontal entre apoyos.",
    porque: "ACI permite tratar la escalera como losa de un sentido apoyada en sus extremos (descanso superior + inferior). El modelo es simplificación segura aunque la geometría sea inclinada.",
    intuicion: "Escalera de 3 m horizontales con wu=1200: Mu ≈ 1.35 t·m/m. Pide ~ Ø1/2 @ 20 cm de acero principal. Si la luz es mayor a 3.5 m, considera vigueta inclinada o tabique intermedio.",
  },
  "stair.step_07_As": {
    que: "Calculamos el acero principal por metro de ancho: As = Mu / (φ·fy·0.9d). Estas barras van paralelas a la dirección del descenso.",
    porque: "El acero principal de escalera trabaja a flexión positiva (cara inferior). ACI §6.5 valida usar la fórmula simplificada para escaleras tratadas como losas unidireccionales.",
    intuicion: "Acero típico: Ø1/2 @ 15-20 cm. Va recto en la losa, NO se dobla siguiendo los escalones — eso lo hacen los acabados, no el acero estructural.",
  },
  "stair.step_08_Astemp": {
    que: "Calculamos el acero por temperatura perpendicular al acero principal: As_temp = 0.0018·b·h.",
    porque: "Igual que en losa unidireccional, el eje perpendicular necesita acero por retracción y para controlar grietas (ACI §24.4.3). Sin él la escalera se raja en línea con la inclinación al cabo de meses.",
    intuicion: "Mínimo: Ø3/8 @ 25 cm transversal. Para escalera vivienda 1 m de ancho, son 4-5 barras transversales. Barato y obligatorio.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 10. LINTEL (lintel.*) — 4 steps
  // ═══════════════════════════════════════════════════════════════════════
  "lintel.step_01_d": {
    que: "Calculamos el peralte efectivo del dintel d = h - recubrimiento - db_estribo - db_long/2.",
    porque: "El dintel es una viga corta que pasa sobre el vano de una puerta o ventana. Como cualquier viga, su capacidad depende de d. Recubrimiento típico 2.5 cm porque no está expuesto a tierra.",
    intuicion: "Dintel típico: h=20 cm, d ≈ 16 cm. Es chico pero suficiente porque las luces son cortas (puertas 0.9 m, ventanas 1.5 m).",
  },
  "lintel.step_02_ratio": {
    que: "Calculamos la relación a/d, donde a es la luz libre del vano y d es el peralte efectivo. Determina si el dintel se comporta como viga o como viga corta/profunda.",
    porque: "ACI §9.9 trata como 'viga profunda' (deep beam) los elementos con a/d < 2. En ese régimen el modelo de flexión clásico no aplica, y hay que diseñar con strut-and-tie. La mayoría de dinteles de vivienda quedan en régimen normal (a/d > 2.5).",
    intuicion: "Dintel sobre puerta de 0.9 m con d=16 cm: a/d ≈ 5.6 → viga normal, fórmulas clásicas. Dintel sobre vano de 0.5 m con d=30: a/d ≈ 1.7 → revisar como deep beam.",
  },
  "lintel.step_03_As": {
    que: "Calculamos el acero inferior por flexión: As = Mu / (φ·fy·0.9d), tratando el dintel como viga simplemente apoyada.",
    porque: "La carga del muro encima del vano genera momento positivo en el centro del dintel. ACI §22.2 da la fórmula simplificada. En vivienda casi siempre rige el acero mínimo (2 Ø1/2 + 2 Ø3/8 superior + estribo).",
    intuicion: "Acero típico mínimo: 2 Ø1/2 abajo, 2 Ø3/8 arriba, estribo Ø1/4 @ 15 cm. Cubre el 90% de vanos en vivienda residencial.",
  },
  "lintel.step_04_phiVc": {
    que: "Calculamos la capacidad a cortante φVc = 0.75·0.53·√f'c·b·d del concreto solo.",
    porque: "Verificamos si los estribos mínimos son suficientes. En dinteles cortos típicos el cortante casi nunca rige, pero hay que comprobarlo. Si Vu > φVc, se calculan estribos por flexión-cortante (ACI §9.7).",
    intuicion: "Para b=15 cm, d=16 cm, f'c=210: φVc ≈ 1.4 ton. Cubre dinteles de hasta ~ 2 m de vano con muro encima de 2.5 m. Si tienes muros muy altos o losas pesadas encima, recalcula.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 11. RETAINING WALL (rw.*) — 20 steps
  // ═══════════════════════════════════════════════════════════════════════
  "rw.step_01_Ka": {
    que: "Calculamos el coeficiente activo de Rankine Ka = tan²(45° - φ/2). Representa cuánto empuja el suelo detrás del muro cuando éste se mueve ligeramente hacia afuera.",
    porque: "El suelo no empuja igual que un fluido — gracias a la fricción interna, su 'efectivo' es menor. Ka da el porcentaje del peso unitario que efectivamente empuja al muro. Rankine asume superficie horizontal del relleno y muro vertical.",
    intuicion: "Suelo arenoso φ=30°: Ka = 0.33 (empuja 33% como agua). Suelo arcilloso flojo φ=20°: Ka = 0.49 (casi la mitad como agua). Más fricción = menos empuje.",
  },
  "rw.step_02_Kp": {
    que: "Calculamos el coeficiente pasivo de Rankine Kp = 1/Ka = tan²(45° + φ/2). Representa cuánto el suelo de la punta resiste cuando el muro intenta deslizarse hacia él.",
    porque: "Es la fuerza estabilizadora del suelo delante de la zapata. Es mucho mayor que Ka porque movilizar el suelo pasivamente requiere comprimirlo. CSCR §17 recomienda no contar más del 50% del Kp por seguridad: la punta puede ser excavada después.",
    intuicion: "Para φ=30°: Kp ≈ 3.0 vs Ka ≈ 0.33 — el suelo resiste 9× más de lo que empuja. Pero no te confíes: si excavan delante del muro para una tubería, pierdes la pasiva.",
  },
  "rw.step_03_E1": {
    que: "Calculamos el empuje activo principal (triangular): E1 = ½·γ·H²·Ka. Es la fuerza horizontal del suelo seco actuando a H/3 desde la base.",
    porque: "El empuje crece linealmente con la profundidad (como el agua), por eso el diagrama es triangular y el centroide a H/3. Es la primera fuerza activa que tiene que aguantar el muro. La altura H incluye toda la pantalla, no solo la parte expuesta.",
    intuicion: "Muro de 3 m con γ=18, Ka=0.33: E1 ≈ 27 kN/m. Si subes el muro a 4 m, E1 se va a 48 kN/m — crece con el cuadrado de H. Por eso los muros altos son tan caros.",
  },
  "rw.step_04_E2": {
    que: "Calculamos el empuje por sobrecarga (rectangular): E2 = qSC·Ka·H. La sobrecarga (autos, peatones, edificación) actúa uniforme y produce un diagrama rectangular con centroide a H/2.",
    porque: "Las cargas en la superficie del relleno aumentan el empuje sobre el muro. ACI/CSCR exigen una sobrecarga mínima de tránsito de 10-15 kN/m². El diagrama es rectangular porque qSC es uniforme con la profundidad.",
    intuicion: "Una sobrecarga de 10 kN/m² sobre muro de 3 m con Ka=0.33: E2 = 10 kPa. Modesto pero suma. Si hay edificio arriba, qSC puede llegar a 50 kN/m² o más.",
  },
  "rw.step_05_Ep": {
    que: "Calculamos el empuje pasivo del suelo delante de la punta: Ep = ½·γ·D²·Kp, donde D es la profundidad de la cimentación.",
    porque: "Cuando el muro intenta deslizarse, el suelo delante se opone. Ep es la 'pared' que lo detiene. CSCR §17 manda no contarlo para vuelco (no es seguro asumir que estará ahí) pero sí para deslizamiento con reducción.",
    intuicion: "Para D=0.8 m, γ=18, Kp=3: Ep ≈ 17 kN/m. Es modesto pero ayuda. Si excavan delante (tuberías, jardín), pierdes esta resistencia y el muro puede deslizar.",
  },
  "rw.step_06_sumFh": {
    que: "Sumamos las fuerzas horizontales actuantes: ΣFh = E1 + E2. Es el total que el muro debe resistir lateralmente.",
    porque: "Es la 'demanda' lateral total: empuje del suelo + sobrecarga. Hay que compararla con las fuerzas resistentes (fricción + empuje pasivo) para verificar deslizamiento.",
    intuicion: "Para muro de 3 m con sobrecarga de tránsito: ΣFh ≈ 30-40 kN/m. Si supera 50 kN/m revisa el diseño: probablemente necesitas un talón posterior largo o una llave de cortante.",
  },
  "rw.step_07_sumMo": {
    que: "Calculamos los momentos volcadores: ΣMo = E1·H/3 + E2·H/2. Es el 'torque' que intenta voltear el muro alrededor de la punta delantera.",
    porque: "El muro pivota sobre el borde delantero de su zapata (punto A). Los empujes horizontales × sus brazos generan momento volcador. Se compara contra los momentos resistentes (pesos × brazos) para obtener FS al vuelco.",
    intuicion: "Para muro de 3 m: ΣMo ≈ 30-50 kN·m/m. Si tu zapata es chica (B < H/2), este momento casi siempre vuelca — agranda la base antes que confiar solo en el peso.",
  },
  "rw.step_08_sumFv": {
    que: "Sumamos las fuerzas verticales: peso de la zapata + peso de la pantalla + peso del relleno encima del talón + sobrecarga sobre el talón.",
    porque: "El peso total es la 'ancla' que mantiene el muro estable contra vuelco y deslizamiento. Mientras más peso, más momento resistente y más fricción. Por eso los muros gravitatorios funcionan: son pura masa.",
    intuicion: "El peso del relleno encima del talón posterior es tu mejor amigo: 'gratis' aumenta el peso y el momento resistente. Por eso un buen muro tiene talón posterior generoso.",
  },
  "rw.step_09_sumMr": {
    que: "Calculamos los momentos resistentes: cada peso × su brazo de palanca hasta la punta delantera (punto A).",
    porque: "Es la suma de momentos estabilizadores. Mientras más alejados del pivote estén los pesos (especialmente el relleno sobre el talón), mejor. FS_vuelco = ΣMr / ΣMo.",
    intuicion: "El brazo más largo es el del relleno encima del talón posterior. Por eso muros con talón posterior corto son ineficientes: pierden el momento gratis.",
  },
  "rw.step_10_FSv": {
    que: "Calculamos el factor de seguridad al vuelco: FS_v = ΣMr / ΣMo. Debe ser ≥ 1.5 (CSCR §17).",
    porque: "Es la verificación principal de estabilidad global. Por debajo de 1.5 el muro está al borde del vuelco — cualquier vibración, sismo o sobrecarga inesperada lo voltea. Algunos códigos exigen 2.0 en muros importantes.",
    intuicion: "Diseño cómodo: FS_v ≥ 2.0. Si te queda en 1.5-1.7, está apretado: una mala compactación del relleno o un sismo pequeño puede comprometerlo. Engrosa el talón.",
  },
  "rw.step_11_FSd": {
    que: "Calculamos el factor de seguridad al deslizamiento: FS_d = (μ·ΣFv + Ep)/ΣFh. Debe ser ≥ 1.5.",
    porque: "El muro puede deslizar horizontalmente sin volcarse. La fricción base (μ·ΣFv, con μ ≈ tan φ) más la pasiva (Ep) se oponen al empuje horizontal. Si FSd < 1.5, agrega una 'llave de cortante' (diente debajo de la zapata) o ensancha B.",
    intuicion: "FSd suele ser más crítico que FSv en suelos blandos (φ bajo, μ bajo). Llave de cortante de 30 cm puede subir FSd un 40% sin cambiar nada más.",
  },
  "rw.step_12_e": {
    que: "Calculamos la excentricidad e = B/2 - x̄, donde x̄ es la posición de la resultante vertical. Debe quedar dentro del tercio medio (|e| ≤ B/6).",
    porque: "Si la resultante cae fuera del tercio medio, hay levantamiento bajo el talón posterior: la zapata trabaja solo en parte de su área (B' = B - 2e) y la presión máxima se dispara. CSCR §17 prohíbe excentricidad fuera del tercio.",
    intuicion: "Si |e| > B/6, te quedan dos opciones: (a) agrandar B o (b) reposicionar la zapata para que la pantalla quede más adelantada. Lo segundo es más eficiente.",
  },
  "rw.step_13_qmax": {
    que: "Calculamos la presión máxima bajo el talón delantero: qmax = ΣFv/B·(1 + 6e/B). Debe ser ≤ q_admisible del suelo.",
    porque: "Es la presión real que verá el suelo en su zona más cargada (talón delantero). Si supera la capacidad admisible, el muro se hunde diferencialmente y se inclina hacia adelante. La distribución es trapezoidal si e ≤ B/6.",
    intuicion: "qmax suele dar 1.5-2.0× la presión promedio. Si qmax > qadm, agrandar B reduce qmax dramáticamente (relación cuadrática). Más eficiente que cambiar de suelo.",
  },
  "rw.step_14_qu": {
    que: "Calculamos la capacidad última del suelo (Brinch Hansen): qu = c·Nc·dc·ic + q·Nq·dq·iq + ½·γ·B'·Nγ·dγ·iγ.",
    porque: "Es la falla teórica del suelo bajo la zapata, considerando cohesión c, sobrecarga q, peso del suelo γ y todos los factores de forma y carga inclinada. FS_scc = qu/qmax debe ser ≥ 3.0 para servicio.",
    intuicion: "qu suele ser 5-10× mayor que qadm — la diferencia es el factor de seguridad y el control de asentamientos. Si qu/qmax < 3, el muro puede sufrir asentamiento progresivo.",
  },
  "rw.step_15_Vu_pant": {
    que: "Calculamos el cortante último en la base de la pantalla (donde se une con la zapata): Vu = 1.7·(E1_pant + E2_pant). El factor 1.7 es ACI viejo (en ACI 2014 se usa 1.6).",
    porque: "La pantalla actúa como un voladizo vertical empotrado en la zapata. El máximo cortante está en el empotramiento (base de la pantalla). Como la pantalla NO lleva estribos típicamente, hay que verificar que el concreto solo aguante.",
    intuicion: "Para muro de 3 m con sobrecarga: Vu ≈ 50-70 kN/m. Pantallas de 25-30 cm de espesor casi siempre alcanzan sin estribos. Si no, engrosa el cuello de la pantalla.",
  },
  "rw.step_16_Mu_pant": {
    que: "Calculamos el momento último en la base de la pantalla: Mu = 1.7·(E1·H/3 + E2·H/2).",
    porque: "Es el momento de empotramiento de la pantalla vertical actuando como voladizo. Crece con H² — los muros altos son exponencialmente más exigentes. Determina el acero vertical principal de la pantalla.",
    intuicion: "Para muro de 3 m: Mu ≈ 40-60 kN·m/m. Si subes a 4 m, casi se duplica. Por eso muros de más de 4 m casi siempre tienen contrafuertes o aletas.",
  },
  "rw.step_17_As_pant": {
    que: "Calculamos el acero vertical principal de la pantalla: As = Mu / (φ·fy·0.9d). Se coloca en la cara INTERIOR (lado del relleno).",
    porque: "El relleno empuja hacia afuera, generando tracción en la cara interior de la pantalla. ACI §9.5 manda colocar el acero principal allí. Una cara exterior solo lleva acero por temperatura.",
    intuicion: "Acero típico pantalla: Ø1/2 @ 15-20 cm en cara interior + Ø3/8 @ 25 cm en cara exterior (temperatura). Si te exige más, engruesa la pantalla.",
  },
  "rw.step_18_Ldh": {
    que: "Calculamos la longitud de anclaje del gancho del acero vertical dentro de la zapata: Ldh = 0.7·3.18·db·√(fy/f'c).",
    porque: "El acero vertical de la pantalla tiene que estar bien anclado en la zapata para 'tirar' del momento. ACI §25.4.3 manda este Ldh con gancho a 90°. Si Hz (espesor de zapata) es menor que Ldh, el anclaje falla por extracción.",
    intuicion: "Para Ø1/2, fy=4200, f'c=210: Ldh ≈ 28 cm. Si tu zapata es de solo 30 cm de peralte, los ganchos no caben — engrosa la zapata o usa barra menor.",
  },
  "rw.step_19_As_talonPost": {
    que: "Calculamos el acero principal del talón posterior (atrás de la pantalla). Va arriba porque el peso del relleno encima genera momento negativo.",
    porque: "El talón posterior funciona como voladizo cargado con el relleno: la zapata tiende a doblarse hacia abajo y el acero superior absorbe la tracción. Es el reverso de una losa simple — el acero principal va arriba, no abajo.",
    intuicion: "Acero típico: Ø1/2 @ 20 cm en la cara superior de la zapata. Atención: en una zapata corrida normal el acero principal va abajo. Aquí es al revés porque el momento es negativo.",
  },
  "rw.step_20_As_talonDel": {
    que: "Calculamos el acero principal del talón delantero (punta delante de la pantalla). Va abajo porque la presión del suelo genera momento positivo.",
    porque: "La presión del suelo bajo el talón delantero empuja hacia arriba como un trampolín. El acero abajo absorbe la tracción inferior. Es el caso 'normal' de zapata. Casi siempre rige el acero mínimo por temperatura.",
    intuicion: "Acero típico: Ø3/8 @ 20 cm en la cara inferior. Menos exigente que el talón posterior porque la palanca es menor (típicamente más corto).",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 12. CONFINED MASONRY (masonry.*) — 8 steps
  // ═══════════════════════════════════════════════════════════════════════
  "masonry.step_01_fm": {
    que: "Convertimos la resistencia a compresión del bloque f'm a kg/cm² y la ajustamos a la resistencia del muro completo (típicamente 75% del bloque por las juntas de mortero).",
    porque: "El bloque individual es más fuerte que el muro completo: las juntas de mortero son el eslabón débil. CSCR §9 castiga el f'm declarado para reflejar el comportamiento real del conjunto bloque + mortero + repello.",
    intuicion: "Bloque de 100 kg/cm² → f'm de diseño ~ 75 kg/cm². Si te dan f'm > 80, dudoso: pídele al fabricante ensayos de pila de prismas.",
  },
  "masonry.step_02_slenderness": {
    que: "Calculamos la esbeltez del muro h/t (altura sobre espesor). Determina si el muro pandea bajo carga vertical.",
    porque: "CSCR §9.5 limita h/t ≤ 25 para muros confinados. Si te pasas, el muro puede pandear lateralmente bajo el peso de la losa de techo, especialmente bajo viento o sismo. Es una limitación geométrica que no se compensa con más acero.",
    intuicion: "Muro de 2.5 m con bloque de 15: h/t = 16.7 ✓. Si el muro es de 4 m, hay que pasar a bloque de 20 cm o agregar solera intermedia.",
  },
  "masonry.step_03_Vm": {
    que: "Calculamos la resistencia a cortante admisible del muro: Vm = 0.5·√f'm·t·L (en kg). Es el cortante sísmico que el muro puede tomar.",
    porque: "CSCR §9.6 da esta fórmula simplificada para muros confinados de mampostería. Considera la resistencia diagonal del panel asumiendo confinamiento adecuado en columnas y soleras. Es la verificación clave para resistencia sísmica.",
    intuicion: "Muro de 4 m con bloque de 15 y f'm=75: Vm ≈ 25 ton. Suficiente para casa de un piso típica. Si necesitas más, agrega muros o pasa a concreto reforzado.",
  },
  "masonry.step_04_phiVm": {
    que: "Aplicamos el factor de reducción: φVm = 0.6·Vm. Es la capacidad de diseño definitiva contra el cortante sísmico requerido.",
    porque: "CSCR §9 castiga la mampostería con φ = 0.6 (vs 0.75 del concreto) por la mayor variabilidad del material y la dependencia de la mano de obra. El asentamiento de bloques y la calidad del mortero varían mucho entre constructores.",
    intuicion: "El φ bajo de mampostería es el 'castigo' por incertidumbre. Por eso muros reforzados de concreto pueden tener menos área pero más capacidad.",
  },
  "masonry.step_05_fa": {
    que: "Calculamos el esfuerzo axial fa = Pu / (t·L). Es la compresión que la losa de techo (y pisos superiores) generan sobre el muro.",
    porque: "Mampostería confinada admite fa ≤ 0.20·f'm (CSCR §9.4). Por encima del 20%, el muro pierde su comportamiento dúctil y comienza a fallar por aplastamiento. Es por eso que muros de mampostería NO pueden cargar muchos pisos.",
    intuicion: "Casa de un piso: fa ≈ 1-2 kg/cm² (sobrado). Casa de dos pisos: fa ≈ 4-6 kg/cm² (ya importa). Tres pisos: ya casi no se puede en mampostería.",
  },
  "masonry.step_06_s_conf": {
    que: "Calculamos la separación máxima entre columnas de confinamiento: s ≤ min(4 m, 1.5·H). Las columnas confinan el panel de mampostería.",
    porque: "CSCR §9.3 manda columnas verticales en esquinas, intersecciones, bordes de aberturas y a distancia máxima s. Sin estos confinamientos, el panel se comporta frágilmente: una grieta diagonal lo parte irremediablemente.",
    intuicion: "Una casa típica tiene columnas en las 4 esquinas + en los lados de las puertas + cada 4 m máximo en muros largos. Es lo que da el comportamiento 'cajón' a la vivienda.",
  },
  "masonry.step_07_horiz": {
    que: "Calculamos el refuerzo horizontal (escalerillas o solera intermedia) requerido en zona sísmica.",
    porque: "CSCR §9.3 exige refuerzo horizontal cada 60 cm en zonas sísmicas 3 y 4 (todo Costa Rica). Sin este refuerzo, las grietas horizontales por sismo se propagan libremente. Las escalerillas (Ø1/4 cada 2 hileras) son lo más común.",
    intuicion: "En Costa Rica TODO muro confinado lleva escalerillas. Es barato y obligatorio. No es opcional.",
  },
  "masonry.step_08_intermediate": {
    que: "Verificamos si se requiere solera intermedia (viga horizontal de concreto a media altura) cuando H > 3.5 m.",
    porque: "CSCR §9.3 manda solera intermedia para muros altos para reducir la esbeltez efectiva y dividir el panel en dos sub-paneles más rígidos. Sin ella, los muros altos pandean lateralmente bajo sismo o viento.",
    intuicion: "Muros de salones, comedores con techo a dos aguas, fachadas con bocina: si H > 3.5 m, automática solera intermedia. Para casas normales de 2.5 m no aplica.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 13. BEAM-COLUMN JOINT (joint.*) — 8 steps
  // ═══════════════════════════════════════════════════════════════════════
  "joint.step_01_scwb": {
    que: "Verificamos el criterio columna-fuerte/viga-débil: ΣMnc ≥ 1.2·ΣMnb. La capacidad a momento de las columnas en el nudo debe ser al menos 20% mayor que la de las vigas.",
    porque: "ACI §18.7.3.2 exige que las rótulas plásticas se formen en las vigas, NO en las columnas. Una rótula en columna puede colapsar varios pisos a la vez. Por eso 'columna fuerte, viga débil' es el primer mandamiento del diseño sismorresistente.",
    intuicion: "Si fallas este check, agranda las columnas o reduce el acero de las vigas. NUNCA fortalezcas más las vigas — eso empeora el problema.",
  },
  "joint.step_02_overstrength": {
    que: "Calculamos el momento probable Mpr = 1.25·As·fy·(d - a/2). Es la capacidad real esperada de la viga considerando que fy supera el nominal.",
    porque: "El acero real fluyendo es ~25% más resistente que el fy nominal (la curva real tiene endurecimiento por deformación). ACI §18.7.6.1 manda diseñar el nudo para esta sobrerresistencia porque es lo que realmente llegará en sismo severo.",
    intuicion: "El 1.25 es el 'factor de honestidad': el acero te garantiza 4200, pero te entrega 5250 cuando se exige al máximo. El nudo tiene que aguantar esto.",
  },
  "joint.step_03_Vj": {
    que: "Calculamos el cortante horizontal de diseño en el nudo: Vj = (As+ + As-)·1.25·fy - Vcol. Es la fuerza neta que pasa por el nudo en un ciclo sísmico.",
    porque: "Durante un ciclo sísmico, una viga tracciona arriba mientras la otra comprime arriba. La fuerza neta cruza horizontalmente el nudo y debe ser absorbida por el concreto + estribos del nudo. Es la falla más peligrosa de un pórtico sismorresistente.",
    intuicion: "Nudos mal diseñados explotan en sismos: el concreto se desprende como cáscara de huevo. Es la falla que más vidas cobra en edificios de los años 70.",
  },
  "joint.step_04_bj": {
    que: "Calculamos el ancho efectivo del nudo bj = min(b_viga + h_col, b_viga + 2·x), donde x es la distancia del eje de viga al borde de columna.",
    porque: "El nudo no usa todo el ancho de la columna — solo la zona en la 'sombra' de la viga. ACI §18.8.4.3 define bj para que la fórmula de capacidad refleje el área efectiva donde realmente se transfiere el cortante.",
    intuicion: "Si la viga es estrecha (25 cm) en una columna ancha (40 cm), bj ≈ 25 cm + algo. No te ilusiones con el ancho extra de columna: no aporta al nudo.",
  },
  "joint.step_05_Aj": {
    que: "Calculamos el área efectiva del nudo Aj = bj·h_col. Es la 'cancha' donde se desarrolla el cortante del nudo.",
    porque: "Es la sección horizontal del nudo donde se calculan los esfuerzos cortantes. Funciona igual que Acv en muros: mientras más Aj, más capacidad. La altura de columna h_col es decisiva — columnas anchas hacen nudos mejores.",
    intuicion: "Columnas de 40×40 dan Aj = 1000-1600 cm² (con bj 25-40). Si tu Aj es muy chico, el nudo va a fallar antes que las vigas — rediseño total.",
  },
  "joint.step_06_gamma": {
    que: "Determinamos el factor γ según el confinamiento del nudo: γ = 5.3 (interior 4 vigas), 4.0 (lateral 3 vigas), 3.2 (esquina 2 vigas), 2.7 (techo 1 viga).",
    porque: "ACI §18.8.4.1 reconoce que un nudo confinado por vigas en todas las caras es mucho más resistente que un nudo de esquina. Las vigas confinan el concreto del nudo. La fórmula refleja este efecto geométrico.",
    intuicion: "Los nudos de esquina y de techo son los peores: poco confinamiento y mucha demanda. Por eso los códigos modernos refuerzan especialmente las columnas perimetrales.",
  },
  "joint.step_07_phi_Vn": {
    que: "Calculamos la capacidad del nudo φVn = 0.85·γ·√f'c·Aj. Es la resistencia disponible al cortante horizontal del nudo.",
    porque: "ACI §18.8.4.1 da la fórmula con γ y √f'c. El concreto solo (sin estribos extra) tiene un tope que depende del confinamiento (γ) y la resistencia del concreto. Es lo que tenemos disponible — Vj debe ser menor que esto.",
    intuicion: "Si Vj > φVn, no hay forma de meter más estribos en el nudo (no caben). Las opciones son: agrandar la columna, reducir acero de viga, o ambas. NO es 'agregar más acero'.",
  },
  "joint.step_08_check": {
    que: "Verificamos Vj ≤ φVn. Es la prueba final: si pasa, el nudo aguanta el sismo previsto; si no, hay que rediseñar.",
    porque: "Es la verificación que separa un edificio sismorresistente de un edificio peligroso. La historia de los terremotos (Northridge 1994, México 1985) muestra que los nudos son donde colapsan los pórticos cuando se diseñan mal.",
    intuicion: "Diseño cómodo: Vj/φVn ≤ 0.85. Si tu razón es 0.95 estás al límite — un pequeño aumento de Mu de viga te bota. Da margen y duerme tranquilo.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 14. DIAFRAGMA (diafragma.*) — 10 steps
  // ═══════════════════════════════════════════════════════════════════════
  "diafragma.step_01_Vu": {
    que: "Calculamos el cortante último que el diafragma debe transmitir desde la masa del piso hasta los muros/marcos verticales.",
    porque: "El diafragma (losa de entrepiso) actúa como una 'viga horizontal' enorme. Recoge la inercia sísmica de cada piso y la reparte entre los elementos verticales (muros de corte, pórticos). ACI §12.5 trata el diafragma como elemento estructural.",
    intuicion: "Sin un buen diafragma, cada muro lateral trabaja por su cuenta y el edificio se 'desbarata' en planta. El diafragma es el 'pegamento' que mantiene unidos los pisos.",
  },
  "diafragma.step_02_Mu": {
    que: "Calculamos el momento del diafragma trabajando como viga horizontal entre apoyos (muros laterales).",
    porque: "El diafragma se modela como viga simplemente apoyada con carga distribuida (la inercia sísmica del piso). El momento es máximo al centro y manda el diseño de los chords (cordones de borde).",
    intuicion: "Mu del diafragma puede ser inmenso en edificios grandes: las inercias sísmicas se acumulan. Por eso los edificios con planta muy alargada (L/B > 3) sufren más.",
  },
  "diafragma.step_03_chord": {
    que: "Calculamos la fuerza de tracción/compresión en los cordones de borde del diafragma: T = Mu / d_diafragma.",
    porque: "El diafragma es una viga: el momento se descompone en par de fuerzas (T y C) en los bordes superior e inferior (cordones). Estos cordones son típicamente las vigas perimetrales del piso, reforzadas con acero adicional.",
    intuicion: "Imagina la planta del piso como una viga horizontal: arriba (norte) la tracción, abajo (sur) la compresión. Los chords son los 'rails' que llevan estas fuerzas.",
  },
  "diafragma.step_04_As_chord": {
    que: "Calculamos el acero del cordón: As = T / (φ·fy). Es acero adicional en las vigas perimetrales que actúan como chords.",
    porque: "La viga perimetral lleva su propio momento (gravitatorio) más la tracción del chord (sísmico). ACI §12.5.2 manda diseñar el chord para esta combinación. Casi siempre son barras superiores adicionales en la viga perimetral.",
    intuicion: "Puede que tu viga perimetral 'normal' lleve 4 Ø1/2 y el chord exija 6 Ø1/2. Las 2 barras extras son explícitamente para el diafragma.",
  },
  "diafragma.step_05_Acv": {
    que: "Calculamos el área de cortante del diafragma Acv = h_losa · L_lateral. Es la sección por donde pasa el cortante sísmico.",
    porque: "Igual concepto que en muros de corte: Acv es la 'cancha' del cortante. El diafragma trabaja igual que un muro acostado. Mientras más espesor de losa y más ancho, más capacidad.",
    intuicion: "Losa de 12 cm × ancho de 8 m: Acv = 9600 cm². Si necesitas más capacidad de cortante, la única forma es engrosar la losa — agrandar el ancho rara vez es opción.",
  },
  "diafragma.step_06_vu": {
    que: "Calculamos el esfuerzo cortante unitario en el diafragma: vu = Vu / Acv.",
    porque: "Es la 'presión' cortante. Se compara con la capacidad del concreto (φ·2·√f'c en psi). Si el cortante unitario es muy alto, hay que reforzar el diafragma o engrosar la losa.",
    intuicion: "Losas de entrepiso típicas rara vez fallan a cortante de diafragma. Cuando fallan suele ser por discontinuidades en planta (huecos grandes, escaleras) — no por el cortante puro.",
  },
  "diafragma.step_07_phi_vn": {
    que: "Calculamos la capacidad nominal a cortante φvn = φ·(2·√f'c + ρ·fy)·Acv. Suma concreto + acero distribuido.",
    porque: "ACI §12.5.3.4 da la capacidad. El concreto aporta el grueso. El acero del piso (la malla común de la losa) cuenta como ρ. La verificación es vu ≤ φvn — si no pasa, el diafragma tiene que reforzarse.",
    intuicion: "Casi siempre passes con la malla mínima de losa (ρ ≈ 0.002). El problema aparece en losas con grandes huecos o en transiciones de piso.",
  },
  "diafragma.step_08_collector": {
    que: "Calculamos la fuerza del colector: es el elemento horizontal que 'recoge' el cortante de zonas distantes y lo conduce hasta los muros de corte.",
    porque: "Cuando los muros de corte no llegan hasta el borde del diafragma, hace falta una viga 'colectora' que transmita el cortante desde el resto del piso hasta el muro. ACI §12.5.4 trata el diseño de colectores específicamente.",
    intuicion: "Imagina un río que va a un único desagüe: los colectores son los caños que llevan el agua de la planta entera hasta el desagüe. Sin ellos, el agua se queda estancada.",
  },
  "diafragma.step_09_As_coll": {
    que: "Calculamos el acero del colector. Generalmente son barras adicionales en una viga existente, dimensionadas para la fuerza axial neta del colector.",
    porque: "El colector trabaja a tracción/compresión axial (como el chord, pero en dirección perpendicular). El acero adicional asegura que pueda 'conducir' la fuerza desde la zona alejada del muro hasta el muro mismo.",
    intuicion: "Si tu muro de corte va a la mitad del edificio (no al borde), prepárate para meter colectores generosos. Es una de las razones por las que conviene poner muros perimetrales: no necesitan colectores.",
  },
  "diafragma.step_10_temp": {
    que: "Verificamos que el acero por temperatura del diafragma (la malla común) cumple ρmin = 0.0018·b·h.",
    porque: "Independientemente de los chords y colectores, todo el diafragma debe tener al menos la cuantía mínima por temperatura para controlar agrietamiento y servir de armadura distribuida que ayude al cortante.",
    intuicion: "Para losa de 12 cm: ρmin pide ~2.2 cm²/m. Esto se cubre con la malla normal #3 @ 20 cm. Siempre verifica que no se haya recortado la malla 'porque sobra'.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 15. ESBELTEZ COLUMNA (esbeltez.*) — 11 steps
  // ═══════════════════════════════════════════════════════════════════════
  "esbeltez.step_01_r": {
    que: "Calculamos el radio de giro r de la sección. Para rectangular r ≈ 0.30·h; para circular r = 0.25·D.",
    porque: "r es una propiedad geométrica que mide qué tanto se resiste la sección a doblarse. Mientras más grande r, más estable es la columna. ACI §6.2.5.1 da las aproximaciones que aplican en la mayoría de columnas.",
    intuicion: "Para columna de 30×40 cm con flexión en dirección 40: r ≈ 12 cm. La columna 'parece' más estable en la dirección larga, y r lo confirma matemáticamente.",
  },
  "esbeltez.step_02_klu_r": {
    que: "Calculamos la relación de esbeltez kl/r = k·L_libre·100/r (con r en cm). Es la medida adimensional de qué tan esbelta es la columna.",
    porque: "Es la 'esbeltez efectiva'. k depende del arrostramiento (1.0 si está braced, hasta 2.0 si está en cantilever). Mientras mayor kl/r, más probable que la columna pandee bajo carga axial.",
    intuicion: "kl/r típico en vivienda: 15-30. Por encima de 100, ACI §6.2.5 obliga a análisis no lineal (P-Δ). Por debajo de 22, la columna es 'corta' y se ignora esbeltez.",
  },
  "esbeltez.step_03_M1_M2": {
    que: "Calculamos la relación M1/M2 entre los momentos de los extremos de la columna, donde |M2| ≥ |M1|.",
    porque: "ACI §6.6.4.5.3 distingue curvatura simple (M1/M2 > 0) de doble curvatura (M1/M2 < 0). La doble curvatura es menos crítica porque la columna se 'enderezaría' al pandear. El signo cambia Cm dramaticamente.",
    intuicion: "Si M1 y M2 tienen el mismo signo (simple), la columna se arquea como un arco. Si tienen signos opuestos (doble), se ondula como una S. La S es más estable que el arco.",
  },
  "esbeltez.step_04_classify": {
    que: "Clasificamos la columna como CORTA (no requiere magnificación de momento) o ESBELTA (requiere magnificación).",
    porque: "ACI §6.2.5 define el límite: para braced, klu/r ≤ 34 - 12·M1/M2 ≤ 40; para unbraced, klu/r ≤ 22. Si supera, hay que magnificar el momento por efectos P-Δ usando el método aproximado o un análisis no lineal completo.",
    intuicion: "El 90% de columnas de vivienda son cortas. Si tu columna es esbelta, probablemente está muy alta (>4 m) o muy delgada para la altura. Considera engrosar antes de magnificar.",
  },
  "esbeltez.step_05_Ec": {
    que: "Calculamos el módulo elástico del concreto: Ec = 15,100·√f'c (kg/cm²) — la rigidez intrínseca del material.",
    porque: "Ec es necesario para calcular EI y luego Pc (carga crítica de Euler). Aunque el concreto fluye con el tiempo (creep), Ec se usa como referencia y se corrige luego con factores.",
    intuicion: "Para f'c = 210: Ec ≈ 218,800 kg/cm². Mientras más alto f'c, más rígido el concreto y menos esbeltez efectiva — los concretos de 280 y 350 ganan en columnas esbeltas.",
  },
  "esbeltez.step_06_Ig": {
    que: "Calculamos la inercia bruta de la sección: rectangular Ig = b·h³/12; circular Ig = π·D⁴/64.",
    porque: "Ig es la 'resistencia geométrica al pandeo'. Es la base del cálculo EI que entra en Pc. Como la inercia depende de la dimensión a la potencia 3 o 4, agrandar la sección es muy eficiente contra pandeo.",
    intuicion: "Doblar h de 30 a 40 cm en una columna 25×h: Ig pasa de 56,250 a 133,333 cm⁴ — más del doble. Por eso 'engrosar' es la cura más eficaz para esbeltez.",
  },
  "esbeltez.step_07_EI": {
    que: "Calculamos la rigidez reducida EI = 0.4·Ec·Ig / (1 + βdns). El factor 0.4 castiga por fisuración; βdns por carga sostenida.",
    porque: "ACI §6.6.4.4.4 reconoce que el concreto fisurado es mucho menos rígido que el bruto (0.4 captura esto) y que el creep bajo carga muerta reduce más la rigidez efectiva (βdns). Es lo que realmente trabaja en servicio.",
    intuicion: "EI 'real' ≈ 30-40% del EI bruto teórico. Por eso las columnas esbeltas pandean mucho antes de lo que predicen las fórmulas elásticas de Euler.",
  },
  "esbeltez.step_08_Pc": {
    que: "Calculamos la carga crítica de Euler: Pc = π²·EI / (k·lu)². Es la carga axial máxima antes del pandeo elástico.",
    porque: "Pc es el 'techo absoluto' de la columna. La fórmula es la clásica de Euler (1744) adaptada con EI reducido por fisuración y creep. Si la carga real Pu se acerca a Pc, la columna está al borde del pandeo.",
    intuicion: "Para columna 30×40 de 3 m: Pc ≈ 300-400 ton. Si tu Pu real es 100 ton, vas cómodo. Si es 200 ton, ya empieza a importar la magnificación.",
  },
  "esbeltez.step_09_Cm": {
    que: "Calculamos el factor de modificación Cm: para braced Cm = 0.6 + 0.4·M1/M2 ≥ 0.4; para unbraced Cm = 1.0.",
    porque: "Cm reduce la magnificación cuando los momentos en los extremos son favorables (doble curvatura). ACI §6.6.4.5.3 reconoce que columnas en doble curvatura sufren menos amplificación porque la deformada es naturalmente más estable.",
    intuicion: "Si tu columna tiene momentos iguales en ambos extremos (simple), Cm = 1.0 (máximo castigo). Si tiene momentos opuestos (doble curvatura), Cm puede bajar a 0.4 — gran alivio.",
  },
  "esbeltez.step_10_delta": {
    que: "Calculamos el factor de magnificación δns = Cm / (1 - Pu/(0.75·Pc)) ≥ 1.0. Es el aumento del momento por efecto P-Δ.",
    porque: "Cuando la columna se deforma, el axial multiplicado por la deformada genera momentos secundarios. δns captura este efecto: si Pu se acerca al 75% de Pc, δns explota (divide por 0). El 0.75 es factor de seguridad de ACI §6.6.4.5.",
    intuicion: "Si δns sale 1.2 estás cómodo. Si sale 2.0 estás al límite. Si sale > 3.0 o negativo: rediseño total, la columna pandea casi seguro.",
  },
  "esbeltez.step_11_Mc": {
    que: "Calculamos el momento magnificado de diseño: Mc = δns·M2 (si columna esbelta) o Mc = M2 (si columna corta).",
    porque: "Es el momento real que usaremos para diseñar el acero longitudinal de la columna. Si la columna es corta, no hay magnificación. Si es esbelta, el momento de diseño es mayor que el calculado en análisis lineal.",
    intuicion: "La magnificación puede convertir una columna 'fácil' (Mu=10 ton·m) en una crítica (Mc=18 ton·m). Por eso la esbeltez debe verificarse SIEMPRE, no solo a ojo.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 16. PUNZONAMIENTO + MOMENTO (punz_mom.*) — 13 steps
  // ═══════════════════════════════════════════════════════════════════════
  "punz_mom.step_01_b1_b2": {
    que: "Calculamos las dimensiones del perímetro crítico de punzonamiento: b1 = c1 + d y b2 = c2 + d, donde c1, c2 son las dimensiones de la columna y d el peralte efectivo.",
    porque: "ACI §22.6.4.1 define el perímetro crítico a d/2 de las caras de la columna. b1 y b2 son los lados de ese rectángulo. Es el contorno donde el punzonamiento intenta 'cortar' un cono invertido a través de la losa.",
    intuicion: "Para columna 30×30 sobre losa con d=20 cm: b1 = b2 = 50 cm. El perímetro crítico es 30 cm más grande que la columna en cada lado.",
  },
  "punz_mom.step_02_bo": {
    que: "Calculamos el perímetro crítico total bo: interior = 2(b1+b2), borde = 2·b1+b2, esquina = b1+b2.",
    porque: "ACI §22.6.4.1 ajusta bo según la posición de la columna. Una columna de esquina tiene mucho menos perímetro disponible (la mitad), por eso es la más crítica para punzonamiento. Una interior tiene el perímetro completo.",
    intuicion: "Columna interior: bo ≈ 200 cm (mucha 'pared' para resistir). Columna esquina: bo ≈ 100 cm (la mitad). Por eso los punzonamientos fallan primero en esquinas.",
  },
  "punz_mom.step_03_gamma_f": {
    que: "Calculamos la fracción γf del momento que se transfiere por flexión: γf = 1/(1 + (2/3)·√(b1/b2)).",
    porque: "ACI §8.4.2.3.2 reconoce que del momento total en la columna, una parte se transfiere por flexión (γf·M, a través del acero superior de la losa) y otra por excentricidad cortante (γv·M). γf depende de la relación de aspecto del perímetro.",
    intuicion: "Para columna cuadrada (b1 = b2): γf ≈ 0.60. Es decir, 60% del momento va por flexión (en el acero de la losa) y 40% por cortante excéntrico.",
  },
  "punz_mom.step_04_gamma_v": {
    que: "Calculamos la fracción γv = 1 - γf del momento que se transfiere por excentricidad cortante.",
    porque: "Es la complementaria de γf. Esta fracción del momento genera esfuerzos cortantes excéntricos sobre el perímetro bo, que se suman al cortante axial. Para columna cuadrada γv ≈ 0.40 — significativo.",
    intuicion: "La parte γv·Mu es la que 'mata' el punzonamiento: el momento desbalanceado se traduce en cortante adicional concentrado en un lado del perímetro.",
  },
  "punz_mom.step_05_Jc": {
    que: "Calculamos el momento polar Jc del perímetro crítico — una propiedad geométrica análoga al momento de inercia, pero para cortante en torsión.",
    porque: "Jc entra en la fórmula del esfuerzo cortante por momento: vu,M = γv·Mu·c_AB / Jc. Es la 'rigidez al torque' del perímetro crítico. ACI R8.4.4.2.3 da la fórmula para perímetros rectangulares.",
    intuicion: "Mientras más grande Jc, menor es el cortante por momento. Por eso conviene tener perímetros más amplios (peralte d generoso) — Jc crece rápidamente con d.",
  },
  "punz_mom.step_06_c_AB": {
    que: "Calculamos la distancia c_AB = b1/2 desde el centroide del perímetro crítico al borde más alejado.",
    porque: "c_AB es el 'brazo' del cortante por momento, análogo al c en σ = M·c/I de vigas. Es donde el cortante combinado vu,axial + vu,M alcanza su máximo y donde se verifica la falla.",
    intuicion: "El cortante excéntrico no es uniforme: máximo en un borde, mínimo en el opuesto. c_AB marca dónde está el máximo.",
  },
  "punz_mom.step_07_vu_axial": {
    que: "Calculamos el esfuerzo cortante por carga axial pura: vu,axial = Vu·1000 / (bo·d) en kg/cm².",
    porque: "Es la primera componente del esfuerzo combinado, asumiendo que Vu se reparte uniformemente sobre el perímetro crítico. Es el caso simple sin momento — solo se da en columnas interiores con cargas perfectamente centradas.",
    intuicion: "vu,axial típico: 5-8 kg/cm² para edificios residenciales. Si te sale > 10, ya estás en zona de peligro — agrega capiteles o stud rails.",
  },
  "punz_mom.step_08_vu_moment": {
    que: "Calculamos el esfuerzo cortante por momento desbalanceado: vu,M = γv·Mu·c_AB / Jc.",
    porque: "Es la segunda componente. El momento desbalanceado (típico en columnas de borde o cuando hay carga lateral) genera cortante adicional concentrado en un lado. ACI §8.4.4.2 manda sumar este efecto al cortante axial.",
    intuicion: "En columnas exteriores con momento sísmico, vu,M puede ser TAN grande como vu,axial. Por eso las columnas perimetrales son más propensas a fallar por punzonamiento que las interiores.",
  },
  "punz_mom.step_09_vu_total": {
    que: "Sumamos: vu = vu,axial + vu,M. Es el esfuerzo cortante combinado en el punto más crítico del perímetro.",
    porque: "ACI §8.4.4.2 manda verificar el cortante combinado, NO cada componente por separado. La columna interior con momento es la combinación más común y peligrosa.",
    intuicion: "Si vu,axial = 6 y vu,M = 4, vu = 10 kg/cm². Compáralo con φvc (típico 8-10): muchas veces falla por la combinación, no por carga axial sola.",
  },
  "punz_mom.step_10_beta": {
    que: "Calculamos la relación de aspecto β = c_largo / c_corto de la columna.",
    porque: "Si β > 2 (columna muy alargada), el perímetro crítico se vuelve ineficiente: el cortante se concentra en los lados cortos. ACI §22.6.5.2 castiga la capacidad con la fórmula (2 + 4/β)·√f'c que reduce vc cuando β es grande.",
    intuicion: "Columnas muy alargadas (β > 2) son malas para punzonamiento. Si tienes una columna 30×60, considera convertirla en muro corto o engrosar la losa significativamente.",
  },
  "punz_mom.step_11_vc": {
    que: "Calculamos la capacidad nominal a punzonamiento vc como el mínimo de tres fórmulas ACI §22.6.5.2: tope (4√f'c psi), β (2+4/β), αs·d/bo.",
    porque: "ACI da tres modos posibles de falla. La capacidad real es el mínimo: a veces falla porque la columna es muy alargada (β alto), a veces porque d/bo es chico, a veces simplemente por tope. Hay que verificar las tres.",
    intuicion: "El mínimo casi siempre es el primero (4√f'c) excepto en columnas raras. Pero si te aparece el segundo o tercero, sabes que la geometría está rara y conviene revisar.",
  },
  "punz_mom.step_12_phi_vc": {
    que: "Aplicamos el factor de reducción: φvc = 0.75·vc. Es la capacidad final de diseño a punzonamiento.",
    porque: "ACI §21.2.1 castiga el cortante con φ = 0.75 por la naturaleza frágil de la falla (sin aviso previo). El concreto no avisa antes de punzonar — por eso se reduce más que la flexión.",
    intuicion: "Capacidad típica: φvc ≈ 7-9 kg/cm² para f'c = 210. Es el techo absoluto sin reforzar el punzonamiento. Si lo necesitas mayor, instala stud rails.",
  },
  "punz_mom.step_13_check": {
    que: "Verificamos vu ≤ φvc. Es la prueba final: si pasa, la losa no se punza por la columna; si no, hay que reforzar.",
    porque: "Es la verificación crítica. Si falla: (a) instala stud rails (refuerzo a punzonamiento), (b) agrega capiteles o ábacos (engrosamiento local), o (c) engrosa toda la losa. NO confíes en 'que aguante' — la falla es frágil y catastrófica.",
    intuicion: "Diseño cómodo: vu/φvc ≤ 0.85. Si te queda > 0.95 hay que actuar. Los stud rails son la solución más eficiente: caros pero efectivos, evitan engrosar la losa completa.",
  },
};

/**
 * Returns the narrative for a given step id, or null if no narrative is
 * registered. The ModoAprendizaje block uses this lookup to decide whether
 * to render the rich narrative or fall back to the generic placeholder.
 */
export function getStepNarrative(stepId: string | undefined): StepNarrative | null {
  if (!stepId) return null;
  return STEP_NARRATIVES[stepId] ?? null;
}
