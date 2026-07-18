const ExcelJS = require('exceljs');
const { supabase, admin: supabaseAdmin } = require('../lib/supabaseClient');

// ─── Download Sample Excel Template ───────────────────────────────────────────
exports.downloadSample = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Students');

    // Core student fields only — admin fields (Status, Company, Salary, etc.) are updated later via the system
    sheet.addRow([
      'UT No',
      'Full Name',
      'Phone Number',
      'NIC Number',
      'District',
      'Email Address',
      'Bank Name',
      'Branch Name',
      'Branch Code',
      'Account Number',
      'Beneficiary Name',
      'Blossom Trust Amount',
      'Course Specialization',
      'Employment Status',
      'Other Status'
    ]);

    // 3 sample rows so users know the expected format
    const samples = [
      ['TIC-2026-001', 'Kasun Perera',       '0771234567', '199012345678', 'Colombo',      'kasun@gmail.com',   'Bank of Ceylon',  'Colombo Main Branch',  '001', '12345678901', 'Kasun Perera',       15000, 'Full Stack Development', 'Software Industry Employment', ''],
      ['TIC-2026-002', 'Nimasha Silva',       '0712345678', '199512367890', 'Gampaha',      'nimasha@gmail.com', 'Peoples Bank',    'Gampaha Branch',       '045', '98765432101', 'Nimasha Silva',      12000, 'Front End', 'Software Industry Employment', ''],
      ['TIC-2026-003', 'Ravindu Fernando',    '0761234567', '200001234567', 'Kandy',        'ravindu@gmail.com', 'Sampath Bank',    'Kandy City Branch',    '012', '11223344556', 'Ravindu Fernando',   18000, 'Full Stack Development', 'Other Industry Employment', ''],
    ];
    samples.forEach(row => sheet.addRow(row));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Student_Bulk_Upload_Sample.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Sample download error:', error);
    return res.status(500).json({ message: 'Failed to generate sample file.' });
  }
};

