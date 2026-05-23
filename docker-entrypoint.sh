#!/bin/sh
set -eu

# Supercronic runs daily-prompt batch jobs; the app machine holds the SQLite volume.
supercronic /app/crontab &

exec node dist/index.cjs
