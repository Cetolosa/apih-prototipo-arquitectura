# Estructura del front (Prototipo)

- `index.html`: solo `<head>` con CSP, hojas de estilo y dos scripts (`apih-config.js` y el módulo `js/principal.js`).
- `css/`: `base.css` → `mejoras.css` → `extensiones.css` → `acceso.css` (el orden conserva la cascada original; ningún estilo se inyecta desde JS).
- `js/`: módulos ES numerados; `principal.js` los importa en orden de archivo.
  - Regla: un módulo solo importa módulos **anteriores** (sin ciclos; lo verifica `tools/verificar-modulos.js`).
  - Lo que un módulo necesita de otro **posterior** (o debe reasignar) pasa por el registro `ENLACES` (`00-registro.js`), con accesores get/set que define el módulo dueño.
  - El generador de presentaciones está dividido en `08a`…`08g`; solo `GENE` es público.
- CSP: `script-src 'self'` (sin `unsafe-inline` ni `unsafe-eval`); `style-src-elem 'self'` (sin `<style>` en línea);
  `style-src-attr 'unsafe-inline'` se mantiene **solo** para atributos `style=""` de las plantillas (declaraciones, no hojas ni scripts).
- El HTML de presentación exportado es un documento autónomo: incrusta las reglas de `css/base.css` leídas de las hojas cargadas.

## Capa de datos (sin SharePoint)
- `js/02-datos.js`: `SupabaseService` (REST de PostgREST + comandos RPC), `DataService` (carga, diff, sincronización, conflictos) y `AuthService` (Supabase Auth).
- Ya no existen Graph, REST de SharePoint, MSAL, token manual ni el script PnP; la CSP `connect-src` permite solo `'self'` y el proyecto Supabase.
- `ESQUEMA`/`MapaDatos`: esquema de entidades y mapeo de dominio ↔ columnas. La lista lógica (`lista`) coincide con los valores que usan las políticas SQL.
- Administración → **Conexión**: estado, prueba de conexión, recarga, sincronización y cierre de sesión. Las tablas se crean con `supabase/migrations`.
- Prueba: `tests/e2e/servidor-ficticio.js` (sesión + PostgREST emulados) cubre conexión, alta, edición, lectura ajena, conflicto, baja y prueba de conexión.
