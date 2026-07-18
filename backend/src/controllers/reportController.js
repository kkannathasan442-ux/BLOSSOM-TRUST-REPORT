const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { admin: supabaseAdmin } = require('../lib/supabaseClient');

const buildFilterQuery = (query, req) => {
  const { batch_year, course_name, district, profile_status } = req.query;
  
  if (batch_year) query = query.eq('batch_year', parseInt(batch_year, 10));
  if (course_name) query = query.ilike('course_name', `%${course_name}%`);
  if (district) query = query.ilike('district', `%${district}%`);
  
  if (profile_status) {
    query = query.eq('profile_status', profile_status);
  } else {
    // Only approved/locked profiles appear in official reports unless explicitly filtered
    query = query.in('profile_status', ['approved', 'locked']);
  }
  return query;
};

const fetchReportData = async (req, baseCondition) => {
  let query = supabaseAdmin.from('students').select(`
    *,
    employment_history ( status, company_name, salary, employment_date ),
    attendance_history ( month, year, attendance_percentage, status ),
    beneficiary_payments ( amount )
  `);

  if (baseCondition) {
    query = baseCondition(query);
  }
  
  query = buildFilterQuery(query, req);
  const { data, error } = await query;
  if (error) throw error;
  
  return (data || []).map(student => {
    // Get latest employment
    const sortedEmp = (student.employment_history || []).sort((a,b) => new Date(b.employment_date) - new Date(a.employment_date));
    const latestEmp = sortedEmp[0] || {};
    
    // Get latest attendance
    const sortedAtt = (student.attendance_history || []).sort((a,b) => (b.year - a.year) || b.month.localeCompare(a.month));
    const latestAtt = sortedAtt[0] || {};
    
    // Sum payments
    const totalPayments = (student.beneficiary_payments || []).reduce((sum, p) => sum + parseFloat(p.amount), 0);
    
    return {
      ...student,
      latest_employment: latestEmp.status || 'Not Updated',
      latest_company: latestEmp.company_name || 'N/A',
      latest_salary: latestEmp.salary || 0,
      latest_attendance_pct: latestAtt.attendance_percentage || 'N/A',
      latest_attendance_status: latestAtt.status || 'N/A',
      total_payments: totalPayments
    };
  });
};

const generateExcel = async (res, students, reportTitle, headers, rowMapper) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Report');

  worksheet.mergeCells(1, 1, 1, headers.length);
  worksheet.getCell('A1').value = reportTitle;
  worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 40;

  worksheet.getRow(2).values = headers;
  worksheet.getRow(2).font = { bold: true };

  students.forEach((s, idx) => {
    worksheet.addRow([idx + 1, ...rowMapper(s)]);
  });

  worksheet.columns.forEach(col => { col.width = 20; });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${reportTitle.replace(/\s+/g, '_')}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
};

exports.blossomFinalReport = async (req, res) => {
  try {
    const students = await fetchReportData(req, (q) => q.eq('student_type', 'blossom'));
    const headers = ['No', 'UT No', 'Full Name', 'District', 'Course', 'Completion Status', 'Emp. Status', 'Company', 'Salary', 'Total Funding'];
    const rowMapper = s => [s.ut_no, s.full_name, s.district, s.course_name, s.course_completion_status, s.latest_employment, s.latest_company, s.latest_salary, s.total_payments];
    await generateExcel(res, students, 'Blossom Final Report', headers, rowMapper);
  } catch (error) {
    return res.status(500).json({ message: 'Error generating report.' });
  }
};

exports.nonBlossomReport = async (req, res) => {
  try {
    const students = await fetchReportData(req, (q) => q.eq('student_type', 'non_blossom'));
    const headers = ['No', 'UT No', 'Full Name', 'District', 'Course', 'Completion Status', 'Emp. Status', 'Company', 'Salary'];
    const rowMapper = s => [s.ut_no, s.full_name, s.district, s.course_name, s.course_completion_status, s.latest_employment, s.latest_company, s.latest_salary];
    await generateExcel(res, students, 'Non-Blossom Report', headers, rowMapper);
  } catch (error) {
    return res.status(500).json({ message: 'Error generating report.' });
  }
};

exports.employmentReport = async (req, res) => {
  try {
    const students = await fetchReportData(req, null);
    const headers = ['No', 'UT No', 'Full Name', 'District', 'Course', 'Emp. Status', 'Company', 'Salary'];
    const rowMapper = s => [s.ut_no, s.full_name, s.district, s.course_name, s.latest_employment, s.latest_company, s.latest_salary];
    await generateExcel(res, students, 'Employment Report', headers, rowMapper);
  } catch (error) {
    return res.status(500).json({ message: 'Error generating report.' });
  }
};

exports.dropoutReport = async (req, res) => {
  try {
    const students = await fetchReportData(req, (q) => q.eq('dropout_status', true));
    const headers = ['No', 'UT No', 'Full Name', 'District', 'Course', 'Dropout Reason', 'Dropout Date'];
    const rowMapper = s => [s.ut_no, s.full_name, s.district, s.course_name, s.dropout_reason, s.dropout_date];
    await generateExcel(res, students, 'Dropout Report', headers, rowMapper);
  } catch (error) {
    return res.status(500).json({ message: 'Error generating report.' });
  }
};

exports.monthlyAttendanceReport = async (req, res) => {
  try {
    const students = await fetchReportData(req, null);
    const headers = ['No', 'UT No', 'Full Name', 'District', 'Course', 'Latest Attendance %', 'Attendance Status'];
    const rowMapper = s => [s.ut_no, s.full_name, s.district, s.course_name, s.latest_attendance_pct, s.latest_attendance_status];
    await generateExcel(res, students, 'Monthly Attendance Report', headers, rowMapper);
  } catch (error) {
    return res.status(500).json({ message: 'Error generating report.' });
  }
};

// Deprecated placeholders for old API endpoints
exports.overallReport = exports.blossomFinalReport;
exports.monthlyLowAttendanceReport = exports.monthlyAttendanceReport;
