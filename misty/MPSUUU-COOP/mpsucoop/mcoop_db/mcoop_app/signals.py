from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.mail import send_mail
from django.utils import timezone
from datetime import datetime
from django.db.models import Max
from .models import Member, Account, Loan, Payment, PaymentSchedule
import uuid
from decimal import Decimal, ROUND_HALF_UP
from decimal import Decimal, InvalidOperation
from datetime import datetime 
from django.db.models import Max
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender=Member) 
def create_account_for_member(sender, instance, created, **kwargs):
    if created:
        current_year = datetime.now().year
        current_day = datetime.now().day
        year_suffix = str(current_year)[-2:]  
        day_suffix = str(current_day).zfill(2)  
        
        prefix = f"{year_suffix}{day_suffix}"

        last_account = Account.objects.filter(account_number__startswith=prefix).aggregate(Max('account_number'))

        last_account_number = last_account['account_number__max']
        if last_account_number:
            increment = int(last_account_number.split('-')[1]) + 1
        else:
            increment = 1

        incremental_part = str(increment).zfill(4)

        account_number = f"{prefix}-{incremental_part}"
        try:
            initial_deposit = Decimal(instance.in_dep) if instance.in_dep.isdigit() else Decimal('0.00')
        except (ValueError, InvalidOperation):
            initial_deposit = Decimal('0.00')

        Account.objects.create(
            account_number=account_number,
            account_holder=instance,
            shareCapital=initial_deposit,
            status='Active'
        )
@receiver(post_save, sender=Loan)
def handle_loan_post_save(sender, instance, created, **kwargs):
    if created and instance.status == 'Ongoing':
        if not instance.due_date:
            instance.generate_payment_schedule()

#2dago
# @receiver(post_save, sender=Payment)
# def update_payment_and_loan_status(sender, instance, created, **kwargs):
#     if created:
        
#         payment_schedule = instance.payment_schedule
#         if payment_schedule:
#             payment_schedule.balance -= instance.amount
#             payment_schedule.is_paid = payment_schedule.balance <= 0
#             payment_schedule.save()

        
#         loan = payment_schedule.loan
#         if loan.payment_schedules.filter(is_paid=False).count() == 0:
#             loan.status = 'Paid-off'
#             loan.save()

        
#         instance.description = f"Payment of {instance.amount} recorded on {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}"
#         instance.transaction_type = "Payment"  
#         instance.save(update_fields=['description', 'transaction_type'])

        
#         send_mail(
#             subject='Payment Confirmation',
#             message=f'Thank you! Your payment of {instance.amount} has been received.',
#             from_email='noreply@yourdomain.com',
#             recipient_list=[loan.account.account_holder.email],
#         )

@receiver(post_save, sender=Payment)
def update_payment_and_loan_status(sender, instance, created, **kwargs):
    payment_schedule = instance.payment_schedule

    if payment_schedule:
        # Update schedule balance & status
        # payment_schedule.balance -= instance.amount
        # payment_schedule.is_paid = payment_schedule.balance <= 0
        # payment_schedule.save()

        # Recheck and update loan status
        loan = payment_schedule.loan
        loan.update_status_based_on_schedules()

    # Only add description/type and send email when a PAYMENT IS CREATED
    # (avoid re-saving inside post_save for updates which can cause recursion)
    if created:
        # Do not attempt to save fields that don't exist on Payment model.
        # Instead: log the payment creation and send a confirmation email.
        logger.info(f"Payment created: OR={getattr(instance, 'OR', 'N/A')}, amount={getattr(instance, 'amount', 'N/A')}, loan={getattr(loan, 'control_number', 'N/A')}")
        try:
            send_mail(
                subject='Payment Confirmation',
                message=f'Thank you! Your payment of {instance.amount} has been received.',
                from_email='noreply@yourdomain.com',
                recipient_list=[loan.account.account_holder.email],
            )
        except Exception:
            logger.exception('Failed to send payment confirmation email')

