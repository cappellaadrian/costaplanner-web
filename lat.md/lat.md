# Costaplanner knowledge graph

Knowledge graph for **Costaplanner**, a Costa Rica-specific structural design workspace. Managed by [lat.md](https://www.npmjs.com/package/lat.md).

## What lives here

This graph has two top-level directories. `codigo/` is the visual reference of CSCR-10 + ACI 318 design rules. `glossary/` is the dictionary of every variable used in the structural studios.

- [[codigo]] — design-rule manual: beams, columns, foundations, slabs, walls, detailing, materials.
- [[glossary]] — 84-entry dictionary organized into 7 categories.

## How agents should use it

For any structural question or modification, run `lat search` first, then `lat section` to pull the full context, then traverse `[[wiki links]]` to related sections. Source code files carry `// @lat: [[section]]` annotations that link implementation back to these concepts.

## Source-of-truth boundary

This graph documents design rules and variable definitions. Calculation implementations live in `src/lib/*-live.ts`. When they disagree, the source code is what runs.
