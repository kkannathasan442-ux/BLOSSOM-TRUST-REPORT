import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Landmark, ShieldAlert, LogOut, Upload, Edit, Send, Lock, HelpCircle, DollarSign } from 'lucide-react';

const StudentProfile = ({ setView }) => {
  const { token, logout, showToast, API_URL } = useAuth();
  
  // Student Profile Data
  const [profileData, setProfileData] = useState({
    ut_no: '',
    full_name: '',
    phone_number: '',
    nic_number: '',
    district: '',
    bank_name: '',
    branch: '',
    branch_name: '',
    branch_code: '',
    account_no: '',
    beneficiary_name: '',
    blossom_trust_amount: 0,
    photo_url: '',
    profile_status: 'draft',
    admin_col1_val: '',
    admin_col2_val: '',
    admin_col3_val: 0,
    attendance_percentage: null,
    last_attendance_month: '',
    low_attendance_status: false,
    dropout_status: false,
    student_type: 'blossom',
    course_name: '',
    course_specialization: '',
    employment_status: '',
    other_status: '',
    batch: '',
    batch_year: '',
    email: ''
  });

  // Admin dynamic titles
  const [adminTitles, setAdminTitles] = useState({
    admin_col1_title: 'Current Status',
    admin_col2_title: 'Working Company Name',
    admin_col3_title: 'Salary (LKR)'
  });

  const [activeRequest, setActiveRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Request edit modal states
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);

  const districts = [
    'Jaffna', 'Kilinochchi', 'Mullaitivu', 'Mannar', 'Vavuniya', 'Colombo', 'Gampaha',
    'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya', 'Galle', 'Matara', 'Hambantota',
    'Batticaloa', 'Ampara', 'Trincomalee', 'Kurunegala', 'Puttalam', 'Anuradhapura',
    'Polonnaruwa', 'Badulla', 'Monaragala', 'Ratnapura', 'Kegalle'
  ];

  const banks = [
    'Bank of Ceylon', "People's Bank", 'Commercial Bank', 'Hatton National Bank',
    'Sampath Bank', 'Amana Bank', 'National Savings Bank', 'DFCC Bank',
    'Seylan Bank', 'Nations Trust Bank', 'Pan Asia Banking Corporation', 'Union Bank'
  ];

  const fetchProfileAndSettings = async () => {
    try {
      setIsLoading(true);
      // Fetch Profile
      const profileRes = await fetch(`${API_URL}/student/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const profileDataResult = await profileRes.json();

      if (profileRes.ok) {
        setProfileData(profileDataResult.student);
        setActiveRequest(profileDataResult.activeRequest);
      } else {
        showToast(profileDataResult.message || 'Failed to load profile.', 'error');
      }

      // Fetch Admin Settings
      const settingsRes = await fetch(`${API_URL}/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const settingsResult = await settingsRes.json();

      if (settingsRes.ok) {
        setAdminTitles({
          admin_col1_title: settingsResult.admin_col1_title || 'Current Status',
          admin_col2_title: settingsResult.admin_col2_title || 'Working Company Name',
          admin_col3_title: settingsResult.admin_col3_title || 'Salary (LKR)'
        });
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to the server.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfileAndSettings();
    }
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Build the payload for save/submit — includes all hybrid fields
  const buildPayload = (isSubmit) => {
    const payload = {
      utNo: profileData.ut_no,
      fullName: profileData.full_name,
      phoneNo: profileData.phone_number,
      nicNumber: profileData.nic_number,
      district: profileData.district,
      studentType: profileData.student_type,
      courseSpecialization: profileData.course_specialization,
      employmentStatus: profileData.employment_status,
      otherStatus: profileData.other_status,
      email: profileData.email,
      isSubmit
    };

    if (profileData.student_type !== 'non_blossom') {
      payload.bankName = profileData.bank_name;
      payload.branch = profileData.branch_name || profileData.branch;
      payload.branchName = profileData.branch_name || profileData.branch;
      payload.branchCode = profileData.branch_code;
      payload.accountNo = profileData.account_no;
      payload.beneficiaryName = profileData.beneficiary_name;
      payload.courseName = profileData.course_name;
      payload.batch = profileData.batch;
      payload.batchYear = profileData.batch_year;
    }

    return payload;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await fetch(`${API_URL}/student/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(buildPayload(false))
      });

      const result = await res.json();
      if (res.ok) {
        showToast(result.message);
        setProfileData(prev => ({ ...prev, profile_status: result.status }));
      } else {
        showToast(result.message || 'Failed to save draft.', 'error');
      }
    } catch (err) {
      showToast('Error saving data.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitProfile = async () => {
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/student/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(buildPayload(true))
      });

      const result = await res.json();
      if (res.ok) {
        showToast(result.message);
        setProfileData(prev => ({ ...prev, profile_status: result.status }));
        fetchProfileAndSettings(); // Refresh active request logs
      } else {
        showToast(result.message || 'Failed to submit profile.', 'error');
      }
    } catch (err) {
      showToast('Error submitting profile.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Photo must be under 2MB!', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('photo', file);

    try {
      showToast('Uploading photo...', 'warning');
      const res = await fetch(`${API_URL}/student/photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await res.json();
      if (res.ok) {
        showToast(result.message);
        setProfileData(prev => ({ ...prev, photo_url: result.photoUrl }));
      } else {
        showToast(result.message || 'Failed to upload photo.', 'error');
      }
    } catch (err) {
      showToast('Error uploading photo.', 'error');
    }
  };

  const handleRequestEdit = async (e) => {
    e.preventDefault();
    if (!requestReason.trim()) return;

    setRequestLoading(true);
    try {
      const res = await fetch(`${API_URL}/student/request-edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: requestReason })
      });

      const result = await res.json();
      if (res.ok) {
        showToast(result.message);
        setProfileData(prev => ({ ...prev, profile_status: result.status }));
        setShowRequestModal(false);
        setRequestReason('');
        fetchProfileAndSettings(); // Refresh
      } else {
        showToast(result.message || 'Failed to submit request.', 'error');
      }
    } catch (err) {
      showToast('Error submitting request.', 'error');
    } finally {
      setRequestLoading(false);
    }
  };

  const isLocked = profileData.profile_status === 'submitted' || profileData.profile_status === 'pending_edit';

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="loader-spinner"></div>
      </div>
    );
  }

  const isNonBlossom = profileData.student_type === 'non_blossom';
  const showAcademic = !isNonBlossom || !!(
    profileData.course_name ||
    profileData.course_specialization ||
    profileData.employment_status ||
    profileData.other_status ||
    profileData.admin_col1_val ||
    profileData.admin_col2_val ||
    profileData.admin_col3_val
  );

  return (
    <div style={{ padding: '32px 16px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Top Navbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', background: 'linear-gradient(to right, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Student Portal
          </h1>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', marginTop: '4px' }}>
            Welcome back, {profileData.full_name || 'Student'}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={logout}>
          <LogOut size={16} /> Logout
        </button>
      </div>

      <div className="grid-3" style={{ gridTemplateColumns: '1fr 2fr', alignItems: 'start' }}>
        
        {/* Left Column: Profile Card & Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Photo & Profile Status */}
          <div className="glass-panel" style={{ padding: '28px', textAlign: 'center' }}>
            <div style={{ position: 'relative', width: '130px', height: '130px', margin: '0 auto 20px', borderRadius: '50%', border: '2px solid hsla(var(--primary), 0.5)', overflow: 'hidden', background: '#0f172a' }}>
              {profileData.photo_url ? (
                <img 
                  src={profileData.photo_url} 
                  alt="Profile" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'hsl(var(--text-muted))' }}>
                  <User size={64} />
                </div>
              )}
              
              {!isLocked && (
                <label 
                  htmlFor="photo-file" 
                  style={{ position: 'absolute', bottom: '0', left: '0', right: '0', background: 'rgba(0,0,0,0.6)', padding: '6px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', transition: 'var(--transition-smooth)' }}
                >
                  <Upload size={12} style={{ marginRight: '4px' }} /> Upload
                </label>
              )}
              <input 
                type="file" 
                id="photo-file" 
                accept="image/png, image/jpeg, image/jpg" 
                style={{ display: 'none' }} 
                onChange={handlePhotoUpload} 
                disabled={isLocked}
              />
            </div>

            <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{profileData.full_name || 'New Student'}</h3>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.8rem', marginBottom: '16px' }}>
              UT No: {profileData.ut_no || 'Not Assigned'}
            </p>

            {/* Status indicator */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid hsla(var(--border-glass))', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>Profile Status:</span>
                <span className={`badge badge-${profileData.profile_status}`}>
                  {profileData.profile_status.replace('_', ' ')}
                </span>
              </div>

              {profileData.profile_status === 'draft' && (
                <p style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', textAlign: 'left', lineHeight: '1.4' }}>
                  Your profile is a draft. You can edit all fields. Submit to admin when complete.
                </p>
              )}
              {profileData.profile_status === 'submitted' && (
                <p style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', textAlign: 'left', lineHeight: '1.4' }}>
                  Your profile has been submitted and is read-only. Request edit access if changes are required.
                </p>
              )}
              {profileData.profile_status === 'pending_edit' && (
                <p style={{ fontSize: '0.78rem', color: 'hsl(var(--warning))', textAlign: 'left', lineHeight: '1.4' }}>
                  Requested edit access on {activeRequest ? new Date(activeRequest.created_at).toLocaleDateString() : ''}. Awaiting admin review.
                </p>
              )}
              {profileData.profile_status === 'approved_edit' && (
                <p style={{ fontSize: '0.78rem', color: 'hsl(var(--success))', textAlign: 'left', lineHeight: '1.4' }}>
                  Admin approved your edit request! Modify your details and re-submit.
                </p>
              )}
            </div>

            {profileData.profile_status === 'submitted' && (
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ width: '100%', gap: '8px' }}
                onClick={() => setShowRequestModal(true)}
              >
                <Edit size={14} /> Request Edit Access
              </button>
            )}
          </div>

          {/* Blossom Trust Amount — Read-Only Admin Field */}
          {profileData.student_type !== 'non_blossom' && (
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <DollarSign size={16} color="hsl(var(--primary))" />
                <h3 style={{ fontSize: '1rem' }}>Blossom Trust Amount</h3>
              </div>
              <div style={{ 
                background: 'rgba(99, 102, 241, 0.06)', 
                border: '1px solid rgba(99,102,241,0.2)', 
                borderRadius: '8px', 
                padding: '14px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Disbursement Amount:</span>
                <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'hsl(var(--primary-hover))' }}>
                  LKR {profileData.blossom_trust_amount ? Number(profileData.blossom_trust_amount).toLocaleString() : '0'}
                </span>
              </div>
              <p style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', marginTop: '8px', lineHeight: '1.4' }}>
                This amount is managed by the administrator and cannot be modified by students.
              </p>
            </div>
          )}

          {/* Admin Managed Columns (Read-Only) */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Lock size={16} color="hsl(var(--primary))" />
              <h3 style={{ fontSize: '1.1rem' }}>Administrative Details</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ borderBottom: '1px solid hsla(var(--border-glass))', paddingBottom: '10px' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-secondary))', marginBottom: '4px' }}>
                  Course Completion Status
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: '500' }}>
                  {profileData.course_completion_status || 'Not Updated'}
                </div>
              </div>

              <div style={{ borderBottom: '1px solid hsla(var(--border-glass))', paddingBottom: '10px' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-secondary))', marginBottom: '4px' }}>
                  {adminTitles.admin_col1_title}
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: '500' }}>
                  {profileData.admin_col1_val || 'N/A'}
                </div>
              </div>

              <div style={{ borderBottom: '1px solid hsla(var(--border-glass))', paddingBottom: '10px' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-secondary))', marginBottom: '4px' }}>
                  {adminTitles.admin_col2_title}
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: '500' }}>
                  {profileData.admin_col2_val || 'N/A'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-secondary))', marginBottom: '4px' }}>
                  {adminTitles.admin_col3_title}
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: '500', color: 'hsl(var(--success))' }}>
                  {profileData.admin_col3_val ? `LKR ${profileData.admin_col3_val.toLocaleString()}` : 'LKR 0'}
                </div>
              </div>
            </div>
          </div>

          {/* Attendance History (Read-Only) */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <ShieldAlert size={16} color="hsl(var(--primary))" />
              <h3 style={{ fontSize: '1.1rem' }}>Attendance Summary</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ borderBottom: '1px solid hsla(var(--border-glass))', paddingBottom: '10px' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-secondary))', marginBottom: '4px' }}>
                  Latest Attendance Percentage
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: '500', color: profileData.dropout_status ? 'hsl(var(--danger))' : profileData.low_attendance_status ? 'hsl(var(--warning))' : 'hsl(var(--success))' }}>
                  {profileData.attendance_percentage !== null ? `${profileData.attendance_percentage}%` : 'N/A'}
                </div>
              </div>

              <div style={{ paddingBottom: '10px' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-secondary))', marginBottom: '4px' }}>
                  Last Recorded Month
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: '500' }}>
                  {profileData.last_attendance_month || 'N/A'}
                </div>
              </div>
              
              {profileData.dropout_status && (
                <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <span style={{ color: 'hsl(var(--danger))', fontSize: '0.85rem', fontWeight: '500' }}>Status: Dropout</span>
                </div>
              )}
              {!profileData.dropout_status && profileData.low_attendance_status && (
                <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <span style={{ color: 'hsl(var(--warning))', fontSize: '0.85rem', fontWeight: '500' }}>Status: Low Attendance Warning</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Detailed Profiles Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-panel" style={{ padding: '32px' }}>
            <form onSubmit={handleSave}>
              
              {/* Profile Details section */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', borderBottom: '1px solid hsla(var(--border-glass))', paddingBottom: '12px' }}>
                <User size={20} color="hsl(var(--primary))" />
                <h2 style={{ fontSize: '1.3rem' }}>
                  {profileData.student_type === 'blossom' ? '🌸 Blossom Trust Student Profile' : '🎓 Non Blossom Trust Student Profile'}
                </h2>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">UT Number (Unique ID)</label>
                  <input
                    type="text"
                    name="ut_no"
                    className="form-input"
                    value={profileData.ut_no || ''}
                    onChange={handleChange}
                    disabled={isLocked || profileData.profile_status === 'approved_edit'}
                    placeholder="e.g. UT-2026-0099"
                    required
                  />
                  {profileData.profile_status === 'approved_edit' && (
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Contact admin to alter UT No.</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    name="full_name"
                    className="form-input"
                    value={profileData.full_name || ''}
                    onChange={handleChange}
                    disabled={isLocked}
                    required
                  />
                </div>
              </div>

              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    name="phone_number"
                    className="form-input"
                    value={profileData.phone_number || ''}
                    onChange={handleChange}
                    disabled={isLocked}
                    placeholder="e.g. +94771234567"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">NIC Number</label>
                  <input
                    type="text"
                    name="nic_number"
                    className="form-input"
                    value={profileData.nic_number || ''}
                    onChange={handleChange}
                    disabled={isLocked}
                    placeholder="e.g. 200012345678"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">District (Sri Lanka)</label>
                  <select
                    name="district"
                    className="form-select"
                    value={profileData.district || ''}
                    onChange={handleChange}
                    disabled={isLocked}
                  >
                    <option value="">Select District</option>
                    {districts.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid-2" style={{ marginTop: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    className="form-input"
                    value={profileData.email || ''}
                    onChange={handleChange}
                    disabled={isLocked}
                    placeholder="example@gmail.com"
                  />
                </div>
                <div></div>
              </div>

              {profileData.student_type !== 'non_blossom' && (
                <>
                  {/* Bank details section */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '36px', marginBottom: '24px', borderBottom: '1px solid hsla(var(--border-glass))', paddingBottom: '12px' }}>
                    <Landmark size={20} color="hsl(var(--primary))" />
                    <h2 style={{ fontSize: '1.3rem' }}>Bank Account Details</h2>
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Bank Name</label>
                      <select
                        name="bank_name"
                        className="form-select"
                        value={profileData.bank_name || ''}
                        onChange={handleChange}
                        disabled={isLocked}
                        required
                      >
                        <option value="">Select Bank</option>
                        {banks.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Branch Name</label>
                      <input
                        type="text"
                        name="branch_name"
                        className="form-input"
                        value={profileData.branch_name || profileData.branch || ''}
                        onChange={handleChange}
                        disabled={isLocked}
                        placeholder="e.g. Colombo Main Branch"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid-3">
                    <div className="form-group">
                      <label className="form-label">Branch Code</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        name="branch_code"
                        className="form-input"
                        value={profileData.branch_code || ''}
                        onChange={handleChange}
                        disabled={isLocked}
                        placeholder="e.g. 001"
                        required
                      />
                    </div>

                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Account Number</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        name="account_no"
                        className="form-input"
                        value={profileData.account_no || ''}
                        onChange={handleChange}
                        disabled={isLocked}
                        placeholder="e.g. 0012345678900"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Beneficiary Name (Account Holder Name)</label>
                    <input
                      type="text"
                      name="beneficiary_name"
                      className="form-input"
                      value={profileData.beneficiary_name || ''}
                      onChange={handleChange}
                      disabled={isLocked}
                      placeholder="Name exactly as on bank passbook"
                      required
                    />
                  </div>
                </>
              )}

              {/* Dropdowns section for Course Specialization, Employment Status, and Other Status */}
              {isNonBlossom && showAcademic && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '36px', marginBottom: '24px', borderBottom: '1px solid hsla(var(--border-glass))', paddingBottom: '12px' }}>
                    <User size={20} color="hsl(var(--primary))" />
                    <h2 style={{ fontSize: '1.3rem' }}>Academic & Employment Status</h2>
                  </div>

                  <div className="grid-3" style={{ marginBottom: '20px' }}>
                    <div className="form-group">
                      <label className="form-label">Course Specialization</label>
                      <select
                        name="course_specialization"
                        className="form-select"
                        value={profileData.course_specialization || ''}
                        onChange={handleChange}
                        disabled={isLocked}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid hsla(var(--border-glass))',
                          backgroundColor: 'rgba(15, 23, 42, 0.6)',
                          color: 'hsl(var(--text-primary))',
                          outline: 'none'
                        }}
                      >
                        <option value="">Select Specialization</option>
                        <option value="Full Stack Development">Full Stack Development</option>
                        <option value="Front End">Front End</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Employment Status</label>
                      <select
                        name="employment_status"
                        className="form-select"
                        value={profileData.employment_status || ''}
                        onChange={handleChange}
                        disabled={isLocked}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid hsla(var(--border-glass))',
                          backgroundColor: 'rgba(15, 23, 42, 0.6)',
                          color: 'hsl(var(--text-primary))',
                          outline: 'none'
                        }}
                      >
                        <option value="">Select Employment Status</option>
                        <option value="Software Industry Employment">Software Industry Employment</option>
                        <option value="Other Industry Employment">Other Industry Employment</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Other Status</label>
                      <select
                        name="other_status"
                        className="form-select"
                        value={profileData.other_status || ''}
                        onChange={handleChange}
                        disabled={isLocked}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid hsla(var(--border-glass))',
                          backgroundColor: 'rgba(15, 23, 42, 0.6)',
                          color: 'hsl(var(--text-primary))',
                          outline: 'none'
                        }}
                      >
                        <option value="">Select Other Status</option>
                        <option value="Higher Study">Higher Study</option>
                        <option value="Unemployment">Unemployment</option>
                        <option value="Foreign">Foreign</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Form buttons */}
              {!isLocked && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '36px' }}>
                  <button 
                    type="submit" 
                    className="btn btn-secondary" 
                    disabled={isSaving}
                  >
                    {isSaving ? <div className="loader-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div> : 'Save Draft'}
                  </button>
                  
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={handleSubmitProfile}
                    disabled={isSubmitting}
                  >
                    <Send size={16} /> 
                    {isSubmitting ? 'Submitting...' : 'Submit Profile to Admin'}
                  </button>
                </div>
              )}
            </form>
          </div>

        </div>

      </div>

      {/* Edit Request Modal Overlay */}
      {showRequestModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h3 style={{ fontSize: '1.3rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert color="hsl(var(--warning))" size={20} /> Request Profile Edit Access
            </h3>
            
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.88rem', marginBottom: '20px', lineHeight: '1.5' }}>
              To update your profile after submission, you must request permission. Please provide a clear explanation of what details need correction.
            </p>

            <form onSubmit={handleRequestEdit}>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Reason for Modification</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="e.g. Changed my bank account. Need to update my account number."
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  required
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => { setShowRequestModal(false); setRequestReason(''); }}
                  disabled={requestLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={requestLoading}
                >
                  {requestLoading ? 'Sending...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default StudentProfile;
