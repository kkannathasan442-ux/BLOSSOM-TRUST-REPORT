const crypto = require('crypto');
const ExcelJS = require('exceljs');
const { admin: supabaseAdmin, hasServiceRoleKey } = require('../lib/supabaseClient');
const { adminCache } = require('./adminController');

// â”€â”€â”€ Download Sample Excel Template â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
exports.downloadSample = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Blossom Trust TIC Portal';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Bulk Student Update');
    const instructions = workbook.addWorksheet('Instructions');

    const headers = [
      'UT No',
      'Student Type',
      'Full Name',
      'Phone Number',
      'NIC Number',
      'District',
      'Email Address',
      'Bank Name',
      'Branch',
      'Branch Name',
      'Branch Code',
      'Account Number',
      'Beneficiary Name',
      'Blossom Trust Amount',
      'Current Status',
      'Working Company Name',
      'Salary',
      'Dropout Reason',
      'Dropout Date',
      'Low Alternance Reason',
      'Low Alternance Hours',
      'Course Specialization',
      'Employment Status',
      'Other Status'
    ];

    const samples = [
      [
        'TIC-2026-001', 'blossom', 'Kasun Perera', '0771234567', '199012345678', 'Colombo', 'kasun.perera@example.com',
        'Bank of Ceylon', 'Colombo', 'Colombo Main Branch', '001', '12345678901', 'Kasun Perera', 15000,
        'Software Industry Employment', 'ABC Software Pvt Ltd', 85000, '', '', '', '',
        'Full Stack Development', 'Software Industry Employment', ''
      ],
      [
        'TIC-2026-002', 'non_blossom', 'Nimasha Silva', '0712345678', '199512367890', 'Gampaha', 'nimasha.silva@example.com',
        'Peoples Bank', 'Gampaha', 'Gampaha Branch', '045', '98765432101', 'Nimasha Silva', 12000,
        'Other Industry Employment', 'XYZ Holdings', 65000, '', '', '', '',
        'Front End', 'Other Industry Employment', ''
      ],
      [
        'TIC-2026-003', 'non_blossom', 'Ravindu Fernando', '0761234567', '200001234567', 'Kandy', 'ravindu.fernando@example.com',
        'Sampath Bank', 'Kandy', 'Kandy City Branch', '012', '11223344556', 'Ravindu Fernando', 18000,
        'Unemployed', 'N/A', 0, '', '', 'Needs follow-up', 12,
        'Full Stack Development', '', 'Unemployment'
      ]
    ];

    sheet.mergeCells('A1:X1');
    sheet.getCell('A1').value = 'Blossom Trust TIC - Bulk Student Create / Update Template';
    sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:X2');
    sheet.getCell('A2').value = 'For update: keep the UT No exactly the same as the existing student. For create: use a new unique UT No. Student Type controls Blossom vs Non-Blossom tab.';
    sheet.getCell('A2').font = { italic: true, color: { argb: 'FF374151' } };
    sheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2F8' } };

    sheet.addRow([]);
    sheet.addRow(headers);
    samples.forEach(row => sheet.addRow(row));

    const headerRow = sheet.getRow(4);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 34;

    sheet.columns = [
      { width: 16 }, { width: 16 }, { width: 24 }, { width: 16 }, { width: 18 }, { width: 16 }, { width: 28 },
      { width: 20 }, { width: 16 }, { width: 24 }, { width: 14 }, { width: 18 }, { width: 24 },
      { width: 18 }, { width: 26 }, { width: 24 }, { width: 14 }, { width: 24 }, { width: 16 },
      { width: 26 }, { width: 18 }, { width: 24 }, { width: 28 }, { width: 18 }
    ];

    sheet.views = [{ state: 'frozen', ySplit: 4 }];
    sheet.autoFilter = { from: 'A4', to: 'X4' };

    for (let rowNumber = 4; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
        };
        cell.alignment = { vertical: 'middle', wrapText: true };
      });
    }

    sheet.getColumn(14).numFmt = '#,##0';
    sheet.getColumn(17).numFmt = '#,##0';
    sheet.getColumn(19).numFmt = 'yyyy-mm-dd';
    sheet.getColumn(21).numFmt = '0';

    for (let row = 5; row <= 500; row++) {
      sheet.getCell(`B${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"blossom,non_blossom"']
      };
      sheet.getCell(`O${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Software Industry Employment,Other Industry Employment,Unemployed,N/A"']
      };
      sheet.getCell(`V${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Full Stack Development,Front End"']
      };
      sheet.getCell(`W${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Software Industry Employment,Other Industry Employment"']
      };
      sheet.getCell(`X${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Higher Study,Unemployment,Foreign"']
      };
    }

    instructions.columns = [{ width: 28 }, { width: 95 }];
    instructions.getCell('A1').value = 'Field';
    instructions.getCell('B1').value = 'How to use';
    instructions.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    instructions.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    instructions.addRows([
      ['UT No', 'Required. Existing UT No updates that student. New unique UT No creates a new student login/profile.'],
      ['Student Type', 'Required for correct tab. Use blossom or non_blossom. If omitted, import defaults to blossom.'],
      ['Full Name', 'Required. Rows without a full name are skipped.'],
      ['Email Address', 'Optional. If blank, the importer uses the generated student login email.'],
      ['NIC Number', 'Optional. If blank, it is stored as empty instead of blocking import; if filled, it must be unique.'],
      ['Account Number / Branch Code', 'Digits only. Keep as text if leading zeros matter.'],
      ['Blossom Trust Amount / Salary', 'Numbers only. Do not include currency symbols.'],
      ['Dropout Date', 'Use yyyy-mm-dd format, for example 2026-07-19.'],
      ['Current Status', 'Maps to admin status column. Example: Software Industry Employment, Other Industry Employment, Unemployed.'],
      ['Working Company Name', 'Maps to admin company column. Use N/A if not applicable.'],
      ['Course Specialization', 'Use Full Stack Development or Front End where applicable.'],
      ['Employment Status', 'Use Software Industry Employment or Other Industry Employment.'],
      ['Other Status', 'Use Higher Study, Unemployment, or Foreign where applicable.'],
      ['After upload', 'The dashboard refreshes automatically and clears filters so updated rows are visible.']
    ]);
    instructions.eachRow((row) => {
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
        };
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Student_Bulk_Create_Update_Template.xlsx"');

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

  if (!hasServiceRoleKey) {
    return res.status(503).json({
      message: 'Bulk import is unavailable until SUPABASE_SERVICE_ROLE_KEY is configured on the server.'
    });
  }

  const db = req.supabase || supabaseAdmin;

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
    const studentTypeCol = getColIndex(['student type', 'student_type', 'student category', 'type', 'blossom/non-blossom']);
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

    const normalizeStudentType = (value) => {
      const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
      if (!normalized || normalized === 'blossom' || normalized === 'blossom_trust') return 'blossom';
      if (normalized === 'non_blossom' || normalized === 'nonblossom' || normalized === 'non_blossom_trust') return 'non_blossom';
      return null;
    };

    const cleanUtForEmail = (utNo) =>
      String(utNo || 'student')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .toLowerCase();

    const generateTemporaryPassword = () =>
      crypto.randomBytes(18).toString('base64url');

    const nullableText = (value) => {
      const trimmed = String(value || '').trim();
      return trimmed ? trimmed : null;
    };

    const buildGeneratedUtNo = (rowNumber) =>
      `UT-AUTO-${new Date().getFullYear()}-${String(rowNumber).padStart(3, '0')}`;

    // Read data rows
    for (let r = headerRowIndex + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const nameVal = getCellValue(row.getCell(nameCol));
      if (!nameVal || !nameVal.trim()) continue;

      const rawUtNo = utCol ? getCellValue(row.getCell(utCol)).trim() : '';
      const finalUtNo = rawUtNo || buildGeneratedUtNo(r);

      const rawStudentType = studentTypeCol ? getCellValue(row.getCell(studentTypeCol)).trim() : '';
      const studentType = normalizeStudentType(rawStudentType);
      if (!studentType) {
        return res.status(400).json({ message: `Row ${r}: Student Type "${rawStudentType}" is invalid. Use blossom or non_blossom.` });
      }

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

      const rawEmail = emailCol ? getCellValue(row.getCell(emailCol)).trim().toLowerCase() : '';
      const fallbackEmail = `${cleanUtForEmail(finalUtNo)}@blossomtrust.org`;

      studentsToUpsert.push({
        rowNumber: r,
        utNo: finalUtNo,
        studentType,
        fullName: nameVal.trim(),
        phoneNo: phoneCol ? getCellValue(row.getCell(phoneCol)).trim() : '',
        nicNo: nicCol ? nullableText(getCellValue(row.getCell(nicCol))) : null,
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
        email: rawEmail || fallbackEmail
      });
    }

    console.log(`Parsed ${studentsToUpsert.length} records from Excel. Processing...`);

    let insertedCount = 0;
    let updatedCount = 0;
    const rowErrors = [];

    for (const s of studentsToUpsert) {
      // Try to match by UT No
      let existingStudent = null;
      if (s.utNo) {
        const { data, error: lookupError } = await db
          .from('students')
          .select('id, user_id')
          .eq('ut_no', s.utNo)
          .maybeSingle();
        if (lookupError) {
          rowErrors.push({ row: s.rowNumber, utNo: s.utNo, message: lookupError.message });
          continue;
        }
        existingStudent = data;
      }

      if (existingStudent) {
        // Update existing student
        const { error: updateError } = await db
          .from('students')
          .update({
            full_name: s.fullName,
            phone_number: s.phoneNo,
            nic_number: s.nicNo,
            district: s.district,
            student_type: s.studentType,
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
        if (updateError) {
          rowErrors.push({ row: s.rowNumber, utNo: s.utNo, message: updateError.message });
          continue;
        }
        updatedCount++;
      } else {
        // Create new user via Supabase Auth
        const cleanUtNo = cleanUtForEmail(s.utNo);
        const email = `${cleanUtNo}@blossomtrust.org`;
        const password = generateTemporaryPassword();

        // Check if the email already exists
        const { data: existingUser } = await db.from('users').select('id').eq('email', email).maybeSingle();
        let userId;

        if (existingUser) {
          userId = existingUser.id;
        } else {
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email, password, email_confirm: true
          });

          if (authError) {
            console.warn(`Skipping user creation for ${email}: ${authError.message}`);
            rowErrors.push({ row: s.rowNumber, utNo: s.utNo, message: authError.message });
            continue;
          }

          userId = authData.user.id;

          // In SQLite mode, createUser already inserts into users (with password).
          // In Supabase mode, createUser only creates in auth.users, so we insert manually.
          // Check first to avoid duplicate / NOT NULL constraint errors.
          const { data: alreadyInPublic } = await db
            .from('users')
            .select('id')
            .eq('id', userId)
            .maybeSingle();

          if (!alreadyInPublic) {
            const { error: publicUserError } = await db.from('users').insert([{
              id: userId, email, role: 'student'
            }]);
            if (publicUserError) {
              rowErrors.push({ row: s.rowNumber, utNo: s.utNo, message: publicUserError.message });
              continue;
            }
          }
        }

        // Insert student profile
        const { error: insertError } = await db.from('students').insert([{
          user_id: userId,
          ut_no: s.utNo,
          full_name: s.fullName,
          phone_number: s.phoneNo,
          nic_number: s.nicNo,
          district: s.district,
          student_type: s.studentType,
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
        if (insertError) {
          rowErrors.push({ row: s.rowNumber, utNo: s.utNo, message: insertError.message });
          continue;
        }
        insertedCount++;
      }
    }

    if (adminCache) adminCache.flushAll();

    const baseMessage = `Data import completed successfully! Created ${insertedCount} new student profiles, and updated ${updatedCount} existing profiles.`;
    if (rowErrors.length > 0) {
      return res.status(207).json({
        message: `${baseMessage} ${rowErrors.length} row(s) failed. Check the Excel data.`,
        inserted: insertedCount,
        updated: updatedCount,
        failed: rowErrors.length,
        errors: rowErrors.slice(0, 20)
      });
    }

    return res.status(200).json({
      message: baseMessage,
      inserted: insertedCount,
      updated: updatedCount,
      failed: 0
    });

  } catch (error) {
    console.error('Excel Import Error:', error);
    return res.status(500).json({ message: 'Error processing Excel file. Details: ' + error.message });
  }
};


