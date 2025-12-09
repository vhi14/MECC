import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mcoop_db.settings')
django.setup()

from mcoop_app.models import Loan, PaymentSchedule
from mcoop_app.serializers import LoanDetailedSerializer

loan = Loan.objects.get(control_number='C974F')
serializer = LoanDetailedSerializer(loan)
data = serializer.data

print("=== FRONTEND API RESPONSE ===")
print(f"Loan: {data['control_number']}")
print(f"Total Schedules Returned: {len(data.get('payment_schedules', []))}")

# Group by year
years_in_response = {}
for sched in data.get('payment_schedules', []):
    year = sched.get('year_number', 1)
    if year not in years_in_response:
        years_in_response[year] = []
    years_in_response[year].append(sched)

print(f"\nYears in API Response: {sorted(years_in_response.keys())}")
for year in sorted(years_in_response.keys()):
    schedules = years_in_response[year]
    paid = sum(1 for s in schedules if s['is_paid'])
    print(f"  Year {year}: {len(schedules)} schedules ({paid} paid)")

print(f"\nRecalculations in Response: {len(data.get('yearly_recalculations', []))}")
for recalc in data.get('yearly_recalculations', []):
    print(f"  Year {recalc['year']}: ₱{recalc['total_fees_due']} fees (paid={recalc['fees_paid']})")
