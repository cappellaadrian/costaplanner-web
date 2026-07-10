# Losas

Referencia: **ACI 318 §7-8** — diseño de losas en una y dos direcciones.

Calculadoras: `src/app/studio/one-way-slab/`, `src/app/studio/two-way-slab/`.

Ver también: [[lat.md\codigo\vigas#Vigas]], [[lat.md\codigo\detallado#Detallado#Recubrimiento minimo]], [[lat.md\glossary\cargas#Cargas#wu]], [[lat.md\glossary\cargas#Cargas#Fpx]].

## Losa en una direccion

Referencia: **ACI §7-8 + §6.5.2**.

Cuando `L_largo / L_corto ≥ 2`, la losa actúa principalmente en la dirección corta. Se diseña por franjas de 1 m de ancho.

```
M_u = C_m · w_u · L_n²
```

donde `C_m` es el coeficiente ACI tabulado según posición:

| Posición | C_m |
|----------|-----|
| Apoyo exterior empotrado    | -1/16 |
| Primer interior (3+ luces)  | -1/10 |
| Primer claro positivo       | +1/14 |
| Claro interior positivo     | +1/16 |

Variables: [[lat.md\glossary\cargas#Cargas#wu]], [[lat.md\glossary\geotecnia#Geotecnia#Cm]].

## Losa en dos direcciones - Metodo 3

Referencia: **ACI 318-63 Method 3** — todavía vigente en muchas obras costarricenses.

Cuando `L_largo / L_corto < 2`, la losa transmite carga en ambas direcciones. Los coeficientes se toman de las tablas según la condición de borde (9 casos: empotramiento perimetral, bordes discontinuos, etc.).

Costaplanner implementa actualmente solo el **Caso 2** (un borde corto discontinuo). Otros casos se irán agregando según demanda.

## Diafragma sismico

La losa también funciona como diafragma horizontal: distribuye la fuerza sísmica del piso a los muros y columnas. La fuerza demandante por nivel es `Fpx` (ver [[lat.md\glossary\cargas#Cargas#Fpx]]).

Sin acero adecuado en el plano de la losa (típicamente acero superior continuo cruzando juntas), el diafragma se rasga durante un sismo y la estructura se desensambla.
