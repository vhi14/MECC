from django.test import Client
from django.conf import settings
from django.contrib.auth import get_user_model

# When running via manage.py shell and using the test client, Django's
# test client uses the host 'testserver'. Ensure it's allowed to avoid
# DisallowedHost during these scripted runs.
if "testserver" not in settings.ALLOWED_HOSTS:
    settings.ALLOWED_HOSTS = list(settings.ALLOWED_HOSTS) + ["testserver"]
from decimal import Decimal
from django.utils import timezone
from mcoop_app.models import Member, Account, Loan, PaymentSchedule, LoanYearlyRecalculation
from mcoop_app.models import ORNumberTracker

client = Client()
User = get_user_model()

# Create or get a test user and authenticate the test client so endpoints that
# require `request.user` (e.g. archiving) will not raise internal errors.
test_user, _ = User.objects.get_or_create(username='test_or_user', defaults={'email':'test_or_user@example.com', 'password':'testpass'})
client.force_login(test_user)

def ensure_member(email, acct_no_prefix):
    phone = '09' + ''.join([c for c in email if c.isdigit()])
    # Fallback phone if none in email
    if len(phone) < 11:
        phone = '09' + str(abs(hash(email)) % 1000000000).zfill(9)
    member, _ = Member.objects.get_or_create(
        email=email,
        defaults={
            'first_name': email.split('@')[0],
            'middle_name': '',
            'last_name': 'Test',
            'birth_date': '1990-01-01',
            'phone_number': phone,
            'gender': 'Male',
            'religion': 'None',
            'pstatus': 'Single',
            'address': ''
        }
    )
    account = Account.objects.filter(account_holder=member).first()
    if not account:
        account = Account.objects.create(account_number=f"{acct_no_prefix}-001", account_holder=member, shareCapital=Decimal('1000.00'), status='active')
    # Ensure member has an associated User for endpoints that archive payments
    from django.contrib.auth import get_user_model
    User = get_user_model()
    if not getattr(member, 'user', None):
        # create a user and link (username must be unique)
        # Use the Member primary key field `memId` which this model uses
        username = f'user_{acct_no_prefix}_{getattr(member, "memId", "noid")}'
        user, created = User.objects.get_or_create(username=username, defaults={'email': member.email})
        member.user = user
        member.save()
    return member, account


def create_loan(account, control_number_suffix, loan_type='Regular'):
    loan = Loan.objects.create(control_number=f"C{control_number_suffix}", account=account, loan_amount=Decimal('10000.00'), loan_type=loan_type)
    # create one schedule due today
    today = timezone.now().date()
    PaymentSchedule.objects.create(loan=loan, principal_amount=Decimal('1000.00'), payment_amount=Decimal('1200.00'), due_date=today, balance=Decimal('1000.00'), is_paid=False, year_number=1, loan_type=loan_type)
    return loan


def mark_schedule_paid(schedule_id, or_number):
    url = f"/payment-schedule/{schedule_id}/process-payment/"
    payload = {
        'received_amnt': '1200.00',
    }
    # This view expects JSON body and OR handling is in mark_as_paid view; but to attach OR, we set via schedule UPDATE later
    # Use mark_as_paid endpoint instead (which uses id param)
    import json
    body = json.dumps({'received_amnt':'1200.00','or_number': or_number})
    resp = client.post(url, data=body, content_type='application/json')
    return resp


def post_withdraw(account_number, amount, or_number):
    url = f"/accounts/{account_number}/withdraw/"
    resp = client.post(url, data={'amount': str(amount), 'or_number': or_number}, content_type='application/json')
    return resp


def post_payment_event(control_number, payload):
    url = f"/loans/{control_number}/payment-event/"
    import json
    return client.post(url, data=json.dumps(payload), content_type='application/json')


def pay_yearly_fees(control_number, year, or_number, amount):
    url = '/api/yearly-fees/pay/'
    import json
    payload = {'loan_control_number': control_number, 'year': year, 'or_number': or_number, 'amount': str(amount)}
    return client.post(url, data=json.dumps(payload), content_type='application/json')


# Setup members
member_a, account_a = ensure_member('membera@example.com', 'A')
member_b, account_b = ensure_member('memberb@example.com', 'B')

# Create loans
loan_a_reg = create_loan(account_a, 'A_REG', 'Regular')
loan_a_emg = create_loan(account_a, 'A_EMG', 'Emergency')
loan_b_reg = create_loan(account_b, 'B_REG', 'Regular')

# Get schedules
sched_a_reg = PaymentSchedule.objects.filter(loan=loan_a_reg).first()
sched_a_emg = PaymentSchedule.objects.filter(loan=loan_a_emg).first()

print('--- Starting OR flow test with OR=1234 for Member A ---')
OR = '1234'

# 1) Withdraw for member A
# Ensure account has sufficient funds for withdrawal
try:
    if account_a.shareCapital < Decimal('2000.00'):
        account_a.deposit(Decimal('5000.00'))
except Exception:
    account_a.shareCapital = Decimal('5000.00')
    account_a.save()

resp = post_withdraw(account_a.account_number, Decimal('100.00'), OR)
print('Withdraw A:', resp.status_code, resp.content)

# 2) Mark regular schedule as paid for member A with OR
resp = mark_schedule_paid(sched_a_reg.id, OR)
print('Regular payment A:', resp.status_code, resp.content)

# 3) Mark emergency schedule as paid for member A with OR
print('\n--- Step 3: Emergency schedule payment ---')
print('Emergency loan type:', loan_a_emg.loan_type)
resp = mark_schedule_paid(sched_a_emg.id, OR)
print('Emergency schedule payment A:', resp.status_code)
if resp.status_code != 200:
    print('  ERROR:', resp.content)
else:
    print('  SUCCESS')

# 4) Advance payment (PaymentEvent) for Regular loan with OR
print('\n--- Step 4: Regular loan advance payment ---')
print('Regular loan type:', loan_a_reg.loan_type)
print('OR tracker entries BEFORE regular advance attempt:')
for t in ORNumberTracker.objects.filter(or_number=OR):
    print('  tracker:', t.member.email if t.member else None, t.or_number, t.first_used_date, t.loan_type)
payload = {'mode':'pay_ahead','amount_regular':'0','amount_pay_ahead':'1200.00','amount_curtailment':'0','or_number':OR}
resp = post_payment_event(loan_a_reg.control_number, payload)
print('Regular advance payment A:', resp.status_code)
if resp.status_code not in (200, 201):
    print('  ERROR:', resp.content)
else:
    print('  SUCCESS')

# 4b) Advance payment for Emergency loan with OR
print('\n--- Step 4b: Emergency loan advance payment ---')
print('Emergency loan type:', loan_a_emg.loan_type)
print('OR tracker entries BEFORE emergency advance attempt:')
for t in ORNumberTracker.objects.filter(or_number=OR):
    print('  tracker:', t.member.email if t.member else None, t.or_number, t.first_used_date, t.loan_type)
payload = {'mode':'pay_ahead','amount_regular':'0','amount_pay_ahead':'1200.00','amount_curtailment':'0','or_number':OR}
resp = post_payment_event(loan_a_emg.control_number, payload)
print('Emergency advance payment A:', resp.status_code)
if resp.status_code not in (200, 201):
    print('  ERROR:', resp.content)
else:
    print('  SUCCESS')

# 5) Pay yearly fees - create a simple LoanYearlyRecalculation for loan_a_reg
recalc, _ = LoanYearlyRecalculation.objects.get_or_create(loan=loan_a_reg, year=1, defaults={'previous_balance':Decimal('10000.00'),'service_fee':Decimal('100.00'),'interest_amount':Decimal('200.00'),'admincost':Decimal('50.00'),'notarial':Decimal('100.00'),'cisp':Decimal('50.00'),'total_fees_due':Decimal('500.00')})
# Mark last schedule for year as paid today to satisfy condition
# For simplicity, mark sched_a_reg.date_paid = today and ensure it's the last schedule for year
sched_a_reg.date_paid = timezone.now().date()
sched_a_reg.save(update_fields=['date_paid'])

resp = pay_yearly_fees(loan_a_reg.control_number, 1, OR, Decimal('500.00'))
print('Pay yearly fees A:', resp.status_code, resp.content)

print('\n--- Now try using same OR for Member B (should be blocked) ---')
# 6) Withdraw for member B
resp = post_withdraw(account_b.account_number, Decimal('50.00'), OR)
print('Withdraw B:', resp.status_code, resp.content)

# 7) Regular payment for member B
sched_b_reg = PaymentSchedule.objects.filter(loan=loan_b_reg).first()
resp = mark_schedule_paid(sched_b_reg.id, OR)
print('Regular payment B:', resp.status_code, resp.content)

print('\n--- Done ---')
