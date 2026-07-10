# Materiales

Propiedades mecánicas del concreto y del acero. Resistencias, módulos elásticos, factores del bloque rectangular equivalente.

Ver [[lat.md\codigo\materiales#Materiales y zonificacion CR#fc minimo por zona sismica]] para las resistencias mínimas requeridas por código en Costa Rica.

Fuente: [[src/lib/glossary.ts]].

## fc

**Símbolo**: f'c — **Nombre completo**: Resistencia del concreto a compresión — **Unidad**: kg/cm² — **Referencia**: ACI 318-14 §19.2

Qué tan fuerte es el concreto cuando lo aplastas. Se mide rompiendo un cilindro de prueba a los 28 días.

**Valor típico**: 210 min. en zonas I-II, 245 en zona III, 280 en zona IV (CSCR §6 + INTE C85:2017).

**Por qué importa**: Sube f'c → más capacidad sin aumentar tamaño. Pero también más rígido y frágil; el balance importa.

**Ver también**: [[lat.md\glossary\materiales#Materiales#Ec]], [[lat.md\glossary\materiales#Materiales#fr]], [[lat.md\glossary\materiales#Materiales#beta1]].

## fy

**Símbolo**: fy — **Nombre completo**: Esfuerzo de fluencia del acero — **Unidad**: kg/cm² — **Referencia**: ACI 318-14 §20.2

Cuánto puedes estirar el acero antes de que se deforme permanentemente. Es como cuando estiras un alambre y ya no vuelve a su forma original.

**Valor típico**: 4200 kg/cm² (Grado 60). En zona III-IV usar A706 que garantiza fy ≤ 5600 kg/cm².

**Por qué importa**: La capacidad del acero a tracción es lo que sostiene la fibra inferior de una viga en flexión.

**Ver también**: [[lat.md\glossary\materiales#Materiales#Es]], [[lat.md\glossary\materiales#Materiales#fyt]].

## fyt

**Símbolo**: fyt — **Nombre completo**: Esfuerzo de fluencia del acero transversal — **Unidad**: kg/cm² — **Referencia**: ACI 318-14 §20.2.2.4

Lo mismo que fy pero medido en el acero de los estribos (los aros transversales), no en las barras longitudinales.

**Valor típico**: 4200 kg/cm². Algunos códigos limitan fyt ≤ 5600 para corte en sismo.

**Ver también**: [[lat.md\glossary\materiales#Materiales#fy]], [[lat.md\glossary\acero#Acero#Av]], [[lat.md\glossary\acero#Acero#Ash]].

## Ec

**Símbolo**: Ec — **Nombre completo**: Módulo de elasticidad del concreto — **Unidad**: kg/cm² — **Referencia**: ACI 318-14 §19.2.2

Qué tan rígido es el concreto: cuánto se deforma cuando le aplicas una carga. Más alto = más rígido = menos deflexión.

**Valor típico**: Ec ≈ 15100·√f'c ≈ 219,000 kg/cm² para f'c=210.

**Por qué importa**: Gobierna la deflexión de vigas y la rigidez de la estructura en sismo.

**Ver también**: [[lat.md\glossary\materiales#Materiales#fc]], [[lat.md\glossary\materiales#Materiales#Es]], [[lat.md\glossary\materiales#Materiales#n]].

## Es

**Símbolo**: Es — **Nombre completo**: Módulo de elasticidad del acero — **Unidad**: kg/cm² — **Referencia**: ACI 318-14 §20.2.2.2

Qué tan rígido es el acero. Es una constante: 2,040,000 kg/cm². Es casi 10 veces más rígido que el concreto.

**Valor típico**: 2,040,000 kg/cm² (29,000 ksi).

**Ver también**: [[lat.md\glossary\materiales#Materiales#Ec]], [[lat.md\glossary\materiales#Materiales#n]].

## fr

**Símbolo**: fr — **Nombre completo**: Módulo de rotura del concreto — **Unidad**: kg/cm² — **Referencia**: ACI 318-14 §19.2.3

El esfuerzo de tracción con el que el concreto se agrieta por primera vez. Es bajo, porque el concreto es malo en tracción.

**Valor típico**: fr = 2·√f'c ≈ 29 kg/cm² para f'c=210.

**Por qué importa**: Define cuándo aparece la primera grieta y dispara el cálculo de Mcr para deflexión y refuerzo mínimo.

**Ver también**: [[lat.md\glossary\materiales#Materiales#fc]].

## beta1

**Símbolo**: β1 — **Nombre completo**: Factor del bloque de Whitney — **Unidad**: — — **Referencia**: ACI 318-14 §22.2.2.4.3

Un factor que convierte la curva real de compresión del concreto en un rectángulo equivalente fácil de usar. Vale 0.85 para concretos normales y baja con f'c muy alto.

**Valor típico**: 0.85 para f'c ≤ 280 kg/cm². Baja 0.05 por cada 70 kg/cm² adicional, mínimo 0.65.

**Ver también**: [[lat.md\glossary\materiales#Materiales#fc]].

## lambda

**Símbolo**: λ — **Nombre completo**: Factor de concreto liviano — **Unidad**: — — **Referencia**: ACI 318-14 §19.2.4

Un castigo que se aplica si usas concreto liviano (más ligero pero menos fuerte en tracción). Para concreto normal vale 1.0.

**Valor típico**: 1.0 para concreto normal; 0.75 para concreto liviano todo agregado.

## n

**Símbolo**: n — **Nombre completo**: Relación modular Es/Ec — **Unidad**: — — **Referencia**: ACI 318-14 §24.2.3.5

Cuántas veces es más rígido el acero que el concreto. Sirve para convertir una sección mixta en una sola sección equivalente de concreto.

**Valor típico**: n ≈ 8-10 para f'c entre 210 y 280.

**Ver también**: [[lat.md\glossary\materiales#Materiales#Es]], [[lat.md\glossary\materiales#Materiales#Ec]].
