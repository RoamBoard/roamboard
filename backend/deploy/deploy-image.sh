#!/usr/bin/env bash
set -Eeuo pipefail

image_tag="${1:-}"
repo_path="${2:-/home/azureuser/roamboard}"

if [[ ! "$image_tag" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Expected a full commit SHA for the image tag." >&2
    exit 1
fi

if [[ "$repo_path" != /* || ! -d "$repo_path/.git" ]]; then
    echo "The configured VM checkout path is missing or invalid." >&2
    exit 1
fi

env_file="$repo_path/backend/.env"
deploy_path="$repo_path/backend/deploy"
if [[ ! -f "$env_file" || ! -f "$deploy_path/compose.yaml" ]]; then
    echo "The VM needs backend/.env and backend/deploy/compose.yaml before automatic deployment." >&2
    exit 1
fi

read_env_value() {
    sed -n "s/^$1=//p" "$env_file" | tail -n 1
}

previous_tag="$(read_env_value IMAGE_TAG)"
ready_tag="$(read_env_value MIGRATION_READY_TAG)"
public_domain="$(read_env_value PUBLIC_DOMAIN)"

if [[ ! "$previous_tag" =~ ^[0-9a-f]{40}$ ]]; then
    echo "First deploy a known-good commit manually and set IMAGE_TAG in backend/.env." >&2
    exit 1
fi
if [[ ! "$public_domain" =~ ^[A-Za-z0-9.-]+$ ]]; then
    echo "PUBLIC_DOMAIN must be a hostname in backend/.env." >&2
    exit 1
fi

repo_owner="$(stat -c %U "$repo_path")"
repo_git() {
    sudo -n -H -u "$repo_owner" git -C "$repo_path" "$@"
}

repo_git fetch --quiet origin main
repo_git cat-file -e "$previous_tag^{commit}"
repo_git cat-file -e "$image_tag^{commit}"
if ! repo_git merge-base --is-ancestor "$image_tag" refs/remotes/origin/main; then
    echo "The requested commit is not on origin/main." >&2
    exit 1
fi
if ! repo_git merge-base --is-ancestor "$previous_tag" "$image_tag"; then
    echo "Automatic deployment will not move backward from the currently deployed commit." >&2
    exit 1
fi

changed_migrations="$(repo_git diff --name-only "$previous_tag" "$image_tag" -- backend/db/migrations)"
if [[ -n "$changed_migrations" && "$ready_tag" != "$image_tag" ]]; then
    echo "Deployment stopped: SQL migrations changed since the deployed commit." >&2
    echo "Apply and record them manually, set MIGRATION_READY_TAG=$image_tag in backend/.env, then rerun this job." >&2
    exit 1
fi

changed_infrastructure="$(repo_git diff --name-only "$previous_tag" "$image_tag" -- backend/deploy/compose.yaml backend/deploy/Caddyfile backend/deploy/init-db.sh)"
if [[ -n "$changed_infrastructure" ]]; then
    echo "Deployment stopped: VM Compose, Caddy, or database initialization files changed since the deployed commit." >&2
    echo "Update the VM checkout, set IMAGE_TAG=$image_tag, pull both images, deploy the full Compose stack, verify it, then rerun this job." >&2
    exit 1
fi

cd "$deploy_path"
resolved_images="$(IMAGE_TAG="$image_tag" docker compose --env-file ../.env config --images)"
if ! grep -Fxq "ghcr.io/roamboard/roamboard-backend:$image_tag" <<< "$resolved_images" ||
   ! grep -Fxq "ghcr.io/roamboard/roamboard-frontend:$image_tag" <<< "$resolved_images"; then
    echo "The VM Compose file does not select both requested SHA images." >&2
    exit 1
fi

IMAGE_TAG="$image_tag" docker compose --env-file ../.env pull backend frontend > /dev/null
if ! docker image inspect "ghcr.io/roamboard/roamboard-backend:$previous_tag" > /dev/null 2>&1 ||
   ! docker image inspect "ghcr.io/roamboard/roamboard-frontend:$previous_tag" > /dev/null 2>&1; then
    echo "The previous images are not cached on the VM, so automatic rollback is unavailable." >&2
    exit 1
fi

temporary_file=""
switched=0
set_image_tag() {
    local next_tag="$1"
    temporary_file="$(mktemp "$env_file.XXXXXX")" || return
    awk -v tag="$next_tag" '
        BEGIN { found = 0 }
        /^IMAGE_TAG=/ { if (!found) print "IMAGE_TAG=" tag; found = 1; next }
        { print }
        END { if (!found) print "IMAGE_TAG=" tag }
    ' "$env_file" > "$temporary_file" || return
    chmod --reference="$env_file" "$temporary_file" || return
    chown --reference="$env_file" "$temporary_file" || return
    mv -f "$temporary_file" "$env_file" || return
    temporary_file=""
}

on_exit() {
    local status="$?"
    trap - EXIT
    if [[ -n "$temporary_file" ]]; then
        rm -f "$temporary_file"
    fi
    if (( status != 0 && switched == 1 )); then
        echo "Deployment failed; restoring the previous image tag." >&2
        if set_image_tag "$previous_tag" &&
           docker compose --env-file ../.env up -d --no-build --pull never backend frontend > /dev/null; then
            echo "Previous image tag restored: $previous_tag" >&2
        else
            echo "Automatic rollback failed. Inspect the VM containers immediately." >&2
        fi
    fi
    if [[ -n "$temporary_file" ]]; then
        rm -f "$temporary_file"
    fi
    exit "$status"
}
trap on_exit EXIT

switched=1
set_image_tag "$image_tag"
docker compose --env-file ../.env up -d --no-build --pull never backend frontend > /dev/null

healthy=0
for _ in {1..24}; do
    if curl --fail --silent --show-error --max-time 8 --resolve "$public_domain:443:127.0.0.1" \
        "https://$public_domain/health/db" > /dev/null 2>&1 &&
       curl --fail --silent --show-error --max-time 8 --resolve "$public_domain:443:127.0.0.1" \
        "https://$public_domain/" > /dev/null 2>&1; then
        healthy=1
        break
    fi
    sleep 5
done

if (( healthy != 1 )); then
    echo "The API and frontend did not both pass their health checks." >&2
    exit 1
fi

switched=0
echo "DEPLOY_OK_SHA=$image_tag"
