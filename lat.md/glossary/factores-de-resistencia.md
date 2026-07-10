# Factores de resistencia

Factores `φ` que reducen las capacidades calculadas para cubrir incertidumbres en materiales y construcción. Factores de carga `γ` que mayoran las demandas.

Fuente: [[src/lib/glossary.ts]].

## phi

**Símbolo**: φ — **Nombre completo**: Factor de reducción de resistencia — **Unidad**: — — **Referencia**: ACI 318-14 §21.2

Un castigo a la capacidad calculada para cubrir incertidumbres en materiales y construcción. La capacidad de diseño es φ·Mn.

**Valor típico**: 0.90 flexión dúctil, 0.75 corte, 0.65 columna estribada, 0.75 columna con espiral.

**Por qué importa**: Refleja qué tan crítica es una falla: 0.65 en columnas porque su falla colapsa todo el edificio.

**Ver también**: [[lat.md\glossary\factores-de-resistencia#Factores de resistencia#phi_v]], [[lat.md\glossary\factores-de-resistencia#Factores de resistencia#phi_c]].

## phi_v

**Símbolo**: φv — **Nombre completo**: Factor de reducción para cortante — **Unidad**: — — **Referencia**: ACI 318-14 §21.2.1

El castigo que se aplica a Vn. Es más bajo (0.75) que el de flexión porque la falla por cortante es frágil.

**Valor típico**: 0.75

**Ver también**: [[lat.md\glossary\factores-de-resistencia#Factores de resistencia#phi]], [[lat.md\glossary\cargas#Cargas#Vn]].

## phi_c

**Símbolo**: φc — **Nombre completo**: Factor de reducción para columna en compresión — **Unidad**: — — **Referencia**: ACI 318-14 §21.2.2

El castigo a la capacidad axial de una columna. Más estricto que en flexión porque el colapso de una columna se lleva el edificio entero.

**Valor típico**: 0.65 (estribos), 0.75 (espiral).

**Ver también**: [[lat.md\glossary\factores-de-resistencia#Factores de resistencia#phi]], [[lat.md\glossary\cargas#Cargas#Pn]].

## alpha

**Símbolo**: α — **Nombre completo**: Coeficiente α (varía por contexto) — **Unidad**: — o grados — **Referencia**: ACI 318-14 (varios)

Coeficiente que cambia según el cálculo: ángulo del estribo en corte, factor del bloque de Whitney, factor de modificación de adherencia, etc.

**Valor típico**: Depende del uso. En corte α = 90° para estribos verticales.

## gamma

**Símbolo**: γ — **Nombre completo**: Factor de carga / coeficiente γ — **Unidad**: — — **Referencia**: CSCR-10 §6.2

Factor con que se mayoran las cargas (por ejemplo 1.2 para carga permanente, 1.6 para carga viva) para llegar a las cargas últimas de diseño.

**Valor típico**: γ_CP = 1.2; γ_CV = 1.6; γ_S = 1.0 con sismo (CSCR §6.2).

**Ver también**: [[lat.md\glossary\cargas#Cargas#Mu]], [[lat.md\glossary\cargas#Cargas#Vu]], [[lat.md\glossary\cargas#Cargas#Pu]].
