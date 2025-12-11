import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Archive from '../Archive/Archive';
import Usermgmt from '../Usermgmt/Usermgmt';
import AdminProfile from '../AdminProfile/AdminProfile';
import { useNavigate } from 'react-router-dom';
import { FaCog, FaArchive, FaUsers, FaChevronDown} from 'react-icons/fa';

const SystemSettings = () => {
    const [settings, setSettings] = useState({
        interest_rate: 0,
        service_fee_rate_emergency: 0,
        penalty_rate: 0,
        service_fee_rate_regular_1yr: 0,
        service_fee_rate_regular_2yr: 0,
        service_fee_rate_regular_3yr: 0,
        service_fee_rate_regular_4yr: 0,
    });

    const [isEditing, setIsEditing] = useState(false);
    const [error, setError] = useState(null);
    const [activeView, setActiveView] = useState('Settings');
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (activeView === 'Settings') {
            axios
                .get(`${process.env.REACT_APP_API_URL}/api/system-settings/`)
                .then(response => {
                    setSettings(response.data);
                })
                .catch(err => {
                    setError('Error fetching system settings.');
                    console.error('System Settings API Error:', err.response || err);
                });
        }
    }, [activeView]);

    const handleChange = e => {
        const { name, value } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleUpdate = () => {
        axios
            .put(`${process.env.REACT_APP_API_URL}/api/system-settings/`, settings)
            .then(response => {
                setSettings(response.data);
                setIsEditing(false);
            })
            .catch(err => {
                setError('Error updating system settings.');
                console.error('Update Settings Error:', err.response || err);
            });
    };

    const handleMenuItemClick = menuItem => {
        setActiveView(menuItem);
        setShowUserDropdown(false);
    };

    const toggleUserDropdown = () => {
        setShowUserDropdown(!showUserDropdown);
    };

    const getTableContainerStyle = () => ({
        width: '100%',
        border: '1px solid black',
        marginTop: '10px',
        ...(isEditing && {
            maxHeight: '400px',
            overflowY: 'scroll',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': {
                display: 'none'
            }
        })
    });

    const getTableStyle = () => ({
        width: '100%',
        borderCollapse: 'collapse',
        boxShadow: '0px 0px 15px 0px rgb(154, 154, 154)',
        fontSize: '14px',
        color: 'black',
    });

    return (
        <div>
            {/* Navbar */}
            <nav className="navbar" style={{ display: 'flex', justifyContent: 'center', padding: '10px', gap: '440px'}}>
                <a className="nav-item" onClick={() => handleMenuItemClick('Settings')} style={{
                    ...navStyle,
                    ...(activeView === 'Settings' ? activeNavStyle : {})
                }}>
                    <FaCog /> System Settings
                </a>
                <a className="nav-item" onClick={() => handleMenuItemClick('Archive')} style={{
                    ...navStyle,
                    ...(activeView === 'Archive' ? activeNavStyle : {})
                }}>
                    <FaArchive /> Archive Records
                </a>
                
                {/* User Menu with Dropdown */}
                <div style={{ position: 'relative' }}>
                    <a 
                        className="nav-item" 
                        onClick={toggleUserDropdown}
                        style={{
                            ...navStyle,
                            ...(activeView === 'Admin' || activeView === 'Members' ? activeNavStyle : {}),
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}
                    >
                        <FaUsers /> User <FaChevronDown size={12} />
                    </a>
                    
                    {/* Dropdown Menu */}
                    {showUserDropdown && (
                        <div style={dropdownStyle}>
                            <a 
                                onClick={() => handleMenuItemClick('Admin')}
                                style={{
                                    ...dropdownItemStyle,
                                    ...(activeView === 'Admin' ? activeDropdownItemStyle : {})
                                }}
                            >
                                Admin
                            </a>
                            <a 
                                onClick={() => handleMenuItemClick('Members')}
                                style={{
                                    ...dropdownItemStyle,
                                    ...(activeView === 'Members' ? activeDropdownItemStyle : {})
                                }}
                            >
                                Members
                            </a>
                        </div>
                    )}
                </div>
            </nav>

            {/* Conditional Views */}
            {activeView === 'Settings' && (
                <div className="system-settings" style={{ padding: '5px' }}>
                    <h2 style={{ color: 'black', textAlign: 'center', marginTop: '20px', fontSize: '16px' }}>System Settings</h2>
                    {error && <div className="error" style={{ color: 'red', textAlign: 'center' }}>{error}</div>}

                    <div 
                        style={{
                            ...getTableContainerStyle(),
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none'
                        }}
                        className={isEditing ? 'scrollable-table' : ''}
                    >
                        <style jsx>{`
                            .scrollable-table::-webkit-scrollbar {
                                display: none;
                            }
                        `}</style>
                        
                        <table style={getTableStyle()}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid black', fontSize: '16px',}}>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>Setting</th>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.keys(settings).map((key) => (
                                    <tr key={key}>
                                        <td style={{ padding: '5px'}}>{key.replace(/_/g, ' ').toUpperCase()}:</td>
                                        <td style={{ padding: '5px'}}>
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    name={key}
                                                    value={settings[key]}
                                                    onChange={handleChange}
                                                    style={inputStyle}
                                                />
                                            ) : (
                                                <span>{settings[key]}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ marginTop: '20px', textAlign: 'center', }}>
                        {isEditing ? (
                            <>
                                <button onClick={handleUpdate} style={buttonStyle('#4CAF50')}>Save Changes</button>
                                <button onClick={() => setIsEditing(false)} style={buttonStyle('#f44336')}>Cancel</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => setIsEditing(true)} style={buttonStyle('#0adc46ff')}>Edit Settings</button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {activeView === 'Archive' && (
                <div className="archive-section" style={{ marginTop: '20px' }}>
                    <Archive />
                </div>
            )}

            {activeView === 'Admin' && (
                <div className="admin-section" style={{ marginTop: '20px' }}>
                    <AdminProfile />
                </div>
            )}

            {activeView === 'Members' && (
                <div className="members-section" style={{ marginTop: '20px' }}>
                    <Usermgmt />
                </div>
            )}
        </div>
    );
};

export default SystemSettings;

// Style helpers
const navStyle = {
    color: 'black',
    fontSize: '16px',
    textDecoration: 'none',
    cursor: 'pointer',
    padding: '10px',
    transition: 'all 0.3s ease',
};

const activeNavStyle = {
    boxShadow: 'rgba(0, 0, 0, 0.15) 0 0 0.625rem',
    backgroundColor: '#ede9c7',
    borderRadius: '25px',
    color: 'black',
};

const dropdownStyle = {
    position: 'absolute',
    top: '100%',
    left: '0',
    backgroundColor: 'white',
    boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
    borderRadius: '8px',
    marginTop: '5px',
    minWidth: '150px',
    zIndex: 1000,
    overflow: 'hidden',
};

const dropdownItemStyle = {
    display: 'block',
    padding: '12px 20px',
    color: '#333',
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    borderBottom: '1px solid #eee',
};

const activeDropdownItemStyle = {
    backgroundColor: '#ede9c7',
    fontWeight: 'bold',
};

const inputStyle = {
    width: '70px',
    padding: '1px',
    borderRadius: '5px',
    border: '1px solid black',
    height: '20px',
};

const buttonStyle = (bgColor) => ({
    padding: '10px 20px',
    margin: '0 10px',
    backgroundColor: bgColor,
    color: 'black',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
});