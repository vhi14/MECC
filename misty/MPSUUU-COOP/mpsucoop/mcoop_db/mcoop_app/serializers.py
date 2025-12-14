

from rest_framework import serializers
from django.contrib.auth.models import User
from decimal import Decimal, ROUND_FLOOR, ROUND_HALF_UP
from .models import Member, Account, Loan, PaymentSchedule, Payment,Ledger,SystemSettings, PaymentHistory, PaymentEvent
from django.contrib.auth import authenticate
from rest_framework.response import Response
from rest_framework import status
import uuid
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Archive
from rest_framework import serializers 
from datetime import date, datetime 
from typing import Union
from rest_framework import serializers
from datetime import date, datetime
from .models import AuditLog
from rest_framework.views import APIView
# chicha
from .models import LoanYearlyRecalculation, YearlyFinancialSummary, PenaltyCollection 
# chicha ends
# Serializer for yearly recalculation snapshots
class LoanYearlyRecalculationSerializer(serializers.ModelSerializer):
    #atf
    loan_control_number = serializers.CharField(source='loan.control_number', read_only=True)
    class Meta:
        model = LoanYearlyRecalculation
        fields = ['year','loan_control_number','previous_balance', 'service_fee', 'interest_amount', 'admincost', 'cisp', 'total_fees_due','fees_paid','fees_paid_date','fees_or_number' ,'new_bimonthly_amortization', 'recalculated_at']

class ArchiveSerializer(serializers.ModelSerializer):
    class Meta:
        model = Archive
        fields = ['id', 'archive_type', 'archived_data', 'archived_at']

    def validate_archived_data(self, value):
        #  custom validation logic for archived data
        if not isinstance(value, dict):
            raise serializers.ValidationError("Archived data must be a valid dictionary.")
        
       
        for key, val in value.items():
            if isinstance(val, (date, datetime)):
                value[key] = val.strftime('%Y-%m-%d')  
        return value

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        
        if 'archived_data' in representation:
            archived_data = representation['archived_data']
            for key, value in archived_data.items():
                if isinstance(value, (date, datetime)):
                    archived_data[key] = value.strftime('%Y-%m-%d')  
        return representation



class SystemSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSettings
        fields = '__all__'
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']

class RegisterMemberSerializer(serializers.Serializer):
    account_number = serializers.CharField(max_length=20)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_account_number(self, value):
        if not Account.objects.filter(account_number=value).exists():
            raise serializers.ValidationError("Invalid account number.")
        return value
        
class MemberTokenSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username_or_account = attrs.get("username") or attrs.get("account_number")
        password = attrs.get("password")
        
        # Authenticate user
        user = authenticate(username=username_or_account, password=password)
        if user and hasattr(user, 'member_profile'):
            data = super().validate(attrs)
            
            # Access the member profile
            member = user.member_profile
            print(f"DEBUG: Member profile: {member}")

            # Verify accountN and account_number
            accountN = getattr(member, 'accountN', None)
            if not accountN or not accountN.account_number:
                print("DEBUG: Account information is missing or invalid.")
                raise serializers.ValidationError("Account information is missing or invalid.")
            
            # Add custom fields to the response
            data.update({
                'user_id': user.id,
                'account_number': accountN.account_number,
                'email': user.email,
            })
            print(f"DEBUG: Serialized data: {data}")
            return data
        
        raise serializers.ValidationError("Invalid member credentials.")

class MemberSerializer(serializers.ModelSerializer):
    accountN = serializers.CharField(source='accountN.account_number', read_only=True)
    share_capital = serializers.DecimalField(source='accountN.shareCapital', max_digits=15, decimal_places=2, read_only=True)
    # password = serializers.CharField(write_only=True)
    user = UserSerializer(read_only=True)
    # recently lang
    employment_status = serializers.ChoiceField(
        choices=[('Employed','Employed'), ('Outsider','Outsider')],
        default='Outsider',
        required=False
    )
     
    class Meta:
        # model = Member
        # fields = '__all__'
        model = Member
        # keep using __all__ for now but ensure employment_status is allowed
        fields = '__all__'
        # recenlty lang ends

    def get_accountN(self, obj):
        return obj.accountN.account_number if hasattr(obj, 'accountN') else None
    


    def create(self, validated_data):
        account_data = validated_data.pop('accountN', None)
        validated_data['user'] = None  

        member = Member.objects.create(**validated_data)

        if account_data:
            Account.objects.create(account_holder=member, **account_data)

        return member 

class AccountSerializer(serializers.ModelSerializer):
    account_holder = MemberSerializer(read_only=True)
    class Meta:
        model = Account
        fields = ['account_number', 'account_holder', 'shareCapital', 'status', 'created_at', 'updated_at', 'or_number']


class UpdatePasswordSerializer(serializers.Serializer):
    account_number = serializers.CharField(max_length=20)
    email = serializers.EmailField()
    username = serializers.CharField(max_length=20)
    new_password = serializers.CharField(
        write_only=True, 
        min_length=8, 
        required=False,      # ✅ GAWING OPTIONAL
        allow_blank=True     # ✅ ALLOW EMPTY STRING
    )
class PaymentScheduleSerializer(serializers.ModelSerializer):
    loan_type = serializers.CharField(read_only=True)
    loan_amount = serializers.DecimalField(
        source='loan.loan_amount', 
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('0.00')
    )
    loan_date = serializers.DateField(source='loan.loan_date', read_only=True)
    loan_control_number = serializers.CharField(source='loan.control_number', read_only=True)
    status_label = serializers.SerializerMethodField()
    advance_covered = serializers.SerializerMethodField()
    advance_or_number = serializers.SerializerMethodField()
    
    # NEW: Interest portion breakdown
    interest_portion = serializers.DecimalField(
        max_digits=15, 
        decimal_places=2, 
        read_only=True
    )
    original_principal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    year_number = serializers.IntegerField(read_only=True)
    
    def get_status_label(self, obj):
        try:
            ap = getattr(obj, 'advance_pay', Decimal('0.00')) or Decimal('0.00')
            is_advance = (
                bool(getattr(obj, 'is_covered_by_advance', False)) or
                (getattr(obj, 'advance_event_id', None) is not None) or
                (ap > Decimal('0.00'))
            )
            return 'Advance Payment' if is_advance else 'Regular Payment'
        except Exception:
            return 'Regular Payment'

    def get_advance_covered(self, obj):
        try:
            ap = getattr(obj, 'advance_pay', Decimal('0.00')) or Decimal('0.00')
            return bool(getattr(obj, 'is_covered_by_advance', False)) or (getattr(obj, 'advance_event_id', None) is not None) or (ap > Decimal('0.00'))
        except Exception:
            return False

    def get_advance_or_number(self, obj):
        try:
            ev = getattr(obj, 'advance_event', None)
            return getattr(ev, 'or_number', None) if ev else None
        except Exception:
            return None
    
    class Meta:
        model = PaymentSchedule
        fields = [
            'id', 
            'loan',
            'loan_control_number', 
            'principal_amount', 
            'original_principal',
            'interest_portion',
            'payment_amount',
            'advance_pay',
            'under_pay',
            'received_amnt',
            'penalty',
            'due_date', 
            'date_paid',
            'balance', 
            'is_paid',  
            'loan_type', 
            'loan_amount', 
            'loan_date', 
            'or_number',
            'year_number',
            'is_covered_by_advance',
            'curtailed_principal_delta',
            'status_label',
            'advance_covered',
            'advance_or_number',
        ]

class PaymentEventSerializer(serializers.ModelSerializer):
    loan_control_number = serializers.CharField(source='loan.control_number', read_only=True)
    schedule_id = serializers.IntegerField(source='schedule.id', read_only=True)

    class Meta:
        model = PaymentEvent
        fields = [
            'id','loan','loan_control_number','schedule_id','mode','curtailment_method',
            'payment_date','due_date','or_number','amount_total','amount_regular','amount_pay_ahead',
            'amount_curtailment','covered_schedule_ids','notes','is_paid'
        ]

