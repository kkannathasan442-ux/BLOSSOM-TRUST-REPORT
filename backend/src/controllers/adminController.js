const { supabase, admin: supabaseAdmin } = require('../lib/supabaseClient');
const { google } = require('googleapis');
const NodeCache = require('node-cache');
const adminCache = new NodeCache({ stdTTL: 60 }); // Default TTL: 60 seconds
exports.adminCache = adminCache;
let previousAnalyticsCounts = null; // Tracks previous analytics counts for diff logging

// 1. List students with pagination, search, and filtering
exports.listStudents = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const { utNo, name, phoneNo, district, bank, beneficiaryName, studentType, courseName, batch } = req.query;

  try {
    let query = supabase.from('students').select('*', { count: 'exact' });

    if (utNo) query = query.ilike('ut_no', `%${utNo}%`);
    if (name) query = query.ilike('full_name', `%${name}%`);
    if (phoneNo) query = query.ilike('phone_number', `%${phoneNo}%`);
    if (district) query = query.eq('district', district);
    if (bank) query = query.eq('bank_name', bank);
    if (beneficiaryName) query = query.ilike('beneficiary_name', `%${beneficiaryName}%`);
    if (studentType) query = query.eq('student_type', studentType);
    if (courseName) query = query.eq('course_name', courseName);
    if (batch) query = query.eq('batch', batch);

    query = query.order('blossom_trust_amount', { ascending: false });
    query = query.range(offset, offset + limit - 1);

    const { data: students, count, error } = await query;

    if (error) throw error;

    const normalizedStudents = (students || []).map(student => {
      const val = student.dropout_status;
      student.dropout_status =
        val === true || 
        val === 1 || 
        String(val).toLowerCase() === "true" || 
        String(val).toLowerCase() === "t" ||
        String(val) === "1";
      return student;
    });

    return res.status(200).json({
      students: normalizedStudents,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error retrieving students list.' });
  }
};

// 2. Fetch specific student details
exports.getStudentDetail = async (req, res) => {
  const { id } = req.params;

  try {
    const { data: student, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    const val = student.dropout_status;
    student.dropout_status =
      val === true || 
      val === 1 || 
      String(val).toLowerCase() === "true" || 
      String(val).toLowerCase() === "t" ||
      String(val) === "1";

    const { data: requests } = await supabase
      .from('edit_requests')
      .select('*')
      .eq('student_id', id)
      .order('id', { ascending: false });

    return res.status(200).json({
      student,
      requests: requests || []
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error retrieving student details.' });
  }
};

// 3. Update administrative fields
exports.updateAdminColumns = async (req, res) => {
  const { id } = req.params;
  const {
    adminCol1Val, adminCol2Val, adminCol3Val,
    dropout_reason, dropout_date, dropout_status,
    lowAlternanceReason, lowAlternanceHours,
    attendancePercentage, lowAttendanceStatus, lastAttendanceMonth,
    blossomTrustAmount, courseName, batch,
    courseSpecialization, employmentStatus, otherStatus, email,
    courseCompletionStatus
  } = req.body;

  try {
    const { data: student, error: findError } = await supabase
      .from('students')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (findError || !student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    const updateData = { updated_at: new Date().toISOString() };
    if (adminCol1Val !== undefined) updateData.admin_col1_val = adminCol1Val;
    if (adminCol2Val !== undefined) updateData.admin_col2_val = adminCol2Val;
    if (adminCol3Val !== undefined) updateData.admin_col3_val = parseFloat(adminCol3Val) || 0;
    if (blossomTrustAmount !== undefined) updateData.blossom_trust_amount = parseFloat(blossomTrustAmount) || 0;
    if (courseName !== undefined) {
      updateData.course_name = courseName === '' ? null : courseName;
    }
    if (batch !== undefined) {
      updateData.batch = batch;
      const match = batch.match(/\d{4}/);
      if (match) {
        updateData.batch_year = parseInt(match[0], 10);
      }
    }
    if (dropout_reason !== undefined) updateData.dropout_reason = dropout_reason;
    if (courseSpecialization !== undefined) updateData.course_specialization = courseSpecialization;
    if (employmentStatus !== undefined) updateData.employment_status = employmentStatus;
    if (otherStatus !== undefined) updateData.other_status = otherStatus;
    if (courseCompletionStatus !== undefined) {
      updateData.course_completion_status = courseCompletionStatus === '' ? null : courseCompletionStatus;
    }
    if (email !== undefined) {
      if (email === '') {
        updateData.email = null;
      } else {
        const tempEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(tempEmail)) {
          return res.status(400).json({ message: 'Invalid email address format.' });
        }
        const { data: existingEmail } = await supabase
          .from('students')
          .select('id')
          .eq('email', tempEmail)
          .neq('id', id)
          .maybeSingle();
        if (existingEmail) {
          return res.status(400).json({ message: 'This email address is already in use.' });
        }
        updateData.email = tempEmail;
      }
    }
    if (dropout_date !== undefined) updateData.dropout_date = dropout_date;
    if (dropout_status !== undefined) {
      updateData.dropout_status = 
        dropout_status === true || 
        dropout_status === "true" || 
        dropout_status === 1 || 
        dropout_status === "1";
    }
    if (lowAlternanceReason !== undefined) updateData.low_alternance_reason = lowAlternanceReason;
    if (lowAlternanceHours !== undefined) updateData.low_alternance_hours = parseInt(lowAlternanceHours) || null;
    
    // Consistent update logic for attendance fields to prevent partial updates
    if (attendancePercentage !== undefined) {
      if (attendancePercentage === null || attendancePercentage === '') {
        updateData.attendance_percentage = null;
        updateData.low_attendance_status = false;
        updateData.last_attendance_month = null;
      } else {
        updateData.attendance_percentage = parseFloat(attendancePercentage);
      }
    }
    
    if (lowAttendanceStatus !== undefined) {
      updateData.low_attendance_status = 
        lowAttendanceStatus === true || 
        lowAttendanceStatus === "true" || 
        lowAttendanceStatus === 1 || 
        lowAttendanceStatus === "1";
    }
    
    if (lastAttendanceMonth !== undefined) {
      updateData.last_attendance_month = lastAttendanceMonth === '' ? null : lastAttendanceMonth;
      if (updateData.last_attendance_month === null) {
        updateData.attendance_percentage = null;
        updateData.low_attendance_status = false;
      }
    }

    const { error: updateError } = await supabase
      .from('students')
      .update(updateData)
      .eq('id', id);

    if (updateError) throw updateError;

    // Invalidate cached dashboard stats so next loadStats() call returns fresh data
    adminCache.del('dashboard_stats');

    const { data: updatedStudent } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (updatedStudent) {
      const val = updatedStudent.dropout_status;
      updatedStudent.dropout_status =
        val === true || 
        val === 1 || 
        String(val).toLowerCase() === "true" || 
        String(val).toLowerCase() === "t" ||
        String(val) === "1";
    }

    return res.status(200).json({
      message: 'Student administrative fields updated successfully.',
      student: updatedStudent
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error updating administrative fields.' });
  }
};

// 4a. Get public settings (Only safe UI labels)
exports.getPublicSettings = async (req, res) => {
  try {
    const cachedSettings = adminCache.get('public_settings');
    if (cachedSettings) return res.status(200).json(cachedSettings);

    const { data: settings, error } = await supabase
      .from('admin_settings')
      .select('*')
      .in('key', ['admin_col1_title', 'admin_col2_title', 'admin_col3_title']);

    if (error) throw error;

    const config = {};
    (settings || []).forEach(s => { config[s.key] = s.value; });
    
    adminCache.set('public_settings', config, 3600); // Cache settings for 1 hour
    
    return res.status(200).json(config);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error retrieving system settings.' });
  }
};

// 4. Get active configurations
exports.getSettings = async (req, res) => {
  try {
    const { data: settings, error } = await supabase
      .from('admin_settings')
      .select('*');

    if (error) throw error;

    const config = {};
    (settings || []).forEach(s => { config[s.key] = s.value; });
    return res.status(200).json(config);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error retrieving system settings.' });
  }
};

// 5. Update custom columns titles / Sheet details
exports.updateSettings = async (req, res) => {
  const {
    adminCol1Title, adminCol2Title, adminCol3Title,
    googleSheetsId, googleSheetsClientEmail, googleSheetsPrivateKey
  } = req.body;

  try {
    const updates = [];
    if (adminCol1Title !== undefined) updates.push({ key: 'admin_col1_title', value: adminCol1Title });
    if (adminCol2Title !== undefined) updates.push({ key: 'admin_col2_title', value: adminCol2Title });
    if (adminCol3Title !== undefined) updates.push({ key: 'admin_col3_title', value: adminCol3Title });
    if (googleSheetsId !== undefined) updates.push({ key: 'google_sheets_id', value: googleSheetsId });
    if (googleSheetsClientEmail !== undefined) updates.push({ key: 'google_sheets_client_email', value: googleSheetsClientEmail });
    if (googleSheetsPrivateKey !== undefined) updates.push({ key: 'google_sheets_private_key', value: googleSheetsPrivateKey });

    for (const { key, value } of updates) {
      const { error } = await supabase
        .from('admin_settings')
        .upsert({ key, value }, { onConflict: 'key' });
      if (error) throw error;
    }

    return res.status(200).json({ message: 'System settings updated successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error updating settings.' });
  }
};

// 6. Get edit requests
exports.getEditRequests = async (req, res) => {
  try {
    const { data: requests, error } = await supabase
      .from('edit_requests')
      .select('*, students!inner(full_name, ut_no, phone_number, email:user_id, profile_status)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Flatten the student fields into the request object for compatibility
    const formatted = (requests || []).map(r => ({
      ...r,
      full_name: r.students?.full_name || '',
      ut_no: r.students?.ut_no || '',
      phone_number: r.students?.phone_number || '',
      profile_status: r.students?.profile_status || '',
      students: undefined
    }));

    return res.status(200).json(formatted);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error retrieving edit requests.' });
  }
};

// 7. Approve edit request
exports.approveEditRequest = async (req, res) => {
  const { id } = req.params;

  try {
    const { data: request, error: findError } = await supabase
      .from('edit_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (findError || !request) {
      return res.status(404).json({ message: 'Edit request not found.' });
    }

    // Update request status
    const { error: reqError } = await supabase
      .from('edit_requests')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (reqError) throw reqError;

    // Unlock student profile
    const { error: stuError } = await supabase
      .from('students')
      .update({ profile_status: 'reopened', updated_at: new Date().toISOString() })
      .eq('id', request.student_id);
    if (stuError) throw stuError;

    return res.status(200).json({ message: 'Edit request approved successfully. Student is unlocked.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error approving edit request.' });
  }
};

// 8. Reject edit request
exports.rejectEditRequest = async (req, res) => {
  const { id } = req.params;

  try {
    const { data: request, error: findError } = await supabase
      .from('edit_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (findError || !request) {
      return res.status(404).json({ message: 'Edit request not found.' });
    }

    const { error: reqError } = await supabase
      .from('edit_requests')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (reqError) throw reqError;

    const { error: stuError } = await supabase
      .from('students')
      .update({ profile_status: 'locked', updated_at: new Date().toISOString() })
      .eq('id', request.student_id);
    if (stuError) throw stuError;

    return res.status(200).json({ message: 'Edit request rejected successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error rejecting edit request.' });
  }
};

// 8b. Approve Initial Profile
exports.approveProfile = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('students')
      .update({ profile_status: 'locked', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return res.status(200).json({ message: 'Profile approved and locked successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error approving profile.' });
  }
};

// 8c. Reject Initial Profile
exports.rejectProfile = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('students')
      .update({ profile_status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return res.status(200).json({ message: 'Profile rejected and sent back to draft successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error rejecting profile.' });
  }
};

// 9. Sync to Google Sheets
exports.syncGoogleSheets = async (req, res) => {
  try {
    const { data: settingsRows } = await supabase
      .from('admin_settings')
      .select('*')
      .in('key', ['google_sheets_id', 'google_sheets_client_email', 'google_sheets_private_key', 'admin_col1_title', 'admin_col2_title', 'admin_col3_title']);

    const settings = {};
    (settingsRows || []).forEach(r => { settings[r.key] = r.value; });

    const sheetId = settings.google_sheets_id;
    const clientEmail = settings.google_sheets_client_email;
    const privateKey = settings.google_sheets_private_key;

    const titles = {
      admin_col1_title: settings.admin_col1_title || 'Current Status',
      admin_col2_title: settings.admin_col2_title || 'Working Company Name',
      admin_col3_title: settings.admin_col3_title || 'Salary'
    };

    // Fetch all students
    const { data: students } = await supabase
      .from('students')
      .select('*')
      .order('ut_no', { ascending: true });

    const headers = [
      'UT No', 'Full Name', 'Phone Number', 'NIC Number', 'District',
      'Beneficiary Name', 'Blossom Trust Amount', 'Bank Name', 'Account Number',
      'Branch', 'Branch Name', 'Branch Code',
      titles.admin_col1_title, titles.admin_col2_title, titles.admin_col3_title,
      'Dropout Reason', 'Dropout Date', 'Low Alternance Reason', 'Low Alternance Hours'
    ];

    const rows = (students || []).map(s => [
      s.ut_no || '', s.full_name || '', s.phone_number || '', s.nic_number || '',
      s.district || '', s.beneficiary_name || '', s.blossom_trust_amount || 0,
      s.bank_name || '', s.account_no || '', s.branch || '', s.branch_name || '',
      s.branch_code || '',
      s.admin_col1_val || '', s.admin_col2_val || '', s.admin_col3_val || 0,
      s.dropout_reason || '', s.dropout_date || '',
      s.low_alternance_reason || '', s.low_alternance_hours || ''
    ]);

    if (!sheetId || !clientEmail || !privateKey) {
      return res.status(200).json({
        simulated: true,
        message: 'Sync simulation completed successfully! Configure real service account credentials to publish directly to Google Sheets.',
        recordsSynced: (students || []).length
      });
    }

    try {
      const formattedKey = privateKey.replace(/\\n/g, '\n');
      const auth = new google.auth.JWT(clientEmail, null, formattedKey, ['https://www.googleapis.com/auth/spreadsheets']);
      const sheets = google.sheets({ version: 'v4', auth });

      await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: 'Sheet1!A:Z' });
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId, range: 'Sheet1!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [headers, ...rows] }
      });

      return res.status(200).json({
        simulated: false,
        message: `Synced ${(students || []).length} student records to Google Sheet successfully!`,
        recordsSynced: (students || []).length
      });
    } catch (googleError) {
      console.error('Google Sheets API Error:', googleError);
      return res.status(500).json({ message: 'Failed to connect to Google Sheets API. Error: ' + googleError.message });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error during sheets synchronization.' });
  }
};

exports.getAnalyticsStats = async (req, res) => {
  return exports.getStats(req, res); // Deprecating separate logic, routing to getStats
};

exports.getStats = async (req, res) => {
  try {
    const cachedStats = adminCache.get('dashboard_stats');
    if (cachedStats) return res.status(200).json(cachedStats);

    // 1. Fetch Students
    const { data: students, error: stdError } = await supabaseAdmin
      .from('students')
      .select('id, student_type, course_name, batch, district, profile_status, dropout_status');
    if (stdError) throw stdError;

    // 2. Fetch latest attendance per student
    const { data: attendance, error: attError } = await supabaseAdmin
      .from('attendance_history')
      .select('student_id, status, year, month')
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    if (attError) throw attError;

    // 3. Fetch latest employment per student
    const { data: employment, error: empError } = await supabaseAdmin
      .from('employment_history')
      .select('student_id, status, employment_date')
      .order('employment_date', { ascending: false });
    if (empError) throw empError;

    // 4. Fetch funding
    const { data: payments, error: payError } = await supabaseAdmin
      .from('beneficiary_payments')
      .select('amount, student_id');
    if (payError) throw payError;

    // Aggregate Latest Attendance & Employment
    const latestAtt = {};
    attendance.forEach(a => { if (!latestAtt[a.student_id]) latestAtt[a.student_id] = a.status; });
    const latestEmp = {};
    employment.forEach(e => { if (!latestEmp[e.student_id]) latestEmp[e.student_id] = e.status; });

    // Aggregate KPIs
    let totalStudents = students.length;
    let blossomStudents = 0;
    let nonBlossomStudents = 0;
    let activeStudents = 0;
    let pendingApproval = 0;
    let dropouts = 0;
    let lowAttendance = 0;
    let employedCount = 0;
    let unemployedCount = 0;
    let totalFunding = 0;

    // Aggregate Charts
    const charts = {
      studentType: { blossom: 0, non_blossom: 0 },
      courseDist: {},
      batchDist: {},
      districtDist: {},
      attendanceDist: { Good: 0, Medium: 0, Low: 0, Critical: 0 },
      employmentDist: { 'Employed': 0, 'Unemployed': 0, 'Higher Studies': 0, 'Foreign Employment': 0 },
      fundingByDistrict: {},
      fundingByBatch: {},
      fundingByType: { blossom: 0, non_blossom: 0 }
    };

    const studentMap = {};

    students.forEach(s => {
      studentMap[s.id] = s;
      
      if (s.student_type === 'blossom') { blossomStudents++; charts.studentType.blossom++; }
      else { nonBlossomStudents++; charts.studentType.non_blossom++; }

      if ((s.profile_status === 'approved' || s.profile_status === 'locked') && !s.dropout_status) activeStudents++;
      if (['submitted', 'pending_review', 'edit_request'].includes(s.profile_status)) pendingApproval++;
      if (s.dropout_status) dropouts++;

      if (s.course_name) charts.courseDist[s.course_name] = (charts.courseDist[s.course_name] || 0) + 1;
      if (s.batch) charts.batchDist[s.batch] = (charts.batchDist[s.batch] || 0) + 1;
      if (s.district) charts.districtDist[s.district] = (charts.districtDist[s.district] || 0) + 1;

      const attStatus = latestAtt[s.id];
      if (attStatus) {
        charts.attendanceDist[attStatus] = (charts.attendanceDist[attStatus] || 0) + 1;
        if (attStatus === 'Low' || attStatus === 'Critical') lowAttendance++;
      }

      const empStatus = latestEmp[s.id];
      if (empStatus) {
        charts.employmentDist[empStatus] = (charts.employmentDist[empStatus] || 0) + 1;
        if (empStatus === 'Employed') employedCount++;
        if (empStatus === 'Unemployed') unemployedCount++;
      }
    });

    payments.forEach(p => {
      const amt = parseFloat(p.amount) || 0;
      totalFunding += amt;
      const s = studentMap[p.student_id];
      if (s) {
        if (s.district) charts.fundingByDistrict[s.district] = (charts.fundingByDistrict[s.district] || 0) + amt;
        if (s.batch) charts.fundingByBatch[s.batch] = (charts.fundingByBatch[s.batch] || 0) + amt;
        if (s.student_type) charts.fundingByType[s.student_type] = (charts.fundingByType[s.student_type] || 0) + amt;
      }
    });

    const stats = {
      kpi: {
        totalStudents,
        blossomStudents,
        nonBlossomStudents,
        activeStudents,
        pendingApproval,
        dropouts,
        lowAttendance,
        employedCount,
        unemployedCount,
        totalFunding
      },
      charts
    };

    adminCache.set('dashboard_stats', stats, 60);

    return res.status(200).json(stats);
  } catch (error) {
    console.error('getStats error:', error);
    return res.status(500).json({ message: 'Error retrieving dashboard stats.' });
  }
};