# Optional: Auto-update Loan status even when PaymentSchedule is manually updated
@receiver(post_save, sender=PaymentSchedule)
def update_loan_status_on_schedule_change(sender, instance, **kwargs):
    instance.loan.update_status_based_on_schedules()
 #2dago
    
    
from django.db.models.signals import post_delete, pre_save

from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import PaymentSchedule, Loan, LoanYearlyRecalculation
from decimal import Decimal

# @receiver(post_save, sender=PaymentSchedule)
# def trigger_yearly_recalculation(sender, instance, **kwargs):
#     loan = instance.loan

#     remaining_balance = loan.outstanding_balance  # Start with balance after Year 1

#     for year in range(2, 5):
#         prev_year_schedules = loan.paymentschedule_set.filter(
#             due_date__year=loan.loan_date.year + (year - 2)
#         )

#         if prev_year_schedules.exists() and all(s.is_paid for s in prev_year_schedules):
#             if not LoanYearlyRecalculation.objects.filter(loan=loan, year=year).exists():
#                 # Service fee rate for this year
#                 rate_map = {
#                     2: loan.system_settings.service_fee_rate_regular_2yr,
#                     3: loan.system_settings.service_fee_rate_regular_3yr,
#                     4: loan.system_settings.service_fee_rate_regular_4yr,
#                 }
#                 service_fee = remaining_balance * rate_map.get(year, loan.system_settings.service_fee_rate_regular_4yr)

#                 admincost = loan.admincost + Decimal(loan.system_settings.admin_cost) * 12 * (year - 1)
#                 cisp = (remaining_balance / Decimal('1000')) * Decimal('0.75') * Decimal('12')
#                 interest_amount = remaining_balance * (loan.annual_interest / Decimal('100'))

#                 outstanding_balance = remaining_balance - (service_fee + admincost + cisp + interest_amount)

#                 # Create yearly recalculation
#                 LoanYearlyRecalculation.objects.create(
#                     loan=loan,
#                     year=year,
#                     service_fee=service_fee,
#                     interest_amount=interest_amount,
#                     admincost=admincost,
#                     cisp=cisp,
#                     outstanding_balance=outstanding_balance
#                 )

#                 # Update remaining_balance for the next year
#                 remaining_balance = outstanding_balance

#                 print(f"✅ Year {year} recalculation auto-created for Loan {loan.control_number}")
from datetime import timedelta
import logging
logger = logging.getLogger(__name__)
# @receiver(post_save, sender=PaymentSchedule)
# def trigger_yearly_recalculation(sender, instance, **kwargs):
#     logger.info(f"Signal triggered for PaymentSchedule {instance.id}, is_paid: {instance.is_paid}")
#     print(f"🔥 SIGNAL FIRED: PaymentSchedule {instance.id}, is_paid: {instance.is_paid}")
    
#     loan = instance.loan
#     print(f"❌ EXIT: Not Regular loan")
    
#     # Only apply to Regular loans
#     if loan.loan_type != 'Regular':
#         return
    
#     # Only trigger when a schedule is marked as paid
#     if not instance.is_paid:
#         print(f"❌ EXIT: Schedule not paid")
#         return
    
#     # Calculate loan age in years
#     today = timezone.now().date()
#     loan_age_days = (today - loan.loan_date).days
#     loan_age_years = loan_age_days // 365
    
#     # Only process for loans that are at least 1 year old
#     if loan_age_years < 1:
#         return
    
#     # Check years 2, 3, and 4 (maximum)
#     for target_year in range(2, min(5, loan_age_years + 2)):  # Years 2-4 only
        
#         # Skip if recalculation already exists for this year
#         if LoanYearlyRecalculation.objects.filter(loan=loan, year=target_year).exists():
#             continue
            
#         # Get all schedules from the previous year
#         prev_year_start = loan.loan_date + timedelta(days=(target_year - 2) * 365)
#         prev_year_end = loan.loan_date + timedelta(days=(target_year - 1) * 365)
        
#         prev_year_schedules = loan.paymentschedule_set.filter(
#             due_date__gte=prev_year_start,
#             due_date__lt=prev_year_end
#         )
        
