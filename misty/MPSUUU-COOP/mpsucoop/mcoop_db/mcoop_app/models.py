from django.db.models import F, Q
from django.db import models
from decimal import Decimal, ROUND_HALF_UP,InvalidOperation
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator 
import uuid
from datetime import date
from django.utils.timezone import now 
import math
from django.db.models import Sum
from django.core.exceptions import ValidationError
import logging
logger = logging.getLogger(__name__)
import json
from django.core.exceptions import ValidationError
from datetime import date, datetime
from django.contrib.auth.models import User
from django.utils.timezone import now
from datetime import timedelta
def save(self, *args, **kwargs):
    try:
        super().save(*args, **kwargs)
    except InvalidOperation as e:
        logger.error(f"Invalid decimal value: {e}")
        raise
    # --- Yearly recalculation snapshot model ---
class LoanYearlyRecalculation(models.Model):
    loan = models.ForeignKey('Loan', on_delete=models.CASCADE, related_name='yearly_recalculations')
    year = models.PositiveIntegerField()
    
    # Balance tracking
    previous_balance = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text="Remaining principal at start of this year"
    )
    
    # Fees calculated on previous_balance
    service_fee = models.DecimalField(max_digits=15, decimal_places=2)
    interest_amount = models.DecimalField(
        max_digits=15, decimal_places=2,
        help_text="Interest for this year (distributed to 24 payments)"
    )
    admincost = models.DecimalField(max_digits=15, decimal_places=2)
    notarial = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('100.00'))
    cisp = models.DecimalField(max_digits=15, decimal_places=2)
    
    # ✅ CHANGED: Removed outstanding_balance, added total_fees_due
    total_fees_due = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text="Total recalculated fees to be paid separately (Service + Admin + Notarial + CISP)"
    )
    
    # ✅ NEW: Track if yearly fees have been paid
    fees_paid = models.BooleanField(
        default=False,
        help_text="Whether the yearly recalculation fees have been paid"
    )
    
    # ✅ NEW: Date when yearly fees were paid
    fees_paid_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date when the yearly fees payment was made"
    )
    
    # ✅ NEW: OR number for yearly fees payment
    fees_or_number = models.CharField(
        max_length=4,
        null=True,
        blank=True,
        help_text="OR number for the yearly fees payment"
    )
    
    # New bimonthly for this year's schedules
    new_bimonthly_amortization = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text="Fixed Principal + (Year Interest / 24)"
    )
    
    recalculated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('loan', 'year')
        ordering = ['year']
        indexes = [
            models.Index(fields=['loan', 'year']),
            models.Index(fields=['loan', 'fees_paid']),  # For querying unpaid fees
        ]

    def __str__(self):
        status = "Paid" if self.fees_paid else "Unpaid"
        return f"Year {self.year} Recalculation - Loan {self.loan.control_number} ({status})"
    
    def mark_fees_as_paid(self, or_number):
        """Mark the yearly recalculation fees as paid"""
        from django.utils import timezone
        
        if self.fees_paid:
            raise ValueError("Fees have already been paid for this year")
        
        self.fees_paid = True
        self.fees_paid_date = timezone.now().date()
        self.fees_or_number = or_number
        self.save(update_fields=['fees_paid', 'fees_paid_date', 'fees_or_number'])
        
        print(f"✅ Year {self.year} fees marked as paid: {self.fees_paid}")
        
        return True
class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_valid(self):
        return now() < self.created_at + timedelta(hours=1)  

class Archive(models.Model):
    ARCHIVE_TYPES = [
        ('Member', 'Member'),
        ('Account', 'Account'),
        ('Loan', 'Loan'),
        ('Payment', 'Payment'),
    ]
    
    archive_type = models.CharField(
        max_length=20,
        choices=ARCHIVE_TYPES,
        default='Loan'
    )
    archived_data = models.JSONField()
    archived_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        if isinstance(self.archived_data, dict):
            for key, value in self.archived_data.items():
                if isinstance(value, (date, datetime)): 
                    self.archived_data[key] = value.strftime('%Y-%m-%d')  

        
        if self.archive_type in ['Member', 'Loan', 'Account', 'Payment'] and not isinstance(self.archived_data, dict):
            raise ValidationError(f"{self.archive_type} archive must have a dictionary format.")
        
    def __str__(self):
        return f"{self.archive_type} archived on {self.archived_at}"

    def save(self, *args, **kwargs):
        if isinstance(self.archived_data, dict):
            for key, value in self.archived_data.items():
                if isinstance(value, (date, datetime)):
                    self.archived_data[key] = value.strftime('%Y-%m-%d')
        super().save(*args, **kwargs)

class SystemSettings(models.Model):

    interest_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('8.00'), verbose_name="Interest Rate (in %)"
    )
    service_fee_rate_emergency = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('0.01'), verbose_name="Emergency Loan Service Fee Rate"
    )
    penalty_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('.02'), verbose_name="Penalty Rate"
    )
    service_fee_rate_regular_1yr = models.DecimalField(
        max_digits=5, decimal_places=3, default=Decimal('0.010'),
        verbose_name="Regular Loan Service Fee Rate (<=1 year)"
    )
    service_fee_rate_regular_2yr = models.DecimalField(
        max_digits=5, decimal_places=3, default=Decimal('0.015'),
        verbose_name="Regular Loan Service Fee Rate (<=2 years)"
    )
    service_fee_rate_regular_3yr = models.DecimalField(
        max_digits=5, decimal_places=3, default=Decimal('0.020'),
        verbose_name="Regular Loan Service Fee Rate (<=3 years)",
    )
    service_fee_rate_regular_4yr = models.DecimalField(
        max_digits=5, decimal_places=3, default=Decimal('0.025'),
        verbose_name="Regular Loan Service Fee Rate (>3 years)"
    )
    admin_cost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('240.00'))
    notarial_fee = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('100.00'))

    def __str__(self):
        return "System Settings"

    @staticmethod
    def get_settings():
        # Ensure only one instance exists
        settings, created = SystemSettings.objects.get_or_create(pk=1)
        return settings

    # Normalizes interest rate to a decimal (e.g., 8.00 -> 0.08, 0.08 -> 0.08)
    # This lets us accept either percent or decimal inputs without double-dividing by 100.
    def get_interest_rate_decimal(self):
        try:
            rate = Decimal(self.interest_rate)
        except Exception:
            rate = Decimal('0.00')
        return (rate / Decimal('100')) if rate > Decimal('1') else rate

    def get_regular_loan_service_fee_rate(self, total_years):
        """
        Determine the service fee rate for a regular loan based on the term.
        """
        if total_years <= 1:
            return self.service_fee_rate_regular_1yr
        elif total_years <= 2:
            return self.service_fee_rate_regular_2yr
        elif total_years <= 3:
            return self.service_fee_rate_regular_3yr
        else:
            return self.service_fee_rate_regular_4yr




    def __str__(self):
        return f"System Settings (Interest Rate: {self.interest_rate}%)"


class Member(models.Model):
    memId = models.AutoField(primary_key=True)
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100)
    birth_date = models.DateField()
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=12)
    gender = models.CharField(
        max_length=20, 
        choices=[('Male', 'Male'), ('Female', 'Female'), ('Others', 'Others')], 
    )
    religion = models.CharField(max_length=100, default='Catholic')
    pstatus = models.CharField(
        max_length=50, 
        choices=[
            ('Single', 'Single'), 
            ('Married', 'Married'), 
            ('Divorced', 'Divorced'), 
            ('Widowed', 'Widowed'), 
            ('In a relationship', 'In a relationship'), 
            ('Engaged', 'Engaged'), 
            ('Baak', 'Baak')
        ], 
        default='Single'
    )
    address = models.TextField(blank=True)
    account_number = models.OneToOneField(
        'Account', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='member'
    )
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='member_profile')
    birth_place = models.CharField(max_length=100, blank=True)  
    age = models.CharField(max_length=100, blank=True)  
    zip_code = models.CharField(max_length=100, blank=True, default='2616')  
    height = models.CharField(max_length=100, blank=True)
    weight = models.CharField(max_length=100, blank=True)
    ann_com = models.CharField(max_length=100, blank=True, default='0')
    mem_co = models.CharField(max_length=255, null=True, blank=True)

    beneficiary = models.CharField(max_length=255, null=True, blank=True)
    relationship = models.CharField(max_length=100)
    addresss = models.CharField(max_length=255, default="Unknown")
    birth_date1 = models.DateField(null=True, blank=True)
    beneficiary2 = models.CharField(max_length=255, null=True, blank=True)
    relationship2 = models.CharField(max_length=255, null=True, blank=True)
    birth_date2 = models.DateField(null=True, blank=True)
    beneficiary3 = models.CharField(max_length=255, null=True, blank=True)
    relationship3 = models.CharField(max_length=255, null=True, blank=True)
    birth_date3 = models.DateField(null=True, blank=True)

    tin = models.CharField(max_length=100, blank=True) 
    in_dep = models.CharField(max_length=100) 
    valid_id = models.CharField(
        max_length=50, 
        choices=[
            ('Philippine Passport', 'Philippine Passport'), 
            ('Drivers License', 'Drivers License'), 
            ('SSS ID', 'SSS ID'), 
            ('GSIS ID', 'GSIS ID'), 
            ('TIN ID', 'TIN ID'), 
            ('Postal ID', 'Postal ID'), 
            ('Voters ID', 'Voters ID'), 
            ('PhilHealth ID', 'PhilHealth ID'), 
            ('National ID', 'National ID')
        ], 
        default='TIN ID'
    )
    id_no = models.CharField(max_length=100, blank=True, default='Not Provided') 
    # recently lang
    # Employment status: Employed = salary-deduction members (no penalty), Outsider = penalizable
    EMPLOYMENT_STATUS_CHOICES = [
        ('Employed', 'Employed'),
        ('Outsider', 'Outsider'),
    ]
    employment_status = models.CharField(
        max_length=20,
        choices=EMPLOYMENT_STATUS_CHOICES,
        default='Outsider',
        help_text="Member type: 'Employed' (salary deduction) or 'Outsider' (penalties applicable)"
    )
    # recently lang ends

    def delete(self, *args, **kwargs):
        try:
            logger.info(f"Archiving Member {self.memId} before deletion.")
            self.archive()  # Archive the member before deleting
            logger.info(f"Member {self.memId} archived successfully.")
        except Exception as e:
            logger.error(f"Error archiving Member {self.memId}: {e}")
        super().delete(*args, **kwargs)
    
    def archive(self):
        try:
            Archive.objects.create(
                archive_type='Member',
                archived_data={
                    "memId": self.memId,
                    "first_name": self.first_name,
                    "middle_name": self.middle_name,
                    "last_name": self.last_name,
                    "birth_date": self.birth_date,
                    "email": self.email,
                    "phone_number": self.phone_number,
                    "gender":self.gender,
                    "religion":self.religion,
                    "pstatus":self.pstatus,
                    "address": self.address,
                    "birth_place":self.birth_place,
                    "age":self.age,
                    "zip_code":self.zip_code,
                    "height":self.height,
                    "weight":self.weight,
                    "annual_income":self.ann_com,
                    "other_coop_member":self.mem_co,
                    "tin":self.tin,
                    "valid_id":self.valid_id,
                    "initial_deposit":self.in_dep,
                    "beneficiary":self.beneficiary,
                    "relationship": self.relationship,
                    "birth_date1":self.birth_date1,
                    "beneficiary2":self.beneficiary2,
                    "relationship2": self.relationship2,
                    "birth_date2":self.birth_date2,
                    "beneficiary3":self.beneficiary3,
                    "relationship3": self.relationship3,
                    "birth_date3":self.birth_date3,
                    "account_number":self.account_number,
                    "id_no":self.id_no,
                },
            )
            logger.info(f"Member {self.memId} archived successfully.")
        except Exception as e:
            logger.error(f"Error while archiving Member {self.memId}: {e}")

    def __str__(self):
        return f"{self.first_name} {self.middle_name} {self.last_name}"

    def clean(self):
        # Validate unique full name (first, middle, last name)
        if Member.objects.filter(first_name=self.first_name, middle_name=self.middle_name, last_name=self.last_name).exclude(pk=self.pk).exists():
            raise ValidationError(f'A member with the name {self.first_name} {self.middle_name} {self.last_name} already exists.')

        # Validate unique email
        if Member.objects.filter(email=self.email).exclude(pk=self.pk).exists():
            raise ValidationError(f'This email {self.email} is already in use.')

        # Validate unique phone number
        if Member.objects.filter(phone_number=self.phone_number).exclude(pk=self.pk).exists():
            raise ValidationError(f'This phone number {self.phone_number} is already in use.')

    def save(self, *args, **kwargs):
        self.clean()  # Validate before saving
        super(Member, self).save(*args, **kwargs)

