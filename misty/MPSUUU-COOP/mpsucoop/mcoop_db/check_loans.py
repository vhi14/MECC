import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mcoop_db.settings')
django.setup()

from mcoop_app.models import Loan, PaymentSchedule

loans = Loan.objects.filter(status='Ongoing')
print("Active Loans:")
for loan in loans:
    count = PaymentSchedule.objects.filter(loan=loan).count()
    years = sorted(set(PaymentSchedule.objects.filter(loan=loan).values_list('year_number', flat=True)))
    paid = PaymentSchedule.objects.filter(loan=loan, is_paid=True).count()
    print(f"{loan.control_number}: {count} schedules, Years: {years}, Paid: {paid}")
