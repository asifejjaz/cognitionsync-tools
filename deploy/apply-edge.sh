#!/bin/sh
# Apply only a previously validated candidate, preserving source and runtime backups.
set -eu
proxy=$1
canonical=$2
candidate=$3
expected=$4
backups=$5
test "$(sha256sum "$canonical" | cut -d ' ' -f1)" = "$expected"
test "$(docker exec "$proxy" sha256sum /etc/nginx/nginx.conf | cut -d ' ' -f1)" = "$expected"
stamp=$(date +%Y%m%d-%H%M%S)-$$
mkdir -p "$backups"
cp -p "$canonical" "$backups/source.$stamp.conf"
docker cp "$proxy:/etc/nginx/nginx.conf" "$backups/runtime.$stamp.conf"
restore() {
    cp -p "$backups/source.$stamp.conf" "$canonical"
    docker cp "$backups/runtime.$stamp.conf" "$proxy:/etc/nginx/nginx.conf"
    docker exec "$proxy" nginx -t && docker exec "$proxy" nginx -s reload
}
docker cp "$candidate" "$proxy:/etc/nginx/nginx.conf"
if ! docker exec "$proxy" nginx -t; then
    restore
    exit 1
fi
cp "$candidate" "$canonical"
if ! docker exec "$proxy" nginx -s reload; then
    restore
    exit 1
fi
printf 'Reloaded; backup prefix: %s\n' "$backups/*.$stamp.conf"
sha256sum "$canonical"
