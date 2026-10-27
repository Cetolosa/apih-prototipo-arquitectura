#!/usr/bin/env bash
# Prueba migraciones y políticas en un Postgres temporal (no toca Supabase). Uso: bash tools/test-sql.sh
set -euo pipefail
PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin | tail -1)}; D=$(mktemp -d); PORT=${PGPORT_TEST:-54329}; ROOT=$(cd "$(dirname "$0")/.." && pwd)
chown postgres "$D" 2>/dev/null || true
run() { su postgres -c "$*"; }
run "$PGBIN/initdb -D $D/data -A trust >/dev/null"
run "$PGBIN/pg_ctl -D $D/data -o '-p $PORT -k $D' -l $D/log -w start >/dev/null"
trap 'run "$PGBIN/pg_ctl -D $D/data stop >/dev/null" || true; rm -rf "$D"' EXIT
P="psql -h $D -p $PORT -U postgres -v ON_ERROR_STOP=1 -q postgres"
for f in supabase/tests/00_shim_supabase.sql supabase/migrations/*.sql supabase/seed.sql supabase/tests/10_politicas.sql supabase/tests/20_aprobar_propuesta.sql supabase/tests/30_decision_y_hito.sql supabase/tests/40_cambios_y_reapertura.sql supabase/tests/50_validacion.sql; do
  echo "== $f"
  set +e
  run "cd $ROOT && $PGBIN/psql -h $D -p $PORT -U postgres -v ON_ERROR_STOP=1 -q -t -A postgres -f $f" > "$D/out.txt" 2>&1; rc=$?
  set -e
  sed 's/^psql:[^ ]* NOTICE:  //' "$D/out.txt" | grep -v '^$' | grep -v 'does not exist, skipping' || true
  [ "$rc" = 0 ] || { echo "ERROR en $f (código $rc)"; exit 1; }
done
