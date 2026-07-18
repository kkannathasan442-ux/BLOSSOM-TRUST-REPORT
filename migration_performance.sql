-- Performance Optimization Migration Script
-- Run this in your Supabase SQL Editor to improve sorting and filtering performance
-- for the Admin Dashboard and Report Generation.

-- 1. Index for default dashboard sorting
CREATE INDEX IF NOT EXISTS idx_student_blossom_amt ON public.students(blossom_trust_amount);

-- 2. Indices for Dropout Report queries
CREATE INDEX IF NOT EXISTS idx_student_dropout_status ON public.students(dropout_status);
CREATE INDEX IF NOT EXISTS idx_student_dropout_date ON public.students(dropout_date);

-- 3. Indices for Low Attendance Report queries
CREATE INDEX IF NOT EXISTS idx_student_low_att_status ON public.students(low_attendance_status);
CREATE INDEX IF NOT EXISTS idx_student_last_att_month ON public.students(last_attendance_month);

-- Optional: If you filter frequently by specific string matching, consider a trigram index, 
-- but these standard B-tree indices are enough to eliminate full table scans for sorting.
