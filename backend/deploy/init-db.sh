#!/usr/bin/env bash
set -euo pipefail

# The official image sources this script only when initializing an empty volume.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set=app_password="$ROAMBOARD_DB_PASSWORD" <<'SQL'
CREATE ROLE roamboard_user LOGIN PASSWORD :'app_password';
ALTER DATABASE roamboard_dev OWNER TO roamboard_user;
GRANT ALL ON SCHEMA public TO roamboard_user;
SQL

for migration in /roamboard-migrations/*.sql; do
    psql -v ON_ERROR_STOP=1 \
        --username roamboard_user --dbname "$POSTGRES_DB" --file "$migration"
done
