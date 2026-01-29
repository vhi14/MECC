web: cd misty/MPSUUU-COOP/mpsucoop/mcoop_db && python manage.py migrate --noinput && gunicorn mcoop_db.wsgi:application --bind 0.0.0.0:$PORT --log-level debug
