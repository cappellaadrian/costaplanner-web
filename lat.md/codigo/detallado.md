# Detallado

Referencia: **ACI 318 §25 + CSCR §8.6** — ganchos, traslapes, longitudes de desarrollo y recubrimiento.

Calculadora: `src/app/studio/desarrollo-empalmes/` (ver [[src/lib/desarrollo-empalmes-live.ts]]).

Ver también: [[lat.md\codigo\vigas#Vigas#Capacidad por diseno Ve]], [[lat.md\codigo\columnas#Columnas#Confinamiento sismico]], [[lat.md\glossary\geometria#Geometria#ld]], [[lat.md\glossary\geometria#Geometria#ldh]].

## Recubrimiento minimo

Referencia: **ACI §20.6.1** — distancia desde la superficie del concreto al exterior del estribo.

- **7.5 cm** — concreto en contacto con suelo (zapatas, muros bajo cota terreno)
- **5.0 cm** — muros expuestos a intemperie
- **4.0 cm** — vigas y columnas expuestas
- **2.0 cm** — losas y muros interiores

Sin recubrimiento adecuado, la humedad y los cloruros llegan al acero y empiezan la corrosión. En 10-20 años el elemento pierde capacidad muy por debajo de su diseño.

Variable: [[lat.md\glossary\geometria#Geometria#recubrimiento]].

## Ganchos sismicos 135

Referencia: **ACI §25.3 + CSCR §8.6** — los estribos en zonas III-IV deben cerrar a 135°, no a 90°.

### Por que 135 grados

El gancho a 135° entra al núcleo confinado de la sección y no se puede abrir bajo carga cíclica. El gancho a 90° queda apoyado solo en el recubrimiento; cuando el recubrimiento se descascara en sismo, el estribo se abre como una S y deja de confinar.

### Geometria

- Doblez interior `≥ 6 · d_b` (radio mínimo del mandril)
- Extensión recta después del doblez `Ext = max( 6 · d_b, 7.5 cm )`

Ganchos a 90° están prohibidos en zonas III-IV para refuerzo transversal de elementos sismorresistentes.

## Longitudes de desarrollo

Referencia: **ACI §25.4 + §25.5** — cuánto tiene que estar metida la barra en el concreto para que pueda transmitir su fuerza.

### Longitud de desarrollo recta

`l_d` depende del diámetro de la barra, la calidad del concreto, el recubrimiento y la posición. Típicamente `30 · d_b` a `60 · d_b`.

### Longitud de gancho a 90 grados

`l_dh` es aproximadamente la mitad de `l_d`, porque el gancho aporta capacidad adicional por anclaje mecánico.

### Longitud de traslape (lap splice)

```
l_st = 1.3 · l_d  ≥  30 cm
```

**Prohibido empalmar en zona confinada de columnas o en zona de rótula plástica de vigas dúctiles.** Los traslapes se ubican en el tercio central del elemento, donde la demanda cíclica es menor.

Variables: [[lat.md\glossary\geometria#Geometria#ld]], [[lat.md\glossary\geometria#Geometria#ldh]], [[lat.md\glossary\geometria#Geometria#db]].
