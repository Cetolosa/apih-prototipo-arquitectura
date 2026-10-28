#!/usr/bin/env node
/* Guardia de arquitectura: las reglas de negocio y los cálculos viven en el servidor; la SPA solo los presenta.
   Falla (código 1) si en js/ reaparece lo que ya se movió al servidor:
     1. nombres de reglas/cálculos retirados de la SPA (lista cerrada, más abajo);
     2. escrituras de la SPA sobre campos que escribe el servidor (avance, historial, fechas de fase, estrellas, escalamiento, línea base);
     3. llamadas a funciones del servidor (rpc / cmdServidor) que no existen en las migraciones.
   Lo que la SPA SÍ puede hacer: formatear, ordenar, filtrar por la vista elegida y sumar / contar / promediar valores que entrega el servidor.
   Pendientes declarados (aún en la SPA): ver docs/arquitectura-front.md, sección «Reglas que aún no se mueven». */
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..'), JS = path.join(RAIZ, 'js'), MIG = path.join(RAIZ, 'supabase', 'migrations');
const quitarComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const archivos = fs.readdirSync(JS).filter(f => f.endsWith('.js')).map(f => ({ f, s: quitarComentarios(fs.readFileSync(path.join(JS, f), 'utf8')) }));
const fallas = [];

// 1) reglas y cálculos que ya no deben existir en la SPA
const RETIRADOS = ['ADMIN_EMAILS', 'ADMIN_USERS', 'PESO_FASES', 'TOPE_SIN_AVANCE', 'aplicarCambioFase', 'aplicarEtapaLocal', 'aplicarFasesFechas', 'autoCompletar', 'avanceEn', 'avanceFaseCalc',
  'avanzoSemana', 'capCls', 'capDe', 'capFin', 'capIni', 'capMeses', 'congelarBase', 'distribuirFases', 'esAprobadorDe', 'escalarSync', 'etapasPosibles', 'fasesMaterializadas',
  'findingsPMO', 'findingsRiesgos', 'findingsRoadmap', 'gatesAprobar', 'michelinCalc', 'michelinSync', 'hitoATiempo', 'cambioAprob', 'resultadoOk', 'riesgoSinMit', 'moverFinPlan', 'notifPara', 'rolDeUser', 'normIni', 'planCambioFase',
  'rangoFases', 'reconciliarAvance', 'setRangoPlan', 'sinAvanceSostenido', 'sincAvance', 'starsHist', 'usuarioActual', 'usuarioSintetico', 'validarFasesFechas'];
archivos.forEach(({ f, s }) => RETIRADOS.forEach(n => { if (new RegExp('(^|[^\\w$.])' + n.replace(/\$/g, '\\$') + '(?![\\w$])').test(s)) fallas.push(`${f}: reapareció «${n}» (regla que vive en el servidor)`); }));

// 2) campos que escribe el servidor: la SPA no los asigna
const CAMPOS_SERVIDOR = [['avanceCalc', /\.avanceCalc\s*=(?!=)/], ['hist', /\.hist\s*(=(?!=)|\.push\()/], ['fasesFechas', /\.fasesFechas\s*=(?!=)/], ['michelin', /\.michelin\s*(=(?!=)|\.push\()/],
  ['escalada', /\.escalada\s*=(?!=)/], ['base', /\.base\s*=(?!=)/], ['baseHist', /\.baseHist\s*(=(?!=)|\.push\()/], ['hallazgos', /CALC\.hallazgos\s*(=(?!=)|\.push\()/]];
/* Excepciones declaradas (archivo → campo): 02-datos.js copia el valor que ENTREGA el servidor a la copia local (aplicarDerivados, sin marcarla como edición);
   06-administracion.js agrega el punto al historial al guardar la actualización semanal (residual: el servidor ya guarda su propio historial). */
const PERMITIDO = { '02-datos.js': ['avanceCalc', 'hist'], '06-administracion.js': ['hist'] };
archivos.forEach(({ f, s }) => CAMPOS_SERVIDOR.forEach(([n, rx]) => { if (rx.test(s) && !(PERMITIDO[f] || []).includes(n)) fallas.push(`${f}: la SPA escribe «${n}», que escribe el servidor`); }));

// 3) toda llamada al servidor existe en las migraciones
const definidas = new Set(); fs.readdirSync(MIG).filter(f => f.endsWith('.sql')).forEach(f => { for (const m of fs.readFileSync(path.join(MIG, f), 'utf8').matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(apih_[a-z0-9_]+)/gi)) definidas.add(m[1]); });
archivos.forEach(({ f, s }) => { for (const m of s.matchAll(/(?:rpc|cmdServidor|guardarEnServidor\))\(\s*['"](apih_[a-z0-9_]+)['"]/g)) if (!definidas.has(m[1])) fallas.push(`${f}: llama a «${m[1]}», que no existe en las migraciones`); });

// 4) entidades que se guardan solo por comando del servidor (apih_guardar_* / apih_eliminar): la SPA no las crea ni las borra en su copia local
const POR_COMANDO = [['hitos', 'apih_guardar_hito'], ['riesgos', 'apih_guardar_riesgo'], ['decisiones', 'apih_guardar_decision']];
/* Residuales declarados (archivo → entidades): flujos que aún escriben en bloque y se migran en la siguiente iteración
   (plantillas, «Con archivo», eliminar iniciativa con sus registros). Ver docs/arquitectura-front.md. */
const RESIDUAL_ESCRITURA = { '01-nucleo.js': ['hitos'], '03-interfaz.js': ['hitos', 'riesgos', 'decisiones'], '06-administracion.js': ['hitos', 'riesgos'] };
archivos.forEach(({ f, s }) => POR_COMANDO.forEach(([c, cmd]) => {
  if (new RegExp('St\\.' + c + '\\s*(\\.push\\(|=(?!=))').test(s) && !(RESIDUAL_ESCRITURA[f] || []).includes(c)) fallas.push(`${f}: escribe St.${c} directamente (se guarda con ${cmd})`);
}));

if (fallas.length) { console.error('GUARDIA DE ARQUITECTURA: ' + fallas.length + ' problema(s)\n - ' + fallas.join('\n - ')); process.exit(1); }
console.log('OK: guardia de arquitectura (' + archivos.length + ' módulos, ' + RETIRADOS.length + ' nombres vigilados, ' + definidas.size + ' funciones del servidor)');
