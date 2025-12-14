import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../Topbar/Topbar';
import axios from 'axios';
import './Info.css';

const Home = () => {
  const [memberData, setMemberData] = useState(null);
  const [updatedMemberData, setUpdatedMemberData] = useState({});
  const [loanData, setLoanData] = useState([]);
  const [error, setError] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const navigate = useNavigate();

  const editableFields = ['first_name', 'middle_name', 'last_name', 'email', 'address', 'phone_number', 'religion', 'height', 'weight', 'zip_code'];

  const formatNumber = (number) => {
    if (!number) return "0.00";
    const parts = number.toString().split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.length > 1 ? `${parts[0]}.${parts[1]}` : `${parts[0]}.00`;
  };

  useEffect(() => {
    const fetchMemberDetails = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          setError('No authentication token found. Please log in again.');
          return;
        }

        const acc_number = localStorage.getItem('account_number');

        const memberResponse = await axios.get(`${process.env.REACT_APP_API_URL}/api/member/profile/`, {
          params: { account_number: acc_number },
          headers: { Authorization: `Bearer ${token}` },
        });

        setMemberData(memberResponse.data);
        setUpdatedMemberData(memberResponse.data);

        const accountNumber = memberResponse.data.accountN;
        const loanResponse = await axios.get(`${process.env.REACT_APP_API_URL}/loans/?account_number=${accountNumber}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setLoanData(loanResponse.data);

      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to fetch data.');
      }
    };

    fetchMemberDetails();
  }, []);

  const memberLoan = loanData.find(
    loan => loan.account_number === memberData?.accountN || loan.account === memberData?.accountN
  );

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedProfile(file);
      setProfilePreview(URL.createObjectURL(file));

      try {
        const token = localStorage.getItem('accessToken');
        const formData = new FormData();
        formData.append('profile_picture', file);

        const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/member/upload-profile-picture/`, formData, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        });

        setMemberData((prevData) => ({
          ...prevData,
          profile_picture: response.data.profile_picture,
        }));
        alert('Profile picture updated successfully!');
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to upload profile picture.');
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (editableFields.includes(name)) {
      setUpdatedMemberData((prevData) => ({
        ...prevData,
        [name]: value,
      }));
    }
  };

  const handleSaveChanges = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setError('No authentication token found. Please log in again.');
        return;
      }

      const nameChanged = 
        updatedMemberData.first_name !== memberData.first_name ||
        updatedMemberData.middle_name !== memberData.middle_name ||
        updatedMemberData.last_name !== memberData.last_name;

      await axios.put(
        `${process.env.REACT_APP_API_URL}/api/member/profile/`,
        updatedMemberData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (nameChanged) {
        const firstName = updatedMemberData.first_name?.trim() || '';
        const middleName = updatedMemberData.middle_name?.trim() || '';
        const lastName = updatedMemberData.last_name?.trim() || '';
        
        const newUsername = `${firstName} ${middleName} ${lastName}`.trim();
        
        if (newUsername.length < 3) {
          alert('Profile updated but username is too short. Please contact admin.');
          setMemberData(updatedMemberData);
          setIsEditMode(false);
          return;
        }
        
        try {
          const updatePayload = {
            account_number: memberData.accountN,
            email: updatedMemberData.email,
            username: newUsername,
            new_password: ''
          };
          
          const usernameUpdateResponse = await axios.put(
            `${process.env.REACT_APP_API_URL}/update-user-password/`,
            updatePayload,
            { 
              headers: { 
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              } 
            }
          );
          
          alert('Profile and username updated successfully!');
        } catch (usernameError) {
          const errorMsg = usernameError.response?.data?.error || 
                          usernameError.response?.data?.detail || 
                          usernameError.response?.data?.new_password?.[0] ||
                          'Username update failed';
          alert(`Profile updated but username update failed: ${errorMsg}\nPlease contact admin.`);
        }
      } else {
        alert('Changes saved successfully!');
      }

      setMemberData(updatedMemberData);
      setIsEditMode(false);
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save changes.');
    }
  };

  const handleResetPassword = () => {
    navigate('/reset-password');
  };

  if (error) {
    return (
      <div className="error-container">
        <div className="error-card">
          <div className="error-icon">⚠</div>
          <h2 className="error-title">Oops! Something went wrong</h2>
          <p className="error-message">{error}</p>
          <a href="/" className="error-link">Return to Login</a>
        </div>
      </div>
    );
  }

  if (!memberData) {
    return (
      <div className="loading-container">
        <div className="loading-card">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <Topbar />
      
      <div className="home-content">
        <div className="home-wrapper">
          
          <div className="home-grid">
            
            {/* Left Panel - Profile Card */}
            <div className="profile-panel">
              <div className="profile-card">
                <h2 className="member-name">
                  {memberData.first_name} {memberData.middle_name} {memberData.last_name}
                </h2>

                <div className="account-badge">
                  Account: {memberData.accountN || 'N/A'}
                </div>
              </div>
            </div>

            {/* Right Panel - Information Form */}
            <div className="info-panel">
              <div className="info-card">
                
                {/* Header */}
                <div className="info-header">
                  <h3 className="info-title">
                    {isEditMode ? 'Edit Information' : 'My Information'}
                  </h3>
                </div>

                {/* Basic Information Section */}
                <div className="form-section">
                  <div className="form-grid">
                    {['first_name', 'middle_name', 'last_name', 'email'].map((key) => (
                      <div key={key} className="form-field">
                        <label className="form-label">
                          {key.replace('_', ' ')}:
                        </label>
                        <input
                          type="text"
                          name={key}
                          value={updatedMemberData[key] || ''}
                          readOnly={!isEditMode || !editableFields.includes(key)}
                          onChange={handleInputChange}
                          className={`form-input ${isEditMode && editableFields.includes(key) ? 'editable' : 'readonly'}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Personal Details Section */}
                <div className="form-section">
                  <div className="form-grid">
                    {['birth_date', 'birth_place', 'age', 'zip_code'].map((key) => (
                      <div key={key} className="form-field">
                        <label className="form-label">
                          {key.replace('_', ' ')}:
                        </label>
                        <input
                          type="text"
                          name={key}
                          value={updatedMemberData[key] || ''}
                          readOnly={!isEditMode || !editableFields.includes(key)}
                          onChange={handleInputChange}
                          className={`form-input ${isEditMode && editableFields.includes(key) ? 'editable' : 'readonly'}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Personal Status Section */}
                <div className="form-section">
                  <div className="form-grid">
                    {['gender', 'pstatus', 'religion', 'phone_number'].map((key) => (
                      <div key={key} className="form-field">
                        <label className="form-label">
                          {key === 'pstatus' ? 'Civil Status' : key === 'phone_number' ? 'Phone Number' : key.replace('_', ' ')}:
                        </label>
                        <input
                          type="text"
                          name={key}
                          value={updatedMemberData[key] || ''}
                          readOnly={!isEditMode || !editableFields.includes(key)}
                          onChange={handleInputChange}
                          className={`form-input ${isEditMode && editableFields.includes(key) ? 'editable' : 'readonly'}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* TIN and ID Information Section */}
                <div className="form-section">
                  <div className="form-grid">
                    {['address', 'tin', 'valid_id', 'id_no'].map((key) => (
                      <div key={key} className="form-field">
                        <label className="form-label">
                          {key === 'address' ? 'Address' : key === 'tin' ? 'TIN Number' : key === 'valid_id' ? 'Valid ID Type' : 'ID Number'}:
                        </label>
                        <input
                          type="text"
                          name={key}
                          value={updatedMemberData[key] || ''}
                          readOnly={!isEditMode || !editableFields.includes(key)}
                          onChange={handleInputChange}
                          className={`form-input ${isEditMode && editableFields.includes(key) ? 'editable' : 'readonly'}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Beneficiaries Section */}
                <div className="beneficiaries-section">
                  {/* Beneficiary 1 */}
                  <div className="beneficiary-grid">
                    {['beneficiary', 'relationship', 'birth_date1'].map((key) => (
                      <div key={key} className="form-field">
                        <label className="form-label">
                          {key === 'beneficiary' ? 'Beneficiary Name 1' : key === 'relationship' ? 'Relationship' : 'Birth Date'}:
                        </label>
                        <input
                          type="text"
                          name={key}
                          value={updatedMemberData[key] || ''}
                          readOnly={true}
                          className="form-input readonly"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Beneficiary 2 */}
                  <div className="beneficiary-grid">
                    {['beneficiary2', 'relationship2', 'birth_date2'].map((key) => (
                      <div key={key} className="form-field">
                        <label className="form-label">
                          {key === 'beneficiary2' ? 'Beneficiary Name 2' : key === 'relationship2' ? 'Relationship' : 'Birth Date'}:
                        </label>
                        <input
                          type="text"
                          name={key}
                          value={updatedMemberData[key] || ''}
                          readOnly={true}
                          className="form-input readonly"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Beneficiary 3 */}
                  <div className="beneficiary-grid">
                    {['beneficiary3', 'relationship3', 'birth_date3'].map((key) => (
                      <div key={key} className="form-field">
                        <label className="form-label">
                          {key === 'beneficiary3' ? 'Beneficiary Name 3' : key === 'relationship3' ? 'Relationship' : 'Birth Date'}:
                        </label>
                        <input
                          type="text"
                          name={key}
                          value={updatedMemberData[key] || ''}
                          readOnly={true}
                          className="form-input readonly"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="action-buttons">
                  {isEditMode ? (
                    <div className="button-group">
                      <button onClick={handleSaveChanges} className="btn btn-save">
                        Save Changes
                      </button>
                      <button
                        onClick={() => {
                          setUpdatedMemberData(memberData);
                          setIsEditMode(false);
                        }}
                        className="btn btn-cancel"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setIsEditMode(true)} className="btn btn-edit">
                      Edit Information
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;