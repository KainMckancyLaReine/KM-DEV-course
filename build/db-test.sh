#!/usr/bin/env bash
# Applies db/schema.sql and db/seed.sql to a throwaway Postgres and then checks
# that the security properties actually hold — that a student cannot read
# another account's rows, cannot see which answer is correct, cannot reach an
# admin function and cannot promote themselves.
#
#   sudo apt-get install -y postgresql
#   bash build/db-test.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PGPORT_TEST:-55432}"
DATA="${PGDATA_TEST:-/tmp/km-pgdata}"
BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)"
export PATH="$PATH:$BIN"

if ! pg_isready -h /tmp -p "$PORT" >/dev/null 2>&1; then
  rm -rf "$DATA"; mkdir -p "$DATA"
  if [ "$(id -un)" = "root" ]; then
    chown postgres:postgres "$DATA"
    su postgres -c "PATH=\$PATH:$BIN initdb -D $DATA -U postgres --auth=trust" >/dev/null
    su postgres -c "PATH=\$PATH:$BIN pg_ctl -D $DATA -l /tmp/km-pg.log -o '-p $PORT -k /tmp' start" >/dev/null
  else
    initdb -D "$DATA" -U postgres --auth=trust >/dev/null
    pg_ctl -D "$DATA" -l /tmp/km-pg.log -o "-p $PORT -k /tmp" start >/dev/null
  fi
  sleep 2
fi

PSQL="psql -h /tmp -p $PORT -U postgres"
$PSQL -q -c "drop database if exists kmtest;" -c "create database kmtest;"
$PSQL -d kmtest -q -v ON_ERROR_STOP=1 -f "$HERE/build/pg-stub.sql" >/dev/null
$PSQL -d kmtest -q -v ON_ERROR_STOP=1 -f "$HERE/db/schema.sql"     >/dev/null 2>&1
$PSQL -d kmtest -q -v ON_ERROR_STOP=1 -f "$HERE/db/seed.sql"       >/dev/null 2>&1
$PSQL -d kmtest -q -v ON_ERROR_STOP=1 -f "$HERE/db/phase15.sql"    >/dev/null 2>&1
echo "schema, seed and paid access applied"
for t in pg-test pg15-test; do
  $PSQL -d kmtest -f "$HERE/build/$t.sql" 2>&1 \
    | grep -E "PASS|FAIL|ERROR" | sed 's/^psql:[^ ]* //;s/^NOTICE:  //'
done

if { $PSQL -d kmtest -f "$HERE/build/pg-test.sql";
     $PSQL -d kmtest -f "$HERE/build/pg15-test.sql"; } 2>&1 | grep -q FAIL; then
  echo "FAILURES"; exit 1
fi
echo "all database checks passed"
