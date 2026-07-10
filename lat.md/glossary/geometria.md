# Geometria

Dimensiones y distancias usadas en el diseño estructural. Anchos, peraltes, áreas brutas, longitudes de zona confinada y de desarrollo.

Fuente: [[src/lib/glossary.ts]].

## b

**Símbolo**: b — **Nombre completo**: Ancho de la sección — **Unidad**: cm

Qué tan ancha es la viga (o columna) vista por encima. El ancho de su sección rectangular.

**Valor típico**: 25-40 cm en vigas; 25 cm mínimo en vigas dúctiles (CSCR §8.2.1).

**Por qué importa**: Más ancho = más concreto resistiendo compresión + más espacio para barras → puedes meter más acero sin amontonarlo.

**Ver también**: [[lat.md\glossary\geometria#Geometria#h]], [[lat.md\glossary\geometria#Geometria#d]].

## h

**Símbolo**: h — **Nombre completo**: Peralte total — **Unidad**: cm

Qué tan alta es la viga vista de lado. Incluye el concreto, el recubrimiento y el acero.

**Valor típico**: Vigas: h ≈ L/10 a L/12. Para luz de 5 m → h ≈ 45 cm.

**Por qué importa**: Más peralte = brazo interno mayor = más capacidad a flexión. La capacidad crece con d² (no lineal).

**Ver también**: [[lat.md\glossary\geometria#Geometria#b]], [[lat.md\glossary\geometria#Geometria#d]], [[lat.md\glossary\geometria#Geometria#L]].

## d

**Símbolo**: d — **Nombre completo**: Peralte efectivo — **Unidad**: cm

Distancia desde la cara superior comprimida hasta el centro del acero abajo. Es la altura que realmente trabaja en flexión.

**Valor típico**: d ≈ h − 5 cm para vigas con recubrimiento normal.

**Por qué importa**: Es EL parámetro de diseño. Mn crece con d² → doblar el peralte cuadruplica la capacidad a flexión.

**Ver también**: [[lat.md\glossary\geometria#Geometria#h]], [[lat.md\glossary\geometria#Geometria#recubrimiento]], [[lat.md\glossary\geometria#Geometria#dt]].

## dt

**Símbolo**: dt — **Nombre completo**: Distancia a la capa extrema de acero — **Unidad**: cm — **Referencia**: ACI 318-14 §21.2.2

Distancia desde la fibra extrema a compresión hasta la barra de acero MÁS LEJANA en tracción. Usada para determinar si la falla es dúctil o frágil.

**Valor típico**: dt ≈ d cuando hay una sola capa de acero; mayor cuando hay varias capas.

**Ver también**: [[lat.md\glossary\geometria#Geometria#d]].

## r

**Símbolo**: r — **Nombre completo**: Radio de giro — **Unidad**: cm

Una medida geométrica que mide qué tan "desparramada" está la sección. Sirve para calcular si una columna larga puede pandearse.

**Valor típico**: r = h/√12 ≈ 0.289·h para sección rectangular.

**Ver también**: [[lat.md\glossary\geometria#Geometria#L]].

## recubrimiento

**Símbolo**: rec — **Nombre completo**: Recubrimiento de concreto — **Unidad**: cm — **Referencia**: ACI 318-14 §20.6

La capa de concreto que cubre las barras de acero por fuera, como la corteza de un pan. Protege el acero del fuego, la humedad y la corrosión.

**Valor típico**: 2 cm losas interiores, 4 cm vigas/columnas, 5 cm muros, 7.5 cm cimientos en contacto con suelo.

**Por qué importa**: Sin recubrimiento adecuado, el acero se corroe con la humedad y el elemento falla mucho antes de llegar a su capacidad.

## lo

**Símbolo**: lo — **Nombre completo**: Longitud de zona confinada — **Unidad**: cm — **Referencia**: ACI 318-14 §18.7.5.1

Tramo cerca de los nodos (donde la columna se junta con la viga) donde los estribos van mucho más juntos para "abrazar" el concreto en un sismo.

**Valor típico**: lo = máx(h, L/6, 45 cm) según ACI §18.7.5.1.

**Por qué importa**: En sismo, la rótula plástica se forma cerca del nodo. Allí el confinamiento extra evita que el concreto se desmorone.

**Ver también**: [[lat.md\glossary\geometria#Geometria#s_conf]], [[lat.md\glossary\geometria#Geometria#s_central]].

## ld

**Símbolo**: ld — **Nombre completo**: Longitud de desarrollo — **Unidad**: cm — **Referencia**: ACI 318-14 §25.4.2

Qué tan larga tiene que estar la barra metida en el concreto para que pueda "agarrar" su fuerza completa antes de salir. Si la dejas corta, se desliza.

**Valor típico**: 30·db a 60·db según condiciones.

**Ver también**: [[lat.md\glossary\geometria#Geometria#ldh]], [[lat.md\glossary\geometria#Geometria#db]].

## ldh

**Símbolo**: ldh — **Nombre completo**: Longitud de desarrollo del gancho a 90° — **Unidad**: cm — **Referencia**: ACI 318-14 §25.4.3

Cuánto tiene que medir la cola doblada de una barra para que el gancho aporte su capacidad total. Es más corto que ld porque el gancho ayuda.

**Valor típico**: Aproximadamente la mitad de ld para barras con gancho estándar.

**Ver también**: [[lat.md\glossary\geometria#Geometria#ld]], [[lat.md\glossary\geometria#Geometria#db]].

## s

**Símbolo**: s — **Nombre completo**: Separación de estribos / refuerzo — **Unidad**: cm — **Referencia**: ACI 318-14 §9.7.6

Cuánto espacio se deja entre dos estribos consecutivos. Más juntos = más resistencia al corte y mejor confinamiento.

**Valor típico**: 5-10 cm en zona confinada; 15 cm en zona central; máximo d/2 por corte.

**Ver también**: [[lat.md\glossary\geometria#Geometria#s_conf]], [[lat.md\glossary\geometria#Geometria#s_central]].

## s_conf

**Nombre completo**: Separación de estribos en zona confinada — **Unidad**: cm — **Referencia**: ACI 318-14 §18.7.5

El espaciamiento entre estribos dentro de la longitud lo, cerca del nodo. Mucho más cerca que en zona central.

**Valor típico**: 5-10 cm.

**Ver también**: [[lat.md\glossary\geometria#Geometria#lo]], [[lat.md\glossary\geometria#Geometria#s_central]].

## s_central

**Nombre completo**: Separación de estribos en zona central — **Unidad**: cm

El espaciamiento de estribos fuera de la zona confinada, en la mitad del tramo de columna o viga donde el confinamiento es menos crítico.

**Valor típico**: 15 cm, máximo d/2.

**Ver también**: [[lat.md\glossary\geometria#Geometria#lo]], [[lat.md\glossary\geometria#Geometria#s_conf]].

## db

**Símbolo**: db — **Nombre completo**: Diámetro de la barra — **Unidad**: cm

El grosor de la varilla de acero. Las barras se llaman por números: #3 (3/8"=0.95 cm), #4 (1/2"=1.27 cm), #5 (5/8"=1.59 cm), etc.

**Valor típico**: #3 (0.95), #4 (1.27), #5 (1.59), #6 (1.91), #8 (2.54).

**Ver también**: [[lat.md\glossary\geometria#Geometria#ld]], [[lat.md\glossary\acero#Acero#As]].

## Ag

**Símbolo**: Ag — **Nombre completo**: Área bruta de la sección — **Unidad**: cm²

El área total de la sección de concreto (b × h), sin restar el acero. Es la sección "completa" vista de frente.

**Valor típico**: Columna 30×30: Ag = 900 cm².

**Ver también**: [[lat.md\glossary\geometria#Geometria#Ach]], [[lat.md\glossary\geometria#Geometria#b]], [[lat.md\glossary\geometria#Geometria#h]].

## Ach

**Símbolo**: Ach — **Nombre completo**: Área del núcleo confinado — **Unidad**: cm² — **Referencia**: ACI 318-14 §18.7.5.3

El área del concreto QUE QUEDA DENTRO de los estribos. Es el "corazón" que está protegido por el confinamiento.

**Valor típico**: Ach ≈ (b − 2·rec)·(h − 2·rec) midiendo desde el exterior del estribo.

**Por qué importa**: Es el área que se confía bajo sismo. El cascarón externo se descascara y se pierde.

**Ver también**: [[lat.md\glossary\geometria#Geometria#Ag]], [[lat.md\glossary\acero#Acero#Ash]].

## L

**Símbolo**: L — **Nombre completo**: Luz / longitud — **Unidad**: cm o m

Distancia de apoyo a apoyo en vigas/losas, o altura libre en columnas/muros.

**Valor típico**: Vigas residenciales: 3-7 m. Columnas: 2.5-3.5 m libres.

**Ver también**: [[lat.md\glossary\geometria#Geometria#h]].

## hx

**Nombre completo**: Espaciamiento entre barras lateralmente sujetadas — **Unidad**: cm — **Referencia**: ACI 318-14 §18.7.5.2

Distancia horizontal entre dos barras longitudinales atadas por un estribo o crossie. Si es muy grande, las barras intermedias se pandean en sismo.

**Valor típico**: ≤ 35 cm en zona III-IV.

**Por qué importa**: Si hx es muy grande, las barras intermedias se pandean afuera bajo compresión cíclica y el confinamiento se pierde.