class Account(models.Model):
    account_number = models.CharField(max_length=20, primary_key=True)
    account_holder = models.OneToOneField(Member, on_delete=models.CASCADE, related_name='accountN')
    shareCapital = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'), validators=[MinValueValidator(Decimal('0.00'))])
    status = models.CharField(max_length=10, choices=[('active', 'Active'), ('inactive', 'Inactive')], default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    or_number = models.CharField(max_length=4, null=True, blank=True)

    def archive(self):
        Archive.objects.create(
            archive_type='Account',
            archived_data={
                "account_number": self.account_number,
                "account_holder": self.account_holder,
                "shareCapital": str(self.shareCapital),
                "status": self.status,
                "created_at": self.created_at,
                "updated_at": self.updated_at,
            },
        ) 

    def close_account(self):
        # recently lang
        if getattr(self, 'status', '').lower() == 'active':
            self.archive()
            self.status = 'inactive'
            self.save()

    def deposit(self, amount):
        max_deposit_limit = Decimal('1000000.00')  # Maximum allowed deposit
        logger.info(f"Account.deposit called for {self.account_number}: amount={amount}, current_balance={self.shareCapital}")

        if getattr(self, 'status', '').lower() == 'active':
            if self.shareCapital + Decimal(amount) > max_deposit_limit:
                logger.error(f"Deposit failed: Exceeds maximum limit for account {self.account_number}.")
                raise ValueError("Deposit failed: Total share capital cannot exceed 1,000,000.00.")

            self.shareCapital += Decimal(amount)
            self.save()

            Ledger.objects.create(
                account_number=self,
                transaction_type='Deposit',
                amount=Decimal(amount),
                description=f"Deposit to account {self.account_number}",
                balance_after_transaction=self.shareCapital
            )

            logger.info(f"Account.deposit SUCCESS for {self.account_number}: new_balance={self.shareCapital}")
        else:
            logger.error(f"Deposit failed: Account {self.account_number} is not active.")
            raise ValueError("Account is not active. Cannot deposit.")

    def withdraw(self, amount, or_number=None, board_resolution=None):
        logger.info(f"Account.withdraw called for {self.account_number}: amount={amount}, current_balance={self.shareCapital}, or_number={or_number}, board_resolution={board_resolution}")
        if getattr(self, 'status', '').lower() == 'active':
            if self.shareCapital >= Decimal(amount):
                self.shareCapital -= Decimal(amount)
                self.save()

                Ledger.objects.create(
                    account_number=self,
                    transaction_type='Withdrawal',
                    amount=Decimal(amount),
                    description=(f"Withdrawal OR {or_number} from account {self.account_number}" if or_number else f"Withdrawal from account {self.account_number}"),
                    balance_after_transaction=self.shareCapital,
                    or_number=or_number,
                    board_resolution=board_resolution
                )

                logger.info(f"Account.withdraw SUCCESS for {self.account_number}: new_balance={self.shareCapital}")
                # Track OR usage for this member for later validation
                try:
                    if or_number:
                        # Create or get an OR tracker entry for this member
                        ORNumberTracker.objects.get_or_create(
                            member=self.account_holder,
                            or_number=or_number,
                            defaults={
                                'loan_type': 'Withdrawal',
                                'loan': None,
                                'is_active': True
                            }
                        )
                except Exception:
                    # Don't fail the withdrawal if tracker creation fails; just log
                    logger.exception(f"Failed to create OR tracker for account {self.account_number} and OR {or_number}")
            else:
                logger.error(f"Withdrawal failed: Insufficient funds in account {self.account_number}.")
                raise ValueError("Insufficient funds.")
        else:
            logger.error(f"Withdrawal failed: Account {self.account_number} is not active.")
            raise ValueError("Account is not active. Cannot withdraw.")

    def __str__(self):
        return f"Account {self.account_number} - {self.account_holder.memId}"





#     due_date = models.DateField()
#     balance = models.DecimalField(max_digits=15, decimal_places=2)
#     is_paid = models.BooleanField(default=False)
#     loan_type = models.CharField(max_length=20, choices=[('Regular', 'Regular'), ('Emergency', 'Emergency')], default='Regular')  # Add loan_type field
    
#     def __str__(self):
#         return f"Payment for Loan {self.loan.control_number} on {self.due_date}"



class LoanManager(models.Manager):
    def create(self, **kwargs):
        # Generate unique control number before creating
        while True:
            control_number = uuid.uuid4().hex[:5].upper()
            if not self.filter(control_number=control_number).exists():
                kwargs['control_number'] = control_number
                break
        return super().create(**kwargs)

class Loan(models.Model):
    PURPOSE_CHOICES = [
        ('Education', 'Education'),
        ('Medical/Emergency', 'Medical/Emergency'),
        ('House Construction', 'House Construction'),
        ('Commodity/Appliances', 'Commodity/Appliances'),
        ('Utility Services', 'Utility Services'),
        ('Others', 'Others'),
    ]
    
    control_number = models.CharField(
        primary_key=True,
        max_length=5,
        unique=True,
        editable=False
    )
    
    account = models.ForeignKey('Account', on_delete=models.CASCADE)
    loan_amount = models.DecimalField(max_digits=15, decimal_places=2)
    
    loan_type = models.CharField(
        max_length=200, choices=[('Regular', 'Regular'), ('Emergency', 'Emergency')], default='Emergency'
    )
    system_settings = models.ForeignKey('SystemSettings', on_delete=models.SET_NULL, null=True, blank=True)
    interest_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00')) 
    loan_period = models.PositiveIntegerField(default=6)  
    loan_period_unit = models.CharField(
        max_length=10, choices=[('months', 'Months'), ('years', 'Years')], default='months'
    )
    loan_date = models.DateField(auto_now_add=True)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=50,choices=[('Ongoing', 'Ongoing'), ('Settled', 'Settled')],
        default='Ongoing'
    )
   
    net_proceeds = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    service_fee = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    admincost = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    notarial = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    cisp = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, default=Decimal('0.00'))
    purpose = models.CharField(max_length=200, choices=PURPOSE_CHOICES, default='Education')
    annual_interest = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))  
    outstanding_balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))  

    co_maker = models.CharField(max_length=255, blank=True)
    co_maker_2 = models.CharField(max_length=255, null=True, blank=True)
    co_maker_3 = models.CharField(max_length=255, null=True, blank=True)
    co_maker_4 = models.CharField(max_length=255, null=True, blank=True)
    co_maker_5 = models.CharField(max_length=255, null=True, blank=True)
    principal = models.DecimalField(
        max_digits=15, 
        decimal_places=2, 
        default=Decimal('0.00'),
        help_text="Fixed principal per payment = loan_amount / total_payments"
    )
    total_payments = models.PositiveIntegerField(
        default=0,
        help_text="Total number of bi-monthly payments"
    )
    remaining_principal = models.DecimalField(
        max_digits=15, 
        decimal_places=2, 
        default=Decimal('0.00'),
        help_text="Remaining principal balance (Previous Balance for next year)"
    )
    is_reloan = models.BooleanField(
        default=False,
        help_text="Whether this loan is a reloan"
    )
    parent_loan = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='child_reloans',
        help_text="Original loan that this reloan is based on"
    )
    reloan_carried_balance = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Remaining balance carried over from parent loan"
    )
    reloan_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date when reloan was processed"
    )
    # Use the custom manager
    objects = LoanManager()

    def save(self, *args, **kwargs):
        # Fallback in case someone uses save() directly instead of create()
        if not self.control_number:
            while True:
                new_control = uuid.uuid4().hex[:5].upper()
                if not Loan.objects.filter(control_number=new_control).exists():
                    self.control_number = new_control
                    break
        # ✅ Enforce: if flagged as reloan, it must reference a parent_loan of the same type
        if getattr(self, 'is_reloan', False) and self.parent_loan:
            try:
                if self.loan_type != self.parent_loan.loan_type:
                    raise ValidationError("Reloan must be the same loan type as its parent (no cross-type reloan).")
            except Exception:
                # Fallback to safe ValidationError if parent not resolvable
                raise ValidationError("Invalid reloan configuration: parent loan required and must match loan type.")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Loan {self.control_number} - {self.account}"
    
    def get_previous_balance(self):
        """
        Get the previous balance for display.
        For new loans, this equals loan_amount.
        For loans with completed years, this equals remaining_principal.
        """
        # Check if any payment has been made
        has_payments = self.paymentschedule_set.filter(is_paid=True).exists()
        
        if not has_payments:
            # Brand new loan - previous balance is the loan amount
            return self.loan_amount
        else:
            # Has payments - use remaining principal
            return self.remaining_principal
    
    def update_outstanding_balance(self, received_amnt):

        formatted_amount = Decimal(received_amnt).quantize(Decimal('0.00'))
        if formatted_amount < self.outstanding_balance:
            self.outstanding_balance -= formatted_amount
            print(f"OUTSTANDING BALANCE after update: {self.outstanding_balance}")
            self.save(update_fields=['outstanding_balance'])
        else:
            raise ValueError("Received amount cannot be greater than the outstanding balance.")

    def archive(self):
        Archive.objects.create(
            archive_type='Loan',
            archived_data={
                "control_number": str(self.control_number),
                "account": (self.account), #2dago
                "loan_amount": str(self.loan_amount),
                "loan_type": self.loan_type,
                "loan_date": str(self.loan_date),
                "due_date": str(self.due_date),
                "status": self.status,
                "net_proceeds": str(self.net_proceeds),
                "purpose": self.purpose,
                "co_maker":self.co_maker,
                "co_maker_2": self.co_maker_2,
                "co_maker_3": self.co_maker_3,
                "co_maker_4": self.co_maker_4,
                "co_maker_5": self.co_maker_5,
            },
        )

    # def mark_as_paid(self):
    #     if self.status != 'Settled':
    #         self.archive()
    #         self.status = 'Settled'
    #         self.save()
    
    #2dago
    def mark_as_paid(self):
        if self.status != 'Settled':
            self.status = 'Settled'
            self.archive()
            self.save()

    def update_status_based_on_schedules(self):
        if self.paymentschedule_set.filter(is_paid=False).exists():
            self.status = 'Ongoing'
            self.archive = False
        else:
            #self.mark_as_paid()
            self.status = 'Settled'
            self.archived = True
        self.save()
    
    # ✅ NEW: Reloan tracking methods
    def get_original_loan(self):
        """
        Get the original (first) loan in the reloan chain.
        For regular loans, returns self. For reloans, traces back to parent.
        """
        if not self.is_reloan or not self.parent_loan:
            return self
        return self.parent_loan.get_original_loan()
    
    def get_reloan_chain(self):
        """
        Get all loans in the reloan chain (original + all reloans).
        Returns list of loans ordered from newest to oldest.
        """
        loans = [self]
        current = self
        
        # Trace up to original loan
        while current.parent_loan:
            loans.append(current.parent_loan)
            current = current.parent_loan
        
        # Add child reloans
        all_children = self._get_all_child_reloans()
        loans.extend(all_children)
        
        return loans
    
    def _get_all_child_reloans(self):
        """Recursively get all child reloans."""
        children = []
        for child in self.child_reloans.all():
            children.append(child)
            children.extend(child._get_all_child_reloans())
        return children
    
    def get_total_reloan_history(self):
        """
        Get comprehensive reloan history with calculations.
        Returns dict with total amounts, count, and breakdown.
        """
        original = self.get_original_loan()
        chain = original.get_reloan_chain()
        
        total_carried = Decimal('0.00')
        total_new_funds = Decimal('0.00')
        reloan_count = sum(1 for loan in chain if loan.is_reloan)
        
        for loan in chain:
            if loan.is_reloan and loan.reloan_carried_balance:
                total_carried += loan.reloan_carried_balance
        
        return {
            'original_loan': original.control_number,
            'loan_chain': [loan.control_number for loan in chain],
            'total_reloans': reloan_count,
            'total_carried_balance': float(total_carried),
            'chain_length': len(chain),
            'active_loan': self.control_number if self.status == 'Ongoing' else None,
        }
    #2dago
    # In models.py - Replace the Loan.save() method

    def save(self, *args, **kwargs):
        print(f"Saving loan: {self.control_number}")
        # Enforce business rule: Reloan rules, but avoid blocking non-reloan field updates
        if getattr(self, 'is_reloan', False):
            update_fields = kwargs.get('update_fields')
            modifying_reloan_fields = bool(update_fields and any(f in update_fields for f in ['is_reloan', 'parent_loan', 'reloan_carried_balance', 'reloan_date']))
            is_creation = not bool(self.pk)
            if not getattr(self, 'parent_loan', None):
                # Only enforce strict parent requirement on creation or when changing reloan-specific fields
                if is_creation or modifying_reloan_fields:
                    raise ValidationError("Reloan requires a parent loan.")
            # Only Regular loans can be reloaned; enforce on creation or when reloan fields change
            parent_type = str(getattr(self.parent_loan, 'loan_type', '')).strip()
            if (is_creation or modifying_reloan_fields) and (str(self.loan_type).strip() != 'Regular' or parent_type != 'Regular'):
                raise ValidationError("Emergency loans cannot be reloaned. Reloan is only allowed for Regular loans.")
        if not self.system_settings:
            self.system_settings = SystemSettings.get_settings()
            print(f"Loaded system settings: {self.system_settings}")

        # Validate loan period
        self.validate_loan_period()

        # Calculate initial values on loan creation
        
        if not self.pk:
            self.calculate_initial_values()
        
        if not self.loan_date:
            self.loan_date = timezone.now().date()
        
        if not self.annual_interest:
            if self.loan_type == 'Emergency':
                self.annual_interest = self.system_settings.interest_rate / Decimal('2')
                print(f"Emergency loan - Interest rate set to: {self.annual_interest}%")
            else:
                self.annual_interest = self.system_settings.interest_rate
                print(f"Regular loan - Interest rate set to: {self.annual_interest}%")

        # Validation checks
        if self.loan_period_unit == 'months' and self.loan_period > 48:
            raise ValueError("Loan period cannot exceed 48 months for regular loans.")
        if self.loan_period_unit == 'years' and self.loan_period > 4:
            raise ValueError("Loan period cannot exceed 4 years for regular loans.")
        if self.loan_period_unit not in ['years', 'months']:
            raise ValueError("Invalid loan_period_unit. Must be 'years' or 'months'.")

        if not hasattr(self.system_settings, 'service_fee_rate_regular_1yr'):
            raise ValueError("Missing 1-year service fee rate in system settings.")

        # Calculate all values
        self.calculate_initial_values()
        
        print("Service Fee:", self.service_fee)
        print("Takehome Pay:", self.net_proceeds)
        
        if self.loan_type == 'Emergency':
            self.admincost = Decimal('20') * Decimal('6')
            print(f"Emergency loan - Admin cost (6 months): {self.admincost}")
        else:
            self.admincost = Decimal(self.system_settings.admin_cost)
            print(f"Regular loan - Admin cost: {self.admincost}") 
            
        self.notarial = Decimal(self.system_settings.notarial_fee)
        
        if self.loan_type == 'Emergency':
            self.cisp = (self.loan_amount / Decimal('1000')) * Decimal('0.75') * Decimal('6')
            print(f"Emergency loan - CISP (6 months): {self.cisp}")
        else:
            self.cisp = (self.loan_amount / Decimal('1000')) * Decimal('0.75') * Decimal('12')
            print(f"Regular loan - CISP (12 months): {self.cisp}")
            # misty
        extra_deduction = self.reloan_carried_balance if getattr(self, 'is_reloan', False) and self.reloan_carried_balance else Decimal('0.00')
        # Include Year 1 interest in net proceeds deduction to match calculate_initial_values
        self.net_proceeds = (self.loan_amount - (
            self.service_fee + self.admincost + 
            self.notarial + self.cisp + self.interest_amount + extra_deduction
        )).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Set outstanding balance
        if not self.outstanding_balance:
            self.outstanding_balance = self.net_proceeds
        else:
            self.outstanding_balance = self.loan_amount - (
                self.service_fee + self.admincost + self.cisp + self.interest_amount + 100
            )
        
        print(f"Loan date set to {self.loan_date}")
        
        # Calculate due date
        if not self.due_date:
            self.due_date = self.calculate_due_date()
            print(f"Calculated due date: {self.due_date}")

        # ✅ CRITICAL: REMOVED yearly_recalculation() call
        # Recalculations will ONLY be created by the signal when payments complete
        
        super().save(*args, **kwargs)
        print(f"Loan {self.control_number} saved successfully.")

        # Generate payment schedule if loan is ongoing
        if self.status == 'Ongoing':
            self.generate_payment_schedule()
    
    # ❌ REMOVE THIS ENTIRE METHOD or make it do nothing
    def yearly_recalculation(self, force_next_year: bool = False):
        """
        DEPRECATED: This method is no longer used.
        Yearly recalculations are now triggered automatically by the 
        signal in signals.py when payment groups are completed.
        
        DO NOT CALL THIS METHOD MANUALLY!
        """
        print("⚠️ WARNING: yearly_recalculation() called but is deprecated!")
        print("   Recalculations are now handled by signals only.")
        return 


    def validate_loan_period(self):
        """Ensure the loan period adheres to type-specific constraints."""
        if self.loan_type == 'Regular' and self.loan_period > 48:
            raise ValueError("Regular loans cannot exceed 4 years (48 months).")
        if self.loan_type == 'Emergency' and self.loan_period > 6:
            raise ValueError("Emergency loans cannot exceed 6 months.")
    # udmin
    def calculate_initial_values(self):
        """
        Calculate initial loan values.
        
        NEW LOGIC:
        - Interest IS calculated and deducted upfront for Year 1
        - Net Proceeds = Loan Amount - (service_fee + admin + notarial + cisp + Year 1 interest)
        - Principal is fixed = loan_amount / total_payments
        """
        # Calculate total payments (bi-monthly)
        if self.loan_type == 'Emergency':
            total_months = self.loan_period  # Already in months
        else:
            total_months = self.loan_period * 12  # Convert years to months
        
        self.total_payments = total_months * 2  # Bi-monthly
        
        # Calculate fixed principal
        self.principal = (self.loan_amount / self.total_payments).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        
        # Initialize remaining principal
        self.remaining_principal = self.loan_amount
        
        # Calculate service fee based on loan type
        self.calculate_service_fee()
        
        # ✅ CRITICAL FIX: Calculate Year 1 interest using normalized decimal rate
        # Accepts settings.interest_rate as 8.00 (percent) or 0.08 (decimal)
        base_rate = self.system_settings.get_interest_rate_decimal()  # e.g., 0.08
        if self.loan_type == 'Emergency':
            # Emergency loans: Half of the regular annual rate (4% if base is 8%)
            # Business rule: Use a flat 4% of loan amount for emergency interest
            emergency_rate = (base_rate / Decimal('2'))  # e.g., 0.04
            self.interest_amount = (
                self.loan_amount * emergency_rate
            ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        else:
            # Regular loans: Full rate for 12 months
            self.interest_amount = (
                self.loan_amount * base_rate
            ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Admin cost
        if self.loan_type == 'Emergency':
            self.admincost = Decimal('20') * Decimal('6')  # ₱20/month × 6 months
        else:
            self.admincost = Decimal(self.system_settings.admin_cost)
        
        # Notarial fee
        self.notarial = Decimal(self.system_settings.notarial_fee)
        
        # CISP
        if self.loan_type == 'Emergency':
            self.cisp = (self.loan_amount / Decimal('1000')) * Decimal('0.75') * Decimal('6')
        else:
            self.cisp = (self.loan_amount / Decimal('1000')) * Decimal('0.75') * Decimal('12')
        
        # ✅ CRITICAL: Net Proceeds NOW INCLUDES interest deduction for Year 1
        extra_deduction = self.reloan_carried_balance if getattr(self, 'is_reloan', False) and self.reloan_carried_balance else Decimal('0.00')
        self.net_proceeds = (self.loan_amount - (
            self.service_fee + 
            self.admincost + 
            self.notarial + 
            self.cisp + 
            self.interest_amount +  # ✅ NOW INCLUDED
            extra_deduction
        )).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Outstanding balance for display purposes
        self.outstanding_balance = self.loan_amount
        
        print(f"\n📊 INITIAL LOAN CALCULATION:")
        print(f"   Loan Amount: ₱{self.loan_amount}")
        print(f"   Total Payments: {self.total_payments}")
        print(f"   Fixed Principal: ₱{self.principal}")
        print(f"   Year 1 Interest: ₱{self.interest_amount}")  # ✅ NOW SHOWS ACTUAL VALUE
        print(f"   Service Fee: ₱{self.service_fee}")
        print(f"   Admin Cost: ₱{self.admincost}")
        print(f"   Notarial: ₱{self.notarial}")
        print(f"   CISP: ₱{self.cisp}")
        print(f"   ✅ Net Proceeds (takehome): ₱{self.net_proceeds}")

    def calculate_interest(self):
        """Calculate the interest amount based on the loan amount and loan type."""
        # ✅ FIX: Normalize interest rate (handles 8.00 or 0.08 transparently)
        base_rate = self.system_settings.get_interest_rate_decimal()  # decimal form (e.g., 0.08)
        if self.loan_type == 'Emergency':
            # Emergency loans: Half of the regular rate
            emergency_rate = (base_rate / Decimal('2'))
            self.interest_amount = (
                self.loan_amount * emergency_rate
            ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            print(f"Emergency loan interest calculated ({(emergency_rate*Decimal('100')).quantize(Decimal('0.01'))}%): ₱{self.interest_amount}")
        else:
            # Regular loans: Use the full normalized interest rate
            self.interest_amount = (
                self.loan_amount * base_rate
            ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            print(f"Regular loan interest calculated ({(base_rate*Decimal('100')).quantize(Decimal('0.01'))}%): ₱{self.interest_amount}")




    
    def calculate_service_fee(self):
        """Calculate the service fee based on the loan type and system settings."""
        if self.loan_type == 'Emergency':
            self.service_fee = self.loan_amount * self.system_settings.service_fee_rate_emergency
        else:
            if self.loan_period <= 12:
                self.service_fee = self.loan_amount * self.system_settings.service_fee_rate_regular_1yr
            elif self.loan_period <= 24:
                self.service_fee = self.loan_amount * self.system_settings.service_fee_rate_regular_2yr
            elif self.loan_period <= 36:
                self.service_fee = self.loan_amount * self.system_settings.service_fee_rate_regular_3yr
            else:
                self.service_fee = self.loan_amount * self.system_settings.service_fee_rate_regular_4yr

        print(f"Service fee calculated: {self.service_fee}")


    def calculate_net_proceeds(self):
        # Keep helper consistent with main logic: deduct Year 1 interest upfront
        self.net_proceeds = self.loan_amount - (
            self.service_fee + self.notarial + self.cisp + self.admincost + self.interest_amount
        )
        return self.net_proceeds
        
    def calculate_due_date(self):
        """Calculate the loan due date based on the loan period."""
        if not self.loan_date:
            raise ValueError("Loan date is not set. Cannot calculate due date.")

        if self.loan_period_unit == 'months':
            return self.loan_date + timezone.timedelta(days=self.loan_period * 30)
        elif self.loan_period_unit == 'years':
            return self.loan_date + timezone.timedelta(days=self.loan_period * 365)
        return None

    #Thursday
    def get_cisp_months(self):
        """
        Get the number of months to use for CISP calculation based on loan type.
        Emergency loans: 6 months
        Regular loans: 12 months
        """
        if self.loan_type == 'Emergency':
            return Decimal('6')
        else:
            return Decimal('12')

    def calculate_cisp(self, balance=None):
        """
        Calculate CISP (Credit Insurance Savings Protection) based on loan type.
        
        Args:
            balance: Optional balance to calculate CISP on. If None, uses loan_amount.
        
        Returns:
            Decimal: Calculated CISP amount
        """
        base_amount = balance if balance is not None else self.loan_amount
        months = self.get_cisp_months()
        
        cisp = (base_amount / Decimal('1000')) * Decimal('0.75') * months
        
        print(f"CISP calculated for {self.loan_type} loan ({months} months): {cisp}")
        return cisp
    def check_loan_eligibility_for_reloan(self):
        """
        Check reloan eligibility using schedule progress (payments made), not calendar time.
        - Regular: eligible for Regular reloan after completing 24 paid schedules (1 year group)
                   also reports can_apply_emergency if >=50% paid (by principal)
        - Emergency: eligible for any loan if >=50% paid (by principal)
        Returns dict with percent_paid and years_completed info.
        """
        # Compute principal-based percent paid and schedule progress
        qs = self.paymentschedule_set.all()
        total_principal = qs.aggregate(total=Sum('principal_amount'))['total'] or Decimal('0')
        unpaid_principal = qs.filter(is_paid=False).aggregate(total=Sum('principal_amount'))['total'] or Decimal('0')
        paid_schedules = qs.filter(is_paid=True).count()
        years_completed = paid_schedules // 24
        if total_principal > 0:
            percent_paid = float((total_principal - unpaid_principal) / total_principal * 100)
        else:
            percent_paid = 0.0
        result = {
            'eligible': False,
            'reason': '',
            'can_apply_emergency': False,
            'percent_paid': percent_paid,
            'years_completed': years_completed,
            'paid_schedules': paid_schedules
        }
        if self.loan_type == 'Regular':
            # Regular→Regular: require completion of at least 24 paid schedules
            if years_completed >= 1:
                result['eligible'] = True
                result['reason'] = f'Regular loan Year 1 completed ({paid_schedules}/24 schedules). You can apply for another Regular loan.'
            else:
                schedules_remaining = max(0, 24 - paid_schedules)
                months_remaining = (schedules_remaining + 1) // 2  # 2 schedules per month
                result['reason'] = (
                    f'Regular reloan available after completing 24 schedules. '
                    f'Currently {paid_schedules}/24 paid. Need {schedules_remaining} more '
                    f'(~{months_remaining} months).'
                )
            # Can apply for Emergency if >= 50% paid
            if percent_paid >= 50:
                result['can_apply_emergency'] = True
                result['reason'] += f' You can also apply for an Emergency loan (paid {percent_paid:.1f}%).'
            else:
                needed = 50 - percent_paid
                result['reason'] += f' Emergency loan available after paying 50% (need {needed:.1f}% more).'
        elif self.loan_type == 'Emergency':
            if percent_paid >= 50:
                result['eligible'] = True
                result['can_apply_emergency'] = True
                result['reason'] = f'Emergency loan is {percent_paid:.1f}% paid. You can apply for Regular or Emergency loan.'
            else:
                needed = 50 - percent_paid
                result['reason'] = f'Must pay at least 50% before applying for another loan. Need {needed:.1f}% more.'
        return result

    #Thursday whole new
    def can_apply_for_loan_type(self, new_loan_type):
        """
        Check if borrower can apply for a specific loan type.
        
        Args:
            new_loan_type: 'Regular' or 'Emergency'
        
        Returns:
            dict: {'can_apply': bool, 'reason': str}
        """
        eligibility = self.check_loan_eligibility_for_reloan()
        
        if new_loan_type == 'Regular':
            # For Regular loan:
            # - If existing loan is Regular: require 24 paid schedules (Year 1 completed)
            # - If existing loan is Emergency: must be 50% paid
            
            if self.loan_type == 'Regular':
                if eligibility.get('years_completed', 0) >= 1:
                    return {
                        'can_apply': True,
                        'reason': f'Eligible: Completed {eligibility.get("paid_schedules", 0)}/24 schedules.'
                    }
                else:
                    remaining = max(0, 24 - int(eligibility.get('paid_schedules', 0)))
                    months_remaining = (remaining + 1) // 2
                    return {
                        'can_apply': False,
                        'reason': f'Must complete 24 schedules for Regular reloan. Need {remaining} more (~{months_remaining} months).'
                    }
            
            elif self.loan_type == 'Emergency':
                if eligibility['percent_paid'] >= 50:
                    return {
                        'can_apply': True,
                        'reason': f'Eligible: Emergency loan is {eligibility["percent_paid"]:.1f}% paid.'
                    }
                else:
                    needed = 50 - eligibility['percent_paid']
                    return {
                        'can_apply': False,
                        'reason': f'Must pay {needed:.1f}% more of Emergency loan (50% required).'
                    }
        
        elif new_loan_type == 'Emergency':
            # For Emergency loan:
            # - If existing loan is Regular: must be 50% paid
            # - If existing loan is Emergency: must be 50% paid
            
            if eligibility['percent_paid'] >= 50:
                return {
                    'can_apply': True,
                    'reason': f'Eligible: Current {self.loan_type} loan is {eligibility["percent_paid"]:.1f}% paid.'
                }
            else:
                needed = 50 - eligibility['percent_paid']
                return {
                    'can_apply': False,
                    'reason': f'Must pay {needed:.1f}% more of current loan (50% required for Emergency loan).'
                }
        
        return {
            'can_apply': False,
            'reason': 'Invalid loan type specified.'
        }#Thursday whole new ends
    def settle_for_reloan(self):
        """
        Settle this loan for reloan purposes.
        Properly archives payment schedules and returns remaining principal balance.
        """
        from decimal import Decimal
        
        # Calculate remaining principal from unpaid schedules
        unpaid_schedules = self.paymentschedule_set.filter(is_paid=False)
        remaining_principal = unpaid_schedules.aggregate(
            total=Sum('principal_amount')
        )['total'] or Decimal('0.00')
        
        print(f"\n📊 SETTLING LOAN FOR RELOAN:")
        print(f"   Loan: {self.control_number}")
        print(f"   Remaining Principal: ₱{remaining_principal}")
        
        # ✅ Archive all payment schedules before settling
        all_schedules = self.paymentschedule_set.all()
        if all_schedules.exists():
            schedules_data = []
            for schedule in all_schedules:
                schedules_data.append({
                    'due_date': schedule.due_date.isoformat(),
                    'principal_amount': str(schedule.principal_amount),
                    'interest_portion': str(schedule.interest_portion),
                    'payment_amount': str(schedule.payment_amount),
                    'is_paid': schedule.is_paid,
                    'or_number': schedule.or_number,
                    'received_amnt': str(schedule.received_amnt),
                    'penalty': str(schedule.penalty),
                    'year_number': schedule.year_number,
                })
            
            Archive.objects.create(
                archive_type='Payment',
                archived_data={
                    'loan_control_number': str(self.control_number),
                    'reason': 'Settled for Reloan',
                    'remaining_principal_at_settlement': str(remaining_principal),
                    'settlement_date': timezone.now().date().isoformat(),
                    'payment_schedules': schedules_data,
                    'total_schedules': len(schedules_data),
                    'total_paid': str(all_schedules.filter(is_paid=True).aggregate(
                        total=Sum('payment_amount')
                    )['total'] or Decimal('0.00')),
                }
            )
            print(f"   ✅ Archived {len(schedules_data)} payment schedules")
        
        # Mark loan as settled
        self.status = 'Settled'
        self.save(update_fields=['status'])
        
        # Mark all unpaid schedules as cancelled (don't mark as paid, but mark as archived)
        unpaid_schedules.update(
            is_paid=False,  # Keep as unpaid but marked as reloan-settled
            balance=Decimal('0.00')
        )
        
        return remaining_principal
    
    def create_reloan(self, new_loan_amount, loan_type, loan_period, loan_period_unit, purpose, co_makers=None):
        """
        Create a reloan by first validating exposure, then settling this loan, then creating new.
        Business rules:
        - Combined exposure (remaining principal + new loan) <= 3x share capital
        - Only one ongoing loan of the same type (this loan is settled/archived)
        - Net proceeds of new loan reduced by carried remaining principal
        """
        from decimal import Decimal
        # Normalize and validate inputs
        if isinstance(new_loan_amount, (int, float, str)):
            new_loan_amount = Decimal(str(new_loan_amount))
        # Coerce loan_period to int
        try:
            loan_period = int(loan_period)
        except (ValueError, TypeError):
            raise ValueError("Invalid loan_period. It must be an integer number of months or years.")
        # Normalize loan type and unit strings
        # Normalize string inputs safely (avoid calling strip on non-strings)
        loan_type = (str(loan_type) if loan_type is not None else '').strip() or self.loan_type
        # ✅ Enforce: Only Regular→Regular reloan is allowed
        if loan_type != 'Regular' or self.loan_type != 'Regular':
            raise ValueError("Emergency loans cannot be reloaned. Reloan is only allowed for Regular loans.")
        loan_period_unit = (str(loan_period_unit) if loan_period_unit is not None else '').strip().lower() or 'months'
        if loan_period_unit not in ('months', 'years'):
            raise ValueError("Invalid loan_period_unit. Must be 'months' or 'years'.")
        purpose = (str(purpose) if purpose is not None else '').strip() or self.purpose
        # Compute remaining principal from unpaid schedules BEFORE settlement
        unpaid_remaining = self.paymentschedule_set.filter(is_paid=False).aggregate(total=Sum('principal_amount'))['total'] or Decimal('0.00')
        # 3x share capital cap on combined exposure
        share_capital = Decimal(self.account.shareCapital)
        max_allowed = (share_capital * Decimal('3'))
        combined_exposure = unpaid_remaining + new_loan_amount
        if combined_exposure > max_allowed:
            raise ValueError(f"Exposure limit breached: ₱{combined_exposure:,.2f} exceeds 3x share capital (₱{max_allowed:,.2f})")

        # Settle current loan and get remaining principal actually carried
        carried = self.settle_for_reloan()
        # Create the new loan
        new_loan = Loan.objects.create(
            account=self.account,
            loan_amount=new_loan_amount,
            loan_type=loan_type,
            loan_period=loan_period,
            loan_period_unit=loan_period_unit,
            purpose=purpose,
            status='Ongoing',
            is_reloan=True,
            parent_loan=self,
            reloan_carried_balance=carried,
            reloan_date=timezone.now().date(),
            co_maker=(co_makers or {}).get('co_maker', ''),
            co_maker_2=(co_makers or {}).get('co_maker_2', ''),
            co_maker_3=(co_makers or {}).get('co_maker_3', ''),
            co_maker_4=(co_makers or {}).get('co_maker_4', ''),
            co_maker_5=(co_makers or {}).get('co_maker_5', ''),
        )
        # Adjust net proceeds to account for carried balance payoff
        try:
            base_takehome = Decimal(new_loan.net_proceeds)
            new_loan.net_proceeds = (base_takehome - carried)
            new_loan.save(update_fields=['net_proceeds'])
        except Exception:
            pass
        return new_loan   
        # udmin whole function
    def generate_payment_schedule(self):
        """
        Generate bi-monthly payment schedule with fixed principal + distributed interest.
        
        NEW FORMULA:
        - Bimonthly Amortization = Fixed Principal + (Yearly Interest / 24)
        """
        if PaymentSchedule.objects.filter(loan=self).exists():
            return
        
        SCHEDULES_PER_YEAR = 24

        # Reconcile principal distribution to avoid rounding drift
        total_payments = int(self.total_payments)
        base_principal = (self.loan_amount / Decimal(total_payments))
        principals = []
        running_sum = Decimal('0.00')
        for i in range(1, total_payments):
            p = base_principal.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            principals.append(p)
            running_sum += p
        # Last schedule principal absorbs rounding delta
        last_p = (self.loan_amount - running_sum).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        principals.append(last_p)

        # Interest portions default to 0.00 for all generated schedules.
        # Year 2+ interest will be introduced/updated by yearly recalculation signals.
        interest_portions = [Decimal('0.00')] * total_payments

        print(f"\n📅 GENERATING PAYMENT SCHEDULE:")
        print(f"   Principal distribution reconciled (sum=loan_amount): ₱{sum(principals)}")

        running_balance = self.loan_amount
        for idx in range(total_payments):
            due_date = self.loan_date + timedelta(days=(idx + 1) * 15)
            # Determine which year this payment belongs to
            year = (idx // SCHEDULES_PER_YEAR) + 1

            principal_i = principals[idx]
            interest_i = interest_portions[idx]
            payment_i = (principal_i + interest_i).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

            running_balance = (running_balance - principal_i).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            if running_balance < Decimal('0.00'):
                running_balance = Decimal('0.00')

            PaymentSchedule.objects.create(
                loan=self,
                principal_amount=principal_i,
                interest_portion=interest_i,
                payment_amount=payment_i,
                original_principal=principal_i,
                due_date=due_date,
                balance=running_balance,
                loan_type=self.loan_type,
                year_number=year
            )

        print(f"   ✅ Created {total_payments} payment schedules")
        print(f"   First payment_amount = ₱{(principals[0] + interest_portions[0]).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)}\n")

    def __str__(self):
        return f"Loan {self.control_number} for {self.account} ({self.status})"
# Thursday new model
class ORNumberTracker(models.Model):
    """Track OR numbers used by each member across all their loans and transactions"""
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='or_numbers')
    or_number = models.CharField(max_length=4)
    # Expand loan_type to cover non-loan categories as well (Withdrawal, Advance, Fees)
    loan_type = models.CharField(
        max_length=20,
        choices=[
            ('Regular', 'Regular'),
            ('Emergency', 'Emergency'),
            ('Withdrawal', 'Withdrawal'),
            ('Advance', 'Advance'),
            ('Fees', 'Fees')
        ],
        default='Regular'
    )
    loan = models.ForeignKey('Loan', on_delete=models.CASCADE, related_name='or_trackers', null=True, blank=True)
    first_used_date = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)  # False when loan is fully paid
    
    class Meta:
        db_table = 'or_number_tracker'
        unique_together = ('member', 'or_number')  # One OR per member ever
        ordering = ['-first_used_date']
    
    def __str__(self):
        return f"OR {self.or_number} - {self.member} ({self.loan_type})"    
# Thursday new model ends  
class PaymentSchedule(models.Model):
    loan = models.ForeignKey(Loan, on_delete=models.CASCADE)
    principal_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    advance_pay = models.DecimalField(max_digits=15, decimal_places=2,  default=Decimal('0.00'))
    under_pay = models.DecimalField(max_digits=15, decimal_places=2,  default=Decimal('0.00'))
    received_amnt = models.DecimalField(max_digits=15, decimal_places=2,  default=Decimal('0.00'))
    payment_amount = models.DecimalField(max_digits=15, decimal_places=2,  default=Decimal('0.00'))
    penalty = models.DecimalField(max_digits=15, decimal_places=2,default=Decimal('0.00'))
    penalty_collected = models.BooleanField(default=False)  # ✅ Track if penalty was already deducted from share capital
    due_date = models.DateField()
    balance = models.DecimalField(max_digits=15, decimal_places=2,default=Decimal('0.00'))
    remaining_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    or_number = models.CharField(max_length=4, null=True, blank=True)
    is_paid = models.BooleanField(default=False)
    loan_type = models.CharField(max_length=20, choices=[('Regular', 'Regular'), ('Emergency', 'Emergency')], default='Regular')  
    original_principal = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True) #allen
    # udmin new fields
    interest_portion = models.DecimalField(
        max_digits=15, 
        decimal_places=2, 
        default=Decimal('0.00'),
        help_text="Interest portion of this payment"
    )
    year_number = models.PositiveIntegerField(
        default=1,
        help_text="Which year this payment belongs to (1-4)"
    )
    date_paid = models.DateField(
        null=True, 
        blank=True,
        help_text="Actual date when this payment was made"
    )
    # Dual-mode advance / curtailment support
    is_covered_by_advance = models.BooleanField(
        default=False,
        help_text="Marked True if this schedule was paid ahead by an advance coverage event"
    )
    advance_event = models.ForeignKey(
        'PaymentEvent', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='covered_schedules',
        help_text="Reference to PaymentEvent that covered this schedule via pay-ahead"
    )
    curtailed_principal_delta = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text="Amount of principal removed from this schedule due to a curtailment redistribution"
    )
    
    def __str__(self):
        status = "Advance Payment" if (
            self.is_covered_by_advance or
            self.advance_event_id is not None or
            (self.advance_pay and self.advance_pay > Decimal('0.00'))
        ) else "Regular Payment"
        return f"PaymentSchedule {self.pk} for Loan {self.loan.control_number} on {self.due_date} ({status})"

    
    def archive(self):
        Archive.objects.create(
            archive_type='PaymentSchedule',
            archived_data={
                "control_number": str(self.control_number),
                "account": (self.account), #2dago
                "loan":str(self.loan),
                "principal_amount":(self.principal_amount),
                "penalty":str(self.penalty),
                "due_date":str(self.due_date),
                "is_paid":str(self.is_paid),
                
            },
        )
   
    def mark_as_paid(self):
        if self.balance <= Decimal('0.00'):
            self.is_paid = True
            self.save() 
            
    # recently lang whole function of def mark as paid
    def mark_as_paid(self):
        today = timezone.now().date()
        logger.info(f"PaymentSchedule.mark_as_paid called for schedule_id={getattr(self, 'id', 'N/A')}: due_date={self.due_date}, current_penalty={self.penalty}, is_paid={self.is_paid}")
        
        # ✅ FIX: Don't apply penalty again if already marked as paid
        if self.is_paid:
            logger.info(f"Schedule {self.id} already marked as paid, skipping penalty application")
            return
        
        # ✅ NEW FIX: Check if penalty was already collected (set to 0 after successful deduction)
        # If penalty is 0, it means it was already deducted from share capital
        penalty_already_collected = (self.penalty == Decimal('0.00'))
        
        self.is_paid = True
        self.date_paid = today

        # Log borrower account shareCapital before any penalty application
        try:
            borrower_account = self.loan.account
            logger.info(f"Borrower account before mark_as_paid: account_number={getattr(borrower_account, 'account_number', 'N/A')}, shareCapital={getattr(borrower_account, 'shareCapital', 'N/A')}")
        except Exception:
            logger.info("Borrower account not available for logging before mark_as_paid")

        # ✅ CRITICAL FIX: Only apply penalty if it hasn't been collected yet
        # Penalty is collected when:
        # 1. Schedule is overdue (due_date < today)
        # 2. Penalty amount exists (penalty > 0)
        # 3. Penalty hasn't been collected yet (penalty_already_collected = False)
        if self.due_date < today and not penalty_already_collected:
            logger.info(f"Schedule {getattr(self, 'id', 'N/A')} is overdue with uncollected penalty; applying penalty now.")
            self.apply_penalty()
            
        elif penalty_already_collected:
            logger.info(f"Schedule {getattr(self, 'id', 'N/A')} penalty already collected, skipping deduction.")

        # Log borrower account shareCapital after penalty application
        try:
            borrower_account = self.loan.account
            logger.info(f"Borrower account after penalty (mark_as_paid path): account_number={getattr(borrower_account, 'account_number', 'N/A')}, shareCapital={getattr(borrower_account, 'shareCapital', 'N/A')}")
        except Exception:
            logger.info("Borrower account not available for logging after mark_as_paid")

        self.save(update_fields=['is_paid','date_paid', 'penalty'])
        
        loan = self.loan
        loan.remaining_principal = loan.remaining_principal - self.principal_amount
        if loan.remaining_principal < Decimal('0.00'):
            loan.remaining_principal = Decimal('0.00')
        loan.save(update_fields=['remaining_principal'])
    
    
    def process_payment(self, received_amnt):
        received_amnt = Decimal(received_amnt)
        if received_amnt <= 0:
            raise ValueError("Received amount must be greater than zero.")
        
        # Calculate the total amount due including existing penalty
        total_due = self.payment_amount + self.penalty
        
        # Proceed with logic
        if received_amnt > self.payment_amount:
            overpayment = received_amnt - total_due
            self.advance_pay += overpayment
            self.under_pay = Decimal('0.00')
        elif received_amnt < self.payment_amount:
            underpayment = total_due - received_amnt
            self.under_pay += underpayment
            self.advance_pay = Decimal('0.00')
            self.penalty += (self.payment_amount * Decimal('0.02')).quantize(Decimal('0.01'))
        else:
            self.advance_pay = Decimal('0.00')
            self.under_pay = Decimal('0.00')

        self.balance -= received_amnt  # Correct deduction from balance
        self.remaining_balance = self.balance
        if self.balance <= Decimal('0.00'):
            self.is_paid = True
            
    #    Thursday     
        if save:
            self.save()


    def save(self, *args, **kwargs):
        """Enforce schedule invariants: interest_portion and payment_amount.
        If interest_portion is zero/None, recompute from per-year interest.
        Always set payment_amount = principal + interest.
        """
        try:
            SCHEDULES_PER_YEAR = 24
            # Force zero interest for Year 1 regardless of previous value
            if getattr(self, 'year_number', 1) == 1:
                self.interest_portion = Decimal('0.00')
            else:
                # For years > 1, compute interest if missing/zero
                if self.interest_portion is None or self.interest_portion == Decimal('0.00'):
                    # Try cached relation first
                    rec = None
                    try:
                        rec = self.loan.yearly_recalculations.filter(year=self.year_number).first()
                    except Exception:
                        rec = None
                    if not rec:
                        from .models import LoanYearlyRecalculation
                        rec = LoanYearlyRecalculation.objects.filter(loan=self.loan, year=self.year_number).first()
                    year_interest = rec.interest_amount if rec else self.loan.interest_amount
                    ipp = (year_interest / Decimal(SCHEDULES_PER_YEAR)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    self.interest_portion = ipp
            # Always align payment_amount
            self.payment_amount = (self.principal_amount + self.interest_portion).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        except Exception:
            pass
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['due_date']
        #Thursday OR
        indexes = [
            models.Index(fields=['loan', 'is_paid', 'or_number']),
            models.Index(fields=['loan', 'due_date']),
        ]
        #Thursday ends
        # constraints = [
        #     models.UniqueConstraint(
        #         fields=['or_number', 'loan', 'loan_type'],
        #         name='unique_or_per_member_loan_type',
        #         condition=models.Q(or_number__isnull=False)
        #     )
        # ]
# recent lang
    def apply_penalty(self):
        """Apply penalty for overdue schedules with tracking"""
        today = timezone.now().date()
        
        print(f"\n🔍 apply_penalty() called for schedule {self.id}")
        print(f"   Today: {today}, Due Date: {self.due_date}, Overdue: {today > self.due_date}")
        
        # ✅ CRITICAL: Check if penalty was already collected (prevent duplicate deduction)
        if self.penalty_collected:
            print(f"   ⏭️ SKIPPING - Penalty already collected for this schedule")
            logger.info(f"Penalty already collected for schedule {self.id}, skipping")
            return
        
        if today > self.due_date:
            # Skip penalty for employed members
            try:
                member = self.loan.account.account_holder
                employment_status = getattr(member, 'employment_status', 'Outsider')
                print(f"   Member: {member.first_name} {member.last_name}, Status: {employment_status}")
                
                if employment_status == 'Employed':
                    print(f"   ✅ SKIPPING - Employed member (no penalties for salary-deduction members)")
                    logger.info(f"Skipping penalty for employed member on schedule {self.id}")
                    return
                    
                print(f"   ✅ PROCEEDING - Outsider member (penalties apply)")
            except Exception as e:
                logger.error(f"Error checking employment status: {e}", exc_info=True)
                pass

            # ✅ CRITICAL FIX: Always try to collect if overdue, regardless of current penalty value
            # Calculate penalty amount if not already present
            penalty_amount = self.penalty if self.penalty > Decimal('0.00') else (self.payment_amount * Decimal('0.02')).quantize(Decimal('0.01'))
            
            # Store original penalty for collection tracking
            original_penalty = penalty_amount
            print(f"   Penalty Amount: ₱{penalty_amount}")
            
            # Update penalty field if it was zero
            if self.penalty == Decimal('0.00'):
                self.penalty = penalty_amount
                try:
                    self.save(update_fields=['penalty'])
                    logger.info(f"Penalty calculated for schedule {self.id}: ₱{penalty_amount}")
                except Exception as e:
                    logger.error(f"Failed to save initial penalty: {e}")
                    return

            # Try to collect penalty
            deducted = False
            remaining = original_penalty
            total_collected = Decimal('0.00')

            accounts_to_try = []
            
            # Add borrower's account
            try:
                borrower_account = self.loan.account
                if borrower_account:
                    accounts_to_try.append(('borrower', borrower_account))
            except Exception as e:
                logger.error(f"Error accessing borrower account: {e}")

            # Collect comaker accounts (employed only)
            comaker_fields = ['co_maker', 'co_maker_2', 'co_maker_3', 'co_maker_4', 'co_maker_5']
            for field in comaker_fields:
                try:
                    name = getattr(self.loan, field, None)
                    if not name:
                        continue
                    parts = name.split()
                    if len(parts) >= 2:
                        first = parts[0]
                        last = parts[-1]
                        candidate = Member.objects.filter(
                            first_name__iexact=first, 
                            last_name__iexact=last, 
                            employment_status='Employed'
                        ).first()
                    else:
                        candidate = Member.objects.filter(
                            Q(first_name__icontains=name) | Q(last_name__icontains=name), 
                            employment_status='Employed'
                        ).first()

                    if candidate and hasattr(candidate, 'accountN') and candidate.accountN:
                        accounts_to_try.append((f'comaker_{field}', candidate.accountN))
                except Exception as e:
                    logger.error(f"Error evaluating comaker {field}: {e}")

            # Import tracking model
            from .models import PenaltyCollection

            # ✅ DEBUG: Log the accounts we're trying
            logger.info(f"🔍 Attempting to collect penalty ₱{original_penalty} from {len(accounts_to_try)} account(s)")
            for owner_type, account in accounts_to_try:
                logger.info(f"   - {owner_type}: {account.account_number} (status={account.status}, balance=₱{account.shareCapital})")

            # Attempt to collect from accounts
            for owner_type, account in accounts_to_try:
                try:
                    # ✅ FIX: Refresh account to get latest data
                    account.refresh_from_db()
                    
                    # ✅ FIX: Normalize status check (strip whitespace, lowercase)
                    account_status = str(getattr(account, 'status', '')).lower().strip()
                    if not account or account_status != 'active':
                        logger.info(f"⏭️ Skipping account {getattr(account, 'account_number', 'N/A')} - status={account_status}")
                        continue

                    available = Decimal(account.shareCapital)
                    
                    if available <= Decimal('0.00'):
                        logger.info(f"⏭️ Account {account.account_number} has insufficient funds (₱{available})")
                        continue

                    withdraw_amount = min(available, remaining).quantize(Decimal('0.01'))
                    
                    if withdraw_amount <= Decimal('0.00'):
                        logger.info(f"⏭️ Withdraw amount is ₱{withdraw_amount} - skipping")
                        continue

                    # ✅ CRITICAL: Perform withdrawal first
                    logger.info(f"💳 Attempting to withdraw ₱{withdraw_amount} from {account.account_number} ({owner_type})")
                    account.withdraw(withdraw_amount)  # auto-collections do not use OR
                    
                    # ✅ Refresh to verify the withdrawal worked
                    account.refresh_from_db()
                    logger.info(f"✅ Withdrawal successful - new balance: ₱{account.shareCapital}")
                    
                    # Only update tracking AFTER successful withdrawal
                    remaining -= withdraw_amount
                    total_collected += withdraw_amount
                    
                    # Track the collection
                    collection_method = 'auto_comaker' if 'comaker' in owner_type else 'auto_borrower'
                    PenaltyCollection.objects.create(
                        payment_schedule=self,
                        amount=withdraw_amount,
                        collection_method=collection_method,
                        collected_from_account=account.account_number,
                        notes=f"Auto-collected from {owner_type}"
                    )
                    
                    logger.info(f"✅ Successfully withdrew ₱{withdraw_amount} from {account.account_number} (Remaining: ₱{remaining})")

                    if remaining <= Decimal('0.00'):
                        deducted = True
                        logger.info(f"✅ Full penalty collected (₱{total_collected})")
                        break
                        
                except ValueError as e:
                    # Withdrawal failed due to insufficient funds or other business rule
                    logger.warning(f"❌ Cannot withdraw from {getattr(account, 'account_number', 'N/A')}: {e}")
                    continue
                except Exception as e:
                    # ✅ Better error logging
                    logger.error(f"❌ Unexpected error withdrawing from {getattr(account, 'account_number', 'N/A')}: {type(e).__name__}: {e}", exc_info=True)
                    continue

            # Persist result
            if deducted:
                # Full penalty collected - clear the penalty field and mark as collected
                try:
                    self.penalty = Decimal('0.00')
                    self.penalty_collected = True  # ✅ Mark that penalty was successfully deducted
                    self.save(update_fields=['penalty', 'penalty_collected'])
                    logger.info(f"✅ Penalty cleared and marked as collected for schedule {self.id} after collecting ₱{total_collected}")
                except Exception as e:
                    logger.error(f"Failed to clear penalty after collection: {e}")
            else:
                # Partial or no collection - keep penalty visible for manual payment
                if total_collected > Decimal('0.00'):
                    # Reduce penalty by collected amount
                    try:
                        self.penalty = remaining
                        self.penalty_collected = True  # ✅ Mark that penalty was attempted to be collected (at least partially)
                        self.save(update_fields=['penalty', 'penalty_collected'])
                        logger.info(f"⚠️ Partial collection: ₱{total_collected} collected, ₱{remaining} remains (marked as collected)")
                    except Exception as e:
                        logger.error(f"Failed to update remaining penalty: {e}")
                else:
                    logger.warning(f"⚠️ No funds available to collect penalty ₱{self.penalty} for schedule {self.id}")
#     def apply_penalty(self):
#         """Apply penalty for overdue schedules (recalculates based on current payment_amount).
# # recently lang
#         Note: Apply penalty based on due date and existing penalty amount regardless of
#         the current `is_paid` flag. This allows `mark_as_paid()` (which may set
#         `is_paid=True` before calling) to still trigger penalty calculation and
#         automatic deduction for late payments.
#         """
#         today = timezone.now().date()
#         # If overdue, always attempt collection. If penalty is not set yet,
#         # calculate it now; if it's already set, attempt to collect the existing amount.
#         if today > self.due_date:
#             # Skip penalty for employed members (salary deduction)
#             try:
#                 member = self.loan.account.account_holder
#                 if getattr(member, 'employment_status', 'Outsider') == 'Employed':
#                     # No penalty for employed members
#                     return
#             except Exception:
#                 # If we can't resolve member for any reason, fall back to applying penalty
#                 pass

#             # Calculate penalty if not already present
#             if self.penalty == Decimal('0.00'):
#                 self.penalty = (self.payment_amount * Decimal('0.02')).quantize(Decimal('0.01'))

#             # Try to automatically deduct the penalty from the borrower's deposit first;
#             # if insufficient, try each comaker's deposit (in order). If deduction succeeds,
#             # consider the penalty collected (set to 0). Otherwise persist the penalty amount.
#             deducted = False
#             penalty_amount = self.penalty

#             # New: Attempt to collect the penalty by combining available shareCapital
#             # across borrower and employed comakers. This allows partial withdrawals
#             # from multiple accounts so the penalty can be covered even when no
#             # single account has the full amount.
#             remaining = penalty_amount

#             accounts_to_try = []
#             try:
#                 borrower_account = self.loan.account
#                 if borrower_account:
#                     accounts_to_try.append(('borrower', borrower_account))
#             except Exception as e:
#                 logger.info(f"Error accessing borrower account for penalty deduction: {e}")

#             # Collect comaker accounts (best-effort name match) in order
#             comaker_fields = ['co_maker', 'co_maker_2', 'co_maker_3', 'co_maker_4', 'co_maker_5']
#             for field in comaker_fields:
#                 try:
#                     name = getattr(self.loan, field, None)
#                     if not name:
#                         continue
#                     parts = name.split()
#                     if len(parts) >= 2:
#                         first = parts[0]
#                         last = parts[-1]
#                         candidate = Member.objects.filter(first_name__iexact=first, last_name__iexact=last, employment_status='Employed').first()
#                     else:
#                         candidate = Member.objects.filter(Q(first_name__icontains=name) | Q(last_name__icontains=name), employment_status='Employed').first()

#                     if candidate and hasattr(candidate, 'accountN') and candidate.accountN:
#                         accounts_to_try.append((f'comaker_{field}', candidate.accountN))
#                 except Exception as e:
#                     logger.info(f"Error evaluating comaker field {field} for penalty deduction: {e}")

#             # Iterate accounts and withdraw partial amounts up to their available shareCapital
#             for owner_type, account in accounts_to_try:
#                 try:
#                     if not account or getattr(account, 'status', '').lower() != 'active':
#                         logger.info(f"Skipping account {getattr(account, 'account_number', 'N/A')} - inactive or missing")
#                         continue

#                     # Refresh available balance
#                     account.refresh_from_db()
#                     available = Decimal(account.shareCapital)
#                     if available <= Decimal('0.00'):
#                         logger.info(f"Account {account.account_number} has no available shareCapital")
#                         continue

#                     withdraw_amount = min(available, remaining).quantize(Decimal('0.01'))
#                     if withdraw_amount <= Decimal('0.00'):
#                         continue

#                     # Perform withdrawal for the partial amount
#                     account.withdraw(withdraw_amount)
#                     remaining -= withdraw_amount
#                     logger.info(f"Collected {withdraw_amount} from {owner_type} account {account.account_number}; remaining penalty {remaining}")

#                     if remaining <= Decimal('0.00'):
#                         deducted = True
#                         break
#                 except Exception as e:
#                     logger.info(f"Failed to withdraw from account {getattr(account, 'account_number', 'N/A')}: {e}")

#             # Persist result: if deducted, clear penalty; otherwise leave the penalty amount set
#             if deducted:
#                 try:
#                     # Record that penalty was collected by zeroing out the schedule penalty
#                     self.penalty = Decimal('0.00')
#                     self.save(update_fields=['penalty'])
#                 except Exception as e:
#                     logger.exception(f"Failed to save PaymentSchedule after penalty deduction: {e}")
#             else:
#                 # Persist the computed penalty so it shows on the schedule for manual collection
#                 try:
#                     self.save(update_fields=['penalty'])
#                 except Exception as e:
#                     logger.exception(f"Failed to save computed penalty on PaymentSchedule: {e}")
        # today = timezone.now().date()
        # if not self.is_paid and today > self.due_date and self.penalty == Decimal('0.00'):
        #     # Always recalculate penalty based on current payment_amount
        #     self.penalty = (self.payment_amount * Decimal('0.02')).quantize(Decimal('0.01'))
        #     self.save(update_fields=['penalty'])
        # recently lang ends
    def apply_advance_pay(self):
        """Apply any advance payments to the remaining balance."""
        if self.advance_pay > Decimal('0.00'):
            self.balance = max(Decimal('0.00'), self.balance - self.advance_pay)
            self.advance_pay = Decimal('0.00')  # Reset advance after applying
            self.save()
            
    def calculate_payment_amount(self):
        base_payment = self.principal_amount + self.interest_portion
        total_payment = base_payment + self.under_pay
        
        self.payment_amount = total_payment
        print(f"Calculated Payment Amount: {self.payment_amount}")
    #Wednesday start 
    def validate_or_number(self, or_number):
        """
        Validate OR number:
        1. Can be used multiple times by same member across ALL their loans
        2. Cannot be used by different members
        3. Available for reuse only after ALL member's loans are paid off
        """
        if not or_number:
            return True, ""
        
        # Get the member from this schedule's loan
        member = self.loan.account.account_holder
        
        # Check if OR is used by a DIFFERENT member
        other_member_usage = ORNumberTracker.objects.filter(
            or_number=or_number
        ).exclude(member=member).exists()
        
        if other_member_usage:
            return False, f"OR {or_number} is already in use by another member"
        
        # ✅ ALLOW: Same member can reuse OR across all their loans
        return True, ""
    #Wednesday end
    # Friday start
    # def save(self, *args, **kwargs):
    #     print(f"PaymentSchedule.save() called for ID: {self.id}")
    #     print(f"  is_paid: {self.is_paid}")
    #     print(f"  or_number: {self.or_number}")
        
    #     # Validate OR number if it's being set
    #     if self.or_number and self.is_paid:
    #         is_valid, error_msg = self.validate_or_number(self.or_number)
    #         if not is_valid:
    #             raise ValidationError(error_msg)
            
    #         # Create OR tracker if this is first time using this OR
    #         member = self.loan.account.account_holder
    #         if not ORNumberTracker.objects.filter(
    #             member=member,
    #             or_number=self.or_number
    #         ).exists():
    #             ORNumberTracker.objects.create(
    #                 member=member,
    #                 or_number=self.or_number,
    #                 loan_type=self.loan.loan_type,
    #                 loan=self.loan,
    #                 is_active=True
    #             )
        
    #     # Only calculate if not using update_fields
    #     if 'update_fields' not in kwargs or kwargs['update_fields'] is None:
    #         self.calculate_payment_amount()
        
    #     super().save(*args, **kwargs)
    #     print(f"✅ PaymentSchedule {self.id} saved successfully")
#wadasilaw
    def save(self, *args, **kwargs):
        """
        Enhanced save:
        - Skip calculate_payment_amount() if update_fields contains 'payment_amount' or 'principal_amount'
        (meaning it's being set by the yearly recalculation signal)
        - Detect transition unpaid -> paid and trigger loan.yearly_recalculation(force_next_year=True)
        - Keep OR number validation and ORNumberTracker creation.
        """
        prev_is_paid = False
        if self.pk:
            try:
                prev_is_paid = PaymentSchedule.objects.filter(pk=self.pk).values_list('is_paid', flat=True).first() or False
            except Exception:
                prev_is_paid = False

        # Validate OR number if it's being set and schedule marked paid
        if self.or_number and self.is_paid:
            is_valid, error_msg = self.validate_or_number(self.or_number)
            if not is_valid:
                raise ValidationError(error_msg)

        # ✅ CRITICAL FIX: Don't recalculate payment_amount if it's being explicitly updated
        update_fields = kwargs.get('update_fields')
        if update_fields is None or ('payment_amount' not in update_fields and 'principal_amount' not in update_fields):
            # Only calculate if payment_amount/principal_amount are NOT being explicitly set
            self.calculate_payment_amount()

        super().save(*args, **kwargs)

        # Post-save: create OR tracker if needed
        if self.or_number and self.is_paid:
            member = self.loan.account.account_holder
            ORNumberTracker.objects.get_or_create(
                member=member,
                or_number=self.or_number,
                defaults={
                    'loan_type': self.loan.loan_type,
                    'loan': self.loan,
                    'is_active': True
                }
            )

        # If schedule transitioned from unpaid -> paid, check if its year-group is fully paid
        if not prev_is_paid and self.is_paid:
            try:
                SCHEDULES_PER_YEAR = 24
                ordered = list(self.loan.paymentschedule_set.order_by('due_date').all())
                idx = next((i for i, s in enumerate(ordered) if s.pk == self.pk), None)
                if idx is not None:
                    year_index = (idx // SCHEDULES_PER_YEAR) + 1
                    start = (year_index - 1) * SCHEDULES_PER_YEAR
                    end = start + SCHEDULES_PER_YEAR
                    year_scheds = ordered[start:end]
                    if year_scheds and all(s.is_paid for s in year_scheds):
                        # force creation of next-year snapshot
                        self.loan.yearly_recalculation(force_next_year=True)
                        # persist loan updates
                        try:
                            self.loan.save(update_fields=['service_fee', 'admincost', 'cisp', 'outstanding_balance'])
                        except Exception:
                            self.loan.save()
            except Exception as e:
                logger.exception(f"Error triggering yearly_recalculation for Loan {getattr(self.loan, 'control_number', 'N/A')}: {e}")

        logger.debug(f"PaymentSchedule {self.id} saved (is_paid={self.is_paid}, or_number={self.or_number})")


# =========================
# PaymentEvent Model (Dual Mode Tracking)
# =========================
class PaymentEvent(models.Model):
    MODE_CHOICES = [
        ('regular', 'Regular'),
        ('pay_ahead', 'Pay Ahead'),
        ('curtail', 'Curtailment'),
        ('hybrid', 'Hybrid'),
    ]
    CURTAIL_METHOD_CHOICES = [
        ('shorten', 'Shorten'),
        ('redistribute', 'Redistribute'),
    ]

    loan = models.ForeignKey('Loan', on_delete=models.CASCADE, related_name='payment_events')
    schedule = models.ForeignKey('PaymentSchedule', null=True, blank=True, on_delete=models.SET_NULL, related_name='payment_events')
    mode = models.CharField(max_length=12, choices=MODE_CHOICES)
    curtailment_method = models.CharField(max_length=12, choices=CURTAIL_METHOD_CHOICES, blank=True)
    payment_date = models.DateTimeField(auto_now_add=True)
    due_date = models.DateField(null=True, blank=True, help_text="Primary schedule due date (for listing compatibility)")
    or_number = models.CharField(max_length=4, null=True, blank=True)
    amount_total = models.DecimalField(max_digits=15, decimal_places=2)
    amount_regular = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    amount_pay_ahead = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    amount_curtailment = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    covered_schedule_ids = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    # Compatibility flag: some generic payment flows expect an is_paid attribute
    is_paid = models.BooleanField(default=True, help_text="Compatibility marker; events represent completed payments")

    class Meta:
        ordering = ['-payment_date']
        indexes = [
            models.Index(fields=['loan', 'mode']),
            models.Index(fields=['loan', 'payment_date']),
        ]

    def __str__(self):
        return f"PaymentEvent {self.id} ({self.mode}) Loan {getattr(self.loan,'control_number','?')}" 

    def clean(self):
        # Basic integrity: sum of allocations must match total
        alloc_sum = (self.amount_regular or Decimal('0')) + (self.amount_pay_ahead or Decimal('0')) + (self.amount_curtailment or Decimal('0'))
        if self.amount_total != alloc_sum:
            raise ValidationError("amount_total must equal sum of regular + pay_ahead + curtailment amounts")

    # def save(self, *args, **kwargs):
    #     """
    #     Enhanced save:
    #     - Detect transition unpaid -> paid and trigger loan.yearly_recalculation(force_next_year=True)
    #       when the year-group of schedules is fully paid.
    #     - Keep OR number validation and ORNumberTracker creation.
    #     """
    #     prev_is_paid = False
    #     if self.pk:
    #         try:
    #             prev_is_paid = PaymentSchedule.objects.filter(pk=self.pk).values_list('is_paid', flat=True).first() or False
    #         except Exception:
    #             prev_is_paid = False

    #     # Validate OR number if it's being set and schedule marked paid
    #     if self.or_number and self.is_paid:
    #         is_valid, error_msg = self.validate_or_number(self.or_number)
    #         if not is_valid:
    #             raise ValidationError(error_msg)

    #     # Only calculate if not using update_fields
    #     if 'update_fields' not in kwargs or kwargs['update_fields'] is None:
    #         self.calculate_payment_amount()

    #     super().save(*args, **kwargs)

    #     # Post-save: create OR tracker if needed
    #     if self.or_number and self.is_paid:
    #         member = self.loan.account.account_holder
    #         ORNumberTracker.objects.get_or_create(
    #             member=member,
    #             or_number=self.or_number,
    #             defaults={
    #                 'loan_type': self.loan.loan_type,
    #                 'loan': self.loan,
    #                 'is_active': True
    #             }
    #         )

    #     # If schedule transitioned from unpaid -> paid, check if its year-group is fully paid
    #     if not prev_is_paid and self.is_paid:
    #         try:
    #             # Frontend groups schedules by 24 per year (bi-monthly). Match that same rule.
    #             SCHEDULES_PER_YEAR = 24
    #             ordered = list(self.loan.paymentschedule_set.order_by('due_date').all())
    #             idx = next((i for i, s in enumerate(ordered) if s.pk == self.pk), None)
    #             if idx is not None:
    #                 year_index = (idx // SCHEDULES_PER_YEAR) + 1
    #                 start = (year_index - 1) * SCHEDULES_PER_YEAR
    #                 end = start + SCHEDULES_PER_YEAR
    #                 year_scheds = ordered[start:end]
    #                 if year_scheds and all(s.is_paid for s in year_scheds):
    #                     # force creation of next-year snapshot
    #                     self.loan.yearly_recalculation(force_next_year=True)
    #                     # persist loan updates
    #                     try:
    #                         self.loan.save(update_fields=['service_fee', 'admincost', 'cisp', 'outstanding_balance'])
    #                     except Exception:
    #                         self.loan.save()
    #         except Exception as e:
    #             logger.exception(f"Error triggering yearly_recalculation for Loan {getattr(self.loan, 'control_number', 'N/A')}: {e}")

    #     logger.debug(f"PaymentSchedule {self.id} saved (is_paid={self.is_paid}, or_number={self.or_number})")
        #wadasilaw end
# Friday end
    # def save(self, *args, **kwargs):
    #     print(f"Saving Payment Schedule for Loan {self.loan.control_number}")
    #     # Thursday
    #     print(f"PaymentSchedule.save() called for ID: {self.id}")
    #     print(f"  is_paid: {self.is_paid}")
    #     print(f"  or_number: {self.or_number}")
    #     print(f"  balance: {self.balance}")
    #     # Only calculate if not using update_fields
    #     if 'update_fields' not in kwargs or kwargs['update_fields'] is None:
    #         self.calculate_payment_amount()
        
    #     super().save(*args, **kwargs)
        
    #     print(f"✅ PaymentSchedule {self.id} saved successfully")
    
    
    class Meta:
        ordering = ['due_date']
        indexes = [
            models.Index(fields=['loan', 'is_paid', 'or_number']),
            models.Index(fields=['loan', 'due_date']),
        ]
        #Friday constraints 
        # constraints = [
        #     models.UniqueConstraint(
        #         fields=['or_number', 'loan', 'loan_type'],
        #         name='unique_or_per_member_loan_type_paid',
        #         condition=models.Q(or_number__isnull=False) & models.Q(is_paid=True)  # ✅ Only applies when or_number is NOT NULL
        #     )
        
        #Thursday end
    def __str__(self):
        return f"Payment for Loan {self.loan.control_number} on {self.due_date}"
  



class Payment(models.Model):
    OR = models.CharField(max_length=5, primary_key=True, unique=True)
    payment_schedule = models.ForeignKey(PaymentSchedule, on_delete=models.CASCADE, related_name='payments')
    loan = models.ForeignKey(Loan, on_delete=models.CASCADE, related_name='loans',default=0)
    amount = models.DecimalField(max_digits=10, decimal_places=2, default = Decimal("0.00"))
    date = models.DateField(default=now)
    method = models.CharField(max_length=50, choices=[('Cash', 'Cash'), ('Bank Transfer', 'Bank Transfer')])

    def archive(self):
        member_id = None
        if self.loan and self.loan.account and self.loan.account.account_holder:
            member_id = self.loan.account.account_holder.memId
        Archive.objects.create(
            archive_type='Payment',
            archived_data={
                "OR": str(self.OR),
                "loan": str(self.loan),
                "amount": float(self.amount),
                "date": str(self.date),
                "member_id": member_id, 
            },
        )

    def save(self, *args, **kwargs):
        if self.amount > self.payment_schedule.balance:
            raise ValidationError("Payment amount exceeds the remaining balance.")
        # Log account/shareCapital state before saving payment
        try:
            acct = self.payment_schedule.loan.account
            logger.info(f"Payment.save called: OR={getattr(self, 'OR', 'N/A')}, amount={self.amount}, schedule_id={getattr(self.payment_schedule, 'id', 'N/A')}, account={getattr(acct, 'account_number', 'N/A')}, shareCapital_before={getattr(acct, 'shareCapital', 'N/A')}")
        except Exception:
            logger.info(f"Payment.save called: OR={getattr(self, 'OR', 'N/A')}, amount={self.amount}, schedule_id={getattr(self.payment_schedule, 'id', 'N/A')}, account=N/A")

        super().save(*args, **kwargs)

        # Apply the payment to the schedule and mark as paid
        self.payment_schedule.balance -= self.amount
        # Save balance change first (if needed) then mark as paid which may trigger penalty logic
        try:
            self.payment_schedule.save(update_fields=['balance'])
        except Exception:
            try:
                self.payment_schedule.save()
            except Exception:
                logger.exception("Failed to save payment_schedule.balance after Payment.save")

        # Mark schedule as paid (this may call apply_penalty and trigger withdrawals)
        logger.info(f"Payment.save: marking schedule {getattr(self.payment_schedule, 'id', 'N/A')} as paid now.")
        self.payment_schedule.mark_as_paid()

        # Log account/shareCapital state after payment processing
        try:
            acct = self.payment_schedule.loan.account
            acct.refresh_from_db()
            logger.info(f"Payment.save completed: account={getattr(acct, 'account_number', 'N/A')}, shareCapital_after={getattr(acct, 'shareCapital', 'N/A')}")
        except Exception:
            logger.info("Payment.save completed: account not available for logging after processing")


class Ledger(models.Model):
    ledger_id = models.AutoField(primary_key=True)  
    account_number = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='ledger_entries')
    transaction_type = models.CharField(max_length=20, choices=[('Deposit', 'Deposit'), ('Withdrawal', 'Withdrawal')])
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    description = models.TextField()
    balance_after_transaction = models.DecimalField(max_digits=15, decimal_places=2)
    or_number = models.CharField(max_length=10, null=True, blank=True)
    board_resolution = models.CharField(max_length=50, null=True, blank=True)
    timestamp = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.transaction_type} of {self.amount} on {self.timestamp}"

# class AuditLog(models.Model):
#     ACTION_TYPES = [
#         ('CREATE', 'Create'),
#         ('UPDATE', 'Update'),
#         ('DELETE', 'Delete'),
#         ('LOGIN', 'Login'),
#         ('LOGOUT', 'Logout'),
#     ]
    
#     action_type = models.CharField(max_length=50, choices=ACTION_TYPES)
#     description = models.TextField()
#     user = models.CharField(max_length=100)  
#     timestamp = models.DateTimeField(auto_now_add=True)

#     def __str__(self):
#         return f"{self.action_type} by {self.user} at {self.timestamp}"



# audit
class AuditLog(models.Model):
    ACTION_CHOICES = [
        ('CREATED', 'Created'),
        ('UPDATED', 'Updated'),
        ('DELETED', 'Deleted'),
        ('LOGIN', 'Login'),
        ('LOGOUT', 'Logout'),
    ]

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action_type = models.CharField(max_length=20, choices=ACTION_CHOICES)
    description = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.timestamp} - {self.user} - {self.action_type}"


