# Sismico

Coeficientes y parámetros del análisis sísmico: PGA, coeficiente sísmico horizontal, factor R, factor de magnitud, razón de esfuerzo cíclico, razón de resistencia cíclica, amortiguamiento.

Fuente: [[src/lib/glossary.ts]].

## k_h

**Símbolo**: k_h — **Nombre completo**: Coeficiente sísmico horizontal — **Unidad**: — — **Referencia**: Mononobe-Okabe

Una fracción de g (aceleración de gravedad) que representa el sismo como una fuerza horizontal estática para diseñar muros y taludes.

**Valor típico**: k_h ≈ PGA/2 ≈ 0.15-0.25 en CR.

**Ver también**: [[lat.md\glossary\sismico#Sismico#PGA]].

## PGA

**Símbolo**: PGA — **Nombre completo**: Aceleración pico del suelo — **Unidad**: g — **Referencia**: CSCR-10 §2.1

El máximo zarandeo horizontal que se espera del suelo durante un sismo. Se mide en fracción de g.

**Valor típico**: 0.30g zona III; 0.40g zona IV (CSCR-10 §2.1).

**Ver también**: [[lat.md\glossary\sismico#Sismico#k_h]], [[lat.md\glossary\sismico#Sismico#MSF]].

## R

**Símbolo**: R — **Nombre completo**: Coeficiente de reducción sísmica — **Unidad**: — — **Referencia**: CSCR-10 §4

Un divisor que reduce la fuerza sísmica elástica considerando la capacidad de la estructura para deformarse y disipar energía sin colapsar.

**Valor típico**: R = 6 marcos dúctiles especiales; R = 3 marcos ordinarios.

**Por qué importa**: Estructuras con buen detallado dúctil pueden absorber sismos grandes deformándose. R alto = menos fuerza de diseño pero requiere detallado riguroso.

## Mw

**Símbolo**: Mw — **Nombre completo**: Magnitud momento del sismo — **Unidad**: —

Qué tan grande es el sismo en la escala momento (la moderna). Cada unidad multiplica por ~32 la energía liberada.

**Valor típico**: 5.0 leve; 6.5 fuerte; 7.5 mayor; 8.0+ gigante.

**Ver también**: [[lat.md\glossary\sismico#Sismico#PGA]], [[lat.md\glossary\sismico#Sismico#MSF]].

## MSF

**Símbolo**: MSF — **Nombre completo**: Factor de escala por magnitud — **Unidad**: — — **Referencia**: Youd et al. 2001

Un ajuste para licuefacción que considera que sismos más grandes duran más y aplican más ciclos al suelo saturado.

**Valor típico**: 1.0 para Mw=7.5; mayor a 1.0 para sismos más pequeños.

**Ver también**: [[lat.md\glossary\sismico#Sismico#Mw]], [[lat.md\glossary\sismico#Sismico#CSR]], [[lat.md\glossary\sismico#Sismico#CRR]].

## CSR

**Símbolo**: CSR — **Nombre completo**: Razón de esfuerzo cíclico — **Unidad**: — — **Referencia**: Seed & Idriss 1971

La demanda sísmica sobre el suelo: cuánto esfuerzo cortante cíclico aplica el sismo, expresado como fracción del confinamiento.

**Valor típico**: 0.15-0.35 en zonas sísmicas activas.

**Ver también**: [[lat.md\glossary\sismico#Sismico#CRR]], [[lat.md\glossary\sismico#Sismico#MSF]].

## CRR

**Símbolo**: CRR — **Nombre completo**: Razón de resistencia cíclica — **Unidad**: — — **Referencia**: Youd et al. 2001

La capacidad del suelo para resistir licuefacción. Se obtiene del SPT o CPT. Si CRR ≥ CSR, el suelo no licua.

**Ver también**: [[lat.md\glossary\sismico#Sismico#CSR]], [[lat.md\glossary\geotecnia#Geotecnia#N1_60]].

## xi

**Símbolo**: ξ — **Nombre completo**: Razón de amortiguamiento — **Unidad**: — — **Referencia**: CSCR-10 §2.5

Cuánto se "tranquiliza" la estructura entre cada oscilación durante un sismo. 5% es el valor estándar de diseño.

**Valor típico**: 0.05 (5%) para concreto reforzado en diseño sísmico.

## beta_dns

**Símbolo**: βdns — **Nombre completo**: Factor de carga sostenida en columnas esbeltas — **Unidad**: — — **Referencia**: ACI 318-14 §6.6.4.4.4

La fracción de carga axial que es sostenida (no transitoria). Cuanto más sostenida la carga, más fluencia plástica del concreto reduce la rigidez.

**Valor típico**: 0.6 cuando la carga muerta domina la combinación.

**Ver también**: [[lat.md\glossary\cargas#Cargas#Pu]].
