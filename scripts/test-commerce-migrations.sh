#!/usr/bin/env bash
set -euo pipefail

readonly test_database="reskichile_commerce_migration_test"
readonly repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
created_database=false

cleanup() {
  local exit_status=$?
  trap - EXIT
  if [[ "$created_database" == "true" ]]; then
    dropdb --if-exists "$test_database"
  fi
  exit "$exit_status"
}
trap cleanup EXIT

if psql -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = '$test_database'" | grep -qx 1; then
  echo "Refusing to overwrite existing database: $test_database" >&2
  exit 1
fi

createdb "$test_database"
created_database=true

psql -v ON_ERROR_STOP=1 -d "$test_database" \
  -f "$repository_root/supabase/tests/bootstrap.sql"

for migration in \
  202608140001_commerce_webpay_foundation.sql \
  202608150001_commerce_payment_hardening.sql \
  202608170001_remove_seasons_used.sql \
  202608170002_ski_rack_inventory.sql \
  202608180001_commerce_operations.sql \
  202608180002_marketplace_security_hardening.sql \
  202608180003_zero_unverified_ski_rack_inventory.sql \
  202608180004_lock_down_commerce_rpcs.sql \
  202608190001_checkout_validated_address.sql \
  202608200001_webpay_return_context.sql
do
  psql -v ON_ERROR_STOP=1 -d "$test_database" \
    -f "$repository_root/supabase/migrations/$migration"
done

psql -v ON_ERROR_STOP=1 -d "$test_database" \
  -f "$repository_root/supabase/tests/commerce_operations.sql"
psql -v ON_ERROR_STOP=1 -d "$test_database" \
  -f "$repository_root/supabase/tests/marketplace_security.sql"
psql -v ON_ERROR_STOP=1 -d "$test_database" \
  -f "$repository_root/supabase/tests/commerce_permissions.sql"
psql -v ON_ERROR_STOP=1 -d "$test_database" \
  -f "$repository_root/supabase/tests/checkout_address.sql"
psql -v ON_ERROR_STOP=1 -d "$test_database" \
  -f "$repository_root/supabase/tests/webpay_return_context.sql"
