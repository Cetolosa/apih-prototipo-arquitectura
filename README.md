# APIH Prototipo Arquitectura

Aplicación de portafolio (SPA estática) con servidor en Postgres/Supabase. Proyecto de pruebas con datos sintéticos.

## Estructura
- `index.html`, `js/`, `css/`: la SPA (módulos ES, sin paso de compilación).
- `supabase/migrations/`: reglas del servidor (autorización, validación, comandos de negocio). `supabase/tests/`: pruebas SQL.
- `tests/e2e/`: pruebas de navegador (Playwright). `tests/contract/`: contratos compartidos entre la SPA y el servidor.
- `pruebas-ti/`: repite la revisión técnica de Arquitectura y deja un informe por hallazgo (ver su README).
- `docs/ti/`: guía de UAT, anexo de arquitectura, mapa de portabilidad, comprar vs construir.

## Cómo probar
```
npm ci
npm run test:e2e          # navegador, modo demo
sudo -E bash tools/test-sql.sh   # migraciones y políticas en un Postgres temporal
sudo -E env "PATH=$PATH" npm run pruebas-ti   # informe de revisión técnica
```
Node 22 (`.nvmrc`). Las pruebas SQL necesitan Postgres local.

## Publicación
`main` se publica en GitHub Pages (`.github/workflows/pages.yml`) con solo `index.html`, `apih-config.js`, `js/` y `css/`.
