# Acero

Áreas de acero longitudinal, transversal, de confinamiento y de fricción. Cuantías mínimas, máximas y balanceadas.

Fuente: [[src/lib/glossary.ts]].

## As

**Símbolo**: As — **Nombre completo**: Área de acero longitudinal en tracción — **Unidad**: cm² — **Referencia**: ACI 318-14 §22.2

Cuánto acero (sumando todas las barras inferiores) tiene la sección para resistir el momento. Es el resultado principal del diseño a flexión.

**Valor típico**: Viga típica: 6-20 cm². Columna típica: 20-80 cm².

**Por qué importa**: Es el output principal del diseño. Define cuántas barras y de qué tamaño se ponen.

**Ver también**: [[lat.md\glossary\acero#Acero#As_min]], [[lat.md\glossary\acero#Acero#rho]], [[lat.md\glossary\geometria#Geometria#db]].

## As_prime

**Símbolo**: As' — **Nombre completo**: Área de acero en compresión — **Unidad**: cm²

Acero adicional en la parte de arriba de la viga, en la zona comprimida. Se usa cuando el momento positivo es muy alto y el concreto solo no alcanza.

**Ver también**: [[lat.md\glossary\acero#Acero#As]], [[lat.md\glossary\acero#Acero#rho_max]].

## As_min

**Nombre completo**: Acero mínimo — **Unidad**: cm² — **Referencia**: ACI 318-14 §9.6.1.2

Lo MENOS que el código deja poner, sin importar lo bajita que sea la demanda. Evita que la primera grieta rompa la viga inmediatamente.

**Valor típico**: As_min = máx(14/fy · b·d ; 0.8·√f'c/fy · b·d).

**Por qué importa**: Sin este mínimo, una viga con poco momento podría tener un acero TAN pequeño que se rompería al primer cracking.

**Ver también**: [[lat.md\glossary\acero#Acero#As]], [[lat.md\glossary\acero#Acero#rho_min]].

## Av

**Símbolo**: Av — **Nombre completo**: Área de acero de cortante por estribo — **Unidad**: cm² — **Referencia**: ACI 318-14 §22.5.10

Cuánto acero hay en un estribo completo (suma de todas sus ramas verticales). Es lo que se opone al corte que intenta partir la viga en diagonal.

**Valor típico**: Estribo #3 de 2 ramas: Av = 2·0.71 = 1.42 cm².

**Ver también**: [[lat.md\glossary\cargas#Cargas#Vn]], [[lat.md\glossary\geometria#Geometria#s]], [[lat.md\glossary\materiales#Materiales#fyt]].

## Ash

**Símbolo**: Ash — **Nombre completo**: Área de acero de confinamiento — **Unidad**: cm² — **Referencia**: ACI 318-14 §18.7.5.4

Cuánto acero transversal (estribo + ganchos suplementarios) atraviesa el núcleo de la columna en una dirección. Es lo que "abraza" el concreto para que no se rompa en sismo.

**Ver también**: [[lat.md\glossary\geometria#Geometria#Ach]], [[lat.md\glossary\geometria#Geometria#Ag]].

## Avf

**Símbolo**: Avf — **Nombre completo**: Área de acero de cortante por fricción — **Unidad**: cm² — **Referencia**: ACI 318-14 §22.9

Acero que cruza una superficie potencial de deslizamiento (junta fría, encuentro muro-cimiento). Trabaja por fricción, no por flexión.

## rho

**Símbolo**: ρ — **Nombre completo**: Cuantía de acero — **Unidad**: — (porcentaje)

Qué fracción de la sección de concreto está ocupada por acero. Se calcula As / (b·d). Se da como porcentaje.

**Valor típico**: ρ = 0.5%-2% en vigas. Mayor = más capacidad pero más caro y más rígido.

**Ver también**: [[lat.md\glossary\acero#Acero#rho_min]], [[lat.md\glossary\acero#Acero#rho_max]], [[lat.md\glossary\acero#Acero#As]].

## rho_min

**Símbolo**: ρ_min — **Nombre completo**: Cuantía mínima — **Unidad**: — — **Referencia**: ACI 318-14 §9.6.1

El porcentaje más bajo de acero permitido por código. Asegura que al agrietarse el concreto, el acero no se rompa de golpe.

**Valor típico**: ρ_min ≈ 0.0033 para fy = 4200 (ACI §9.6).

**Ver también**: [[lat.md\glossary\acero#Acero#As_min]], [[lat.md\glossary\acero#Acero#rho]].

## rho_max

**Símbolo**: ρ_max — **Nombre completo**: Cuantía máxima — **Unidad**: — — **Referencia**: ACI 318-14 §21.2.2

El acero MÁXIMO que permite una falla dúctil (acero fluye primero, después aplasta el concreto). Pasarse implica falla frágil sin aviso.

**Valor típico**: ρ_max ≈ 0.0214 para f'c=210 y fy=4200 (sección controlada por tracción).

**Por qué importa**: Si ρ > ρ_max, la viga se vuelve sobrearmada: falla frágil sin aviso. Siempre se diseña por debajo.

**Ver también**: [[lat.md\glossary\acero#Acero#rho]], [[lat.md\glossary\acero#Acero#rho_bal]].

## rho_bal

**Símbolo**: ρ_bal — **Nombre completo**: Cuantía balanceada — **Unidad**: — — **Referencia**: ACI 318-14 §22.2

El acero teórico que haría fluir el acero y aplastar el concreto AL MISMO TIEMPO. Es la frontera entre falla dúctil y falla frágil.

**Valor típico**: Para f'c=210, fy=4200: ρ_bal ≈ 0.0214.

**Ver también**: [[lat.md\glossary\acero#Acero#rho_max]], [[lat.md\glossary\materiales#Materiales#beta1]].

## rho_s

**Símbolo**: ρ_s — **Nombre completo**: Cuantía volumétrica de espiral — **Unidad**: — — **Referencia**: ACI 318-14 §25.7.3

Cuánto acero en espiral lleva una columna circular, medido como volumen de acero por volumen de concreto confinado.

**Valor típico**: ρ_s ≥ 0.45·(Ag/Ach − 1)·(f'c/fy) según ACI §25.7.3.3.

**Ver también**: [[lat.md\glossary\geometria#Geometria#Ag]], [[lat.md\glossary\geometria#Geometria#Ach]].
