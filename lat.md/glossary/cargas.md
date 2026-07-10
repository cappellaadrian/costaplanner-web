# Cargas

Variables que representan la demanda sobre el elemento estructural: momentos, cortantes, axiales, torsiones, y fuerzas sísmicas factorizadas.

Las cargas mayoradas se comparan contra capacidades reducidas por φ. Ver [[lat.md\glossary\factores-de-resistencia#Factores de resistencia#phi]].

Fuente: [[src/lib/glossary.ts]].

## Mu

**Símbolo**: Mu — **Nombre completo**: Momento último — **Unidad**: ton·m — **Referencia**: ACI 318-14 §5.3

Cuánto se quiere doblar la viga por las cargas, con los factores de seguridad ya aplicados (1.2·CP + 1.6·CV). Es la demanda contra la que se diseña.

**Valor típico**: 3-15 ton·m en vigas residenciales; 15-40 ton·m en vigas de edificios pequeños.

**Por qué importa**: Es la "demanda" del análisis estructural. Se compara contra φMn (capacidad) para verificar.

**Ver también**: [[lat.md\glossary\cargas#Cargas#Mn]], [[lat.md\glossary\factores-de-resistencia#Factores de resistencia#phi]], [[lat.md\glossary\cargas#Cargas#Mu_tonm]].

## Mu_tonm

**Nombre completo**: Momento último (ton·m) — **Unidad**: ton·m

Lo mismo que Mu, pero medido en toneladas-metro.

**Ver también**: [[lat.md\glossary\cargas#Cargas#Mu]].

## Mn

**Símbolo**: Mn — **Nombre completo**: Momento nominal — **Unidad**: ton·m — **Referencia**: ACI 318-14 §22.3

Cuánto puede aguantar la viga antes de fallar, calculado solo con las propiedades del material y la geometría, sin factor de seguridad. Es la capacidad "bruta".

**Valor típico**: Suele ser un 15-30% mayor que Mu para que φMn ≥ Mu.

**Por qué importa**: Multiplicado por φ da la capacidad de diseño. Si φMn < Mu, hay que aumentar acero o sección.

**Ver también**: [[lat.md\glossary\cargas#Cargas#Mu]], [[lat.md\glossary\factores-de-resistencia#Factores de resistencia#phi]].

## Vu

**Símbolo**: Vu — **Nombre completo**: Cortante último — **Unidad**: ton — **Referencia**: ACI 318-14 §22.5

La fuerza horizontal factorizada que intenta cortar la viga en diagonal cerca de los apoyos. Si no hay estribos suficientes, falla de golpe sin aviso.

**Valor típico**: 5-25 ton en vigas residenciales.

**Por qué importa**: El cortante en concreto produce fallas frágiles (sin aviso). Por eso siempre se diseña con sobrecapacidad.

**Ver también**: [[lat.md\glossary\cargas#Cargas#Vn]], [[lat.md\glossary\factores-de-resistencia#Factores de resistencia#phi_v]].

## Vn

**Símbolo**: Vn — **Nombre completo**: Cortante nominal — **Unidad**: ton — **Referencia**: ACI 318-14 §22.5

La capacidad total a cortante de la sección, suma de lo que aporta el concreto (Vc) más los estribos (Vs).

**Ver también**: [[lat.md\glossary\cargas#Cargas#Vu]], [[lat.md\glossary\factores-de-resistencia#Factores de resistencia#phi_v]].

## Pu

**Símbolo**: Pu — **Nombre completo**: Carga axial última — **Unidad**: ton — **Referencia**: ACI 318-14 §22.4

El peso vertical factorizado que llega a una columna o muro desde lo que está arriba (losas, vigas, otras columnas).

**Valor típico**: Columna de casa de 2 pisos: 50-150 ton.

**Por qué importa**: Define cuánto acero longitudinal necesita la columna y si hay riesgo de pandeo.

**Ver también**: [[lat.md\glossary\cargas#Cargas#Pn]], [[lat.md\glossary\factores-de-resistencia#Factores de resistencia#phi_c]].

## Pn

**Símbolo**: Pn — **Nombre completo**: Capacidad axial nominal — **Unidad**: ton — **Referencia**: ACI 318-14 §22.4

Cuánta carga vertical puede aguantar la columna antes de aplastarse, sin factor de seguridad.

**Ver también**: [[lat.md\glossary\cargas#Cargas#Pu]], [[lat.md\glossary\factores-de-resistencia#Factores de resistencia#phi_c]].

## Tu

**Símbolo**: Tu — **Nombre completo**: Torsión última — **Unidad**: ton·m — **Referencia**: ACI 318-14 §22.7

El momento de torsión factorizado que retuerce la viga alrededor de su propio eje longitudinal, como si se tratara de exprimir un trapo.

**Por qué importa**: Aparece en vigas perimetrales, dinteles excéntricos y escaleras helicoidales. Genera grietas en espiral.

## wu

**Símbolo**: wu — **Nombre completo**: Carga distribuida última — **Unidad**: ton/m o kPa

La carga repartida por metro lineal de viga (o m² de losa), ya factorizada. Es como el "peso por metro" que tiene que cargar el elemento.

**Valor típico**: Viga residencial: 1.5-3.5 ton/m. Losa de vivienda: 6-10 kPa.

**Ver también**: [[lat.md\glossary\cargas#Cargas#Mu]], [[lat.md\glossary\cargas#Cargas#Vu]].

## Fpx

**Símbolo**: Fpx — **Nombre completo**: Fuerza sísmica en el diafragma — **Unidad**: ton — **Referencia**: CSCR-10 §10.3 / ASCE 7-16 §12.10

La fuerza horizontal de sismo que tiene que repartir la losa de un piso a los muros y columnas. Cuanto más arriba en el edificio, más grande.

**Por qué importa**: Define el refuerzo de tracción/compresión que la losa necesita para no rasgarse durante un sismo.
