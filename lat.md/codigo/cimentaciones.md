# Cimentaciones

Referencia: **ACI 318 §13 + CSCR §17.5** — zapatas aisladas, vigas de amarre, y conexión columna-cimiento.

Calculadoras: `src/app/studio/isolated-footing/`, `src/app/studio/tie-beam/` (ver [[src/lib/isolated-footing-live.ts]]).

Ver también: [[lat.md\codigo\columnas#Columnas]], [[lat.md\glossary\geotecnia#Geotecnia#qa]], [[lat.md\glossary\cargas#Cargas#Pu]].

## Zapata aislada - 6 verificaciones

Referencia: **ACI §13** — el proceso completo de diseño de una zapata cuadrada o rectangular bajo columna.

Las seis verificaciones que toda zapata aislada debe pasar:

1. **Presión del suelo**: `q_max ≤ q_adm`
2. **Cortante en una dirección** a `d` de la cara de la columna
3. **Cortante por punzonamiento** a `d/2` (perímetro `b_o`)
4. **Flexión en dirección B** (lado corto)
5. **Flexión en dirección L** (lado largo)
6. **Conexión columna-zapata**: aplastamiento más anclaje del acero longitudinal de la columna

Si la zapata falla por punzonamiento, normalmente se aumenta el peralte antes que agregar refuerzo transversal (no es práctico construir estribos en una zapata).

Variables: [[lat.md\glossary\geotecnia#Geotecnia#qa]], [[lat.md\glossary\geotecnia#Geotecnia#qmax]], [[lat.md\glossary\geometria#Geometria#d]].

## Viga de amarre obligatoria

Referencia: **CSCR §18.12** — obligatoria en zonas sísmicas III-IV.

En zonas III-IV, TODA zapata debe conectarse a las demás con vigas de amarre que resistan tracción y compresión sísmica entre cimientos. Sin esta amarre, las zapatas se desplazan diferencialmente y las columnas reciben momentos parásitos.

Geometría mínima:

- `b ≥ 20 cm`
- `h ≥ 40 cm`
- 4 barras #5 mínimo (2 superiores + 2 inferiores)
- Estribos #3 @ 20 cm en toda la longitud

La viga de amarre también funciona como puntal contra el deslizamiento sísmico relativo entre zapatas.
