-- Blossom Trust Migration SQL
-- Run these commands in the Supabase SQL Editor to update your table to the hybrid structure.

-- 1. Add blossom_trust_amount column if it doesn't exist
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS blossom_trust_amount NUMERIC DEFAULT 0;

-- 2. Add branch_name column if it doesn't exist
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS branch_name TEXT;

-- 3. Copy existing branch data to branch_name for backward compatibility
UPDATE public.students SET branch_name = branch WHERE branch_name IS NULL AND branch IS NOT NULL;

-- 4. Add new attendance tracking and dropout columns
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS attendance_percentage NUMERIC;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS low_attendance_status BOOLEAN DEFAULT FALSE;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS last_attendance_month TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS dropout_status BOOLEAN DEFAULT FALSE;

-- 5. Create Attendance History Table
CREATE TABLE IF NOT EXISTS public.attendance_history (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  year INTEGER NOT NULL,
  attendance_percentage NUMERIC,
  uploaded_file TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Add course_specialization, employment_status, other_status columns to students table
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS course_specialization TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS employment_status TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS other_status TEXT;

-- 7. Add email column to students table (for Non-Blossom students)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS email TEXT;

-- 8. Add course_completion_status column to students table
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS course_completion_status TEXT CHECK(course_completion_status IN ('Completed', 'In Progress', 'Not Started'));


