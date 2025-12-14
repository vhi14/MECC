from django.urls import path, include
from . import views
from rest_framework.routers import DefaultRouter
from .views import (AdminProfileView,
     MemberViewSet, 
     AccountViewSet, 
     LoanViewSet,
     PaymentScheduleViewSet,
     PaymentViewSet, get_total_penalties,
     UpdateMemberViews, 
     update_breakdown,revert_to_original_schedule,
     UserListView, ResetPasswordView,
     ActiveLoansByAccountView,RegisterMemberView, AccountTransactionView, MemberLoginView,LogoutView, MemberProfileView, MemberLoanListView, TokenObtainPairView, SystemSettingsView,
     payment_schedules_by_loan, AccountDetailView, get_payments, MemberPaymentsView,PaymentListByScheduleView, PaymentsByAccountView, ArchiveViewSet,loan_summary, LogActionAPIView, GetAuditLogsAPIView,process_payment_view,check_loan_eligibility,check_or_availability, PaymentEventView
)
from rest_framework_simplejwt import views as jwt_views
import logging
from .views import WithdrawView
from .views import UpdateStatusView
from .views import get_members, update_employment_status,debug_penalty_status
# from mcoop_app.views import AuditTrailView
from .views import UnifiedLoginView


logger = logging.getLogger(__name__)
router = DefaultRouter()
router.register(r'members', MemberViewSet, basename='member')
router.register(r'accounts', AccountViewSet)
router.register(r'loans', LoanViewSet, basename='loan') 
router.register(r'payment-schedules', PaymentScheduleViewSet, basename='payment-schedules')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'archives', ArchiveViewSet, basename='archived-records')

