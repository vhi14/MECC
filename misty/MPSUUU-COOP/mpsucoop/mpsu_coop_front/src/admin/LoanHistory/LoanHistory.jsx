import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FaRegCreditCard, FaArchive} from "react-icons/fa";
import { TbFilterEdit } from "react-icons/tb";
import { FaTrash, FaEye } from "react-icons/fa";
import './LoanHistory.css';

const LoanManager = () => {
    const [members, setMembers] = useState([]);
    const [loans, setLoans] = useState([]);
    const [accountsList, setAccountList] = useState([]);

    const [employedMembers, setEmployedMembers] = useState([]);

    const [loanData, setLoanData] = useState({
        name: '',
        account: '',
        loan_amount: '',
        loan_period: '',
        loan_period_unit: 'years',
        loan_type: 'Regular',
        purpose: 'Education',
        status: 'Ongoing',
        co_maker: "",
        co_maker_2: "",
        co_maker_3: "",
        co_maker_4: "",
        co_maker_5: "",
        
        co_maker_id: null,
        co_maker_2_id: null,
        co_maker_3_id: null,
        co_maker_4_id: null,
        co_maker_5_id: null,
        account_holder:""
    });
    const [coMakers, setCoMakers] = useState([]);
    const [makersModal, setMakersModal] = useState(false);
    const [formVisible, setFormVisible] = useState(false);
    const [editingLoan, setEditingLoan] = useState(null);
    const [errors, setErrors] = useState(null);
    const [paymentFormVisible, setPaymentFormVisible] = useState(false);
    const [selectedLoanForPayment, setSelectedLoanForPayment] = useState(null);
    const [showPrintButton, setShowPrintButton] = useState(false);
    const [newLoan, setNewLoan] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showOtherPurpose, setShowOtherPurpose] = useState(false);
    const [showPopup, setShowPopup] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [showFilterOptions, setShowFilterOptions] = useState(false);
    const [filter, setFilter] = useState('');
    const [filteredLoans, setFilteredLoans] = useState(loans);
    const [selectedDate, setSelectedDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showNoLoanPopup, setShowNoLoanPopup] = useState(false);
    const [shareCapital, setShareCapital] = useState(null);
    const [loanSubmitted, setLoanSubmitted] = useState(false);
    const [makerOneSearch, setMakerOneSearch] = useState([]);
    const [makerTwoSearch, setMakerTwoSearch] = useState([]);
    const [makerThreeSearch, setMakerThreeSearch] = useState([]);
    const [makerFourSearch,setMakerFourSearch] = useState([]);
    const [makerFiveSearch,setMakerFiveSearch] = useState([]);
    const [membersName, setMemberNames] = useState([]);
    const [accountHolder, setAccountHolder] = useState([]);
    const [activeLoanType, setActiveLoanType] = useState('Regular');
    const [eligibilityStatus, setEligibilityStatus] = useState(null);
    const [checkingEligibility, setCheckingEligibility] = useState(false);
    const [isReloanMode, setIsReloanMode] = useState(false);
    const [existingLoanForReloan, setExistingLoanForReloan] = useState(null);
    const [reloanCalculation, setReloanCalculation] = useState(null);

    // Helper: detect amount-only eligibility errors (shouldn't disable entire form)
    const isAmountOnlyError = (msg) => {
        if (!msg) return false;
        const text = String(msg).toLowerCase();
        return (
            text.includes('loan amount') ||
            text.includes('minimum required') ||
            text.includes('remaining balance') ||
            text.includes('must be greater') ||
            text.includes('emergency loans must be exactly') ||
            text.includes('₱50,000')
        );
    };

    // Disable fields only for member-level ineligibility, not amount-only issues
    const fieldsDisabled = !checkingEligibility && !!eligibilityStatus && eligibilityStatus.eligible === false && !isAmountOnlyError(eligibilityStatus.message);

    // Inline error helpers to avoid mixed/"random" messages
    const setAmountError = (message) => {
        setErrors((prev) => {
            const next = { ...(prev || {}) };
            next.loan_amount = message;
            // If amount-only message, remove name error
            if (isAmountOnlyError(message) && next.account_holder) {
                delete next.account_holder;
            }
            return next;
        });
    };

    const setMemberError = (message) => {
        setErrors((prev) => {
            const next = { ...(prev || {}) };
            next.account_holder = message;
            // Remove amount-only error when showing member-level error
            if (next.loan_amount && isAmountOnlyError(next.loan_amount)) {
                delete next.loan_amount;
            }
            return next;
        });
    };

    const clearAmountError = () => {
        setErrors((prev) => {
            if (!prev || !prev.loan_amount) return prev;
            if (isAmountOnlyError(prev.loan_amount)) {
                const { loan_amount, ...rest } = prev;
                return rest;
            }
            return prev;
        });
    };

    const clearMemberError = () => {
        setErrors((prev) => {
            if (!prev || !prev.account_holder) return prev;
            const { account_holder, ...rest } = prev;
            return rest;
        });
    };

    const BASE_URL = `${process.env.REACT_APP_API_URL}`;

   
    const safeText = (value) => {
        if (value == null) return '';
        if (typeof value === 'object') {
            try { return JSON.stringify(value); } catch { return String(value); }
        }
        return String(value);
    };
    const navigate = useNavigate();

    const isReloan = (loan) => {
        if (!loan) return false;
        return !!(loan.is_reloan || loan.reloan_of || loan.original_loan_control_number);
    };

    const ReloanBadge = ({ loan, compact = false }) => {
        if (!isReloan(loan)) return null;
        const parentCN = loan.reloan_of || loan.original_loan_control_number || null;
        const baseStyle = {
            marginLeft: compact ? 6 : 10,
            padding: compact ? '2px 6px' : '4px 10px',
            backgroundColor: '#e6f4ea',
            color: '#1e7e34',
            borderRadius: 12,
            fontSize: compact ? 11 : 12,
            fontWeight: 700,
            verticalAlign: 'middle'
        };
        return (
            <span style={baseStyle}>
                RELOAN{parentCN ? ` • From ${parentCN}` : ''}
            </span>
        );
    };

    // --- Archive visibility helper ---
    const canArchive = (loan) => {
        if (!loan || !loan.status) return false;
        return String(loan.status).toLowerCase() === 'settled';
    };

    // AUTO SET LOAN TERM UNIT BASED ON LOAN TYPE
    useEffect(() => {
        if (loanData.loan_type === 'Regular') {
            setLoanData(prev => ({ ...prev, loan_period_unit: 'years' }));
        } else if (loanData.loan_type === 'Emergency') {
            setLoanData(prev => ({ ...prev, loan_period_unit: 'months' }));
        }
    }, [loanData.loan_type]);

    // CO-MAKER VALIDATION FUNCTION
    // recently lang
    const validateCoMakers = () => {
        const errors = {};
        const {
            account_holder,
            loan_amount,
            loan_type,
            co_maker_id,
            co_maker_2_id,
            co_maker_3_id,
            co_maker_4_id,
            co_maker_5_id
        } = loanData;

        // Collect non-null ids
        const ids = [co_maker_id, co_maker_2_id, co_maker_3_id, co_maker_4_id, co_maker_5_id].filter(Boolean);
        const loanAmountNum = parseInt(loan_amount) || 0;

        // ✅ If Emergency and key fields are empty, show precise guidance
        if (loan_type === 'Emergency') {
            const missing = [];
            if (!account_holder || String(account_holder).trim() === '') missing.push('member name');
            if (!loan_amount || String(loan_amount).trim() === '' || isNaN(parseInt(loan_amount))) missing.push('loan amount');
            if (!loanData.loan_period || String(loanData.loan_period).trim() === '') missing.push('loan term');

            if (missing.length > 0) {
                errors.comakers_required = `Before selecting co-makers for Emergency loans, please enter: ${missing.join(', ')}`;
                return errors;
            }
        }

        // ✅ REQUIREMENT: Determine minimum comakers based on loan amount and loan type
        let minComakers = 0;
        
        // Emergency loans only need 1 co-maker regardless of amount
        if (loan_type === 'Emergency') {
            minComakers = 1;
        } else {
            // Regular loans
            if (loanAmountNum < 500000) {
                minComakers = 0;  // Loans under ₱500k don't strictly need comakers
            } else if (loanAmountNum < 1000000) {
                minComakers = 1;  // ₱500k - ₱999k need 1+ comakers
            } else if (loanAmountNum < 1250000) {
                minComakers = 2;  // ₱1M - ₱1.24M need 2+ comakers
            } else if (loanAmountNum < 1500000) {
                minComakers = 3;  // ₱1.25M - ₱1.49M need 3+ comakers
            } else if (loanAmountNum <= 1500000) {
                minComakers = 5;  // ₱1.5M need 5 comakers
            } else {
                // ✅ Loans ABOVE ₱1.5M - no comaker requirement error
                minComakers = 0;
            }
        }

        // ✅ Check: Minimum comakers requirement (only if minComakers > 0)
        if (minComakers > 0 && ids.length < minComakers) {
            errors.comakers_required = loan_type === 'Emergency'
                ? `Emergency loans require at least ${minComakers} co-maker(s). Currently selected: ${ids.length}`
                : `This loan amount requires at least ${minComakers} co-maker(s). Currently selected: ${ids.length}`;
        }

        // Resolve account holder's memId from membersName (which has proper formatting)
        const accountHolderObj = membersName.find(m => 
            m.name.toLowerCase() === (account_holder || '').toLowerCase()
        );
        const accountHolderId = accountHolderObj?.memId || null;

        // 1) Co-maker cannot be the account holder
        ids.forEach((id, idx) => {
            if (accountHolderId && String(id) === String(accountHolderId)) {
                const key = idx === 0 ? 'co_maker' : `co_maker_${idx + 1}`;
                errors[key] = 'Co-maker cannot be the account holder';
            }
        });

        // 2) Co-makers must be unique
        const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
        if (dupes.length > 0) {
            dupes.forEach(dupe => {
                ids.forEach((id, idx) => {
                    if (String(id) === String(dupe)) {
                        const key = idx === 0 ? 'co_maker' : `co_maker_${idx + 1}`;
                        errors[key] = 'Co-makers must be different from each other';
                    }
                });
            });
        }

        // 3) Ensure selected co-makers are in employedMembers (must be employed)
        ids.forEach((id, idx) => {
            const m = employedMembers.find(em => String(em.memId) === String(id));
            if (!m) {
                const key = idx === 0 ? 'co_maker' : `co_maker_${idx + 1}`;
                errors[key] = 'Selected co-maker is not an employed member';
            }
        });

        return errors;
    };


    const autoArchivePaidOffLoans = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const paidOffLoans = loans.filter(loan => loan.status.toLowerCase() === 'settled');
            
            if (paidOffLoans.length > 0) {
                for (const loan of paidOffLoans) {
                    await axios.post(`${BASE_URL}/archives/`, {
                        archive_type: 'Loan',
                        archived_data: loan
                    }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    
                    await axios.delete(`${BASE_URL}/loans/${loan.control_number}/`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                }
                
                await fetchLoans();
                
                setPopupMessage(`${paidOffLoans.length} settled loan(s) have been automatically archived.`);
                setShowPopup(true);
                setTimeout(() => {
                    setShowPopup(false);
                }, 2000);
            }
        } catch (error) {
            setShowPopup(true);
        }
    };

    const archiveLoan = async (loan) => {
        try {
            let token = localStorage.getItem('authToken') || 
                       localStorage.getItem('token') || 
                       localStorage.getItem('access_token') ||
                       localStorage.getItem('accessToken');
            
            if (!token) {
                token = sessionStorage.getItem('authToken') || 
                       sessionStorage.getItem('token') || 
                       sessionStorage.getItem('access_token') ||
                       sessionStorage.getItem('accessToken');
            }
            
            if (!token) {
                setPopupMessage('Authentication token not found. Please log in again.');
                setShowPopup(true);
                return;
            }

            const archiveResponse = await axios.post(`${BASE_URL}/archives/`, {
                archive_type: 'Loan',
                archived_data: loan
            }, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const deleteResponse = await axios.delete(`${BASE_URL}/loans/${loan.control_number}/`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            await fetchLoans();
            
            setPopupMessage('Loan has been archived successfully.');
            setShowPopup(true);
            setTimeout(() => {
                setShowPopup(false);
            }, 2000);
            
        } catch (error) {
            console.error('Error archiving loan:', error);
            
            let errorMessage = 'Error archiving loan. Please try again.';
            
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                
                if (status === 401) {
                    errorMessage = 'Authentication failed. Please log in again.';
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('token');
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('accessToken');
                } else if (status === 403) {
                    errorMessage = 'Permission denied. You do not have access to archive loans.';
                } else {
                    errorMessage = data?.message || data?.detail || `Server error: ${status}`;
                }
            } else if (error.request) {
                errorMessage = 'Network error. Please check your connection.';
            }
            
            setPopupMessage(errorMessage);
            setShowPopup(true);
            setTimeout(() => {
                setShowPopup(false);
            }, 2000);
        }
    };

    const quickEligibilityCheck = async (memberName, loanType) => {
        if (!memberName || !loanType) return;
        setCheckingEligibility(true);
        try {
            const result = await validateReloaning(memberName, loanType);
            setCheckingEligibility(false);
            if (result.canReloan) {
                setIsReloanMode(false);
                setExistingLoanForReloan(null);
                setReloanCalculation(null);
                setEligibilityStatus({ eligible: true, message: result.message || '✅ Eligible to apply for this loan type' });
            } else {
                setIsReloanMode(false);
                setExistingLoanForReloan(null);
                setReloanCalculation(null);
                setEligibilityStatus({ eligible: false, message: result.error || '❌ Not eligible for this loan type' });
            }
        } catch (err) {
            setCheckingEligibility(false);
            console.error('Quick eligibility check failed:', err);
        }
    };

    const handleHolderChange = (e) => {
        const searchValue = e.target.value;
        setLoanData({ ...loanData, account_holder: searchValue });
        const results = membersName.filter((member) => member.name.toLowerCase().includes(searchValue.toLowerCase()));
        setAccountHolder(searchValue == "" ? [] : results);

        // If exact match to a known member and loan type is selected, trigger immediate eligibility
        const exactMember = membersName.find(m => m.name.toLowerCase() === searchValue.toLowerCase());
        if (exactMember && loanData.loan_type) {
            quickEligibilityCheck(exactMember.name, loanData.loan_type);
        }
    }
    
    const handleMakerOneSearch = (e) => {
        setMakerOneSearch([]);
        const value = e.target.value;
        setLoanData({ ...loanData, co_maker: value });
        
        if (errors && errors.co_maker) {
            setErrors(prev => {
                const { co_maker, ...rest } = prev;
                return rest;
            });
        }
        
        const searchValue = value;
        // ✅ Filter from employedMembers only (no outsiders)
        const results = employedMembers.filter((member) => {
            const fullName = `${member.first_name} ${member.middle_name || ''} ${member.last_name}`.toLowerCase().trim();
            return fullName.includes(searchValue.toLowerCase());
        });
        setMakerOneSearch(searchValue === "" ? [] : results);
    };
    
    const handleMakerTwoSearch = (e) => {
        setMakerTwoSearch([]);
        const value = e.target.value;
        setLoanData({ ...loanData, co_maker_2: value });
        
        if (errors && errors.co_maker_2) {
            setErrors(prev => {
                const { co_maker_2, ...rest } = prev;
                return rest;
            });
        }
        
        const searchValue = value;
        // ✅ Filter from employedMembers only (no outsiders)
        const results = employedMembers.filter((member) => {
            const fullName = `${member.first_name} ${member.middle_name || ''} ${member.last_name}`.toLowerCase().trim();
            return fullName.includes(searchValue.toLowerCase());
        });
        setMakerTwoSearch(searchValue === "" ? [] : results);
    };
    
    const handleMakerThreeSearch = (e) => {
        setMakerThreeSearch([]);
        const value = e.target.value;
        setLoanData({ ...loanData, co_maker_3: value });
        
        if (errors && errors.co_maker_3) {
            setErrors(prev => {
                const { co_maker_3, ...rest } = prev;
                return rest;
            });
        }
        
        const searchValue = value;
        // ✅ Filter from employedMembers only (no outsiders)
        const results = employedMembers.filter((member) => {
            const fullName = `${member.first_name} ${member.middle_name || ''} ${member.last_name}`.toLowerCase().trim();
            return fullName.includes(searchValue.toLowerCase());
        });
        setMakerThreeSearch(searchValue === "" ? [] : results);
    };
    
    const handleMakerFourSearch = (e) => {
        setMakerFourSearch([]);
        const value = e.target.value;
        setLoanData({ ...loanData, co_maker_4: value });
        
        if (errors && errors.co_maker_4) {
            setErrors(prev => {
                const { co_maker_4, ...rest } = prev;
                return rest;
            });
        }
        
        const searchValue = value;
        // ✅ Filter from employedMembers only (no outsiders)
        const results = employedMembers.filter((member) => {
            const fullName = `${member.first_name} ${member.middle_name || ''} ${member.last_name}`.toLowerCase().trim();
            return fullName.includes(searchValue.toLowerCase());
        });
        setMakerFourSearch(searchValue === "" ? [] : results);
    };
    
    const handleMakerFiveSearch = (e) => {
        setMakerFiveSearch([]);
        const value = e.target.value;
        setLoanData({ ...loanData, co_maker_5: value });
        
        if (errors && errors.co_maker_5) {
            setErrors(prev => {
                const { co_maker_5, ...rest } = prev;
                return rest;
            });
        }
        
        const searchValue = value;
        // ✅ Filter from employedMembers only (no outsiders)
        const results = employedMembers.filter((member) => {
            const fullName = `${member.first_name} ${member.middle_name || ''} ${member.last_name}`.toLowerCase().trim();
            return fullName.includes(searchValue.toLowerCase());
        });
        setMakerFiveSearch(searchValue === "" ? [] : results);
    };
    // recently lang
    const selectMakerFromSuggestion = (memberObj, makerIndex) => {
        // memberObj should be the full member object from employedMembers API with memId, first_name, middle_name, last_name
        if (!memberObj || !memberObj.memId) return;

        const fullName = `${memberObj.first_name} ${memberObj.middle_name || ''} ${memberObj.last_name}`.trim();

        // ✅ Clear any validation errors for this comaker field
        if (errors) {
            setErrors(prev => {
                const fieldKey = makerIndex === 1 ? 'co_maker' : `co_maker_${makerIndex}`;
                const newErrors = { ...prev };
                delete newErrors[fieldKey];
                return newErrors;
            });
        }

        setLoanData(prev => {
            const copy = { ...prev };
            if (makerIndex === 1) {
                copy.co_maker = fullName;
                copy.co_maker_id = memberObj.memId;
            } else if (makerIndex === 2) {
                copy.co_maker_2 = fullName;
                copy.co_maker_2_id = memberObj.memId;
            } else if (makerIndex === 3) {
                copy.co_maker_3 = fullName;
                copy.co_maker_3_id = memberObj.memId;
            } else if (makerIndex === 4) {
                copy.co_maker_4 = fullName;
                copy.co_maker_4_id = memberObj.memId;
            } else if (makerIndex === 5) {
                copy.co_maker_5 = fullName;
                copy.co_maker_5_id = memberObj.memId;
            }
            return copy;
        });

        // Clear suggestion list for that index
        if (makerIndex === 1) setMakerOneSearch([]);
        if (makerIndex === 2) setMakerTwoSearch([]);
        if (makerIndex === 3) setMakerThreeSearch([]);
        if (makerIndex === 4) setMakerFourSearch([]);
        if (makerIndex === 5) setMakerFiveSearch([]);
    };
    // recently lang ends
    
    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/members/`); 
                const data = await response.json();
                const formattedData = data.map(member => ({
                    name: `${member.first_name} ${member.middle_name || ''} ${member.last_name}`.trim().replace(/\s+/g, ' '),
                    accountN: member.accountN || "❌ Missing",
                    share_capital: member.share_capital || "❌ Missing",
                    memId: member.memId
                }));
                setMemberNames(formattedData); 
            } catch (error) {
                console.error("❌ API Fetch Error:", error);
            }
        };
        fetchMembers();
    }, []);
    // recently lang
    useEffect(() => {
        const fetchEmployed = async () => {
            try {
            // Prefer server-side filter; backend may accept ?employment_status=Employed
            const res = await axios.get(`${BASE_URL}/members/?employment_status=Employed`);
            if (Array.isArray(res.data) && res.data.length > 0) {
                setEmployedMembers(res.data);
                return;
            }
            // Fallback: fetch all and filter client-side
            const all = await axios.get(`${BASE_URL}/members/`);
            setEmployedMembers(all.data.filter(m => m.employment_status === 'Employed'));
            } catch (err) {
            console.error('Failed to fetch employed members', err);
            // keep employedMembers empty on failure
            }
        };

        fetchEmployed();
        }, []);
    // recently lang ends
    
    const formatNumber = (number) => {
        if (number == null || isNaN(number)) return "N/A";
        if (typeof number === 'string' && number.includes('.')) {
            return new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(number);
        }
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(number);
    };

    useEffect(() => {
        const fetchShareCapital = async () => {
            if (!formVisible || !loanData.account) {
                return;
            }
            
            try {
                const token = localStorage.getItem('authToken');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                
                const response = await axios.get(`${BASE_URL}/accounts/${loanData.account}/shareCapital/`, { headers });
                setShareCapital(response.data.shareCapital);
                
                setErrors(prev => {
                    const { shareCapital, ...otherErrors } = prev || {};
                    return otherErrors;
                });
                
            } catch (err) {
                console.error('Error fetching share capital:', err);
                
                if (formVisible) {
                    setErrors(prev => ({ 
                        ...prev, 
                        shareCapital: 'Error fetching share capital' 
                    }));
                }
            }
        };
        
        fetchShareCapital();
    }, [loanData.account, formVisible]);

    // Inline name error based on eligibility, and disable other fields
    useEffect(() => {
        if (eligibilityStatus && eligibilityStatus.eligible === false) {
            const message = eligibilityStatus.message || 'Not eligible for this loan';
            if (isAmountOnlyError(message)) {
                setAmountError(message);
            } else {
                setMemberError(message);
            }
        } else if (eligibilityStatus && eligibilityStatus.eligible === true) {
            // Clear name + amount-only eligibility messages
            clearMemberError();
            clearAmountError();
            // Also clear any lingering top-level member/reloan banners
            setErrors((prev) => {
                if (!prev) return prev;
                const { member, reloan, ...rest } = prev;
                return rest;
            });
        }
        // Do not clear errors when eligibilityStatus is null; keep prior error until user changes input
    }, [eligibilityStatus]);

    const fetchLoans = async () => {
        try {
            let token = localStorage.getItem('authToken') || 
                       localStorage.getItem('token') || 
                       localStorage.getItem('access_token') ||
                       localStorage.getItem('accessToken');
            
            if (!token) {
                token = sessionStorage.getItem('authToken') || 
                       sessionStorage.getItem('token') || 
                       sessionStorage.getItem('access_token') ||
                       sessionStorage.getItem('accessToken');
            }
            
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            
            const response = await axios.get(`${BASE_URL}/loans/`, { headers });
            
            const loansData = Array.isArray(response.data) ? response.data : [];
            
            setLoans(loansData);
            setFilteredLoans(loansData);
            
            setTimeout(() => {
                autoArchivePaidOffLoans();
            }, 1000);
            
        } catch (err) {
            console.error('Error fetching loans:', err);
            
            if (err.response && err.response.status === 401) {
                console.log('Authentication failed while fetching loans');
            }
            
            setLoans([]);
            setFilteredLoans([]);
            
            if (!err.message?.includes('Network Error')) {
                setErrors('Error fetching loans');
            }
        }
    };
    
    useEffect(() => {
        fetchLoans();
    }, []);
// misty whole validatereloaning function
    const validateReloaning = async (accountHolder, requestedLoanType) => {
        try {
            const selectedMember = membersName.find(member => 
                member.name.toLowerCase() === accountHolder.toLowerCase()
            );

            if (!selectedMember || !selectedMember.accountN) {
                return { 
                    canReloan: false, 
                    error: 'Could not find account for this member' 
                };
            }

            const accountNumber = selectedMember.accountN;

            const existingLoans = loans.filter(loan => 
                loan.account === accountNumber && 
                loan.status.toLowerCase() === 'ongoing'
            );

            if (existingLoans.length === 0) {
                return { canReloan: true };
            }

            // Prefer an ongoing loan of the SAME TYPE as the requested type
            const sameTypeOngoing = existingLoans
                .filter(l => String(l.loan_type).toLowerCase() === String(requestedLoanType).toLowerCase())
                .sort((a, b) => new Date(b.loan_date) - new Date(a.loan_date));

            // Fallback: most recent ongoing (different type) if no same-type loan exists
            const mostRecentLoan = (sameTypeOngoing[0]) || existingLoans.sort((a, b) => 
                new Date(b.loan_date) - new Date(a.loan_date)
            )[0];

            // ✅ Use backend's detailed eligibility (counts advances, original totals)
            // Only enforce for Regular→Regular reloan
            if (String(mostRecentLoan.loan_type).toLowerCase() === 'regular' && String(requestedLoanType).toLowerCase() === 'regular') {
                const token = localStorage.getItem('accessToken');
                const detailResp = await axios.get(
                    `${process.env.REACT_APP_API_URL}/loans/${mostRecentLoan.control_number}/detailed_loan_info/`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const rel = detailResp?.data?.reloan_eligibility;
                if (rel?.eligible) {
                    const paidPct = typeof rel.counts?.paid_ratio === 'number' ? (rel.counts.paid_ratio * 100).toFixed(1) : '50.0';
                    return {
                        canReloan: true,
                        message: rel.message || `✅ Eligible: Existing loan is ${paidPct}% paid (≥50%).`
                    };
                }
                const paidPct = typeof rel?.counts?.paid_ratio === 'number' ? (rel.counts.paid_ratio * 100) : 0;
                const neededPercent = Math.max(0, 50 - paidPct).toFixed(1);
                return {
                    canReloan: false,
                    error: rel?.message || `❌ Cannot apply for Regular reloan yet. Existing loan only ${paidPct.toFixed(1)}% paid. Need ${neededPercent}% more to reach 50%.`
                };
            }

            // ✅ Emergency loan: use backend detailed eligibility as well (counts advances)
            if (String(requestedLoanType).toLowerCase() === 'emergency') {
                const token2 = localStorage.getItem('accessToken');
                const emergencyBaseLoanId = mostRecentLoan.control_number;
                const detailResp2 = await axios.get(
                    `${process.env.REACT_APP_API_URL}/loans/${emergencyBaseLoanId}/detailed_loan_info/`,
                    { headers: { Authorization: `Bearer ${token2}` } }
                );
                const rel2 = detailResp2?.data?.reloan_eligibility;
                const paidPct2 = typeof rel2?.counts?.paid_ratio === 'number' ? (rel2.counts.paid_ratio * 100) : 0;
                if (rel2?.eligible || paidPct2 >= 50) {
                    return {
                        canReloan: true,
                        message: rel2?.message || `✅ Eligible: Existing loan is ${paidPct2.toFixed(1)}% paid (≥50%).`
                    };
                }
                const neededPercent2 = Math.max(0, 50 - paidPct2).toFixed(1);
                return {
                    canReloan: false,
                    error: rel2?.message || `❌ Cannot apply for Emergency loan yet. Existing loan only ${paidPct2.toFixed(1)}% paid. Need ${neededPercent2}% more to reach 50%.`
                };
            }

            return { 
                canReloan: true 
            };

        } catch (error) {
            console.error('Error checking reloan eligibility:', error);
            return {
                canReloan: false,
                error: 'Error checking loan eligibility. Please try again.'
            };
        }
    };


    const validateLoanData = async () => {
        const errors = {};
        const { loan_type, loan_amount, account_holder } = loanData;

        // Skip validation if account_holder is empty (required field validation handles this)
        if (!account_holder || account_holder.trim() === '') {
            return errors;
        }

        try {
            const reloanCheck = await validateReloaning(account_holder, loan_type);
            
            if (!reloanCheck.canReloan) {
                errors.reloan = reloanCheck.error;
                // DON'T return early - continue checking other validations
            }

            const memberData = membersName.find(member => 
                member.name.toLowerCase() === account_holder.toLowerCase()
            );

            if (!memberData) {
                errors.account_holder = 'Member not found';
                // DON'T return early - continue checking other validations
            }

            // Only check share capital if member was found
            if (memberData) {
                const memberShareCapital = parseFloat(memberData.share_capital);
                const maxLoanAmount = memberShareCapital * 3;
                const requestedAmount = Math.round(parseFloat(String(loan_amount).replace(/,/g, '')) || 0);

                if (requestedAmount > maxLoanAmount) {
                    errors.loan_amount = `Loan amount cannot exceed 3x share capital (₱${formatNumber(maxLoanAmount)})`;
                    // DON'T return early
                }
            }

            // Check loan type limits (only if loan_amount exists)
            if (loan_amount && parseFloat(loan_amount) > 0) {
                const requestedAmount = Math.round(parseFloat(String(loan_amount).replace(/,/g, '')) || 0);
                
                if (loan_type === 'Emergency') {
                    if (requestedAmount !== 50000) {
                        errors.loan_amount = 'Emergency loans must be exactly ₱50,000';
                    }
                } else if (loan_type === 'Regular') {
                    if (requestedAmount > 1500000) {
                        errors.loan_amount = 'Regular loans cannot exceed ₱1.5 million';
                    }
                }
            }

            return errors;

        } catch (error) {
            console.error('Validation error:', error);
            errors.general = 'Error validating loan application';
            return errors;
        }
    };
    // Add this new function to validate required fields
    const validateRequiredFields = () => {
        const errors = {};
        
        // Check account holder
        if (!loanData.account_holder || loanData.account_holder.trim() === '') {
            errors.account_holder = 'Account holder name is required';
        }
        
        // Check loan amount
        if (!loanData.loan_amount || loanData.loan_amount === '' || parseFloat(loanData.loan_amount) <= 0) {
            errors.loan_amount = 'Loan amount is required';
        }
        
        // Check loan period/term
        if (!loanData.loan_period || loanData.loan_period === '') {
            errors.loan_period = 'Loan term is required';
        }
        
        // Check purpose if "Others" is selected
        if (loanData.purpose === 'Others' && (!loanData.otherPurpose || loanData.otherPurpose.trim() === '')) {
            errors.otherPurpose = 'Please specify the purpose';
        }
        
        return errors;
    };

    // Validate loan amount limits based on loan type
    const validateLoanAmountLimits = () => {
        const errors = {};
        const { loan_type, loan_amount } = loanData;
        
        if (!loan_amount || parseFloat(loan_amount) <= 0) {
            return errors; // Skip if no amount - requiredFields handles this
        }
        
        const requestedAmount = Math.round(parseFloat(String(loan_amount).replace(/,/g, '')) || 0);
        
        if (loan_type === 'Emergency' && requestedAmount !== 50000) {
            errors.loan_amount = 'Emergency loans must be exactly ₱50,000';
        }
        
        if (loan_type === 'Regular' && requestedAmount > 1500000) {
            errors.loan_amount = 'Regular loans cannot exceed ₱1,500,000';
        }
        
        return errors;
    };

    // Clear Emergency amount error when exactly 50,000 is entered
    useEffect(() => {
        const amt = Math.round(parseFloat(String(loanData.loan_amount || '').replace(/,/g, '')) || 0);
        if (String(loanData.loan_type).toLowerCase() === 'emergency' && amt === 50000) {
            setErrors((prev) => {
                if (!prev || !prev.loan_amount) return prev;
                // Only clear the specific Emergency exact-amount message
                if (prev.loan_amount && String(prev.loan_amount).toLowerCase().includes('emergency loans must be exactly')) {
                    const { loan_amount, ...rest } = prev;
                    return rest;
                }
                return prev;
            });
            // Also mark eligibility as true to avoid lingering amount-only eligibility errors
            if (eligibilityStatus && eligibilityStatus.eligible === false && isAmountOnlyError(eligibilityStatus.message)) {
                setEligibilityStatus({ eligible: true, message: '✅ Eligible to apply for Emergency loan' });
            }
        }
    }, [loanData.loan_type, loanData.loan_amount]);



    // // Update handleLoanSubmit to include this validation FIRST
    // const handleLoanSubmit = async (e) => {
    //     e.preventDefault();
        
    //     try {
    //         // Check required fields FIRST
    //         const requiredFieldErrors = validateRequiredFields();
            
    //         if (Object.keys(requiredFieldErrors).length > 0) {
    //             setErrors(requiredFieldErrors);
    //             return; // Stop here - show inline errors only
    //         }
            
    //         // Then proceed with other validations
    //         const validationErrors = await validateLoanData();
    //         const memberValidationErrors = validateMemberAndLoanTerm();
    //         const coMakerErrors = validateCoMakers();

    //         const combinedErrors = {
    //             ...validationErrors,
    //             ...memberValidationErrors,
    //             ...coMakerErrors
    //         };

    //         if (Object.keys(combinedErrors).length > 0) {
    //             setErrors(combinedErrors);
    //             return;
    //         }

    //         const selectedMember = membersName.find(member => 
    //             member.name.toLowerCase() === loanData.account_holder.toLowerCase()
    //         );

    //         if (!selectedMember || !selectedMember.accountN) {
    //             setErrors({ account_holder: 'Could not find account number for selected member' });
    //             return;
    //         }

    //         const loanSubmitData = {
    //             ...loanData,
    //             account: selectedMember.accountN,
    //             co_maker_id: loanData.co_maker_id || null,
    //             co_maker_2_id: loanData.co_maker_2_id || null,
    //             co_maker_3_id: loanData.co_maker_3_id || null,
    //             co_maker_4_id: loanData.co_maker_4_id || null,
    //             co_maker_5_id: loanData.co_maker_5_id || null,
    //         };

    //         setErrors({});
            
    //         let response;
    //         if (editingLoan) {
    //             response = await axios.put(`${BASE_URL}/loans/${editingLoan.control_number}/`, loanSubmitData);
    //             setPopupMessage('Loan successfully updated!');
    //         } else {
    //             response = await axios.post(`${BASE_URL}/loans/`, loanSubmitData);
    //             setNewLoan(response.data);
    //             setShowPrintButton(true);
    //             setLoanSubmitted(true);
    //             setPopupMessage('Loan successfully created!');
    //         }
            
    //         setShowPopup(true);
            
    //         setTimeout(() => {
    //             setShowPopup(false);
    //         }, 1000);
            
    //         await fetchLoans();
            
    //     } catch (err) {
    //         console.error('Error saving loan:', err);
            
    //         if (err.response) {
    //             const errorData = err.response.data;
    //             if (typeof errorData === 'object') {
    //                 const serverErrors = {};
    //                 Object.entries(errorData).forEach(([field, errors]) => {
    //                     serverErrors[field] = Array.isArray(errors) ? errors.join(', ') : errors;
    //                 });
    //                 setErrors(serverErrors);
    //                 return;
    //             }
    //         }
            
    //         setErrors({ general: 'Error saving loan. Please try again.' });
    //     }
    // };
    // Replace the handleLoanSubmit function
    const handleLoanSubmit = async (e) => {
        e.preventDefault();

        try {
            let allErrors = {};

            // 1. Required field validation
            const requiredErrors = validateRequiredFields();
            allErrors = { ...allErrors, ...requiredErrors };

            // 2. Member + loan term validation
            const memberErrors = validateMemberAndLoanTerm();
            allErrors = { ...allErrors, ...memberErrors };

            // 3. Co-maker validation
            const coMakerErrors = validateCoMakers();
            allErrors = { ...allErrors, ...coMakerErrors };

            // 4. Loan amount validations (async)
            const validationErrors = await validateLoanData();
            allErrors = { ...allErrors, ...validationErrors };

            // ❗️ Show ALL errors together
            console.log('🔍 Validation Errors Collected:', allErrors);
            if (Object.keys(allErrors).length > 0) {
                setErrors(allErrors);
                return;
            }

            // --- IF WE REACH HERE, NO ERRORS ---
            setErrors({});

            const selectedMember = membersName.find(member => 
                member.name.toLowerCase() === loanData.account_holder.toLowerCase()
            );

            if (!selectedMember || !selectedMember.accountN || selectedMember.accountN === "❌ Missing") {
                setErrors({ account_holder: 'Could not find account number for selected member. Please refresh the page and try again.' });
                return;
            }

            // ✅ CRITICAL FIX: Decide reloan based on any same-type ongoing loan for this member
            const accountNumber = typeof selectedMember.accountN === 'object' 
                ? selectedMember.accountN.account_number 
                : selectedMember.accountN;

            const sameTypeActiveLoan = loans
                .filter(l => l.account === accountNumber && (l.status || '').toLowerCase() === 'ongoing' && String(l.loan_type).toLowerCase() === String(loanData.loan_type).toLowerCase())
                .sort((a, b) => new Date(b.loan_date) - new Date(a.loan_date))[0];

            const existingForReloan = sameTypeActiveLoan || (isReloanMode && existingLoanForReloan && String(existingLoanForReloan.loan_type).toLowerCase() === String(loanData.loan_type).toLowerCase() ? existingLoanForReloan : null);

            if (existingForReloan) {
                // 🚫 New policy: Emergency→Emergency reloan is not allowed and only one Emergency at a time
                if (String(loanData.loan_type).toLowerCase() === 'emergency') {
                    setErrors({
                        reloan: 'You still have an ongoing Emergency loan. Please settle them first.'
                    });
                    return;
                }
                const sameTypeReloan = true;
                // ✅ Additional reloan validation (optional if calculation exists)
                if (reloanCalculation) {
                    const reloanAmount = parseFloat(loanData.loan_amount);
                    const minRequired = parseFloat(reloanCalculation.minimum_required_amount);
                    const carriedBalance = parseFloat(reloanCalculation.carried_balance);
                    if (loanData.loan_type !== '' && !isNaN(minRequired) && reloanAmount <= minRequired) {
                        setErrors({
                            loan_amount: `Reloan amount must be GREATER than remaining balance (₱${formatNumber(carriedBalance)}). Please enter an amount of at least ₱${formatNumber((carriedBalance || 0) + 1)}.`
                        });
                        return;
                    }
                }

                const reloanAmount = parseFloat(loanData.loan_amount);
                const minRequired = parseFloat(reloanCalculation.minimum_required_amount);
                const carriedBalance = parseFloat(reloanCalculation.carried_balance);

                // ✅ Reloan amount must be STRICTLY GREATER than remaining balance
                // Skipped for Emergency loan reloan as per requirement
                if (loanData.loan_type !== '' && reloanAmount <= minRequired) {
                    setErrors({
                        loan_amount: `Reloan amount must be GREATER than remaining balance (₱${formatNumber(carriedBalance)}). Please enter an amount of at least ₱${formatNumber(carriedBalance + 1)}.`
                    });
                    return;
                }

                if (sameTypeReloan && String(loanData.loan_type).toLowerCase() === 'regular') {
                    // Process as SAME-TYPE reloan
                    const reloanData = {
                        account_number: accountNumber,
                        existing_loan_control_number: existingForReloan.control_number,
                        new_loan_amount: loanData.loan_amount,
                        loan_type: loanData.loan_type,
                        loan_period: loanData.loan_period,
                        loan_period_unit: loanData.loan_period_unit,
                        purpose: loanData.purpose === 'Others' ? loanData.otherPurpose : loanData.purpose,
                        co_maker: loanData.co_maker || '',
                        co_maker_id: loanData.co_maker_id || null,
                        co_maker_2: loanData.co_maker_2 || '',
                        co_maker_2_id: loanData.co_maker_2_id || null,
                        co_maker_3: loanData.co_maker_3 || '',
                        co_maker_3_id: loanData.co_maker_3_id || null,
                        co_maker_4: loanData.co_maker_4 || '',
                        co_maker_4_id: loanData.co_maker_4_id || null,
                        co_maker_5: loanData.co_maker_5 || '',
                        co_maker_5_id: loanData.co_maker_5_id || null,
                    };

                    const response = await axios.post(`${BASE_URL}/loans/process-reloan/`, reloanData, {
                        headers: {
                            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
                            'Content-Type': 'application/json',
                        },
                    });
                    
                    setNewLoan(response.data.new_loan);
                    setShowPrintButton(true);
                    setLoanSubmitted(true);
                    
                    setPopupMessage(`
                        ✅ Reloan Processed Successfully!
                        
                        Old Loan ${response.data.old_loan.control_number}: Settled
                        Remaining Balance: ₱${formatNumber(response.data.old_loan.remaining_principal)}
                        
                        New Loan ${response.data.new_loan.control_number}: Created
                        Total Amount: ₱${formatNumber(response.data.breakdown.new_loan_amount)}
                        Carried Balance: ₱${formatNumber(response.data.breakdown.carried_balance)}
                        New Funds: ₱${formatNumber(response.data.breakdown.actual_new_funds)}
                        Net Proceeds: ₱${formatNumber(response.data.breakdown.net_proceeds)}
                    `);
                } else {
                    // Process as CROSS-TYPE new loan (not a reloan)
                    const loanSubmitData = {
                        account_number: accountNumber,
                        loan_amount: loanData.loan_amount,
                        loan_type: loanData.loan_type,
                        loan_period: loanData.loan_period,
                        loan_period_unit: loanData.loan_period_unit,
                        purpose: loanData.purpose === 'Others' ? loanData.otherPurpose : loanData.purpose,
                        co_maker: loanData.co_maker || '',
                        co_maker_2: loanData.co_maker_2 || '',
                        co_maker_3: loanData.co_maker_3 || '',
                        co_maker_4: loanData.co_maker_4 || '',
                        co_maker_5: loanData.co_maker_5 || '',
                        status: 'Ongoing',
                        service_fee: loanData.service_fee || 0,
                        admincost: loanData.admincost || 0,
                        notarial: loanData.notarial || 0,
                        cisp: loanData.cisp || 0,
                        interest_amount: loanData.interest_amount || 0,
                        annual_interest: loanData.annual_interest || 0
                    };

                    const response = await axios.post(`${BASE_URL}/loans/create_loan/`, loanSubmitData, {
                        headers: {
                            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
                            'Content-Type': 'application/json',
                        },
                    });

                    setNewLoan(response.data.loan_data);
                    setShowPrintButton(true);
                    setLoanSubmitted(true);
                    setPopupMessage('Loan successfully created!');
                }
        } else {
            // Regular loan creation
            const accountNumber = typeof selectedMember.accountN === 'object' 
                ? selectedMember.accountN.account_number 
                : selectedMember.accountN;
                
            const loanSubmitData = {
                account_number: accountNumber,
                loan_amount: loanData.loan_amount,
                loan_type: loanData.loan_type,
                loan_period: loanData.loan_period,
                loan_period_unit: loanData.loan_period_unit,
                purpose: loanData.purpose === 'Others' ? loanData.otherPurpose : loanData.purpose,
                co_maker: loanData.co_maker || '',
                co_maker_2: loanData.co_maker_2 || '',
                co_maker_3: loanData.co_maker_3 || '',
                co_maker_4: loanData.co_maker_4 || '',
                co_maker_5: loanData.co_maker_5 || '',
                status: 'Ongoing',
                // Include fee fields if present
                service_fee: loanData.service_fee || 0,
                admincost: loanData.admincost || 0,
                notarial: loanData.notarial || 0,
                cisp: loanData.cisp || 0,
                interest_amount: loanData.interest_amount || 0,
                annual_interest: loanData.annual_interest || 0
            };                const response = await axios.post(`${BASE_URL}/loans/create_loan/`, loanSubmitData, {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
                        'Content-Type': 'application/json',
                    },
                });
                
                setNewLoan(response.data.loan_data);
                setShowPrintButton(true);
                setLoanSubmitted(true);
                setPopupMessage('Loan successfully created!');
            }

            setShowPopup(true);
            setTimeout(() => setShowPopup(false), 3000);

            await fetchLoans();
            
            // ✅ Clear reloan state after successful submission
            setTimeout(() => {
                setIsReloanMode(false);
                setExistingLoanForReloan(null);
                setReloanCalculation(null);
            }, 500);

        } catch (err) {
            console.error('Error saving loan:', err);

            if (err.response && typeof err.response.data === 'object') {
            const serverErrors = {};
            
            // Handle nested errors (like 'details' array)
            if (err.response.data.details) {
            serverErrors.comakers = Array.isArray(err.response.data.details)
            ? err.response.data.details.join('. ')
            : safeText(err.response.data.details);
            }
            
            // Handle other field errors
            Object.entries(err.response.data).forEach(([field, errors]) => {
            if (field !== 'details') {
            const val = Array.isArray(errors) ? errors.join(', ') : errors;
            const textVal = typeof val === 'object' ? safeText(val) : String(val);
            // Map exposure limit messages directly to loan_amount
            if (/Exposure limit breached/i.test(textVal)) {
                setAmountError(textVal);
                return;
            }
            // Preserve other server-provided field errors
            serverErrors[field] = textVal;
            }
            });

            // If error or detail keys exist with exposure message, route to amount
            const exposureObjText = [err.response.data.error, err.response.data.detail]
                .map((v) => (v == null ? '' : String(v)))
                .find((t) => /Exposure limit breached/i.test(t));
            if (exposureObjText) {
                setAmountError(exposureObjText);
                return;
            }
            
            if (Object.keys(serverErrors).length > 0) {
                setErrors(serverErrors);
                return;
            }
            }

            // Handle string/500 errors (e.g., Exposure limit breached)
            if (err.response) {
                const status = err.response.status;
                const data = err.response.data;
                const text = typeof data === 'string' ? data : (data?.error ? String(data.error) : '');
                if (text && /Exposure limit breached/i.test(text)) {
                    const m = text.match(/Exposure limit breached:\s*₱([\d,]+\.\d{2}) exceeds 3x share capital \(₱([\d,]+\.\d{2})\)/i);
                    const msg = m 
                        ? `Exposure limit breached: ₱${m[1]} exceeds 3x share capital (₱${m[2]})`
                        : 'Exposure limit breached: Combined exposure exceeds 3x share capital';
                    setAmountError(msg);
                    return;
                }
                // Fallback: show server text inline under amount if clearly about amount/share capital
                if (text && (/share capital/i.test(text) || /amount/i.test(text))) {
                    setAmountError(text);
                    return;
                }
                // As a last resort, parse error message string
                if (err.message && /Exposure limit breached/i.test(err.message)) {
                    setAmountError(err.message);
                    return;
                }
            }

            setErrors({ general: err.response?.data?.error || 'Error saving loan. Please try again.' });
        }
    };
    useEffect(() => {
        const checkEligibilityRealTime = async () => {
            if (!loanData.account_holder || !loanData.loan_type) {
                setEligibilityStatus(null);
                setIsReloanMode(false);
                setExistingLoanForReloan(null);
                setReloanCalculation(null);
                return;
            }

            setCheckingEligibility(true);

            try {
                const selectedMember = membersName.find(member => 
                    member.name.toLowerCase() === loanData.account_holder.toLowerCase()
                );

                if (!selectedMember || !selectedMember.accountN) {
                    setCheckingEligibility(false);
                    return;
                }

                // If no amount yet, do a quick reloan eligibility check based on progress only
                if (!loanData.loan_amount) {
                    const result = await validateReloaning(loanData.account_holder, loanData.loan_type);
                    setCheckingEligibility(false);
                    if (result.canReloan) {
                        setIsReloanMode(false);
                        setExistingLoanForReloan(null);
                        setReloanCalculation(null);
                        setEligibilityStatus({ eligible: true, message: result.message || '✅ Eligible to apply for this loan type' });
                    } else {
                        setIsReloanMode(false);
                        setExistingLoanForReloan(null);
                        setReloanCalculation(null);
                        setEligibilityStatus({ eligible: false, message: result.error || '❌ Not eligible for this loan type' });
                    }
                    return;
                }

                // Check reloan eligibility including requested amount
                const response = await axios.post(`${BASE_URL}/loans/check-reloan-eligibility/`, {
                    account_number: selectedMember.accountN,
                    requested_loan_type: loanData.loan_type,
                    requested_loan_amount: loanData.loan_amount
                });

                setCheckingEligibility(false);

                if (response.data.eligible) {
                    if (response.data.has_active_loan) {
                        // This is a reloan scenario
                        setIsReloanMode(true);
                        setExistingLoanForReloan(response.data.existing_loan);
                        setReloanCalculation(response.data.reloan_calculation);

                        const calc = response.data.reloan_calculation;
                        
                        setEligibilityStatus({
                            eligible: true,
                            message: `
                                ✅ Eligible for Reloan
                                
                                📊 Reloan Breakdown:
                                • Existing Loan: ${response.data.existing_loan.control_number}
                                • Remaining Balance: ₱${formatNumber(calc.carried_balance)}
                                • New Loan Amount: ₱${formatNumber(calc.requested_loan_amount)}
                                • Actual New Funds: ₱${formatNumber(calc.actual_new_funds)}
                                
                                ⚠️ The remaining balance will be automatically transferred to the new loan.
                            `
                        });
                    } else {
                        // No active loan - regular new loan
                        setIsReloanMode(false);
                        setExistingLoanForReloan(null);
                        setReloanCalculation(null);
                        
                        setEligibilityStatus({
                            eligible: true,
                            message: '✅ Eligible to apply for this loan type'
                        });
                    }
                } else {
                    // Special-case Emergency loans:
                    // - If amount is exactly 50,000, treat as eligible regardless of remaining balance messaging
                    // - Otherwise, show precise Emergency amount error
                    const reason = String(response.data.reason || '').toLowerCase();
                    const requestedAmount = Math.round(parseFloat(String(loanData.loan_amount || '').replace(/,/g, '')) || 0);

                    setIsReloanMode(false);
                    setExistingLoanForReloan(null);
                    setReloanCalculation(null);

                    if (String(loanData.loan_type).toLowerCase() === 'emergency') {
                        if (requestedAmount === 50000) {
                            setEligibilityStatus({
                                eligible: true,
                                message: '✅ Eligible to apply for Emergency loan'
                            });
                        } else {
                            setEligibilityStatus({
                                eligible: false,
                                message: 'Emergency loans must be exactly ₱50,000'
                            });
                        }
                    } else {
                        setEligibilityStatus({
                            eligible: false,
                            message: response.data.reason
                        });
                    }
                }
            } catch (error) {
                setCheckingEligibility(false);
                console.error('Error checking eligibility:', error);
            }
        };

        checkEligibilityRealTime();
    }, [loanData.account_holder, loanData.loan_type, loanData.loan_amount]);

    const validateMemberAndLoanTerm = () => {
        const errors = {};
        
        // Only validate member if account_holder has a value
        if (loanData.account_holder && loanData.account_holder.trim() !== '') {
            // Use membersName (which has proper name formatting) instead of accountsList
            const foundMember = membersName.find(member => 
                member.name.toLowerCase() === loanData.account_holder.toLowerCase()
            );

            if (!foundMember) {
                errors.account_holder = 'Member not registered in the system';
            } else if (!foundMember.accountN || foundMember.accountN === "❌ Missing") {
                errors.account_holder = 'This member does not have an account number. The account should have been created automatically - please refresh the page or try again.';
            }
        }

        // Validate loan term for Regular loans (only if loan_period has value)
        if (loanData.loan_type === 'Regular') {
            if (loanData.loan_period_unit !== 'years') {
                errors.loan_period_unit = 'Regular loans must use years as the term unit';
            }

            if (loanData.loan_period && loanData.loan_period !== '') {
                const periodInYears = parseInt(loanData.loan_period);
                if (periodInYears < 1 || periodInYears > 4) {
                    errors.loan_period = 'Regular loans must have a term between 1 to 4 years';
                }
            }
        }

        // Validate loan term for Emergency loans (only if loan_period has value)
        if (loanData.loan_type === 'Emergency') {
            if (loanData.loan_period_unit !== 'months') {
                errors.loan_period_unit = 'Emergency loans must use months as the term unit';
            }

            if (loanData.loan_period && loanData.loan_period !== '') {
                const periodInMonths = parseInt(loanData.loan_period);
                if (periodInMonths < 1 || periodInMonths > 6) {
                    errors.loan_period = 'Emergency loans must have a term between 1 to 6 months';
                }
            }
        }

        return errors;
    };
    
    useEffect(() => {
        const search = searchQuery.toLowerCase();
        const filtered = loans.filter((loan) => {
            const matches = {
                control_number: loan.control_number?.toString().includes(search),
                account: loan.account?.toString().toLowerCase().includes(search),
                account_holder: loan.account_holder?.toLowerCase().includes(search),
                loan_type: loan.loan_type?.toLowerCase().includes(search),
                purpose: loan.purpose?.toLowerCase().includes(search),
                status: loan.status?.toLowerCase().includes(search),
            };
            return Object.values(matches).some((match) => match);
        });
        setFilteredLoans(filtered);
    }, [searchQuery, loans]);
    
    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const response = await axios.get(`${process.env.REACT_APP_API_URL}/members/`);
                setAccountList(response.data);
            } catch (error) {
                console.error("Error fetching members:", error);
            }
        };
        fetchMembers();
    }, []);
    
    const filteredMembers = members.filter((member) =>
        member.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setLoanData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };
    
    const closePopup = () => {
        setShowPopup(false);
    };
    
    const handleDateFilter = () => {
        let filtered = loans;

        if (filter === "today") {
            const today = new Date().toISOString().split('T')[0];
            filtered = loans.filter((loan) => loan.loan_date === today);
        } else if (filter === "single-day") {
            if (selectedDate) {
                filtered = loans.filter((loan) => loan.loan_date === selectedDate);
            }
        } else if (filter === "date-range") {
            if (startDate && endDate) {
                filtered = loans.filter(
                    (loan) => loan.loan_date >= startDate && loan.loan_date <= endDate
                );
            }
        }
        if (filtered.length === 0) {
            setShowNoLoanPopup(true); 
        } else {
            setShowNoLoanPopup(false); 
        }
        setFilteredLoans(filtered);
    };
    
    const resetForm = () => {
        setLoanData({
            control_number: '',
            account: '',
            loan_amount: '',
            loan_period: '',
            loan_period_unit: 'months',
            loan_type: 'Emergency',
            purpose: 'Education',
            status: 'Ongoing',
            co_maker: "",
            co_maker_id: null,
            co_maker_2: "",
            co_maker_2_id: null,
            co_maker_3: "",
            co_maker_3_id: null,
            co_maker_4: "",
            co_maker_4_id: null,
            co_maker_5: "",
            co_maker_5_id: null,
            account_holder: ""
        });
        setFormVisible(false);
        setEditingLoan(null);
        setShowPrintButton(false);
        setNewLoan(null);
        setPaymentFormVisible(false);
        setSelectedLoanForPayment(null);
        // ✅ Clear reloan-related states
        setIsReloanMode(false);
        setExistingLoanForReloan(null);
        setReloanCalculation(null);
        setEligibilityStatus(null);
        setLoanSubmitted(false);
        setErrors(null);
    };

    useEffect(() => {
        const checkEligibilityRealTime = async () => {
            if (!loanData.account_holder || !loanData.loan_type) {
                setEligibilityStatus(null);
                return;
            }

            setCheckingEligibility(true);
            const result = await validateReloaning(loanData.account_holder, loanData.loan_type);
            setCheckingEligibility(false);

            if (result.canReloan) {
                setEligibilityStatus({
                    eligible: true,
                    message: result.message || '✅ Eligible to apply for this loan type'
                });
            } else {
                setEligibilityStatus({
                    eligible: false,
                    message: result.error || '❌ Not eligible for this loan type'
                });
            }
        };

        checkEligibilityRealTime();
    }, [loanData.account_holder, loanData.loan_type]);

    return (
        <div className="loan-manager">
            <h2 className="loan-manager-header">LOANS</h2>
            
            {/* Eligibility overlay shown only while checking to avoid redundancy */}
            {checkingEligibility && (
                <div style={{
                    position: 'fixed',
                    top: '10px',
                    right: '350px',
                    zIndex: 3000,
                    maxWidth: '750px',
                    minWidth: '600px',
                    animation: 'slideIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
                }}>
                    <div style={{
                        background: checkingEligibility 
                            ? 'linear-gradient(135deg, #fff9e6 0%, #fff3cc 100%)' 
                            : eligibilityStatus?.eligible 
                                ? 'linear-gradient(135deg, #e8f8f5 0%, #d0f0e8 100%)' 
                                : 'linear-gradient(135deg, #ffe6e6 0%, #ffd4d4 100%)',
                        padding: '10px 10px',
                        borderRadius: '12px',
                        border: checkingEligibility 
                            ? '1px solid #ffa726' 
                            : eligibilityStatus?.eligible 
                                ? '2px solid #10d01aff' 
                                : '2px solid #ea110dff',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '16px',
                        position: 'relative',
                        overflow: 'hidden',
                        backdropFilter: 'blur(10px)',
                        transition: 'all 0.3s ease'
                    }}>
                        {/* Animated background pattern */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            opacity: 0.05
                        }} />
                        
                        {/* Icon container */}
                        <div style={{
                            minWidth: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'linear-gradient(135deg, #ffd54f 0%, #ffb300 100%)',
                            fontSize: '16px',
                            flexShrink: 0,
                            position: 'relative',
                            zIndex: 1
                        }}>
                            <span style={{ 
                                display: 'inline-block',
                                animation: 'spin 1s linear infinite'
                            }}>
                                🔄
                            </span>
                        </div>

                        {/* Content */}
                        <div style={{ 
                            flex: 1, 
                            paddingRight: '8px',
                            position: 'relative',
                            zIndex: 1
                        }}>
                            <div style={{ 
                                color: '#000000ff',
                                fontWeight: '700',
                                fontSize: '15px',
                                marginBottom: '4px',
                                letterSpacing: '0.3px',
                                textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}>
                                Validating Eligibility
                            </div>
                            <div style={{ 
                                color: '#000000ff',
                                fontSize: '13px',
                                lineHeight: '1.5',
                                opacity: 0.9
                            }}>
                                Please wait while we verify loan requirements...
                            </div>
                        </div>
                        
                        {/* Progress indicator for checking state */}
                        {checkingEligibility && (
                            <div style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                height: '3px',
                                background: 'linear-gradient(90deg, #ffa726, #ff9800, #ffa726)',
                                backgroundSize: '200% 100%',
                                animation: 'progress 1.5s ease-in-out infinite',
                                borderRadius: '0 0 10px 10px',
                                width: '100%'
                            }} />
                        )}
                    </div>
                </div>
            )}

            {!formVisible && !paymentFormVisible && (
                <div className="search-container">
                    <div className="search-wrapper" style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                        <input
                            type="text"
                            placeholder="Search Loans"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                            style={{padding: '7px 40px 10px 10px',fontSize: '16px',border: '0px',borderRadius: '4px',width: '250px',marginBottom: '30px',marginTop: '-10px',marginLeft: '900px',}}/>
                        <div
                            onClick={() => setShowFilterOptions(!showFilterOptions)}
                            className="date-filter-icon"
                            style={{display: 'inline-flex', alignItems: 'center', cursor: 'pointer', fontSize: '20px', marginBottom: '30px', marginTop: '-10px', marginLeft: '10px',}}><span style={{ marginRight: '5px' }}>Range</span><TbFilterEdit />
                        </div>
                        {showFilterOptions && (
                            <div
                                className="filter-options"
                                style={{ position: 'absolute', top: '40px', left: '1085px', backgroundColor: 'white', boxShadow: '0px 0px 15px 0px rgb(154, 154, 154)', borderRadius: '4px', padding: '10px', zIndex: 100, width: '150px', }} >
                                <button
                                    onClick={() => {
                                        setFilter('today');
                                        handleDateFilter();
                                        setShowFilterOptions(false);
                                    }}
                                    className={`filter-button ${filter === 'today' ? 'selected-filter' : ''}`}
                                    style={{ color: filter === 'today' ? 'green' : 'inherit', backgroundColor: 'transparent', border: 'none', padding: '5px 10px', cursor: 'pointer', }} > Today
                                </button>
                                <button
                                    onClick={() => {
                                        setFilter('single-day');
                                        setShowFilterOptions(true);
                                    }}
                                    className={`filter-button ${filter === 'single-day' ? 'selected-filter' : ''}`}
                                    style={{ color: filter === 'single-day' ? 'green' : 'inherit', backgroundColor: 'transparent', border: 'none', padding: '5px 10px', cursor: 'pointer', }} > Single Day
                                </button>
                                <button
                                    onClick={() => {
                                        setFilter('date-range');
                                        setShowFilterOptions(true);
                                    }}
                                    className={`filter-button ${filter === 'date-range' ? 'selected-filter' : ''}`}
                                    style={{ color: filter === 'date-range' ? 'green' : 'inherit', backgroundColor: 'transparent', border: 'none', padding: '5px 10px', cursor: 'pointer', }} > Date Range
                                </button>
                                <button
                                    onClick={() => {
                                        setFilter('all-date');
                                        handleDateFilter();
                                        setShowFilterOptions(false);
                                    }}
                                    className={`filter-button ${filter === 'all-date' ? 'selected-filter' : ''}`}
                                    style={{ color: filter === 'all-date' ? 'green' : 'inherit', backgroundColor: 'transparent', border: 'none', padding: '5px 10px', cursor: 'pointer', marginTop: '10px', }} > All Date
                                </button>
                                {filter === "single-day" && (
                                    <>
                                        <input
                                            type="date"
                                            value={selectedDate}
                                            onChange={(e) => setSelectedDate(e.target.value)}
                                            className="date-input"
                                            placeholder="Select a Date"
                                        />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                                            <button
                                                onClick={() => {
                                                    if (selectedDate) {
                                                        handleDateFilter();
                                                    } else {
                                                        setFilter('all-date');
                                                        handleDateFilter();
                                                    }
                                                    setShowFilterOptions(false);
                                                }}
                                                className="apply-filter-button"
                                            >
                                                Apply
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setFilter('all-date');
                                                    setSelectedDate("");
                                                    handleDateFilter();
                                                    setShowFilterOptions(false);
                                                }}
                                                className="cancel-filter-button"
                                                style={{ color: 'red', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', }} > Cancel
                                            </button>
                                        </div>
                                    </>
                                )}

                                {filter === "date-range" && (
                                    <>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="date-input"
                                            placeholder="Start Date"
                                        />
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="date-input"
                                            placeholder="End Date"
                                        />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                                            <button
                                                onClick={() => {
                                                    if (startDate && endDate) {
                                                        handleDateFilter();
                                                    } else {
                                                        setFilter('all-date');
                                                        handleDateFilter();
                                                    }
                                                    setShowFilterOptions(false);
                                                }}
                                                className="apply-filter-button"
                                            >
                                                Apply
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setFilter('all-date');
                                                    setStartDate("");
                                                    setEndDate("");
                                                    handleDateFilter();
                                                    setShowFilterOptions(false);
                                                }}
                                                className="cancel-filter-button"
                                                style={{ color: 'red', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', }} > Cancel
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        {showNoLoanPopup && (
                            <div className="popup" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', padding: '20px', background: ' rgba(0, 0, 0, 0.5)', borderRadius: '5px', boxShadow: '0px 0px 20px 0px rgb(154, 154, 154)', background: ' #bbbbbb', zIndex: 2000, }}>
                                <p>There's no loan made on this date.</p>
                                <button
                                    onClick={() => {
                                        setShowNoLoanPopup(false);
                                        setFilter('all-date');
                                        handleDateFilter();
                                    }}
                                    style={{ backgroundColor: 'green', color: 'black', border: 'none', padding: '10px 20px', cursor: 'pointer', justifyContentContent: 'center' }} > Ok
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div style={{ position: 'relative', marginBottom: '10px' }}>
                {!formVisible && (
                    <button onClick={() => setFormVisible(true)} style={{ backgroundColor: '#28a745', color: 'black', padding: '10px 20px', border: '0px', borderRadius: '5px', cursor: 'pointer', position: 'relative', marginLeft: '-5px', marginTop: '-55px', position: 'fixed' }} > <FaRegCreditCard style={{ marginRight: '5px', fontSize: '25px', marginBottom: '-5px' }}/> Add Loan </button>
                )}
            </div>
            
            {/* suzane  */}
            {formVisible && (
                <form onSubmit={handleLoanSubmit} className="loan-form" noValidate>
                    <h3 className="form-header">Create Loan</h3>
                    {/* General errors banner (hidden when inline name error is present to avoid redundancy) */}
                    {!errors?.account_holder && (
                        <>
                            {errors?.reloan && <div className="error-banner">{errors.reloan}</div>}
                            {errors?.member && <div className="error-banner">{errors.member}</div>}
                            {errors?.general && <div className="error-banner">{errors.general}</div>}
                        </>
                    )}
                    
                    <div className="form-row">
                        {/* Member */}
                        <div className={`form-group ${errors?.account_holder ? 'has-error' : ''}`}>
                            <label>Enter Member's Name</label>
                            <input
                                type="text"
                                name="account_holder"
                                value={loanData.account_holder}
                                onChange={handleHolderChange}
                                className={`form-control ${errors?.account_holder ? 'input-error' : ''}`}
                                placeholder="Enter Member's Name"
                            />
                            {errors?.account_holder && <div className="field-error">{errors.account_holder}</div>}
                            {accountHolder.length > 0 && (
                                <div className='maker-name-list'>
                                    {accountHolder.map((maker) => (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLoanData({ ...loanData, account_holder: maker.name });
                                                setAccountHolder([]);
                                            }}
                                            key={maker.name}
                                        >
                                            {maker.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Loan Type */}
                        <div className={`form-group ${errors?.loan_type ? 'has-error' : ''}`}>
                            <label>Loan Type</label>
                            <select
                                name="loan_type"
                                className={`form-control ${errors?.loan_type ? 'input-error' : ''}`}
                                value={loanData.loan_type}
                                onChange={(e) => setLoanData({ ...loanData, loan_type: e.target.value })}
                                style={{ marginTop: "8px", borderRadius: "10px" }}
                            >
                                <option value="Regular">Regular</option>
                                <option value="Emergency">Emergency</option>
                            </select>
                            {errors?.loan_type && <div className="field-error">{errors.loan_type}</div>}
                        </div>

                        {/* Loan Amount */}
                        <div className={`form-group ${errors?.loan_amount ? 'has-error' : ''}`}>
                            <label>Loan Amount</label>
                            <input
                                type="text"
                                name="loan_amount"
                                value={formatNumber(loanData.loan_amount)}
                                className={`form-control ${errors?.loan_amount ? 'input-error' : ''}`}
                                style={{ marginTop: "8px", borderRadius: "10px" }}
                                onChange={(e) => {
                                    const rawValue = e.target.value.replace(/,/g, "");
                                    if (!isNaN(rawValue)) {
                                        setLoanData({ ...loanData, loan_amount: rawValue });
                                    }
                                }}
                                required
                                placeholder="Loan Amount"
                                disabled={fieldsDisabled}
                            />
                            {errors?.loan_amount && <div className="field-error">{errors.loan_amount}</div>}
                        </div>

                        {/* Loan Term */}
                        <div className={`form-group ${errors?.loan_period ? 'has-error' : ''}`}>
                            <label>Loan Term</label>
                            <select
                                name="loan_period"
                                value={loanData.loan_period}
                                onChange={(e) => setLoanData({ ...loanData, loan_period: e.target.value })}
                                // required
                                className={`form-control ${errors?.loan_period ? 'input-error' : ''}`}
                                style={{ marginTop: "8px", borderRadius: "10px" }}
                                disabled={fieldsDisabled}
                            >
                                <option value="">Select Loan Term</option>
                                {loanData.loan_type === "Regular" && (
                                    <>
                                        <option value="1">1</option>
                                        <option value="2">2</option>
                                        <option value="3">3</option>
                                        <option value="4">4</option>
                                    </>
                                )}
                                {loanData.loan_type === "Emergency" && (
                                    <>
                                        <option value="1">1</option>
                                        <option value="2">2</option>
                                        <option value="3">3</option>
                                        <option value="4">4</option>
                                        <option value="5">5</option>
                                        <option value="6">6</option>
                                    </>
                                )}
                            </select>
                            {errors?.loan_period && <div className="field-error">{errors.loan_period}</div>}
                        </div>
                    </div>

                    <div className="form-row">
                        {/* Loan Term Unit */}
                        <div className={`form-group ${errors?.loan_period_unit ? 'has-error' : ''}`}>
                            <label>Loan Term Unit:</label>
                            <select
                                name="loan_period_unit"
                                value={loanData.loan_period_unit}
                                onChange={(e) => setLoanData({ ...loanData, loan_period_unit: e.target.value })}
                                // required
                                className={`form-control ${errors?.loan_period_unit ? 'input-error' : ''}`}
                                style={{ appearance: "none", background: "white", color: "black", pointerEvents: "none", marginTop: "8px", borderRadius: "10px" }}
                                disabled
                            >
                                <option value="months">Months</option>
                                <option value="years">Years</option>
                            </select>
                            
                            {errors?.loan_period_unit && <div className="field-error">{errors.loan_period_unit}</div>}
                        </div>

                        {/* Purpose */}
                        <div className={`form-group ${errors?.purpose ? 'has-error' : ''}`}>
                            <label>Purpose:</label>
                            <select
                                name="purpose"
                                value={loanData.purpose}
                                onChange={(e) => {
                                    const selectedValue = e.target.value;
                                    setLoanData({ ...loanData, purpose: selectedValue });
                                    setShowOtherPurpose(selectedValue === "Others");
                                }}
                                className={`form-control ${errors?.purpose ? 'input-error' : ''}`}
                                style={{ marginTop: "8px", borderRadius: "10px" }}
                                disabled={fieldsDisabled}
                            >
                                <option value="Education">Education</option>
                                <option value="Medical/Emergency">Medical/Emergency</option>
                                <option value="House Construction">House Construction</option>
                                <option value="Commodity/Appliances">Commodity/Appliances</option>
                                <option value="Utility Services">Utility Services</option>
                                <option value="Others">Others</option>
                            </select>
                            {errors?.purpose && <div className="field-error">{errors.purpose}</div>}
                        </div>

                        {showOtherPurpose && (
                            <div className={`form-group ${errors?.otherPurpose ? 'has-error' : ''}`}>
                                <label>Other Purpose:</label>
                                <input
                                    type="text"
                                    placeholder="Specify other Purpose"
                                    value={loanData.otherPurpose || ''}
                                    onChange={(e) => setLoanData({ ...loanData, otherPurpose: e.target.value })}
                                    className={`form-control ${errors?.otherPurpose ? 'input-error' : ''}`}
                                    style={{ marginTop: "8px", borderRadius: "10px" }}
                                />
                                {errors?.otherPurpose && <div className="field-error">{errors.otherPurpose}</div>}
                            </div>
                        )}

                        {/* Comakers requirement error */}
                        {errors?.comakers_required && (
                            <div className="comakers-error" style={{ width: '100%' }}>
                                ⚠️ {errors.comakers_required}
                            </div>
                        )}

                        {loanData.loan_type === 'Emergency' && (
                        <div className={`form-group ${errors?.co_maker ? 'has-error' : ''}`}>
                            <label>Co Maker 1</label>
                            <input
                                type="text"
                                placeholder="Enter Co Maker"
                                value={loanData.co_maker || ''}
                                onChange={handleMakerOneSearch}
                                className={`form-control ${errors?.co_maker ? 'input-error' : ''}`}
                                style={{ marginTop: "8px", borderRadius: "10px" }}
                                disabled={fieldsDisabled}
                            />
                            {errors?.co_maker && <div className="field-error">{errors.co_maker}</div>}
                            {makerOneSearch.length > 0 && (
                                <div className='maker-name-list'>
                                    {makerOneSearch.map((maker) => (
                                        <button
                                            type="button"
                                            onClick={() => selectMakerFromSuggestion(maker, 1)}
                                            key={maker.memId}
                                        >
                                            {`${maker.first_name} ${maker.middle_name || ''} ${maker.last_name}`.trim()}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                        {/* Co-Makers (for loans under 1M) */}
                        {loanData.loan_type === 'Regular' && parseInt(loanData.loan_amount) <= 999999 && (
                        <>
                            <div className={`form-group ${errors?.co_maker ? 'has-error' : ''}`}>
                                <label>Co Maker 1</label>
                                <input
                                    type="text"
                                    placeholder="Enter Co Maker"
                                    value={loanData.co_maker || ''}
                                    onChange={handleMakerOneSearch}
                                    className={`form-control ${errors?.co_maker ? 'input-error' : ''}`}
                                    style={{ marginTop: "8px", borderRadius: "10px" }}
                                    disabled={fieldsDisabled}
                                />
                                {errors?.co_maker && <div className="field-error">{errors.co_maker}</div>}
                                {makerOneSearch.length > 0 && (
                                    <div className='maker-name-list'>
                                        {makerOneSearch.map((maker) => (
                                            <button
                                                type="button"
                                                onClick={() => selectMakerFromSuggestion(maker, 1)}
                                                key={maker.memId}
                                            >
                                                {`${maker.first_name} ${maker.middle_name || ''} ${maker.last_name}`.trim()}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                                <div className={`form-group ${errors?.co_maker_2 ? 'has-error' : ''}`}>
                                    <label>Co Maker 2</label>
                                    <input
                                        type="text"
                                        placeholder="Enter Co Maker"
                                        value={loanData.co_maker_2 || ''}
                                        onChange={handleMakerTwoSearch}
                                        className={`form-control ${errors?.co_maker_2 ? 'input-error' : ''}`}
                                        style={{ marginTop: "8px", borderRadius: "10px" }}
                                        disabled={fieldsDisabled}
                                    />
                                    {errors?.co_maker_2 && <div className="field-error">{errors.co_maker_2}</div>}
                                    {makerTwoSearch.length > 0 && (
                                        <div className='maker-name-list'>
                                            {makerTwoSearch.map((maker) => (
                                                <button
                                                    type="button"
                                                    onClick={() => selectMakerFromSuggestion(maker, 2)}
                                                    key={maker.memId}
                                                >
                                                    {`${maker.first_name} ${maker.middle_name || ''} ${maker.last_name}`.trim()}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className={`form-group ${errors?.co_maker_3 ? 'has-error' : ''}`}>
                                    <label>Co Maker 3</label>
                                    <input
                                        type="text"
                                        placeholder="Enter Co Maker"
                                        value={loanData.co_maker_3 || ''}
                                        onChange={handleMakerThreeSearch}
                                        className={`form-control ${errors?.co_maker_3 ? 'input-error' : ''}`}
                                        style={{ marginTop: "8px", borderRadius: "10px" }}
                                        disabled={fieldsDisabled}
                                    />
                                    {errors?.co_maker_3 && <div className="field-error">{errors.co_maker_3}</div>}
                                    {makerThreeSearch.length > 0 && (
                                        <div className='maker-name-list'>
                                            {makerThreeSearch.map((maker) => (
                                                <button
                                                    type="button"
                                                    onClick={() => selectMakerFromSuggestion(maker, 3)}
                                                    key={maker.memId}
                                                >
                                                    {`${maker.first_name} ${maker.middle_name || ''} ${maker.last_name}`.trim()}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Co-Makers (for loans 1M and above) */}
                        {parseInt(loanData.loan_amount) >= 1000000 && (
                            <>
                                {[1, 2, 3, 4, 5].map((num) => {
                                    const fieldKey = num === 1 ? 'co_maker' : `co_maker_${num}`;
                                    const searchState = num === 1 ? makerOneSearch : 
                                                    num === 2 ? makerTwoSearch : 
                                                    num === 3 ? makerThreeSearch : 
                                                    num === 4 ? makerFourSearch : makerFiveSearch;
                                    const handleSearch = num === 1 ? handleMakerOneSearch : 
                                                        num === 2 ? handleMakerTwoSearch : 
                                                        num === 3 ? handleMakerThreeSearch : 
                                                        num === 4 ? handleMakerFourSearch : handleMakerFiveSearch;
                                    
                                    return (
                                        <div key={num} className={`form-group ${errors?.[fieldKey] ? 'has-error' : ''}`}>
                                            <label>Co Maker {num}</label>
                                            <input
                                                type="text"
                                                placeholder="Enter Co Maker"
                                                value={loanData[fieldKey] || ''}
                                                onChange={handleSearch}
                                                className={`form-control ${errors?.[fieldKey] ? 'input-error' : ''}`}
                                                style={{ marginTop: "8px", borderRadius: "10px" }}
                                            />
                                            {errors?.[fieldKey] && <div className="field-error">{errors[fieldKey]}</div>}
                                            {searchState.length > 0 && (
                                                <div className='maker-name-list'>
                                                    {searchState.map((maker) => (
                                                        <button
                                                            type="button"
                                                            onClick={() => selectMakerFromSuggestion(maker, num)}
                                                            key={maker.memId}
                                                        >
                                                            {`${maker.first_name} ${maker.middle_name || ''} ${maker.last_name}`.trim()}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    

                    {loanData.loan_type === 'Regular' && parseInt(loanData.loan_amount) > 1500000 && (
                        <>
                            {[1, 2, 3, 4, 5].map((num) => {
                                const fieldKey = num === 1 ? 'co_maker' : `co_maker_${num}`;
                                const searchState = num === 1 ? makerOneSearch : 
                                                num === 2 ? makerTwoSearch : 
                                                num === 3 ? makerThreeSearch : 
                                                num === 4 ? makerFourSearch : makerFiveSearch;
                                const handleSearch = num === 1 ? handleMakerOneSearch : 
                                                    num === 2 ? handleMakerTwoSearch : 
                                                    num === 3 ? handleMakerThreeSearch : 
                                                    num === 4 ? handleMakerFourSearch : handleMakerFiveSearch;
                                
                                return (
                                    <div key={num} className="form-group">
                                        <label>Co Maker {num} (Optional)</label>
                                        <input
                                            type="text"
                                            placeholder="Enter Co Maker"
                                            value={loanData[fieldKey] || ''}
                                            onChange={handleSearch}
                                            className="form-control" 
                                            style={{ marginTop: "8px", borderRadius: "10px" }}
                                        />
                                        {searchState.length > 0 && (
                                            <div className='maker-name-list'>
                                                {searchState.map((maker) => (
                                                    <button
                                                        type="button"
                                                        onClick={() => selectMakerFromSuggestion(maker, num)}
                                                        key={maker.memId}
                                                    >
                                                        {`${maker.first_name} ${maker.middle_name || ''} ${maker.last_name}`.trim()}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>

                    {!loanSubmitted && (
                        <>
                            <button type="submit" className="form-submit" disabled={fieldsDisabled}>
                                {editingLoan ? 'Update Loan' : 'Create Loan'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    resetForm();
                                    setFormVisible(false);
                                    setErrors(null); // Clear errors on cancel
                                }}
                                className="form-cancel"
                                disabled={false}
                            >
                                Cancel
                            </button>
                        </>
                    )}
                </form>
            )}
            {/* suzane ends */}

            {showPopup && (
                <>
                    <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        background: 'rgba(0,0,0,0.15)',
                        backdropFilter: 'blur(5px)',
                        zIndex: 1999,
                    }}
                    />
                    <div className="popup-overlay" style={{ zIndex: 2000 }}>
                        <div className="popup-box">
                            <div className="popup">
                                <p>{popupMessage}</p>
                            </div>
                            {errors && Object.keys(errors).length > 0 && (
                                <ul>
                                    {Object.values(errors).map((error, index) => (
                                        <li key={index} className="error-text" style={{ listStyle: 'none' }}>
                                            {error}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {!popupMessage.includes('successfully') && (
                                <button onClick={closePopup} className="close-btn">OK</button>
                            )}
                        </div>
                    </div>
                </>
            )}
            
            {!formVisible && !paymentFormVisible && (
                <div className="loan-table-wrapper">
                    {filteredLoans
                        .filter(l => l.loan_type === activeLoanType)
                        .some(l => ((l.status || '')).toLowerCase().trim() === 'settled') && (
                          <div style={{ display: 'none' }} />
                    )}
                    <div className="loan-buttons-fixed">
                        <button onClick={() => setActiveLoanType('Regular')}>📌 Regular Loan</button>
                        <button onClick={() => setActiveLoanType('Emergency')}>⚠️ Emergency Loan</button>
                    </div>
                    <div className="loans-table-scroll">
                        <table className="loan-table">
                            <thead>
                                <tr>
                                    <th>Cheque Number</th>
                                    <th>Account Number</th>
                                    <th>Member</th>
                                    <th>Type</th>
                                    <th>Amount</th>
                                    <th>Term </th>
                                    <th>Service Fee</th>
                                    <th>Interest Fee</th>
                                    <th>Admin Cost</th>
                                    <th>Notarial Fee</th>
                                    <th>CISP</th>
                                    <th>Net Proceeds</th>
                                    <th>Purpose</th>
                                    <th>Status</th>
                                    <th>Co-Makers</th>
                                    <th
                                        style={{
                                            display: filteredLoans
                                                .filter(l => l.loan_type === activeLoanType)
                                                .some(l => ((l.status || '')).toLowerCase().trim() === 'settled')
                                                ? 'table-cell'
                                                : 'none'
                                        }}
                                    >
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLoans.filter(loan => loan.loan_type === activeLoanType).length > 0 ? (
                                    filteredLoans
                                        .filter(loan => loan.loan_type === activeLoanType)
                                        .map((loan) => (
                                            <tr key={loan.control_number}>
                                                <td>{loan.control_number}</td>
                                                <td>{loan.account || 'N/A'}</td>
                                                <td>{loan.account_holder || 'N/A'}</td>
                                                <td>
                                                    {loan.loan_type}
                                                    {typeof ReloanBadge === 'function' && (
                                                        <span style={{ marginLeft: '6px', verticalAlign: 'middle' }}>
                                                            <ReloanBadge loan={loan} compact />
                                                        </span>
                                                    )}
                                                </td>
                                                <td>{formatNumber(loan.loan_amount)}</td>
                                                <td>{`${loan.loan_period} ${loan.loan_type === 'Regular' ? 'Yrs' : 'Months'}`}</td>
                                                <td>{formatNumber(loan.service_fee)}</td>
                                                <td>{formatNumber(loan.interest_amount)}</td>
                                                <td>{formatNumber(loan.admincost)}</td>
                                                <td>{formatNumber(loan.notarial)}</td>
                                                <td>{formatNumber(loan.cisp)}</td>
                                                <td>{formatNumber(loan.net_proceeds)}</td>
                                                <td>{loan.purpose}</td>
                                                <td style={{ 
                                                    color: ((loan.status || '').toLowerCase() === 'ongoing') ? 'red' : 
                                                           ((loan.status || '').toLowerCase() === 'settled') ? 'green' : 'black' 
                                                }}>
                                                    {loan.status || 'N/A'}
                                                </td>
                                                <td>
                                                    <button onClick={() => {
                                                        setCoMakers([loan.co_maker, loan.co_maker_2, loan.co_maker_3, loan.co_maker_4, loan.co_maker_5]);
                                                        setMakersModal(true)
                                                    }}
                                                    style={{
                                                            borderRadius: '10px',
                                                            padding: '5px',
                                                            color: 'black',
                                                            width: '80px',
                                                            fontSize: '14px',
                                                        }}>
                                                        <FaEye /> View
                                                    </button>
                                                </td>
                                                <td
                                                    style={{
                                                        display: filteredLoans
                                                            .filter(l => l.loan_type === activeLoanType)
                                                            .some(l => ((l.status || '')).toLowerCase().trim() === 'settled')
                                                            ? 'table-cell'
                                                            : 'none'
                                                    }}
                                                >
                                                    {loan.status.toLowerCase() === 'settled' && (
                                                        <button
                                                            onClick={() => archiveLoan(loan)}
                                                            style={{
                                                                backgroundColor: '#ff0d00ff',
                                                                cursor: 'pointer',
                                                                borderRadius: '10px',
                                                                padding: '5px',
                                                                color: 'black',
                                                                width: '80px',
                                                                fontSize: '14px',
                                                            }}
                                                        >
                                                            <FaTrash /> Archive
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                ) : (
                                    <tr>
                                        <td colSpan="15" style={{ textAlign: 'center' }}>
                                            No {activeLoanType} Loans found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {makersModal && (
                <div className="makers-modal">
                    <div className="modal-content">
                        <button 
                            className="close-button"
                            onClick={() => setMakersModal(false)}
                        >
                            ×
                        </button>
                        
                        <div className="modal-header">
                            <h2>Co-Makers List</h2>
                        </div>
                        
                        <div className="modal-body">
                            {coMakers.filter(maker => maker && maker.trim() !== '').length > 0 ? (
                                coMakers.filter(maker => maker && maker.trim() !== '').map((maker, index) => (
                                    <div key={index} className="co-maker-card">
                                        <p className="co-maker-name">{maker}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="no-makers">
                                    No co-makers assigned to this loan
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
               
            {showPrintButton && newLoan && (
                <div className="buttons-container">
                    <button 
                        className="print-button" 
                        style={{ 
                            backgroundColor: "#4CAF50", 
                            color: "black", 
                            border: '0px', 
                            textAlign: "center", 
                            textDecoration: "none", 
                            display: "inline-block", 
                            fontSize: "16px", 
                            cursor: "pointer", 
                            borderRadius: "5px", 
                            marginLeft: '5px', 
                            marginTop: '5px',
                            padding: '10px 20px'
                        }} 
                        onClick={async () => { 
                            const printContent = ` 
                                <div style="border: 2px solid #000; padding: 20px; width: fit-content; margin: 0 auto;"> 
                                    <h1>Loan Details</h1> 
                                    <p><strong>Control Number:</strong> ${newLoan.control_number}</p> 
                                    <p><strong>Account:</strong> ${newLoan.account}</p> 
                                    <p><strong>Amount:</strong> ${newLoan.loan_amount}</p> 
                                    <p><strong>Type:</strong> ${newLoan.loan_type}</p> 
                                    <p><strong>Interest Rate:</strong> ${newLoan.interest_rate}</p> 
                                    <p><strong>Loan Period:</strong> ${newLoan.loan_period} ${newLoan.loan_period_unit}</p> 
                                    <p><strong>Loan Date:</strong> ${newLoan.loan_date}</p> 
                                    <p><strong>Due Date:</strong> ${newLoan.due_date}</p> 
                                    <p><strong>Status:</strong> ${newLoan.status}</p> 
                                    <p><strong>Service Fee:</strong> ${newLoan.service_fee}</p> 
                                    <p><strong>Take Home Pay:</strong> ${newLoan.net_proceeds}</p> 
                                    <p><strong>Penalty Rate:</strong> ${newLoan.penalty_rate}</p> 
                                    <p><strong>Purpose:</strong> ${newLoan.purpose}</p> 
                                    <div style="text-align: center; margin-top: 70px;"> 
                                        <p style="width: 200px; border-bottom: 2px solid black; margin: 0 auto;"></p> 
                                        <p><strong>Member Signature</strong></p> 
                                    </div> 
                                    <div style="display: flex; justify-content: space-between; margin-top: 60px;"> 
                                        <div style="text-align: center; flex: 1;"> 
                                            <p style="width: 200px; border-bottom: 2px solid black; margin: 0 auto;"></p> 
                                            <p><strong>Signature Verified By</strong></p> 
                                        </div> 
                                        <div style="text-align: center; flex: 1;"> 
                                            <p style="width: 200px; border-bottom: 2px solid black; margin: 0 auto;"></p> 
                                            <p><strong>Approved By</strong></p> 
                                        </div> 
                                    </div> 
                                </div> 
                            `; 
                            const printWindow = window.open('', '_blank'); 
                            printWindow.document.write(` 
                                <html> 
                                    <head> 
                                        <title>Print</title> 
                                        <style> 
                                            body { font-family: Arial, sans-serif; padding: 20px; } 
                                            h1 { color: black; } 
                                            p { font-size: 16px; } 
                                        </style> 
                                    </head> 
                                    <body> 
                                        ${printContent} 
                                    </body> 
                                </html> 
                            `); 
                            printWindow.document.close(); 
                            printWindow.onload = function () { 
                                printWindow.print(); 
                            }; 
                            resetForm(); 
                        }} 
                    > 
                        Print Loan Details 
                    </button>
                    <button 
                        className="cancel-button" 
                        style={{ 
                            backgroundColor: "#f44336", 
                            color: "black", 
                            border: '0px', 
                            textAlign: "center", 
                            textDecoration: "none", 
                            display: "inline-block", 
                            fontSize: "16px", 
                            cursor: "pointer", 
                            borderRadius: "5px", 
                            marginLeft: '10px',
                            marginTop: '5px',
                            padding: '10px 20px'
                        }} 
                        onClick={resetForm} 
                    > 
                        Cancel 
                    </button>
                </div>
            )}
        </div>
    );
};

export default LoanManager;