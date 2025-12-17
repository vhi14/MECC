import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTachometerAlt, faUser, faUserCircle, faChevronDown, faSignOutAlt, faBars, faTimes, faWallet, faFileContract} from '@fortawesome/free-solid-svg-icons';
import coopLogo from './COOP.png';
import ReactDOM from "react-dom";
import './Topbar.css';

const Topbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [username, setUsername] = useState('');
  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);

  useEffect(() => {
    // Get username from localStorage
    const storedUsername = localStorage.getItem('username') || 'Member';
    setUsername(storedUsername);

    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        setShowMobileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  const toggleMobileMenu = () => {
    setShowMobileMenu(!showMobileMenu);
  };

  const handleLogout = () => {
    setShowDropdown(false);
    setShowMobileMenu(false);
    setShowLogoutPopup(true);
  };

  const handleLogoutConfirm = () => {
    localStorage.clear();
    navigate('/');
  };

  const handleLogoutCancel = () => {
    setShowLogoutPopup(false);
  };

  const closeMobileMenu = () => {
    setShowMobileMenu(false);
  };

  return (
    <>
      <div className="Topbar">
        <div className="logo-container">
          <img
            src={coopLogo}
            alt="MPSPC COOP Logo"
            onClick={() => window.location.reload()}
            className="logoImage"
          />
          <div className="nav-header">MPSPC EMPLOYEES CREDIT COOPERATIVE</div>
        </div>

        {/* Desktop Navigation */}
        <div className="nav-container-desktop">
          <ul className="nav-Topbar">
            <li className="nav-item">
              <Link 
                to="/Home" 
                className={`nav-link ${location.pathname === '/Home' ? 'active' : ''}`}
              >
                <FontAwesomeIcon icon={faTachometerAlt} className="nav-icon" />
                <p>Home</p>
              </Link>
            </li>
            <li className="nav-item">
              <Link 
                to="/infos" 
                className={`nav-link ${location.pathname === '/infos' ? 'active' : ''}`}
              >
                <FontAwesomeIcon icon={faUser} className="nav-icon" />
                <p>Profile</p>
              </Link>
            </li>
          </ul>

          {/* Profile Dropdown */}
          <div className="profile-section" ref={dropdownRef}>
            <div 
              className={`profile-trigger ${showDropdown ? 'active' : ''}`}
              onClick={toggleDropdown}
            >
              <FontAwesomeIcon icon={faUserCircle} className="profile-icon" />
              <span className="profile-name">{username}</span>
              <FontAwesomeIcon 
                icon={faChevronDown} 
                className="chevron-icon"
                style={{ transform: showDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </div>
            
            {showDropdown && (
              <div className="dropdown-menu">
                <div 
                  className="dropdown-item"
                  onClick={handleLogout}
                >
                  <FontAwesomeIcon icon={faSignOutAlt} className="dropdown-icon" />
                  <span>Log out</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Hamburger Menu */}
        <div className="mobile-menu-trigger" ref={mobileMenuRef}>
          <button 
            className="hamburger-btn"
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            <FontAwesomeIcon 
              icon={showMobileMenu ? faTimes : faBars} 
              className="hamburger-icon"
            />
          </button>

          {/* Mobile Side Menu */}
          {showMobileMenu && (
            <>
              <div className="mobile-menu-backdrop" onClick={() => setShowMobileMenu(false)} />
              <div className="mobile-menu-panel">
                {/* Mobile Profile Header */}
                <div className="mobile-profile-header">
                  <FontAwesomeIcon icon={faUserCircle} className="mobile-profile-icon" />
                  <div className="mobile-profile-info">
                    <p className="mobile-profile-name">{username}</p>
                    <p className="mobile-profile-label">Member</p>
                  </div>
                </div>

                <ul className="mobile-nav-menu">
                  <li className="mobile-nav-item">
                    <Link 
                      to="/Home" 
                      className={`mobile-nav-link ${location.pathname === '/Home' ? 'active' : ''}`}
                      onClick={closeMobileMenu}
                    >
                      <FontAwesomeIcon icon={faTachometerAlt} className="mobile-nav-icon" />
                      <span>Home</span>
                    </Link>
                  </li>
                  <li className="mobile-nav-item">
                    <Link 
                      to="/infos" 
                      className={`mobile-nav-link ${location.pathname === '/infos' ? 'active' : ''}`}
                      onClick={closeMobileMenu}
                    >
                      <FontAwesomeIcon icon={faUser} className="mobile-nav-icon" />
                      <span>Profile</span>
                    </Link>
                  </li>
                  <li className="mobile-nav-item">
                    <Link 
                      to="/accounts" 
                      className={`mobile-nav-link ${location.pathname === '/accounts' ? 'active' : ''}`}
                      onClick={closeMobileMenu}
                    >
                      <FontAwesomeIcon icon={faWallet} className="mobile-nav-icon" />
                      <span>Accounts</span>
                    </Link>
                  </li>
                  <li className="mobile-nav-item">
                    <Link 
                      to="/loans" 
                      className={`mobile-nav-link ${location.pathname === '/loans' ? 'active' : ''}`}
                      onClick={closeMobileMenu}
                    >
                      <FontAwesomeIcon icon={faFileContract} className="mobile-nav-icon" />
                      <span>Loans</span>
                    </Link>
                  </li>
                  <li className="mobile-nav-item">
                    <div 
                      className="mobile-nav-link logout-item"
                      onClick={handleLogout}
                    >
                      <FontAwesomeIcon icon={faSignOutAlt} className="mobile-nav-icon" />
                      <span>Log out</span>
                    </div>
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Logout Confirmation Popup */}
      {showLogoutPopup &&
        ReactDOM.createPortal(
          <>
            <div className="logout-popup-backdrop" />
            <div className="logout-popup-container">
              <p className="logout-popup-text">
                Are you sure you want to log out?
              </p>
              <div className="logout-popup-buttons">
                <button
                  onClick={handleLogoutConfirm}
                  className="logout-confirm-btn"
                >
                  Yes
                </button>
                <button
                  onClick={handleLogoutCancel}
                  className="logout-cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
};

export default Topbar;