exports.importExcel = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded or file format is invalid.' });
  }

  const workbook = new ExcelJS.Workbook();

  try {
    // Read from the in-memory buffer (memoryStorage)
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      return res.status(400).json({ message: 'The Excel file is empty or has no sheets.' });
    }

    const studentsToUpsert = [];

    // Scan the first 10 rows to find headers
    let headerRowIndex = 1;
    let headersFound = false;

    for (let r = 1; r <= 10; r++) {
      const row = worksheet.getRow(r);
      const rowValues = Array.isArray(row.values) ? row.values : (row.values ? Object.values(row.values) : []);
      const values = rowValues.map(v => v ? String(v).trim().toLowerCase() : '');
      if (values.includes('ut no') || values.includes('ut_no') || values.includes('full name') || values.includes('name') || values.includes('fullname')) {
        headerRowIndex = r;
        headersFound = true;
        break;
      }
    }

    if (!headersFound) {
      return res.status(400).json({ message: 'Invalid file format. Could not locate column headers (e.g., UT No, Full Name).' });
    }

    const headerRow = worksheet.getRow(headerRowIndex);
    const headerMap = {};
    headerRow.eachCell((cell, colNumber) => {
      const val = cell.value ? String(cell.value).trim().toLowerCase() : '';
      headerMap[val] = colNumber;
    });

    const getColIndex = (names) => {
      for (const name of names) {
        if (headerMap[name.toLowerCase()]) return headerMap[name.toLowerCase()];
      }
      return null;
    };

    const utCol = getColIndex(['ut no', 'ut_no', 'utno', 'id']);
    const nameCol = getColIndex(['full name', 'name', 'fullname', 'student name']);
    const phoneCol = getColIndex(['phone number', 'phone no', 'phoneno', 'phone']);
    const nicCol = getColIndex(['nic number', 'nic no', 'nicnumber', 'nic']);
    const distCol = getColIndex(['district']);
    const bankCol = getColIndex(['bank name', 'bank', 'bankname']);
    const branchCol = getColIndex(['branch']);
    const branchNameCol = getColIndex(['branch name', 'branchname']);
    const branchCodeCol = getColIndex(['branch code', 'branchcode']);
    const accCol = getColIndex(['account number', 'account no', 'accountno', 'account']);
    const benefCol = getColIndex(['beneficiary name', 'beneficiary', 'beneficiaryname']);
    const blossomTrustCol = getColIndex(['blossom trust amount', 'blossom trust', 'blossomtrustamount']);
    const statusCol = getColIndex(['current status', 'status', 'admin_col1_val']);
    const compCol = getColIndex(['working company name', 'company', 'admin_col2_val']);
    const salCol = getColIndex(['salary', 'salary (lkr)', 'admin_col3_val']);
    const dropReasonCol = getColIndex(['dropout reason', 'reason for dropout']);
    const dropDateCol = getColIndex(['dropout date']);
    const altReasonCol = getColIndex(['low alternance reason']);
    const altHoursCol = getColIndex(['low alternance hours', 'alternance hours']);
    const courseSpecCol = getColIndex(['course specialization', 'course_specialization', 'specialization']);
    const empStatusCol = getColIndex(['employment status', 'employment_status']);
    const otherStatusCol = getColIndex(['other status', 'other_status']);
    const emailCol = getColIndex(['email', 'email address', 'email_address']);

    if (!nameCol) {
      return res.status(400).json({ message: 'Name column is required but was not found in the sheet.' });
    }

    // Helper to safely extract string values from rich text, formulas, or standard cells
    const getCellValue = (cell) => {
      if (!cell || cell.value === undefined || cell.value === null) return '';
      const val = cell.value;
      if (typeof val === 'object') {
        if (Array.isArray(val.richText)) return val.richText.map(t => t.text || '').join('');
        if (val.formula !== undefined) return val.result !== undefined && val.result !== null ? String(val.result) : '';
        if (val.text !== undefined) return String(val.text);
        if (val instanceof Date) return val.toISOString().split('T')[0];
      }
      return String(val);
    };

    // Read data rows
    for (let r = headerRowIndex + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const nameVal = getCellValue(row.getCell(nameCol));
      if (!nameVal || !nameVal.trim()) continue;

      const branchVal = branchCol ? getCellValue(row.getCell(branchCol)).trim() : '';
      const branchNameVal = branchNameCol ? getCellValue(row.getCell(branchNameCol)).trim() : '';
      const finalBranchName = branchNameVal || branchVal;

      const rawBlossomTrust = blossomTrustCol ? getCellValue(row.getCell(blossomTrustCol)).trim() : '';
      const blossomTrustAmount = rawBlossomTrust ? parseFloat(rawBlossomTrust) : 0;

      const accountNoVal = accCol ? getCellValue(row.getCell(accCol)).trim() : '';
      const branchCodeVal = branchCodeCol ? getCellValue(row.getCell(branchCodeCol)).trim() : '';
      const salaryVal = salCol ? getCellValue(row.getCell(salCol)).trim() : '';
      const salaryAmount = salaryVal ? parseFloat(salaryVal) : 0;

      // Enforce numeric validations
      if (accountNoVal && !/^\d+$/.test(accountNoVal)) {
        return res.status(400).json({ message: `Row ${r}: Account Number "${accountNoVal}" must contain only digits.` });
      }
      if (branchCodeVal && !/^\d+$/.test(branchCodeVal)) {
        return res.status(400).json({ message: `Row ${r}: Branch Code "${branchCodeVal}" must contain only digits.` });
      }
      if (rawBlossomTrust && isNaN(blossomTrustAmount)) {
        return res.status(400).json({ message: `Row ${r}: Blossom Trust Amount "${rawBlossomTrust}" must be a valid number.` });
      }
      if (salaryVal && isNaN(salaryAmount)) {
        return res.status(400).json({ message: `Row ${r}: Salary "${salaryVal}" must be a valid number.` });
      }

      studentsToUpsert.push({
        rowNumber: r,
        utNo: utCol ? getCellValue(row.getCell(utCol)).trim() || null : null,
        fullName: nameVal.trim(),
        phoneNo: phoneCol ? getCellValue(row.getCell(phoneCol)).trim() : '',
        nicNo: nicCol ? getCellValue(row.getCell(nicCol)).trim() : '',
        district: distCol ? getCellValue(row.getCell(distCol)).trim() : '',
        bankName: bankCol ? getCellValue(row.getCell(bankCol)).trim() : '',
        branch: branchVal,
        branchName: finalBranchName,
        branchCode: branchCodeVal,
        accountNo: accountNoVal,
        beneficiaryName: benefCol ? getCellValue(row.getCell(benefCol)).trim() || nameVal.trim() : nameVal.trim(),
        blossomTrustAmount,
        adminCol1Val: statusCol ? getCellValue(row.getCell(statusCol)).trim() || 'Unemployed' : 'Unemployed',
        adminCol2Val: compCol ? getCellValue(row.getCell(compCol)).trim() || 'N/A' : 'N/A',
        adminCol3Val: salaryAmount,
        dropoutReason: dropReasonCol ? getCellValue(row.getCell(dropReasonCol)).trim() || null : null,
        dropoutDate: dropDateCol ? getCellValue(row.getCell(dropDateCol)).trim() || null : null,
        lowAlternanceReason: altReasonCol ? getCellValue(row.getCell(altReasonCol)).trim() || null : null,
        lowAlternanceHours: altHoursCol ? parseInt(getCellValue(row.getCell(altHoursCol)), 10) || null : null,
        courseSpecialization: courseSpecCol ? getCellValue(row.getCell(courseSpecCol)).trim() || null : null,
        employmentStatus: empStatusCol ? getCellValue(row.getCell(empStatusCol)).trim() || null : null,
        otherStatus: otherStatusCol ? getCellValue(row.getCell(otherStatusCol)).trim() || null : null,
        email: emailCol ? getCellValue(row.getCell(emailCol)).trim().toLowerCase() || null : null
      });
    }

    console.log(`Parsed ${studentsToUpsert.length} records from Excel. Processing...`);

    let insertedCount = 0;
    let updatedCount = 0;

    for (const s of studentsToUpsert) {
      // Try to match by UT No
      let existingStudent = null;
      if (s.utNo) {
        const { data } = await supabase
          .from('students')
          .select('id, user_id')
          .eq('ut_no', s.utNo)
          .maybeSingle();
        existingStudent = data;
      }

      if (existingStudent) {
        // Update existing student
        await supabase
          .from('students')
          .update({
            full_name: s.fullName,
            phone_number: s.phoneNo,
            nic_number: s.nicNo,
            district: s.district,
            bank_name: s.bankName,
            branch: s.branch,
            branch_name: s.branchName,
            branch_code: s.branchCode,
            account_no: s.accountNo,
            beneficiary_name: s.beneficiaryName,
            blossom_trust_amount: s.blossomTrustAmount,
            admin_col1_val: s.adminCol1Val,
            admin_col2_val: s.adminCol2Val,
            admin_col3_val: s.adminCol3Val,
            dropout_reason: s.dropoutReason,
            dropout_date: s.dropoutDate,
            low_alternance_reason: s.lowAlternanceReason,
            low_alternance_hours: s.lowAlternanceHours,
            course_specialization: s.courseSpecialization,
            employment_status: s.employmentStatus,
            other_status: s.otherStatus,
            email: s.email,
            profile_status: 'submitted',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingStudent.id);
        updatedCount++;
      } else {
        // Create new user via Supabase Auth
        const cleanUtNo = s.utNo ? s.utNo.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : 'student_' + Math.round(Math.random() * 100000);
        const email = `${cleanUtNo}@blossomtrust.org`;
        const password = 'student123';

        // Check if the email already exists
        const { data: existingUser } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
        let userId;

        if (existingUser) {
          userId = existingUser.id;
        } else {
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email, password, email_confirm: true
          });

          if (authError) {
            console.warn(`Skipping user creation for ${email}: ${authError.message}`);
            continue;
          }

          userId = authData.user.id;

          // In SQLite mode, createUser already inserts into users (with password).
          // In Supabase mode, createUser only creates in auth.users, so we insert manually.
          // Check first to avoid duplicate / NOT NULL constraint errors.
          const { data: alreadyInPublic } = await supabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .maybeSingle();

          if (!alreadyInPublic) {
            await supabase.from('users').insert([{
              id: userId, email, role: 'student'
            }]);
          }
        }

        // Insert student profile
        await supabase.from('students').insert([{
          user_id: userId,
          ut_no: s.utNo || `UT-NEW-${Date.now()}`,
          full_name: s.fullName,
          phone_number: s.phoneNo,
          nic_number: s.nicNo,
          district: s.district,
          bank_name: s.bankName,
          branch: s.branch,
          branch_name: s.branchName,
          branch_code: s.branchCode,
          account_no: s.accountNo,
          beneficiary_name: s.beneficiaryName,
          blossom_trust_amount: s.blossomTrustAmount,
          profile_status: 'submitted',
          admin_col1_val: s.adminCol1Val,
          admin_col2_val: s.adminCol2Val,
          admin_col3_val: s.adminCol3Val,
          dropout_reason: s.dropoutReason,
          dropout_date: s.dropoutDate,
          low_alternance_reason: s.lowAlternanceReason,
          low_alternance_hours: s.lowAlternanceHours,
          course_specialization: s.courseSpecialization,
          employment_status: s.employmentStatus,
          other_status: s.otherStatus,
          email: s.email
        }]);
        insertedCount++;
      }
    }

    return res.status(200).json({
      message: `Data import completed successfully! Created ${insertedCount} new student profiles, and updated ${updatedCount} existing profiles.`,
      inserted: insertedCount,
      updated: updatedCount
    });

  } catch (error) {
    console.error('Excel Import Error:', error);
    return res.status(500).json({ message: 'Error processing Excel file. Details: ' + error.message });
  }
};
