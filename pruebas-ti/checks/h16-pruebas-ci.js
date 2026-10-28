// Pruebas TI · H16 · Las pruebas corren en CI y publican reporte (JUnit o cobertura).
const fs = require('fs'), path = require('path');
module.exports = raiz => {
  const d = path.join(raiz, '.github/workflows'), ci = fs.existsSync(path.join(d, 'ci.yml')) ? fs.readFileSync(path.join(d, 'ci.yml'), 'utf8') : '';
  const fallas = [];
  if (!/test:e2e/.test(ci)) fallas.push('el e2e no corre en CI');
  if (!/test-sql/.test(ci)) fallas.push('las pruebas SQL no corren en CI');
  if (!/junit/i.test(ci) || !/upload-artifact/.test(ci)) fallas.push('la CI no publica el reporte JUnit del e2e como artefacto');
  if (!/pruebas-ti/.test(ci)) fallas.push('Pruebas TI no corre en CI');
  return fallas.length ? { estado: 'ABIERTO', evidencia: fallas.join('; ') } : { estado: 'CERRADO', evidencia: 'e2e, SQL y Pruebas TI corren en CI; el reporte JUnit del e2e y el informe de Pruebas TI se publican como artefactos (la cobertura de código no se mide)' };
};
