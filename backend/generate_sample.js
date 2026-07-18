const ExcelJS = require('exceljs');
const path = require('path');

async function generateSample() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Students');

  // Core student fields only - admin fields updated later through system UI
  sheet.addRow([
    'UT No',
    'Full Name',
    'Phone Number',
    'NIC Number',
    'District',
    'Bank Name',
    'Branch Name',
    'Branch Code',
    'Account Number',
    'Beneficiary Name',
    'Blossom Trust Amount'
  ]);

  // Plain sample data rows
  const students = [
    ['TIC-2026-001', 'Kasun Perera',        '0771234567', '199012345678', 'Colombo',      'Bank of Ceylon',  'Colombo Main Branch',  '001', '12345678901', 'Kasun Perera',        15000],
    ['TIC-2026-002', 'Nimasha Silva',        '0712345678', '199512367890', 'Gampaha',      'Peoples Bank',    'Gampaha Branch',       '045', '98765432101', 'Nimasha Silva',       12000],
    ['TIC-2026-003', 'Ravindu Fernando',     '0761234567', '200001234567', 'Kandy',        'Sampath Bank',    'Kandy City Branch',    '012', '11223344556', 'Ravindu Fernando',    18000],
    ['TIC-2026-004', 'Sanduni Jayawardena',  '0751234567', '199712398760', 'Galle',        'Commercial Bank', 'Galle Branch',         '032', '55667788990', 'Sanduni Jayawardena', 10000],
    ['TIC-2026-005', 'Nuwan Bandara',        '0781234567', '200205671234', 'Kurunegala',   'HNB',             'Kurunegala Branch',    '067', '33445566778', 'Nuwan Bandara',       20000],
    ['TIC-2026-006', 'Thilini Rathnayake',   '0721234567', '199809876543', 'Matara',       'NSB',             'Matara Branch',        '028', '22334455667', 'Thilini Rathnayake',  11000],
    ['TIC-2026-007', 'Chamara Wickrama',     '0741234567', '199511234567', 'Ratnapura',    'Bank of Ceylon',  'Ratnapura Branch',     '071', '44556677889', 'Chamara Wickrama',    16000],
    ['TIC-2026-008', 'Dilini Madushanka',    '0771112233', '200112345670', 'Badulla',      'Peoples Bank',    'Badulla Branch',       '082', '99887766554', 'Dilini Madushanka',   13500],
    ['TIC-2026-009', 'Saman Kumara',         '0769876543', '199203456789', 'Anuradhapura', 'Sampath Bank',    'Anuradhapura Branch',  '025', '11223355779', 'Saman Kumara',        14000],
    ['TIC-2026-010', 'Lakmali Dissanayake',  '0759876543', '200308765432', 'Trincomalee',  'HNB',             'Trincomalee Branch',   '056', '77889900112', 'Lakmali Dissanayake', 17000],
  ];

  students.forEach(row => sheet.addRow(row));

  const outputPath = path.join(__dirname, '..', 'Sample_Student_Bulk_Upload.xlsx');
  await workbook.xlsx.writeFile(outputPath);
  console.log('✅ Clean sample file created at:', outputPath);
}

generateSample().catch(console.error);
