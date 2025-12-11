import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminProfile.css'; // Create this CSS file for styling

const AdminProfile = () => {
    const [adminData, setAdminData] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        current_password: '',
        new_password: '',
        confirm_password: '',
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchAdminData();
    }, []);

    const fetchAdminData = () => {
        axios.get(`${process.env.REACT_APP_API_URL}/api/admin-profile/`, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('accessToken')}`
            }
        })
        .then(response => {
            setAdminData(response.data);
            setFormData({
                username: response.data.username,
                email: response.data.email || '',
                current_password: '',
                new_password: '',
                confirm_password: '',
            });
        })
        .catch(error => {
            console.error('Error fetching admin data:', error);
            setError('Failed to load admin profile');
        });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
        setError('');
    };

    const validateForm = () => {
        if (formData.new_password) {
            if (formData.new_password.length < 8) {
                setError('New password must be at least 8 characters');
                return false;
            }
            if (formData.new_password !== formData.confirm_password) {
                setError('Passwords do not match');
                return false;
            }
            if (!formData.current_password) {
                setError('Current password is required to change password');
                return false;
            }
        }
        return true;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!validateForm()) {
            return;
        }

        const updateData = {
            username: formData.username,
            email: formData.email || '',
        };

        if (formData.new_password) {
            updateData.current_password = formData.current_password;
            updateData.new_password = formData.new_password;
        }

        axios.put(`${process.env.REACT_APP_API_URL}/api/admin-profile/`, updateData, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('accessToken')}`
            }
        })
        .then(response => {
            setSuccess('Profile updated successfully!');
            setIsEditing(false);
            setFormData({
                ...formData,
                current_password: '',
                new_password: '',
                confirm_password: '',
            });
            fetchAdminData();
        })
        .catch(error => {
            console.error('Error updating profile:', error);
            setError(error.response?.data?.error || 'Failed to update profile');
        });
    };

    if (!adminData) {
        return <div>Loading...</div>;
    }

    return (
        <div className="admin-profile-container">
            <h2>Admin Profile Management</h2>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="profile-content">
                {!isEditing ? (
                    <div className="profile-view">
                        <table className="profile-table">
                            <tbody>
                                <tr>
                                    <th>Username:</th>
                                    <td>{adminData.username}</td>
                                </tr>
                                <tr>
                                    <th>Email:</th>
                                    <td>{adminData.email}</td>
                                </tr>
                                <tr>
                                    <th>Role:</th>
                                    <td>{adminData.is_superuser ? 'Super Admin' : 'Admin'}</td>
                                </tr>
                            </tbody>
                        </table>
                        <button onClick={() => setIsEditing(true)} className="edit-btn">
                            Edit Profile
                        </button>
                    </div>
                ) : (
                    <div className="profile-edit">
                        <form onSubmit={handleSubmit}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Username:</label>
                                    <input
                                        type="text"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Email (Optional):</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        placeholder="Optional"
                                    />
                                </div>
                            </div>

                            <hr />
                            <h3>Change Password (Optional)</h3>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Current Password:</label>
                                    <input
                                        type="password"
                                        name="current_password"
                                        value={formData.current_password}
                                        onChange={handleInputChange}
                                        placeholder="Required to change password"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>New Password:</label>
                                    <input
                                        type="password"
                                        name="new_password"
                                        value={formData.new_password}
                                        onChange={handleInputChange}
                                        placeholder="Leave blank to keep current"
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group form-group-full">
                                    <label>Confirm New Password:</label>
                                    <input
                                        type="password"
                                        name="confirm_password"
                                        value={formData.confirm_password}
                                        onChange={handleInputChange}
                                        placeholder="Confirm new password"
                                    />
                                </div>
                            </div>

                            <div className="form-actions">
                                <button type="submit" className="save-btn">Save Changes</button>
                                <button type="button" onClick={() => {
                                    setIsEditing(false);
                                    setError('');
                                    setFormData({
                                        ...formData,
                                        current_password: '',
                                        new_password: '',
                                        confirm_password: '',
                                    });
                                }} className="cancel-btn">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminProfile;