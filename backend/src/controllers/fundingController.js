const { admin: supabaseAdmin } = require('../lib/supabaseClient');

exports.addPayment = async (req, res) => {
  const { student_id, amount, payment_date, reference_number, remarks } = req.body;
  if (!student_id || !amount || !payment_date) {
    return res.status(400).json({ message: 'Student ID, amount, and payment date are required.' });
  }

  try {
    const { error } = await supabaseAdmin.from('beneficiary_payments').insert({
      student_id,
      amount: parseFloat(amount),
      payment_date,
      reference_number: reference_number || null,
      remarks: remarks || null
    });

    if (error) throw error;
    return res.status(201).json({ message: 'Payment record added successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error adding payment record.' });
  }
};

exports.getPaymentHistory = async (req, res) => {
  const { student_id } = req.query;
  try {
    let query = supabaseAdmin.from('beneficiary_payments').select('*, students(full_name, ut_no, bank_name, account_no)');
    if (student_id) query = query.eq('student_id', student_id);
    
    const { data, error } = await query.order('payment_date', { ascending: false });
    if (error) throw error;

    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching payment history.' });
  }
};
