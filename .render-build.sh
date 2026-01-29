#!/usr/bin/env bash
set -e

echo "Installing Python dependencies..."
python -m pip install --upgrade pip
pip install -r misty/MPSUUU-COOP/mpsucoop/mcoop_db/mcoop_db/requirements.txt

echo "Collecting static files..."
cd misty/MPSUUU-COOP/mpsucoop/mcoop_db
python manage.py collectstatic --noinput
 