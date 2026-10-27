# Comprar vs. construir · APIH

Análisis cualitativo, sin precios ni licencias (validar cifras con Compras y TI antes de decidir).

## Qué necesita APIH (resumen)
Portafolio de propuestas y proyectos con compuertas de aprobación, hitos y riesgos, control de cambios, bitácora, presentaciones ejecutivas generadas desde los datos, autorización por área y por monto, y exportación/importación JSON. Operación en español y con metodología propia de Aramark.

## Alternativas
| Opción | Ventajas | Limitaciones frente a la necesidad |
| --- | --- | --- |
| Herramienta PPM comercial (portafolio y proyectos) | Producto mantenido por un proveedor, soporte, integraciones estándar | Metodología y compuertas propias requieren configuración o personalización; costo por usuario; datos fuera del control directo; ciclo de contratación |
| Microsoft Planner/Project + Power BI sobre SharePoint/Dataverse | Ya licenciado, SSO nativo | Autorización por área y por monto difícil de garantizar en servidor; presentaciones y compuertas a medida; depende de Power Automate y permisos de listas |
| Construcción propia (APIH) | Ajuste exacto a la metodología, presentaciones 1 a 1, reglas en servidor, costo de licencias nulo | Mantenimiento propio; requiere dueño técnico y estándares de TI (3 capas, Terraform) |

## Criterios para decidir
1. **Ajuste a la metodología**: compuertas, tipos de iniciativa y presentaciones propias.
2. **Seguridad**: autorización por área y monto aplicada en el servidor; auditoría.
3. **Costo total a 3 años**: licencias (comprar) vs. horas de mantenimiento y hosting (construir).
4. **Tiempo hasta uso productivo**: APIH ya está construido y probado; una compra suma contratación e implementación.
5. **Dependencia y salida**: exportación JSON permite migrar los datos a otra herramienta.
6. **Carga para TI**: construir exige que TI reciba y opere un servicio; comprar traslada operación al proveedor.

## Postura propuesta
Continuar con la construcción propia **bajo los estándares de TI** (3 capas, Terraform, autorización en la API), manteniendo la exportación JSON como vía de salida, y revisar la compra si TI prefiere no operar un servicio propio. La comparación con cifras reales queda pendiente de Compras.
