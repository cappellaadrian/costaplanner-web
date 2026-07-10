# Columnas

Referencia: **CSCR §18.7 + ACI 318 §10** — diseño de columnas rectangulares y circulares, con énfasis en confinamiento sísmico.

Calculadoras: `src/app/studio/rectangular-column/`, `src/app/studio/circular-column/` (ver [[src/lib/rectangular-column-live.ts]]).

Ver también: [[lat.md\codigo\vigas#Vigas]], [[lat.md\codigo\cimentaciones#Cimentaciones#Zapata aislada - 6 verificaciones]], [[lat.md\codigo\detallado#Detallado]], [[lat.md\glossary\cargas#Cargas#Pu]], [[lat.md\glossary\factores-de-resistencia#Factores de resistencia#phi_c]].

## Diseno axial simplificado

Referencia: **ACI §22.4.2**.

Para columnas con momento bajo (excentricidad `Mu / (Pu · h/100) ≤ 0.10`), el acero longitudinal requerido se obtiene directamente:

```
A_st,req = ( P_u/φ − 0.85 · f'c · A_g ) / ( f_y − 0.85 · f'c )
```

Si la excentricidad supera 0.10, la columna requiere diagrama de interacción P-M completo (no aplica esta fórmula simplificada).

Variables: [[lat.md\glossary\cargas#Cargas#Pu]], [[lat.md\glossary\factores-de-resistencia#Factores de resistencia#phi_c]], [[lat.md\glossary\materiales#Materiales#fc]], [[lat.md\glossary\geometria#Geometria#Ag]], [[lat.md\glossary\acero#Acero#As]].

## Confinamiento sismico

Referencia: **ACI §18.7.5** — clave para evitar el colapso de columnas en zonas sísmicas III-IV.

### Longitud de zona confinada

La zona confinada `l_o` se extiende desde la cara del nodo (donde la columna se encuentra con la viga) hasta el punto donde los estribos pueden separarse más. Se toma el mayor de tres criterios:

```
l_o = max( h, L/6, 45 cm )
```

### Separacion de estribos en zona confinada

Dentro de `l_o`, los estribos se ponen muy juntos para que el núcleo de concreto quede bien abrazado. La separación máxima es el menor de cuatro criterios:

```
s_conf = min( 0.25 · dim_menor, 6 · d_b, s_o, 10 cm )
```

donde `dim_menor` es la dimensión menor de la sección y `d_b` es el diámetro de la barra longitudinal.

En zona III-IV, este confinamiento es CRÍTICO. La falla sísmica de columnas es lo que ha colapsado edificios completos en CR históricamente (Limón 1991, Cinchona 2009).

Ver [[lat.md\glossary\geometria#Geometria#lo]], [[lat.md\glossary\geometria#Geometria#s_conf]], [[lat.md\glossary\acero#Acero#Ash]].

## Cuantia longitudinal

Referencia: **ACI §10.6.1**.

- `ρ_min = 1%` de Ag
- `ρ_max = 8%` (estático), `6%` (zona III-IV)
- Mínimo **4 barras** (rectangulares), **6 barras** (circulares)

Cuantías cerca de `ρ_max` complican el armado (las barras quedan amontonadas, el vaciado del concreto es problemático). En la práctica se recomienda quedarse por debajo del 4%.

Variables: [[lat.md\glossary\acero#Acero#rho]], [[lat.md\glossary\acero#Acero#rho_min]], [[lat.md\glossary\acero#Acero#rho_max]].