#         # Only create recalculation if ALL previous year schedules are paid
#         if prev_year_schedules.exists() and prev_year_schedules.filter(is_paid=False).exists():
#             continue  # Not all schedules from previous year are paid
            
#         # Get the outstanding balance from previous recalculation or original
#         if target_year == 2:
#             remaining_balance = loan.outstanding_balance
#         else:
#             prev_recalc = LoanYearlyRecalculation.objects.filter(
#                 loan=loan, 
#                 year=target_year-1
#             ).first()
#             if not prev_recalc:
#                 continue  # Previous year recalculation doesn't exist
#             remaining_balance = prev_recalc.outstanding_balance
        
#         # Calculate new values for this year
#         rate_map = {
#             2: loan.system_settings.service_fee_rate_regular_2yr,
#             3: loan.system_settings.service_fee_rate_regular_3yr,
#             4: loan.system_settings.service_fee_rate_regular_4yr,
#         }
        
#         service_fee_rate = rate_map.get(target_year, loan.system_settings.service_fee_rate_regular_4yr)
#         service_fee = remaining_balance * service_fee_rate
        
#         # Calculate other components
#         admincost = loan.admincost + Decimal(loan.system_settings.admin_cost) * 12 * (target_year - 1)
#         cisp = (remaining_balance / Decimal('1000')) * Decimal('0.75') * Decimal('12')
#         interest_amount = remaining_balance * (loan.annual_interest / Decimal('100'))
        
#         # Calculate new outstanding balance
#         outstanding_balance = remaining_balance - (service_fee + admincost + cisp + interest_amount)
        
#         # Create the recalculation record
#         LoanYearlyRecalculation.objects.create(
#             loan=loan,
#             year=target_year,
#             service_fee=service_fee,
#             interest_amount=interest_amount,
#             admincost=admincost,
#             cisp=cisp,
#             outstanding_balance=outstanding_balance
#         )
        
#         # Update remaining unpaid schedules with new amounts
#         unpaid_schedules = loan.paymentschedule_set.filter(
#             is_paid=False,
#             due_date__gte=prev_year_end  # Only schedules from this year forward
#         ).order_by('due_date')
        
#         if unpaid_schedules.exists():
#             new_payment_amount = (outstanding_balance / unpaid_schedules.count()).quantize(Decimal('0.01'))
#             for schedule in unpaid_schedules:
#                 schedule.payment_amount = new_payment_amount
#                 schedule.principal_amount = new_payment_amount
#                 schedule.save()
        
#         print(f"✅ Year {target_year} recalculation created for Loan {loan.control_number}")
#         break  # Only process one year at a time

#wadasilaw
# In signals.py - Add these imports at the top of the file if not already present:
from decimal import Decimal, ROUND_HALF_UP
from datetime import timedelta
from .models import LoanYearlyRecalculation



