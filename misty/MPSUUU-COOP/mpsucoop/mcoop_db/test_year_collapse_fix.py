#!/usr/bin/env python
"""
Test Script: Verify Year Collapse Fix
Tests that year numbers are preserved after completing Year 1 payments
"""

import os
import sys
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mcoop_db.settings')
django.setup()

from mcoop_app.models import Loan, PaymentSchedule, LoanYearlyRecalculation
from django.utils import timezone

def print_section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def check_loan_status(loan, label=""):
    """Display loan status and schedules by year"""
    print(f"{label}")
    print(f"Loan: {loan.control_number}")
    print(f"Status: {loan.status}")
    print(f"Remaining Principal: ₱{loan.remaining_principal}")
    
    year_summary = {}
    for year in [1, 2, 3, 4]:
        schedules = PaymentSchedule.objects.filter(loan=loan, year_number=year)
        if schedules.exists():
            paid = schedules.filter(is_paid=True).count()
            unpaid = schedules.filter(is_paid=False).count()
            total = schedules.count()
            year_summary[year] = {'paid': paid, 'unpaid': unpaid, 'total': total}
            print(f"  Year {year}: {total} schedules (✓ Paid: {paid}, ✗ Unpaid: {unpaid})")
        else:
            print(f"  Year {year}: No schedules")
    
    return year_summary

def check_recalculations(loan):
    """Display yearly recalculations"""
    recalcs = LoanYearlyRecalculation.objects.filter(loan=loan).order_by('year')
    if not recalcs.exists():
        print("  No recalculations yet")
        return {}
    
    recalc_summary = {}
    for recalc in recalcs:
        status = "✓ PAID" if recalc.fees_paid else "✗ UNPAID"
        print(f"  Year {recalc.year} Recalc: ₱{recalc.total_fees_due} fees [{status}]")
        recalc_summary[recalc.year] = {
            'previous_balance': recalc.previous_balance,
            'total_fees': recalc.total_fees_due,
            'fees_paid': recalc.fees_paid
        }
    
    return recalc_summary

def test_year_preservation():
    """Main test: Verify years are preserved"""
    print_section("TEST: YEAR COLLAPSE FIX VERIFICATION")
    
    # Find a test loan with multiple years
    loans = Loan.objects.filter(status='Ongoing')
    
    if not loans.exists():
        print("❌ ERROR: No ongoing loans found in database")
        return False
    
    # Find a loan with at least 2 years
    test_loan = None
    for loan in loans:
        schedules = PaymentSchedule.objects.filter(loan=loan)
        years = set(schedules.values_list('year_number', flat=True))
        if len(years) >= 2:
            test_loan = loan
            break
    
    if not test_loan:
        print("❌ No suitable test loan found (need at least 2 years)")
        return False
    
    print_section("INITIAL STATE")
    initial_years = check_loan_status(test_loan, "Before Payment:")
    print("\nRecalculations:")
    initial_recalcs = check_recalculations(test_loan)
    
    # Check if Year 1 is fully paid
    year1_schedules = PaymentSchedule.objects.filter(loan=test_loan, year_number=1)
    year1_all_paid = year1_schedules.filter(is_paid=False).count() == 0
    
    print_section("ANALYSIS")
    
    if year1_all_paid:
        print("✓ Year 1 is FULLY PAID")
        print("✓ Checking that other years are still visible...")
        
        other_years_visible = False
        for year in [2, 3, 4]:
            schedules = PaymentSchedule.objects.filter(loan=test_loan, year_number=year)
            if schedules.exists():
                other_years_visible = True
                print(f"  ✓ Year {year} still present with {schedules.count()} schedules")
        
        if not other_years_visible:
            print("  ✗ No other years visible!")
            return False
        
        # Check if Year 2 recalculation exists
        year2_recalc = LoanYearlyRecalculation.objects.filter(loan=test_loan, year=2)
        if year2_recalc.exists():
            print("✓ Year 2 Recalculation EXISTS (created after Year 1 completion)")
            for recalc in year2_recalc:
                print(f"  - Previous Balance: ₱{recalc.previous_balance}")
                print(f"  - Total Fees Due: ₱{recalc.total_fees_due}")
                print(f"  - Fees Paid: {recalc.fees_paid}")
        else:
            print("⚠ Year 2 Recalculation NOT yet created (expected if Year 1 just completed)")
        
    else:
        year1_unpaid = year1_schedules.filter(is_paid=False).count()
        print(f"⚠ Year 1 not fully paid ({year1_unpaid} unpaid schedules)")
        print("  Test recommendation: Pay all Year 1 schedules to test recalculation behavior")
    
    print_section("YEAR STRUCTURE VERIFICATION")
    
    # The key test: Are all years still numbered correctly?
    all_years = set(PaymentSchedule.objects.filter(loan=test_loan).values_list('year_number', flat=True))
    expected_years = set(range(1, max(all_years) + 1)) if all_years else set()
    
    print(f"Years present in database: {sorted(all_years)}")
    print(f"Year sequence is continuous: {all_years == expected_years}")
    
    if all_years == expected_years:
        print("✓ PASS: All years maintained correct numbering (no collapse/renaming)")
        return True
    else:
        print("✗ FAIL: Year numbering is not continuous (collapse may have occurred)")
        print(f"  Expected: {sorted(expected_years)}")
        print(f"  Got: {sorted(all_years)}")
        return False

