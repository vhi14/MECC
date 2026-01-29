#!/usr/bin/env bash
set -e

echo "Starting Django application..."
cd misty/MPSUUU-COOP/mpsucoop/mcoop_db
python manage.py migrate --noinput
echo "Running gunicorn..."
gunicorn mcoop_db.wsgi:application --bind 0.0.0.0:$PORT --log-level debug --access-logfile - --error-logfile -
 