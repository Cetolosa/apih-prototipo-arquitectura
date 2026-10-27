# Mapa de portabilidad · Prototipo → Corporativo

Qué se reutiliza tal cual, qué se reescribe y qué se descarta. «Corporativo» se refiere a la arquitectura de 3 capas propuesta a TI (SPA con Entra ID, API, Azure SQL, infraestructura en Terraform). Las filas marcadas ▲ las debe confirmar Christian contra el repositorio de Corporativo antes de enviar.

| Elemento del Prototipo | Qué es | En Corporativo | Esfuerzo |
| --- | --- | --- | --- |
| SPA (`index.html`, `js/`, `css/`) | Módulos ES, CSP estricta, sin build | Mismo código; cambia solo el módulo de datos y de acceso | Bajo |
| `SupabaseService` / `AuthService` (`js/02-datos.js`) | Cliente REST + sesión del proveedor | Cliente de la API corporativa + sesión Entra ID (SSO) ▲ | Medio (un módulo) |
| Contrato de comandos (`apih_*` con parámetros `p_*` y errores con campo) | Interfaz de operaciones del servidor | Endpoints de la API con los mismos nombres, parámetros y formato de error | Medio |
| Reglas de comandos (plpgsql) | Aprobar, resolver decisión, hito, cambios, reapertura | Reescritura en el lenguaje de la API; mismas reglas y mismos casos de prueba | Medio-alto |
| Validación (`apih_validar`) | Validación de contenido en el servidor | Módulo de validación de la API (misma lista de reglas) | Medio |
| Compuertas (`apih_faltan_aprobar`) | Una definición para servidor y cliente | Misma regla; **`tests/contract/gates_aprobar.json` se reutiliza sin cambios** | Bajo |
| Políticas de fila (RLS) por área | Filtro automático en la base | Filtro por área y monto en la capa de API/consultas (consulta parametrizada con la identidad) ▲ | Alto: es el cambio de modelo |
| Vista `registros_v` (montos redactados) | Redacción en la lectura | Proyección en la API que omite campos de `claves_monto` | Medio |
| Disparador `apih_fila` (autor, área, auditoría) | Sellado en la escritura | Middleware/servicio de escritura de la API; auditoría en tabla propia | Medio |
| `perfiles` (rol, áreas, ve_todo, ve_montos, gobierna) | Autorización por persona | Roles por grupos de Entra + atributos de área/monto en tabla ▲ | Medio |
| `dominios_permitidos` | Restricción por dominio de correo | Lo resuelve el tenant corporativo | Se descarta |
| Migraciones SQL | Esquema versionado | Esquema para Azure SQL (T-SQL) + Terraform para recursos | Medio |
| GUC `apih.interno` | Marca de comando interno | No aplica (la API ya distingue sus rutas) | Se descarta |
| Supabase Auth, correo + contraseña | Acceso del Prototipo | Entra ID | Se descarta |
| Pruebas SQL (146 aserciones) | Especificación ejecutable | Se traducen a pruebas de contrato de la API; los casos se conservan | Medio |
| Pruebas e2e (21) | Comportamiento de la interfaz | Se ejecutan sin cambios contra la SPA corporativa | Bajo |

## Cómo se mantiene la paridad
1. Contrato único de operaciones (nombres, parámetros, errores con campo).
2. Casos de prueba compartidos (`tests/contract/*.json`) evaluados contra servidor y aplicación.
3. Todo cambio de reglas se hace primero como caso de prueba y luego en ambos lados.

## Riesgos de la traducción
- **RLS → API** es la parte con más riesgo: hoy el filtro es automático en la base; en la API cada consulta debe aplicarlo explícitamente. Mitigación: pruebas de políticas (37 aserciones) convertidas en pruebas de la API antes de portar.
- Diferencias de dialecto (plpgsql ↔ T-SQL) en fechas, JSON y secuencias (`apih_siguiente`).
- Rendimiento con carga real no medido en ninguno de los dos.
