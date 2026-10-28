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

## Ciclo de vida (V23)
Cambio de etapa único, avance calculado y fechas por fase: ver [ciclo-de-vida.md](ciclo-de-vida.md). La lógica vive en `js/05-vistas.js` (avance, fechas) y `js/04-flujos.js` (diálogo), con espejo en SQL (`20261027001100_ciclo_de_vida.sql`) verificado por contratos compartidos.

## Una sola fuente de reglas: el servidor (backend único)
La SPA presenta; **el servidor decide y calcula**. Permisos (`apih_contexto`, `registros_v.puede_editar`, RLS), compuertas, avance y fechas de fase, puntajes de priorización, semáforos, hallazgos/alertas, EVM, capacidad, estrellas e insignias («cielo»), línea base y escalamiento de decisiones, y la auditoría por campos viven en funciones `apih_*` de `supabase/migrations/` (equivalente de la API de TI). El cliente lee el resultado (`CALC`, `CIELO()`) y ejecuta comandos con `cmdServidor` (una vía por operación).
- Guardia: `node tools/guardia-reglas.js` (CI) falla si reaparece una regla retirada en `js/`, si la SPA escribe campos del servidor o si llama a un `apih_*` inexistente.
- Pruebas: `tools/test-sql.sh` (reglas en Postgres), `tools/correr-e2e.js` (flujos contra backend real de pruebas).

### Formularios por comando del servidor
Hitos, riesgos, decisiones, iniciativas, **compromisos** (`apih_guardar_compromiso`) y **comités** (`apih_guardar_comite`, `apih_comite_agregar/quitar/marcar/sugerido/armar/cerrar`); eliminar: `apih_eliminar`. Ids, valores iniciales, fecha real, agenda y bitácora los fija el servidor.

### Avisos (notificaciones)
`apih_calculos().notif` entrega el catálogo, la preferencia efectiva (catálogo → organización → persona) y los avisos de quien llama (hitos y compromisos, riesgo crítico, decisiones, atraso, sin actualizar, propuestas estancadas, cambios y eventos de bitácora), con sus canales. La campana y la matriz de Notificaciones solo presentan; guardar la configuración hace que el servidor vuelva a evaluar. Lo leído sigue por navegador (localStorage).

### Reglas que aún no se mueven (residuales declarados)
Contenido de las anotaciones de bitácora que escribe el cliente (autor y hora ya los fija el servidor), validaciones de formulario de otras pantallas.

## Resumen ejecutivo y KPIs
`apih_resumen(calc)` (dentro de `apih_calculos`) entrega qué proyectos están «on track», los tramos del % On Track (texto y nivel) y las ventanas de días del resumen. El cliente solo los muestra (`CALC.resumen`, `tonoOnTrack`).

## Directorio de personas
`apih_personas_dir()` (dentro de `apih_calculos`, clave `personas`) calcula por persona sus roles, áreas, cargo, acceso y lo abierto a su cargo (proyectos vivos, hitos y vencidos, riesgos, decisiones, acciones de comité). La vista Personas solo filtra y muestra.

## Misión de Mi cocina
`apih_mision(calc)` (clave `mision` de `apih_calculos`) entrega por iniciativa los hitos vencidos sin cerrar, los compromisos vencidos y los riesgos por atender (revisión vencida o crítico sin mitigación). La SPA solo arma los textos. Los «Siguientes pasos» (`pasosDe`) siguen calculándose en el cliente.

## Siguientes pasos
`apih_pasos` (dentro de `apih_cielo().pasos`) decide qué conviene hacer en cada iniciativa: hitos vencidos, de hoy y de la semana, tenedor «Al día», riesgos (mitigación y revisión), compromisos por vencer y compuerta de fase, con su urgencia (hoy / esta semana / próximo). La SPA solo oculta pasos por preferencia personal y agrega las descripciones. Si el cielo está desactivado en la configuración, no hay pasos.

## Bitácora: autoría y hora
El disparador `apih_bitacora_sello` fija el autor (la persona autenticada) y la hora (Santiago) de toda anotación nueva que escribe el cliente (`log()`), y deja inmutables autor, hora, tipo, iniciativa y texto de las existentes. La administración y los comandos del servidor quedan fuera (cargan historial o ya firman bien).

## Cargas por lote
La carga desde Excel y «Completar con archivo» siguen leyendo y previsualizando el archivo en el navegador, pero ya no escriben datos: arman la lista de cambios y la envían a `apih_cargar_lote`, que aplica cada fila con las mismas reglas y permisos de los formularios (`apih_guardar_iniciativa` / `_hito` / `_riesgo`), omite e informa las inválidas y deja una sola anotación en la bitácora. La fecha real de un hito la fija el servidor. `aplicarPlantilla` se eliminó (la plantilla de hitos la aplica el servidor al crear). La guardia ya no admite escrituras directas de hitos, riesgos ni decisiones. Además se corrigió `apih_guardar_iniciativa`: al cambiar el rango de un proyecto con fases ya fechadas, las fases se reescalan (antes volvía el rango anterior).

## Actualización semanal
`apih_actualizacion_semanal` valida y guarda la actualización (avance como ajuste manual, RAG, fin estimado, logros, próximos pasos, issue), marca la fecha, deja la foto semanal de fases y subfases (`snapFase`) y escribe la bitácora; «Sin novedades» solo confirma vigencia. El historial de avance (`hist`) lo mantiene el servidor. La guardia ya no permite que `06-administracion.js` escriba `hist`.

## Comentarios y acciones del Reglas PMO

`apih_comentar` (autor y hora los fija el servidor), `apih_aplicar_rag` (usa el RAG que calcula el servidor), `apih_avance_auto`, `apih_recordar_avance` y `apih_accion_recuperacion` (crea la acción en el próximo comité programado; solo quien gobierna). El cliente solo invoca el comando.
