#!/usr/bin/env bash
# Prueba migraciones y políticas en un Postgres temporal (no toca Supabase). Uso: bash tools/test-sql.sh
set -euo pipefail
PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin | tail -1)}; D=$(mktemp -d); PORT=${PGPORT_TEST:-54329}; ROOT=$(cd "$(dirname "$0")/.." && pwd)
chown postgres "$D" 2>/dev/null || true
run() { su postgres -c "$*"; }
# Copia legible por el usuario postgres: en un runner el repositorio está bajo un home al que ese usuario no entra.
mkdir -p "$D/work/tests" && cp -r "$ROOT/supabase" "$D/work/supabase" && cp -r "$ROOT/tests/contract" "$D/work/tests/contract" && { [ ! -d "$ROOT/pruebas-ti" ] || cp -r "$ROOT/pruebas-ti" "$D/work/pruebas-ti"; } && chmod -R a+rX "$D" "$D/work"
run "$PGBIN/initdb -D $D/data -A trust >/dev/null"
run "$PGBIN/pg_ctl -D $D/data -o '-p $PORT -k $D' -l $D/log -w start >/dev/null"
trap 'run "$PGBIN/pg_ctl -D $D/data stop >/dev/null" || true; rm -rf "$D"' EXIT
P="psql -h $D -p $PORT -U postgres -v ON_ERROR_STOP=1 -q postgres"
for f in supabase/tests/00_shim_supabase.sql supabase/migrations/*.sql supabase/seed.sql supabase/tests/10_politicas.sql supabase/tests/20_aprobar_propuesta.sql supabase/tests/30_decision_y_hito.sql supabase/tests/40_cambios_y_reapertura.sql supabase/tests/50_validacion.sql supabase/tests/60_contrato_compuertas.sql supabase/tests/70_snapshots.sql supabase/tests/80_escritura_api.sql supabase/tests/80_campos.sql supabase/tests/90_ciclo_de_vida.sql supabase/tests/95_contexto.sql supabase/tests/96_calculos.sql supabase/tests/97_plan_avance.sql supabase/tests/98_importar.sql supabase/tests/99_mantener.sql supabase/tests/100_hallazgos.sql supabase/tests/101_cielo.sql supabase/tests/102_capacidad.sql supabase/tests/103_auditoria.sql supabase/tests/104_guardar.sql supabase/tests/105_iniciativa.sql supabase/tests/106_compromiso.sql supabase/tests/107_comite.sql supabase/tests/108_avisos.sql supabase/tests/109_resumen.sql supabase/tests/110_personas.sql supabase/tests/111_mision.sql supabase/tests/112_pasos.sql supabase/tests/113_bitacora_sello.sql${SQL_EXTRA:+ $SQL_EXTRA}; do
  echo "== $f"
  set +e
  run "cd $D/work && $PGBIN/psql -h $D -p $PORT -U postgres -v ON_ERROR_STOP=1 -q -t -A postgres -f $f" > "$D/out.txt" 2>&1; rc=$?
  set -e
  sed 's/^psql:[^ ]* NOTICE:  //' "$D/out.txt" | grep -v '^$' | grep -v 'does not exist, skipping' || true
  [ "$rc" = 0 ] || { echo "ERROR en $f (código $rc)"; echo "::error title=SQL $f::$(grep -v NOTICE "$D/out.txt" | head -8 | tr '\n' ' ' | cut -c1-600)"; exit 1; }
done