class ArchivedAccount(models.Model):
    archive_type = models.CharField(max_length=50)
    archived_data = models.JSONField()  
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Archived Account {self.id}"
    

class ArchivedPayment(models.Model):
    account_number = models.CharField(max_length=50)
    account_holder = models.CharField(max_length=200)
    payment_amount = models.DecimalField(max_digits=12, decimal_places=2)
    loan_type = models.CharField(max_length=50)
    loan_control_number = models.CharField(max_length=50, null=True, blank=True)
    date_paid = models.DateTimeField()
    or_number = models.CharField(max_length=4, null=True, blank=True)
    payment_type = models.CharField(max_length=50, default='Schedule Payment')
    archived_at = models.DateTimeField(auto_now_add=True)
    archived_by = models.ForeignKey(User, on_delete=models.CASCADE)
    
    class Meta:
        db_table = 'archived_payment_records'
        ordering = ['-date_paid']
    
    def __str__(self):
        return f"{self.account_holder} - {self.payment_amount} - {self.date_paid}"
    
class PaymentHistory(models.Model):
    account_number = models.CharField(max_length=50)
    control_number = models.CharField(max_length=50)
    loan_type = models.CharField(max_length=20)
    payment_amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date = models.DateField()
    or_number = models.CharField(max_length=50, blank=True, null=True)
    status = models.CharField(max_length=20, default='Paid')
    archived_loan = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'payment_history'
        ordering = ['-payment_date']
    
    def __str__(self):
        return f"{self.account_number} - {self.or_number}"
