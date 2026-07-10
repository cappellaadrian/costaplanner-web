# Materiales y zonificacion CR

Referencia: **CSCR §6 + INTE C85:2017** — resistencias mínimas de concreto y acero según zona sísmica, y mapa de zonificación de Costa Rica.

Ver también: [[lat.md\codigo\diseno-simplificado#Diseno Simplificado]], [[lat.md\glossary\materiales#Materiales#fc]], [[lat.md\glossary\materiales#Materiales#fy]], [[lat.md\glossary\sismico#Sismico#PGA]].

## fc minimo por zona sismica

Referencia: **CSCR §6 + INTE C85:2017**.

| Zona | f'c min (kg/cm²) | Acero longitudinal |
|------|------------------|---------------------|
| I-II | 210              | ASTM A615 G60       |
| III  | 245              | ASTM A706 G60       |
| IV   | 280              | ASTM A706 G60       |

**A706 vs A615**: La diferencia es crítica para zonas III-IV. A706 garantiza:

- `fy ≤ 5600 kg/cm²` (límite superior, no solo inferior)
- Relación `fu/fy ≥ 1.25`
- Soldabilidad (composición química controlada)

Estas tres propiedades son requisitos del diseño dúctil. Con A615 (sin límite superior de fy) no se puede garantizar que la rótula plástica se forme donde el diseño la previó.

Variables: [[lat.md\glossary\materiales#Materiales#fc]], [[lat.md\glossary\materiales#Materiales#fy]].

## Mapa de zonificacion sismica de Costa Rica

Referencia: **CSCR §2.1 + Mapa Anexo A**.

- **Zona II** — Caribe norte, Guanacaste interior. PGA ≈ 0.20 g
- **Zona III** — Valle Central, Caribe sur, Pacífico norte interior. PGA ≈ 0.30 g
- **Zona IV** — Costa pacífica completa (Nicoya, Quepos, Osa), Limón. PGA ≈ 0.40 g

Costa Rica está completamente en zonificación moderada-alta. No existe zona I funcional dentro del territorio nacional. Verifica siempre el mapa oficial del CSCR antes de proyectar — el mapa Anexo A es la referencia legal.

Variable: [[lat.md\glossary\sismico#Sismico#PGA]].
