const ExcelJS = require('exceljs');
const pdfParse = require('pdf-parse');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { supabase, admin: supabaseAdmin } = require('../lib/supabaseClient');
const { adminCache } = require('./adminController');

// 1. Fetch Thresholds
const getThresholds = async () => {
  const { data: settings } = await supabaseAdmin.from('admin_settings').select('*').in('key', ['attendance_threshold_good', 'attendance_threshold_medium', 'attendance_threshold_low']);
  const map = { good: 90, medium: 80, low: 65 };
  (settings || []).forEach(s => {
    if (s.key === 'attendance_threshold_good') map.good = parseFloat(s.value);
    if (s.key === 'attendance_threshold_medium') map.medium = parseFloat(s.value);
    if (s.key === 'attendance_threshold_low') map.low = parseFloat(s.value);
  });
  return map;
};

// 2. Categorize Attendance
const categorizeAttendance = (percentage, thresholds) => {
  if (percentage >= thresholds.good) return 'Good';
  if (percentage >= thresholds.medium) return 'Medium';
  if (percentage >= thresholds.low) return 'Low';
  return 'Critical';
};

// Helpers for file parsing
const getCellValue = (cell) => {
  if (!cell) return '';
  let val = cell.value;
  if (val === undefined || val === null) return '';
  if (typeof val === 'object') {
    if (val.result !== undefined) return val.result;
    if (val.text !== undefined) return String(val.text);
    if (Array.isArray(val.richText)) return val.richText.map(t => t.text || '').join('');
    if (val instanceof Date) return val.toISOString().split('T')[0];
    if (val.formula !== undefined) return '';
  }
  if (typeof val === 'number' && cell.numFmt && String(cell.numFmt).includes('%')) return String(val * 100) + '%';
  return String(val !== undefined && val !== null ? val : '').trim();
};

const findMatchedStudent = (excelUt, allStudents) => {
  if (!excelUt) return null;
  const cleanExcel = excelUt.toString().trim();
  const lowerExcel = cleanExcel.toLowerCase();
  const alphaExcel = lowerExcel.replace(/[^a-z0-9]/g, '');
  if (!alphaExcel) return null;
  
  let match = allStudents.find(s => s.ut_no && s.ut_no.trim().toLowerCase() === lowerExcel);
  if (match) return match;
  
  const excelId = parseInt(cleanExcel, 10);
  if (!isNaN(excelId) && String(excelId) === cleanExcel) {
    match = allStudents.find(s => s.id === excelId);
    if (match) return match;
  }
  
  match = allStudents.find(s => {
    if (!s.ut_no) return false;
    const alphaDb = s.ut_no.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return alphaDb === alphaExcel;
  });
  if (match) return match;
  
  if (alphaExcel.length >= 3) {
    match = allStudents.find(s => {
      if (!s.ut_no) return false;
      const alphaDb = s.ut_no.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return alphaDb.endsWith(alphaExcel) || alphaExcel.endsWith(alphaDb);
    });
    if (match) return match;
  }
  return null;
};

const parseExcel = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Excel file is empty');

  const records = [];
  let headerRowIndex = 1;
  let headersFound = false;

  for (let r = 1; r <= 10; r++) {
    const row = worksheet.getRow(r);
    const values = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      values.push(getCellValue(cell).trim().toLowerCase());
    });
    if (values.some(v => v.includes('ut no') || v.includes('ut_no') || v.includes('utnumber') || v.includes('ut number') || v.includes('student id') || v.includes('student_id')) && 
        values.some(v => v.includes('attendance') || v.includes('%') || v.includes('percent'))) {
      headerRowIndex = r;
      headersFound = true;
      break;
    }
  }

  if (!headersFound) throw new Error('Could not find required headers (UT No, Attendance %) in Excel.');

  const headerRow = worksheet.getRow(headerRowIndex);
  const headerMap = {};
  headerRow.eachCell((cell, colNumber) => {
    const headerVal = getCellValue(cell).trim().toLowerCase();
    if (headerVal) headerMap[headerVal] = colNumber;
  });

  const getCol = (names) => {
    for (const name of names) {
      const match = Object.keys(headerMap).find(k => k.includes(name));
      if (match) return headerMap[match];
    }
    return null;
  };

  const utCol = getCol(['ut no', 'ut_no', 'utno', 'ut number', 'student id', 'student_id']);
  const attCol = getCol(['attendance', 'percent', '%']);

  if (!utCol || !attCol) throw new Error('Missing UT No or Attendance % column in Excel.');

  const totalRows = worksheet.rowCount;
  for (let rowNumber = headerRowIndex + 1; rowNumber <= totalRows; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const utNo = getCellValue(row.getCell(utCol)).trim();
    let attVal = getCellValue(row.getCell(attCol)).trim();

    if (utNo) {
      const hasPercentSign = attVal.includes('%');
      attVal = attVal.replace(/%/g, '');
      let percentage = parseFloat(attVal);
      if (!isNaN(percentage)) {
        if (!hasPercentSign && percentage >= 0 && percentage <= 1) percentage = percentage * 100;
        records.push({ utNo, attendancePercentage: Math.round(percentage), rowNumber });
      }
    }
  }
  return records;
};