class LoanSerializer(serializers.ModelSerializer):
    yearly_recalculations = serializers.SerializerMethodField()
    payment_schedule = PaymentScheduleSerializer(
        source='paymentschedule_set', 
        many=True, 
        read_only=True
    )
    account_holder = serializers.SerializerMethodField()
    control_number = serializers.ReadOnlyField()
    
    # NEW FIELDS
    principal = serializers.DecimalField(
        max_digits=15, 
        decimal_places=2, 
        read_only=True
    )
    total_payments = serializers.IntegerField(read_only=True)
    remaining_principal = serializers.DecimalField(
        max_digits=15, 
        decimal_places=2, 
        read_only=True
    )
    # Eligibility helpers
    reloan_eligibility = serializers.SerializerMethodField()
    exposure_headroom = serializers.SerializerMethodField()

    class Meta:
        model = Loan
        fields = [
            'control_number', 
            'account', 
            'loan_amount', 
            'loan_type', 
            'interest_amount',
            'system_settings',
            'service_fee',
            'loan_period', 
            'loan_period_unit', 
            'loan_date', 
            'due_date', 
            'status', 
            'net_proceeds', 
            'cisp', 
            'admincost', 
            'notarial', 
            'outstanding_balance',
            'purpose',  
            'payment_schedule',
            'account_holder',
            'co_maker',
            'co_maker_2',
            'co_maker_3',
            'co_maker_4',
            'co_maker_5',
            'yearly_recalculations',
            # NEW FIELDS
            'principal',
            'total_payments',
            'remaining_principal',
            'reloan_eligibility',
            'exposure_headroom',
            'parent_loan',
            'is_reloan',
            'reloan_carried_balance',
            'reloan_date'
            
        ]
        read_only_fields = [
            'control_number', 
            'loan_date', 
            'due_date', 
            'interest_amount',
            'principal',
            'total_payments',
            'remaining_principal'
        ]
        
    def get_account_holder(self, obj):
        if obj.account and obj.account.account_holder:
            member = obj.account.account_holder
            return f"{member.first_name} {member.middle_name or ''} {member.last_name}".strip()
        return "N/A"
    
    def get_yearly_recalculations(self, obj):
        from .models import LoanYearlyRecalculation
        
        # Filter yearly recalculations for THIS loan only
        recalcs = LoanYearlyRecalculation.objects.filter(loan=obj).order_by('year')
        
        return LoanYearlyRecalculationSerializer(recalcs, many=True).data

    def get_reloan_eligibility(self, obj):
        try:
            schedules = list(obj.paymentschedule_set.all().order_by('due_date', 'id'))
            current_total = len(schedules) if schedules else 0
            original_total = int(getattr(obj, 'total_payments', 0) or 0)
            # Try to recover original total from original_principal if total_payments looks reduced
            try:
                if (original_total <= 0) or (original_total <= current_total):
                    # Find a schedule with a non-zero original_principal, else fallback to principal_amount
                    orig_pp = None
                    for s in schedules:
                        v = getattr(s, 'original_principal', None)
                        if v is not None and Decimal(v) > Decimal('0.00'):
                            orig_pp = Decimal(v)
                            break
                    if orig_pp is None:
                        for s in schedules:
                            pv = getattr(s, 'principal_amount', None)
                            if pv is not None and Decimal(pv) > Decimal('0.00'):
                                orig_pp = Decimal(pv)
                                break
                    if orig_pp and (obj.loan_amount or Decimal('0.00')) > 0:
                        # Derive total as loan_amount / original principal per payment
                        derived = (Decimal(obj.loan_amount) / orig_pp)
                        # Round to nearest integer sensibly
                        derived_int = int(derived.to_integral_value(rounding=ROUND_HALF_UP))
                        if derived_int > current_total:
                            original_total = derived_int
                if original_total <= 0:
                    original_total = current_total
            except Exception:
                if original_total <= 0:
                    original_total = current_total
            if current_total == 0 and original_total == 0:
                return {
                    'eligible': False,
                    'reason': 'No schedules',
                    'paid_ratio': 0.0,
                    'thresholds': {'paid_ratio': 0.5, 'remaining_principal_ratio': 0.5}
                }

            def is_counted_paid(s):
                ap = getattr(s, 'advance_pay', Decimal('0.00')) or Decimal('0.00')
                covered = bool(getattr(s, 'is_covered_by_advance', False)) or (getattr(s, 'advance_event_id', None) is not None) or (ap > Decimal('0.00'))
                return bool(getattr(s, 'is_paid', False)) or covered

            # Baseline by user's rule: original total vs updated unpaid count after advances/reconstruction
            unpaid = [s for s in schedules if not getattr(s, 'is_paid', False)]
            counted_paid_baseline = max(0, original_total - len(unpaid))

            # Derive next-unpaid schedule values to translate advance amounts into "covered" units
            first_unpaid = unpaid[0] if unpaid else (schedules[-1] if schedules else None)
            principal_pp = (getattr(first_unpaid, 'principal_amount', None) or getattr(first_unpaid, 'original_principal', None) or Decimal('0.00')) if first_unpaid else Decimal('0.00')
            amort_pp = (getattr(first_unpaid, 'payment_amount', None) or (principal_pp + (getattr(first_unpaid, 'interest_portion', None) or Decimal('0.00')))) if first_unpaid else Decimal('0.00')

            # Count schedules already flagged as advance-covered to avoid double-counting
            already_advance_count = sum(1 for s in schedules if (not getattr(s, 'is_paid', False)) and (bool(getattr(s, 'is_covered_by_advance', False)) or (getattr(s, 'advance_event_id', None) is not None)))

            # Pull recent PaymentEvents to capture pure advances not yet mapped to schedules
            try:
                events = list(getattr(obj, 'payment_events', None).all())
            except Exception:
                events = []

            ahead_total = sum([(e.amount_pay_ahead or Decimal('0.00')) for e in events if getattr(e, 'mode', '') in ['pay_ahead', 'hybrid']])
            curtail_total = sum([(e.amount_curtailment or Decimal('0.00')) for e in events if getattr(e, 'mode', '') in ['curtail', 'hybrid']])

            # Translate event amounts into equivalent covered counts (approximate):
            # - Pay-ahead uses full amortization per schedule
            # - Curtailment uses per-payment principal
            counts_from_ahead = int((ahead_total / amort_pp).to_integral_value(rounding=ROUND_FLOOR)) if amort_pp and amort_pp > 0 else 0
            counts_from_curtail = int((curtail_total / principal_pp).to_integral_value(rounding=ROUND_FLOOR)) if principal_pp and principal_pp > 0 else 0

            # Avoid double-counting advance coverage already reflected on schedules
            extra_advance_counts = max(0, (counts_from_ahead + counts_from_curtail) - already_advance_count)

            counted_paid_effective = min(original_total, counted_paid_baseline + max(0, extra_advance_counts))
            paid_ratio = float(counted_paid_effective) / float(original_total) if original_total > 0 else 0.0

            # Remaining principal threshold
            # Denominator: prefer loan_amount, else fallback to sum of original principals
            original_amount = (obj.loan_amount or Decimal('0.00'))
            if original_amount <= 0:
                try:
                    original_amount = sum([(getattr(s, 'original_principal', None) or getattr(s, 'principal_amount', Decimal('0.00')) or Decimal('0.00')) for s in schedules]) or Decimal('0.00')
                except Exception:
                    original_amount = Decimal('0.00')
            base_remaining = (getattr(obj, 'remaining_principal', None) or obj.outstanding_balance or Decimal('0.00'))

            # Approximate additional principal effect from events not yet reflected in remaining principal
            principal_from_ahead = (counts_from_ahead * principal_pp) if principal_pp > 0 else Decimal('0.00')
            principal_from_curtail = curtail_total
            extra_principal_effect = principal_from_ahead + principal_from_curtail
            effective_remaining = base_remaining - extra_principal_effect
            if effective_remaining < Decimal('0.00'):
                effective_remaining = Decimal('0.00')

            rem_ratio = float(effective_remaining / original_amount) if original_amount > 0 else 1.0

            eligible = (paid_ratio >= 0.5) or (rem_ratio <= 0.5)
            return {
                'eligible': bool(eligible and (obj.loan_type != 'Emergency')),
                'paid_ratio': round(paid_ratio, 4),
                'remaining_principal_ratio': round(rem_ratio, 4),
                'counts': {
                    'original_total': original_total,
                    'current_total': current_total,
                    'current_unpaid': len(unpaid),
                    'counted_paid_baseline': counted_paid_baseline,
                    'counted_paid_effective': counted_paid_effective,
                    'extra_advance_counts': max(0, extra_advance_counts)
                },
                'effective_remaining_principal': str(effective_remaining.quantize(Decimal('0.01'))),
                'thresholds': {'paid_ratio': 0.5, 'remaining_principal_ratio': 0.5},
                'notes': 'Emergency loans are not reloanable.' if obj.loan_type == 'Emergency' else None
            }
        except Exception as e:
            return {
                'eligible': False,
                'error': str(e)
            }
                # verified_recalcs = []
                # for r in recalcs:
                #     if r.loan.control_number == obj.control_number:
                #         verified_recalcs.append(r)
                #         print(f"   ✅ Year {r.year}: verified")
                #     else:
                #         print(f"   ❌ Year {r.year}: WRONG LOAN {r.loan.control_number}!")
                
                # return LoanYearlyRecalculationSerializer(verified_recalcs, many=True).data

    
    def validate_account_holder(self, value):
        if not value:
            raise serializers.ValidationError("Member is required.")
        return value
    def validate_control_number(self, value):
        try:
            uuid.UUID(str(value))
        except ValueError:
            raise serializers.ValidationError("Invalid UUID format.")
        return value

    def create(self, validated_data):
        loan = Loan.objects.create(**validated_data)
        if loan.status == 'Ongoing':
            loan.generate_payment_schedule()
        return loan
        return instance
    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.calculate_service_fee()
        instance.calculate_net_proceeds()
        instance.calculate_outstanding_balance()
        instance.calculate_interest()
        instance.calculate_cisp()
        instance.save()
        return instance


