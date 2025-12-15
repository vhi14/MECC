from rest_framework import generics, status, viewsets, filters
from rest_framework.pagination import PageNumberPagination
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from rest_framework.response import Response
from decimal import Decimal
from django.contrib.auth import authenticate
import jwt
from django.http import JsonResponse 
import uuid
from django.db.models import Sum, Min, F, OuterRef, Subquery, Count
from rest_framework.decorators import api_view
from django.utils  import timezone
from rest_framework.exceptions import ValidationError
from django.db import transaction
from .models import Member, Account, Loan, PaymentSchedule, Payment, Ledger, YearlyFinancialSummary, PaymentEvent
from .serializers import (
    MemberSerializer, AccountSerializer, LoanSerializer, LoanListSerializer, UpdatePasswordSerializer,
    PaymentScheduleSerializer, PaymentSerializer,LedgerSerializer, MemberTokenSerializer,RegisterMemberSerializer,PaymentHistorySerializer,YearlyFinancialSummarySerializer, PaymentEventSerializer
)
from .models import ORNumberTracker
from .models import LoanYearlyRecalculation

from django.db import connection
from uuid import UUID
from rest_framework.decorators import api_view, permission_classes
from django_filters.rest_framework import DjangoFilterBackend
import django_filters
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from django.contrib.auth.hashers import make_password
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.models import User
from .serializers import UserSerializer
from rest_framework import serializers
from rest_framework.views import APIView
from .models import SystemSettings
from .serializers import SystemSettingsSerializer
from rest_framework.authentication import TokenAuthentication
import logging
from django.http import JsonResponse

logger = logging.getLogger(__name__)

# Pagination for list views
class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

def health(request):
    return JsonResponse({"status": "ok"})
def settle_loan_if_zero(loan):
    """Settle loan if remaining_principal is zero; mark all unpaid schedules paid."""
    from decimal import Decimal
    try:
        rp = Decimal(loan.remaining_principal or 0).quantize(Decimal('0.01'))
    except Exception:
        rp = Decimal('0.00')
    if rp <= Decimal('0.00'):
        if loan.status != 'Settled':
            loan.remaining_principal = Decimal('0.00')
            loan.status = 'Settled'
            loan.archived = True
            loan.save(update_fields=['remaining_principal','status','archived'])
            from .models import PaymentSchedule
            today = timezone.now().date()
            for s in PaymentSchedule.objects.filter(loan=loan, is_paid=False):
                s.is_paid = True
                if not s.date_paid:
                    s.date_paid = today
                s.under_pay = Decimal('0.00')
                s.save(update_fields=['is_paid','date_paid','under_pay'])
        return True
    return False
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Archive
from .serializers import ArchiveSerializer
from .models import AuditLog  
from .serializers import AuditLogSerializer
from django.views import View
from .models import Account, ArchivedAccount
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.http import urlsafe_base64_decode
from django.core.exceptions import ValidationError
from django.contrib.auth.password_validation import validate_password
import json
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.core.mail import send_mail
from django.contrib.auth import get_user_model
from django.utils.timezone import now
from django.db.models import Q
from .models import Archive
from .models import Archive, Member, Account, Loan, PaymentSchedule, Payment, Ledger
import math
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
import json
from .models import ArchivedPayment 




from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate


class UnifiedLoginView(TokenObtainPairView):
    """
    One login endpoint for both admin and member users
    """
    def post(self, request, *args, **kwargs):
        username = request.data.get("username")
        password = request.data.get("password")

        if not username or not password:
            return Response({"detail": "Username and password are required"}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(username=username, password=password)

        if user is None:
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        # Generate tokens
        refresh = RefreshToken.for_user(user)

        # Default response
        response_data = {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
        }

        # Determine role
        if user.is_staff or user.is_superuser:
            response_data["role"] = "admin"
        elif hasattr(user, "member_profile"):
            member_profile = user.member_profile
            account_number = getattr(member_profile.accountN, "account_number", None)
            if account_number:
                response_data["account_number"] = account_number
            response_data["role"] = "member"
        else:
            response_data["role"] = "unknown"

        return Response(response_data, status=status.HTTP_200_OK)





class ArchiveViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    permission_classes = [AllowAny]
    serializer_class = ArchiveSerializer

    def get_queryset(self):
        # Filter the queryset based on the type of archive (users or loans)
        archive_type = self.request.query_params.get('archive_type', None)
        if archive_type:
            return Archive.objects.filter(archive_type=archive_type)
        return Archive.objects.all()

class SystemSettingsView(APIView):
    def get(self, request):
        settings = SystemSettings.get_settings()
        serializer = SystemSettingsSerializer(settings)
        return Response(serializer.data, status=200)

    def put(self, request):
        settings = SystemSettings.get_settings()
        serializer = SystemSettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=200)
        return Response(serializer.errors, status=400)

    def post(self, request):
        serializer = SystemSettingsSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)
    
# class UpdateMemberViews(generics.UpdateAPIView):
#     serializer_class = UpdatePasswordSerializer
#     # permission_classes = [IsAuthenticated]

#     def put(self, request, *args, **kwargs):
#         serializer = self.get_serializer(data=request.data)
#         serializer.is_valid(raise_exception=True)
#         print("account account_number:: ",request.data.get("account_number"))
#         account_number = serializer.validated_data['account_number']
#         email = serializer.validated_data['email']

#         username = serializer.validated_data['username']
#         new_password = serializer.validated_data['new_password']

#         try:
#             # account = Account.objects.get(account_number=account_number)
#             user = User.objects.get(email=email)
#             user.set_password(new_password)
#             user.username = username
#             user.save()

#             return Response({"message": "Password updated successfully."}, status=status.HTTP_200_OK)

#         except Account.DoesNotExist:
#             return Response({"error": "Invalid account number."}, status=status.HTTP_400_BAD_REQUEST)

#         except AttributeError:
#             return Response({"error": "User account not linked properly."}, status=status.HTTP_400_BAD_REQUEST)
        
class UpdateMemberViews(generics.UpdateAPIView):
    serializer_class = UpdatePasswordSerializer

    def put(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        account_number = serializer.validated_data['account_number']
        email = serializer.validated_data['email']
        username = serializer.validated_data['username']
        new_password = serializer.validated_data.get('new_password', '')  # ✅ GET with default

        try:
            user = User.objects.get(email=email)
            
            # ✅ ONLY UPDATE PASSWORD IF PROVIDED AND NOT EMPTY
            if new_password and new_password.strip():
                user.set_password(new_password)
            
            # ✅ ALWAYS UPDATE USERNAME
            user.username = username
            user.save()

            return Response(
                {"message": "Profile updated successfully."}, 
                status=status.HTTP_200_OK
            )

        except User.DoesNotExist:
            return Response(
                {"error": "User not found."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
class RegisterMemberView(generics.CreateAPIView):
    serializer_class = RegisterMemberSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        account_number = serializer.validated_data['account_number']
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']

        try:
            account = Account.objects.get(account_number=account_number)
            member = account.account_holder

            if member.email != email:
                return Response({"error": "Email does not match records."}, status=status.HTTP_400_BAD_REQUEST)

            # ✅ Keep proper name format
            full_name = f"{member.first_name} {member.middle_name} {member.last_name}".strip()

            if User.objects.filter(username=full_name).exists():
                return Response({"error": "This member is already registered."}, status=status.HTTP_400_BAD_REQUEST)

            user = User.objects.create_user(username=full_name, email=email, password=password)
            member.user = user
            member.save()

            return Response({
                "id": user.id,
                "username": user.username,  # e.g. "Juan P Cruz"
                "email": user.email,
                "account_number": account_number
            }, status=status.HTTP_201_CREATED)

        except Account.DoesNotExist:
            return Response({"error": "Invalid account number."}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def member_login(request):
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response({'detail': 'Username and password are required'}, status=status.HTTP_400_BAD_REQUEST)

    member_user = authenticate(username=username, password=password)
    if member_user is not None and hasattr(member_user, 'member_profile'):
        from rest_framework_simplejwt.tokens import RefreshToken
        tokens = RefreshToken.for_user(member_user)

        member_profile = member_user.member_profile
        account_number = getattr(member_profile.accountN, 'account_number', None)

        if not account_number:
            return Response({'detail': 'Account information is missing or invalid'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'access': str(tokens.access_token),
            'refresh': str(tokens),
            'account_number': account_number,
            'user_id': member_user.id,
            'email': member_user.email,
            'username': member_user.username,  # e.g. "Juan P Cruz"
        }, status=status.HTTP_200_OK)
    else:
        return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)










User = get_user_model()

def forgot_password(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            email = data.get("email", "").strip().lower()

            if not email:
                return JsonResponse({"error": "Email is required"}, status=400)

           
            archived_emails = Archive.objects.filter(
                archive_type='Member'
            ).values_list('archived_data__email', flat=True)

            
            member = Member.objects.filter(email__iexact=email).exclude(email__in=archived_emails).first()

            if member and member.user:
                user = member.user  
                token_generator = PasswordResetTokenGenerator()
                token = token_generator.make_token(user)
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                reset_link = f"http://localhost:3000/reset-password/{uid}/{token}"

                send_mail(
                    "Password Reset Request",
                    f"Hi {member.first_name} {member.middle_name} {member.last_name}\nHave you Requested resetting your Password?\nIf so, Kindly Reset your password here:\n{reset_link}",
                    "MPSPC EMPLOYEES CREDIT COOP",
                    [email],
                    fail_silently=False,
                )

                return JsonResponse({
                    "message": "Password reset email sent.",
                    "uid": uid,
                    "token": token
                })
            else:
                return JsonResponse({"error": "No active user with this email exists"}, status=404)

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON format"}, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)


def reset_password(request, uidb64, token):
    if request.method == "POST":
        try:
            uid = urlsafe_base64_decode(uidb64).decode()
            user = User.objects.get(pk=uid)
        except (User.DoesNotExist, ValueError, TypeError):
            return JsonResponse({"error": "Invalid user"}, status=400)

        token_generator = PasswordResetTokenGenerator()
        if not token_generator.check_token(user, token):
            return JsonResponse({"error": "Invalid or expired token"}, status=400)

        
        data = json.loads(request.body)
        new_password = data.get("password")

        if not new_password:
            return JsonResponse({"error": "Password cannot be empty"}, status=400)

        try:
            validate_password(new_password, user)  
        except ValidationError as e:
            return JsonResponse({"error": e.messages}, status=400)

        user.set_password(new_password)
        user.save()
        return JsonResponse({"message": "Password reset successful"})

    return JsonResponse({"error": "Invalid request method"}, status=405)

    
class MemberLoginView(TokenObtainPairView):
    serializer_class = MemberTokenSerializer
class AdminLoginView(TokenObtainPairView):
    pass  


class LogoutView(APIView):
    def post(self, request):
        try:
            token = request.data.get("refresh")
            token_obj = RefreshToken(token)
            token_obj.blacklist()
            return Response({"message": "Logged out successfully."}, status=status.HTTP_205_RESET_CONTENT)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class MemberProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            member = Member.objects.get(user=request.user)
            serializer = MemberSerializer(member)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Member.DoesNotExist:
            return Response({"error": "Member not found"}, status=status.HTTP_404_NOT_FOUND)
    def put(self, request):
        try:
            member = Member.objects.get(user=request.user)
            # Pass partial=True to allow only modified fields to be updated
            serializer = MemberSerializer(member, data=request.data, partial=True)
            if serializer.is_valid():
                # Ensure unique validation only for the email field
                if 'email' in request.data:
                    email = request.data.get('email')
                    if email and Member.objects.filter(email=email).exclude(memId=member.memId).exists():
                        return Response({"error": "This email is already in use by another member."}, status=status.HTTP_400_BAD_REQUEST)
                
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Member.DoesNotExist:
            return Response({"error": "Member not found"}, status=status.HTTP_404_NOT_FOUND)
        
class MemberFilter(django_filters.FilterSet):
    account_number = django_filters.CharFilter(field_name='accountN__account_number', lookup_expr='exact')

    class Meta:
        model = Member
        fields = ['account_number']  

class MemberViewSet(viewsets.ModelViewSet):
    serializer_class = MemberSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = MemberFilter  
    search_fields = ['accountN__account_number', 'first_name', 'last_name']
    
    def get_queryset(self):
        """Optimize with select_related for account."""
        queryset = Member.objects.select_related('accountN', 'user').all()
        
        # Add filter for registered users only
        registered_only = self.request.query_params.get('registered_only', None)
        if registered_only == 'true':
            queryset = queryset.exclude(user__isnull=True)
        
        return queryset
class UserDeleteView(APIView):
    permission_classes = [IsAuthenticated]  
    
    def delete(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            user.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)  
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

class MemberListCreateView(generics.ListCreateAPIView):
    queryset = Member.objects.all()
    serializer_class = MemberSerializer

class MemberDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Member.objects.all()
    serializer_class = MemberSerializer

class AccountViewSet(viewsets.ModelViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer
    permission_classes = [AllowAny]

    def _handle_transaction(self, account, amount, transaction_type):
        try:
            amount = Decimal(amount)
            if amount <= 0:
                return Response({"error": "Amount must be a positive value."}, status=status.HTTP_400_BAD_REQUEST)
        except (TypeError, ValueError):
            return Response({"error": "Invalid amount format."}, status=status.HTTP_400_BAD_REQUEST)

        max_deposit_limit = Decimal('1000000.00')  # Maximum allowed balance
        print(f"Account current balance: {account.shareCapital}, Deposit amount: {amount}")

        try:
            if transaction_type == 'deposit':
                if account.shareCapital + amount > max_deposit_limit:
                    return Response({
                        "error": f"Deposit failed: Total balance cannot exceed {max_deposit_limit:.2f}. Current balance is {account.shareCapital:.2f}."
                    }, status=status.HTTP_400_BAD_REQUEST)

                account.deposit(amount)
                message = "Deposit successful!"

            elif transaction_type == 'withdraw':
                account.withdraw(amount)
                message = "Withdrawal successful!"

            else:
                return Response({"error": "Invalid transaction type."}, status=status.HTTP_400_BAD_REQUEST)

            return Response({"message": message, "new_balance": account.shareCapital}, status=status.HTTP_200_OK)

        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)




    @action(detail=True, methods=['post'], url_path='deposit')
    def deposit(self, request, pk=None):
        account = self.get_object()
        amount = request.data.get('amount')
        return self._handle_transaction(account, amount, 'deposit')

    @action(detail=True, methods=['post'], url_path='withdraw')
    def withdraw(self, request, pk=None):
        account = self.get_object()
        try:
          amount = Decimal(str(request.data.get('amount', '0')))
        except Exception:
          return Response({'error': 'Invalid amount'}, status=status.HTTP_400_BAD_REQUEST)

        or_number = request.data.get('or_number')
        board_resolution = request.data.get('board_resolution')
        # Server-side OR reuse validation (enforce same rules as check_or_number)
        try:
            member = account.account_holder
            today = timezone.now().date()

            if or_number:
                # Basic OR format check
                if len(str(or_number).strip()) != 4:
                    return Response({'error': 'Valid 4-digit OR number is required'}, status=status.HTTP_400_BAD_REQUEST)

                # Block if used by other members anywhere
                used_by_other_schedule = PaymentSchedule.objects.filter(or_number=or_number, is_paid=True).exclude(loan__account=account).exists()
                used_in_tracker_by_other = ORNumberTracker.objects.filter(or_number=or_number).exclude(member=member).exists()
                used_in_fees_any = LoanYearlyRecalculation.objects.filter(fees_or_number=or_number, fees_paid=True).exclude(loan__account=account).exists()
                if used_by_other_schedule or used_in_tracker_by_other or used_in_fees_any:
                    return Response({'error': f'OR {or_number} is already used by another member and cannot be reused'}, status=status.HTTP_400_BAD_REQUEST)

                # Block if same member used this OR previously on a different day
                tracker = ORNumberTracker.objects.filter(member=member, or_number=or_number).first()
                if tracker and tracker.first_used_date.date() != today:
                    return Response({'error': f'OR {or_number} was previously used on a different day and cannot be reused'}, status=status.HTTP_400_BAD_REQUEST)

                # Block if same member used this OR on a previous day in payment schedules
                same_member_prev_day_schedule = PaymentSchedule.objects.filter(
                    or_number=or_number,
                    is_paid=True,
                    loan__account=account
                ).exclude(date_paid=today).exists()
                if same_member_prev_day_schedule:
                    return Response({'error': f'OR {or_number} was used on a different day and cannot be reused'}, status=status.HTTP_400_BAD_REQUEST)

            # If validation passed, proceed with withdrawal
            account.withdraw(amount, or_number=or_number, board_resolution=board_resolution)
            serializer = self.get_serializer(account)
            return Response(serializer.data, status=status.HTTP_200_OK)

        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Withdraw failed: {e}'}, status=status.HTTP_400_BAD_REQUEST)

def get_account_sharecapital(request, account_number):
    try:
        # Fetch the account using the account_number
        account = Account.objects.get(account_number=account_number)
        
        # Return the share capital of the account
        return JsonResponse({'shareCapital': account.shareCapital})  # Adjust field name as needed
    except Account.DoesNotExist:
        return JsonResponse({'error': 'Account not found'}, status=404)


@api_view(['GET'])
def detailed_loan_info_view(request, control_number):
    """Get loan with fresh yearly recalculation data by control_number"""
    try:
        from django.db import connection
        
        # Force any pending database transactions to complete
        connection.cursor().execute('SELECT 1')
        
        # Get the loan by control_number (not primary key)
        loan = Loan.objects.select_related('account', 'account__account_holder').prefetch_related('paymentschedule_set', 'loanannualrecalculation_set').get(control_number=control_number)
        loan.refresh_from_db()
        
        # Serialize with related data
        serializer = LoanSerializer(loan)
        data = serializer.data
        
        # Explicitly add fresh yearly recalculations
        recalculations = LoanYearlyRecalculation.objects.filter(loan=loan).order_by('year')
        print(f"   Found {recalculations.count()} recalculations for this loan")
    
        # Log each recalculation to verify uniqueness
        for recalc in recalculations:
            print(f"     - Year {recalc.year}: prev_bal={recalc.previous_balance}, outstanding={recalc.total_fees_due}")
            
        data['yearly_recalculations'] = [
            {
                'year': r.year,
                'service_fee': str(r.service_fee),
                'previous_balance': str(r.previous_balance),
                'interest_amount': str(r.interest_amount),
                'admincost': str(r.admincost),
                'cisp': str(r.cisp),
                'notarial': str(r.notarial),
                'total_fees_due': str(r.total_fees_due),
                'new_bimonthly_amortization': str(r.new_bimonthly_amortization),
                'fees_paid': r.fees_paid,
                'fees_paid_date': r.fees_paid_date.isoformat() if r.fees_paid_date else None,
                'fees_or_number': r.fees_or_number,
                'recalculated_at': r.recalculated_at.isoformat(),
                'loan_control_number': str(loan.control_number)
            }
            for r in recalculations
        ]
        print(f"🔍 Loan {loan.control_number} has {len(data['yearly_recalculations'])} recalculations")
        return Response(data)
    except Loan.DoesNotExist:
        return Response({'error': f'Loan {control_number} not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        print(f"❌ Error in detailed_loan_info_view: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LoanViewSet(viewsets.ModelViewSet):
    serializer_class = LoanSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['loan_type', 'status']
    search_fields = ['control_number', 'account__account_number']
    
    def get_queryset(self):
        """Optimize queries with select_related and prefetch_related, handle control_number filtering."""
        queryset = Loan.objects.select_related('account', 'account__account_holder').prefetch_related('paymentschedule_set', 'yearly_recalculations').all()
        
        # Filter by control_number if provided
        control_number = self.request.query_params.get('control_number', None)
        if control_number:
            try:
                uuid.UUID(control_number)
                queryset = queryset.filter(control_number=control_number)
            except ValueError:
                return Loan.objects.none()
        
        return queryset
    
    def get_serializer_class(self):
        """Use lightweight serializer for list views, full serializer for detail."""
        if self.action == 'list':
            return LoanListSerializer
        return LoanSerializer
    
    def create(self, request, *args, **kwargs):
        """
        Create a loan. Co-maker rules:
        - Emergency loans: require at least 1 co-maker.
        - Other loan types: no minimum co-makers.
        """
        try:
            data = request.data.copy()
            loan_type = data.get('loan_type')

            # Collect co-maker names and count only non-empty ones
            comaker_names = [
                (data.get('co_maker') or '').strip(),
                (data.get('co_maker_2') or '').strip(),
                (data.get('co_maker_3') or '').strip(),
                (data.get('co_maker_4') or '').strip(),
                (data.get('co_maker_5') or '').strip(),
            ]
            selected_count = len([n for n in comaker_names if n])

            # Enforce only for Emergency
            if str(loan_type).lower() == 'emergency' and selected_count < 1:
                return Response({
                    'error': 'Emergency loan requires at least 1 co-maker. Currently selected: 0'
                }, status=status.HTTP_400_BAD_REQUEST)

            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except serializers.ValidationError as e:
            return Response({'error': e.detail}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    # @action(detail=True, methods=['post'])
    # def mark_as_paid(self, request, pk=None):
    #     loan = self.get_object()
    #     loan.mark_as_paid()
    #     return Response({'status': 'loan marked as paid'})
    
    # Align route with frontend: /payment-schedules/{id}/mark-paid/
    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_as_paid(self, request, pk=None):
        loan = self.get_object()
        loan.update_status_based_on_schedules()
        return Response({'status': loan.status})

#2dago
    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        loan = self.get_object()
        loan.archive()
        return Response({'status': 'loan archived'})

    @action(detail=False, methods=['post']) 
    def create_loan(self, request):
        #Thursday whole
            account_number = request.data.get('account_number')
            new_loan_type = request.data.get('loan_type', 'Regular')
            
            try:
                account = Account.objects.get(account_number=account_number)
            except Account.DoesNotExist:
                return Response({"error": "Account not found."}, status=status.HTTP_404_NOT_FOUND)

            # Check for existing active loans
            active_loans = Loan.objects.filter(
                account=account, 
                status='Ongoing'
            ).order_by('-loan_date')

            # 🚫 Business rule: Only one Emergency loan at a time (no duplicate Emergency new loans)
            if str(new_loan_type).strip() == 'Emergency' and active_loans.filter(loan_type='Emergency').exists():
                return Response({
                    "error": "You still have an ongoing Emergency loan. Please settle them first.",
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if active_loans.exists():
                most_recent_loan = active_loans.first()

                # ✅ Use serializer-based eligibility that counts advances and reconstruction
                try:
                    ser = self.get_serializer(most_recent_loan)
                    rel = ser.data.get('reloan_eligibility', {}) or {}
                    paid_ratio = float(rel.get('paid_ratio') or 0.0)  # 0..1
                    rem_ratio = float(rel.get('remaining_principal_ratio') or 1.0)
                except Exception:
                    rel = {}
                    paid_ratio = 0.0
                    rem_ratio = 1.0

                can_apply = True
                reason = 'Eligible'

                if str(new_loan_type).strip() == 'Regular':
                    # If existing is Regular, require reloan eligibility (≥50% paid by counts incl. advances OR remaining ≤50%)
                    if str(most_recent_loan.loan_type).strip() == 'Regular':
                        can_apply = bool(rel.get('eligible'))
                        if not can_apply:
                            pct = f"{(paid_ratio*100):.1f}%"
                            need = f"{max(0.0, 50.0 - (paid_ratio*100)):.1f}%"
                            reason = rel.get('reason') or (
                                f"Regular reloan requires ≥50% progress. Current: {pct}. Need {need} more."
                            )
                    else:
                        # Existing Emergency → applying Regular: require ≥50% paid by principal
                        can_apply = paid_ratio >= 0.5
                        if not can_apply:
                            pct = f"{(paid_ratio*100):.1f}%"
                            need = f"{max(0.0, 50.0 - (paid_ratio*100)):.1f}%"
                            reason = f"Must pay {need} more of current loan (50% required for Regular loan). Current: {pct}."
                elif str(new_loan_type).strip() == 'Emergency':
                    # Any existing loan: require ≥50% paid by principal to take a new Emergency
                    can_apply = paid_ratio >= 0.5
                    if not can_apply:
                        pct = f"{(paid_ratio*100):.1f}%"
                        need = f"{max(0.0, 50.0 - (paid_ratio*100)):.1f}%"
                        reason = f"Cannot apply for Emergency loan yet. Existing loan only {pct} paid. Need {need} more to reach 50%."
                else:
                    can_apply = False
                    reason = 'Invalid loan type specified.'

                if not can_apply:
                    return Response({
                        "error": f"Cannot apply for {new_loan_type} loan.",
                        "reason": reason,
                        "existing_loan": {
                            "control_number": most_recent_loan.control_number,
                            "loan_type": most_recent_loan.loan_type,
                            "loan_date": str(most_recent_loan.loan_date),
                            "outstanding_balance": str(most_recent_loan.outstanding_balance)
                        }
                    }, status=status.HTTP_400_BAD_REQUEST)

                # Log successful eligibility check
                print(f"✅ Loan application approved: {reason}")
            # recently lang just add this
            # ✅ First, get the loan amount to determine if comakers are even required
            loan_amount = Decimal(str(request.data.get('loan_amount', 0)))
            
            # Determine minimum comakers required based on loan amount
            min_comakers_required = 0
            if loan_amount < 500000:
                min_comakers_required = 0
            elif loan_amount < 1000000:
                min_comakers_required = 1
            elif loan_amount < 1250000:
                min_comakers_required = 2
            elif loan_amount < 1500000:
                min_comakers_required = 3
            else:
                min_comakers_required = 5
            
            # ✅ Only validate comakers if they are required for this loan amount
            if min_comakers_required > 0:
                # ✅ Validate comakers: require that any provided co_maker names map to a Member who is currently Employed
                comaker_fields = ['co_maker','co_maker_2','co_maker_3','co_maker_4','co_maker_5']
                invalid_comakers = []
                matched_comakers = {}
                provided_comaker_count = 0
                
                for field in comaker_fields:
                    name = (request.data.get(field) or "").strip()
                    if not name:
                        continue
                    
                    provided_comaker_count += 1
                    
                    # best-effort: try to match by exact "first middle last" friendly lookup
                    # First try exact (case-insensitive) full-name match on first+last
                    parts = name.split()
                    q = Q()
                    if len(parts) >= 2:
                        first = parts[0]
                        last = parts[-1]
                        q = Q(first_name__iexact=first, last_name__iexact=last)
                    else:
                        # fallback search by partial name
                        q = Q(first_name__icontains=name) | Q(last_name__icontains=name)

                    candidate = Member.objects.filter(q, employment_status='Employed').first()
                    if not candidate:
                        invalid_comakers.append({'field': field, 'value': name})
                    else:
                        matched_comakers[field] = candidate

                if invalid_comakers:
                    return Response({
                        "error": "Invalid comaker(s). All comakers must be current company employees.",
                        "invalid_comakers": invalid_comakers
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Check minimum comakers requirement
                if provided_comaker_count < min_comakers_required:
                    return Response({
                        "error": f"Loan amount ₱{loan_amount:,.2f} requires at least {min_comakers_required} co-maker(s). Provided: {provided_comaker_count}",
                        "loan_amount": str(loan_amount),
                        "comakers_required": min_comakers_required,
                        "comakers_provided": provided_comaker_count
                    }, status=status.HTTP_400_BAD_REQUEST)

            # recently lang just add this end

            try:
                with transaction.atomic():
                    # ✅ Get the account instance
                    account_number = request.data.get('account_number')
                    if not account_number:
                        return Response({
                            "error": "Account number is required"
                        }, status=status.HTTP_400_BAD_REQUEST)
                    
                    try:
                        account = Account.objects.get(account_number=account_number)
                    except Account.DoesNotExist:
                        return Response({
                            "error": f"Account {account_number} not found"
                        }, status=status.HTTP_400_BAD_REQUEST)
                    
                    # Create loan with account instance and all provided fields
                    # ✅ Get system settings for default fees if not provided
                    settings = SystemSettings.get_settings()
                    
                    new_loan = Loan.objects.create(
                        account=account,
                        loan_amount=Decimal(str(request.data.get('loan_amount', 0))),
                        loan_type=request.data.get('loan_type', 'Regular'),
                        loan_period=int(request.data.get('loan_period', 6)),
                        loan_period_unit=request.data.get('loan_period_unit', 'months'),
                        purpose=request.data.get('purpose', 'Education'),
                        co_maker=request.data.get('co_maker', ''),
                        co_maker_2=request.data.get('co_maker_2', ''),
                        co_maker_3=request.data.get('co_maker_3', ''),
                        co_maker_4=request.data.get('co_maker_4', ''),
                        co_maker_5=request.data.get('co_maker_5', ''),
                        status=request.data.get('status', 'Ongoing'),
                        service_fee=Decimal(str(request.data.get('service_fee', 0))),
                        admincost=Decimal(str(request.data.get('admincost', settings.admin_cost))),
                        notarial=Decimal(str(request.data.get('notarial', settings.notarial_fee))),
                        cisp=Decimal(str(request.data.get('cisp', 0))),
                        interest_amount=Decimal(str(request.data.get('interest_amount', 0))),
                        annual_interest=Decimal(str(request.data.get('annual_interest', settings.interest_rate)))
                    )
                    
                    new_loan.net_proceeds = (
                        new_loan.loan_amount - 
                        (new_loan.service_fee  + 
                        new_loan.admincost + new_loan.notarial + new_loan.interest_amount+ new_loan.cisp )
                    )
                    new_loan.save()

                    # Schedules are generated by Loan.save()/signals (bi-monthly 15-day cadence, 96 for 4 years).
                    # Avoid calling the legacy view-level generator to prevent duplicate/incorrect schedules.
                    # self.create_payment_schedule(new_loan)

                    return Response({
                        "status": "Loan created successfully",
                        "control_number": new_loan.control_number,
                        "loan_data": {
                            "control_number": new_loan.control_number,
                            "account": str(new_loan.account),
                            "loan_amount": str(new_loan.loan_amount),
                            "loan_type": new_loan.loan_type,
                            "net_proceeds": str(new_loan.net_proceeds),
                            "service_fee": str(new_loan.service_fee),
                            "interest_amount": str(new_loan.interest_amount),
                            "admincost": str(new_loan.admincost),
                            "notarial": str(new_loan.notarial),
                            "cisp": str(new_loan.cisp),
                            "loan_date": str(new_loan.loan_date),
                            "due_date": str(new_loan.due_date),
                            "purpose": new_loan.purpose,
                            "status": new_loan.status,
                        }
                    }, status=status.HTTP_201_CREATED)
            except ValidationError as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                return Response(
                    {"error": f"Error creating loan: {str(e)}"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        # account_number = request.data.get('account_number')
        # try:
        #     account = Account.objects.get(account_number=account_number)
        # except Account.DoesNotExist:
        #     return Response({"error": "Account not found."}, status=status.HTTP_404_NOT_FOUND)

        # active_loan = Loan.objects.filter(account=account).first()
        # if active_loan and not active_loan.check_loan_eligibility_for_reloan():
        #     return Response({
        #         "error": "50% of the existing loan must be paid off before applying for a new loan."
        #     }, status=status.HTTP_400_BAD_REQUEST)

        # loan_data = request.data.copy()
        
        # # Remove control_number from loan_data if it exists (let the model handle it)
        # loan_data.pop('control_number', None)

        # try:
        #     with transaction.atomic():
        #         # The model's save() method will automatically generate a unique control_number
        #         new_loan = Loan.objects.create(**loan_data)
        #         new_loan.net_proceeds = (new_loan.loan_amount - (new_loan.service_fee + new_loan.interest_amount + new_loan.admincost + new_loan.notarial + new_loan.cisp))
        #         new_loan.save()

        #         self.create_payment_schedule(new_loan)

        #         return Response({
        #             "status": "Loan created successfully",
        #             "control_number": new_loan.control_number,
        #             "loan_data": {
        #                 "control_number": new_loan.control_number,
        #                 "account": str(new_loan.account),  # Convert to string if needed
        #                 "loan_amount": str(new_loan.loan_amount),
        #                 "loan_type": new_loan.loan_type,
        #                 "net_proceeds": str(new_loan.net_proceeds),
        #                 "service_fee": str(new_loan.service_fee),
        #                 "interest_amount": str(new_loan.interest_amount),
        #                 "admincost": str(new_loan.admincost),
        #                 "notarial": str(new_loan.notarial),
        #                 "cisp": str(new_loan.cisp),
        #                 "loan_date": str(new_loan.loan_date),
        #                 "due_date": str(new_loan.due_date),
        #                 "purpose": new_loan.purpose,
        #                 "status": new_loan.status,
        #             }
        #         }, status=status.HTTP_201_CREATED)
        # except ValidationError as e:
        #     return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        # except Exception as e:
        #     return Response({"error": f"Error creating loan: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

    def create_payment_schedule(self, loan):
        loan_amount = loan.loan_amount
        loan_period = loan.loan_period

        installment_amount = loan_amount / loan_period

        for month in range(loan_period):
            PaymentSchedule.objects.create(
                loan=loan,
                due_date=timezone.now() + timezone.timedelta(days=(month * 30)),
                balance=installment_amount,
                principal_amount=installment_amount,
                payment_amount=installment_amount,
                original_principal=installment_amount,
                loan_type=loan.loan_type
            )

    @action(detail=True, methods=['get'])
    def payment_schedule(self, request, pk=None):
        loan = self.get_object()
        payment_schedule = PaymentSchedule.objects.filter(loan=loan)
        return Response(PaymentScheduleSerializer(payment_schedule, many=True).data)

    @action(detail=True, methods=['get'])
    def detailed_loan_info(self, request, pk=None):
        """Get loan with fresh yearly recalculation data"""
        #atf
        from django.db import connection
        from .models import LoanYearlyRecalculation
    #atf end
        
        # Force any pending database transactions to complete
        connection.cursor().execute('SELECT 1')
        
        # Get the loan with fresh data
        loan = self.get_object()
        loan.refresh_from_db()
        
        # Serialize with related data
        serializer = self.get_serializer(loan)
        data = serializer.data
        
        # Explicitly add fresh yearly recalculations
        #2day recalculations
        recalculations = LoanYearlyRecalculation.objects.filter(loan=loan).order_by('year')
        print(f"   Found {recalculations.count()} recalculations for this loan")
    
        # Log each recalculation to verify uniqueness
        for recalc in recalculations:
            print(f"     - Year {recalc.year}: prev_bal={recalc.previous_balance}, outstanding={recalc.total_fees_due}")
            #2dago end
        data['yearly_recalculations'] = [
            {
                'year': r.year,
                'service_fee': str(r.service_fee),
                'previous_balance': str(r.previous_balance),#Thursday
                'interest_amount': str(r.interest_amount),
                'admincost': str(r.admincost),
                'cisp': str(r.cisp),
                'notarial': str(r.notarial),
                'total_fees_due': str(r.total_fees_due),
                'new_bimonthly_amortization': str(r.new_bimonthly_amortization),
                'fees_paid': r.fees_paid,
                'fees_paid_date': r.fees_paid_date.isoformat() if r.fees_paid_date else None,
                'fees_or_number': r.fees_or_number,
                'recalculated_at': r.recalculated_at.isoformat(),
                'loan_control_number': str(loan.control_number) #Wednesday
            }
            for r in recalculations
        ]
        print(f"🔍 Loan {loan.control_number} has {len(data['yearly_recalculations'])} recalculations")#Wednesday
        return Response(data)
    @action(detail=False, methods=['get'])
    def by_account(self, request):
        account_number = request.query_params.get('account_number', None)
        
        if not account_number:
            return Response({"detail": "Account number not provided."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            loans = Loan.objects.filter(account__account_number=account_number)
            serializer = LoanSerializer(loans, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {"detail": "An error occurred while fetching loans."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
#Thursday new
@api_view(['GET'])
def check_loan_eligibility(request, account_number):
    """
    Check if an account holder can apply for a new loan.
    
    Query params:
        - loan_type: 'Regular' or 'Emergency' (optional, checks both if not provided)
    """
    try:
        account = Account.objects.get(account_number=account_number)
    except Account.DoesNotExist:
        return Response({"error": "Account not found."}, status=404)
    
    # Get active loans
    active_loans = Loan.objects.filter(account=account, status='Ongoing')
    
    if not active_loans.exists():
        return Response({
            "can_apply": True,
            "reason": "No active loans. You can apply for any loan type.",
            "eligible_for_regular": True,
            "eligible_for_emergency": True
        })
    
    most_recent_loan = active_loans.order_by('-loan_date').first()
    requested_type = request.query_params.get('loan_type')
    
    # ✅ Use serializer-based eligibility that counts advances
    from .serializers import LoanSerializer
    ser = LoanSerializer(most_recent_loan)
    rel = ser.data.get('reloan_eligibility', {}) or {}
    paid_ratio = float(rel.get('paid_ratio') or 0.0)

    def evaluate(requested: str):
        rtype = (requested or '').strip()
        existing_type = str(most_recent_loan.loan_type).strip()
        if rtype == 'Regular':
            if existing_type == 'Regular':
                can_apply = bool(rel.get('eligible'))
                if can_apply:
                    return True, rel.get('reason') or 'Eligible for Regular reloan.'
                pct = f"{(paid_ratio*100):.1f}%"
                need = f"{max(0.0, 50.0 - (paid_ratio*100)):.1f}%"
                return False, rel.get('reason') or f"Regular reloan requires ≥50% progress. Current: {pct}. Need {need} more."
            else:
                can_apply = paid_ratio >= 0.5
                if can_apply:
                    return True, f"Eligible for Regular loan. Current loan paid {(paid_ratio*100):.1f}%."
                need = 50.0 - (paid_ratio*100)
                return False, f"Must pay {need:.1f}% more of current loan (50% required for Regular loan)."
        elif rtype == 'Emergency':
            # Enforce one Emergency at a time
            if existing_type == 'Emergency':
                return False, 'Only one Emergency loan at a time. Settle or switch type.'
            can_apply = paid_ratio >= 0.5
            if can_apply:
                return True, f"Eligible for Emergency loan. Current loan paid {(paid_ratio*100):.1f}%."
            need = 50.0 - (paid_ratio*100)
            return False, f"Cannot apply for Emergency loan yet. Need {need:.1f}% more to reach 50%."
        return False, 'Invalid loan type specified.'

    if requested_type:
        ok, reason = evaluate(requested_type)
        return Response({
            "loan_type_requested": requested_type,
            "can_apply": ok,
            "reason": reason,
            "existing_loan": {
                "control_number": most_recent_loan.control_number,
                "loan_type": most_recent_loan.loan_type,
                "loan_date": str(most_recent_loan.loan_date),
                "outstanding_balance": str(most_recent_loan.outstanding_balance)
            }
        })
    else:
        ok_reg, reason_reg = evaluate('Regular')
        ok_em, reason_em = evaluate('Emergency')
        return Response({
            "existing_loan": {
                "control_number": most_recent_loan.control_number,
                "loan_type": most_recent_loan.loan_type,
                "loan_date": str(most_recent_loan.loan_date),
                "outstanding_balance": str(most_recent_loan.outstanding_balance)
            },
            "regular_loan": {
                "eligible": ok_reg,
                "reason": reason_reg
            },
            "emergency_loan": {
                "eligible": ok_em,
                "reason": reason_em
            }
        })
#Wednesday
@api_view(['GET'])
def check_or_availability(request, account_number, or_number):
    """
    Check if an OR number is available for a member.
    New policy: OR numbers are globally unique. Once used,
    they cannot be reused by anyone, at any time.
    """
    try:
        account = Account.objects.get(account_number=account_number)
        member = account.account_holder

        from .models import LoanYearlyRecalculation
        today = timezone.now().date()

        # Block if used by other members anywhere
        used_by_other_schedule = PaymentSchedule.objects.filter(or_number=or_number, is_paid=True).exclude(loan__account=account).exists()
        used_in_tracker_by_other = ORNumberTracker.objects.filter(or_number=or_number).exclude(member=member).exists()
        used_in_fees_by_other = LoanYearlyRecalculation.objects.filter(fees_or_number=or_number, fees_paid=True).exclude(loan__account=account).exists()
        if used_by_other_schedule or used_in_tracker_by_other or used_in_fees_by_other:
            return Response({
                'available': False,
                'reason': f'OR {or_number} is already used by another member and cannot be reused',
                'reuse': False
            })

        # If used by same member previously on a different day -> block
        tracker = ORNumberTracker.objects.filter(member=member, or_number=or_number).first()
        if tracker and tracker.first_used_date.date() != today:
            return Response({
                'available': False,
                'reason': f'OR {or_number} was previously used on a different day and cannot be reused',
                'reuse': False
            })

        # Otherwise allow reuse for same member on the same day (front-end will still check same-loan-type reuse)
        return Response({
            'available': True,
            'reason': 'OR number is available for use by this member today',
            'reuse': True
        })
        
    except Account.DoesNotExist:
        return Response({
            'available': False,
            'reason': 'Account not found',
            'reuse': False
        }, status=200)
#Wednesday ends
class PaymentScheduleViewSet(viewsets.ModelViewSet):
    queryset = PaymentSchedule.objects.all()
    serializer_class = PaymentScheduleSerializer
    permission_classes = [IsAuthenticated]


    @action(detail=False, methods=['get'], url_path='summaries')
    def payment_schedule_summaries(self, request):
        loan_type = request.query_params.get('loan_type', None)
        earliest_due_date = PaymentSchedule.objects.filter(
            loan__account=OuterRef('loan__account'),
            is_paid=False
        ).values('due_date').order_by('due_date')[:1]
        
        summaries = PaymentSchedule.objects.filter(
            is_paid=False,
            due_date=Subquery(earliest_due_date)
        )

        if loan_type:  
            summaries = summaries.filter(loan__loan_type=loan_type)

        summaries = summaries.annotate(
            account_number=F('loan__account__account_number'),
            next_due_date=F('due_date'),
            total_balance=Sum('balance'),
            loan_type_annotated=F('loan__loan_type')  
        ).values('account_number', 'next_due_date', 'total_balance', 'loan_type_annotated').distinct()

        return Response(summaries)

    @action(detail=True, methods=['get'])
    def loan_details(self, request, pk=None):
        schedule = self.get_object()
        loan = schedule.loan
        return Response(LoanSerializer(loan).data)


    # def get_queryset(self):
    #     account_number = self.request.query_params.get('account_number')
    #     loan_type = self.request.query_params.get('loan_type', None)

    #     queryset = self.queryset

    #     if account_number:
    #         queryset = queryset.filter(loan__account__account_number=account_number)

    #     if loan_type:
    #         queryset = queryset.filter(loan__loan_type=loan_type)

    #     return queryset
    
    # recently lang
    def get_queryset(self):
        queryset = super().get_queryset()
        today = timezone.now().date()
        
        # ✅ AUTO-COLLECT PENALTIES: When fetching schedules, immediately collect penalties from overdue ones
        # This ensures penalties are deducted from share capital as soon as they become overdue
        # WITHOUT waiting for the member to pay
        overdue_schedules = queryset.filter(
            due_date__lt=today,
            is_paid=False,
            penalty_collected=False  # ✅ Only process if penalty hasn't been collected yet
        )
        
        for schedule in overdue_schedules:
            try:
                print(f"\n🔄 AUTO-COLLECTING: Schedule {schedule.id} is overdue, collecting penalty immediately...")
                schedule.apply_penalty()
            except Exception as e:
                logger.error(f"Error auto-collecting penalty for schedule {schedule.id}: {e}", exc_info=True)
                # Don't fail the entire query if one penalty fails
                pass
        
        # Filtering logic (your existing code)
        account_number = self.request.query_params.get('account_number')
        loan_type = self.request.query_params.get('loan_type')

        if account_number:
            queryset = queryset.filter(loan__account__account_number=account_number)

        if loan_type:
            queryset = queryset.filter(loan__loan_type=loan_type)

        return queryset

    #     queryset = super().get_queryset()
    #     today = timezone.now().date()

    #     # Apply overdue penalties once
    #     overdue_schedules = queryset.filter(is_paid=False, due_date__lt=today, penalty=0)
    #     for schedule in overdue_schedules:
    #         schedule.apply_penalty()

    #     # Filtering logic
    #     account_number = self.request.query_params.get('account_number')
    #     loan_type = self.request.query_params.get('loan_type')

    #     if account_number:
    #         queryset = queryset.filter(loan__account__account_number=account_number)

    #     if loan_type:
    #         queryset = queryset.filter(loan__loan_type=loan_type)

    #     return queryset
    # recently lang ends
    
    # @action(detail=False, methods=['get'], url_path='total-penalties')
    # def total_penalties(self, request):
    #     total = PaymentSchedule.objects.filter(is_paid=True).aggregate(total_penalty=Sum('penalty'))['total_penalty'] or 0
    #     return Response({'total_penalty': total})
    @action(detail=False, methods=['get'], url_path='total-penalties')
    def total_penalties(self, request):
        # Only count penalties from schedules that have been PAID
        # Because unpaid penalties haven't been collected yet
        total = PaymentSchedule.objects.filter(
            is_paid=True,
            penalty__gt=0  # Only count schedules with actual penalties
        ).aggregate(
            total_penalty=Sum('penalty')
        )['total_penalty'] or 0
        
        return Response({'total_penalty': float(total)})    
    
    # Thursday, move this inside PaymentScheduleViewSet
    @action(detail=True, methods=['post'])
    def mark_as_paid(self, request, pk=None):
        from django.db import transaction
        
        schedule = self.get_object()
        # Safe defaults for advance reporting to avoid UnboundLocalError
        covered_schedules = 0
        try:
            from decimal import Decimal as _Dec
            total_advance_applied = _Dec('0.00')
        except Exception:
            total_advance_applied = 0
        # Accept both received_amount (frontend) and received_amnt (legacy)
        received_amnt = request.data.get('received_amount', None)
        if received_amnt is None:
            received_amnt = request.data.get('received_amnt', schedule.balance)
        or_number = request.data.get('or_number')
        try:
            is_advance = bool(request.data.get('is_advance', False))
        except Exception:
            is_advance = False
        loan_type = request.data.get('loan_type')
        
        print(f"=== MARK AS PAID START ===")
        print(f"Schedule ID: {schedule.id}")
        print(f"OR Number: {or_number}")
        print(f"Is Already Paid: {schedule.is_paid}") 
        
        # ✅ VALIDATE FIRST - BEFORE ANY TRANSACTION
        # Check if OR number is provided and valid
        if not or_number:
            print("❌ OR number is required")
            return Response(
                {'error': 'OR number is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(str(or_number).strip()) != 4:
            print(f"❌ Invalid OR length: {len(str(or_number).strip())}")
            return Response(
                {'error': 'Valid 4-digit OR number is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if OR already used for this specific member's loan type
        # IMPORTANT: Only check PAID schedules with this OR
        #Wednesday changed
        member = schedule.loan.account.account_holder
        other_member_usage = ORNumberTracker.objects.filter(
            or_number=or_number
        ).exclude(member=member).exists()
        
        if other_member_usage:
            print(f"❌ OR {or_number} used by another member")
            return Response({
                'error': f'OR number {or_number} is already in use by another member.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        print(f"✅ All validations passed (OR can be reused by same member)")
        #Wednesday ends
        
        # ✅ ONLY NOW process the payment (validation PASSED)
        try:
            with transaction.atomic():
                print(f"📦 Starting transaction...")
                year_collapse_shift = 0
                loan_settled = False
            
                # Refresh from DB to get latest state
                schedule.refresh_from_db()
                
                # ✅ DO NOT apply penalty here!
                # Penalty is already auto-deducted in get_queryset() when schedule is fetched
                # If we apply it here too, it gets deducted twice!
                # The penalty field will already have the penalty amount if it was overdue
                
                # Process payment
                #Thursday
                # schedule.process_payment(received_amnt)
                # schedule.or_number = or_number
                print(f"💳 Processing payment: {received_amnt}")
                received_amnt = Decimal(received_amnt)
                if received_amnt <= 0:
                    raise ValueError("Received amount must be greater than zero.")

                # Treat scheduled amortization (principal + interest) as the amount due.
                # Penalty is handled separately by auto-collection and should not block marking paid.
                amort_due = schedule.payment_amount

                # Handle normal payment vs explicit advance mode
                if not is_advance:
                    TOLERANCE = Decimal('0.01')
                    if received_amnt + TOLERANCE >= amort_due:
                        schedule.advance_pay += max(Decimal('0.00'), received_amnt - amort_due)
                        schedule.under_pay = Decimal('0.00')
                        schedule.is_paid = True
                    elif received_amnt < amort_due:
                        underpayment = (amort_due - received_amnt).quantize(Decimal('0.01'))
                        schedule.under_pay += underpayment
                        schedule.advance_pay = Decimal('0.00')
                        schedule.is_paid = False
                else:
                    # Explicit advance: sequentially cover schedules, marking fully covered ones paid,
                    # then renumber remaining unpaid schedules starting at Year 1 and reschedule every 15 days.
                    schedule.is_paid = False
                    schedule.under_pay = Decimal('0.00')
                    schedule.advance_pay = Decimal('0.00')
                    loan = schedule.loan
                    remaining_amt = received_amnt.quantize(Decimal('0.01'))
                    covered_schedules = 0
                    total_advance_applied = Decimal('0.00')
                    covered_ids_for_event = []
                    try:
                        unpaid_qs = list(PaymentSchedule.objects.filter(loan=loan, is_paid=False).order_by('due_date'))
                        # Fully cover earliest schedules first
                        for us in unpaid_qs:
                            if remaining_amt <= Decimal('0.00'):
                                break
                            sched_due = Decimal(us.payment_amount or 0).quantize(Decimal('0.01'))
                            if remaining_amt >= sched_due:
                                # Fully cover this schedule
                                us.is_paid = True
                                if not us.date_paid:
                                    us.date_paid = timezone.now().date()
                                us.under_pay = Decimal('0.00')
                                us.or_number = or_number
                                us.save(update_fields=['is_paid','date_paid','under_pay','or_number'])
                                covered_ids_for_event.append(us.id)
                                # Deduct principal component from loan remaining_principal
                                try:
                                    pcomp = Decimal(us.principal_amount or 0)
                                    new_rp = (Decimal(loan.remaining_principal or 0) - pcomp).quantize(Decimal('0.01'))
                                    if new_rp < Decimal('0.00'):
                                        new_rp = Decimal('0.00')
                                    loan.remaining_principal = new_rp
                                    loan.save(update_fields=['remaining_principal'])
                                except Exception as _e:
                                    logger.warning(f"Failed to update remaining_principal on full cover: {_e}")
                                remaining_amt = (remaining_amt - sched_due).quantize(Decimal('0.01'))
                                total_advance_applied = (total_advance_applied + sched_due).quantize(Decimal('0.01'))
                                covered_schedules += 1
                                continue

                        # Apply any partial remainder to the LAST unpaid schedule's principal (keep upcoming principals fixed)
                        if remaining_amt > Decimal('0.00'):
                            unpaid_left = list(PaymentSchedule.objects.filter(loan=loan, is_paid=False).order_by('due_date'))
                            if unpaid_left:
                                tail = unpaid_left[-1]
                                base_p = Decimal(tail.principal_amount or 0)
                                if base_p > Decimal('0.00'):
                                    reduce_amt = min(base_p, remaining_amt)
                                    new_p = (base_p - reduce_amt).quantize(Decimal('0.01'))
                                    tail.principal_amount = new_p
                                    ip = Decimal(tail.interest_portion or 0).quantize(Decimal('0.01'))
                                    tail.payment_amount = (new_p + ip).quantize(Decimal('0.01'))
                                    # Update balances
                                    try:
                                        rb = Decimal(tail.remaining_balance or tail.balance or loan.remaining_principal)
                                    except Exception:
                                        rb = Decimal(loan.remaining_principal or 0)
                                    rb = (rb - reduce_amt).quantize(Decimal('0.01'))
                                    if rb < Decimal('0.00'):
                                        rb = Decimal('0.00')
                                    tail.remaining_balance = rb
                                    tail.balance = rb
                                    if not tail.original_principal:
                                        tail.original_principal = schedule.original_principal or loan.principal
                                    tail.save(update_fields=['principal_amount','payment_amount','remaining_balance','balance','original_principal'])
                                    # Deduct from loan remaining principal
                                    try:
                                        new_rp = (Decimal(loan.remaining_principal or 0) - reduce_amt).quantize(Decimal('0.01'))
                                        if new_rp < Decimal('0.00'):
                                            new_rp = Decimal('0.00')
                                        loan.remaining_principal = new_rp
                                        loan.save(update_fields=['remaining_principal'])
                                    except Exception as _e:
                                        logger.warning(f"Failed to deduct partial principal from remaining_principal (tail): {_e}")

                        # Preserve year_number; only reset due dates cadence for remaining unpaid schedules
                        try:
                            unpaid_left2 = list(PaymentSchedule.objects.filter(loan=loan, is_paid=False).order_by('due_date'))
                            start_date = timezone.now().date() + timezone.timedelta(days=15)
                            step = timezone.timedelta(days=15)
                            for idx, us in enumerate(unpaid_left2):
                                us.due_date = start_date + (step * idx)
                                us.save(update_fields=['due_date'])
                        except Exception as _e:
                            logger.warning(f"Failed to reschedule unpaid after advance: {_e}")
                    except Exception as _e:
                        logger.warning(f"Advance coverage loop failed: {_e}")
                    # Record a PaymentEvent for this explicit advance so UI can display it
                    try:
                        from .models import PaymentEvent
                        event_due_date = None
                        if covered_ids_for_event:
                            first_cov = PaymentSchedule.objects.filter(id__in=covered_ids_for_event).order_by('due_date').first()
                            if first_cov:
                                event_due_date = first_cov.due_date
                        event = PaymentEvent.objects.create(
                            loan=loan,
                            schedule=None,
                            mode='pay_ahead',
                            curtailment_method='',
                            or_number=or_number,
                            amount_total=total_advance_applied,
                            amount_regular=Decimal('0.00'),
                            amount_pay_ahead=total_advance_applied,
                            amount_curtailment=Decimal('0.00'),
                            covered_schedule_ids=covered_ids_for_event,
                            notes='Recorded via mark_as_paid advance',
                            due_date=event_due_date,
                            created_by=request.user if hasattr(request, 'user') and getattr(request.user, 'is_authenticated', False) else None
                        )
                        if covered_ids_for_event:
                            PaymentSchedule.objects.filter(id__in=covered_ids_for_event).update(advance_event=event)
                    except Exception as _e:
                        logger.warning(f"Failed to record PaymentEvent for advance: {_e}")
                
                # Set OR number
                schedule.or_number = or_number
                #Thursday end
                
                # Set loan_type if it's not already set
                if not schedule.loan_type and loan_type:
                    schedule.loan_type = loan_type
                #Thursday 
                
                # Explicitly save with update_fields to trigger signal properly
                            # ✅ SAVE NOW (after all in-memory changes, still in transaction)
                # Ensure date_paid is recorded when marking as paid
                if schedule.is_paid and not schedule.date_paid:
                    schedule.date_paid = timezone.now().date()
                print(f"💾 Saving schedule with OR: {or_number}, is_paid: {schedule.is_paid}")
                schedule.save(update_fields=[
                    'is_paid',  # ✅ CRITICAL: Must include is_paid for signal to trigger!
                    'loan_type', 
                    'or_number', 
                    'balance', 
                    'penalty', 
                    'advance_pay', 
                    'under_pay', 
                    'remaining_balance',
                    'date_paid'
                ])
                
                # Update loan status
                print(f"📊 Updating loan status...")
                schedule.loan.update_status_based_on_schedules()
                # Decrease loan.remaining_principal by principal_amount when paid
                if schedule.is_paid:
                    loan = schedule.loan
                    try:
                        new_remaining = (Decimal(loan.remaining_principal) - Decimal(schedule.principal_amount)).quantize(Decimal('0.01'))
                        if new_remaining < Decimal('0.00'):
                            new_remaining = Decimal('0.00')
                        loan.remaining_principal = new_remaining
                        loan.save(update_fields=['remaining_principal'])
                    except Exception as e:
                        logger.warning(f"Failed to update loan remaining_principal after payment: {e}")
                
                # Totals already captured in advance branch if used; ensure variables exist
                covered_schedules = covered_schedules if 'covered_schedules' in locals() else 0
                total_advance_applied = total_advance_applied if 'total_advance_applied' in locals() else Decimal('0.00')

                # ✅ YEAR COLLAPSE: Disabled - Keep original year numbers for display consistency
                # DO NOT renumber years when they are paid off. This preserves the original
                # year structure (Year 1, Year 2, Year 3, Year 4) for the user interface.
                # The frontend will still show all years with their correct labels.
                try:
                    loan = schedule.loan
                    shift_years = 0
                    # Note: Year collapsing disabled - years maintain original numbers
                    # This ensures Year 1, Year 2, Year 3, Year 4 don't get renamed to Year 1, Year 2, etc.
                except Exception as e:
                    logger.warning(f"Year tracking: {e}")

                # ✅ FINALIZE: If remaining principal is now zero, mark loan fully paid and close remaining schedules
                try:
                    loan = schedule.loan
                    rp = Decimal(loan.remaining_principal or 0).quantize(Decimal('0.01'))
                    if rp <= Decimal('0.00'):
                        if settle_loan_if_zero(loan):
                            loan_settled = True
                except Exception as e:
                    logger.warning(f"Failed to finalize loan settlement at zero remaining principal: {e}")

                print(f"✅ Transaction committed")
                
                # ✅ ADD THIS - Mark OR tracker as inactive if loan fully paid:
                #Wednesday
                # ✅ Mark OR as inactive only when ALL member's loans are paid
                if schedule.loan.status == 'Settled':
                    # Check if member has any other active loans
                    member = schedule.loan.account.account_holder
                    active_loans = Loan.objects.filter(
                        account__account_holder=member,
                        status='Ongoing'
                    ).exists()
                    
                    if not active_loans:
                        # All loans paid - release OR for reuse
                        ORNumberTracker.objects.filter(
                            member=member,
                            or_number=or_number
                        ).update(is_active=False)
            
            # Fetch latest yearly recalculation snapshot (if any) to show recalculated fees
            latest_recalc = None
            try:
                latest_recalc = LoanYearlyRecalculation.objects.filter(loan=schedule.loan).order_by('-year').first()
            except Exception:
                latest_recalc = None

            # Build status message with settlement congrats if applicable
            status_msg = 'Advance payment successful.' if is_advance else 'Payment processed successfully.'
            if loan_settled:
                status_msg = 'Congratulations! Loan fully paid.'
            return Response({
                'status': status_msg,
                'or_number': or_number,
                'is_paid': schedule.is_paid,
                'collapsed_years': year_collapse_shift,
                'loan_settled': loan_settled,
                'advance_applied': str(total_advance_applied if isinstance(total_advance_applied, Decimal) else total_advance_applied),
                'advance_covered_count': covered_schedules,
                'updated_schedule': {
                    'id': schedule.id,
                    'principal_amount': str(schedule.principal_amount),
                    'interest_portion': str(schedule.interest_portion),
                    'payment_amount': str(schedule.payment_amount),
                    'is_covered_by_advance': schedule.is_covered_by_advance,
                    'advance_pay': str(schedule.advance_pay),
                    'date_paid': schedule.date_paid.isoformat() if schedule.date_paid else None,
                },
                'yearly_recalculation': ({
                    'year': latest_recalc.year,
                    'previous_balance': str(latest_recalc.previous_balance),
                    'service_fee': str(latest_recalc.service_fee),
                    'interest_amount': str(latest_recalc.interest_amount),
                    'admincost': str(latest_recalc.admincost),
                    'notarial': str(latest_recalc.notarial),
                    'cisp': str(latest_recalc.cisp),
                    'total_fees_due': str(latest_recalc.total_fees_due),
                    'new_bimonthly_amortization': str(latest_recalc.new_bimonthly_amortization),
                    'fees_paid': latest_recalc.fees_paid
                } if latest_recalc else None)
            })
        
        except Exception as e:
            print(f"❌ Error processing payment: {str(e)}")
            return Response(
                {'error': f'Error processing payment: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# =============================
# PaymentEvent API (Hybrid Pay Ahead + Curtail)
# =============================
class PaymentEventView(APIView):
    """Process a composite payment event supporting pay-ahead and principal curtailment.
    POST /loans/<control_number>/payment-event/
    Payload example:
    {
      "schedule_id": 123,            # optional current schedule
      "mode": "hybrid",             # regular | pay_ahead | curtail | hybrid
      "curtailment_method": "shorten", # shorten | redistribute (future enhancement)
      "or_number": "1234",
      "amount_regular": "5000.00",
      "amount_pay_ahead": "30000.00",
      "amount_curtailment": "15000.00",
      "notes": "Lump sum advance + curtail"
    }
    """
    def get(self, request, control_number):
        """List payment events for a loan to support UI summaries"""
        try:
            loan = Loan.objects.get(control_number=control_number)
        except Loan.DoesNotExist:
            return Response({'error': 'Loan not found'}, status=404)

        events = PaymentEvent.objects.filter(loan=loan).order_by('-payment_date')
        serializer = PaymentEventSerializer(events, many=True)
        return Response({'events': serializer.data}, status=200)

    def post(self, request, control_number):
        from decimal import Decimal
        try:
            loan = Loan.objects.select_for_update().get(control_number=control_number)
        except Loan.DoesNotExist:
            return Response({'error': 'Loan not found'}, status=404)

        data = request.data
        mode = data.get('mode') or 'regular'
        curtail_method = data.get('curtailment_method') or ''
        or_number = data.get('or_number')
        schedule_id = data.get('schedule_id')
        notes = data.get('notes','')
        # Amount parsing
        def to_dec(val):
            try:
                return Decimal(str(val)) if val not in (None,'') else Decimal('0.00')
            except Exception:
                return Decimal('0.00')
        amt_regular = to_dec(data.get('amount_regular'))
        amt_ahead = to_dec(data.get('amount_pay_ahead'))
        amt_curtail = to_dec(data.get('amount_curtailment'))
        total = (amt_regular + amt_ahead + amt_curtail).quantize(Decimal('0.01'))

        if total <= Decimal('0.00'):
            return Response({'error': 'Total amount must be > 0'}, status=400)
        if mode not in ['regular','pay_ahead','curtail','hybrid']:
            return Response({'error': 'Invalid mode'}, status=400)

        # OR reuse policy validation (if OR provided)
        if or_number and len(str(or_number).strip()) == 4:
            account = loan.account
            member = account.account_holder
            today = timezone.now().date()
            # Used by other member anywhere? -> BLOCK
            used_by_other_schedule = PaymentSchedule.objects.filter(or_number=or_number, is_paid=True).exclude(loan__account=account).exists()
            used_by_other_tracker = ORNumberTracker.objects.filter(or_number=or_number).exclude(member=member).exists()
            # Treat fees usage similar to schedule usage: ignore uses by the same account
            used_in_fees_any = LoanYearlyRecalculation.objects.filter(fees_or_number=or_number, fees_paid=True).exclude(loan__account=account).exists()
            if used_by_other_schedule or used_by_other_tracker or used_in_fees_any:
                return Response({'error': f'OR {or_number} is already in use and cannot be reused'}, status=400)

            # Same member, different day? -> BLOCK
            tracker = ORNumberTracker.objects.filter(member=member, or_number=or_number).first()
            tracker_diff_day = bool(tracker) and (tracker.first_used_date.date() != today)
            same_member_prev_day_schedule = PaymentSchedule.objects.filter(or_number=or_number, is_paid=True, loan__account=account).exclude(date_paid=today).exists()
            if tracker_diff_day or same_member_prev_day_schedule:
                return Response({'error': 'OR was used on a different day and cannot be reused'}, status=400)

            # If the same member already used this OR today (recorded in tracker), allow reuse
            # across Regular, Emergency, Advance, Withdrawal, and Yearly Fees for that same date.
            # Only enforce same-day same-type / fees blocking when the OR has NOT been used
            # today by this same member.
            tracker_same_day = bool(tracker) and (tracker.first_used_date.date() == today)
            if not tracker_same_day:
                # Same member, same day, same loan type? -> BLOCK except for advance/pay_ahead mode
                same_day_same_type = PaymentSchedule.objects.filter(
                    loan__account=account,
                    loan__loan_type=loan.loan_type,
                    or_number=or_number,
                    is_paid=True,
                    date_paid=today
                ).exists()
                used_fees_same_day = LoanYearlyRecalculation.objects.filter(fees_or_number=or_number, fees_paid=True, fees_paid_date=today).exists()
                # DEBUG: log decision factors for OR reuse (dev-only)
                logger.debug(f"OR reuse check: or={or_number} mode={mode} same_day_same_type={same_day_same_type} used_fees_same_day={used_fees_same_day} tracker_same_day={tracker_same_day}")
                if (same_day_same_type and mode not in ('pay_ahead','hybrid')) or used_fees_same_day:
                    return Response({'error': 'OR cannot be reused today for the same loan type or category'}, status=400)

        covered_ids = []
        target_schedule = None
        if schedule_id:
            target_schedule = PaymentSchedule.objects.filter(id=schedule_id, loan=loan).first()
            if not target_schedule:
                return Response({'error': 'schedule_id not found for this loan'}, status=404)

        # timezone is imported at module level; do not re-import here (would shadow module variable)
        today = timezone.now().date()

        try:
            with transaction.atomic():
                # 1. Regular portion
                if amt_regular > 0 and target_schedule:
                    due = Decimal(target_schedule.payment_amount)
                    if amt_regular + Decimal('0.01') >= due:
                        target_schedule.is_paid = True
                        if not target_schedule.date_paid:
                            target_schedule.date_paid = today
                        target_schedule.or_number = or_number
                        target_schedule.save(update_fields=['is_paid','date_paid','or_number'])
                        # Reduce loan remaining principal by principal_amount
                        try:
                            new_rp = (Decimal(loan.remaining_principal) - Decimal(target_schedule.principal_amount)).quantize(Decimal('0.01'))
                            if new_rp < 0: new_rp = Decimal('0.00')
                            loan.remaining_principal = new_rp
                            loan.save(update_fields=['remaining_principal'])
                        except Exception:
                            pass

                # 2. Pay Ahead coverage
                if amt_ahead > 0:
                    remaining_ahead = amt_ahead
                    unpaid_qs = PaymentSchedule.objects.filter(loan=loan, is_paid=False).order_by('due_date')
                    # If a target schedule provided, start after it
                    if target_schedule:
                        unpaid_qs = unpaid_qs.filter(due_date__gt=target_schedule.due_date)
                    for sched in unpaid_qs:
                        if remaining_ahead <= Decimal('0.00'):
                            break
                        sched_due = Decimal(sched.payment_amount)
                        if remaining_ahead + Decimal('0.0001') >= sched_due:
                            sched.is_paid = True
                            sched.is_covered_by_advance = True
                            if not sched.date_paid:
                                sched.date_paid = today
                            sched.advance_event = None  # set after event save
                            if or_number and not sched.or_number:
                                sched.or_number = or_number
                            sched.save(update_fields=['is_paid','date_paid','is_covered_by_advance','or_number'])
                            covered_ids.append(sched.id)
                            # Reduce loan remaining principal by principal portion
                            try:
                                new_rp = (Decimal(loan.remaining_principal) - Decimal(sched.principal_amount)).quantize(Decimal('0.01'))
                                if new_rp < 0: new_rp = Decimal('0.00')
                                loan.remaining_principal = new_rp
                                loan.save(update_fields=['remaining_principal'])
                            except Exception:
                                pass
                            remaining_ahead = (remaining_ahead - sched_due).quantize(Decimal('0.01'))
                        else:
                            break  # do not partially cover a schedule

                # 3. Curtailment (shorten only initial implementation)
                if amt_curtail > 0:
                    # Reduce loan remaining principal immediately
                    new_rp = (Decimal(loan.remaining_principal) - amt_curtail).quantize(Decimal('0.01'))
                    if new_rp < 0: new_rp = Decimal('0.00')
                    loan.remaining_principal = new_rp
                    loan.save(update_fields=['remaining_principal'])
                    if curtail_method == 'shorten':
                        # Remove (archive) tail schedules whose principal sum approximates curtailment
                        tail_unpaid = list(PaymentSchedule.objects.filter(loan=loan, is_paid=False).order_by('-due_date'))
                        removed_sum = Decimal('0.00')
                        for sched in tail_unpaid:
                            if removed_sum >= amt_curtail:
                                break
                            p = Decimal(sched.principal_amount)
                            sched.curtailed_principal_delta = p
                            # Mark as paid (canceled) so UI drops it from unpaid list
                            sched.is_paid = True
                            if not sched.date_paid:
                                sched.date_paid = today
                            sched.payment_amount = Decimal('0.00')
                            sched.principal_amount = Decimal('0.00')
                            sched.save(update_fields=['is_paid','date_paid','payment_amount','principal_amount','curtailed_principal_delta'])
                            covered_ids.append(sched.id)
                            removed_sum += p
                    elif curtail_method == 'redistribute':
                        # Evenly reduce principal across remaining unpaid schedules in due_date order
                        unpaid = list(PaymentSchedule.objects.filter(loan=loan, is_paid=False).order_by('due_date').select_for_update())
                        remaining_reduce = amt_curtail
                        n = len(unpaid)
                        if n > 0 and remaining_reduce > Decimal('0.00'):
                            # Compute per-schedule reduction target; last schedule absorbs remainder
                            per = (remaining_reduce / Decimal(n)).quantize(Decimal('0.01'))
                            for i, us in enumerate(unpaid):
                                if remaining_reduce <= Decimal('0.00'):
                                    break
                                base_p = Decimal(us.principal_amount or 0)
                                if base_p <= Decimal('0.00'):
                                    continue
                                target = per if i < n - 1 else remaining_reduce
                                reduce_amt = min(base_p, target)
                                new_p = (base_p - reduce_amt).quantize(Decimal('0.01'))
                                us.principal_amount = new_p
                                # Track delta for audit
                                try:
                                    prev_delta = Decimal(us.curtailed_principal_delta or 0)
                                except Exception:
                                    prev_delta = Decimal('0.00')
                                us.curtailed_principal_delta = (prev_delta + reduce_amt).quantize(Decimal('0.01'))
                                # Recompute payment_amount
                                ip = Decimal(us.interest_portion or 0).quantize(Decimal('0.01'))
                                us.payment_amount = (new_p + ip).quantize(Decimal('0.01'))
                                # Update balances
                                try:
                                    rb = Decimal(us.remaining_balance or us.balance or loan.remaining_principal)
                                except Exception:
                                    rb = Decimal(loan.remaining_principal or 0)
                                rb = (rb - reduce_amt).quantize(Decimal('0.01'))
                                if rb < Decimal('0.00'):
                                    rb = Decimal('0.00')
                                us.remaining_balance = rb
                                us.balance = rb
                                # Preserve original_principal if missing
                                if not us.original_principal:
                                    try:
                                        us.original_principal = us.principal_amount + ip
                                    except Exception:
                                        us.original_principal = None
                                # If principal and interest both zero, mark as paid
                                if new_p <= Decimal('0.00') and ip <= Decimal('0.00'):
                                    us.is_paid = True
                                    if not us.date_paid:
                                        us.date_paid = today
                                    us.under_pay = Decimal('0.00')
                                    if or_number and not us.or_number:
                                        us.or_number = or_number
                                    us.save(update_fields=['principal_amount','payment_amount','remaining_balance','balance','original_principal','is_paid','date_paid','under_pay','curtailed_principal_delta','or_number'])
                                    covered_ids.append(us.id)
                                else:
                                    us.save(update_fields=['principal_amount','payment_amount','remaining_balance','balance','original_principal','curtailed_principal_delta'])
                                remaining_reduce = (remaining_reduce - reduce_amt).quantize(Decimal('0.01'))
                        # After redistribution, resequence due dates for remaining unpaid schedules forward by 15 days from today
                        try:
                            unpaid_ref = PaymentSchedule.objects.filter(loan=loan, is_paid=False).order_by('due_date')
                            start_date = timezone.now().date() + timezone.timedelta(days=15)
                            step = timezone.timedelta(days=15)
                            idx = 0
                            for us in unpaid_ref:
                                us.due_date = start_date + (step * idx)
                                us.save(update_fields=['due_date'])
                                idx += 1
                        except Exception as _e:
                            logger.warning(f"Failed to reschedule unpaid after curtail redistribute: {_e}")

                # Create PaymentEvent record
                event_due_date = None
                if target_schedule and target_schedule.due_date:
                    event_due_date = target_schedule.due_date
                elif covered_ids:
                    first_cov = PaymentSchedule.objects.filter(id__in=covered_ids).order_by('due_date').first()
                    if first_cov:
                        event_due_date = first_cov.due_date

                event = PaymentEvent.objects.create(
                    loan=loan,
                    schedule=target_schedule,
                    mode=mode,
                    curtailment_method=curtail_method if amt_curtail > 0 else '',
                    or_number=or_number,
                    amount_total=total,
                    amount_regular=amt_regular,
                    amount_pay_ahead=amt_ahead,
                    amount_curtailment=amt_curtail,
                    covered_schedule_ids=covered_ids,
                    notes=notes,
                    due_date=event_due_date,
                    created_by=request.user if request.user and request.user.is_authenticated else None
                )

                # Track OR usage for this member (advance/combined payments)
                try:
                    if or_number:
                        ORNumberTracker.objects.get_or_create(
                            member=loan.account.account_holder,
                            or_number=or_number,
                            defaults={
                                'loan_type': 'Advance' if amt_ahead > 0 else (loan.loan_type or 'Regular'),
                                'loan': loan,
                                'is_active': True
                            }
                        )
                except Exception:
                    logger.exception(f"Failed to create OR tracker for payment event OR {or_number}")

                # Link advance_event for covered schedules
                if covered_ids and amt_ahead > 0:
                    PaymentSchedule.objects.filter(id__in=covered_ids).update(advance_event=event)

                loan.refresh_from_db()
                serializer = PaymentEventSerializer(event)
                # Final settlement guard: if remaining principal is zero, ensure schedules are closed
                try:
                    rp = Decimal(loan.remaining_principal or 0).quantize(Decimal('0.01'))
                    if rp <= Decimal('0.00'):
                        settle_loan_if_zero(loan)
                        # Double-check no unpaid schedules remain
                        leftover = PaymentSchedule.objects.filter(loan=loan, is_paid=False)
                        if leftover.exists():
                            today = timezone.now().date()
                            for s in leftover:
                                s.is_paid = True
                                if not s.date_paid:
                                    s.date_paid = today
                                s.under_pay = Decimal('0.00')
                                if not s.or_number and or_number:
                                    s.or_number = or_number
                                s.save(update_fields=['is_paid','date_paid','under_pay','or_number'])
                except Exception:
                    pass
                return Response({
                    'payment_event': serializer.data,
                    'loan_remaining_principal': str(loan.remaining_principal),
                    'covered_schedule_ids': covered_ids
                }, status=201)
        except ValidationError as ve:
            return Response({'error': ve.message}, status=400)
        except Exception as e:
            logger.exception("PaymentEvent processing failed")
            return Response({'error': str(e)}, status=500)
             #Wednesday ends
    
    # ✅ NEW: Apply penalties endpoint
    @action(detail=False, methods=['post'], url_path='apply-penalties')
    def apply_penalties_for_overdue(self, request):
        """
        Apply penalties to all overdue payment schedules.
        Call this endpoint periodically (e.g., daily via cron job or manual button).
        
        Returns: List of schedules where penalties were applied
        """
        from django.utils import timezone
        
        today = timezone.now().date()
        print(f"\n{'='*80}")
        print(f"APPLYING PENALTIES FOR OVERDUE SCHEDULES (as of {today})")
        print(f"{'='*80}")
        
        overdue_schedules = PaymentSchedule.objects.filter(
            is_paid=False,
            due_date__lt=today
        ).select_related('loan', 'loan__account', 'loan__account__account_holder')
        
        penalty_results = []
        
        for schedule in overdue_schedules:
            try:
                # Only calculate penalty if not already set
                if schedule.penalty == Decimal('0.00'):
                    penalty_amount = (schedule.payment_amount * Decimal('0.02')).quantize(Decimal('0.01'))
                    schedule.penalty = penalty_amount
                    schedule.save(update_fields=['penalty'])
                    print(f"\n📌 Schedule {schedule.id}: Penalty calculated ₱{penalty_amount}")
                
                # Apply penalty (this will attempt auto-deduction)
                print(f"   Applying penalty collection...")
                schedule.apply_penalty()
                
                schedule.refresh_from_db()
                penalty_results.append({
                    'schedule_id': schedule.id,
                    'loan_control_number': str(schedule.loan.control_number),
                    'penalty_amount': str(schedule.penalty),
                    'is_collected': schedule.penalty == Decimal('0.00'),
                    'status': 'success'
                })
                
            except Exception as e:
                logger.exception(f"Error applying penalty for schedule {schedule.id}: {e}")
                penalty_results.append({
                    'schedule_id': schedule.id,
                    'status': 'error',
                    'error': str(e)
                })
        
        print(f"\n{'='*80}")
        print(f"PENALTY APPLICATION COMPLETE - Processed {len(penalty_results)} schedules")
        print(f"{'='*80}\n")
        
        return Response({
            'total_processed': len(penalty_results),
            'results': penalty_results
        }, status=status.HTTP_200_OK)
    
    # ✅ NEW: Debug endpoint - shows what would be applied
    @action(detail=False, methods=['get'], url_path='check-overdue-penalties')
    def check_overdue_penalties(self, request):
        """
        Check which schedules have overdue penalties (without applying them).
        Useful for debugging.
        """
        from django.utils import timezone
        
        today = timezone.now().date()
        
        overdue_schedules = PaymentSchedule.objects.filter(
            is_paid=False,
            due_date__lt=today
        ).select_related('loan', 'loan__account', 'loan__account__account_holder').order_by('due_date')
        
        results = []
        for schedule in overdue_schedules:
            penalty_would_be = (schedule.payment_amount * Decimal('0.02')).quantize(Decimal('0.01'))
            results.append({
                'schedule_id': schedule.id,
                'loan_control_number': str(schedule.loan.control_number),
                'account_number': schedule.loan.account.account_number,
                'member': f"{schedule.loan.account.account_holder.first_name} {schedule.loan.account.account_holder.last_name}",
                'due_date': str(schedule.due_date),
                'days_overdue': (today - schedule.due_date).days,
                'payment_amount': str(schedule.payment_amount),
                'current_penalty': str(schedule.penalty),
                'penalty_would_be': str(penalty_would_be),
                'share_capital': str(schedule.loan.account.shareCapital),
            })
        
        return Response({
            'today': str(today),
            'total_overdue': len(results),
            'schedules': results
        }, status=status.HTTP_200_OK)
    
    # @action(detail=True, methods=['post'])
    # def mark_as_paid(self, request, pk=None):
    #     from django.db import transaction
        
    #     schedule = self.get_object()
    #     received_amnt = request.data.get('received_amnt', schedule.balance)
    #     or_number = request.data.get('or_number')
    #     loan_type = request.data.get('loan_type') 
        
    #     # ✅ VALIDATE FIRST, BEFORE ANY DATABASE CHANGES
    #     if not or_number or len(or_number) != 4:
    #         return Response({'error': 'Valid 4-digit OR number is required'}, status=status.HTTP_400_BAD_REQUEST)
        
    #     # Check if OR already used for this member's loan type
    #     existing_or = PaymentSchedule.objects.filter(
    #         or_number=or_number,
    #         loan__account=schedule.loan.account,
    #         loan__loan_type=schedule.loan.loan_type
    #     ).exclude(id=schedule.id).exists()
        
    #     if existing_or:
    #         return Response({
    #             'error': f'OR number {or_number} has already been used for this member\'s {schedule.loan.loan_type} loan. Please use a different OR number.'
    #         }, status=status.HTTP_400_BAD_REQUEST)
        
    #     # ✅ ONLY NOW process the payment (validation passed)
    #     with transaction.atomic():
    #         today = timezone.now().date()
    #         if schedule.due_date < today and not schedule.is_paid:
    #             schedule.apply_penalty()
            
    #         # Process payment
    #         schedule.process_payment(received_amnt)
    #         schedule.or_number = or_number
            
    #         # Set loan_type if it's not already set
    #         if not schedule.loan_type and loan_type:
    #             schedule.loan_type = loan_type
            
    #         # Explicitly save with update_fields to trigger signal properly
    #         schedule.save(update_fields=['is_paid', 'loan_type', 'or_number', 'balance', 'penalty', 'advance_pay', 'under_pay', 'remaining_balance'])
            
    #         # Update loan status
    #         schedule.loan.update_status_based_on_schedules()
        
    #     return Response({'status': 'Payment processed and loan status updated.'})
#2dago
@api_view(['GET'])
def get_total_penalties(request):
    """Get total penalties collected from paid schedules"""
    total = PaymentSchedule.objects.filter(
        is_paid=True,
        penalty__gt=0
    ).aggregate(
        total_penalty=Sum('penalty')
    )['total_penalty'] or 0
    
    return Response({'total_penalty': float(total)})
#2dago
    # def mark_as_paid(self, request, pk=None):
    #     schedule = self.get_object()
    #     received_amnt = request.data.get('received_amnt', schedule.balance)  
    #     schedule.process_payment(received_amnt)
    #     return Response({'status': 'Payment processed and marked as paid.'}, status=status.HTTP_200_OK)



def process_payment_view(request, pk):
    if request.method == "POST":
        # Parse JSON body
        try:
            body = json.loads(request.body)
            received_amnt = body.get('received_amnt')
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON payload"}, status=400)
        
        if not received_amnt:
            return JsonResponse({"error": "received_amnt is required"}, status=400)
        
        # Process the payment
        try:
            payment_schedule = get_object_or_404(PaymentSchedule, pk=pk)
            payment_schedule.process_payment(received_amnt)
            return JsonResponse({
                "message": "Payment processed successfully",
                "advance_pay": str(payment_schedule.advance_pay),
                "under_pay": str(payment_schedule.under_pay),
                "penalty": str(payment_schedule.penalty),
                "balance": str(payment_schedule.balance),
                "is_paid": payment_schedule.is_paid
            })
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"error": "Invalid request method"}, status=405)

#credit button fix
@api_view(['POST'])
@permission_classes([AllowAny])
def mark_as_paid(request, id):
    """Standalone view for marking payment schedule as paid"""
    if request.method != "POST":
        return JsonResponse({'error': 'Invalid request method'}, status=405)
    
    try:
        print("=== MARK AS PAID CALLED ===")
        
        schedule = PaymentSchedule.objects.get(id=id)
        data = json.loads(request.body)
        # Safe defaults to prevent UnboundLocalError in response
        from decimal import Decimal as _Dec
        covered_schedules = 0
        try:
            total_advance_applied = _Dec('0.00')
        except Exception:
            total_advance_applied = 0
        
        # Accept both keys; default to scheduled amortization (principal + interest)
        received_amnt = data.get('received_amount')
        if received_amnt is None:
            received_amnt = data.get('received_amnt', schedule.payment_amount)
        or_number = data.get('or_number')
        loan_type = data.get('loan_type')
        is_advance = bool(data.get('is_advance', False))
        
        print(f"Schedule ID: {schedule.id}")
        print(f"OR Number: {or_number}")
        print(f"Loan Type: {loan_type}")
        
        # ✅ STEP 1: VALIDATE FIRST - BEFORE ANY DATABASE CHANGES
        if not or_number:
            print("❌ OR number is required")
            return JsonResponse({'error': 'OR number is required'}, status=400)
        
        if len(str(or_number).strip()) != 4:
            print(f"❌ Invalid OR length: {len(str(or_number).strip())}")
            return JsonResponse({'error': 'Valid 4-digit OR number is required'}, status=400)
        
        # --- OR reuse policy (per-day/per-loan-type for Loan schedules) ---
        from .models import LoanYearlyRecalculation
        account = schedule.loan.account
        member = account.account_holder
        # Use provided date if any, else today
        try:
            check_date = timezone.datetime.strptime(str(data.get('date_paid')), '%Y-%m-%d').date() if data.get('date_paid') else timezone.now().date()
        except Exception:
            check_date = timezone.now().date()

        # Used by other member anywhere? -> BLOCK
        used_by_other_schedule = PaymentSchedule.objects.filter(or_number=or_number, is_paid=True).exclude(loan__account=account).exists()
        used_by_other_tracker = ORNumberTracker.objects.filter(or_number=or_number).exclude(member=member).exists()
        used_in_fees_any = LoanYearlyRecalculation.objects.filter(fees_or_number=or_number, fees_paid=True).exists()
        if used_by_other_schedule or used_by_other_tracker or used_in_fees_any:
            print(f"❌ OR {or_number} used by another member or in fees")
            return JsonResponse({'error': f'OR number {or_number} is already in use and cannot be reused.'}, status=400)

        # Same member, different day? -> BLOCK
        tracker = ORNumberTracker.objects.filter(member=member, or_number=or_number).first()
        tracker_diff_day = bool(tracker) and (tracker.first_used_date.date() != check_date)
        same_member_prev_day_schedule = PaymentSchedule.objects.filter(or_number=or_number, is_paid=True, loan__account=account).exclude(date_paid=check_date).exists()
        if tracker_diff_day or same_member_prev_day_schedule:
            print(f"❌ OR {or_number} used on a different day for this member")
            return JsonResponse({'error': f'OR number {or_number} was used on a different day. Reuse across days is not allowed.'}, status=400)

        # If the same member already used this OR today, allow reuse across all categories
        # (Regular, Emergency, Advance, Withdrawal, Yearly Fees) on the same date.
        # Only enforce same-day same-type blocking if OR has NOT been used today.
        tracker_same_day = bool(tracker) and (tracker.first_used_date.date() == check_date)
        if not tracker_same_day:
            # Same member, same day, same loan type? -> BLOCK
            same_day_same_type = PaymentSchedule.objects.filter(
                loan__account=account,
                loan__loan_type=schedule.loan.loan_type,
                or_number=or_number,
                is_paid=True,
                date_paid=check_date
            ).exclude(id=schedule.id).exists()

            # Cross-category reuse (e.g., yearly fees) on same day? -> BLOCK
            used_fees_same_day = LoanYearlyRecalculation.objects.filter(fees_or_number=or_number, fees_paid=True, fees_paid_date=check_date).exists()

            if same_day_same_type or used_fees_same_day:
                print(f"❌ OR {or_number} already used today for same loan type or fees")
                return JsonResponse({'error': f'OR number {or_number} cannot be reused for the same loan type or category on the same day.'}, status=400)
        
        print(f"✅ All validations passed")
        
        # Check if OR already used for this specific member's loan type
        # existing_or = PaymentSchedule.objects.filter(
        #     or_number=or_number,
        #     loan__account=schedule.loan.account,
        #     loan__loan_type=schedule.loan.loan_type,
        #     is_paid=True  # ✅ Only check PAID schedules
        # ).exclude(id=schedule.id).exists()
        
        # if existing_or:
        #     print(f"❌ OR {or_number} already used")
        #     return JsonResponse({
        #         'error': f'OR number {or_number} has already been used for this member\'s {schedule.loan.loan_type} loan. Please use a different OR number.'
        #     }, status=400)
        
        # print(f"✅ All validations passed")
        
        # ✅ STEP 2: ONLY NOW process the payment (validation PASSED)
        try:
            with transaction.atomic():
                print(f"📦 Starting transaction...")
                year_collapse_shift = 0
                loan_settled = False
                
                # Refresh from DB to get latest state
                schedule.refresh_from_db()
                
                # Penalty is auto-applied in queryset via apply_penalty(); avoid double-charging here
                # Only ensure any overdue penalty is set via the existing mechanism if still zero
                today = timezone.now().date()
                if schedule.due_date < today and not schedule.is_paid and schedule.penalty == Decimal('0.00'):
                    try:
                        print(f"📌 Ensuring penalty set for overdue schedule (no double-deduction)")
                        schedule.apply_penalty()
                    except Exception:
                        pass
                
                # ✅ Process payment calculations WITHOUT saving
                print(f"💳 Processing payment: {received_amnt}")
                received_amnt = Decimal(received_amnt)
                if received_amnt <= 0:
                    raise ValueError("Received amount must be greater than zero.")
                
                # Amount due to mark the amortization as paid (penalty handled separately)
                amort_due = schedule.payment_amount

                print(f"Amortization due (principal+interest): {amort_due}")
                print(f"Received amount: {received_amnt}")
                
                # ✅ FIX: Add floating-point tolerance (0.01 = 1 cent)
                TOLERANCE = Decimal('0.01')
                difference = abs(received_amnt - amort_due)

                if not is_advance:
                    if received_amnt + TOLERANCE >= amort_due:
                        # ✅ Full amortization covered (allow tiny diff)
                        schedule.advance_pay += max(Decimal('0.00'), received_amnt - amort_due)
                        schedule.under_pay = Decimal('0.00')
                        schedule.is_paid = True
                        print(f"✅ Full amortization paid: is_paid=True")
                    else:
                        # Underpayment of amortization
                        underpayment = (amort_due - received_amnt).quantize(Decimal('0.01'))
                        schedule.under_pay = underpayment
                        schedule.advance_pay = Decimal('0.00')
                        schedule.is_paid = False
                        print(f"❌ Partial amortization: is_paid=False, under_pay={underpayment}")
                else:
                    # Explicit advance mode: do not change paid state of current schedule
                    schedule.is_paid = schedule.is_paid  # keep current state
                
                # ✅ Set OR number and loan_type
                schedule.or_number = or_number
                if not schedule.loan_type and loan_type:
                    schedule.loan_type = loan_type
                
                # ✅ SAVE NOW with update_fields (after all in-memory changes, inside transaction)
                # Ensure date_paid is recorded when marking as paid
                if schedule.is_paid and not schedule.date_paid:
                    schedule.date_paid = timezone.now().date()
                print(f"💾 Saving schedule with OR: {or_number}, is_paid: {schedule.is_paid}")
                schedule.save(update_fields=[
                    'is_paid',
                    'loan_type',
                    'or_number',
                    'penalty',
                    'advance_pay',
                    'under_pay',
                    'date_paid'
                ])
                
                # Update loan status
                print(f"📊 Updating loan status...")
                schedule.loan.update_status_based_on_schedules()

                # ✅ Deduct principal from loan.remaining_principal when schedule is paid
                if schedule.is_paid:
                    try:
                        loan = schedule.loan
                        new_remaining = (Decimal(loan.remaining_principal) - Decimal(schedule.principal_amount)).quantize(Decimal('0.01'))
                        if new_remaining < Decimal('0.00'):
                            new_remaining = Decimal('0.00')
                        loan.remaining_principal = new_remaining
                        loan.save(update_fields=['remaining_principal'])
                    except Exception as e:
                        logger.warning(f"Failed to update loan remaining_principal after payment: {e}")

                # ✅ NEW: If received amount exceeds amortization due, apply extra towards remaining principal
                try:
                    # In advance mode, apply the whole amount to principal chain
                    if is_advance or (received_amnt > amort_due):
                        extra = (received_amnt if is_advance else (received_amnt - amort_due)).quantize(Decimal('0.01'))
                        if extra > Decimal('0.00'):
                            loan = schedule.loan
                            # Fetch unpaid schedules after the current one
                            unpaid_schedules = PaymentSchedule.objects.filter(
                                loan=loan, is_paid=False
                            ).order_by('due_date')

                            remaining_extra = extra
                            covered_ids_for_event = []
                            for us in unpaid_schedules:
                                if remaining_extra <= Decimal('0.00'):
                                    break
                                amort_before = Decimal(us.payment_amount or 0).quantize(Decimal('0.01'))
                                base_principal = Decimal(us.principal_amount or 0)
                                if base_principal <= Decimal('0.00'):
                                    continue
                                # Amount to reduce on this schedule
                                reduce_amt = min(base_principal, remaining_extra)
                                new_principal = (base_principal - reduce_amt).quantize(Decimal('0.01'))
                                us.principal_amount = new_principal
                                # Recompute payment_amount = principal + interest_portion
                                us.payment_amount = (new_principal + Decimal(us.interest_portion or 0)).quantize(Decimal('0.01'))
                                # Update running balances
                                try:
                                    rb = Decimal(us.remaining_balance or us.balance or loan.remaining_principal)
                                except Exception:
                                    rb = Decimal(loan.remaining_principal)
                                rb = (rb - reduce_amt).quantize(Decimal('0.01'))
                                if rb < Decimal('0.00'):
                                    rb = Decimal('0.00')
                                us.remaining_balance = rb
                                us.balance = rb
                                # Preserve original_principal floor if missing
                                if not us.original_principal:
                                    us.original_principal = schedule.original_principal or loan.principal
                                # If this schedule is now fully covered (no principal and no interest), mark paid
                                try:
                                    ip = Decimal(us.interest_portion or 0)
                                except Exception:
                                    ip = Decimal('0.00')
                                if new_principal <= Decimal('0.00') and ip <= Decimal('0.00'):
                                    us.is_paid = True
                                    if not us.date_paid:
                                        us.date_paid = timezone.now().date()
                                    us.under_pay = Decimal('0.00')
                                    us.or_number = or_number
                                    us.save(update_fields=['principal_amount', 'payment_amount', 'remaining_balance', 'balance', 'original_principal', 'is_paid', 'date_paid', 'under_pay'])
                                    covered_schedules += 1
                                    covered_ids_for_event.append(us.id)
                                    total_advance_applied = (total_advance_applied + amort_before).quantize(Decimal('0.01'))
                                else:
                                    us.save(update_fields=['principal_amount', 'payment_amount', 'remaining_balance', 'balance', 'original_principal'])
                                remaining_extra = (remaining_extra - reduce_amt).quantize(Decimal('0.01'))

                            # Finally, deduct extra from loan.remaining_principal
                            try:
                                loan_remaining = Decimal(loan.remaining_principal or 0)
                                loan_remaining = (loan_remaining - extra).quantize(Decimal('0.01'))
                                if loan_remaining < Decimal('0.00'):
                                    loan_remaining = Decimal('0.00')
                                loan.remaining_principal = loan_remaining
                                loan.save(update_fields=['remaining_principal'])
                            except Exception as _e:
                                logger.warning(f"Failed to deduct advance extra from loan remaining_principal: {_e}")

                            # Reschedule remaining unpaid schedules to start 15 days from today
                            try:
                                start_date = timezone.now().date() + timezone.timedelta(days=15)
                                day_step = timezone.timedelta(days=15)
                                idx = 0
                                for us in unpaid_schedules:
                                    # Skip ones just marked paid above
                                    if us.is_paid:
                                        continue
                                    us.due_date = start_date + (day_step * idx)
                                    us.save(update_fields=['due_date'])
                                    idx += 1
                            except Exception as _e:
                                logger.warning(f"Failed to reschedule unpaid schedules after advance payment: {_e}")

                            # Record advance payment in payment history
                            try:
                                from .models import PaymentHistory
                                PaymentHistory.objects.create(
                                    account_number=loan.account.account_number,
                                    control_number=str(loan.control_number),
                                    loan_type=loan.loan_type,
                                    payment_amount=extra,
                                    payment_date=timezone.now().date(),
                                    or_number=or_number,
                                    status='Paid',
                                    archived_loan=False
                                )
                            except Exception as _e:
                                logger.warning(f"Failed to save advance payment history: {_e}")

                            # Create a PaymentEvent for advance so Payments.jsx can display it
                            try:
                                from .models import PaymentEvent
                                event_due_date = None
                                if covered_ids_for_event:
                                    first_cov = PaymentSchedule.objects.filter(id__in=covered_ids_for_event).order_by('due_date').first()
                                    if first_cov:
                                        event_due_date = first_cov.due_date
                                event = PaymentEvent.objects.create(
                                    loan=loan,
                                    schedule=None,
                                    mode='pay_ahead',
                                    curtailment_method='',
                                    or_number=or_number,
                                    amount_total=total_advance_applied,
                                    amount_regular=Decimal('0.00'),
                                    amount_pay_ahead=total_advance_applied,
                                    amount_curtailment=Decimal('0.00'),
                                    covered_schedule_ids=covered_ids_for_event,
                                    notes='Recorded via standalone mark_as_paid advance',
                                    due_date=event_due_date,
                                    created_by=None
                                )
                                if covered_ids_for_event:
                                    PaymentSchedule.objects.filter(id__in=covered_ids_for_event).update(advance_event=event)
                            except Exception as _e:
                                logger.warning(f"Failed to record PaymentEvent (standalone) for advance: {_e}")
                except Exception as e:
                    logger.warning(f"Advance payment redistribution failed: {e}")

                # ✅ YEAR COLLAPSE: Disabled — preserve original year_number labels
                # Do not renumber years when prior years are fully paid. This keeps
                # Year 1, Year 2, Year 3, Year 4 stable for UI grouping.
                try:
                    loan = schedule.loan
                    shift_years = 0
                    # Intentionally no changes to year_number on unpaid schedules.
                    # Any recalculation cleanup should be handled by dedicated endpoints.
                except Exception as e:
                    logger.warning(f"Year tracking noop failed: {e}")

                # ✅ FINALIZE: If remaining principal is now zero, mark loan fully paid and close remaining schedules
                try:
                    loan = schedule.loan
                    rp = Decimal(loan.remaining_principal or 0).quantize(Decimal('0.01'))
                    if rp <= Decimal('0.00'):
                        if settle_loan_if_zero(loan):
                            loan_settled = True
                except Exception as e:
                    logger.warning(f"Failed to finalize loan settlement at zero remaining principal: {e}")
                
                print(f"✅ Transaction committed")
            
            print(f"✅ Payment marked as paid successfully")
            # Fetch latest yearly recalculation snapshot (if any) to show recalculated fees
            latest_recalc = None
            try:
                latest_recalc = LoanYearlyRecalculation.objects.filter(loan=schedule.loan).order_by('-year').first()
            except Exception:
                latest_recalc = None

            status_msg = 'Advance payment successful.' if is_advance else 'Payment processed successfully.'
            if loan_settled:
                status_msg = 'Congratulations! Loan fully paid.'
            return JsonResponse({
                'status': status_msg,
                'or_number': or_number,
                'is_paid': schedule.is_paid,
                'collapsed_years': year_collapse_shift,
                'loan_settled': loan_settled,
                'advance_applied': str(total_advance_applied),
                'advance_covered_count': covered_schedules,
                'updated_schedule': {
                    'id': schedule.id,
                    'principal_amount': str(schedule.principal_amount),
                    'interest_portion': str(schedule.interest_portion),
                    'payment_amount': str(schedule.payment_amount),
                    'is_covered_by_advance': schedule.is_covered_by_advance,
                    'advance_pay': str(schedule.advance_pay),
                    'date_paid': schedule.date_paid.isoformat() if schedule.date_paid else None,
                },
                'yearly_recalculation': ({
                    'year': latest_recalc.year,
                    'previous_balance': str(latest_recalc.previous_balance),
                    'service_fee': str(latest_recalc.service_fee),
                    'interest_amount': str(latest_recalc.interest_amount),
                    'admincost': str(latest_recalc.admincost),
                    'notarial': str(latest_recalc.notarial),
                    'cisp': str(latest_recalc.cisp),
                    'total_fees_due': str(latest_recalc.total_fees_due),
                    'new_bimonthly_amortization': str(latest_recalc.new_bimonthly_amortization),
                    'fees_paid': latest_recalc.fees_paid
                } if latest_recalc else None)
            }, status=200)
        
        except Exception as e:
            print(f"❌ Error in transaction: {str(e)}")
            import traceback
            traceback.print_exc()
            return JsonResponse(
                {'error': f'Error processing payment: {str(e)}'}, 
                status=500
            )
    
    except PaymentSchedule.DoesNotExist:
        print("❌ Schedule not found")
        return JsonResponse({'error': 'Payment schedule not found.'}, status=404)
    
    except json.JSONDecodeError:
        print("❌ Invalid JSON")
        return JsonResponse({'error': 'Invalid JSON payload'}, status=400)
    
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)
# def mark_as_paid(request, id):
#     #Thursday
#     if request.method != "POST":
#         return JsonResponse({'error': 'Invalid request method'}, status=405)
    
#     try:
#         print("=== MARK AS PAID CALLED ===")    
#         schedule = PaymentSchedule.objects.get(id=id)
#         data = json.loads(request.body)
#         received_amount = data.get('received_amount', schedule.balance)
#         account_number = data.get('account_number', schedule.balance)
#         or_number = data.get('or_number')

#         schedule.process_payment(schedule.balance)
#         schedule.or_number = or_number
#         schedule.save()
        
#         schedule.save(update_fields=[
#             'is_paid', 
#             'or_number', 
#             'loan_type',
#             'balance', 
#             'penalty', 
#             'advance_pay', 
#             'under_pay', 
#             'remaining_balance'
#         ])

#         # ✅ Verify it was saved
#         schedule.refresh_from_db()
#         print(f"After save - schedule.loan_type: {schedule.loan_type}")
#         print(f"After save - schedule.or_number: {schedule.or_number}")

#         return JsonResponse({'status': 'Payment processed and marked as paid.'}, status=status.HTTP_200_OK)
#     except PaymentSchedule.DoesNotExist:
#         return JsonResponse({'error': 'Payment schedule not found.'}, status=status.HTTP_404_NOT_FOUND)


def update_loan_status(loan):
    unpaid_count = loan.paymentschedule_set.filter(is_paid=False).count()

    if unpaid_count == 0:
        loan.status = 'Settled'
        loan.archived = True
    else:
        loan.status = 'Ongoing'

    loan.save()


    
class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
       

       
        schedule = PaymentSchedule.objects.get(id=request.data['schedule_id'])
        if schedule:
            schedule.is_paid = True
            schedule.status = 'Paid'
            schedule.save()
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
def update(self, request, *args, **kwargs):
    partial = kwargs.pop('partial', False)
    instance = self.get_object()

    # Get OR value
    or_value = request.data.get('OR')
    if or_value:
        instance.OR = or_value
        instance.save()

    serializer = self.get_serializer(instance, data=request.data, partial=partial)
    serializer.is_valid(raise_exception=True)
    self.perform_update(serializer)

    return Response(serializer.data)



@api_view(['GET'])
def get_payments(request, control_number):
    try:
        control_number_uuid = UUID(control_number)  

        # Log the control_number_uuid to check if it's correct
        logger.info(f"Fetching payments for Loan with Control Number: {control_number_uuid}")

        loan = Loan.objects.get(control_number=control_number_uuid)

        # Ensure the loan is associated with the logged-in member's account
        if loan.account.account_holder.user != request.user:
            return Response({"error": "You do not have permission to view payments for this loan."}, status=status.HTTP_403_FORBIDDEN)

        payments = Payment.objects.filter(payment_schedule__loan=loan)
        if payments.exists():
            serializer = PaymentSerializer(payments, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        else:
            return Response({"error": "No payments found for this loan."}, status=status.HTTP_404_NOT_FOUND)
    
    except Loan.DoesNotExist:
        return Response({"error": "Loan not found."}, status=status.HTTP_404_NOT_FOUND)
    
    except ValueError:
        return Response({"error": "Invalid UUID format."}, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.error(f"Error fetching payments: {str(e)}")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




class ActiveLoansByAccountView(APIView):
    def get(self, request, account_number):
        loans = Loan.objects.filter(account__account_number=account_number)
        print(f"Loans found: {loans}")

        active_loans_data = []
        payment_schedules_data = []

        for loan in loans:
            schedules = PaymentSchedule.objects.filter(loan=loan)
            active = False
            schedule_data = []
            for schedule in schedules:
                if not schedule.is_paid:
                    active = True
                    schedule_data.append(PaymentScheduleSerializer(schedule).data)

            if active:
                active_loans_data.append(LoanSerializer(loan).data)
                payment_schedules_data.append(schedule_data)

        if active_loans_data:
            return Response({
                'active_loans': active_loans_data,
                'payment_schedules': payment_schedules_data
            })
        else:
            return Response({"message": "No active loans found."}, status=status.HTTP_404_NOT_FOUND)

        # (Removed stray nested apply_year_interest helper)



@api_view(['POST'])
def update_breakdown(request):
    """
    Update payment schedule breakdown with flexible payment amounts.
    ✅ ENFORCES 4-YEAR MAXIMUM based on CALCULATED payments from remaining principal
    """
    loan_control_number = request.data.get('loan_control_number')
    shorten_to = request.data.get('shorten_to')
    
    if loan_control_number is not None and shorten_to is not None:
        loan_cn = str(loan_control_number).strip()
        if not loan_cn:
            return Response({"error": "loan_control_number is required"}, status=400)

        try:
            shorten_to = int(shorten_to)
        except Exception:
            return Response({"error": "shorten_to must be an integer"}, status=400)
        
        if shorten_to < 1:
            return Response({"error": "shorten_to must be >= 1"}, status=400)

        raw_new_amount = request.data.get('new_amount', None)
        
        try:
            with transaction.atomic():
                # Fetch the loan
                loan = Loan.objects.filter(control_number=loan_cn).first()
                if not loan:
                    return Response({"error": "Loan not found for given control number"}, status=404)

                # ✅ Set maximum schedules based on loan type
                if loan.loan_type == 'Regular':
                    MAX_SCHEDULES = 96  # 4 years × 12 months × 2 (bi-monthly)
                elif loan.loan_type == 'Emergency':
                    MAX_SCHEDULES = 12  # 6 months × 2 (bi-monthly)
                else:
                    MAX_SCHEDULES = 96  # Default

                unpaid = PaymentSchedule.objects.filter(
                    loan=loan,
                    is_paid=False
                ).order_by('due_date').select_for_update()

                if not unpaid.exists():
                    return Response({"error": "No unpaid schedules for this loan"}, status=404)

                first = unpaid.first()
                current_total = unpaid.aggregate(total=Sum('principal_amount'))['total'] or Decimal('0.00')
                
                if current_total <= 0:
                    return Response({"error": "No remaining principal to redistribute"}, status=400)

                floor = first.original_principal or loan.principal
                if floor is None or floor <= 0:
                    return Response({"error": "Cannot determine original principal floor."}, status=400)

                # ✅ Calculate how many PAID schedules exist
                paid_count = PaymentSchedule.objects.filter(loan=loan, is_paid=True).count()

                # Determine per-payment principal amount
                if raw_new_amount is not None:
                    try:
                        per_amount = Decimal(str(raw_new_amount))
                    except Exception:
                        return Response({"error": "Invalid new_amount"}, status=400)
                    
                    if per_amount <= 0:
                        return Response({"error": "new_amount must be greater than zero"}, status=400)
                    
                    # ✅ Validate against remaining principal
                    if per_amount > current_total:
                        return Response({
                            "error": f"Principal per payment (₱{per_amount:,.2f}) cannot exceed total remaining principal (₱{current_total:,.2f})."
                        }, status=400)
                    
                    if per_amount < floor:
                        return Response({
                            "error": f"Per-payment principal cannot be lower than floor (₱{floor:,.2f})."
                        }, status=400)
                    
                    # ✅ CRITICAL: Calculate actual number of payments this amount would create
                    calculated_payments = math.ceil(float(current_total) / float(per_amount))
                    
                    # ✅ Use the SMALLER of requested vs calculated
                    # This prevents creating more payments than the remaining balance supports
                    shorten_to = min(shorten_to, calculated_payments)
                    
                else:
                    # Equal split
                    per_amount = (current_total / Decimal(shorten_to)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    
                    if per_amount < floor:
                        return Response({
                            "error": f"Requested number of payments would make per-payment principal (₱{per_amount:,.2f}) lower than floor (₱{floor:,.2f})."
                        }, status=400)

                # ✅ NOW check if TOTAL schedules (paid + calculated unpaid) would exceed maximum
                total_schedules_after_update = paid_count + shorten_to
                
                if total_schedules_after_update > MAX_SCHEDULES:
                    schedules_available = MAX_SCHEDULES - paid_count
                    years_paid = paid_count / 24  # How many years worth paid
                    
                    return Response({
                        "error": f"Cannot exceed {MAX_SCHEDULES} total schedules ({loan.loan_type} loan maximum). You have already paid {paid_count} schedules ({years_paid:.1f} years). Maximum remaining schedules: {schedules_available}. This breakdown would create {shorten_to} schedules.",
                        "details": {
                            "loan_type": loan.loan_type,
                            "max_total_schedules": MAX_SCHEDULES,
                            "paid_schedules": paid_count,
                            "calculated_unpaid": shorten_to,
                            "total_would_be": total_schedules_after_update,
                            "max_remaining_allowed": schedules_available,
                            "remaining_principal": str(current_total),
                            "principal_per_payment": str(per_amount)
                        }
                    }, status=400)

                # ✅ Build allocation (rest of the logic remains the same)
                desired_count = int(shorten_to)
                n_existing = unpaid.count()
                amounts = []
                remaining = current_total
                
                for i in range(desired_count):
                    if i < desired_count - 1:
                        amt = min(per_amount, remaining)
                        if amt < Decimal('0.00'):
                            amt = Decimal('0.00')
                        amounts.append(amt.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
                        remaining = (remaining - amt).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    else:
                        # Last one gets remainder
                        final_amt = max(Decimal('0.00'), remaining).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                        amounts.append(final_amt)
                        remaining = Decimal('0.00')

                # ✅ Verify total matches
                allocated_total = sum(amounts)
                if abs(allocated_total - current_total) > Decimal('0.01'):
                    return Response({
                        "error": f"Distribution mismatch: allocated ₱{allocated_total:,.2f} vs remaining ₱{current_total:,.2f}"
                    }, status=500)

                # Update existing schedules
                k = min(desired_count, n_existing)
                updated = []
                
                for idx, sched in enumerate(unpaid[:k]):
                    amt = amounts[idx]
                    sched.principal_amount = amt
                    sched.payment_amount = (sched.principal_amount + sched.interest_portion).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    sched.save(update_fields=['principal_amount', 'payment_amount'])
                    updated.append(sched)

                # Create new schedules if needed
                created_count = 0
                if desired_count > n_existing:
                    paid_count_current = PaymentSchedule.objects.filter(loan=loan, is_paid=True).count()
                    last_due_date = unpaid.last().due_date if unpaid.exists() else loan.loan_date
                    floor_original = first.original_principal or loan.principal or Decimal('0.00')

                    for idx in range(n_existing, desired_count):
                        amt = amounts[idx]
                        if amt <= Decimal('0.00'):
                            continue
                        
                        position = paid_count_current + idx
                        year_number = (position // 24) + 1
                        
                        # ✅ Double-check year doesn't exceed maximum
                        max_year = 4 if loan.loan_type == 'Regular' else 1
                        if year_number > max_year:
                            print(f"⚠️ Skipping schedule creation - would create Year {year_number} (max {max_year})")
                            continue
                        
                        due_date = last_due_date + timedelta(days=(idx - n_existing + 1) * 15)

                        new_sched = PaymentSchedule(
                            loan=loan,
                            principal_amount=amt,
                            advance_pay=Decimal('0.00'),
                            under_pay=Decimal('0.00'),
                            received_amnt=Decimal('0.00'),
                            payment_amount=Decimal('0.00'),
                            penalty=Decimal('0.00'),
                            penalty_collected=False,
                            due_date=due_date,
                            balance=Decimal('0.00'),
                            remaining_balance=Decimal('0.00'),
                            or_number=None,
                            is_paid=False,
                            loan_type=loan.loan_type,
                            original_principal=floor_original,
                            year_number=year_number,
                        )
                        new_sched.save()
                        updated.append(new_sched)
                        created_count += 1

                # Delete excess schedules if shortening
                deleted_count = 0
                if n_existing > desired_count:
                    to_delete_ids = list(unpaid.values_list('id', flat=True))[desired_count:]
                    if to_delete_ids:
                        deleted_count = PaymentSchedule.objects.filter(id__in=to_delete_ids, is_paid=False).delete()[0]

                # Recalculate penalties for overdue
                today = timezone.now().date()
                for s in updated:
                    if s.due_date < today and not s.is_paid:
                        s.penalty = (s.payment_amount * Decimal('0.02')).quantize(Decimal('0.01'))
                        s.save(update_fields=['penalty'])

                # Resequence due dates and balances
                try:
                    paid_count_final = PaymentSchedule.objects.filter(loan=loan, is_paid=True).count()
                except Exception:
                    paid_count_final = 0
                
                unpaid_refreshed = PaymentSchedule.objects.filter(loan=loan, is_paid=False).order_by('due_date')
                running_balance = current_total
                
                for i, s in enumerate(unpaid_refreshed):
                    new_idx = paid_count_final + i
                    s.due_date = loan.loan_date + timedelta(days=(new_idx + 1) * 15)
                    s.year_number = (new_idx // 24) + 1
                    
                    running_balance = (running_balance - s.principal_amount).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    if running_balance < Decimal('0.00'):
                        running_balance = Decimal('0.00')
                    
                    s.balance = running_balance
                    s.remaining_balance = running_balance
                    s.save(update_fields=['due_date', 'year_number', 'balance', 'remaining_balance'])

                # Update loan remaining principal
                new_total = unpaid_refreshed.aggregate(total=Sum('principal_amount'))['total'] or Decimal('0.00')
                
                if abs(new_total - current_total) > Decimal('0.01'):
                    return Response({
                        "error": f"Final distribution mismatch: {new_total} vs original {current_total}"
                    }, status=500)

                # ✅ Persist the UPDATED remaining principal (sum of unpaid principal after redistribution)
                loan.remaining_principal = new_total
                loan.save(update_fields=['remaining_principal'])

                # Cleanup stale recalculations
                try:
                    from .models import LoanYearlyRecalculation
                    total_paid = PaymentSchedule.objects.filter(loan=loan, is_paid=True).count()
                    total_unpaid = len(updated)
                    total_kept = total_paid + total_unpaid
                    max_year = (total_kept + 23) // 24 if total_kept > 0 else 0
                    
                    if max_year >= 0:
                        deleted_recalc = LoanYearlyRecalculation.objects.filter(loan=loan, year__gt=max_year).delete()[0]
                        if deleted_recalc:
                            logger.info(f"Deleted {deleted_recalc} stale yearly recalculation record(s) beyond year {max_year}")
                except Exception as _e:
                    logger.warning(f"Failed to cleanup recalculation years: {_e}")

                return Response({
                    'status': 'success',
                    'mode': 'all_years',
                    'shorten_to': desired_count,
                    'requested_shorten_to': request.data.get('shorten_to'),  # Show original request
                    'calculated_from_remaining': desired_count,  # Show what was actually used
                    'schedules_updated': len(updated),
                    'schedules_deleted': deleted_count,
                    'schedules_created': created_count,
                    'totals': {
                        'before_total': str(current_total),
                        'after_total': str(new_total),
                        'per_payment': str(per_amount)
                    },
                    'schedules': [
                        {
                            'id': s.id,
                            'due_date': str(s.due_date),
                            'year_number': s.year_number,
                            'principal_amount': str(s.principal_amount),
                            'interest_portion': str(s.interest_portion),
                            'payment_amount': str(s.payment_amount)
                        } for s in unpaid_refreshed
                    ]
                }, status=200)
                
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=500)

   
    schedules_id = request.data.get('schedules_id', [])
    distribution_mode = (request.data.get('distribution_mode') or '').strip().lower()

    # New: consolidation into fixed number of payments (e.g., 2)
    consolidate_to = request.data.get('consolidate_to', None)
    lock_year_group = bool(request.data.get('lock_year_group', False))
    year_number = request.data.get('year_number', None)  # ✅ NEW: Year being edited
    split = request.data.get('split', {}) or {}

    if consolidate_to:
        try:
            consolidate_to = int(consolidate_to)
        except Exception:
            return Response({"error": "consolidate_to must be an integer"}, status=400)
        if consolidate_to < 1:
            return Response({"error": "consolidate_to must be >= 1"}, status=400)
        if not schedules_id:
            return Response({"error": "Missing schedules_id"}, status=400)
        try:
            with transaction.atomic():
                payment_schedules = PaymentSchedule.objects.filter(
                    id__in=schedules_id,
                    is_paid=False
                ).order_by('due_date').select_for_update()
                if not payment_schedules.exists():
                    return Response({"error": "No matching unpaid schedules found"}, status=404)

                first_schedule = payment_schedules.first()
                loan = first_schedule.loan

                if lock_year_group:
                    years = set(payment_schedules.values_list('year_number', flat=True))
                    if len(years) != 1:
                        return Response({"error": "Selected schedules must be within the same year group."}, status=400)

                # Compute totals and floor
                current_total = payment_schedules.aggregate(total=Sum('principal_amount'))['total'] or Decimal('0.00')
                if current_total <= 0:
                    return Response({"error": "No remaining principal to consolidate"}, status=400)
                floor = first_schedule.original_principal or loan.principal
                if floor is None or floor <= 0:
                    return Response({"error": "Cannot determine original principal floor."}, status=400)

                # Determine amounts for consolidation
                first_amount_req = split.get('first_amount', None)
                if first_amount_req is not None:
                    try:
                        first_amount = Decimal(str(first_amount_req))
                    except Exception:
                        return Response({"error": "Invalid split.first_amount"}, status=400)
                else:
                    # fallback to new_amount if provided, else half split
                    raw_na = request.data.get('new_amount', None)
                    if raw_na is not None:
                        try:
                            first_amount = Decimal(str(raw_na))
                        except Exception:
                            return Response({"error": "Invalid new_amount"}, status=400)
                    else:
                        first_amount = (current_total / Decimal(consolidate_to)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

                # Clamp first_amount between floor and current_total
                if first_amount < floor:
                    first_amount = floor
                if first_amount > current_total:
                    first_amount = current_total

                updates = []
                if consolidate_to == 1:
                    # Put entire total on the last schedule
                    only = payment_schedules.last()
                    for s in payment_schedules:
                        if s.id == only.id:
                            s.principal_amount = current_total
                        else:
                            s.principal_amount = Decimal('0.00')
                        s.payment_amount = (s.principal_amount + s.interest_portion).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                        s.save(update_fields=['principal_amount', 'payment_amount'])
                        updates.append(s)
                elif consolidate_to == 2:
                    first_s = payment_schedules.first()
                    last_s = payment_schedules.last()
                    second_amount = (current_total - first_amount).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    # Allow second_amount to be lower than floor if necessary to absorb remainder
                    if second_amount < Decimal('0.00'):
                        second_amount = Decimal('0.00')
                    for s in payment_schedules:
                        if s.id == first_s.id:
                            s.principal_amount = first_amount
                        elif s.id == last_s.id:
                            s.principal_amount = second_amount
                        else:
                            s.principal_amount = Decimal('0.00')
                        s.payment_amount = (s.principal_amount + s.interest_portion).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                        s.save(update_fields=['principal_amount', 'payment_amount'])
                        updates.append(s)
                else:
                    # General case: distribute across N anchors, zero others
                    anchors = list(payment_schedules[:consolidate_to])
                    remaining = current_total
                    per = (current_total / Decimal(consolidate_to)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    for idx, s in enumerate(payment_schedules):
                        if s in anchors[:-1]:
                            amt = min(per, remaining)
                            if amt < floor:
                                amt = floor if remaining >= floor else remaining
                            s.principal_amount = amt
                            remaining -= amt
                        elif s == anchors[-1]:
                            amt = remaining.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                            if amt < Decimal('0.00'):
                                amt = Decimal('0.00')
                            s.principal_amount = amt
                            remaining = Decimal('0.00')
                        else:
                            s.principal_amount = Decimal('0.00')
                        s.payment_amount = (s.principal_amount + s.interest_portion).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                        s.save(update_fields=['principal_amount', 'payment_amount'])
                        updates.append(s)

                return Response({
                    'status': 'success',
                    'consolidated': consolidate_to,
                    'schedules': [
                        {
                            'id': s.id,
                            'due_date': str(s.due_date),
                            'year_number': s.year_number,
                            'principal_amount': str(s.principal_amount),
                            'interest_portion': str(s.interest_portion),
                            'payment_amount': str(s.payment_amount)
                        } for s in updates
                    ],
                    'totals': {
                        'before_total': str(current_total),
                        'after_total': str(sum(s.principal_amount for s in updates))
                    }
                })
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    # New modes: uniform / proportional. Legacy path if not provided.
    if distribution_mode in ('uniform', 'proportional'):
        if not schedules_id:
            return Response({"error": "Missing schedules_id"}, status=400)
        try:
            with transaction.atomic():
                payment_schedules = PaymentSchedule.objects.filter(
                    id__in=schedules_id,
                    is_paid=False
                ).order_by('due_date').select_for_update()
                if not payment_schedules.exists():
                    return Response({"error": "No matching unpaid schedules found"}, status=404)

                first_schedule = payment_schedules.first()
                loan = first_schedule.loan
                current_total = payment_schedules.aggregate(total=Sum('principal_amount'))['total'] or Decimal('0.00')
                if current_total <= 0:
                    return Response({"error": "No remaining principal to redistribute"}, status=400)
                floor = first_schedule.original_principal or loan.principal
                if floor is None or floor <= 0:
                    return Response({"error": "Cannot determine original principal floor."}, status=400)
                TOL = Decimal('0.01')
                updated = []

                if distribution_mode == 'uniform':
                    raw_amount = request.data.get('new_amount', None)
                    if raw_amount is None:
                        return Response({"error": "new_amount is required for uniform distribution"}, status=400)
                    try:
                        per_amount = Decimal(str(raw_amount))
                    except Exception:
                        return Response({"error": "Invalid new_amount format"}, status=400)
                    if per_amount < floor:
                        return Response({"error": f"Per-schedule amount cannot be lower than floor (₱{floor:,.2f})."}, status=400)

                    n = payment_schedules.count()
                    target_total = (per_amount * n).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    running_total = Decimal('0.00')

                    for idx, s in enumerate(payment_schedules, start=1):
                        if idx < n:
                            s.principal_amount = per_amount
                            running_total += per_amount
                        else:
                            last_amt = (target_total - running_total).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                            s.principal_amount = max(last_amt, (s.original_principal or floor))
                            running_total += s.principal_amount
                        s.payment_amount = (s.principal_amount + s.interest_portion).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                        s.save(update_fields=['principal_amount', 'payment_amount'])
                        updated.append(s)

                    new_total = sum(s.principal_amount for s in updated)
                    totals_note = None
                    if abs(new_total - target_total) > TOL:
                        totals_note = f"Total principal adjusted due to rounding/floors: {new_total} vs target {target_total}"

                else:  # proportional
                    raw_total = request.data.get('new_total', None)
                    if raw_total is None:
                        return Response({"error": "new_total is required for proportional distribution"}, status=400)
                    try:
                        new_total = Decimal(str(raw_total))
                    except Exception:
                        return Response({"error": "Invalid new_total format"}, status=400)
                    if new_total <= 0:
                        return Response({"error": "new_total must be greater than zero"}, status=400)

                    scale = (new_total / current_total) if current_total > 0 else Decimal('0')
                    running_total = Decimal('0.00')
                    n = payment_schedules.count()

                    for idx, s in enumerate(payment_schedules, start=1):
                        base = s.principal_amount
                        proposed = (base * scale).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                        proposed = max(proposed, (s.original_principal or floor))
                        if idx < n:
                            s.principal_amount = proposed
                            running_total += proposed
                        else:
                            last_amt = (new_total - running_total).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                            s.principal_amount = max(last_amt, (s.original_principal or floor))
                            running_total += s.principal_amount
                        s.payment_amount = (s.principal_amount + s.interest_portion).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                        s.save(update_fields=['principal_amount', 'payment_amount'])
                        updated.append(s)

                    final_total = sum(s.principal_amount for s in updated)
                    totals_note = None
                    if abs(final_total - new_total) > TOL:
                        totals_note = f"Total principal adjusted due to rounding/floors: {final_total} vs target {new_total}"

                # Optional: update penalty for overdue schedules after changes
                today = timezone.now().date()
                for s in updated:
                    if s.due_date < today and not s.is_paid:
                        s.penalty = (s.payment_amount * Decimal('0.02')).quantize(Decimal('0.01'))
                        s.save(update_fields=['penalty'])

                return Response({
                    'status': 'success',
                    'distribution_mode': distribution_mode,
                    'schedules': [
                        {
                            'id': s.id,
                            'due_date': str(s.due_date),
                            'principal_amount': str(s.principal_amount),
                            'interest_portion': str(s.interest_portion),
                            'payment_amount': str(s.payment_amount)
                        } for s in updated
                    ],
                    'totals': {
                        'before_total': str(current_total),
                        'after_total': str(sum(s.principal_amount for s in updated)),
                        'note': totals_note
                    }
                })
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    # Legacy path (unchanged behavior)
    new_amount = request.data.get('new_amount', None)

    if not schedules_id or new_amount is None:
        return Response({"error": "Missing schedules_id or new_amount"}, status=400)

    try:
        new_amount = Decimal(str(new_amount))
    except Exception:
        return Response({"error": "Invalid amount format"}, status=400)

    if new_amount <= 0:
        return Response({"error": "New amount must be greater than zero"}, status=400)

    try:
        with transaction.atomic():
            # ✅ Get unpaid schedules in order
            payment_schedules = PaymentSchedule.objects.filter(
                id__in=schedules_id, 
                is_paid=False
            ).order_by('due_date').select_for_update()
        
            if not payment_schedules.exists():
                return Response({"error": "No matching unpaid schedules found"}, status=404)

            # ✅ Get the first schedule for validation
            first_schedule = payment_schedules.first()
            loan = first_schedule.loan
            
            # ✅ Get original breakdown (minimum allowed principal)
            original_principal = first_schedule.original_principal
            if original_principal is None:
                # If not set, use the loan's fixed principal
                original_principal = loan.principal
            
            if original_principal is None or original_principal <= 0:
                return Response({"error": "Cannot determine original principal amount."}, status=400)

            # ✅ VALIDATION 1: Cannot be lower than original principal
            if new_amount < original_principal:
                return Response({
                    "error": f"Breakdown amount (₱{new_amount:,.2f}) cannot be lower than the original principal (₱{original_principal:,.2f})."
                }, status=400)

            # ✅ Calculate TOTAL remaining principal (sum of principal_amount from unpaid schedules)
            total_remaining_principal = payment_schedules.aggregate(
                total=Sum('principal_amount')
            )['total'] or Decimal('0.00')
            
            if total_remaining_principal <= 0:
                return Response({"error": "No remaining principal to redistribute"}, status=400)

            # ✅ VALIDATION 2: Cannot exceed total remaining principal
            TOLERANCE = Decimal('0.01')
            if new_amount > total_remaining_principal + TOLERANCE:
                return Response({
                    "error": f"Amount (₱{new_amount:,.2f}) exceeds total remaining principal (₱{total_remaining_principal:,.2f})."
                }, status=400)

            # ✅ Get the interest portion (should be same for all schedules in same year)
            interest_per_payment = first_schedule.interest_portion

            # ✅ Calculate distribution
            num_schedules = payment_schedules.count()
            first_due_date = first_schedule.due_date
            interval_days = 15
            
            updated_schedules = []
            running_principal_balance = loan.remaining_principal or total_remaining_principal
            
            # ✅ Scenario 1: Single payment (consolidate all into one)
            if abs(new_amount - total_remaining_principal) <= TOLERANCE:
                # Update first schedule
                first_schedule.principal_amount = total_remaining_principal
                first_schedule.payment_amount = total_remaining_principal + interest_per_payment
                first_schedule.balance = running_principal_balance
                first_schedule.remaining_balance = running_principal_balance
                first_schedule.due_date = first_due_date
                first_schedule.original_principal = original_principal  # Preserve original
                
                # ✅ CRITICAL: Use update_fields to prevent calculate_payment_amount() override
                first_schedule.save(update_fields=[
                    'principal_amount', 
                    'payment_amount', 
                    'balance', 
                    'remaining_balance', 
                    'due_date',
                    'original_principal'
                ])
                
                updated_schedules.append(first_schedule)
                
                # Delete remaining schedules
                deleted_count = payment_schedules.exclude(id=first_schedule.id).delete()[0]
                print(f"   Deleted {deleted_count} schedules, consolidated into 1")
                
            # ✅ Scenario 2: Multiple payments
            else:
                # Calculate remaining after first payment
                remaining_after_first = total_remaining_principal - new_amount
                schedules_after_first = num_schedules - 1
                
                if schedules_after_first == 0:
                    return Response({
                        "error": "Cannot create partial payment with only one schedule."
                    }, status=400)
                
                # Amount per remaining schedule
                principal_per_schedule = (remaining_after_first / schedules_after_first).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
                
                running_total = Decimal('0.00')
                
                # Distribute amounts
                for idx, schedule in enumerate(payment_schedules):
                    if idx == 0:
                        # First schedule gets new_amount
                        principal_to_assign = new_amount
                    elif idx == num_schedules - 1:
                        # Last schedule gets remainder (handles rounding)
                        principal_to_assign = total_remaining_principal - running_total
                    else:
                        # Middle schedules get equal distribution
                        principal_to_assign = principal_per_schedule
                    
                    # Ensure amount is positive
                    if principal_to_assign <= 0:
                        schedule.delete()
                        continue
                    
                    # Update schedule
                    schedule.principal_amount = principal_to_assign
                    schedule.payment_amount = principal_to_assign + interest_per_payment
                    
                    # Update balance (running principal balance)
                    running_principal_balance = running_principal_balance - principal_to_assign
                    if running_principal_balance < Decimal('0.00'):
                        running_principal_balance = Decimal('0.00')
                    
                    schedule.balance = running_principal_balance
                    schedule.remaining_balance = running_principal_balance
                    
                    # Update due date
                    if idx == 0:
                        schedule.due_date = first_due_date
                    else:
                        schedule.due_date = updated_schedules[-1].due_date + timedelta(days=interval_days)
                    
                    # Preserve original principal
                    if not schedule.original_principal:
                        schedule.original_principal = original_principal
                    
                    # ✅ CRITICAL: Save with update_fields
                    schedule.save(update_fields=[
                        'principal_amount',
                        'payment_amount',
                        'balance',
                        'remaining_balance',
                        'due_date',
                        'original_principal'
                    ])
                    
                    updated_schedules.append(schedule)
                    running_total += principal_to_assign
            
            # ✅ RECALCULATE PENALTIES for overdue schedules
            today = timezone.now().date()
            for schedule in updated_schedules:
                if schedule.due_date < today and not schedule.is_paid:
                    # Recalculate penalty based on new payment amount
                    penalty_amount = (schedule.payment_amount * Decimal('0.02')).quantize(Decimal('0.01'))
                    schedule.penalty = penalty_amount
                    schedule.save(update_fields=['penalty'])
            
            # ✅ Verify totals match
            total_distributed = sum(s.principal_amount for s in updated_schedules)
            if abs(total_distributed - total_remaining_principal) > TOLERANCE:
                raise ValueError(f"Distribution mismatch: {total_distributed} vs {total_remaining_principal}")
            
            # Update loan's remaining principal
            loan.remaining_principal = running_principal_balance
            loan.save(update_fields=['remaining_principal'])

            return Response({
                "message": "Payment schedules updated successfully",
                "total_remaining_principal": float(total_remaining_principal),
                "first_payment_principal": float(new_amount),
                "interest_per_payment": float(interest_per_payment),
                "first_payment_total": float(new_amount + interest_per_payment),
                "schedules_updated": len(updated_schedules),
                "breakdown": [
                    {
                        "schedule_id": s.id,
                        "principal": float(s.principal_amount),
                        "interest": float(s.interest_portion),
                        "total_payment": float(s.payment_amount),
                        "due_date": s.due_date.strftime('%Y-%m-%d')
                    }
                    for s in updated_schedules
                ]
            }, status=200)

    except PaymentSchedule.DoesNotExist:
        return Response({"error": "One or more schedules not found"}, status=404)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response(
            {"error": f"Error updating breakdown: {str(e)}"}, 
            status=500
        )


#allen
@api_view(['POST'])
def revert_to_original_schedule(request):
    print("Reverted to original") #Debugging ah ah
    schedules_id = request.data.get('schedules_id', [])

    if not schedules_id:
        return Response({"error": "Missing schedules_id"}, status=400)

    payment_schedules = PaymentSchedule.objects.filter(id__in=schedules_id)

    if not payment_schedules.exists():
        return Response({"error": "No matching schedules found"}, status=404)

    for schedule in payment_schedules:
        if schedule.original_principal is not None:
            schedule.payment_amount = schedule.original_principal
            schedule.principal_amount = schedule.original_principal
            schedule.save()
            print(f"Schedule {schedule.id} reverted: payment_amount={schedule.payment_amount}, principal_amount={schedule.principal_amount}")

    return Response({"message": "Reverted to original schedule successfully"}, status=200)
#/allen

@api_view(['GET'])
def payment_schedules_by_loan(request, loan_control_number):
    try:
        payment_schedules = PaymentSchedule.objects.filter(loan__control_number=loan_control_number)
        serializer = PaymentScheduleSerializer(payment_schedules, many=True)
        return Response(serializer.data)
    except PaymentSchedule.DoesNotExist:
        return Response({"error": "Payment schedules not found for this loan"}, status=404)
       


class MemberLoanListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        member = request.user.member
        loans = Loan.objects.filter(account__account_holder=member)
        serializer = LoanSerializer(loans, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
class PaymentListView(APIView):
    def get(self, request, loan_id, format=None):
        
        try:
            loan = Loan.objects.get(control_number=loan_id)
            payments = Payment.objects.filter(loan=loan)
            serializer = PaymentSerializer(payments, many=True)
            return Response(serializer.data)
        except Loan.DoesNotExist:
            return Response({"error": "Loan not found"}, status=status.HTTP_404_NOT_FOUND)

class AccountDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        account = Account.objects.filter(account_holder=request.user).first()
        
        if not account:
            return Response({"detail": "Account not found."}, status=404)
        
        
        account_serializer = AccountSerializer(account)
        
       
        transactions = Ledger.objects.filter(account_number=account)
        ledger_serializer = LedgerSerializer(transactions, many=True)

        return Response({
            "account": account_serializer.data,
            "transactions": ledger_serializer.data
        })


class LoanSummaryView(APIView):
    def get(self, request):
        
        active_borrowers = Loan.objects.filter(status='Ongoing').values('member').distinct().count()
        paid_off_borrowers = Loan.objects.filter(status='Settled').values('member').distinct().count()

        
        total_received = Loan.objects.aggregate(Sum('loan_amount'))['loan_amount__sum'] or 0
        total_returned = Payment.objects.aggregate(Sum('amount_paid'))['amount_paid__sum'] or 0
        # service_fees = Loan.objects.aggregate(Sum('service_fee'))['service_fee__sum'] or 0
        penalties = Loan.objects.aggregate(Sum('penalty_fee'))['penalty_fee__sum'] or 0
        profit = (total_received - total_returned)  + penalties

        
        ongoing_loans = Loan.objects.filter(status='Ongoing').count()
        completed_loans = Loan.objects.filter(status='Settled').count()
        

        
        total_payment_schedules = PaymentSchedule.objects.aggregate(Sum('amount_due'))['amount_due__sum'] or 0

        
        total_loans_count = Loan.objects.count()
        total_payments_count = Payment.objects.count()
        
        data = {
            'borrowers': {
                'active': active_borrowers,
                'paidOff': paid_off_borrowers,
            },
            'netTotalLoan': {
                'received': total_received,
                'returned': total_returned,
                'profit': profit,
                'penalties': penalties,
            },
            'loans': {
                'ongoing': ongoing_loans,
                'completed': completed_loans,
                
            },
            'paymentSchedules': total_payment_schedules,
            'totalLoansCount': total_loans_count,
            'totalPaymentsCount': total_payments_count,
        }

        return Response(data)

from django.http import JsonResponse
from .models import Loan
from django.db.models import Sum

from django.db.models import Sum
from django.http import JsonResponse
from .models import Loan

def loan_summary(request):
    active_borrowers = Loan.objects.filter(status='Ongoing').values('account__account_number').distinct().count()
    paid_off_borrowers = Loan.objects.filter(status='Settled').values('account__account_number').distinct().count()

    total_net_loan = Loan.objects.aggregate(
        total_loan=Sum('loan_amount')
    )['total_loan'] or 0  

    ongoing_loans = Loan.objects.filter(status='Ongoing').count()
    completed_loans = Loan.objects.filter(status='Settled').count()

  
    data = {
        'borrowers': {
            'active': active_borrowers,
            'paidOff': paid_off_borrowers
        },
        'netTotalLoan': {
            'returned': total_net_loan, 
            'profit': 0  
        },
        'loans': {
            'ongoing': ongoing_loans,
            'completed': completed_loans,
        }
    }

    return JsonResponse(data)



class AccountTransactionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, account_number):
        try:
            
            account = Account.objects.get(account_number=account_number)

            if request.user.is_staff:
                transactions = Ledger.objects.filter(account_number=account).order_by('-timestamp')
            elif request.user == account.account_holder.user:
                transactions = Ledger.objects.filter(account_number=account).order_by('-timestamp')
            else:
                return Response({'error': 'You do not have permission to view this ledger.'}, status=status.HTTP_403_FORBIDDEN)

            serializer = LedgerSerializer(transactions, many=True)
            return Response({'transactions': serializer.data})

        except Account.DoesNotExist:
            return Response({'error': 'Account not found'}, status=status.HTTP_404_NOT_FOUND)

class UserListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_staff:  
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        users = User.objects.all()
        data = [{'id': user.id, 'username': user.username, 'email': user.email} for user in users]
        return Response(data)

class ResetPasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not request.user.is_staff:  
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        try:
            user = User.objects.get(id=pk)
            new_password = request.data.get('password')
            if not new_password:
                return Response({'error': 'Password is required'}, status=status.HTTP_400_BAD_REQUEST)
            user.password = make_password(new_password)
            user.save()
            return Response({'message': 'Password reset successful'})
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Payment
from .serializers import PaymentSerializer

class MemberPaymentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Access the Member profile associated with the authenticated user
            member = request.user.member_profile
            # Get the Account linked to the Member
            account = member.accountN
            # Get the account number
            account_number = account.account_number

            # Fetch payments related to the account number and check for 'Paid' status in Loan
            payments = Payment.objects.filter(
                payment_schedule__loan__account__account_number=account_number,
                payment_schedule__loan__status="Paid"  # Correctly check status in Loan model
            ).select_related('payment_schedule', 'payment_schedule__loan')

            # Serialize the payments and return the response
            serializer = PaymentSerializer(payments, many=True)
            return Response(serializer.data)

        except AttributeError:
            # Handle case where the user doesn't have a linked Member profile or Account
            return Response({'error': 'User does not have an associated member profile or account.'}, status=400)



# @api_view(['GET'])
# def get_payments_by_schedule(request, schedule_id):
#     try:
#         # Fetch the PaymentSchedule by ID
#         payment_schedule = PaymentSchedule.objects.get(id=schedule_id)

#         # Fetch all payments linked to this PaymentSchedule
#         payments = Payment.objects.filter(payment_schedule=payment_schedule)

#         if payments.exists():
#             # Serialize the payments data and send the response
#             serializer = PaymentSerializer(payments, many=True)
#             return Response(serializer.data)
#         else:
#             return Response({"error": "No payments found for this schedule."}, status=status.HTTP_404_NOT_FOUND)
    
#     except PaymentSchedule.DoesNotExist:
#         return Response({"error": "Payment schedule not found."}, status=status.HTTP_404_NOT_FOUND)
# @api_view(['GET'])
# def get_payments_by_schedule(request, schedule_id):
#     try:
#         # Fetch the payment schedule by ID
#         payment_schedule = PaymentSchedule.objects.get(id=schedule_id)
        
#         # Get all payments associated with this schedule
#         payments = Payment.objects.filter(payment_schedule=payment_schedule)
        
#         if payments.exists():
#             serializer = PaymentSerializer(payments, many=True)
#             return Response(serializer.data, status=status.HTTP_200_OK)
#         else:
#             return Response({"error": "No payments found for this payment schedule."}, status=status.HTTP_404_NOT_FOUND)
#     except PaymentSchedule.DoesNotExist:
#         return Response({"error": "Payment schedule not found."}, status=status.HTTP_404_NOT_FOUND)
class PaymentListByScheduleView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, payment_schedule_id, *args, **kwargs):
        try:
            # Get the logged-in user's account
            user_account = request.user.account

            # Get the PaymentSchedule by its ID
            payment_schedule = PaymentSchedule.objects.get(id=payment_schedule_id)

            # Check if the PaymentSchedule belongs to the logged-in user's loan
            if payment_schedule.loan.account != user_account:
                return Response({"detail": "You do not have permission to view these payments."}, status=status.HTTP_403_FORBIDDEN)

            # If the user is authorized, fetch the payments associated with the schedule
            payments = Payment.objects.filter(payment_schedule=payment_schedule)
            serializer = PaymentSerializer(payments, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        except PaymentSchedule.DoesNotExist:
            return Response({"detail": "Payment schedule not found."}, status=status.HTTP_404_NOT_FOUND)
        except Loan.DoesNotExist:
            return Response({"detail": "Loan not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
@api_view(['GET'])
def get_payments_by_schedule(request, paymentScheduleId):
    try:
        # Get the payments associated with the given paymentScheduleId
        payments = Payment.objects.filter(payment_schedule_id=paymentScheduleId)
        serializer = PaymentSerializer(payments, many=True)
        return Response(serializer.data)
    except PaymentSchedule.DoesNotExist:
        return Response({"error": "Payment schedule not found"}, status=status.HTTP_404_NOT_FOUND)
    



class PaymentsByAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Extract the account_number from query params
        account_number = request.query_params.get('account_number', None)
        
        if not account_number:
            return Response({"error": "Account number is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Get the member related to the logged-in user
            user = request.user
            member = user.member_profile  # Ensure the correct relationship
            if not member:
                return Response({"error": "No member found for this user."}, status=status.HTTP_404_NOT_FOUND)

            # Get the account associated with the member
            account = member.accountN  # Adjusted: use correct related_name to Account
            if not account:
                return Response({"error": "No account found for this member."}, status=status.HTTP_404_NOT_FOUND)

            if account.account_number != account_number:
                return Response({"error": "Account number does not match member's account."}, status=status.HTTP_400_BAD_REQUEST)

            # Filter payments based on the account number
            payments = Payment.objects.filter(payment_schedule__loan__account__account_number=account_number)
            
            # If no payments found
            if not payments.exists():
                return Response({"error": "No payments found for this account."}, status=status.HTTP_404_NOT_FOUND)

            # Serialize the payments and return the data
            serializer = PaymentSerializer(payments, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        except AttributeError:
            return Response({"error": "Account or Member not found for this user."}, status=status.HTTP_404_NOT_FOUND)
        
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import AuditLog
from .serializers import AuditLogSerializer

class LogActionAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data
        user = request.user.username  # Get username from the authenticated user
        action_type = data.get('action_type')
        description = data.get('description')

        if not action_type or not description:
            return Response({"error": "Both action_type and description are required."}, status=400)

        # Create audit log
        AuditLog.objects.create(user=user, action_type=action_type, description=description)
        return Response({"message": "Action logged successfully."})

class GetAuditLogsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        logs = AuditLog.objects.all().order_by('-timestamp')  # Sort by latest
        serializer = AuditLogSerializer(logs, many=True)
        return Response(serializer.data)

class WithdrawView(APIView):
    def post(self, request, account_number):
        try:
            account = Account.objects.get(account_number=account_number)
            amount = request.data.get('amount')
            or_number = (request.data.get('or_number') or '').strip()
            date_str = request.data.get('date')  # optional YYYY-MM-DD

            if not amount or float(amount) <= 0:
                return Response({'message': 'Invalid amount'}, status=status.HTTP_400_BAD_REQUEST)

            # ✅ OR policy: Block reuse by other members or reuse on different day
            if or_number:
                from .models import LoanYearlyRecalculation
                member = account.account_holder
                today = None
                try:
                    today = timezone.datetime.strptime(date_str, '%Y-%m-%d').date() if date_str else timezone.now().date()
                except Exception:
                    today = timezone.now().date()

                # Block if used by other members anywhere
                used_by_other_schedule = PaymentSchedule.objects.filter(or_number=or_number, is_paid=True).exclude(loan__account=account).exists()
                used_in_tracker_by_other = ORNumberTracker.objects.filter(or_number=or_number).exclude(member=member).exists()
                used_in_fees_by_other = LoanYearlyRecalculation.objects.filter(fees_or_number=or_number, fees_paid=True).exclude(loan__account=account).exists()
                if used_by_other_schedule or used_in_tracker_by_other or used_in_fees_by_other:
                    return Response({'message': f'OR {or_number} is already used by another member and cannot be reused'}, status=status.HTTP_400_BAD_REQUEST)

                # Block if same member used on a different day
                tracker = ORNumberTracker.objects.filter(member=member, or_number=or_number).first()
                if tracker and tracker.first_used_date.date() != today:
                    return Response({'message': f'OR {or_number} was previously used on a different day and cannot be reused'}, status=status.HTTP_400_BAD_REQUEST)

            account.withdraw(amount, or_number=or_number)
            return Response({'message': 'Withdrawal successful', 'account': str(account)}, status=status.HTTP_200_OK)
        except Account.DoesNotExist:
            return Response({'message': 'Account not found'}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as e:
            return Response({'message': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UpdateStatusView(View):
    def post(self, request, account_number):
        try:
            account = Account.objects.get(account_number=account_number)
            if account.status == 'inactive':
                return JsonResponse({'message': 'Account is already inactive'}, status=400)
            account.status = 'inactive'
            account.save()
            return JsonResponse({'message': 'Account status updated to inactive'}, status=200)
        except Account.DoesNotExist:
            return JsonResponse({'message': 'Account not found'}, status=404)

def archive_account(request, account_id):
    if request.method == "POST":
        account = get_object_or_404(Account, id=account_id)
        
        # Archive the account data
        archived_data = {
            'account_number': account.account_number,
            'account_holder': {
                'first_name': account.account_holder.first_name,
                'middle_name': account.account_holder.middle_name,
                'last_name': account.account_holder.last_name,
            },
            'shareCapital': account.shareCapital,
            'status': account.status,
        }
        
        # Create an archived record
        ArchivedAccount.objects.create(
            archive_type='Account',
            archived_data=archived_data
        )

        # Soft delete by setting status to 'archived'
        account.status = 'archived'
        account.save()

        return JsonResponse({'message': 'Account successfully archived'})
    

@api_view(['DELETE'])
def delete_account(request, account_number):
    try:
        account = Account.objects.get(account_number=account_number)
        account.delete()
        return JsonResponse({'message': 'Account deleted successfully!'}, status=200)
    except Account.DoesNotExist:
        return JsonResponse({'message': 'Account not found!'}, status=404)

class ArchiveView(View):
    def post(self, request):
        data = json.loads(request.body)
        archive_type = data.get('archive_type')
        archived_data = data.get('archived_data')

        if archive_type == 'Account':
            Archive.objects.create(archive_type=archive_type, archived_data=archived_data)
            account_id = archived_data.get('id') 
            account = Account.objects.filter(id=account_id).first()
            if account:
                account.archived = True
                account.save()
                member = account.account_holder
                if member:
                    print(f"Archiving member {member.memId}")  # Debug log
                    member.archive()
            return JsonResponse({'message': 'Account and member archived successfully.'})

        return JsonResponse({'error': 'Invalid archive type.'}, status=400)

def get_members(request):
    members = list(Member.objects.values("id", "name"))  # Convert QuerySet to list
    return JsonResponse({"members": members})

@api_view(['POST'])
def mark_schedule_paid(request, pk):
    try:
        schedule = PaymentSchedule.objects.get(pk=pk)
        schedule.is_paid = True
        schedule.save()

        loan = schedule.loan
        all_paid = PaymentSchedule.objects.filter(loan=loan).exclude(is_paid=True).count() == 0

        if all_paid:
            loan.status = "Settled"
            loan.is_archived = True
            loan.save()

            PaymentSchedule.objects.filter(loan=loan).update(is_archived=True)

            member = loan.member
            # Check if all loans of this member are paid
            member_loans = Loan.objects.filter(member=member)
            if all(loan.status == 'Settled' for loan in member_loans):
                member.is_archived = True
                member.save()

        return Response({"message": "Payment successful and archive checked."})
    except PaymentSchedule.DoesNotExist:
        return Response({"error": "Schedule not found"}, status=404)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def re_admit_member(request, mem_id):
    try:
        print("Re-Admit triggered for mem_id:", mem_id)

        return Response({"message": "Test success."}, status=200)

    except Exception as e:
        print("Error:", str(e))
        return Response({"error": str(e)}, status=400)
        


def create_archive(request):
    archive_type = request.data.get('archive_type')
    archived_data = request.data.get('archived_data')
    
    if not archive_type or not archived_data:
        return Response(
            {"error": "Both archive_type and archived_data are required."}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        with transaction.atomic():
            # Check for duplicates based on archive type
            if archive_type == 'Loan':
                control_number = archived_data.get('control_number')
                if control_number:
                    existing_archive = Archive.objects.filter(
                        archive_type='Loan',
                        archived_data__control_number=control_number
                    ).first()
                    
                    if existing_archive:
                        return Response(
                            {"error": f"Loan with control number {control_number} is already archived."}, 
                            status=status.HTTP_409_CONFLICT
                        )
            
            elif archive_type == 'Member':
                mem_id = archived_data.get('memId') or archived_data.get('member_id') or archived_data.get('id')
                if mem_id:
                    existing_archive = Archive.objects.filter(
                        archive_type='Member',
                        archived_data__memId=mem_id
                    ).first()
                    
                    if existing_archive:
                        return Response(
                            {"error": f"Member with ID {mem_id} is already archived."}, 
                            status=status.HTTP_409_CONFLICT
                        )
            
            elif archive_type == 'Account':
                account_number = archived_data.get('account_number')
                if account_number:
                    existing_archive = Archive.objects.filter(
                        archive_type='Account',
                        archived_data__account_number=account_number
                    ).first()
                    
                    if existing_archive:
                        return Response(
                            {"error": f"Account {account_number} is already archived."}, 
                            status=status.HTTP_409_CONFLICT
                        )
            
            # Create new archive if no duplicate found
            archive = Archive.objects.create(
                archive_type=archive_type,
                archived_data=archived_data
            )
            
            return Response(
                {
                    "message": f"{archive_type} archived successfully",
                    "archive_id": archive.id
                }, 
                status=status.HTTP_201_CREATED
            )
            
    except Exception as e:
        return Response(
            {"error": f"Error creating archive: {str(e)}"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# Also add a method to check for existing archives
def check_archive_exists(request):
    archive_type = request.GET.get('archive_type')
    control_number = request.GET.get('control_number')
    
    if archive_type == 'Loan' and control_number:
        exists = Archive.objects.filter(
            archive_type='Loan',
            archived_data__control_number=control_number
        ).exists()
        
        return Response({"exists": exists}, status=status.HTTP_200_OK)
    
    return Response({"error": "Invalid parameters"}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def archive_payment_record(request):
    """Archive a payment record when it's marked as paid"""
    try:
        payment_data = request.data
        
        # Create archived payment record
        archived_payment = ArchivedPayment.objects.create(
            account_number=payment_data.get('account_number'),
            account_holder=payment_data.get('account_holder'),
            payment_amount=payment_data.get('payment_amount'),
            loan_type=payment_data.get('loan_type'),
            loan_control_number=payment_data.get('loan_control_number'),
            date_paid=payment_data.get('date_paid'),
            or_number=payment_data.get('or_number'),
            payment_type=payment_data.get('payment_type', 'Schedule Payment'),
            archived_by=request.user
        )
        
        return Response({
            'success': True,
            'message': 'Payment archived successfully',
            'archived_id': archived_payment.id
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_archived_payment_records(request):
    """Get all archived payment records"""
    try:
        qs = ArchivedPayment.objects.all().order_by('-date_paid')
        acct = request.GET.get('account_number')
        loan_cn = request.GET.get('loan_control_number')
        loan_type = request.GET.get('loan_type')
        if acct:
            qs = qs.filter(account_number=acct)
        if loan_type:
            qs = qs.filter(loan_type=loan_type)
        if loan_cn:
            qs = qs.filter(loan_control_number=loan_cn)
        archived_payments = qs
        
        payment_data = []
        for payment in archived_payments:
            payment_data.append({
                'id': payment.id,
                'account_number': payment.account_number,
                'account_holder': payment.account_holder,
                'payment_amount': float(payment.payment_amount),
                'loan_type': payment.loan_type,
                'loan_control_number': payment.loan_control_number,
                'date_paid': payment.date_paid,
                'or_number': payment.or_number,
                'payment_type': payment.payment_type,
                'archived_at': payment.archived_at
            })
        
        return Response(payment_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_archived_payment_record(request, payment_id):
    """Delete an archived payment record"""
    try:
        payment = ArchivedPayment.objects.get(id=payment_id)
        payment.delete()
        
        return Response({
            'success': True,
            'message': 'Archived payment deleted successfully'
        }, status=status.HTTP_200_OK)
        
    except ArchivedPayment.DoesNotExist:
        return Response({
            'error': 'Archived payment not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.contrib.auth import authenticate
from django.contrib.auth.models import User

class AdminProfileView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request):
        """Get current admin profile"""
        user = request.user
        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email or '',  # Return empty string if no email
            'is_superuser': user.is_superuser,
            'is_staff': user.is_staff,
        })
    
    def put(self, request):
        """Update admin profile"""
        user = request.user
        username = request.data.get('username')
        email = request.data.get('email', '').strip()  # Get email, default to empty string
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')
        
        try:
            # Validate username uniqueness
            if username and username != user.username:
                if User.objects.filter(username=username).exists():
                    return Response(
                        {'error': 'Username already exists'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                user.username = username
            
            # Validate email uniqueness (only if provided)
            if email:
                if email != user.email:
                    if User.objects.filter(email=email).exclude(id=user.id).exists():
                        return Response(
                            {'error': 'Email already exists'}, 
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    user.email = email
            else:
                # Allow clearing email
                user.email = ''
            
            # Handle password change
            if new_password:
                if not current_password:
                    return Response(
                        {'error': 'Current password required to change password'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Verify current password
                if not user.check_password(current_password):
                    return Response(
                        {'error': 'Current password is incorrect'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Validate new password length
                if len(new_password) < 8:
                    return Response(
                        {'error': 'New password must be at least 8 characters'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Set new password
                user.set_password(new_password)
            
            user.save()
            
            return Response({
                'message': 'Profile updated successfully',
                'username': user.username,
                'email': user.email,
            })
            
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
# recently lang

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_employment_status(request, mem_id):
    """
    Change a member's employment_status to 'Employed' or 'Outsider'.
    """
    status_value = request.data.get('employment_status')
    if status_value not in ['Employed', 'Outsider']:
        return Response({'error': "Invalid employment_status. Must be 'Employed' or 'Outsider'."}, status=400)
    try:
        member = Member.objects.get(memId=mem_id)
        member.employment_status = status_value
        member.save(update_fields=['employment_status'])
        return Response({'memId': member.memId, 'employment_status': member.employment_status}, status=200)
    except Member.DoesNotExist:
        return Response({'error': 'Member not found.'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500) 
    # recently lang ends
@api_view(['POST'])
def save_payment_history(request):
    """Save payment to permanent history"""
    serializer = PaymentHistorySerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# In views.py
@api_view(['GET'])
def get_payment_history(request, account_number):
    """Get complete payment history (both active and archived)"""
    try:
        # Get archived payments
        archived_payments = ArchivedPayment.objects.filter(
            account_number=account_number
        ).order_by('-date_paid')

        # Get active payments
        active_payments = PaymentSchedule.objects.filter(
            loan__account__account_number=account_number,
            is_paid=True
        ).order_by('-due_date')

        # Combine both sources
        all_payments = []
        
        # Add archived payments
        all_payments.extend([{
            'loan_type': payment.loan_type,
            'payment_amount': payment.payment_amount,
            'payment_date': payment.date_paid,
            'or_number': payment.or_number,
            'status': 'Paid'
        } for payment in archived_payments])

        # Add active payments 
        all_payments.extend([{
            'loan_type': payment.loan.loan_type,
            'payment_amount': payment.payment_amount,
            'payment_date': payment.due_date,
            'or_number': payment.or_number,
            'status': 'Paid'
        } for payment in active_payments])

        return Response(all_payments)
    except Exception as e:
        return Response({'error': str(e)}, status=400)
    
@api_view(['GET'])
def get_total_fees_breakdown(request):
    """
    Calculate total fees collected from all loans with breakdown
    """
    try:
        loans = Loan.objects.all()
        
        # Sum up all fee types
        total_service_fee = loans.aggregate(Sum('service_fee'))['service_fee__sum'] or 0
        total_interest = loans.aggregate(Sum('interest_amount'))['interest_amount__sum'] or 0
        total_admin_cost = loans.aggregate(Sum('admincost'))['admincost__sum'] or 0
        total_notarial = loans.aggregate(Sum('notarial'))['notarial__sum'] or 0
        total_cisp = loans.aggregate(Sum('cisp'))['cisp__sum'] or 0
        
        # Calculate total
        total_fees = (
            total_service_fee + 
            total_interest + 
            total_admin_cost + 
            total_notarial + 
            total_cisp
        )
        
        return Response({
            'total_fees': float(total_fees),
            'breakdown': {
                'service_fee': float(total_service_fee),
                'interest_amount': float(total_interest),
                'admin_cost': float(total_admin_cost),
                'notarial': float(total_notarial),
                'cisp': float(total_cisp)
            }
        })
    except Exception as e:
        return Response({
            'error': str(e),
            'total_fees': 0,
            'breakdown': {
                'service_fee': 0,
                'interest_amount': 0,
                'admin_cost': 0,
                'notarial': 0,
                'cisp': 0
            }
        }, status=500)

@api_view(['GET'])
def get_active_members_count(request):
    active_members = Member.objects.filter(is_active=True).count()
    return Response({
        'active_members_count': active_members,
        'status': 'success'
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_or_number(request):
    """
    Check OR number usage with per-day, per-loan-type allowance for Loan category.
    Rules:
    - Block if used by another member (any category, any day).
    - For the same member:
      * Block if previously used on a different day.
      * Allow reuse on the same day only once per loan type (i.e., 1 Regular + 1 Emergency).
      * Block reuse on the same day within the same loan type.
    - Cross-category reuse (e.g., fees/withdrawals) is not allowed.
    """
    or_number = request.query_params.get('or_number')
    account_number = request.query_params.get('account_number')
    category = (request.query_params.get('category') or 'Loan').strip()  # Loan | Deposit | Withdrawal
    loan_type = (request.query_params.get('loan_type') or '').strip()     # Regular | Emergency (for Loan)
    date_str = request.query_params.get('date_paid')  # optional ISO date (YYYY-MM-DD)

    if not or_number or not account_number:
        return Response({'error': 'OR number and account number are required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Resolve member from account
        account = Account.objects.get(account_number=account_number)
        member = account.account_holder

        # Parse date context
        try:
            check_date = timezone.datetime.strptime(date_str, '%Y-%m-%d').date() if date_str else timezone.now().date()
        except Exception:
            check_date = timezone.now().date()

        # Imports to check other categories
        from .models import LoanYearlyRecalculation

        # --- Used by other member anywhere? -> BLOCK ---
        used_by_other_schedule = PaymentSchedule.objects.filter(or_number=or_number, is_paid=True).exclude(loan__account__account_number=account_number).exists()
        used_by_other_tracker = ORNumberTracker.objects.filter(or_number=or_number).exclude(member=member).exists()
        used_in_fees_any = LoanYearlyRecalculation.objects.filter(fees_or_number=or_number, fees_paid=True).exists()
        is_used_by_others = used_by_other_schedule or used_by_other_tracker or used_in_fees_any

        # --- Same member, different day? -> BLOCK ---
        tracker = ORNumberTracker.objects.filter(member=member, or_number=or_number).first()
        tracker_used_on_different_day = bool(tracker) and (tracker.first_used_date.date() != check_date)

        same_member_prev_day_schedule = PaymentSchedule.objects.filter(
            or_number=or_number,
            is_paid=True,
            loan__account__account_number=account_number
        ).exclude(date_paid=check_date).exists()

        is_used_same_member_different_day = tracker_used_on_different_day or same_member_prev_day_schedule

        # --- Same member, same day, same loan type? -> BLOCK ---
        is_used_same_member_same_loan_type_today = False
        if category == 'Loan' and loan_type:
            is_used_same_member_same_loan_type_today = PaymentSchedule.objects.filter(
                loan__account__account_number=account_number,
                loan__loan_type=loan_type,
                or_number=or_number,
                is_paid=True,
                date_paid=check_date
            ).exists()

        # --- Cross-category reuse: allow for same member on same day across Loan / Advance / Withdrawal / Fees
        # We only block cross-category reuse when the OR was used by the same member on a different day
        # or when it's already used today for the same loan type (can't use same OR twice for one loan type)
        used_today_by_same_member = PaymentSchedule.objects.filter(
            loan__account__account_number=account_number,
            or_number=or_number,
            is_paid=True,
            date_paid=check_date
        ).exists() or LoanYearlyRecalculation.objects.filter(fees_or_number=or_number, fees_paid=True, fees_paid_date=check_date).exists()

        # Allow special override for advance checks: front-end can pass is_advance=1 to indicate
        # the OR is being used for an advance payment. In that case, we do NOT block
        # reuse merely because the same loan_type was used today (advance is a separate category).
        is_advance_flag = str(request.query_params.get('is_advance') or '').lower() in ('1','true','yes')

        # Final availability according to rules:
        # - Block if used by other members anywhere
        # - Block if used by same member on different day
        # - Block if used by same member today for the same loan type (unless this is an advance check)
        # Otherwise allow (this permits same-member reuse across categories on the same day)
        available = not (
            is_used_by_others or
            is_used_same_member_different_day or
            (is_used_same_member_same_loan_type_today and not is_advance_flag)
        )

        return Response({
            'available': available,
            'is_used_by_other_member': is_used_by_others,
            'is_used_same_member_different_day': is_used_same_member_different_day,
            'is_used_same_member_same_loan_type_today': is_used_same_member_same_loan_type_today,
            'is_advance_flag': is_advance_flag,
            'or_number': or_number,
            'current_account': account_number,
            'message': (
                'OR number is available' if available else 'OR number cannot be reused under current rules'
            )
        }, status=status.HTTP_200_OK)

    except Account.DoesNotExist:
        return Response({'error': 'Account not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
#atf
@api_view(['GET'])
def debug_recalculations(request, control_number):
    """Debug endpoint to check recalculations for a specific loan"""
    from .models import Loan, LoanYearlyRecalculation
    
    try:
        loan = Loan.objects.get(control_number=control_number)
        recalcs = LoanYearlyRecalculation.objects.filter(loan=loan)
        
        data = {
            'loan_control': str(loan.control_number),
            'account_number': loan.account.account_number,
            'recalculation_count': recalcs.count(),
            'recalculations': [
                {
                    'id': r.id,
                    'year': r.year,
                    'loan_control': str(r.loan.control_number),
                    'previous_balance': str(r.previous_balance),
                    'outstanding_balance': str(r.outstanding_balance),
                }
                for r in recalcs
            ]
        }
        
        return Response(data)
    except Loan.DoesNotExist:
        return Response({'error': 'Loan not found'}, status=404)
    
#recently lang
@api_view(['GET'])
def debug_penalty_status(request, schedule_id):
    """Debug endpoint to check penalty status"""
    try:
        schedule = PaymentSchedule.objects.get(id=schedule_id)
        member = schedule.loan.account.account_holder
        account = schedule.loan.account
        
        today = timezone.now().date()
        
        debug_info = {
            'schedule_id': schedule.id,
            'due_date': schedule.due_date,
            'today': today,
            'is_overdue': today > schedule.due_date,
            'current_penalty': str(schedule.penalty),
            'payment_amount': str(schedule.payment_amount),
            'is_paid': schedule.is_paid,
            'member_employment_status': getattr(member, 'employment_status', 'Outsider'),
            'account_number': account.account_number,
            'account_share_capital': str(account.shareCapital),
            'account_status': account.status,
        }
        
        return Response(debug_info)
    except PaymentSchedule.DoesNotExist:
        return Response({'error': 'Schedule not found'}, status=404)
    
from django.db.models import Sum
from datetime import datetime
from .models import PenaltyCollection

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_yearly_penalty_collections(request, year=None):
    """
    Get total penalty collections for a specific year
    Includes both auto-collected and manually paid penalties
    """
    if year is None:
        year = datetime.now().year
    
    try:
        year = int(year)
        
        # Get penalties from PenaltyCollection model (auto-collected)
        auto_collected = PenaltyCollection.objects.filter(
            collection_date__year=year
        ).aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')
        
        # Get penalties from paid schedules where penalty was included in payment
        # (manually paid penalties)
        manual_paid = PaymentSchedule.objects.filter(
            is_paid=True,
            penalty__gt=0,
            # Assuming you track when schedule was paid - adjust field name as needed
            # If you don't have this field, you may need to add it
        ).aggregate(
            total=Sum('penalty')
        )['total'] or Decimal('0.00')
        
        total_penalties = auto_collected + manual_paid
        
        return Response({
            'year': year,
            'auto_collected': float(auto_collected),
            'manual_paid': float(manual_paid),
            'total_penalties': float(total_penalties),
            'breakdown': {
                'auto_borrower': float(
                    PenaltyCollection.objects.filter(
                        collection_date__year=year,
                        collection_method='auto_borrower'
                    ).aggregate(Sum('amount'))['amount__sum'] or 0
                ),
                'auto_comaker': float(
                    PenaltyCollection.objects.filter(
                        collection_date__year=year,
                        collection_method='auto_comaker'
                    ).aggregate(Sum('amount'))['amount__sum'] or 0
                ),
                'manual': float(manual_paid)
            }
        })
        
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
# historical archiving
# Add these new views to your views.py file (in addition to existing ones)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_yearly_summary(request, year):
    """
    Get financial summary for a specific year
    """
    try:
        year = int(year)
        summary = YearlyFinancialSummary.objects.get(year=year)
        
        # If it's the current year and not finalized, recalculate
        if year == timezone.now().year and not summary.is_finalized:
            summary.calculate_totals()
        
        serializer = YearlyFinancialSummarySerializer(summary)
        return Response(serializer.data)
    except YearlyFinancialSummary.DoesNotExist:
        # If summary doesn't exist, calculate it on the fly for current year
        if year == timezone.now().year:
            summary = YearlyFinancialSummary.get_or_create_current_year()
            summary.calculate_totals()
            serializer = YearlyFinancialSummarySerializer(summary)
            return Response(serializer.data)
        else:
            return Response(
                {'error': f'No data available for year {year}'}, 
                status=404
            )
    except ValueError:
        return Response({'error': 'Invalid year format'}, status=400)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_year_summary(request):
    """
    Get current year's financial summary (real-time data)
    """
    current_year = timezone.now().year
    summary = YearlyFinancialSummary.get_or_create_current_year()
    
    # Calculate real-time totals for current year
    summary.calculate_totals()
    
    serializer = YearlyFinancialSummarySerializer(summary)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_all_yearly_summaries(request):
    """
    Get all available yearly summaries with years list
    """
    summaries = YearlyFinancialSummary.objects.all().order_by('-year')
    
    # Get list of years for dropdown
    years = list(summaries.values_list('year', flat=True))
    
    serializer = YearlyFinancialSummarySerializer(summaries, many=True)
    
    return Response({
        'summaries': serializer.data,
        'available_years': years
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def finalize_year_manual(request):
    """
    Manually trigger year-end finalization (Admin only)
    """
    if not request.user.is_staff:
        return Response(
            {'error': 'Only administrators can finalize years'}, 
            status=403
        )
    
    year = request.data.get('year')
    if not year:
        return Response({'error': 'Year is required'}, status=400)
    
    try:
        year = int(year)
        
        # Don't allow finalizing future years
        if year > timezone.now().year:
            return Response(
                {'error': 'Cannot finalize future years'}, 
                status=400
            )
        
        # Get or create summary
        summary, created = YearlyFinancialSummary.objects.get_or_create(
            year=year,
            defaults={'is_finalized': False}
        )
        
        if summary.is_finalized:
            return Response(
                {'error': f'Year {year} is already finalized'}, 
                status=400
            )
        
        # Calculate totals
        summary.calculate_totals()
        
        # Mark as finalized
        summary.is_finalized = True
        summary.save()
        
        # Create next year if needed
        next_year = year + 1
        YearlyFinancialSummary.objects.get_or_create(
            year=next_year,
            defaults={'is_finalized': False}
        )
        
        serializer = YearlyFinancialSummarySerializer(summary)
        return Response({
            'message': f'Year {year} finalized successfully',
            'summary': serializer.data
        })
        
    except ValueError:
        return Response({'error': 'Invalid year format'}, status=400)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
def get_yearly_fees_breakdown(request, year):
    """
    Get detailed fees breakdown for a specific year
    """
    try:
        year = int(year)
        summary = YearlyFinancialSummary.objects.get(year=year)
        
        # If current year and not finalized, recalculate
        if year == timezone.now().year and not summary.is_finalized:
            summary.calculate_totals()
        
        return Response({
            'year': year,
            'total_fees_collected': float(summary.total_fees_collected),
            'breakdown': {
                'service_fee': float(summary.total_service_fees),
                'interest_amount': float(summary.total_interest),
                'admin_cost': float(summary.total_admin_costs),
                
                'cisp': float(summary.total_cisp)
            },
            'is_finalized': summary.is_finalized
        })
    except YearlyFinancialSummary.DoesNotExist:
        if year == timezone.now().year:
            summary = YearlyFinancialSummary.get_or_create_current_year()
            summary.calculate_totals()
            return Response({
                'year': year,
                'total_fees_collected': float(summary.total_fees_collected),
                'breakdown': {
                    'service_fee': float(summary.total_service_fees),
                    'interest_amount': float(summary.total_interest),
                    'admin_cost': float(summary.total_admin_costs),
                  
                    'cisp': float(summary.total_cisp)
                },
                'is_finalized': False
            })
        return Response({'error': f'No data for year {year}'}, status=404)

@api_view(['GET'])
def get_yearly_penalties_breakdown(request, year):
    """
    Get detailed penalties breakdown for a specific year
    """
    try:
        year = int(year)
        
        # Get auto-collected penalties
        auto_borrower = PenaltyCollection.objects.filter(
            collection_date__year=year,
            collection_method='auto_borrower'
        ).aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
        
        auto_comaker = PenaltyCollection.objects.filter(
            collection_date__year=year,
            collection_method='auto_comaker'
        ).aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
        
        manual = PenaltyCollection.objects.filter(
            collection_date__year=year,
            collection_method='manual'
        ).aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
        
        total = auto_borrower + auto_comaker + manual
        
        return Response({
            'year': year,
            'total_penalties': float(total),
            'breakdown': {
                'auto_borrower': float(auto_borrower),
                'auto_comaker': float(auto_comaker),
                'manual': float(manual)
            }
        })
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
def get_yearly_loans_breakdown(request, year):
    """
    Get detailed loans breakdown for a specific year
    """
    try:
        year = int(year)
        summary = YearlyFinancialSummary.objects.get(year=year)
        
        if year == timezone.now().year and not summary.is_finalized:
            summary.calculate_totals()
        
        return Response({
            'year': year,
            'total_loans_released': float(summary.total_loans_released),
            'breakdown': {
                'regular': float(summary.total_regular_loans),
                'emergency': float(summary.total_emergency_loans)
            },
            'loan_count': summary.loan_count,
            'is_finalized': summary.is_finalized
        })
    except YearlyFinancialSummary.DoesNotExist:
        if year == timezone.now().year:
            summary = YearlyFinancialSummary.get_or_create_current_year()
            summary.calculate_totals()
            return Response({
                'year': year,
                'total_loans_released': float(summary.total_loans_released),
                'breakdown': {
                    'regular': float(summary.total_regular_loans),
                    'emergency': float(summary.total_emergency_loans)
                },
                'loan_count': summary.loan_count,
                'is_finalized': False
            })
        return Response({'error': f'No data for year {year}'}, status=404)
  
from .models import LoanYearlyRecalculation  
@api_view(['POST'])
def pay_yearly_fees(request):
    """Pay yearly recalculation fees with proper error handling"""
    try:
        # ✅ Enhanced logging
        print("\n" + "="*70)
        print("📥 YEARLY FEES PAYMENT REQUEST")
        print("="*70)
        print(f"Request data: {request.data}")
        print(f"User authenticated: {request.user.is_authenticated}")
        print(f"User: {request.user}")
        
        loan_control_number = request.data.get('loan_control_number')
        year = request.data.get('year')
        or_number = request.data.get('or_number')
        amount = request.data.get('amount')
        
        # ✅ Validate all required fields
        if not all([loan_control_number, year, or_number, amount]):
            missing = []
            if not loan_control_number: missing.append('loan_control_number')
            if not year: missing.append('year')
            if not or_number: missing.append('or_number')
            if not amount: missing.append('amount')
            
            error_msg = f'Missing required fields: {", ".join(missing)}'
            print(f"❌ {error_msg}")
            return Response({'error': error_msg}, status=400)
        
        print(f"✅ Validation passed")
        print(f"   Loan: {loan_control_number}")
        print(f"   Year: {year}")
        print(f"   OR: {or_number}")
        print(f"   Amount: {amount}")
        
        # ✅ Get recalculation with error handling
        try:
            from .models import LoanYearlyRecalculation
            recalc = LoanYearlyRecalculation.objects.get(
                loan__control_number=loan_control_number,
                year=year
            )
            print(f"✅ Found recalculation: Year {recalc.year}")
            print(f"   Current status: fees_paid={recalc.fees_paid}")
            print(f"   Loan control: {recalc.loan.control_number}")
            
        except LoanYearlyRecalculation.DoesNotExist:
            # ✅ Debug: Show available years
            all_years = LoanYearlyRecalculation.objects.filter(
                loan__control_number=loan_control_number
            ).values_list('year', flat=True)
            
            error_msg = f'Recalculation not found for loan {loan_control_number}, year {year}'
            print(f"❌ {error_msg}")
            print(f"   Available years: {list(all_years)}")
            
            return Response({
                'error': error_msg,
                'available_years': list(all_years)
            }, status=404)
        
        # ✅ Check if already paid
        if recalc.fees_paid:
            print(f"⚠️ Already paid")
            return Response({
                'error': f'Year {year} fees already paid',
                'fees_paid_date': recalc.fees_paid_date.isoformat() if recalc.fees_paid_date else None
            }, status=400)
        
        # ✅ Validate OR number format
        or_str = str(or_number).strip()
        if len(or_str) != 4 or not or_str.isdigit():
            print(f"❌ Invalid OR format: '{or_str}'")
            return Response({'error': 'OR must be 4 digits'}, status=400)
        
        # ✅ OR reuse validation
        loan = recalc.loan
        member = loan.account.account_holder
        today = timezone.now().date()
        
        print(f"✅ Validating OR reuse for member {member.memId}")
        
        # Check if used by other members
        from .models import ORNumberTracker
        used_by_other = ORNumberTracker.objects.filter(
            or_number=or_str
        ).exclude(member=member).exists()
        
        if used_by_other:
            error_msg = f'OR {or_str} already used by another member'
            print(f"❌ {error_msg}")
            return Response({'error': error_msg}, status=400)
        
        # Check if same member used on different day
        tracker = ORNumberTracker.objects.filter(
            member=member, 
            or_number=or_str
        ).first()
        
        if tracker and tracker.first_used_date.date() != today:
            error_msg = f'OR {or_str} was used on different day'
            print(f"❌ {error_msg}")
            return Response({'error': error_msg}, status=400)
        
        print(f"✅ OR validation passed")
        
        # ✅ Mark fees as paid
        try:
            print(f"💾 Marking fees as paid...")
            recalc.mark_fees_as_paid(or_str)
            
            # ✅ Verify save
            recalc.refresh_from_db()
            print(f"✅ Saved: fees_paid={recalc.fees_paid}, OR={recalc.fees_or_number}")
            
        except Exception as e:
            print(f"❌ Failed to mark as paid: {e}")
            import traceback
            traceback.print_exc()
            return Response({'error': f'Save failed: {str(e)}'}, status=500)
        
        # ✅ Create OR tracker
        try:
            ORNumberTracker.objects.get_or_create(
                member=member,
                or_number=or_str,
                defaults={
                    'loan_type': 'Fees',
                    'loan': loan,
                    'is_active': True
                }
            )
            print(f"✅ OR tracker created")
        except Exception as e:
            print(f"⚠️ OR tracker failed: {e}")
        
        # ✅ Archive payment - FIX: Handle missing archived_by properly
        try:
            account = loan.account
            
            # ✅ CRITICAL FIX: Get a valid user for archived_by
            archived_by_user = None
            if request.user and request.user.is_authenticated:
                archived_by_user = request.user
            else:
                # Fallback: Use the member's linked user, or create/get a system user
                if hasattr(member, 'user') and member.user:
                    archived_by_user = member.user
                else:
                    # Last resort: Get or create a system user
                    from django.contrib.auth.models import User
                    archived_by_user, _ = User.objects.get_or_create(
                        username='system',
                        defaults={'email': 'system@system.com'}
                    )
            
            print(f"✅ Using archived_by: {archived_by_user.username}")
            
            ArchivedPayment.objects.create(
                account_number=account.account_number,
                account_holder=f"{member.first_name} {member.middle_name or ''} {member.last_name}".strip(),
                payment_amount=amount,
                loan_type=loan.loan_type,
                loan_control_number=str(loan.control_number),
                date_paid=timezone.now(),
                or_number=or_str,
                payment_type=f'Year {year} Recalculation Fees',
                archived_by=archived_by_user  # ✅ Now guaranteed to be valid
            )
            print(f"✅ Payment archived")
            
        except Exception as e:
            print(f"⚠️ Archive failed: {e}")
            import traceback
            traceback.print_exc()
            # Don't fail the request
        
        print(f"="*70)
        print(f"✅ PAYMENT SUCCESSFUL")
        print(f"="*70 + "\n")
        
        return Response({
            'success': True,
            'message': f'Year {year} fees paid successfully',
            'year': year,
            'or_number': or_str,
            'fees_paid_date': recalc.fees_paid_date.isoformat()
        }, status=200)
        
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR:")
        print(f"   Type: {type(e).__name__}")
        print(f"   Message: {str(e)}")
        import traceback
        traceback.print_exc()
        print()
        
        return Response({
            'error': f'Server error: {str(e)}'
        }, status=500)
@api_view(['POST'])
def process_reloan(request):
    """
    Process reloan application with comprehensive validation.
    """
    try:
        # Get request data
        account_number = request.data.get('account_number')
        existing_loan_id = request.data.get('existing_loan_control_number')
        raw_amount = request.data.get('new_loan_amount')
        loan_type = request.data.get('loan_type')
        loan_period = request.data.get('loan_period')
        loan_period_unit = request.data.get('loan_period_unit')
        purpose = request.data.get('purpose')
        
        # Co-makers
        co_makers = {
            'co_maker': request.data.get('co_maker', ''),
            'co_maker_id': request.data.get('co_maker_id'),
            'co_maker_2': request.data.get('co_maker_2', ''),
            'co_maker_2_id': request.data.get('co_maker_2_id'),
            'co_maker_3': request.data.get('co_maker_3', ''),
            'co_maker_3_id': request.data.get('co_maker_3_id'),
            'co_maker_4': request.data.get('co_maker_4', ''),
            'co_maker_4_id': request.data.get('co_maker_4_id'),
            'co_maker_5': request.data.get('co_maker_5', ''),
            'co_maker_5_id': request.data.get('co_maker_5_id'),
        }
        
        # Validate amount
        if raw_amount is None or str(raw_amount).strip() == '':
            return Response({
                'error': 'new_loan_amount is required'
            }, status=400)
        
        try:
            new_loan_amount = Decimal(str(raw_amount))
        except (InvalidOperation, ValueError, TypeError):
            return Response({
                'error': 'Invalid new_loan_amount'
            }, status=400)
        
        if new_loan_amount <= 0:
            return Response({
                'error': 'new_loan_amount must be greater than zero'
            }, status=400)
        
        # Validate loan period
        try:
            loan_period = int(loan_period)
        except (ValueError, TypeError):
            return Response({
                'error': 'Invalid loan_period. Must be an integer.'
            }, status=400)
        
        # Get account
        try:
            account = Account.objects.get(account_number=account_number)
            member = account.account_holder
        except Account.DoesNotExist:
            return Response({
                'error': 'Account not found'
            }, status=404)
        
        # Validate co-makers
        comaker_names = [v for k, v in co_makers.items() if 'id' not in k and v and v.strip()]
        
        # Determine minimum comakers based on loan amount
        min_comakers = 0
        if new_loan_amount < 500000:
            min_comakers = 0
        elif new_loan_amount < 1000000:
            min_comakers = 1
        elif new_loan_amount < 1250000:
            min_comakers = 2
        elif new_loan_amount < 1500000:
            min_comakers = 3
        else:
            min_comakers = 5
        
        # Check minimum comakers requirement
        if len(comaker_names) < min_comakers:
            return Response({
                'error': f'This loan amount requires at least {min_comakers} co-maker(s). Provided: {len(comaker_names)}'
            }, status=400)
        
        # Validate each comaker
        comaker_errors = []
        for name in comaker_names:
            if not name or not name.strip():
                continue
            
            parts = name.split()
            if len(parts) < 2:
                comaker_errors.append(f"Invalid comaker name format: {name}")
                continue
            
            first = parts[0]
            last = parts[-1]
            
            comaker = Member.objects.filter(
                first_name__iexact=first,
                last_name__iexact=last,
                employment_status='Employed'
            ).first()
            
            if not comaker:
                comaker_errors.append(f"Comaker '{name}' must be a current employee")
                continue
            
            if comaker.memId == member.memId:
                comaker_errors.append(f"Comaker '{name}' cannot be the account holder")
        
        # Check for duplicates
        unique_names = set([n.lower().strip() for n in comaker_names])
        if len(unique_names) < len(comaker_names):
            comaker_errors.append("Co-makers must be different from each other")
        
        if comaker_errors:
            return Response({
                'error': 'Co-maker validation failed',
                'details': comaker_errors
            }, status=400)
        
        # Get existing loan
        try:
            existing_loan = Loan.objects.get(
                control_number=existing_loan_id,
                account=account,
                status='Ongoing'
            )
        except Loan.DoesNotExist:
            return Response({
                'error': 'Existing loan not found or already settled'
            }, status=404)
        
        # Check eligibility (server-side) using serializer helper for advances
        from .serializers import LoanSerializer
        ser = LoanSerializer(existing_loan)
        rel = ser.data.get('reloan_eligibility', {})
        if str(loan_type).strip() == 'Regular':
            # For Regular reloan, honor helper thresholds
            if not rel or not bool(rel.get('eligible', False)):
                return Response({
                    'error': 'Reloan not eligible. Requires either ≥50% payments counted (including advances) or remaining principal ≤50% of original.',
                    'details': rel
                }, status=400)
        else:
            # Non-Regular types must use create_loan; do a minimal guard
            pass

        # ✅ Enforce: process_reloan is ONLY for Regular→Regular
        # - Reject cross-type
        # - Reject Emergency reloan entirely
        if str(loan_type).strip() != str(existing_loan.loan_type).strip():
            return Response({
                'error': 'Cross-type application detected. Use /loans/create_loan for new loans of a different type (not reloan).',
                'existing_loan_type': existing_loan.loan_type,
                'requested_loan_type': loan_type
            }, status=400)
        if str(loan_type).strip() == 'Emergency' or str(existing_loan.loan_type).strip() == 'Emergency':
            return Response({
                'error': 'Emergency loans cannot be reloaned. Reloan is only allowed for Regular loans.'
            }, status=400)
        
        # Calculate remaining balance
        unpaid_schedules = existing_loan.paymentschedule_set.filter(is_paid=False)
        remaining_principal = unpaid_schedules.aggregate(
            total=Sum('principal_amount')
        )['total'] or Decimal('0.00')
        # If serializer computed a lower effective remaining (due to advances), use that
        try:
            eff_rem_str = rel.get('effective_remaining_principal')
            if eff_rem_str is not None:
                eff_rem = Decimal(str(eff_rem_str))
                if eff_rem >= Decimal('0.00') and eff_rem <= remaining_principal:
                    remaining_principal = eff_rem
        except Exception:
            pass
        
        # ✅ CRITICAL: Validate new loan amount > remaining balance (using effective remaining)
        if new_loan_amount <= remaining_principal:
            return Response({
                'error': f'Invalid reloan amount. New loan amount (₱{new_loan_amount:,.2f}) must be GREATER than remaining balance (₱{remaining_principal:,.2f}). Minimum required: ₱{(remaining_principal + Decimal("0.01")):,.2f}',
                'details': {
                    'remaining_balance': float(remaining_principal),
                    'provided_amount': float(new_loan_amount),
                    'minimum_required': float(remaining_principal + Decimal("0.01")),
                }
            }, status=400)
        
        # ✅ Validate share capital constraint
        member_share_capital = Decimal(str(member.accountN.shareCapital or 0))
        max_loan_amount = member_share_capital * 3
        
        if new_loan_amount > max_loan_amount:
            return Response({
                'error': f'Loan amount exceeds limit. New loan amount (₱{new_loan_amount:,.2f}) cannot exceed 3x share capital (₱{max_loan_amount:,.2f}).',
                'details': {
                    'share_capital': float(member_share_capital),
                    'max_allowed': float(max_loan_amount),
                    'requested_amount': float(new_loan_amount),
                }
            }, status=400)
        
        # Calculate actual new funds
        actual_new_funds = new_loan_amount - remaining_principal
        
        print(f"\n{'='*70}")
        print(f"RELOAN PROCESSING")
        print(f"{'='*70}")
        print(f"Existing Loan: {existing_loan.control_number}")
        print(f"Remaining Principal: ₱{remaining_principal:,.2f}")
        print(f"New Loan Amount: ₱{new_loan_amount:,.2f}")
        print(f"Actual New Funds: ₱{actual_new_funds:,.2f}")
        
        # Create reloan
        with transaction.atomic():
            new_loan = existing_loan.create_reloan(
                new_loan_amount=new_loan_amount,
                loan_type=loan_type,
                loan_period=loan_period,
                loan_period_unit=loan_period_unit,
                purpose=purpose,
                co_makers=co_makers
            )

            # Ensure the existing loan is fully settled and any leftover unpaid schedules are closed
            try:
                # Refresh existing_loan in case model mutates state during reloan
                existing_loan.refresh_from_db()
                # If remaining principal is effectively zero, settle and mark all unpaid schedules paid
                settle_loan_if_zero(existing_loan)
                # Additionally, guard against any lingering unpaid schedules
                leftover = PaymentSchedule.objects.filter(loan=existing_loan, is_paid=False)
                if leftover.exists():
                    today = timezone.now().date()
                    for s in leftover:
                        s.is_paid = True
                        if not s.date_paid:
                            s.date_paid = today
                        s.under_pay = Decimal('0.00')
                        if not s.or_number:
                            s.or_number = '0000'
                        s.save(update_fields=['is_paid','date_paid','under_pay','or_number'])
                    # Update loan status to Settled explicitly
                    existing_loan.status = 'Settled'
                    existing_loan.archived = True
                    existing_loan.remaining_principal = Decimal('0.00')
                    existing_loan.save(update_fields=['status','archived','remaining_principal'])
            except Exception as _e:
                logger.warning(f"Post-reloan settlement cleanup failed: {_e}")
            
            # Archive old loan
            Archive.objects.create(
                archive_type='Loan',
                archived_data={
                    "control_number": str(existing_loan.control_number),
                    "account": existing_loan.account.account_number,
                    "loan_amount": str(existing_loan.loan_amount),
                    "loan_type": existing_loan.loan_type,
                    "status": "Settled (Reloan)",
                    "settled_for_reloan": True,
                    "new_loan_control_number": str(new_loan.control_number),
                    "remaining_balance_transferred": str(remaining_principal),
                }
            )
        
        serializer = LoanSerializer(new_loan)
        
        return Response({
            'success': True,
            'message': 'Reloan processed successfully',
            'old_loan': {
                'control_number': existing_loan.control_number,
                'remaining_principal': float(remaining_principal),
                'status': 'Settled'
            },
            'new_loan': serializer.data,
            'breakdown': {
                'new_loan_amount': float(new_loan_amount),
                'carried_balance': float(remaining_principal),
                'actual_new_funds': float(actual_new_funds),
                'net_proceeds': float(new_loan.net_proceeds)
            }
        }, status=201)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({
            'error': str(e)
        }, status=500)        
# @api_view(['POST'])
# def process_reloan(request):
#     """
#     Process a reloan application with proper validation.
#     """
#     try:
#         # Get request data
#         account_number = request.data.get('account_number')
#         existing_loan_id = request.data.get('existing_loan_control_number')
#         # Validate and coerce new_loan_amount safely
#         raw_amount = request.data.get('new_loan_amount', None)
#         if raw_amount is None or str(raw_amount).strip() == '':
#             return Response({
#                 'error': 'new_loan_amount is required and must be a positive number.'
#             }, status=status.HTTP_400_BAD_REQUEST)
#         try:
#             new_loan_amount = Decimal(str(raw_amount))
#         except (InvalidOperation, ValueError, TypeError):
#             return Response({
#                 'error': 'Invalid new_loan_amount. Please provide a numeric value.'
#             }, status=status.HTTP_400_BAD_REQUEST)
#         if new_loan_amount <= 0:
#             return Response({
#                 'error': 'new_loan_amount must be greater than zero.'
#             }, status=status.HTTP_400_BAD_REQUEST)

#         loan_type = request.data.get('loan_type')
#         loan_period = request.data.get('loan_period')
#         loan_period_unit = request.data.get('loan_period_unit')
#         purpose = request.data.get('purpose')
        
#         # Get co-makers (both names AND IDs for proper tracking)
#         co_makers = {
#             'co_maker': request.data.get('co_maker', ''),
#             'co_maker_id': request.data.get('co_maker_id'),
#             'co_maker_2': request.data.get('co_maker_2', ''),
#             'co_maker_2_id': request.data.get('co_maker_2_id'),
#             'co_maker_3': request.data.get('co_maker_3', ''),
#             'co_maker_3_id': request.data.get('co_maker_3_id'),
#             'co_maker_4': request.data.get('co_maker_4', ''),
#             'co_maker_4_id': request.data.get('co_maker_4_id'),
#             'co_maker_5': request.data.get('co_maker_5', ''),
#             'co_maker_5_id': request.data.get('co_maker_5_id'),
#         }
        
#         # ✅ VALIDATE COMAKERS
#         comaker_errors = []
#         comaker_names = [name for name in co_makers.values() if name and name.strip()]
        
#         # Get account holder
#         try:
#             account = Account.objects.get(account_number=account_number)
#             member = account.account_holder
#         except Account.DoesNotExist:
#             return Response({
#                 'error': 'Account not found'
#             }, status=status.HTTP_404_NOT_FOUND)
        
#         # ✅ Determine minimum comakers based on loan amount
#         min_comakers = 0
#         if new_loan_amount < 500000:
#             min_comakers = 0
#         elif new_loan_amount < 1000000:
#             min_comakers = 1
#         elif new_loan_amount < 1250000:
#             min_comakers = 2
#         elif new_loan_amount < 1500000:
#             min_comakers = 3
#         else:
#             min_comakers = 5
        
#         # ✅ Check minimum comakers requirement
#         if len(comaker_names) < min_comakers:
#             return Response({
#                 'error': f'This loan amount requires at least {min_comakers} co-maker(s). Provided: {len(comaker_names)}'
#             }, status=status.HTTP_400_BAD_REQUEST)
        
#         # ✅ Validate each comaker exists and is employed
#         for name in comaker_names:
#             if not name or not name.strip():
#                 continue
                
#             parts = name.split()
#             if len(parts) < 2:
#                 comaker_errors.append(f"Invalid comaker name format: {name}")
#                 continue
            
#             first = parts[0]
#             last = parts[-1]
            
#             # Check if comaker exists and is employed
#             comaker = Member.objects.filter(
#                 first_name__iexact=first,
#                 last_name__iexact=last,
#                 employment_status='Employed'
#             ).first()
            
#             if not comaker:
#                 comaker_errors.append(f"Comaker '{name}' must be a current employee")
#                 continue
            
#             # ✅ Check if comaker is the account holder
#             if comaker.memId == member.memId:
#                 comaker_errors.append(f"Comaker '{name}' cannot be the account holder")
        
#         # ✅ Check for duplicate comakers
#         unique_names = set([n.lower().strip() for n in comaker_names])
#         if len(unique_names) < len(comaker_names):
#             comaker_errors.append("Co-makers must be different from each other")
        
#         # If there are validation errors, return them
#         if comaker_errors:
#             return Response({
#                 'error': 'Co-maker validation failed',
#                 'details': comaker_errors
#             }, status=status.HTTP_400_BAD_REQUEST)
        
#         # ✅ Get existing loan
#         try:
#             existing_loan = Loan.objects.get(
#                 control_number=existing_loan_id,
#                 account=account,
#                 status='Ongoing'
#             )
#         except Loan.DoesNotExist:
#             return Response({
#                 'error': 'Existing loan not found or already settled'
#             }, status=status.HTTP_404_NOT_FOUND)
        
#         # ✅ Check eligibility
#         eligibility = existing_loan.can_apply_for_loan_type(loan_type)
#         if not eligibility['can_apply']:
#             return Response({
#                 'error': eligibility['reason']
#             }, status=status.HTTP_400_BAD_REQUEST)
        
#         # ✅ NEW: Check share capital constraint (new loan amount ≤ 3x share capital)
#         member_share_capital = Decimal(str(getattr(member.accountN, 'shareCapital', 0) or 0))
#         max_loan_amount = member_share_capital * 3
        
#         if new_loan_amount > max_loan_amount:
#             return Response({
#                 'error': f'Loan amount exceeds limit. New loan amount (₱{new_loan_amount:,.2f}) cannot exceed 3x share capital (₱{max_loan_amount:,.2f}). Member share capital: ₱{member_share_capital:,.2f}',
#                 'details': {
#                     'share_capital': float(member_share_capital),
#                     'max_allowed': float(max_loan_amount),
#                     'requested_amount': float(new_loan_amount),
#                     'multiplier': 3,
#                 }
#             }, status=status.HTTP_400_BAD_REQUEST)
        
#         # Calculate remaining balance
#         unpaid_schedules = existing_loan.paymentschedule_set.filter(is_paid=False)
#         remaining_principal = unpaid_schedules.aggregate(
#             total=Sum('principal_amount')
#         )['total'] or Decimal('0.00')
        
#         # ✅ VALIDATION: New loan must be greater than remaining balance
#         if new_loan_amount <= remaining_principal:
#             return Response({
#                 'error': f'Invalid reloan amount. New loan amount (₱{new_loan_amount:,.2f}) must be GREATER than remaining balance (₱{remaining_principal:,.2f}). Minimum required: ₱{remaining_principal + 1:,.2f}',
#                 'details': {
#                     'remaining_balance': float(remaining_principal),
#                     'provided_amount': float(new_loan_amount),
#                     'minimum_required': float(remaining_principal) + 1,
#                 }
#             }, status=status.HTTP_400_BAD_REQUEST)
        
#         # ✅ Calculate actual new funds
#         actual_new_funds = new_loan_amount - remaining_principal
        
#         print(f"\n{'='*70}")
#         print(f"RELOAN PROCESSING")
#         print(f"{'='*70}")
#         print(f"Existing Loan: {existing_loan.control_number}")
#         print(f"Remaining Principal: ₱{remaining_principal}")
#         print(f"New Loan Amount: ₱{new_loan_amount}")
#         print(f"Actual New Funds: ₱{actual_new_funds}")
#         print(f"Co-makers: {len(comaker_names)}")
        
#         # Create reloan
#         with transaction.atomic():
#             new_loan = existing_loan.create_reloan(
#                 new_loan_amount=new_loan_amount,
#                 loan_type=loan_type,
#                 loan_period=loan_period,
#                 loan_period_unit=loan_period_unit,
#                 purpose=purpose,
#                 co_makers=co_makers
#             )
            
#             # Archive the old loan
#             Archive.objects.create(
#                 archive_type='Loan',
#                 archived_data={
#                     "control_number": str(existing_loan.control_number),
#                     "account": existing_loan.account.account_number,
#                     "loan_amount": str(existing_loan.loan_amount),
#                     "loan_type": existing_loan.loan_type,
#                     "status": "Settled (Reloan)",
#                     "settled_for_reloan": True,
#                     "new_loan_control_number": str(new_loan.control_number),
#                     "remaining_balance_transferred": str(remaining_principal),
#                 }
#             )
        
#         # Serialize response
#         serializer = LoanSerializer(new_loan)
        
#         return Response({
#             'success': True,
#             'message': 'Reloan processed successfully',
#             'old_loan': {
#                 'control_number': existing_loan.control_number,
#                 'remaining_principal': float(remaining_principal),
#                 'status': 'Settled'
#             },
#             'new_loan': serializer.data,
#             'breakdown': {
#                 'new_loan_amount': float(new_loan_amount),
#                 'carried_balance': float(remaining_principal),
#                 'actual_new_funds': float(actual_new_funds),
#                 'net_proceeds': float(new_loan.net_proceeds)
#             }
#         }, status=status.HTTP_201_CREATED)
        
#     except Exception as e:
#         import traceback
#         traceback.print_exc()
#         return Response({
#             'error': str(e)
#         }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
@api_view(['POST'])
def check_reloan_eligibility(request):
    """
    Enhanced reloan eligibility checker with proper validation.
    Returns detailed eligibility information including payment progress.
    """
    try:
        account_number = request.data.get('account_number')
        requested_loan_type = request.data.get('requested_loan_type')
        raw_requested = request.data.get('requested_loan_amount')
        
        # Validate inputs
        if not account_number or not requested_loan_type:
            return Response({
                'error': 'account_number and requested_loan_type are required'
            }, status=400)
        
        # Validate and parse loan amount
        if raw_requested is None or str(raw_requested).strip() == '':
            return Response({
                'error': 'requested_loan_amount is required'
            }, status=400)
        
        try:
            requested_amount = Decimal(str(raw_requested))
        except (InvalidOperation, ValueError, TypeError):
            return Response({
                'error': 'Invalid requested_loan_amount. Must be numeric.'
            }, status=400)
        
        if requested_amount <= 0:
            return Response({
                'error': 'requested_loan_amount must be greater than zero'
            }, status=400)
        
        # Get account
        try:
            account = Account.objects.get(account_number=account_number)
        except Account.DoesNotExist:
            return Response({
                'error': 'Account not found'
            }, status=404)
        
        # Get active loans
        active_loans = Loan.objects.filter(
            account__account_number=account_number,
            status='Ongoing'
        ).order_by('-loan_date')
        
        # No active loans - eligible for new loan
        if not active_loans.exists():
            return Response({
                'eligible': True,
                'reason': 'No active loans. Can apply for new loan.',
                'has_active_loan': False
            })
        
        existing_loan = active_loans.first()
        
        # Check loan type-specific eligibility using serializer-based rules
        from .serializers import LoanSerializer
        ser = LoanSerializer(existing_loan)
        rel = ser.data.get('reloan_eligibility', {}) or {}
        paid_ratio = float(rel.get('paid_ratio') or 0.0)
        existing_type = str(existing_loan.loan_type).strip()
        req_type = str(requested_loan_type).strip()

        def eval_req():
            if req_type == 'Regular':
                if existing_type == 'Regular':
                    if bool(rel.get('eligible')):
                        return True, rel.get('reason') or 'Eligible for Regular reloan.'
                    pct = f"{(paid_ratio*100):.1f}%"
                    need = f"{max(0.0, 50.0 - (paid_ratio*100)):.1f}%"
                    return False, rel.get('reason') or f"Regular reloan requires ≥50% progress. Current: {pct}. Need {need} more."
                else:
                    if paid_ratio >= 0.5:
                        return True, f"Eligible for Regular loan. Current loan paid {(paid_ratio*100):.1f}%."
                    need = 50.0 - (paid_ratio*100)
                    return False, f"Must pay {need:.1f}% more of current loan (50% required for Regular loan)."
            elif req_type == 'Emergency':
                if existing_type == 'Emergency':
                    return False, 'Only one Emergency loan at a time. Settle or switch type.'
                if paid_ratio >= 0.5:
                    return True, f"Eligible for Emergency loan. Current loan paid {(paid_ratio*100):.1f}%."
                need = 50.0 - (paid_ratio*100)
                return False, f"Cannot apply for Emergency loan yet. Need {need:.1f}% more to reach 50%."
            return False, 'Invalid loan type specified.'

        can_apply, reason_msg = eval_req()
        if not can_apply:
            return Response({
                'eligible': False,
                'reason': reason_msg,
                'has_active_loan': True,
                'existing_loan': {
                    'control_number': existing_loan.control_number,
                    'loan_type': existing_loan.loan_type,
                    'loan_amount': float(existing_loan.loan_amount),
                }
            })
        
        # Calculate remaining balance from unpaid schedules
        unpaid_schedules = existing_loan.paymentschedule_set.filter(is_paid=False)
        remaining_principal = unpaid_schedules.aggregate(
            total=Sum('principal_amount')
        )['total'] or Decimal('0.00')
        
        # Calculate actual new funds
        actual_new_funds = requested_amount - remaining_principal if requested_amount > remaining_principal else Decimal('0.00')
        
        # ✅ NEW: Validate share capital constraint
        member_share_capital = Decimal(str(account.shareCapital or 0))
        max_loan_amount = member_share_capital * 3
        
        if requested_amount > max_loan_amount:
            return Response({
                'eligible': False,
                'reason': f'Loan amount exceeds limit. Requested (₱{requested_amount:,.2f}) cannot exceed 3x share capital (₱{max_loan_amount:,.2f}).',
                'has_active_loan': True,
                'existing_loan': {
                    'control_number': existing_loan.control_number,
                    'loan_type': existing_loan.loan_type,
                    'loan_amount': float(existing_loan.loan_amount),
                    'remaining_principal': float(remaining_principal),
                },
                'share_capital_info': {
                    'share_capital': float(member_share_capital),
                    'max_allowed': float(max_loan_amount),
                    'requested_amount': float(requested_amount),
                }
            })
        
        # ✅ Validate that new loan amount is greater than remaining balance
        if requested_amount <= remaining_principal:
            return Response({
                'eligible': False,
                'reason': f'New loan amount (₱{requested_amount:,.2f}) must be GREATER than remaining balance (₱{remaining_principal:,.2f}). Minimum required: ₱{(remaining_principal + Decimal("0.01")):,.2f}',
                'has_active_loan': True,
                'existing_loan': {
                    'control_number': existing_loan.control_number,
                    'loan_type': existing_loan.loan_type,
                    'loan_amount': float(existing_loan.loan_amount),
                    'remaining_principal': float(remaining_principal),
                },
                'reloan_calculation': {
                    'requested_loan_amount': float(requested_amount),
                    'carried_balance': float(remaining_principal),
                    'minimum_required_amount': float(remaining_principal + Decimal("0.01")),
                }
            })
        
        return Response({
            'eligible': True,
            'reason': reason_msg,
            'has_active_loan': True,
            'existing_loan': {
                'control_number': existing_loan.control_number,
                'loan_type': existing_loan.loan_type,
                'loan_amount': float(existing_loan.loan_amount),
                'remaining_principal': float(remaining_principal),
            },
            'reloan_calculation': {
                'requested_loan_amount': float(requested_amount),
                'carried_balance': float(remaining_principal),
                'actual_new_funds': float(actual_new_funds),
                'minimum_required_amount': float(remaining_principal + Decimal("0.01")),
            },
            'share_capital_info': {
                'share_capital': float(member_share_capital),
                'max_allowed': float(max_loan_amount),
            }
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({
            'error': str(e)
        }, status=500)
# @api_view(['POST'])
# def check_reloan_eligibility(request):
#     """
#     Check if a member can apply for reloan and calculate amounts.
    
#     Request body:
#     {
#         "account_number": "2401-0001",
#         "requested_loan_type": "Regular",
#         "requested_loan_amount": 100000
#     }
#     """
#     try:
#         account_number = request.data.get('account_number')
#         requested_loan_type = request.data.get('requested_loan_type')
#         # Validate and coerce requested_loan_amount safely
#         raw_requested = request.data.get('requested_loan_amount', None)
#         if raw_requested is None or str(raw_requested).strip() == '':
#             return Response({
#                 'error': 'requested_loan_amount is required and must be a positive number.'
#             }, status=status.HTTP_400_BAD_REQUEST)
#         try:
#             requested_amount = Decimal(str(raw_requested))
#         except (InvalidOperation, ValueError, TypeError):
#             return Response({
#                 'error': 'Invalid requested_loan_amount. Please provide a numeric value.'
#             }, status=status.HTTP_400_BAD_REQUEST)
#         if requested_amount <= 0:
#             return Response({
#                 'error': 'requested_loan_amount must be greater than zero.'
#             }, status=status.HTTP_400_BAD_REQUEST)
        
#         # Get active loans
#         active_loans = Loan.objects.filter(
#             account__account_number=account_number,
#             status='Ongoing'
#         ).order_by('-loan_date')
        
#         if not active_loans.exists():
#             return Response({
#                 'eligible': True,
#                 'reason': 'No active loans. Can apply for new loan.',
#                 'has_active_loan': False
#             })
        
#         existing_loan = active_loans.first()
        
#         # Check eligibility
#         eligibility = existing_loan.can_apply_for_loan_type(requested_loan_type)
        
#         if not eligibility['can_apply']:
#             return Response({
#                 'eligible': False,
#                 'reason': eligibility['reason'],
#                 'has_active_loan': True,
#                 'existing_loan': {
#                     'control_number': existing_loan.control_number,
#                     'loan_type': existing_loan.loan_type,
#                     'loan_amount': float(existing_loan.loan_amount),
#                 }
#             })
        
#         # Calculate remaining balance
#         unpaid_schedules = existing_loan.paymentschedule_set.filter(is_paid=False)
#         remaining_principal = unpaid_schedules.aggregate(
#             total=Sum('principal_amount')
#         )['total'] or Decimal('0.00')
        
#         # Calculate what the new loan would provide
#         actual_new_funds = requested_amount - remaining_principal if requested_amount > remaining_principal else Decimal('0.00')
        
#         return Response({
#             'eligible': True,
#             'reason': eligibility['reason'],
#             'has_active_loan': True,
#             'existing_loan': {
#                 'control_number': existing_loan.control_number,
#                 'loan_type': existing_loan.loan_type,
#                 'loan_amount': float(existing_loan.loan_amount),
#                 'remaining_principal': float(remaining_principal),
#             },
#             'reloan_calculation': {
#                 'requested_loan_amount': float(requested_amount),
#                 'carried_balance': float(remaining_principal),
#                 'actual_new_funds': float(actual_new_funds),
#                 'minimum_required_amount': float(remaining_principal),
#             }
#         })
        
#     except Exception as e:
#         return Response({
#             'error': str(e)
#         }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        


@api_view(['POST'])
def process_advance_payment_with_reconstruction(request):
    """
    Process advance payment by:
    1. Deducting amount directly from remaining principal
    2. Reconstructing payment schedules based on new remaining principal
    
    ✅ FIXED: Prevents duplicate deductions and balance inflation
    """
    try:
        loan_control_number = request.data.get('loan_control_number')
        advance_amount = request.data.get('advance_amount')
        or_number = request.data.get('or_number')
        
        if not all([loan_control_number, advance_amount, or_number]):
            return Response({
                'error': 'Missing required fields'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate advance amount
        try:
            advance_amount = Decimal(str(advance_amount))
        except (InvalidOperation, ValueError, TypeError):
            return Response({
                'error': 'Invalid advance amount'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if advance_amount <= 0:
            return Response({
                'error': 'Advance amount must be greater than zero'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate OR number
        if not or_number or len(str(or_number).strip()) != 4:
            return Response({
                'error': 'Valid 4-digit OR number is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            # Get the loan with lock to prevent concurrent modifications
            try:
                loan = Loan.objects.select_for_update().get(control_number=loan_control_number)
            except Loan.DoesNotExist:
                return Response({
                    'error': 'Loan not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Check OR availability
            member = loan.account.account_holder
            other_member_usage = ORNumberTracker.objects.filter(
                or_number=or_number
            ).exclude(member=member).exists()
            
            if other_member_usage:
                return Response({
                    'error': f'OR {or_number} is already in use by another member'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # ✅ CRITICAL FIX: Calculate remaining principal from UNPAID schedules
            # This gives us the TRUE current balance, not the cached value
            unpaid_schedules = PaymentSchedule.objects.filter(
                loan=loan,
                is_paid=False
            ).select_for_update()
            
            # Calculate actual remaining principal from unpaid schedules
            actual_remaining = unpaid_schedules.aggregate(
                total=Sum('principal_amount')
            )['total'] or Decimal('0.00')
            
            print(f"\n{'='*70}")
            print(f"ADVANCE PAYMENT WITH RECONSTRUCTION")
            print(f"{'='*70}")
            print(f"Loan: {loan.control_number}")
            print(f"Cached Remaining Principal: ₱{loan.remaining_principal:,.2f}")
            print(f"Actual Remaining (from unpaid schedules): ₱{actual_remaining:,.2f}")
            print(f"Advance Amount: ₱{advance_amount:,.2f}")
            
            # ✅ Use actual remaining, not cached value
            if advance_amount > actual_remaining:
                return Response({
                    'error': f'Advance amount (₱{advance_amount:,.2f}) exceeds remaining principal (₱{actual_remaining:,.2f})'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Calculate new remaining principal AFTER deduction
            new_remaining_principal = (actual_remaining - advance_amount).quantize(Decimal('0.01'))
            
            print(f"New Remaining Principal: ₱{new_remaining_principal:,.2f}")
            
            # Count how many schedules we're about to delete (for logging)
            deleted_count = unpaid_schedules.count()
            print(f"Deleting {deleted_count} unpaid schedules...")
            
            # ✅ DELETE all unpaid schedules BEFORE reconstruction
            unpaid_schedules.delete()
            
            # ✅ Update loan's remaining principal to the NEW value
            loan.remaining_principal = new_remaining_principal
            
            # Check if loan is now fully paid
            if new_remaining_principal <= Decimal('0.00'):
                loan.status = 'Settled'
                loan.archived = True
                loan.save(update_fields=['status', 'archived', 'remaining_principal'])
                
                # Create OR tracker
                ORNumberTracker.objects.get_or_create(
                    member=member,
                    or_number=or_number,
                    defaults={
                        'loan_type': loan.loan_type,
                        'loan': loan,
                        'is_active': False  # Loan is settled
                    }
                )
                
                # Archive the payment
                account = loan.account
                ArchivedPayment.objects.create(
                    account_number=account.account_number,
                    account_holder=f"{member.first_name} {member.middle_name or ''} {member.last_name}".strip(),
                    payment_amount=advance_amount,
                    loan_type=loan.loan_type,
                    date_paid=timezone.now(),
                    or_number=or_number,
                    payment_type='Advance Payment (Loan Settled)',
                    archived_by=request.user if request.user.is_authenticated else None
                )
                
                print(f"✅ Loan fully paid and settled")
                print(f"{'='*70}\n")
                
                return Response({
                    'success': True,
                    'message': 'Congratulations! Loan fully paid with advance payment.',
                    'loan_settled': True,
                    'advance_amount': str(advance_amount),
                    'remaining_principal': '0.00',
                    'schedules_deleted': deleted_count,
                    'new_schedules_created': 0
                }, status=status.HTTP_200_OK)
            
            # ✅ RECONSTRUCT payment schedules with the NEW remaining principal
            # Get paid schedules count to determine starting position
            paid_count = PaymentSchedule.objects.filter(loan=loan, is_paid=True).count()
            
            # Use the CURRENT edited per-payment principal if available
            # Prefer the next unpaid schedule's principal_amount over original fixed principal
            next_unpaid = PaymentSchedule.objects.filter(loan=loan, is_paid=False).order_by('due_date').first()
            current_per_payment = None
            try:
                if next_unpaid and next_unpaid.principal_amount and Decimal(next_unpaid.principal_amount) > Decimal('0.00'):
                    current_per_payment = Decimal(next_unpaid.principal_amount)
            except Exception:
                current_per_payment = None
            fixed_principal = current_per_payment or (loan.principal or (loan.loan_amount / loan.total_payments))
            
            # ✅ Calculate how many NEW payments are needed for the REMAINING balance
            new_payment_count = math.ceil(float(new_remaining_principal) / float(fixed_principal))
            
            print(f"Creating {new_payment_count} new schedules...")
            print(f"Per-payment principal used: ₱{fixed_principal:,.2f}")
            
            # ✅ Distribute the NEW remaining principal across schedules
            principals = []
            running_sum = Decimal('0.00')
            
            # All payments except last get fixed principal
            for i in range(new_payment_count - 1):
                p = min(fixed_principal, new_remaining_principal - running_sum).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
                principals.append(p)
                running_sum += p
            
            # Last payment gets the exact remainder (handles rounding)
            if new_payment_count > 0:
                last_principal = (new_remaining_principal - running_sum).quantize(Decimal('0.01'))
                if last_principal > Decimal('0.00'):
                    principals.append(last_principal)
            
            # ✅ Verify distribution matches remaining principal
            total_distributed = sum(principals)
            if abs(total_distributed - new_remaining_principal) > Decimal('0.01'):
                print(f"⚠️ WARNING: Distribution mismatch!")
                print(f"   Expected: ₱{new_remaining_principal:,.2f}")
                print(f"   Got: ₱{total_distributed:,.2f}")
                # Adjust last payment to fix rounding
                if principals:
                    principals[-1] += (new_remaining_principal - total_distributed)
            
            # Create new schedules starting 15 days from today
            running_balance = new_remaining_principal
            start_date = timezone.now().date() + timedelta(days=15)
            
            created_schedules = []
            for idx, principal_amt in enumerate(principals):
                due_date = start_date + timedelta(days=idx * 15)
                
                # Determine year number based on total position
                total_position = paid_count + idx
                year_number = (total_position // 24) + 1
                
                # Get interest portion for this year from recalculation
                interest_portion = Decimal('0.00')
                if year_number > 1:
                    recalc = LoanYearlyRecalculation.objects.filter(
                        loan=loan,
                        year=year_number
                    ).first()
                    
                    if recalc:
                        # Interest distributed evenly across 24 payments
                        interest_portion = (recalc.interest_amount / Decimal('24')).quantize(
                            Decimal('0.01'), rounding=ROUND_HALF_UP
                        )
                
                # Payment amount = principal + interest
                payment_amount = (principal_amt + interest_portion).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
                
                # Update running balance (decreases as we go)
                running_balance = (running_balance - principal_amt).quantize(Decimal('0.01'))
                if running_balance < Decimal('0.00'):
                    running_balance = Decimal('0.00')
                
                # Create the new schedule
                schedule = PaymentSchedule.objects.create(
                    loan=loan,
                    principal_amount=principal_amt,
                    interest_portion=interest_portion,
                    payment_amount=payment_amount,
                    # Preserve the original floor but reflect current per-payment principal
                    original_principal=loan.principal or fixed_principal,
                    due_date=due_date,
                    balance=running_balance,
                    remaining_balance=running_balance,
                    loan_type=loan.loan_type,
                    year_number=year_number,
                    is_paid=False,
                    advance_pay=Decimal('0.00'),
                    under_pay=Decimal('0.00'),
                    penalty=Decimal('0.00')
                )
                created_schedules.append(schedule)
                
                print(f"   Schedule {idx+1}: Principal ₱{principal_amt:,.2f}, Interest ₱{interest_portion:,.2f}, Total ₱{payment_amount:,.2f}, Balance ₱{running_balance:,.2f}")
            
            # ✅ Save the updated loan with new remaining principal
            loan.save(update_fields=['remaining_principal'])
            
            print(f"✅ Created {len(principals)} new payment schedules")
            print(f"✅ Updated loan remaining_principal to ₱{new_remaining_principal:,.2f}")
            
            # Create OR tracker (or update existing)
            ORNumberTracker.objects.update_or_create(
                member=member,
                or_number=or_number,
                defaults={
                    'loan_type': loan.loan_type,
                    'loan': loan,
                    'is_active': True
                }
            )
            
            # Archive the payment
            account = loan.account
            ArchivedPayment.objects.create(
                account_number=account.account_number,
                account_holder=f"{member.first_name} {member.middle_name or ''} {member.last_name}".strip(),
                payment_amount=advance_amount,
                loan_type=loan.loan_type,
                date_paid=timezone.now(),
                or_number=or_number,
                payment_type='Advance Payment (Schedule Reconstruction)',
                archived_by=request.user if request.user.is_authenticated else None
            )
            
            print(f"{'='*70}\n")
            
            return Response({
                'success': True,
                'message': 'Advance payment processed successfully. Schedules reconstructed.',
                'loan_settled': False,
                'advance_amount': str(advance_amount),
                'previous_remaining_principal': str(actual_remaining),
                'new_remaining_principal': str(new_remaining_principal),
                'schedules_deleted': deleted_count,
                'new_schedules_created': len(principals),
                'next_due_date': str(start_date) if principals else None,
                'verification': {
                    'expected_total': str(new_remaining_principal),
                    'distributed_total': str(sum(principals)),
                    'matches': abs(sum(principals) - new_remaining_principal) <= Decimal('0.01')
                }
            }, status=status.HTTP_200_OK)
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)