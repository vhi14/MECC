import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mcoop_db.settings')
django.setup()

from mcoop_app.models import Loan, PaymentSchedule
from mcoop_app.serializers import LoanDetailedSerializer
from decimal import Decimal

# Ensure sample loan exists for local tests — create minimal fixtures if missing
try:
    loan = Loan.objects.get(control_number='C974F')
except Loan.DoesNotExist:
    from mcoop_app.models import Member, Account, LoanYearlyRecalculation
    print('Sample loan C974F not found — creating minimal fixture data...')
    # Create member
    member, _ = Member.objects.get_or_create(
        email='sample_member@example.com',
        defaults={
            'first_name': 'Sample',
            'middle_name': '',
            'last_name': 'Member',
            'birth_date': '1990-01-01',
            'phone_number': '09123456789',
            'gender': 'Male',
            'religion': 'Catholic',
            'pstatus': 'Single',
            'address': ''
        }
    )

    # Create account
    try:
        account = Account.objects.get(account_number='ACC-C974F')
    except Account.DoesNotExist:
        # If member already has an account, reuse it; otherwise create a new one
        existing = Account.objects.filter(account_holder=member).first()
        if existing:
            account = existing
        else:
            account = Account.objects.create(
                account_number='ACC-C974F',
                account_holder=member,
                shareCapital=Decimal('0.00'),
                status='active'
            )
    # Link member.account_number if not set
    if not getattr(member, 'account_number', None):
        member.account_number = account
        member.save()

    # Create loan
    loan = Loan(control_number='C974F', account=account, loan_amount=Decimal('10000.00'), loan_type='Regular')
    loan.save()

    # Create a few payment schedules
    for i in range(1,4):
        PaymentSchedule.objects.create(
            loan=loan,
            principal_amount=Decimal('1000.00'),
            payment_amount=Decimal('1200.00'),
            due_date='2025-01-0{}'.format(i),
            balance=Decimal('1000.00'),
            is_paid=(i==1),
            year_number=1,
            loan_type='Regular'
        )

    # Create a yearly recalculation snapshot
    LoanYearlyRecalculation.objects.get_or_create(
        loan=loan,
        year=1,
        defaults={
            'previous_balance': Decimal('10000.00'),
            'service_fee': Decimal('100.00'),
            'interest_amount': Decimal('200.00'),
            'admincost': Decimal('50.00'),
            'notarial': Decimal('100.00'),
            'cisp': Decimal('50.00'),
            'total_fees_due': Decimal('500.00'),
            'fees_paid': False
        }
    )
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
