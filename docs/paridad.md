# Paridad Prototipo ↔ Corporativo

APIH Prototipo Arquitectura (`Cetolosa/apih-prototipo-arquitectura`, Supabase) y APIH Corporativo Arquitectura (`Cetolosa/apih-corporativo-arquitectura`, API + Azure SQL) son **funcionalmente equivalentes**: la misma SPA, las mismas pruebas e2e y los mismos comandos del servidor con los mismos argumentos. Solo cambia dónde corre.

## Regla de trabajo

1. **Todo cambio parte en el Prototipo.** Ahí se diseña, se prueba (SQL + e2e) y se valida con el usuario.
2. **Se traspasa al Corporativo en la misma entrega**, con el mismo nombre de rama en ambos repositorios.
   - **SPA y pruebas e2e: automático.** `node tools/paridad.mjs ../apih-corporativo-arquitectura --sincronizar` (desde el Prototipo) copia al Corporativo `js/`, `css/`, `index.html` (conservando su CSP y sus scripts de `vendor/`), las pruebas de la regresión, sus fixtures, la lista de regresión y este mismo verificador. Borra del Corporativo lo común que ya no existe en el Prototipo. No toca lo propio de cada ambiente. Nadie edita a mano `web/js`, `web/css` ni `web/index.html` del Corporativo.
   - Con el secreto `CORP_TOKEN` en el Prototipo (token de GitHub con permiso de escritura en contenido y PR del Corporativo), el CI del Prototipo lo hace solo en cada PR: sincroniza, empuja la rama del mismo nombre al Corporativo y abre su PR.
   - **Servidor: a mano.** La función `apih_*` del Prototipo (PL/pgSQL) se escribe como comando en `api/src/commands/` y su esquema en `api/src/http/esquemas.ts`. Es la única parte que sigue duplicada mientras existan los dos backends; la paridad indica qué comando falta o difiere.
3. **Se fusionan juntos.** El CI del Corporativo clona el Prototipo (misma rama si existe; si no, `main`) y corre `node tools/paridad.mjs`: si algo quedó en un solo lado, falla.

## Qué comprueba `tools/paridad.mjs`

| Qué | Regla |
|---|---|
| `js/` | Idéntico, salvo `01t-transporte.js` (servidor y sesión del ambiente) y `10b-acceso.js` (pantallas de acceso). Ambos deben existir en los dos lados. `auth-start.js` y `auth-end.js` son solo del Corporativo (Teams). |
| `css/` | Idéntico, salvo `acceso.css` y `auth.css`. |
| `index.html` | Idéntico, salvo `connect-src` de la CSP y los scripts de `vendor/`. |
| Pruebas e2e | Las de la regresión de ambos (`tools/correr-e2e.*`) son el mismo archivo. Propias de cada servidor: `_pw.js`, `backend-humo`, `servidor-ficticio`. |
| Servidor | Cada comando del Corporativo (`esquemas.ts`) existe en el Prototipo como función `apih_*` ejecutable por la persona, con los mismos argumentos `p_*`, y viceversa. Las funciones que el Prototipo expone solo para RLS y vistas están declaradas en `AUXILIARES_SQL`. |

Uso local: `node tools/paridad.mjs <otro repositorio>` para comprobar; con `--sincronizar` además copia lo común del Prototipo al Corporativo (el sentido es siempre ese, se corra desde donde se corra).

## Lo propio de cada ambiente

| | Prototipo | Corporativo |
|---|---|---|
| Servidor | Supabase: PostgREST + funciones `apih_*` (RLS) | API Node (Fastify) + Azure SQL |
| Acceso | Correo corporativo y contraseña propia (Supabase Auth) | Microsoft Entra ID (MSAL; ventana de Teams) |
| Transporte en la SPA | `01t-transporte.js`: `SupabaseService`, `Sesion`, `PantallaAcceso` | `01t-transporte.js`: `ApiService`, `Sesion`, `PantallaAcceso` |
| Validación de argumentos | Firma de cada función (PostgREST rechaza argumentos desconocidos) | JSON Schema por comando (`esquemas.ts`) |
