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
  202608200001_webpay_return_context.sql \
  202608210001_instagram_story_captures.sql \
  202608220001_instagram_story_schedule.sql \
  202608220003_instagram_story_regeneration.sql \
  202608220004_instagram_story_five_slots.sql \
  202608230001_instagram_story_reusable_cycles.sql \
  202608230002_instagram_story_fill_earliest_gap.sql \
  202608230003_instagram_story_publication_calendar_index.sql \
  202608240002_persist_signup_phone.sql \
  202608260001_remove_sold_product_stories.sql \
  202608260004_admin_view_performance.sql \
  202608260005_admin_navigation_performance.sql \
  202608310001_admin_metrics_since_date.sql \
  202609010001_delivery_email_automation.sql \
  202609010002_pickup_by_coordination.sql \
  202609010003_starken_shipping_source.sql \
  202609020001_starken_flat_rates.sql
do
  psql -v ON_ERROR_STOP=1 -d "$test_database" \
    -f "$repository_root/supabase/migrations/$migration"
done

psql -v ON_ERROR_STOP=1 -d "$test_database" \
  -f "$repository_root/supabase/tests/admin_view_performance.sql"
psql -v ON_ERROR_STOP=1 -d "$test_database" \
  -f "$repository_root/supabase/tests/admin_metrics_since_date.sql"
psql -v ON_ERROR_STOP=1 -d "$test_database" \
  -f "$repository_root/supabase/tests/commerce_operations.sql"
psql -v ON_ERROR_STOP=1 -d "$test_database" \
  -f "$repository_root/supabase/tests/delivery_email_automation.sql"
psql -v ON_ERROR_STOP=1 -d "$test_database" \
  -f "$repository_root/supabase/tests/starken_shipping.sql"
psql -v ON_ERROR_STOP=1 -d "$test_database" \
  -f "$repository_root/supabase/tests/starken_flat_rates.sql"
psql -v ON_ERROR_STOP=1 -d "$test_database" \
  -f "$repository_root/supabase/tests/marketplace_security.sql"
psql -v ON_ERROR_STOP=1 -d "$test_database" \
  -f "$repository_root/supabase/tests/commerce_permissions.sql"
psql -v ON_ERROR_STOP=1 -d "$test_database" \
  -f "$repository_root/supabase/tests/checkout_address.sql"
psql -v ON_ERROR_STOP=1 -d "$test_database" \
  -f "$repository_root/supabase/tests/webpay_return_context.sql"
psql -v ON_ERROR_STOP=1 -d "$test_database" \
  -f "$repository_root/supabase/tests/instagram_story_captures.sql"
psql -v ON_ERROR_STOP=1 -d "$test_database" \
  -f "$repository_root/supabase/tests/instagram_story_schedule.sql"
psql -v ON_ERROR_STOP=1 -d "$test_database" \
  -f "$repository_root/supabase/tests/instagram_story_sold_cleanup.sql"
