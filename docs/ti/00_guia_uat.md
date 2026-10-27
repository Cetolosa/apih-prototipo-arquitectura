# Guía de pruebas de aceptación (UAT) · Prototipo de arquitectura

Cuentas de prueba: `tolosa-christian@aramark.cl` (Administra) y `cetolosa@gmail.com` (Colaborador del «Área de prueba», sin montos). Datos anonimizados (derivados de un portafolio real, sin nombres, montos ni textos originales).

| # | Escenario | Con la cuenta | Resultado esperado |
| --- | --- | --- | --- |
| 1 | Iniciar sesión y ver datos | ambas | Entra con correo y contraseña; el Colaborador ve solo su área |
| 2 | Ver montos | Colaborador | Presupuesto, gasto y beneficio aparecen ocultos; Administra los ve |
| 3 | Editar fuera de su área | Colaborador | El servidor rechaza el cambio con mensaje y marca el campo |
| 4 | Aprobar una propuesta con compuertas incompletas | Administra | Rechazo con la lista de condiciones faltantes |
| 5 | Aprobar una propuesta completa | Administra | Se crea el proyecto y queda registro en bitácora |
| 6 | Resolver una decisión | Responsable/Administra | La decisión y su efecto se aplican en una sola transacción |
| 7 | Solicitar y resolver un cambio (fecha/presupuesto) | Colaborador solicita; Administra resuelve | El cambio de presupuesto exige permiso de montos |
| 8 | Reabrir un proyecto cerrado | Administra | Solo Administra puede; exige motivo |
| 9 | Conflicto de edición | dos sesiones | La segunda edición no pisa a la primera y avisa |
| 10 | Exportar e importar JSON | Administra | Los datos vuelven completos; el servidor aplica sus reglas |
| 11 | Cerrar sesión y recargar | ambas | Pide iniciar sesión de nuevo |
| 12 | Revisión de términos | revisor | Sin términos vedados (lista en `tools/lint-terminos.js`) en pantallas, código ni funciones |

Registrar cada resultado como OK / Falla / Observación con captura. Automatizado hoy: 3, 4, 5, 6, 7, 9 (servidor y e2e); manual: 1, 2, 8, 11 con sesión real.
