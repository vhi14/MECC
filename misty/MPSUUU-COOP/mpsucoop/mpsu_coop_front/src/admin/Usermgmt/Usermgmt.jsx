import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Usermgmt.css'; 

const AdminMemberManagement = () => {
    const [members, setMembers] = useState([]);
    const [editMode, setEditMode] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
    });

    // Fetch registered members only
useEffect(() => {
    axios.get(`${process.env.REACT_APP_API_URL}/members/?registered_only=true`, {
        headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`
        }
    })
    .then(response => {
        setMembers(response.data);
    })
    .catch(error => {
        alert('Failed to fetch members');
    });
}, []);

    // Handle the toggle for editing a member
    const handleEditToggle = (member) => {
        setFormData({
            username: member.user?.username || '',
            email: member.email,
            password: '',  
        });
        setEditMode(member.memId);
    };

    // Handle form input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    const handle_update_password = (account_number, email, new_password, username) => {
        return axios.put(`${process.env.REACT_APP_API_URL}/update-user-password/`, {
            account_number: account_number,
            email: email,
            new_password: new_password,
            username: username
        }, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('accessToken')}`
            }
        })
        .then(response => {
            setSuccessMessage("Password updated successfully!");
            return response;
        })
        .catch(error => {
            alert('Error updating password: ' + (error.response?.data?.error || error.message));
            throw error;
        });
    };
    
    // Handle form submission for editing member
const handleSubmit = (e, update_member) => {
    e.preventDefault();
    const memberId = update_member.memId;
    
    // Validate password if provided
    if (formData.password && formData.password.trim() !== '') {
        const password = formData.password.trim();
        
        if (password.length < 8) {
            alert('Password must be at least 8 characters long.');
            return;
        }
        
        if (password.length > 128) {
            alert('Password is too long. Maximum 128 characters allowed.');
            return;
        }
    }
    
    // Validate username
    if (!formData.username || formData.username.trim() === '') {
        alert('Username is required.');
        return;
    }
    
    if (formData.username.length < 3) {
        alert('Username must be at least 3 characters long.');
        return;
    }
    
    const hasPasswordChange = formData.password && formData.password.trim() !== '';
    const hasUsernameChange = formData.username !== update_member.user?.username;
    
    let updatePromise = Promise.resolve();
    
    if (hasPasswordChange || hasUsernameChange) {
        updatePromise = handle_update_password(
            update_member.accountN,
            formData.email,
            formData.password || '',
            formData.username
        );
    }
    
    updatePromise
        .then(() => {
            const updatedMember = { ...update_member, email: formData.email };
            
            return axios.put(
                `${process.env.REACT_APP_API_URL}/members/${memberId}/`, 
                updatedMember, 
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('accessToken')}`
                    }
                }
            );
        })
        .then(response => {
            setMembers(members.map(member => 
                member.memId === memberId ? response.data : member
            ));
            
            setEditMode(null);
            setSuccessMessage('Member updated successfully!');
            
            setTimeout(() => {
                window.location.reload();
            }, 50000);
        })
        .catch(error => {
            alert('Failed to update: ' + (error.response?.data?.error || error.message));
        });
};

    // Close modal when clicking overlay
    const handleOverlayClick = (e) => {
        if (e.target.className === 'modal-overlay') {
            setEditMode(null);
        }
    };

    return (
        <div className="member-management-container">
            <h2 style={{marginTop: '-10px', padding: '20px', textAlign: 'center', color: 'black', fontSize: '24px'}}>
                Registered Members Management
            </h2>
            
            <div className="table-container">
                <div className="table-wrapper">
                    <table className="member-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Account Number</th>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{textAlign: 'center', padding: '20px'}}>
                                        No registered members found
                                    </td>
                                </tr>
                            ) : (
                                members.map(member => {
                                    const fullName = `${member.first_name} ${member.middle_name ? member.middle_name + ' ' : ''}${member.last_name}`;
                                    
                                    return (
                                        <tr key={member.memId}>
                                            <td>{fullName}</td>
                                            <td>{member.accountN || 'N/A'}</td>
                                            <td>{member.user?.username || 'N/A'}</td>
                                            <td>{member.email || 'N/A'}</td>
                                            <td>
                                                {member.user ? (
                                                    <>
                                                        <button onClick={() => handleEditToggle(member)}>Edit</button>
                                                    </>
                                                ) : (
                                                    <span style={{color: '#999'}}>No account</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Overlay with Blur Effect */}
            {editMode !== null && (
                <>
                    <div className="modal-overlay" onClick={handleOverlayClick}></div>
                    <div className="edit-member-form">
                        <h3>Edit Member Credentials</h3>
                        <form onSubmit={(e) => handleSubmit(e, members.find(member => member.memId === editMode))}>
                            <div>
                                <label>Username:</label>
                                <input
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div>
                                <label>Email:</label>
                                <input
                                    type="email"
                                    name="email"    
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    required
                                    readOnly
                                />
                            </div>
                            <div>
                                <label>New Password:</label>
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    placeholder="Leave blank to keep current password"
                                />
                            </div>
                            <button type="submit">Save Changes</button>
                            <button type="button" onClick={() => setEditMode(null)}>Cancel</button>
                        </form>
                    </div>
                </>
            )}
            {/* Success Message Modal */}
            {successMessage && (
                <>
                    <div className="modal-overlay" onClick={() => setSuccessMessage(null)}></div>
                    <div className="success-message-modal">
                        <div className="success-content">
                            <h3>Success!</h3>
                            <p>{successMessage}</p>
                            <button onClick={() => setSuccessMessage(null)}>OK</button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AdminMemberManagement;