urlpatterns = [
    # ✅ MORE SPECIFIC ROUTES MUST COME BEFORE router.urls
    path('loans/check-reloan-eligibility/', views.check_reloan_eligibility, name='check-reloan-eligibility'),
    path('loans/process-reloan/', views.process_reloan, name='process-reloan'),
    
    # ✅ THEN include the router
    path('', include(router.urls)),
    path('users/', UserListView.as_view(), name='user_list'),
    path("login/", UnifiedLoginView.as_view(), name="unified-login"),
    path('health/', views.health, name='health'),
    path('api/loan-summary/', views.loan_summary, name='loan_summary'),
    path('forgot-password/', views.forgot_password, name='forgot_password'),
    path('reset-password/<uidb64>/<token>/', views.reset_password, name='reset-password'),
    path('accounts/<str:account_number>/sharecapital/', views.get_account_sharecapital, name='get_account_sharecapital'),
    # path('api/archived-records/', ArchivedRecordsView.as_view(), name='archived_records'),
    path('api/total-penalties/', get_total_penalties, name='total-penalties'),
    path('api/account/<str:account_number>/transactions/', AccountTransactionView.as_view(), name='account-transactions'),
    path('users/<int:pk>/reset-password/', ResetPasswordView.as_view(), name='reset_password'),
    path('update-breakdown/', views.update_breakdown, name='update-breakdown'),
    path('revert-to-original/', views.revert_to_original_schedule, name='revert-to-original'), 
    path('update-user-password/', UpdateMemberViews.as_view(), name="update-user-password"),
    path('payment-schedules/<int:id>/mark-paid/', views.mark_as_paid, name='mark_as_paid'),
    path('register/', RegisterMemberView.as_view(), name='register_member'),  
    path('login/member/', views.member_login, name='member-login'),   
    path('login/admin/', jwt_views.TokenObtainPairView.as_view(), name='admin_login'),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', jwt_views.TokenRefreshView.as_view(), name='token_refresh'),  
    path('api/member/profile/', MemberProfileView.as_view(), name='member-profile'),
    path('api/logout/', LogoutView.as_view(), name='logout'),
    path('api/system-settings/', SystemSettingsView.as_view(), name='system-settings'),
    path('api/loans/by_account/', LoanViewSet.as_view({'get': 'by_account'})),
    path('api/payment-schedules/<str:loan_control_number>/', payment_schedules_by_loan, name='payment-schedules-by-loan'),
    path('api/loans/<uuid:control_number>/', LoanViewSet.as_view({'get': 'retrieve'})),
    path('api/payments/<uuid:control_number>/', views.get_payments, name='get_payments'),
    path('api/member-payments/', MemberPaymentsView.as_view(), name='member-payments'),
    path('api/account/details/', AccountDetailView.as_view(), name='account-details'),
    path('payments/<int:payment_schedule_id>/', PaymentListByScheduleView.as_view(), name='payment-list-by-schedule'),
    path('api/payments/<int:paymentScheduleId>/', views.get_payments_by_schedule, name='get_payments_by_schedule'),
    path('api/payments/by_account/', PaymentsByAccountView.as_view(), name='payments-by-account'),
    path('log-action/', LogActionAPIView.as_view(), name='log_action'),
    path('audit-logs/', GetAuditLogsAPIView.as_view(), name='audit_logs'),
    # Optionally log or print when Django processes a request to the API
    path('accounts/<str:account_number>/withdraw/', WithdrawView.as_view(), name='withdraw'),
    path('accounts/<str:account_number>/update-status/', UpdateStatusView.as_view(), name='update-status'),
    path('delete-account/<str:account_number>/', views.delete_account, name='delete_account'),
    path("get-members/", get_members, name="get-members"),
    # path('api/audit-trail/', AuditTrailView.as_view(), name='audit-trail'),
    path('api/admin-profile/', AdminProfileView.as_view(), name='admin-profile'),

    path('payment-schedule/<int:pk>/process-payment/', process_payment_view, name='process-payment'),
    path('re-admit-member/<int:mem_id>/', views.re_admit_member, name='re_admit_member'),
    path('process-advance-payment-reconstruction/', views.process_advance_payment_with_reconstruction, name='process_advance_payment_reconstruction'),
    path('archive-payment-record/', views.archive_payment_record, name='archive_payment_record'),
    path('archived-payment-records/', views.get_archived_payment_records, name='get_archived_payment_records'),
    path('archived-payment-records/<int:payment_id>/', views.delete_archived_payment_record, name='delete_archived_payment_record'),
    path('payment-history/', views.save_payment_history, name='save_payment_history'),
    path('payment-history/<str:account_number>/', views.get_payment_history, name='get_payment_history'),
    #Thursday
    path('api/check-loan-eligibility/<str:account_number>/', check_loan_eligibility, name='check_loan_eligibility'),
    path('loans/<str:pk>/detailed_loan_info/', 
         views.LoanViewSet.as_view({'get': 'detailed_loan_info'}), 
         name='loan-detailed-info'),
    path('check-or-availability/<str:account_number>/<str:or_number>/', 
         views.check_or_availability,
         name='check-or-availability'),

    path('api/total-fees-breakdown/', views.get_total_fees_breakdown, name='total-fees-breakdown'),
    path('api/active-members-count/', views.get_active_members_count, name='active-members-count'),
    path('check-or-number/', views.check_or_number, name='check-or-number'),  # ✅ Keep only ONE
    path('debug-recalculations/<str:control_number>/', views.debug_recalculations, name='debug-recalculations'),
    # recently lang ngem ilam san import ed ngato metlang
    path('members/<int:mem_id>/employment-status/', update_employment_status, name='update_employment_status'),
    path('debug-penalty/<int:schedule_id>/', debug_penalty_status, name='debug_penalty'),
    path('api/penalties/yearly/<int:year>/', 
         views.get_yearly_penalty_collections, 
         name='yearly_penalty_collections'),
    path('api/penalties/yearly/current/', 
         views.get_yearly_penalty_collections, 
         name='current_year_penalties'),
    # historical 
    path('api/yearly-summary/<int:year>/', views.get_yearly_summary, name='yearly_summary'),
    path('api/yearly-summary/current/', views.get_current_year_summary, name='current_year_summary'),
    path('api/yearly-summary/all/', views.get_all_yearly_summaries, name='all_yearly_summaries'),
    path('api/yearly-summary/finalize/', views.finalize_year_manual, name='finalize_year'),
    
    # Detailed breakdowns by year
    path('api/yearly-fees/<int:year>/', views.get_yearly_fees_breakdown, name='yearly_fees_breakdown'),
    path('api/yearly-loans/<int:year>/', views.get_yearly_loans_breakdown, name='yearly_loans_breakdown'),
    path('api/yearly-penalties/<int:year>/', views.get_yearly_penalties_breakdown, name='yearly_penalties_breakdown'),
    path('api/yearly-fees/pay/', views.pay_yearly_fees, name='pay_yearly_fees'),
     # Dual-mode payment event endpoint
     path('loans/<str:control_number>/payment-event/', PaymentEventView.as_view(), name='payment_event'),
]   
def log_request(request):
    logger.info(f"Request made to: {request.path}")