# Muros

Referencia: **ACI §18.10 + Rankine + Brinch Hansen** — muros estructurales (de corte) y muros de contención.

Calculadoras: `src/app/studio/shear-wall/`, `src/app/studio/retaining-wall/` (ver [[src/lib/shear-wall-live.ts]]).

Ver también: [[lat.md\codigo\columnas#Columnas#Confinamiento sismico]], [[lat.md\codigo\diseno-simplificado#Diseno Simplificado#Densidad minima de muros]], [[lat.md\glossary\sismico#Sismico#PGA]], [[lat.md\glossary\geotecnia#Geotecnia#phi_deg]].

## Muro de corte

Referencia: **ACI §18.10** — diseño de muros estructurales como sistema sismorresistente.

### Cortante

```
φ · V_n = φ · A_cv · ( α_c · √f'c + ρ_t · f_y )
```

donde `α_c` depende de la relación de aspecto `hw / lw`:

- `α_c = 0.80` si `hw/lw ≤ 1.5` (muro robusto)
- `α_c = 0.53` si `hw/lw ≥ 2.0` (muro esbelto)
- interpolación lineal entre

### Espesor minimo y doble cortina

- Una cortina hasta `t = 20 cm`
- Doble cortina obligatoria si `t ≥ 20 cm` o si está en zona III-IV

Variables: [[lat.md\glossary\factores-de-resistencia#Factores de resistencia#phi_v]], [[lat.md\glossary\acero#Acero#rho]], [[lat.md\glossary\materiales#Materiales#fc]], [[lat.md\glossary\materiales#Materiales#fy]].

## Muro de contencion en voladizo

Referencia: **Rankine 1857 + Brinch Hansen** — equilibrio limite para estabilidad externa.

### Verificaciones de estabilidad

El muro debe pasar cinco controles antes de considerarse estable. Si alguno falla, normalmente se aumenta el ancho de la zapata `B` o se agrega un diente.

- `FS_v ≥ 1.5` al volcamiento (estático), 2.0 con sismo
- `FS_d ≥ 1.5` al deslizamiento con `μ = 0.55` ó `tan(2/3 · φ)`
- `e ≤ B/6` para distribución de presiones trapezoidal
- `q_max ≤ q_adm` del suelo
- `FS_scc ≥ 3.0` contra capacidad de carga última

### Coeficiente activo y empuje

```
K_a = tan²( 45° − φ/2 )
E_1 = ½ · γ · H² · K_a
```

El empuje `E_1` actúa a `H/3` desde la base. Si hay sobrecarga, agregar `E_2` actuando a `H/2`.

Variables: [[lat.md\glossary\geotecnia#Geotecnia#Ka]], [[lat.md\glossary\geotecnia#Geotecnia#phi_deg]], [[lat.md\glossary\geotecnia#Geotecnia#FS]], [[lat.md\glossary\sismico#Sismico#k_h]].

La calculadora `studio/retaining-wall` produce 11 diagramas reactivos (empujes, fuerzas, momentos, presiones bajo zapata) que se actualizan en tiempo real al cambiar dimensiones o propiedades del suelo.
