import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../Topbar/Topbar';
import axios from 'axios';

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

        // Fetch member data
        const memberResponse = await axios.get('http://localhost:8000/api/member/profile/', {
          params: { account_number: acc_number },
          headers: { Authorization: `Bearer ${token}` },
        });

        setMemberData(memberResponse.data);
        setUpdatedMemberData(memberResponse.data);

        // Fetch loan data using account number
        const accountNumber = memberResponse.data.accountN;
        const loanResponse = await axios.get(`http://localhost:8000/loans/?account_number=${accountNumber}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setLoanData(loanResponse.data);

      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to fetch data.');
      }
    };

    fetchMemberDetails();
  }, []);

  // Get the first loan for this member (or you can modify logic as needed)
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

        const response = await axios.post('http://localhost:8000/api/member/upload-profile-picture/', formData, {
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

      // Check if name fields changed
      const nameChanged = 
        updatedMemberData.first_name !== memberData.first_name ||
        updatedMemberData.middle_name !== memberData.middle_name ||
        updatedMemberData.last_name !== memberData.last_name;

      // Update member profile
      await axios.put(
        'http://localhost:8000/api/member/profile/',
        updatedMemberData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // If name changed, automatically update username
      if (nameChanged) {
        // Create username from name (remove spaces and special characters)
        const firstName = updatedMemberData.first_name?.trim() || '';
        const middleName = updatedMemberData.middle_name?.trim() || '';
        const lastName = updatedMemberData.last_name?.trim() || '';
        
        // Format: FirstName MiddleName LastName (with spaces, like in RegisterMemberView)
        const newUsername = `${firstName} ${middleName} ${lastName}`.trim();
        
        // Validate username length
        if (newUsername.length < 3) {
          alert('Profile updated but username is too short. Please contact admin.');
          setMemberData(updatedMemberData);
          setIsEditMode(false);
          return;
        }
        
        try {
          // Backend expects new_password field, send empty string to keep current password
          const updatePayload = {
            account_number: memberData.accountN,
            email: updatedMemberData.email,
            username: newUsername,
            new_password: ''  // Empty string = keep current password
          };
          
          const usernameUpdateResponse = await axios.put(
            'http://localhost:8000/update-user-password/',
            updatePayload,
            { 
              headers: { 
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              } 
            }
          );
          
          console.log('Username update response:', usernameUpdateResponse);
          alert('Profile and username updated successfully!');
        } catch (usernameError) {
          console.error('Username update failed:', usernameError);
          console.error('Error details:', usernameError.response?.data);
          
          // Show more specific error message
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
      
      // Refresh page to show updated data
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '500px' }}>
          <div style={{ width: '80px', height: '80px', background: 'linear-gradient(45deg, #ff6b6b, #ee5a24)', borderRadius: '50%', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', color: 'white' }}>⚠</div>
          <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>Oops! Something went wrong</h2>
          <p style={{ color: '#7f8c8d', marginBottom: '30px', fontSize: '16px' }}>{error}</p>
          <a 
            href="/" 
            style={{ display: 'inline-block', background: 'linear-gradient(45deg, #667eea, #764ba2)', color: 'white', padding: '12px 30px', textDecoration: 'none', borderRadius: '25px', fontWeight: '600', transition: 'transform 0.3s ease', boxShadow: '0 5px 15px rgba(102, 126, 234, 0.3)' }}
            onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            Return to Login
          </a>
        </div>
      </div>
    );
  }

  if (!memberData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
        <div style={{ padding: '40px', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ width: '50px', height: '50px', border: '4px solid #667eea', borderTop: '4px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}></div>
          <p style={{ color: '#0b78e6ff', fontSize: '14px' }}>Loading information...</p>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      <Topbar />
      
      <div style={{ padding: '40px 20px', marginTop: '150px' }}>
        <div style={{ width: '1300px', margin: '0 auto' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '50px' }}>
            
            {/* Left Panel - Profile Picture & Account Info */}
            <div style={{ padding: '4px' }}>
              
              {/* Profile Picture Card */}
              <div style={{
                boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)',
                padding: '20px',
                borderRadius: '15px',
                marginBottom: '20px',
                color: 'black',
                textAlign: 'center',
                marginTop: '180px',
                height: '150px',
                width: '500px'
              }}>

                {/* Member Name */}
                <h2 style={{
                  fontSize: '28px',
                  fontWeight: '700',
                  margin: '0 0 40px 0',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}>
                  {memberData.first_name} {memberData.middle_name} {memberData.last_name}
                </h2>

                {/* Account Number */}
                <div style={{
                  background: 'rgba(51, 49, 49, 0.2)',
                  padding: '12px 20px',
                  borderRadius: '25px',
                  display: 'inline-block',
                  fontSize: '18px',
                  fontWeight: '600',
                  color: 'BLACK',
                  marginBottom: '20px',
                  backdropFilter: 'blur(10px)'
                }}>
                  Account: {memberData.accountN || 'N/A'}
                </div>
              </div>
            </div>

            {/* Right Panel - Member Information Form */}
            <div style={{ padding: '1px' }}>
              
              {/* Information Card */}
              <div style={{
                background: 'white',
                boxShadow: '0px 8px 5px rgba(161, 161, 161, 0.99)',
                borderRadius: '15px',
                padding: '30px',
                marginBottom: '20px',
                maxHeight: '550px',
                marginTop: '-10px',
                overflowY: 'hidden',
                width: '700px',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                '&::-webkit-scrollbar': {
                  display: 'none',
                }
              }}>
                <style>
                  {`
                    .scrollable-container::-webkit-scrollbar {
                      display: none;
                    }
                    .scrollable-container {
                      -ms-overflow-style: none;
                      scrollbar-width: none;
                    }
                  `}
                </style>
                
                {/* Header */}
                <div style={{
                  borderBottom: '3px solid #000000ff',
                  paddingBottom: '1px',
                  marginBottom: '10px',
                  textAlign: 'center'
                }}>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    margin: 0,
                    marginTop: '-20px',
                    background: 'black',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>
                    {isEditMode ? 'Edit Information' : 'My Information'}
                  </h3>
                </div>

                {/* Basic Information Section */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '10px',
                  marginBottom: '1px',
                }}>
                  {['first_name', 'middle_name', 'last_name', 'email'].map((key) => (
                    <div key={key} style={{
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <label style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#000000ff',
                        marginBottom: '1px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {key.replace('_', ' ')}:
                      </label>
                      <input
                        type="text"
                        name={key}
                        value={updatedMemberData[key] || ''}
                        readOnly={!isEditMode || !editableFields.includes(key)}
                        onChange={handleInputChange}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '8px',
                          border: isEditMode && editableFields.includes(key) ? '2px solid #010101ff' : '1px solid #000000ff',
                          backgroundColor: isEditMode && editableFields.includes(key) ? '#fff' : '#e5e5e5ff',
                          fontSize: '12px',
                          fontWeight: '550',
                          color: '#040404ff',
                          transition: 'all 0.3s ease',
                          outline: 'none',
                          boxShadow: isEditMode && editableFields.includes(key) ? '0 0 0 2px rgba(0, 47, 255, 1)' : 'none'
                        }}
                        onFocus={(e) => {
                          if (isEditMode && editableFields.includes(key)) {
                            e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.2)';
                          }
                        }}
                        onBlur={(e) => {
                          e.target.style.boxShadow = isEditMode && editableFields.includes(key) ? '0 0 0 3px rgba(102, 126, 234, 0.1)' : 'none';
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Personal Details Section */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '10px',
                  marginBottom: '1px'
                }}>
                  {['birth_date', 'birth_place', 'age', 'zip_code'].map((key) => (
                    <div key={key} style={{
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <label style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#000000ff',
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {key.replace('_', ' ')}:
                      </label>
                      <input
                        type="text"
                        name={key}
                        value={updatedMemberData[key] || ''}
                        readOnly={!isEditMode || !editableFields.includes(key)}
                        onChange={handleInputChange}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '8px',
                          border: isEditMode && editableFields.includes(key) ? '2px solid #010101ff' : '1px solid #000000ff',
                          backgroundColor: isEditMode && editableFields.includes(key) ? '#fff' : '#e5e5e5ff',
                          fontSize: '12px',
                          fontWeight: '550',
                          color: '#040404ff',
                          transition: 'all 0.3s ease',
                          outline: 'none',
                          boxShadow: isEditMode && editableFields.includes(key) ? '0 0 0 2px rgba(0, 47, 255, 1)' : 'none'
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Personal Status Section */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '10px',
                  marginBottom: '1px'
                }}>
                  {['gender', 'pstatus', 'religion', 'phone_number'].map((key) => (
                    <div key={key} style={{
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <label style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#000000ff',
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {key === 'pstatus' ? 'Civil Status' : key === 'phone_number' ? 'Phone Number' : key.replace('_', ' ')}:
                      </label>
                      <input
                        type="text"
                        name={key}
                        value={updatedMemberData[key] || ''}
                        readOnly={!isEditMode || !editableFields.includes(key)}
                        onChange={handleInputChange}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '8px',
                          border: isEditMode && editableFields.includes(key) ? '2px solid #010101ff' : '1px solid #000000ff',
                          backgroundColor: isEditMode && editableFields.includes(key) ? '#fff' : '#e5e5e5ff',
                          fontSize: '12px',
                          fontWeight: '550',
                          color: '#040404ff',
                          transition: 'all 0.3s ease',
                          outline: 'none',
                          boxShadow: isEditMode && editableFields.includes(key) ? '0 0 0 2px rgba(0, 47, 255, 1)' : 'none'
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* TIN and ID Information Section */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '10px',
                  marginBottom: '20px'
                }}>
                  {['address', 'tin', 'valid_id', 'id_no'].map((key) => (
                    <div key={key} style={{
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <label style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#000000ff',
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {key === 'address' ? 'Address' : key === 'tin' ? 'TIN Number' : key === 'valid_id' ? 'Valid ID Type' : 'ID Number'}:
                      </label>
                      <input
                        type="text"
                        name={key}
                        value={updatedMemberData[key] || ''}
                        readOnly={!isEditMode || !editableFields.includes(key)}
                        onChange={handleInputChange}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '8px',
                          border: isEditMode && editableFields.includes(key) ? '2px solid #010101ff' : '1px solid #000000ff',
                          backgroundColor: isEditMode && editableFields.includes(key) ? '#fff' : '#e5e5e5ff',
                          fontSize: '12px',
                          fontWeight: '550',
                          color: '#040404ff',
                          transition: 'all 0.3s ease',
                          outline: 'none',
                          boxShadow: isEditMode && editableFields.includes(key) ? '0 0 0 2px rgba(0, 47, 255, 1)' : 'none'
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Beneficiaries Section */}
                <div style={{ marginBottom: '30px' }}>
                  {/* Beneficiary 1 */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '15px',
                    marginBottom: '1px'
                  }}>
                    {['beneficiary', 'relationship', 'birth_date1'].map((key) => (
                      <div key={key} style={{
                        display: 'flex',
                        flexDirection: 'column'
                      }}>
                        <label style={{
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#000000ff',
                          marginBottom: '5px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {key === 'beneficiary' ? 'Beneficiary Name 1' : key === 'relationship' ? 'Relationship' : 'Birth Date'}:
                        </label>
                        <input
                          type="text"
                          name={key}
                          value={updatedMemberData[key] || ''}
                          readOnly={true}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid #000000ff',
                            backgroundColor: '#e5e5e5ff',
                            fontSize: '12px',
                            fontWeight: '550',
                            color: '#040404ff'
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Beneficiary 2 */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '15px',
                    marginBottom: '1px'
                  }}>
                    {['beneficiary2', 'relationship2', 'birth_date2'].map((key) => (
                      <div key={key} style={{
                        display: 'flex',
                        flexDirection: 'column'
                      }}>
                        <label style={{
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#000000ff',
                          marginBottom: '5px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {key === 'beneficiary2' ? 'Beneficiary Name2' : key === 'relationship2' ? 'Relationship2' : 'Birth Date2'}:
                        </label>
                        <input
                          type="text"
                          name={key}
                          value={updatedMemberData[key] || ''}
                          readOnly={true}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid #000000ff',
                            backgroundColor: '#e5e5e5ff',
                            fontSize: '12px',
                            fontWeight: '550',
                            color: '#040404ff'
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Beneficiary 3 */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '15px',
                    marginBottom: '1px'
                  }}>
                    {['beneficiary3', 'relationship3', 'birth_date3'].map((key) => (
                      <div key={key} style={{
                        display: 'flex',
                        flexDirection: 'column'
                      }}>
                        <label style={{
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#000000ff',
                          marginBottom: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {key === 'beneficiary3' ? 'Beneficiary Name 3' : key === 'relationship3' ? 'Relationship' : 'Birth Date'}:
                        </label>
                        <input
                          type="text"
                          name={key}
                          value={updatedMemberData[key] || ''}
                          readOnly={true}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid #000000ff',
                            backgroundColor: '#e5e5e5ff',
                            fontSize: '12px',
                            fontWeight: '550',
                            color: '#040404ff'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ textAlign: 'center', marginTop: '25px' }}>
                  {isEditMode ? (
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                      <button
                        onClick={handleSaveChanges}
                        style={{
                          background: '#28a745',
                          color: 'white',
                          border: 'none',
                          padding: '12px 25px',
                          borderRadius: '25px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          boxShadow: '0 5px 15px rgba(40, 167, 69, 0.3)'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 8px 20px rgba(40, 167, 69, 0.4)';
                        }}
                        onMouseOut={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 5px 15px rgba(40, 167, 69, 0.3)';
                        }}
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => {
                          setUpdatedMemberData(memberData);
                          setIsEditMode(false);
                        }}
                        style={{
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          padding: '12px 25px',
                          borderRadius: '25px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          boxShadow: '0 5px 15px rgba(220, 53, 69, 0.3)'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 8px 20px rgba(220, 53, 69, 0.4)';
                        }}
                        onMouseOut={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 5px 15px rgba(220, 53, 69, 0.3)';
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsEditMode(true)}
                      style={{
                        background: '#478dffff',
                        color: 'white',
                        border: 'none',
                        padding: '12px 30px',
                        borderRadius: '25px',
                        fontSize: '16px', 
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 5px 15px rgba(102, 126, 234, 0.3)'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.4)';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.transform = 'translate(0)';
                        e.target.style.boxShadow = '0 5px 15px rgba(102, 126, 234, 0.3)';
                      }}
                    >
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