# chicha
class YearlyFinancialSummary(models.Model):
    """
    Stores financial summary data for each year.
    Automatically created at year-end or manually triggered.
    """
    year = models.IntegerField(unique=True, db_index=True)
    
    # Loan Statistics
    total_loans_released = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_regular_loans = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_emergency_loans = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    loan_count = models.IntegerField(default=0)
    
    # Penalties
    total_penalties_collected = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    
    # Fees Breakdown
    total_service_fees = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_interest = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_admin_costs = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_notarial_fees = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_cisp = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    total_fees_collected = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    
    # Member Statistics
    active_members = models.IntegerField(default=0)
    new_members_added = models.IntegerField(default=0)
    archived_members = models.IntegerField(default=0)
    
    # Borrower Statistics
    active_borrowers = models.IntegerField(default=0)
    paid_off_borrowers = models.IntegerField(default=0)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_finalized = models.BooleanField(default=False)  # True when year is complete
    
    class Meta:
        db_table = 'yearly_financial_summary'
        ordering = ['-year']
        verbose_name = 'Yearly Financial Summary'
        verbose_name_plural = 'Yearly Financial Summaries'
    
    def __str__(self):
        return f"Financial Summary for {self.year}"
    
    @classmethod
    def get_or_create_current_year(cls):
        """Get or create summary for current year"""
        current_year = timezone.now().year
        summary, created = cls.objects.get_or_create(
            year=current_year,
            defaults={'is_finalized': False}
        )
        return summary
    
    @classmethod
    def finalize_year(cls, year):
        """
        Finalize a year's summary and mark it as complete.
        This should be called at year-end.
        """
        try:
            summary = cls.objects.get(year=year)
            summary.is_finalized = True
            summary.save()
            
            # Create next year's summary
            next_year = year + 1
            cls.objects.get_or_create(
                year=next_year,
                defaults={'is_finalized': False}
            )
            
            return True
        except cls.DoesNotExist:
            return False
    
    def calculate_totals(self):
        """Calculate all totals for this year"""
        from datetime import datetime
        from django.db.models import Sum, Q
        
        year_start = datetime(self.year, 1, 1)
        year_end = datetime(self.year, 12, 31, 23, 59, 59)
        
        # Get loans created in this year
        year_loans = Loan.objects.filter(
            loan_date__gte=year_start.date(),
            loan_date__lte=year_end.date()
        )
        
        # === LOANS RELEASED ===
        self.total_loans_released = year_loans.aggregate(
            total=Sum('loan_amount')
        )['total'] or Decimal('0.00')
        
        self.total_regular_loans = year_loans.filter(
            loan_type='Regular'
        ).aggregate(total=Sum('loan_amount'))['total'] or Decimal('0.00')
        
        self.total_emergency_loans = year_loans.filter(
            loan_type='Emergency'
        ).aggregate(total=Sum('loan_amount'))['total'] or Decimal('0.00')
        
        self.loan_count = year_loans.count()
        
        # === FEES COLLECTED ===
        self.total_service_fees = year_loans.aggregate(
            total=Sum('service_fee')
        )['total'] or Decimal('0.00')
        
        self.total_interest = year_loans.aggregate(
            total=Sum('interest_amount')
        )['total'] or Decimal('0.00')
        
        self.total_admin_costs = year_loans.aggregate(
            total=Sum('admincost')
        )['total'] or Decimal('0.00')
        
        self.total_notarial_fees = year_loans.aggregate(
            total=Sum('notarial')
        )['total'] or Decimal('0.00')
        
        self.total_cisp = year_loans.aggregate(
            total=Sum('cisp')
        )['total'] or Decimal('0.00')
        
        self.total_fees_collected = (
            self.total_service_fees +
            self.total_interest +
            self.total_admin_costs +
            self.total_notarial_fees +
            self.total_cisp
        )
        
        # === PENALTIES COLLECTED ===
        # Get from PenaltyCollection model (auto-collected penalties)
        auto_penalties = PenaltyCollection.objects.filter(
            collection_date__year=self.year
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        # Get manually paid penalties
        # Penalties that were paid with the schedule
        manual_penalties = PaymentSchedule.objects.filter(
            is_paid=True,
            penalty__gt=0,
            due_date__year=self.year
        ).exclude(
            # Exclude penalties that were auto-collected (tracked in PenaltyCollection)
            id__in=PenaltyCollection.objects.filter(
                collection_date__year=self.year
            ).values_list('payment_schedule_id', flat=True)
        ).aggregate(total=Sum('penalty'))['total'] or Decimal('0.00')
        
        self.total_penalties_collected = auto_penalties + manual_penalties
        
        # === MEMBER STATISTICS ===
        # Active members at end of year
        self.active_members = Member.objects.filter(
            employment_status='Employed'
        ).count()
        
        # Members added this year
        if hasattr(Member, 'accountN'):
            self.new_members_added = Member.objects.filter(
                accountN__created_at__year=self.year
            ).count()
        
        # === BORROWER STATISTICS ===
        # Active borrowers (with ongoing loans)
        self.active_borrowers = Loan.objects.filter(
            status='Ongoing',
            loan_date__year__lte=self.year
        ).values('account__account_holder').distinct().count()
        
        # Paid off borrowers (loans completed in this year)
        self.paid_off_borrowers = Loan.objects.filter(
            status='Settled',
            # You might need to add a completion_date field to track when loan was paid off
            # For now, using loans that were created and completed in this year
            loan_date__year=self.year
        ).values('account__account_holder').distinct().count()
        
        self.save()
        
        return self
# recently lang
class PenaltyCollection(models.Model):
    """
    Track all penalty collections (automatic and manual)
    """
    payment_schedule = models.ForeignKey(
        'PaymentSchedule', 
        on_delete=models.CASCADE,
        related_name='penalty_collections'
    )
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    collection_date = models.DateTimeField(auto_now_add=True)
    collection_method = models.CharField(
        max_length=50,
        choices=[
            ('auto_borrower', 'Auto - Borrower Share Capital'),
            ('auto_comaker', 'Auto - Comaker Share Capital'),
            ('manual', 'Manual Payment'),
        ]
    )
    collected_from_account = models.CharField(max_length=20, null=True, blank=True)  # Account number
    notes = models.TextField(blank=True, null=True)
    
    class Meta:
        db_table = 'penalty_collections'
        ordering = ['-collection_date']
        indexes = [
            models.Index(fields=['collection_date']),
            models.Index(fields=['payment_schedule', 'collection_date']),
        ]
    
    def __str__(self):
        return f"Penalty ₱{self.amount} collected on {self.collection_date.date()}"

