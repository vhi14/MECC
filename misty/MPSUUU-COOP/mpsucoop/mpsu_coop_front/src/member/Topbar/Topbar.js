import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTachometerAlt, faExchangeAlt, faUser, faPowerOff, faCreditCard, faHandHoldingUsd, faUserCircle, faChevronDown, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import coopLogo from './COOP.png';
import ReactDOM from "react-dom";

const Topbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [username, setUsername] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Get username from localStorage
    const storedUsername = localStorage.getItem('username') || 'Member';
    setUsername(storedUsername);

    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  const handleLogout = () => {
    setShowDropdown(false);
    setShowLogoutPopup(true);
  };

  const handleLogoutConfirm = () => {
    localStorage.clear();
    navigate('/');
  };

  const handleLogoutCancel = () => {
    setShowLogoutPopup(false);
  };

  const topbarStyle = {
    height: '80px',
    backgroundColor: '#0d512c',
    color: 'goldenrod',
    padding: '10px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: '0 30px 30px 0',
    position: 'fixed',
    top: '0px',
    left: 0,
    width: '99%',
    zIndex: 1000
  };

  const logoContainerStyle = {
    display: 'flex',
    alignItems: 'center',
  };

  const navHeaderStyle = {
    fontSize: '28px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    margin: 0,
  };

  const navTopbarStyle = {
    listStyle: 'none',
    display: 'flex',
    alignItems: 'center',
    margin: 0,
    padding: 0,
  };

  const navItemStyle = {
    margin: '0 20px',
    cursor: 'pointer'
  };

  const getNavLinkStyle = (path) => ({
    textDecoration: 'none',
    color: location.pathname === path ? 'goldenrod' : 'white',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    fontSize: '18px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: '20px',
    gap: '8px',
    position: 'relative',
    transition: 'color 0.3s ease',
  });

  const navIconStyle = {
    fontSize: '18px',
  };

  const profileSectionStyle = {
    position: 'relative',
    marginRight: '10px',
    marginTop: '20px',
  };

  const profileTriggerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    padding: '6px 12px',
    borderRadius: '8px',
    transition: 'background-color 0.3s ease',
    backgroundColor: showDropdown ? 'rgba(218, 165, 32, 0.15)' : 'transparent',
  };

  const profileIconStyle = {
    fontSize: '26px',
    color: 'goldenrod',
  };

  const profileNameStyle = {
    color: 'white',
    fontSize: '14px',
    fontWeight: 'bold',
    maxWidth: '120px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textTransform: 'uppercase',
  };

  const chevronIconStyle = {
    fontSize: '10px',
    color: 'goldenrod',
    transition: 'transform 0.3s ease',
    transform: showDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
  };

  const dropdownMenuStyle = {
    position: 'absolute',
    top: '50px',
    right: '0',
    backgroundColor: '#0d512c',
    border: '2px solid goldenrod',
    borderRadius: '8px',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
    minWidth: '180px',
    overflow: 'hidden',
    zIndex: 1001,
  };

  const dropdownItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    color: 'white',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    fontSize: '14px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  };

  const dropdownIconStyle = {
    fontSize: '14px',
    color: 'goldenrod',
  };

  return (
    <>
      <style>
        {`
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .profile-trigger:hover {
            background-color: rgba(218, 165, 32, 0.15) !important;
          }
          .dropdown-item:hover {
            background-color: rgba(218, 165, 32, 0.25) !important;
          }
          .nav-link p {
            margin: 0;
          }
          .nav-link.active::after {
            content: '';
            position: absolute;
            bottom: -5px;
            left: 0;
            width: 100%;
            height: 3px;
            background-color: goldenrod;
          }
        `}
      </style>
      <div style={topbarStyle}>
        <div style={logoContainerStyle}>
          <img
            src={coopLogo}
            alt="MPSPC COOP Logo"
            onClick={() => window.location.reload()}
            style={{
              width: '90px',
              height: '90px',
              marginRight: '10px',
              borderRadius: '47%',
              marginTop: '1px',
              cursor: 'pointer'
            }}
          />
          <div style={navHeaderStyle}>MPSPC EMPLOYEES CREDIT COOPERATIVE</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ul style={navTopbarStyle}>
            <li style={navItemStyle}>
              <Link to="/Home" style={getNavLinkStyle('/Home')} className={location.pathname === '/Home' ? 'nav-link active' : 'nav-link'}>
                <FontAwesomeIcon icon={faTachometerAlt} style={navIconStyle} />
                <p>Home</p>
              </Link>
            </li>
            <li style={navItemStyle}>
              <Link to="/infos" style={getNavLinkStyle('/infos')} className={location.pathname === '/infos' ? 'nav-link active' : 'nav-link'}>
                <FontAwesomeIcon icon={faUser} style={navIconStyle} />
                <p>Profile</p>
              </Link>
            </li>
            {/* <li style={navItemStyle}>
              <Link to="/accounts" style={getNavLinkStyle('/accounts')} className={location.pathname === '/accounts' ? 'nav-link active' : 'nav-link'}>
                <FontAwesomeIcon icon={faExchangeAlt} style={navIconStyle} />
                <p>Transactions</p>
              </Link>
            </li> */}
            {/* <li style={navItemStyle}>
              <Link to="/payments" style={getNavLinkStyle('/payments')} className={location.pathname === '/payments' ? 'nav-link active' : 'nav-link'}>
                <FontAwesomeIcon icon={faCreditCard} style={navIconStyle} />
                <p>Payments</p>
              </Link>
            </li> */}
            {/* <li style={navItemStyle}>
              <Link to="/Loans" style={getNavLinkStyle('/Loans')} className={location.pathname === '/Loans' ? 'nav-link active' : 'nav-link'}>
                <FontAwesomeIcon icon={faHandHoldingUsd} style={navIconStyle} />
                <p>Loan</p>
              </Link>
            </li> */}
          </ul>

          {/* Profile Dropdown */}
          <div style={profileSectionStyle} ref={dropdownRef}>
            <div 
              style={profileTriggerStyle} 
              onClick={toggleDropdown}
              className="profile-trigger"
            >
              <FontAwesomeIcon icon={faUserCircle} style={profileIconStyle} />
              <span style={profileNameStyle}>{username}</span>
              <FontAwesomeIcon icon={faChevronDown} style={chevronIconStyle} />
            </div>
            
            {showDropdown && (
              <div style={dropdownMenuStyle}>
                <div 
                  style={dropdownItemStyle} 
                  onClick={handleLogout}
                  className="dropdown-item"
                >
                  <FontAwesomeIcon icon={faSignOutAlt} style={dropdownIconStyle} />
                  <span>Log out</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {showLogoutPopup &&
          ReactDOM.createPortal(
            <>
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  width: "100vw",
                  height: "100vh",
                  backgroundColor: "rgba(0,0,0,0.4)",
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                  zIndex: 9998,
                }}
              />
              <div
                style={{
                  position: "fixed",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  backgroundColor: "white",
                  padding: "20px",
                  borderRadius: "10px",
                  boxShadow: '0px 0px 15px 0px rgb(154, 154, 154)',
                  textAlign: "center",
                  zIndex: 9999,
                }}
              >
                <p style={{ fontSize: "18px", marginBottom: "20px" }}>
                  Are you sure you want to log out?
                </p>
                <button
                  onClick={handleLogoutConfirm}
                  style={{
                    marginRight: '10px',
                    padding: '8px 20px',
                    backgroundColor: '#049927ff',
                    color: 'black',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  Yes
                </button>
                <button
                  onClick={handleLogoutCancel}
                  style={{
                    padding: '8px 20px',
                    backgroundColor: 'gray',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    color: 'black',
                  }}
                >
                  Cancel
                </button>
              </div>
            </>,
            document.body
          )}
          
      </div>
    </>
  );
};

export default Topbar;