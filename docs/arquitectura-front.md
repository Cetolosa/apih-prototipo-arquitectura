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
