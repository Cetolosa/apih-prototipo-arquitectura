// Pruebas TI · H16 · Las pruebas corren en CI y publican reporte (JUnit o cobertura).
const fs = require('fs'), path = require('path');
module.exports = raiz => {
  const d = path.join(raiz, '.github/workflows'), ci = fs.existsSync(path.join(d, 'ci.yml')) ? fs.readFileSync(path.join(d, 'ci.yml'), 'utf8') : '';
  const fallas = [];
  if (!/test:e2e/.test(ci)) fallas.push('el e2e no corre en CI');
  if (!/test-sql/.test(ci)) fallas.push('las pruebas SQL no corren en CI');
  if (!/junit|coverage|upload-artifact/i.test(ci)) fallas.push('la CI no publica reporte JUnit ni cobertura');
  return fallas.length ? { estado: 'ABIERTO', evidencia: fallas.join('; ') } : { estado: 'CERRADO', evidencia: 'e2e y SQL corren en CI y publican reporte' };
};
