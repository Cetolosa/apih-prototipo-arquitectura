#!/usr/bin/env node
// Une todas las migraciones, en orden, en UN archivo para pegarlo en el SQL Editor de Supabase (supabase/aplicar_en_supabase.sql).
// Cada migración es repetible (create or replace / if not exists), así que sirve tanto para un proyecto nuevo como para uno ya migrado.
const fs = require('fs'), path = require('path'), D = path.join(__dirname, '..', 'supabase', 'migrations');
const fs_ = fs.readdirSync(D).filter(f => f.endsWith('.sql')).sort();
const out = ['-- APIH Prototipo · TODAS las migraciones en orden (generado por tools/empaquetar-migraciones.js; no editar a mano).',
  '-- Pegar completo en Supabase → SQL Editor → Run. Se puede ejecutar más de una vez (no borra datos: solo reglas, funciones y la vista de lectura).', '',
  '-- La vista de lectura se recrea (las migraciones antiguas la definen con menos columnas que las nuevas).', 'drop view if exists public.registros_v;', ''];
fs_.forEach(f => out.push('-- ===== ' + f + ' =====', fs.readFileSync(path.join(D, f), 'utf8').trim(), ''));
fs.writeFileSync(path.join(__dirname, '..', 'supabase', 'aplicar_en_supabase.sql'), out.join('\n'));
console.log(fs_.length + ' migraciones → supabase/aplicar_en_supabase.sql');
