# Diseno Simplificado

Referencia: **CSCR §17** — método simplificado para casas de 1-2 pisos en Costa Rica.

Este es el atajo del Código Sísmico de Costa Rica para edificaciones pequeñas y regulares. Si una vivienda cumple los límites de altura y materiales, se permite saltar el análisis modal espectral.

Ver también: [[lat.md\codigo\muros#Muros#Muro de corte]] (cuando los muros sismorresistentes son de concreto reforzado), [[lat.md\codigo\materiales#Materiales y zonificacion CR#fc minimo por zona sismica]] (resistencias mínimas por zona).

## Cuando aplica el metodo simplificado

Referencia: **CSCR §17.1**.

El método es válido SOLO para edificaciones que cumplen TODOS estos límites:

- Hasta **2 pisos** (planta baja + un nivel)
- Altura total ≤ **8 m**
- Vivienda, oficina, comercio menor, o aula (NO hospitales, NO industrias pesadas)
- Sistema sismorresistente predominantemente de **muros** (mampostería integral o concreto reforzado)
- Planta regular y altura regular

Si NO se cumple uno solo de estos límites, no se puede usar el simplificado. Toca análisis modal espectral según CSCR §7.

## Densidad minima de muros

Referencia: **CSCR §17.3**.

La densidad de muros `d_w` en cada dirección principal se define como:

```
d_w = Σ L_muro / A_piso
```

donde `L_muro` es la longitud total de muros sismorresistentes en una dirección y `A_piso` es el área del piso considerado.

### Valores minimos por zona

| Zona | 1 piso | 2 pisos (PB) |
|------|--------|--------------|
| II   | 0.025  | 0.035        |
| III  | 0.030  | 0.045        |
| IV   | 0.040  | 0.055        |

Costa Rica está en zonas II-IV (ver [[lat.md\codigo\materiales#Materiales y zonificacion CR#Mapa de zonificacion sismica de Costa Rica]]).

## Cortante basal simplificado

Referencia: **CSCR §17.4**.

```
V_b = C_s · W
```

Distribución en 2 pisos: `V_1 = V_2 = 0.5 · V_b`.

El coeficiente sísmico `C_s` se toma de la tabla §17.4 según zona y tipo de suelo. La masa sísmica `W` incluye carga permanente más una fracción de la carga viva.
