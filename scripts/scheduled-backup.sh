#!/bin/sh
set -u
umask 077

interval=${BACKUP_INTERVAL_SECONDS:-3456000}
retry=${BACKUP_RETRY_SECONDS:-3600}
case "$interval:$retry" in
  *[!0-9:]*|0:*|*:0|'':*|*:'') echo 'Backup intervals must be positive integers.' >&2; exit 1 ;;
esac

while :; do
  temporary=$(mktemp /backups/.cloud-notes-XXXXXX) || { echo 'Could not create backup file.' >&2; sleep "$retry"; continue; }
  suffix=${temporary##*-}
  destination="/backups/cloud-notes-$(date -u +%Y%m%dT%H%M%SZ)-${suffix}.dump"
  echo "Starting database backup at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if pg_dump --format=custom --no-owner --no-privileges --file="$temporary" &&
     pg_restore --list "$temporary" >/dev/null &&
     mv -n "$temporary" "$destination" && [ ! -e "$temporary" ]; then
    echo "Backup completed: $destination"
    sleep "$interval"
  else
    echo "Backup failed; retrying in $retry seconds." >&2
    rm -f -- "$temporary"
    sleep "$retry"
  fi
done