// API: Upload Attendance Excel
exports.uploadAttendance = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded or file format is invalid.' });
  const { month, year } = req.body;
  if (!month || !year) return res.status(400).json({ message: 'Month and Year are required.' });

  try {
    const ext = req.file.originalname.split('.').pop().toLowerCase();
    let records = [];

    if (ext === 'xlsx' || ext === 'xls') records = await parseExcel(req.file.buffer);
    else return res.status(400).json({ message: 'Only Excel formats supported for now.' });

    if (records.length === 0) return res.status(400).json({ message: 'No valid attendance records found in the file.' });

    const cleanMonth = month.trim();
    const cleanYear = Number(year);
    const thresholds = await getThresholds();
    const { data: allStudents } = await supabaseAdmin.from('students').select('id, ut_no, full_name');

    let updatedCount = 0;
    let notFoundCount = 0;
    const unmatchedRecords = [];

    for (const record of records) {
      const matchedStudent = findMatchedStudent(record.utNo, allStudents);
      if (matchedStudent) {
        const status = categorizeAttendance(record.attendancePercentage, thresholds);

        // Delete existing history
        await supabaseAdmin.from('attendance_history')
          .delete()
          .eq('student_id', matchedStudent.id)
          .eq('month', cleanMonth)
          .eq('year', cleanYear);

        // Insert new history
        const { error: historyError } = await supabaseAdmin.from('attendance_history').insert({
          student_id: matchedStudent.id,
          month: cleanMonth,
          year: cleanYear,
          attendance_percentage: record.attendancePercentage,
          status,
          uploaded_file: req.file.originalname
        });
        
        if (!historyError) updatedCount++;
      } else {
        unmatchedRecords.push(record.utNo);
        notFoundCount++;
      }
    }

    if (adminCache) adminCache.flushAll();

    return res.status(200).json({
      message: `Attendance processing complete. Updated ${updatedCount} students.`,
      updated: updatedCount,
      notFound: notFoundCount,
      unmatched: unmatchedRecords
    });
  } catch (error) {
    console.error('Attendance Upload Error:', error);
    return res.status(500).json({ message: 'Error processing attendance file: ' + error.message });
  }
};

// API: Manual Entry
exports.manualEntry = async (req, res) => {
  const { student_id, month, year, percentage } = req.body;
  if (!student_id || !month || !year || percentage === undefined) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  try {
    const thresholds = await getThresholds();
    const status = categorizeAttendance(parseFloat(percentage), thresholds);

    await supabaseAdmin.from('attendance_history')
      .delete()
      .eq('student_id', student_id)
      .eq('month', month)
      .eq('year', year);

    const { error } = await supabaseAdmin.from('attendance_history').insert({
      student_id, month, year, attendance_percentage: percentage, status, uploaded_file: 'Manual Entry'
    });

    if (error) throw error;
    if (adminCache) adminCache.flushAll();

    return res.status(200).json({ message: 'Manual attendance saved successfully.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error saving manual attendance.' });
  }
};

// API: Get History
exports.getHistory = async (req, res) => {
  const { student_id } = req.query;
  try {
    let query = supabaseAdmin.from('attendance_history').select('*, students(full_name, ut_no)');
    if (student_id) query = query.eq('student_id', student_id);
    
    const { data, error } = await query.order('year', { ascending: false }).order('month', { ascending: false });
    if (error) throw error;

    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching history.' });
  }
};

exports.clearAttendance = async (req, res) => {
  const { month, year } = req.body;
  try {
    const { data: result, error } = await supabaseAdmin.from('attendance_history')
      .delete()
      .eq('month', month)
      .eq('year', year)
      .select('id');
      
    if (error) throw error;
    if (adminCache) adminCache.flushAll();
    
    return res.status(200).json({ message: `Successfully cleared ${result.length} records.` });
  } catch (error) {
    return res.status(500).json({ message: 'Error clearing attendance data.' });
  }
};