@receiver(post_save, sender=PaymentSchedule)
def trigger_yearly_recalculation(sender, instance, **kwargs):
    """
    Trigger yearly recalculation when a year group of payments is completed.
    
    NEW CALCULATION LOGIC:
    - Previous Balance = Remaining Principal (Loan Amount - Principal Paid)
    - Interest = Previous Balance × Interest Rate (distributed to schedules)
    - Fees (service, admin, notarial, cisp) = Calculated on Previous Balance (separate payment)
    - New Bimonthly = Fixed Principal + (New Interest / 24)
    """
    loan = instance.loan
    
    # ✅ DEBUG: Log all signal triggers
    print(f"\n{'='*70}")
    print(f"📡 SIGNAL TRIGGERED: trigger_yearly_recalculation")
    print(f"   Schedule ID: {instance.id}")
    print(f"   is_paid: {instance.is_paid}")
    print(f"   Loan: {loan.control_number} ({loan.loan_type})")
    print(f"{'='*70}")
    
    # Only apply to Regular loans
    if loan.loan_type.lower() != 'regular':
        print(f"⏭️ Skipping - Not a Regular loan (type={loan.loan_type})")
        return
    
    # Only trigger when a schedule is marked as paid
    if not instance.is_paid:
        print(f"⏭️ Skipping - Schedule not paid yet")
        return
    
    print(f"✅ Conditions met, checking for year completion...")
    
    # Get all payment schedules for this loan
    all_schedules = loan.paymentschedule_set.all().order_by('due_date')
    
    if not all_schedules.exists():
        print(f"⏭️ No schedules found for this loan")
        return
    
    SCHEDULES_PER_YEAR = 24
    schedules_by_year = {}
    
    for schedule in all_schedules:
        schedules_by_year.setdefault(schedule.year_number, []).append(schedule)
    
    print(f"📊 Schedules by year: {dict((k, len(v)) for k, v in schedules_by_year.items())}")
    
    # Check which years are fully paid
    completed_years = []
    for year in sorted(schedules_by_year.keys()):
        year_paid = all(s.is_paid for s in schedules_by_year[year])
        print(f"   Year {year}: {len(schedules_by_year[year])} schedules, all_paid={year_paid}")
        if year_paid:
            completed_years.append(year)
            print(f"   ✅ Year {year} is fully paid!")
        else:
            break
    
    print(f"📈 Completed years: {completed_years}")
    
    if not completed_years:
        print(f"⏭️ No years fully completed yet")
        return
    
    highest_completed_year = max(completed_years)
    target_recalc_year = highest_completed_year + 1
    
    # Maximum is Year 4 recalculation (for 4-year loans)
    max_years = loan.loan_period if loan.loan_period_unit == 'years' else 1
    if target_recalc_year > max_years:
        print(f"✅ All possible recalculations complete")
        return
    
    # Check if recalculation already exists
    from .models import LoanYearlyRecalculation
    
    if LoanYearlyRecalculation.objects.filter(loan=loan, year=target_recalc_year).exists():
        print(f"⏭️ Year {target_recalc_year} recalculation already exists")
        return
    
    print(f"\n🎯 Creating Year {target_recalc_year} Recalculation")
    print(f"{'='*70}")
    
    # ========================================================================
    # CALCULATE PREVIOUS BALANCE (Remaining Principal)
    # ========================================================================
    
    # Fixed principal per payment
    fixed_principal = loan.principal
    
    # Total principal paid = Fixed Principal × Number of completed payments
    completed_payments = highest_completed_year * SCHEDULES_PER_YEAR
    total_principal_paid = fixed_principal * completed_payments
    
    # Previous Balance = Loan Amount - Total Principal Paid
    previous_balance = loan.loan_amount - total_principal_paid
    
    print(f"\n📊 PREVIOUS BALANCE CALCULATION:")
    print(f"   Loan Amount: ₱{loan.loan_amount}")
    print(f"   Fixed Principal per payment: ₱{fixed_principal}")
    print(f"   Completed payments: {completed_payments}")
    print(f"   Total Principal Paid: ₱{fixed_principal} × {completed_payments} = ₱{total_principal_paid}")
    print(f"   ✅ Previous Balance (Remaining Principal): ₱{previous_balance}")
    
    # ========================================================================
    # CALCULATE FEES FOR NEW YEAR (on Previous Balance)
    # ========================================================================
    
    # Service Fee Rate based on year
    rate_map = {
        2: loan.system_settings.service_fee_rate_regular_2yr,
        3: loan.system_settings.service_fee_rate_regular_3yr,
        4: loan.system_settings.service_fee_rate_regular_4yr,
    }
    service_fee_rate = rate_map.get(target_recalc_year, loan.system_settings.service_fee_rate_regular_4yr)
    
    # Calculate fees on Previous Balance
    service_fee = (previous_balance * service_fee_rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    # Interest on remaining principal (use normalized decimal rate)
    try:
        interest_rate_decimal = loan.system_settings.get_interest_rate_decimal()
    except Exception:
        # Fallback: treat stored interest as percent
        interest_rate_decimal = (Decimal(loan.system_settings.interest_rate) / Decimal('100'))
    interest_amount = (previous_balance * interest_rate_decimal).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    # Admin cost (flat)
    admincost = Decimal(loan.system_settings.admin_cost)
    
    # Notarial (flat)
    notarial = Decimal(loan.system_settings.notarial_fee)
    
    # CISP on remaining principal
    cisp = (previous_balance / Decimal('1000') * Decimal('0.75') * Decimal('12')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    # Total yearly fees (SEPARATE PAYMENT - excluding interest which goes to schedules)
    total_fees_due = service_fee + admincost + notarial + cisp
    
    print(f"\n💰 YEAR {target_recalc_year} FEES (calculated on ₱{previous_balance}):")
    print(f"   Service Fee ({service_fee_rate}): ₱{service_fee}")
    try:
        interest_rate_pct = (interest_rate_decimal * Decimal('100')).quantize(Decimal('0.01'))
    except Exception:
        interest_rate_pct = Decimal('0.00')
    print(f"   Interest ({interest_rate_pct}%): ₱{interest_amount}")
    print(f"   Admin Cost: ₱{admincost}")
    print(f"   Notarial: ₱{notarial}")
    print(f"   CISP: ₱{cisp}")
    print(f"   ---")
    print(f"   ✅ Total Fees Due (Separate Payment): ₱{total_fees_due}")
    print(f"   (Interest distributed to schedules, not included in separate payment)")
    
    # ========================================================================
    # CALCULATE NEW BIMONTHLY AMORTIZATION
    # ========================================================================
    
    # Determine unpaid schedules count for target year
    year_schedules_all = list(loan.paymentschedule_set.filter(year_number=target_recalc_year).order_by('due_date'))
    year_schedules_unpaid = [s for s in year_schedules_all if not s.is_paid]
    unpaid_count = len(year_schedules_unpaid)
    if unpaid_count <= 0:
        print(f"⏭️ No unpaid schedules in Year {target_recalc_year}; skipping distribution")
        return

    # Interest portion per payment distributed across remaining unpaid schedules
    base_ip = (interest_amount / Decimal(unpaid_count)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    # Build interest portions with last one absorbing rounding delta
    interest_portions = []
    running = Decimal('0.00')
    for i in range(unpaid_count - 1):
        interest_portions.append(base_ip)
        running += base_ip
    last_ip = (interest_amount - running).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    interest_portions.append(last_ip)

    # New Bimonthly (representative) = Fixed Principal + base interest per payment
    new_bimonthly = fixed_principal + base_ip
    
    print(f"\n📅 NEW BIMONTHLY AMORTIZATION:")
    print(f"   Fixed Principal: ₱{fixed_principal}")
    print(f"   Interest per payment: ₱{interest_amount} / {unpaid_count} = ₱{base_ip}")
    print(f"   ✅ New Bimonthly: ₱{fixed_principal} + ₱{base_ip} = ₱{new_bimonthly}")
    
    # ========================================================================
    # CALCULATE OUTSTANDING BALANCE (after this year if all paid)
    # ========================================================================
    
    # Remaining principal after this year
    principal_paid_this_year = fixed_principal * SCHEDULES_PER_YEAR
    remaining_balance = previous_balance - principal_paid_this_year
    
    print(f"\n📉 PROJECTED REMAINING BALANCE (after Year {target_recalc_year}):")
    print(f"   Previous Balance: ₱{previous_balance}")
    print(f"   Principal paid this year: ₱{fixed_principal} × 24 = ₱{principal_paid_this_year}")
    print(f"   ✅ Total Fees Due (Separate Payment): ₱{total_fees_due}")
    print(f"   Interest: ₱{interest_amount} (distributed to 24 payments)")
    
    # ========================================================================
    # CREATE RECALCULATION RECORD
    # ========================================================================
    
    LoanYearlyRecalculation.objects.create(
        loan=loan,
        year=target_recalc_year,
        previous_balance=previous_balance,
        service_fee=service_fee,
        interest_amount=interest_amount,
        admincost=admincost,
        notarial=notarial,
        cisp=cisp,
        total_fees_due=total_fees_due,
        fees_paid=False,
        new_bimonthly_amortization=new_bimonthly
    )
    
    print(f"\n✅ Year {target_recalc_year} recalculation record created!")
    
    # ========================================================================
    # UPDATE PAYMENT SCHEDULES FOR THIS YEAR
    # ========================================================================
    
    # Get schedules for this year (we'll update only unpaid ones)
    year_schedules = year_schedules_unpaid
    
    print(f"\n📝 UPDATING YEAR {target_recalc_year} SCHEDULES:")
    print(f"   New payment amount: ₱{new_bimonthly}")
    
    # Track running balance for this year
    running_balance = previous_balance
    
    updated_schedules = []
    for idx, schedule in enumerate(year_schedules):
        old_amount = schedule.payment_amount
        ip = interest_portions[idx]
        
        # Update payment components
        schedule.principal_amount = fixed_principal
        schedule.interest_portion = ip
        schedule.payment_amount = (fixed_principal + ip).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        schedule.year_number = target_recalc_year
        
        # Update running balance (principal effect only)
        running_balance = running_balance - fixed_principal
        if running_balance < Decimal('0.00'):
            running_balance = Decimal('0.00')
        schedule.balance = running_balance
        
        updated_schedules.append(schedule)
        
        if idx < 3:  # Show first 3
            print(f"      Schedule: ₱{old_amount} → ₱{schedule.payment_amount} (interest ₱{ip})")
    
    if len(updated_schedules) > 3:
        print(f"      ... and {len(updated_schedules) - 3} more schedules")
    
    # Bulk update with verification
    if updated_schedules:
        # ✅ Verify payment amounts before saving
        for schedule in updated_schedules:
            expected = schedule.principal_amount + schedule.interest_portion
            if schedule.payment_amount != expected:
                print(f"   ⚠️ WARNING: Schedule payment_amount mismatch!")
                print(f"      Expected: ₱{expected}")
                print(f"      Got: ₱{schedule.payment_amount}")
                schedule.payment_amount = expected  # Force correct value
        
        PaymentSchedule.objects.bulk_update(
            updated_schedules,
            ['payment_amount', 'principal_amount', 'interest_portion', 'year_number', 'balance'],
            batch_size=100
        )
        print(f"   ✅ Updated {len(updated_schedules)} schedules")
        print(f"   Base schedule payment_amount ≈ ₱{new_bimonthly} (last may differ by rounding)")
    
    # Update loan's remaining principal based on actual schedules in this year
    principal_paid_this_year_effective = fixed_principal * Decimal(len(year_schedules_all))
    loan.remaining_principal = (previous_balance - principal_paid_this_year_effective).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    if loan.remaining_principal < Decimal('0.00'):
        loan.remaining_principal = Decimal('0.00')
    loan.save(update_fields=['remaining_principal'])
    
    print(f"\n{'='*70}")
    print(f"✅ YEAR {target_recalc_year} RECALCULATION COMPLETE")
    print(f"{'='*70}\n")

    
@receiver(post_delete, sender=Payment)
def handle_payment_delete(sender, instance, **kwargs):
    loan = instance.loan
    loan.balance += instance.amount_paid
    loan.save()

@receiver(pre_save, sender=Payment)
def handle_payment_update(sender, instance, **kwargs):
    # Only run update logic if a payment with this PK already exists in DB
    # (primary key for Payment is `OR` and may be set for new instances)
    if instance.pk and Payment.objects.filter(pk=instance.pk).exists():
        try:
            old_payment = Payment.objects.get(pk=instance.pk)
        except Payment.DoesNotExist:
            return
        difference = getattr(instance, 'amount_paid', Decimal('0.00')) - getattr(old_payment, 'amount_paid', Decimal('0.00'))
        loan = instance.loan
        # Adjust loan.balance only if difference is non-zero
        if difference != Decimal('0.00'):
            loan.balance -= difference
            loan.save()
