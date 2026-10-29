# APIH Prototipo Arquitectura

Aplicación de portafolio (SPA estática) con servidor en Postgres/Supabase. Proyecto de pruebas con datos sintéticos.

## Paridad con el Corporativo

Este repositorio y [`apih-corporativo-arquitectura`](https://github.com/Cetolosa/apih-corporativo-arquitectura) son funcionalmente equivalentes. **Todo cambio parte en el Prototipo y se traspasa al Corporativo en la misma entrega**; el CI lo verifica con `node tools/paridad.mjs`. Detalle en [docs/paridad.md](docs/paridad.md).

## Estructura
- `index.html`, `js/`, `css/`: la SPA (módulos ES, sin paso de compilación).
- `supabase/migrations/`: reglas del servidor (autorización, validación, comandos de negocio). `supabase/tests/`: pruebas SQL.
- `tests/e2e/`: pruebas de navegador (Playwright). `tests/contract/`: contratos compartidos entre la SPA y el servidor.
- `pruebas-ti/`: repite la revisión técnica de Arquitectura y deja un informe por hallazgo (ver su README).
- `docs/ti/`: guía de UAT, anexo de arquitectura y mapa de portabilidad.

## Cómo probar
```
npm ci
npm run test:e2e          # navegador, modo demo
sudo -E bash tools/test-sql.sh   # migraciones y políticas en un Postgres temporal
sudo -E env "PATH=$PATH" npm run pruebas-ti   # informe de revisión técnica
```
Node 22 (`.nvmrc`). Las pruebas SQL necesitan Postgres local.

## Aplicar las reglas en Supabase
Pegar `supabase/aplicar_en_supabase.sql` completo en Supabase → SQL Editor → Run (repetible; no borra datos). Se regenera con `node tools/empaquetar-migraciones.js` y la CI exige que esté al día. Sin esto, la SPA nueva muestra «Sin conexión a Supabase: … puede_editar does not exist».

## Publicación
`main` se publica en GitHub Pages (`.github/workflows/pages.yml`) con solo `index.html`, `apih-config.js`, `js/` y `css/`.