class LoanDetailedSerializer(serializers.ModelSerializer):
    """Minimal detailed serializer used by the frontend test script.
    Exposes `control_number`, `payment_schedules` (list), and `yearly_recalculations`.
    """
    payment_schedules = PaymentScheduleSerializer(source='paymentschedule_set', many=True, read_only=True)
    yearly_recalculations = serializers.SerializerMethodField()

    class Meta:
        model = Loan
        fields = ['control_number', 'payment_schedules', 'yearly_recalculations']

    def get_yearly_recalculations(self, obj):
        from .models import LoanYearlyRecalculation
        recalcs = LoanYearlyRecalculation.objects.filter(loan=obj).order_by('year')
        return LoanYearlyRecalculationSerializer(recalcs, many=True).data

    def get_reloan_eligibility(self, obj):
        try:
            schedules = list(obj.paymentschedule_set.all().order_by('due_date', 'id'))
            current_total = len(schedules) if schedules else 0
            original_total = int(getattr(obj, 'total_payments', 0) or 0)
            # Try to recover original total from original_principal if total_payments looks reduced
            try:
                if (original_total <= 0) or (original_total <= current_total):
                    # Find a schedule with a non-zero original_principal, else fallback to principal_amount
                    orig_pp = None
                    for s in schedules:
                        v = getattr(s, 'original_principal', None)
                        if v is not None and Decimal(v) > Decimal('0.00'):
                            orig_pp = Decimal(v)
                            break
                    if orig_pp is None:
                        for s in schedules:
                            pv = getattr(s, 'principal_amount', None)
                            if pv is not None and Decimal(pv) > Decimal('0.00'):
                                orig_pp = Decimal(pv)
                                break
                    if orig_pp and (obj.loan_amount or Decimal('0.00')) > 0:
                        # Derive total as loan_amount / original principal per payment
                        derived = (Decimal(obj.loan_amount) / orig_pp)
                        # Round to nearest integer sensibly
                        derived_int = int(derived.to_integral_value(rounding=ROUND_HALF_UP))
                        if derived_int > current_total:
                            original_total = derived_int
                if original_total <= 0:
                    original_total = current_total
            except Exception:
                if original_total <= 0:
                    original_total = current_total
            if current_total == 0 and original_total == 0:
                return {
                    'eligible': False,
                    'reason': 'No schedules',
                    'paid_ratio': 0.0,
                    'thresholds': {'paid_ratio': 0.5, 'remaining_principal_ratio': 0.5}
                }

            def is_counted_paid(s):
                ap = getattr(s, 'advance_pay', Decimal('0.00')) or Decimal('0.00')
                covered = bool(getattr(s, 'is_covered_by_advance', False)) or (getattr(s, 'advance_event_id', None) is not None) or (ap > Decimal('0.00'))
                return bool(getattr(s, 'is_paid', False)) or covered

            # Baseline by user's rule: original total vs updated unpaid count after advances/reconstruction
            unpaid = [s for s in schedules if not getattr(s, 'is_paid', False)]
            counted_paid_baseline = max(0, original_total - len(unpaid))

            # Derive next-unpaid schedule values to translate advance amounts into "covered" units
            first_unpaid = unpaid[0] if unpaid else (schedules[-1] if schedules else None)
            principal_pp = (getattr(first_unpaid, 'principal_amount', None) or getattr(first_unpaid, 'original_principal', None) or Decimal('0.00')) if first_unpaid else Decimal('0.00')
            amort_pp = (getattr(first_unpaid, 'payment_amount', None) or (principal_pp + (getattr(first_unpaid, 'interest_portion', None) or Decimal('0.00')))) if first_unpaid else Decimal('0.00')

            # Count schedules already flagged as advance-covered to avoid double-counting
            already_advance_count = sum(1 for s in schedules if (not getattr(s, 'is_paid', False)) and (bool(getattr(s, 'is_covered_by_advance', False)) or (getattr(s, 'advance_event_id', None) is not None)))

            # Pull recent PaymentEvents to capture pure advances not yet mapped to schedules
            try:
                events = list(getattr(obj, 'payment_events', None).all())
            except Exception:
                events = []

            ahead_total = sum([(e.amount_pay_ahead or Decimal('0.00')) for e in events if getattr(e, 'mode', '') in ['pay_ahead', 'hybrid']])
            curtail_total = sum([(e.amount_curtailment or Decimal('0.00')) for e in events if getattr(e, 'mode', '') in ['curtail', 'hybrid']])

            # Translate event amounts into equivalent covered counts (approximate):
            # - Pay-ahead uses full amortization per schedule
            # - Curtailment uses per-payment principal
            counts_from_ahead = int((ahead_total / amort_pp).to_integral_value(rounding=ROUND_FLOOR)) if amort_pp and amort_pp > 0 else 0
            counts_from_curtail = int((curtail_total / principal_pp).to_integral_value(rounding=ROUND_FLOOR)) if principal_pp and principal_pp > 0 else 0

            # Avoid double-counting advance coverage already reflected on schedules
            extra_advance_counts = max(0, (counts_from_ahead + counts_from_curtail) - already_advance_count)

            counted_paid_effective = min(original_total, counted_paid_baseline + max(0, extra_advance_counts))
            paid_ratio = float(counted_paid_effective) / float(original_total) if original_total > 0 else 0.0

            # Remaining principal threshold
            # Denominator: prefer loan_amount, else fallback to sum of original principals
            original_amount = (obj.loan_amount or Decimal('0.00'))
            if original_amount <= 0:
                try:
                    original_amount = sum([(getattr(s, 'original_principal', None) or getattr(s, 'principal_amount', Decimal('0.00')) or Decimal('0.00')) for s in schedules]) or Decimal('0.00')
                except Exception:
                    original_amount = Decimal('0.00')
            base_remaining = (getattr(obj, 'remaining_principal', None) or obj.outstanding_balance or Decimal('0.00'))

            # Approximate additional principal effect from events not yet reflected in remaining principal
            principal_from_ahead = (counts_from_ahead * principal_pp) if principal_pp > 0 else Decimal('0.00')
            principal_from_curtail = curtail_total
            extra_principal_effect = principal_from_ahead + principal_from_curtail
            effective_remaining = base_remaining - extra_principal_effect
            if effective_remaining < Decimal('0.00'):
                effective_remaining = Decimal('0.00')

            rem_ratio = float(effective_remaining / original_amount) if original_amount > 0 else 1.0

            eligible = (paid_ratio >= 0.5) or (rem_ratio <= 0.5)
            return {
                'eligible': bool(eligible and (obj.loan_type != 'Emergency')),
                'paid_ratio': round(paid_ratio, 4),
                'remaining_principal_ratio': round(rem_ratio, 4),
                'counts': {
                    'original_total': original_total,
                    'current_total': current_total,
                    'current_unpaid': len(unpaid),
                    'counted_paid_baseline': counted_paid_baseline,
                    'counted_paid_effective': counted_paid_effective,
                    'extra_advance_counts': max(0, extra_advance_counts)
                },
                'effective_remaining_principal': str(effective_remaining.quantize(Decimal('0.01'))),
                'thresholds': {'paid_ratio': 0.5, 'remaining_principal_ratio': 0.5},
                'notes': 'Emergency loans are not reloanable.' if obj.loan_type == 'Emergency' else None
            }
        except Exception as e:
            return {
                'eligible': False,
                'error': str(e)
            }

    def get_exposure_headroom(self, obj):
        try:
            # Simple headroom estimation: allow up to 2x share capital minus outstanding across all loans on the account
            account = getattr(obj, 'account', None)
            share_cap = Decimal('0.00')
            if account and hasattr(account, 'shareCapital') and account.shareCapital:
                share_cap = Decimal(account.shareCapital)

            # Aggregate outstanding across loans for this account
            loans = obj.__class__.objects.filter(account=account)
            outstanding_sum = sum([(l.outstanding_balance or Decimal('0.00')) for l in loans]) if account else Decimal('0.00')

            exposure_cap = share_cap * Decimal('2.00') if share_cap > 0 else None
            if exposure_cap is None:
                return {
                    'headroom': None,
                    'note': 'No share capital; cannot compute cap.'
                }

            headroom = exposure_cap - Decimal(outstanding_sum)
            return {
                'headroom': str(headroom.quantize(Decimal('0.01'))),
                'cap': str(exposure_cap.quantize(Decimal('0.01'))),
                'outstanding_total': str(Decimal(outstanding_sum).quantize(Decimal('0.01')))
            }
        except Exception as e:
            return {
                'headroom': None,
                'error': str(e)
            }


