# Vigas

Referencia: **CSCR §8 + ACI 318 §9 y §18.6** — diseño de vigas de concreto reforzado, incluyendo vigas dúctiles para sistemas sismorresistentes.

Calculadora correspondiente: `src/app/studio/beam/` (ver [[src/lib/beam-flexure-live.ts]]).

Ver también: [[lat.md\codigo\columnas#Columnas]], [[lat.md\codigo\detallado#Detallado#Ganchos sismicos 135]], [[lat.md\glossary\cargas#Cargas#Mu]], [[lat.md\glossary\cargas#Cargas#Vu]], [[lat.md\glossary\geometria#Geometria#b]], [[lat.md\glossary\geometria#Geometria#h]], [[lat.md\glossary\geometria#Geometria#d]].

## Predimensionado de viga

Referencia: **ACI 318-14 §9.3**.

Reglas de pulgar para fijar dimensiones antes de calcular:

```
h = L/10 a L/12
b = h/2 a h/3
```

Ejemplo: viga típica de 5 m de luz → h = 45 cm, b = 25 cm.

Variables: [[lat.md\glossary\geometria#Geometria#h]], [[lat.md\glossary\geometria#Geometria#b]], [[lat.md\glossary\geometria#Geometria#L]].

## Diseno de flexion

Referencia: **ACI §22.2** — procedimiento de 15 pasos por sección crítica (apoyo y centro).

Para cada sección crítica se calcula el acero requerido siguiendo este flujo:

1. Calcular `Mu` con la combinación gobernante (ver [[lat.md\glossary\cargas#Cargas#Mu]])
2. Determinar φ = 0.90 (controlada por tracción — ver [[lat.md\glossary\factores-de-resistencia#Factores de resistencia#phi]])
3. Calcular `Rn = Mu / (φ · b · d²)`
4. Calcular `m = fy / (0.85 · f'c)`
5. `arg = 2 · m · Rn / fy`
6. Si `1 − arg ≥ 0`: la viga es simplemente reforzada
7. `ρ_req = (1/m) · (1 − √(1 − arg))`
8. `As_req = ρ_req · b · d`
9. `As_min_flex = (14/fy) · b · d` ó `0.79 · √f'c / fy · b · d` (el mayor)
10. `As_min_temp = 0.0018 · b · h`
11. `As_diseño = max(As_req, As_min_flex, As_min_temp)`

Si `ρ_req > ρ_max` la sección está sobrearmada y hay que aumentar `b`, `h`, o agregar acero a compresión `As'`. Ver [[lat.md\glossary\acero#Acero#rho_max]].

## Vigas ductiles - 6 verificaciones geometricas

Referencia: **CSCR §8.2.1**.

Para que una viga pueda formar parte de un sistema sismorresistente dúctil, debe cumplir las seis condiciones:

- Parte de sistema sismorresistente (no viga secundaria de gravedad)
- `Pu ≤ 0.10 · f'c · Ag / 1000` ton (carga axial baja)
- `L_libre > 4 · d`
- `b/h ≥ 0.30`
- `b ≥ 25 cm`
- `b ≤ b_columna + 3 · h`

Si la viga no cumple alguno, se diseña como viga ordinaria (sin acceso al `R` alto del sistema dúctil).

## Capacidad por diseno Ve

Referencia: **CSCR §8.3.4** — capacity design para cortante en vigas dúctiles.

En lugar del `Vu` elástico, el cortante de diseño se calcula como el asociado a la formación de rótulas plásticas en los extremos de la viga:

```
V_e = ( M_pr,izq + M_pr,der ) / L_libre + V_g
```

donde `M_pr` usa `fy_pr = 1.25 · fy` para tomar en cuenta el sobreesfuerzo del acero.

Esto garantiza que la falla por cortante NUNCA precede a la flexión: el acero a flexión fluye primero, dando aviso antes del colapso. Ver [[lat.md\codigo\detallado#Detallado#Ganchos sismicos 135]] para el detallado transversal requerido.
