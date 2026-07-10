# Glosario de variables estructurales

Diccionario de 84 variables usadas en los 12 estudios de Costaplanner, explicadas en español costarricense plano. Fuente canónica: [[src/lib/glossary.ts]].

## Categorias

Las variables están agrupadas por dominio físico (cargas, materiales, geometría, etc.). Cada entrada tiene símbolo, definición plana, unidad, valor típico, referencia ACI/CSCR y enlaces.

- [[acero]] — áreas de refuerzo y cuantías (As, Av, Ash, ρ, ρ_min, ρ_max).
- [[cargas]] — momentos, cortantes, axiales, torsiones, fuerzas sísmicas factorizadas.
- [[factores-de-resistencia]] — factores φ de reducción y γ de carga.
- [[geometria]] — dimensiones, áreas brutas, longitudes de zona confinada y desarrollo.
- [[geotecnia]] — capacidad portante, SPT, empujes de Rankine, FS para muros.
- [[materiales]] — propiedades del concreto y acero (f'c, fy, Ec, Es, fr, β1, λ, n).
- [[sismico]] — coeficiente sísmico, PGA, R, magnitud, licuefacción, amortiguamiento.

## Como navegar

`lat search "qué es Mu"` resuelve la definición. `lat section "glossary/cargas#Mu"` muestra la entrada completa con enlaces salientes y entrantes. Cada entrada tiene `Ver también` con `[[wiki links]]` a variables relacionadas.

El graph también conecta con el manual del código en `lat.md/codigo/`: cada fórmula usa variables definidas acá.
