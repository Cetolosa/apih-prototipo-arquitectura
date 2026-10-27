# Pruebas e2e (Playwright, modo demo)

Preparación (cada sesión nueva):
```
mkdir -p /tmp/t/demo && cp index.html /tmp/t/demo/index.html && cp apih-config.js /tmp/t/ 
python3 -m http.server 8765 -d /tmp/t &
```
Ejecutar desde cualquier carpeta: `node tests/e2e/t10.js` (usa chromium en /opt/pw-browsers/chromium y el módulo /opt/npm-tools/node_modules/playwright).
Copiar `index.html` a `/tmp/t/demo/` antes de cada corrida. La demo no trae iniciativas: los scripts agregan una plantilla (ver h1.js).

Fixture para imp2/ia1: `mkdir -p /tmp/t/out && cp docs/APIH_iniciativas_con_plan.json /tmp/t/out/`.
Regresión mínima antes de publicar: xss1 (seguridad, V22.60), imp3 (importar/exportar subfases y categorías, V22.59), fin1 (versión final, V22.56), sf1 (subfases, V22.55), fz1 (vista Fases, V22.53), ps1 (Planificación en ficha y Siguientes pasos, V22.54), t10 (login, xlsx, CSP), t13 (a11y), t43 (historial), t44 (notificaciones), cap2 (capacidad), r1 (menú), c4 (panel), imp1/imp2 (importador), ia1 (Con Análisis).
Falsos positivos conocidos: t10 requiere red hacia Supabase (falla en la nube también con V22.52); ROI NaN en demo, overlay de celebración en capturas.

Corporativo: `tests/e2e/correr-corporativo.sh` corre corp1/corp2/corp3 y fin1/sf1/fz1/ps1 contra la SPA corporativa, cada una con base nueva (C2.14).
