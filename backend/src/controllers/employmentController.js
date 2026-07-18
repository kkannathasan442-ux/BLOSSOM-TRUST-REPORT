const { admin: supabaseAdmin } = require('../lib/supabaseClient');

exports.addEmployment = async (req, res) => {
  const { student_id, status, company_name, salary, employment_date, promotion_history } = req.body;
  if (!student_id || !status) {
    return res.status(400).json({ message: 'Student ID and Status are required.' });
  }

  try {
    const { error } = await supabaseAdmin.from('employment_history').insert({
      student_id,
      status,
      company_name: company_name || null,
      salary: salary ? parseFloat(salary) : null,
      employment_date: employment_date || null,
      promotion_history: promotion_history || null
    });

    if (error) throw error;
    return res.status(201).json({ message: 'Employment history added successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error adding employment history.' });
  }
};

exports.getEmploymentHistory = async (req, res) => {
  const { student_id } = req.query;
  try {
    let query = supabaseAdmin.from('employment_history').select('*, students(full_name, ut_no)');
    if (student_id) query = query.eq('student_id', student_id);
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching employment history.' });
  }
};
