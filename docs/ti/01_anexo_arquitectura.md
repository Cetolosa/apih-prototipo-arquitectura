# Anexo de arquitectura · APIH Prototipo (referencia de las decisiones de TI)

Propósito: evidenciar, en un entorno de pruebas fuera de Aramark y con datos sintéticos, que las decisiones de la revisión de TI funcionan de punta a punta. Este documento describe el Prototipo; la traducción a Corporativo está en `02_mapa_portabilidad.md`.

## 1. Decisiones de TI y dónde se cumplen
| Decisión | Cómo queda en el Prototipo | Evidencia |
| --- | --- | --- |
| Autorización por rol, área y monto aplicada en la API (no en la interfaz) | Políticas de fila por área, vista que oculta montos, disparador que valida cada escritura y comandos transaccionales | `supabase/tests/10_politicas.sql` (37 aserciones) y siguientes |
| Infraestructura como código | Esquema, políticas y comandos solo por migraciones versionadas (`supabase/migrations`, 9 archivos); nada se crea a mano. Terraform corresponde a Corporativo | las migraciones se aplican en orden sobre una base vacía en `tools/test-sql.sh` (el trabajo de CI equivalente está definido; aún no verificado en un runner) |
| Sin integraciones ni funciones de IA | No existen en código, textos ni interfaz; el análisis es de reglas deterministas | `tools/lint-terminos.js` (falla el CI si reaparece un término) |
| Exportar/importar JSON se mantiene | Sigue disponible; el importador valida y respeta los permisos del servidor | pruebas imp1–imp3 |

## 2. Capas
```
SPA estática (módulos ES, sin build; CSP sin 'unsafe-inline' en scripts ni elementos de estilo)
   │  HTTPS + JWT de la persona
   ▼
API de datos (PostgREST) ── lecturas por vista registros_v (montos redactados)
                         ── escrituras filtradas por política y por disparador apih_fila
                         ── comandos RPC transaccionales (SECURITY DEFINER)
   ▼
PostgreSQL: registros(lista, id, datos) · perfiles · auditoria · claves_monto · dominios_permitidos
```

## 3. Modelo de autorización
- Perfil por persona (`perfiles`): rol de base `admin | editor | lector`, `areas[]`, `ve_todo`, `ve_montos`, `gobierna`.
- Rol de la aplicación ← rol de base: **Administra** = admin; **Responsable** = editor con `gobierna`; **Colaborador** = editor sin `gobierna`; **Invitado** = lector. Tabla de equivalencias completa en `APIH_equivalencia_roles.xlsx`.
- Lectura: solo registros del área de la persona (o todas si `ve_todo`). Los campos de monto (`claves_monto`: presupuesto, gastado, beneficio, ahorroReal, monto, costo, pNue, pAnt) se entregan redactados si no tiene `ve_montos`.
- Escritura: Colaborador y Responsable solo sobre su área y fuera de las listas administrativas; Administra sobre todo. Modificar un monto sin `ve_montos` se ignora en el servidor.
- Presentaciones congeladas (`psnap:*`, con datos de quien las generó): solo las lee y modifica su dueña (quien las creó) y Administra. `eventos`, `pres` y `ptpl` son colecciones compartidas sin datos de iniciativas.
- Acceso solo con correos de dominios permitidos (`dominios_permitidos`).

## 4. Reglas que viven en el servidor
- **Disparador `apih_fila`**: sella `modificado_por`, deriva `area`, valida el contenido (`apih_validar`), protege montos y escribe `auditoria`. El cliente no puede falsear autor ni área.
- **Comandos** (devuelven errores estructurados con el campo afectado): `apih_aprobar_propuesta`, `apih_resolver_decision`, `apih_hito_estado`, `apih_solicitar_cambio`, `apih_resolver_cambio`, `apih_reabrir`. Cada uno comprueba rol, área y monto, y registra en bitácora dentro de la misma transacción.
- **Compuertas de aprobación**: una sola definición (`apih_faltan_aprobar`) usada por el servidor y por la interfaz; ambas se prueban contra el mismo archivo de casos (`tests/contract/gates_aprobar.json`).
- **Concurrencia optimista**: una actualización solo se aplica si el registro conserva la versión leída; si no, la interfaz informa y no pisa el cambio ajeno.
- **Auditoría**: cada escritura queda en `auditoria`; solo Administra puede leerla.

## 5. Seguridad del cliente
- CSP: `script-src 'self'`, `style-src-elem 'self'`, `connect-src` solo al origen y al servidor de datos. Los atributos `style=""` de las plantillas son lo único en línea (`style-src-attr`).
- Sin secretos en el repositorio; la clave pública del servidor es pública por diseño y la seguridad real está en el inicio de sesión individual y en las políticas.
- Sanitización de HTML en el render y prueba de XSS (`xss1`).

## 6. Pruebas
| Capa | Qué | Cantidad |
| --- | --- | --- |
| Base de datos | Políticas, comandos, validación y contrato de compuertas, sobre PostgreSQL 16 local | ~157 aserciones, 8 archivos |
| Aplicación | e2e Playwright (suite oficial) | 21 pruebas, incluida una que ejecuta la capa de datos contra un servidor REST emulado |
| Estáticas | Términos vedados, orden de módulos, CSP | 3 verificaciones |

## 7. Alcance y límites declarados
- Datos 100 % sintéticos; dos cuentas de prueba (Administra y Colaborador de un área de prueba).
- No se probó rendimiento con carga real, red privada, WAF ni pruebas de intrusión.
- El inicio de sesión del Prototipo es correo + contraseña; en Corporativo corresponde SSO con Entra ID.
