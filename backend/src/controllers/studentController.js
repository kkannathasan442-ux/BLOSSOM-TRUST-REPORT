const { supabase, admin: supabaseAdmin } = require('../lib/supabaseClient');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});


exports.getProfile = async (req, res) => {
  try {
    const { data: student, error } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error || !student) {
      return res.status(404).json({ message: 'Student profile not found.' });
    }

    // Get the latest edit request
    const { data: editRequests } = await supabase
      .from('edit_requests')
      .select('id, request_reason, status, created_at')
      .eq('student_id', student.id)
      .order('id', { ascending: false })
      .limit(1);

    return res.status(200).json({
      student,
      activeRequest: editRequests && editRequests.length > 0 ? editRequests[0] : null
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.updateProfile = async (req, res) => {
  const {
    utNo, fullName, phoneNo, nicNumber, district,
    bankName, branch, branchName, branchCode, accountNo, beneficiaryName,
    isSubmit, courseName, courseSpecialization, employmentStatus, otherStatus,
    email
  } = req.body;

  try {
    const { data: student, error } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error || !student) {
      return res.status(404).json({ message: 'Student profile not found.' });
    }

    // Check editing lock
    if (student.profile_status !== 'draft' && student.profile_status !== 'reopened') {
      return res.status(403).json({
        message: 'Your profile is currently locked. You must request edit access from the administrator.'
      });
    }

    const isBlossom = student.student_type === 'blossom';

    // Validation on submit
    if (isSubmit) {
      if (isBlossom) {
        if (!fullName || !phoneNo || !nicNumber || !district || !bankName || !branch || !branchName || !branchCode || !accountNo || !beneficiaryName) {
          return res.status(400).json({ message: 'All profile fields are required for submission.' });
        }
        if (!/^\d+$/.test(accountNo)) {
          return res.status(400).json({ message: 'Account Number must contain only digits.' });
        }
        if (!/^\d+$/.test(branchCode)) {
          return res.status(400).json({ message: 'Branch Code must contain only digits.' });
        }
      } else {
        if (!fullName || !phoneNo || !nicNumber || !district) {
          return res.status(400).json({ message: 'Personal profile and district details are required for submission.' });
        }
        if (courseName && courseName !== 'Full Stack Developer' && courseName !== 'Front End Developer') {
          return res.status(400).json({ message: 'Invalid course selection.' });
        }
      }
      if (phoneNo && !/^\+?[\d\s-]{9,15}$/.test(phoneNo)) {
        return res.status(400).json({ message: 'Invalid phone number format.' });
      }
    } else {
      if (phoneNo && !/^\+?[\d\s-]{9,15}$/.test(phoneNo)) {
        return res.status(400).json({ message: 'Invalid phone number format.' });
      }
      if (isBlossom) {
        if (accountNo && !/^\d+$/.test(accountNo)) {
          return res.status(400).json({ message: 'Account Number must contain only digits.' });
        }
        if (branchCode && !/^\d+$/.test(branchCode)) {
          return res.status(400).json({ message: 'Branch Code must contain only digits.' });
        }
      }
    }

    // Email validation and duplicate checking for BOTH Blossom Trust and Non-Blossom Trust students
    let trimmedEmail = undefined;
    if (email !== undefined) {
      if (email === '') {
        if (isSubmit) {
          return res.status(400).json({ message: 'Email address is required for submission.' });
        }
        trimmedEmail = null;
      } else {
        const tempEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(tempEmail)) {
          return res.status(400).json({ message: 'Invalid email address format.' });
        }
        
        // Check duplicate email
        const { data: existingEmail } = await supabase
          .from('students')
          .select('id')
          .eq('email', tempEmail)
          .neq('id', student.id)
          .maybeSingle();

        if (existingEmail) {
          return res.status(400).json({ message: 'This email address is already in use.' });
        }
        trimmedEmail = tempEmail;
      }
    } else if (isSubmit && !student.email) {
      return res.status(400).json({ message: 'Email address is required for submission.' });
    }

    // Check UT No uniqueness
    if (utNo && utNo !== student.ut_no) {
      const { data: existingUT } = await supabase
          .from('students')
          .select('id')
          .eq('ut_no', utNo)
          .neq('id', student.id)
          .maybeSingle();

      if (existingUT) {
        return res.status(400).json({ message: 'This UT No is already in use by another student.' });
      }
    }

    const nextStatus = isSubmit ? 'submitted' : student.profile_status;

    const updatePayload = {
      ut_no: utNo || student.ut_no,
      full_name: fullName || student.full_name,
      phone_number: phoneNo || student.phone_number,
      nic_number: nicNumber || student.nic_number,
      district: district || student.district,
      course_specialization: courseSpecialization !== undefined ? courseSpecialization : student.course_specialization,
      employment_status: employmentStatus !== undefined ? employmentStatus : student.employment_status,
      other_status: otherStatus !== undefined ? otherStatus : student.other_status,
      profile_status: nextStatus,
      updated_at: new Date().toISOString()
    };

    if (isBlossom) {
      updatePayload.bank_name = bankName || student.bank_name;
      updatePayload.branch = branch || student.branch;
      updatePayload.branch_name = branchName || student.branch_name;
      updatePayload.branch_code = branchCode || student.branch_code;
      updatePayload.account_no = accountNo || student.account_no;
      updatePayload.beneficiary_name = beneficiaryName || student.beneficiary_name;
    } else {
      updatePayload.course_name = courseName || student.course_name;
    }

    if (trimmedEmail !== undefined) {
      updatePayload.email = trimmedEmail;
    }

    const { error: updateError } = await supabase
      .from('students')
      .update(updatePayload)
      .eq('id', student.id);

    if (updateError) throw updateError;

    return res.status(200).json({
      message: isSubmit ? 'Profile submitted successfully!' : 'Draft saved successfully!',
      status: nextStatus
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.requestEdit = async (req, res) => {
  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({ message: 'A reason for the edit request is required.' });
  }

  try {
    const { data: student, error } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error || !student) {
      return res.status(404).json({ message: 'Student profile not found.' });
    }

    if (student.profile_status === 'draft' || student.profile_status === 'reopened') {
      return res.status(400).json({ message: 'Your profile is open. You can edit it directly.' });
    }
    if (student.profile_status === 'edit_request') {
      return res.status(400).json({ message: 'You already have a pending edit request. Please wait for admin approval.' });
    }

    // Create the edit request
    const { error: insertError } = await supabase
      .from('edit_requests')
      .insert([{ student_id: student.id, request_reason: reason, status: 'pending' }]);

    if (insertError) throw insertError;

    // Update student status
    const { error: updateError } = await supabase
      .from('students')
      .update({ profile_status: 'edit_request', updated_at: new Date().toISOString() })
      .eq('id', student.id);

    if (updateError) throw updateError;

    return res.status(200).json({
      message: 'Edit request submitted successfully. Waiting for admin approval.',
      status: 'edit_request'
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.uploadPhoto = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded or file format is invalid.' });
  }

  try {
    const { data: student, error } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error || !student) {
      return res.status(404).json({ message: 'Student profile not found.' });
    }

    if (student.profile_status !== 'draft' && student.profile_status !== 'reopened') {
      return res.status(403).json({ message: 'Your profile is locked. Cannot upload photo.' });
    }

    // Upload to Cloudinary using upload_stream (handles memory buffer)
    const uploadToCloudinary = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'student_profiles',
            public_id: `student-${student.id}-${Date.now()}`
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });
    };

    let uploadResult;
    try {
      uploadResult = await uploadToCloudinary();
    } catch (uploadError) {
      console.error('Cloudinary upload error:', uploadError);
      return res.status(500).json({ message: 'Failed to upload photo to Cloudinary.' });
    }

    const photoUrl = uploadResult.secure_url;

    // Update student record
    await supabase
      .from('students')
      .update({ photo_url: photoUrl, updated_at: new Date().toISOString() })
      .eq('id', student.id);

    return res.status(200).json({
      message: 'Photo uploaded successfully!',
      photoUrl
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};
