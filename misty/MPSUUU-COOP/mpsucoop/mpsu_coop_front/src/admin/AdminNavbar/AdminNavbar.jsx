import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLandmark, faUsers, faSignOutAlt, faCalendarAlt, faGear, faHome, faCreditCardAlt, faHistory, faUsersCog, faUserTie, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import styles from './AdminNavbar.module.css';
import coopLogo from './COOP.png';  

const navItems = [
  { icon: faHome, label: 'Home', key: 'LoanSummary' },
  { icon: faUsers, label: 'Members', key: 'members' },
  { icon: faLandmark, label: 'Share Capital', key: 'accounts' },
  { icon: faCreditCardAlt, label: 'Loans', key: 'loans' },
  { icon: faHistory, label: 'Payments Overview', key: 'payments' },
  { icon: faCalendarAlt, label: 'Payment Schedules', key: 'payment-schedules' },
  // { icon: faArchive, label: 'Archive', key: 'archived-records' },
  // { icon: faUsersCog, label: 'Usermgmt', key: 'user-mgmt' },
  { icon: faGear, label: 'Settings', key: 'system-settings' },
];

function AdminNavbar({ onLinkClick }) {
  const navigate = useNavigate();
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeItem, setActiveItem] = useState(null);
  const [username, setUsername] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Get username from localStorage
    const storedUsername = localStorage.getItem('username') || 'Admin';
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

  const handleItemClick = (key) => {
    setActiveItem(key);
    onLinkClick(key);
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  const handleLogoutClick = () => {
    setShowDropdown(false);
    setShowLogoutPopup(true);
  };

  const handleLogoutConfirm = () => {
    console.log('Log out confirmed');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('username');
    localStorage.removeItem('userRole');
    localStorage.removeItem('account_number');
    navigate('/');
    setShowLogoutPopup(false);
  };

  const handleLogoutCancel = () => {
    setShowLogoutPopup(false);
  };

  return (
    <nav className={styles.adminNavbar}>
      <div className={styles.logoContainer}>
        <img
          src={coopLogo}
          alt="MPSPC COOP Logo"
          onClick={() => window.location.reload()}
          className={styles.logoImage}
          style={{
            width: '135px',
            height: '130px',
            marginRight: '10px',
            borderRadius: '47%', 
            marginTop: '10px',
            cursor: 'pointer'
          }}
        />
        <h1 className={styles.logoText}>MPSPC EMPLOYEES <br /> CREDIT COOPERATIVE</h1>
      </div>
      <ul className={styles.navList}>
        {navItems.map((item, index) => (
          <li 
            key={index} 
            className={`${styles.navItem} ${activeItem === item.key ? styles.active : ''}`}
            onClick={() => handleItemClick(item.key)}
          >
            <FontAwesomeIcon icon={item.icon} className={styles.navIcon} />
            <span className={styles.navLabel}>{item.label}</span>
          </li>
        ))}
      </ul>
      
      {/* Profile Dropdown */}
      <div className={styles.profileSection} ref={dropdownRef}>
        <div className={styles.profileTrigger} onClick={toggleDropdown}>
          <FontAwesomeIcon icon={faUserTie} className={styles.profileIcon} />
          <span className={styles.profileName}>{username}</span>
          <FontAwesomeIcon 
            icon={faChevronDown} 
            className={`${styles.chevronIcon} ${showDropdown ? styles.chevronOpen : ''}`}
          />
        </div>
        
        {showDropdown && (
          <div className={styles.dropdownMenu}>
            <div className={styles.dropdownItem} onClick={handleLogoutClick}>
              <FontAwesomeIcon icon={faSignOutAlt} className={styles.dropdownIcon} />
              <span>Log out</span>
            </div>
          </div>
        )}
      </div>

      {/* Popup Overlay for Logout Confirmation */}
      {showLogoutPopup && (
        <div className={styles.popupOverlay}>
          <div className={styles.popup}>
            <p>Are you sure you want to log out?</p>
            <button className={styles.popupButton} onClick={handleLogoutConfirm}>Yes</button>
            <button className={styles.popupButton} onClick={handleLogoutCancel}>Cancel</button>
          </div>
        </div>
      )}
    </nav>
  );
}

export default AdminNavbar;