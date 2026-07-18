-- Blossom Trust EMP - Supabase PostgreSQL Schema (BRD v4.0)

-- ==========================================
-- 1. ENUMS & CUSTOM TYPES
-- ==========================================
CREATE TYPE role_type AS ENUM ('student', 'admin');
CREATE TYPE student_type_enum AS ENUM ('blossom', 'non_blossom');
CREATE TYPE profile_status_enum AS ENUM ('draft', 'submitted', 'pending_review', 'approved', 'locked', 'edit_request', 'reopened');
CREATE TYPE course_enum AS ENUM ('Full Stack Developer', 'Front End Developer');
CREATE TYPE attendance_status_enum AS ENUM ('Good', 'Medium', 'Low', 'Critical');
CREATE TYPE employment_status_enum AS ENUM ('Employed', 'Unemployed', 'Higher Studies', 'Foreign Employment');
CREATE TYPE edit_request_status AS ENUM ('pending', 'approved', 'rejected');

-- ==========================================
-- 2. CORE TABLES
-- ==========================================

-- USERS
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role role_type NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ADMIN SETTINGS
CREATE TABLE public.admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- STUDENTS
CREATE TABLE public.students (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  ut_no TEXT UNIQUE NOT NULL,
  nic_number TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  
  -- Personal Info
  full_name TEXT,
  phone_number TEXT,
  district TEXT,
  photo_url TEXT,
  
  -- Academic Info
  student_type student_type_enum NOT NULL DEFAULT 'blossom',
  course_name course_enum,
  course_specialization TEXT,
  batch TEXT,
  batch_year INTEGER,
  course_completion_status TEXT CHECK(course_completion_status IN ('Completed', 'In Progress', 'Not Started')),
  
  -- Blossom Trust Specific Info (Funding)
  bank_name TEXT,
  branch_name TEXT,
  branch_code TEXT,
  account_no TEXT,
  beneficiary_name TEXT,
  blossom_trust_amount NUMERIC DEFAULT 0,
  
  -- Workflow
  profile_status profile_status_enum DEFAULT 'draft',
  
  -- Flags
  dropout_status BOOLEAN DEFAULT FALSE,
  dropout_reason TEXT,
  dropout_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- STUDENT DOCUMENTS
CREATE TABLE public.student_documents (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- e.g., 'nic_front', 'nic_back', 'certificate'
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ATTENDANCE HISTORY
CREATE TABLE public.attendance_history (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  year INTEGER NOT NULL,
  attendance_percentage NUMERIC NOT NULL,
  status attendance_status_enum,
  uploaded_file TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, month, year)
);

-- EMPLOYMENT HISTORY
CREATE TABLE public.employment_history (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status employment_status_enum NOT NULL,
  company_name TEXT,
  salary NUMERIC,
  employment_date DATE,
  promotion_history TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BENEFICIARY PAYMENTS (Funding Management)
CREATE TABLE public.beneficiary_payments (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL,
  reference_number TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- EDIT REQUESTS
CREATE TABLE public.edit_requests (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  request_reason TEXT NOT NULL,
  status edit_request_status DEFAULT 'pending',
  admin_remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id TEXT,
  prev_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ACTIVITY LOGS
CREATE TABLE public.activity_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LOGIN HISTORY
CREATE TABLE public.login_history (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  login_time TIMESTAMPTZ DEFAULT NOW()
);

-- REPORT HISTORY
CREATE TABLE public.report_history (
  id SERIAL PRIMARY KEY,
  admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL,
  filters JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ==========================================
-- 3. INDEXES
-- ==========================================
CREATE INDEX idx_student_ut_no ON public.students(ut_no);
CREATE INDEX idx_student_nic ON public.students(nic_number);
CREATE INDEX idx_student_type ON public.students(student_type);
CREATE INDEX idx_student_district ON public.students(district);
CREATE INDEX idx_student_status ON public.students(profile_status);
CREATE INDEX idx_attendance_student ON public.attendance_history(student_id);
CREATE INDEX idx_employment_student ON public.employment_history(student_id);
CREATE INDEX idx_payments_student ON public.beneficiary_payments(student_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);


-- ==========================================
-- 4. TRIGGERS (Updated_At)
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_modtime BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_students_modtime BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_attendance_modtime BEFORE UPDATE ON public.attendance_history FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_employment_modtime BEFORE UPDATE ON public.employment_history FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_editreq_modtime BEFORE UPDATE ON public.edit_requests FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_settings_modtime BEFORE UPDATE ON public.admin_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();


-- ==========================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ==========================================
-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Policies for USERS
CREATE POLICY "Users can view their own record" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all users" ON public.users FOR ALL USING (is_admin());

-- Policies for STUDENTS
CREATE POLICY "Students can view their own profile" ON public.students FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Students can update their own profile if not locked" ON public.students FOR UPDATE 
  USING (auth.uid() = user_id AND profile_status IN ('draft', 'reopened', 'edit_request'))
  WITH CHECK (auth.uid() = user_id AND profile_status IN ('draft', 'reopened', 'edit_request', 'submitted'));
CREATE POLICY "Admins can do everything on students" ON public.students FOR ALL USING (is_admin());

-- Policies for ATTENDANCE, EMPLOYMENT, PAYMENTS, DOCUMENTS
CREATE POLICY "Students can view own attendance" ON public.attendance_history FOR SELECT USING (
  student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);
CREATE POLICY "Admins manage attendance" ON public.attendance_history FOR ALL USING (is_admin());

CREATE POLICY "Students can view own employment" ON public.employment_history FOR SELECT USING (
  student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);
CREATE POLICY "Admins manage employment" ON public.employment_history FOR ALL USING (is_admin());

CREATE POLICY "Students can view own payments" ON public.beneficiary_payments FOR SELECT USING (
  student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);
CREATE POLICY "Admins manage payments" ON public.beneficiary_payments FOR ALL USING (is_admin());

-- Policies for EDIT REQUESTS
CREATE POLICY "Students can view and create own edit requests" ON public.edit_requests FOR SELECT USING (
  student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);
CREATE POLICY "Students can create own edit requests" ON public.edit_requests FOR INSERT WITH CHECK (
  student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);
CREATE POLICY "Admins manage edit requests" ON public.edit_requests FOR ALL USING (is_admin());

-- Policies for NOTIFICATIONS
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can insert notifications" ON public.notifications FOR INSERT WITH CHECK (is_admin());

-- Policies for ADMIN SETTINGS
CREATE POLICY "Admins can manage settings" ON public.admin_settings FOR ALL USING (is_admin());
CREATE POLICY "Admins can read settings" ON public.admin_settings FOR SELECT USING (is_admin());

-- ==========================================
-- 6. DEFAULT DATA
-- ==========================================
INSERT INTO public.admin_settings (key, value) VALUES 
('attendance_threshold_good', '90'),
('attendance_threshold_medium', '80'),
('attendance_threshold_low', '65'),
('report_branding_name', 'Blossom Trust')
ON CONFLICT (key) DO NOTHING;
