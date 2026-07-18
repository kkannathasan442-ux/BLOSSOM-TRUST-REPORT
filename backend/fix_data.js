require('dotenv').config();
const supabase = require('./src/models/supabaseClient');

const fixAttendanceData = async () => {
  console.log('Starting data synchronization for previously uploaded attendance records...');
  
  // 1. Fetch all students who have an attendance percentage but might have a missing/incorrect low_attendance_status
  const { data: students, error } = await supabase
    .from('students')
    .select('id, attendance_percentage, low_attendance_status')
    .not('attendance_percentage', 'is', null);

  if (error) {
    console.error('Error fetching students:', error);
    process.exit(1);
  }

  console.log(`Found ${students.length} students with attendance data. Validating...`);

  let updatedCount = 0;
  
  for (const student of students) {
    // Default threshold used in the system is typically 80 or 75. 
    // We will use < 80 as a safe re-sync default based on the UI's default state.
    const shouldBeLow = student.attendance_percentage < 80;
    
    // If the database has a mismatch, we fix it
    if (student.low_attendance_status !== shouldBeLow) {
      const { error: updateError } = await supabase
        .from('students')
        .update({ low_attendance_status: shouldBeLow })
        .eq('id', student.id);
        
      if (!updateError) {
        updatedCount++;
      } else {
        console.error(`Failed to update student ${student.id}`, updateError);
      }
    }
  }

  console.log(`Synchronization Complete! Corrected ${updatedCount} records that had broken UI logic.`);
  process.exit(0);
};

fixAttendanceData();
