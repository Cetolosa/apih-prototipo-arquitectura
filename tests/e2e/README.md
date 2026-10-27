# Pruebas e2e (Playwright, modo demo)

## Cómo correr
```
node tools/correr-e2e.js            # suite oficial (lista PRUEBAS en el script); levanta y apaga el servidor demo
node tools/servir-demo.js &         # solo servidor (puerto 8765, PORT=… para cambiarlo); guardar el PID para detenerlo
node tests/e2e/<prueba>.js          # una prueba suelta con el servidor ya levantado
```
`tools/servir-demo.js` sirve `/demo/index.html`, `/js`, `/css`, `/apih-config.js` y `/out/` (fixtures de `docs/seed`).
La SPA usa **módulos ES reales**: no abre desde `file://` (hay que servirla por HTTP). Las pruebas escriben nombres sueltos
(`St`, `Acts`, `toast`…), que los módulos no exponen; el servidor demo agrega a su copia `/demo/puente-pruebas.js`
(solo demo, nunca parte de la app publicada) que los publica en `window` usando los registros `ENLACES`.

## Suite oficial
sin-externos (CSP de scripts y estilos sin `unsafe-inline`, sin violaciones en consola, sin hosts externos, lint de términos),
xss1, imp3, fin1, fz1, t13, t43, t44, cap2, r1, c4, imp1, imp2, cfgu1, aprob-srv, cmd-srv, gates-contract, campo-srv, servidor-ficticio (capa de datos con PostgREST emulado).
Pendientes (requieren fixture propio): ps1, sf1.

## Falsos positivos / fallas heredadas
Fallan igual en la versión clásica anterior a la división en módulos (verificado con la línea base): ia1, notif1, sem1, standby1, t10
(t10 pide red hacia Supabase). ROI NaN en demo; overlay de celebración en capturas.

## Otras verificaciones estáticas
`node tools/verificar-modulos.js` (orden y dependencias de `js/`), `node tools/lint-terminos.js` (términos vetados en código, CSS y UI),
`tools/test-sql.sh` (Postgres local con el shim de Supabase: políticas, comandos del servidor y contrato de compuertas).
