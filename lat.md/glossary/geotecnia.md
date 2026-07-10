# Geotecnia

Capacidad portante del suelo, ensayos SPT con correcciones, coeficientes de empuje de Rankine, factores de seguridad para muros de contención.

Ver [[lat.md\codigo\muros#Muros#Muro de contencion en voladizo]] para la aplicación a muros de contención.

Fuente: [[src/lib/glossary.ts]].

## qa

**Símbolo**: qa — **Nombre completo**: Capacidad portante admisible del suelo — **Unidad**: kg/cm² o kPa — **Referencia**: CFIA Código de Cimentaciones

Cuánta presión aguanta el suelo bajo la zapata sin hundirse demasiado ni romperse. Es lo que dice el estudio de suelos.

**Valor típico**: 1.0-3.0 kg/cm² en CR (la mayoría 1.5-2.0).

**Por qué importa**: La presión real bajo la zapata debe ser menor que qa, sino la cimentación se hunde.

**Ver también**: [[lat.md\glossary\geotecnia#Geotecnia#qu]], [[lat.md\glossary\geotecnia#Geotecnia#FS]].

## qu

**Símbolo**: qu — **Nombre completo**: Capacidad portante última del suelo — **Unidad**: kg/cm² o kPa — **Referencia**: Terzaghi / Meyerhof

La presión a la que el suelo se rompe definitivamente bajo la zapata. Se divide entre un FS de 3 para obtener qa.

**Valor típico**: qu ≈ 3·qa.

**Ver también**: [[lat.md\glossary\geotecnia#Geotecnia#qa]], [[lat.md\glossary\geotecnia#Geotecnia#FS]].

## N60

**Símbolo**: N60 — **Nombre completo**: Número de golpes SPT corregido por energía — **Unidad**: golpes/30cm — **Referencia**: ASTM D1586

El número de golpes que se necesita para hundir el muestreador SPT 30 cm en el suelo, corregido por la energía real del martillo (60%).

**Valor típico**: N60 < 10 suelo flojo; 10-30 medio; 30-50 denso; > 50 muy denso.

**Ver también**: [[lat.md\glossary\geotecnia#Geotecnia#N1_60]], [[lat.md\glossary\geotecnia#Geotecnia#Ce]], [[lat.md\glossary\geotecnia#Geotecnia#Cn]].

## N1_60

**Símbolo**: N1_60 — **Nombre completo**: SPT corregido por energía y por sobrecarga — **Unidad**: golpes/30cm — **Referencia**: Youd et al. 2001

El N60 corregido además por la presión vertical efectiva del suelo. Permite comparar muestras tomadas a profundidades distintas.

**Valor típico**: N1_60 < 15 susceptible a licuefacción en arena saturada.

**Ver también**: [[lat.md\glossary\geotecnia#Geotecnia#N60]], [[lat.md\glossary\sismico#Sismico#CSR]], [[lat.md\glossary\sismico#Sismico#CRR]].

## phi_deg

**Símbolo**: φ° — **Nombre completo**: Ángulo de fricción interna del suelo — **Unidad**: grados

Qué tanto se traban los granos del suelo entre sí. Más alto = el suelo se sostiene mejor en pendientes. Las arenas tienen alto φ; las arcillas, bajo.

**Valor típico**: Arena suelta: 28°; arena densa: 38°; grava: 40°+; arcilla blanda: ~0°.

**Ver también**: [[lat.md\glossary\geotecnia#Geotecnia#Ka]], [[lat.md\glossary\geotecnia#Geotecnia#Kp]], [[lat.md\glossary\geotecnia#Geotecnia#c]].

## c

**Símbolo**: c — **Nombre completo**: Cohesión del suelo — **Unidad**: kPa o kg/cm²

Qué tan pegajosos están los granos del suelo entre sí, incluso sin presión que los apriete. Las arcillas tienen cohesión; las arenas no.

**Valor típico**: Arcilla blanda: 10-25 kPa; arcilla dura: 100+ kPa; arena: 0.

**Ver también**: [[lat.md\glossary\geotecnia#Geotecnia#phi_deg]].

## gamma_soil

**Símbolo**: γ_suelo — **Nombre completo**: Peso unitario del suelo — **Unidad**: kN/m³

Cuánto pesa un metro cúbico de suelo. Define la presión vertical en cada profundidad.

**Valor típico**: 16-20 kN/m³ para suelos típicos; 9-11 kN/m³ sumergido.

## k

**Símbolo**: k — **Nombre completo**: Coeficiente de balasto — **Unidad**: kN/m³ o kg/cm³ — **Referencia**: Bowles Foundation Analysis

Qué tan rígido es el suelo: cuánta presión se necesita para hundirlo 1 cm. Sirve para modelar zapatas y losas sobre suelo.

**Valor típico**: 10-50 MN/m³ para suelos competentes.

## FS

**Símbolo**: FS — **Nombre completo**: Factor de seguridad — **Unidad**: —

Cuántas veces la capacidad supera a la demanda. Si FS = 3 significa que el suelo aguanta 3 veces lo que tiene que aguantar.

**Valor típico**: FS ≥ 3 para capacidad portante; ≥ 1.5 deslizamiento; ≥ 2.0 volcamiento sísmico.

**Ver también**: [[lat.md\glossary\geotecnia#Geotecnia#qa]], [[lat.md\glossary\geotecnia#Geotecnia#qu]].

## Cn

**Símbolo**: Cn — **Nombre completo**: Corrección SPT por sobrecarga — **Unidad**: — — **Referencia**: Liao & Whitman 1986

Un multiplicador que ajusta N por la profundidad de la muestra. A más profundidad, el suelo está más confinado y N parece más alto de lo que es.

**Valor típico**: Cn = (1/σ'v)^0.5, típicamente entre 0.5 y 2.0.

**Ver también**: [[lat.md\glossary\geotecnia#Geotecnia#N60]], [[lat.md\glossary\geotecnia#Geotecnia#N1_60]].

## Ce

**Símbolo**: Ce — **Nombre completo**: Corrección SPT por energía — **Unidad**: —

Un factor que ajusta N según la eficiencia real del martillo SPT. Los martillos de seguridad transmiten ~60%; los donut ~45%.

**Valor típico**: Ce = ER/60, donde ER = % de energía teórica.

**Ver también**: [[lat.md\glossary\geotecnia#Geotecnia#N60]].

## Cr

**Símbolo**: Cr — **Nombre completo**: Corrección SPT por longitud de barra — **Unidad**: —

Un factor que ajusta N porque las barras cortas (cerca de superficie) disipan parte de la energía al rebotar.

**Valor típico**: 0.75-1.0 según longitud de varillaje.

## Cs

**Símbolo**: Cs — **Nombre completo**: Corrección SPT por tipo de muestreador — **Unidad**: —

Un factor que ajusta N si el muestreador tiene liners (cazoleta interior) o no.

**Valor típico**: 1.0 sin liners; 1.1-1.3 con liners.

## Cb

**Símbolo**: Cb — **Nombre completo**: Corrección SPT por diámetro del sondeo — **Unidad**: —

Un factor que ajusta N por el diámetro de la perforación. Sondeos muy anchos sobreestiman N.

**Valor típico**: 1.0 estándar; 1.05-1.15 para sondeos más anchos.

## Ka

**Símbolo**: Ka — **Nombre completo**: Coeficiente activo de Rankine — **Unidad**: — — **Referencia**: Rankine 1857

Qué fracción de la presión vertical del suelo se traduce en empuje horizontal contra el muro de retención.

**Valor típico**: 0.20-0.35 para suelos típicos (arena con φ = 30°-35°).

**Por qué importa**: Suelo con más fricción interna empuja menos. Por eso un relleno granular limpio es mejor que arcilla.

**Ver también**: [[lat.md\glossary\geotecnia#Geotecnia#Kp]], [[lat.md\glossary\geotecnia#Geotecnia#phi_deg]].

## Kp

**Símbolo**: Kp — **Nombre completo**: Coeficiente pasivo de Rankine — **Unidad**: — — **Referencia**: Rankine 1857

El recíproco de Ka. Representa el empuje del suelo en FRENTE del muro cuando el muro empuja contra él.

**Valor típico**: 3-4 para suelos típicos.

**Por qué importa**: El suelo de frente al muro AYUDA al muro a no deslizar, pero solo si está bien compactado y permanente.

**Ver también**: [[lat.md\glossary\geotecnia#Geotecnia#Ka]].

## E1

**Nombre completo**: Empuje activo — **Unidad**: kN/m

Fuerza horizontal total por metro lineal de muro, debida al peso del relleno detrás. Crece con H².

**Por qué importa**: Es la carga principal contra la que se diseña el muro. Actúa a H/3 desde la base.

**Ver también**: [[lat.md\glossary\geotecnia#Geotecnia#Ka]].

## E2

**Nombre completo**: Empuje por sobrecarga — **Unidad**: kN/m

Fuerza horizontal adicional cuando hay carga (tránsito, almacenaje) encima del relleno.

**Por qué importa**: Actúa uniforme en toda la altura (rectangular), centroide a H/2.

## FS_v

**Nombre completo**: Factor de seguridad al volcamiento — **Unidad**: —

Cuántas veces el momento resistente supera al momento volcador alrededor de la punta del muro.

**Valor típico**: ≥ 1.5 (estático), ≥ 2.0 (con sismo).

**Por qué importa**: Si FS_v < 1, el muro literalmente se voltea. Margen alto porque las consecuencias son catastróficas.

## FS_d

**Nombre completo**: Factor de seguridad al deslizamiento — **Unidad**: —

Cuántas veces la resistencia al deslizamiento (fricción + empuje pasivo) supera al empuje horizontal.

**Valor típico**: ≥ 1.5 (estático).

**Por qué importa**: Si FS_d < 1, el muro desliza horizontalmente. Soluciones: aumentar B, agregar diente o un puntal.

## e

**Símbolo**: e — **Nombre completo**: Excentricidad de la resultante — **Unidad**: m

Distancia entre el centro de la zapata y el punto donde efectivamente actúa la carga vertical resultante (peso + empujes).

**Valor típico**: Se desea e ≤ B/6 (distribución trapezoidal todavía positiva).

## Cm

**Nombre completo**: Coeficiente ACI para momentos en losas — **Unidad**: — — **Referencia**: ACI 318-14 §6.5.2

Un número fijo entre 1/9 y 1/16 que multiplica w·L² para obtener el momento en una losa continua, sin hacer análisis modal.

**Valor típico**: -1/16 apoyo exterior empotrado; -1/10 primer apoyo interior; +1/14 primer claro; +1/16 claros interiores.

## qmax

**Nombre completo**: Presión máxima bajo la zapata — **Unidad**: kPa o kg/cm²

La presión más alta que llega del fondo de la zapata al suelo. Ocurre en la fibra extrema cuando hay momento.

**Ver también**: [[lat.md\glossary\geotecnia#Geotecnia#qa]], [[lat.md\glossary\geotecnia#Geotecnia#e]].
