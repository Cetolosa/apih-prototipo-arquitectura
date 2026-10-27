// Pruebas TI · H17 · Higiene del repositorio: .gitattributes con LF y README raíz que oriente.
const fs = require('fs'), path = require('path');
module.exports = raiz => {
  const e = f => fs.existsSync(path.join(raiz, f)), fallas = [];
  if (!e('.gitattributes') || !/eol=lf/.test(fs.readFileSync(path.join(raiz, '.gitattributes'), 'utf8'))) fallas.push('falta .gitattributes con eol=lf');
  if (!e('README.md')) fallas.push('no hay README.md en la raíz');
  return fallas.length ? { estado: 'ABIERTO', evidencia: fallas.join('; ') + ' (no evalúa el tamaño de los commits: el clon es superficial)' }
    : { estado: 'CERRADO', evidencia: '.gitattributes con eol=lf y README.md en la raíz (no evalúa el tamaño de los commits)' };
};
