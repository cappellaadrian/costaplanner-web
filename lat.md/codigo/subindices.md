# Subindices y notacion

Convención de notación usada en todos los archivos de `lat.md/codigo/` y en `lat.md/glossary/`.

## Forma de los subindices

En el código fuente y en este knowledge graph, las variables con subíndice se escriben en la forma `X_y`:

- `V_b` = V con subíndice b (cortante basal)
- `d_w` = d con subíndice w (densidad de muros)
- `L_muro` = L con subíndice muro
- `A_st,req` = A con subíndice st-coma-req
- `M_pr,izq` = M con subíndice pr-coma-izq
- `dim_menor` = dim con subíndice menor

En la UI de Costaplanner (la página `/codigo`), esa notación se renderiza visualmente con `<sub>` HTML. La función `renderSubscripts()` en `src/app/codigo/page.tsx` aplica un regex sobre letras Unicode (Latin + Griego) seguido de `_` y caracteres alfanuméricos con coma.

## Letras griegas

Se aceptan letras griegas Unicode directamente en las fórmulas:

- `α` (alpha, α_c en cortante)
- `β` (beta, β1 bloque Whitney)
- `γ` (gamma, γ_suelo)
- `ρ` (rho, cuantía de acero)
- `φ` (phi, factor de reducción)
- `λ` (lambda, factor concreto liviano)
- `ξ` (xi, amortiguamiento)

Cuando hay ambigüedad ASCII en variable keys del código TypeScript, se usa el nombre transliterado (`phi`, `rho`, `beta1`, `gamma`, `lambda`, `xi`). Ver [[lat.md\glossary\factores-de-resistencia#Factores de resistencia#phi]], [[lat.md\glossary\acero#Acero#rho]].

## Operadores y simbolos

Se aceptan directamente:

- `·` multiplicación
- `²` `³` potencias
- `√` raíz cuadrada
- `≥` `≤` `≠` desigualdades
- `°` grados

## Unidades

Sistema mixto kg-cm-ton (tradición costarricense):

- Longitudes en `cm` o `m`
- Fuerzas en `ton`, `kg`, `kN`
- Resistencias en `kg/cm²`
- Momentos en `ton·m`
- Presiones de suelo en `kg/cm²` o `kPa`

La conversión a `kg-cm` se hace al inicio del cálculo para evitar errores de factor 100. Ver [[lat.md\glossary\materiales#Materiales]].
