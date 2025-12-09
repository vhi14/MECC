import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mcoop_db.settings')
django.setup()

from mcoop_app.models import Loan, PaymentSchedule, LoanYearlyRecalculation

loan = Loan.objects.get(control_number='C974F')
print(f"\n=== LOAN {loan.control_number} ===")
print(f"Status: {loan.status}")
print(f"Remaining Principal: {loan.remaining_principal}")

for year in [1, 2, 3, 4]:
    schedules = PaymentSchedule.objects.filter(loan=loan, year_number=year)
    if schedules.exists():
        paid = schedules.filter(is_paid=True).count()
        unpaid = schedules.filter(is_paid=False).count()
        print(f"\nYear {year}: {schedules.count()} schedules (Paid: {paid}, Unpaid: {unpaid})")
    else:
        print(f"\nYear {year}: No schedules")

recalcs = LoanYearlyRecalculation.objects.filter(loan=loan).order_by('year')
print(f"\n=== RECALCULATIONS ===")
for recalc in recalcs:
    print(f"Year {recalc.year}: prev_bal={recalc.previous_balance}, total_fees={recalc.total_fees_due}, paid={recalc.fees_paid}")
