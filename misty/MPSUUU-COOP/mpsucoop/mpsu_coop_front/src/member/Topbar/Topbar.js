import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTachometerAlt, faUser, faUserCircle, faChevronDown, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import coopLogo from './COOP.png';
import ReactDOM from "react-dom";
import './Topbar.css';

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
        
        <div className="nav-container">
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
      </div>

      {/* Logout Confirmation Popup */}
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
    </>
  );
};

export default Topbar;