class PaymentSerializer(serializers.ModelSerializer):
    
        class Meta:
            model = Payment
            fields = '__all__'
            
        def to_representation(self, instance):
            data = super().to_representation(instance)
            data['control_number'] = str(instance.control_number)
            return data
class LedgerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ledger
        fields = '__all__'

class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ['id', 'action_type', 'description', 'user', 'timestamp']

class WithdrawView(APIView):
    def post(self, request, account_number):
        try:
            account = Account.objects.get(account_number=account_number)
            amount = request.data.get('amount')

            if not amount or float(amount) <= 0:
                return Response({'message': 'Invalid amount'}, status=status.HTTP_400_BAD_REQUEST)

            # Use Decimal for monetary operations
            amount_dec = Decimal(str(amount))

            # Delegate to Account.withdraw to ensure ledger entries and validations
            try:
                account.withdraw(amount_dec)
            except ValueError as e:
                return Response({'message': str(e)}, status=status.HTTP_400_BAD_REQUEST)

            # If account reached zero balance, ensure status is updated by business rules
            if account.shareCapital <= Decimal('0.00'):
                account.status = 'inactive'
                account.save(update_fields=['status'])

            return Response(AccountSerializer(account).data, status=status.HTTP_200_OK)
        except Account.DoesNotExist:
            return Response({'message': 'Account not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UpdateStatusView(APIView):
    def patch(self, request, account_number):
        try:
            account = Account.objects.get(account_number=account_number)
            status_update = request.data.get('status')

            if status_update not in ['Active', 'Inactive']:
                return Response({'message': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

            account.status = status_update
            account.save()

            return Response(AccountSerializer(account).data, status=status.HTTP_200_OK)
        except Account.DoesNotExist:
            return Response({'message': 'Account not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        fields = ['id', 'action_type', 'description', 'user', 'timestamp']
        
class PaymentHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentHistory
        fields = '__all__'
        
# chicha
class YearlyFinancialSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = YearlyFinancialSummary
        fields = '__all__'
# recently lang
class PenaltyCollectionSerializer(serializers.ModelSerializer):
    account_holder = serializers.SerializerMethodField()
    schedule_due_date = serializers.DateField(source='payment_schedule.due_date', read_only=True)
    
    class Meta:
        model = PenaltyCollection
        fields = [
            'id',
            'payment_schedule',
            'amount',
            'collection_date',
            'collection_method',
            'collected_from_account',
            'account_holder',
            'schedule_due_date',
            'notes'
        ]
    
    def get_account_holder(self, obj):
        try:
            account = Account.objects.get(account_number=obj.collected_from_account)
            member = account.account_holder
            return f"{member.first_name} {member.middle_name or ''} {member.last_name}".strip()
        except:
            return "Unknown"