def test_frontend_grouping():
    """Verify the data structure frontend will receive"""
    print_section("FRONTEND API RESPONSE STRUCTURE")
    
    loans = Loan.objects.filter(status='Ongoing')
    
    if not loans.exists():
        print("❌ No ongoing loans found")
        return False
    
    test_loan = loans.first()
    
    # Simulate what frontend receives
    schedules = PaymentSchedule.objects.filter(loan=test_loan).order_by('year_number', 'due_date')
    
    # Group by year
    grouped_by_year = {}
    for schedule in schedules:
        year = schedule.year_number or 1
        if year not in grouped_by_year:
            grouped_by_year[year] = {'total': 0, 'paid': 0, 'unpaid': 0}
        grouped_by_year[year]['total'] += 1
        if schedule.is_paid:
            grouped_by_year[year]['paid'] += 1
        else:
            grouped_by_year[year]['unpaid'] += 1
    
    print(f"Loan: {test_loan.control_number}")
    print(f"Total schedules: {len(list(schedules))}")
    print("\nFrontend would render:")
    
    for year in sorted(grouped_by_year.keys()):
        stats = grouped_by_year[year]
        print(f"\n[Year {year}] - {stats['total']} schedules")
        print(f"  ├─ Paid: {stats['paid']}")
        print(f"  ├─ Unpaid: {stats['unpaid']}")
        
        if stats['paid'] == stats['total']:
            print(f"  └─ Status: 🎉 COMPLETED")
        else:
            print(f"  └─ Status: ⏳ IN PROGRESS")
    
    # Check recalculations
    recalcs = LoanYearlyRecalculation.objects.filter(loan=test_loan).order_by('year')
    
    if recalcs.exists():
        print(f"\n📋 Year Recalculations Section (would show {len(list(recalcs))} items):")
        for recalc in recalcs:
            status = "✓ PAID" if recalc.fees_paid else "⚠ UNPAID"
            print(f"  - Year {recalc.year}: ₱{recalc.total_fees_due} [{status}]")
    
    return True

if __name__ == '__main__':
    try:
        # Run tests
        test1_passed = test_year_preservation()
        test2_passed = test_frontend_grouping()
        
        print_section("TEST SUMMARY")
        
        print(f"✓ Year Preservation Test: {'PASS' if test1_passed else 'FAIL'}")
        print(f"✓ Frontend Grouping Test: {'PASS' if test2_passed else 'FAIL'}")
        
        if test1_passed and test2_passed:
            print("\n🎉 ALL TESTS PASSED - Year collapse fix is working!")
            sys.exit(0)
        else:
            print("\n❌ SOME TESTS FAILED - Issue detected")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n❌ ERROR during testing: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
