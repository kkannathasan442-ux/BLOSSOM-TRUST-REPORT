/* Supabase migration for BT‑TIC EMP (BRD v4.0) */

-- Enable pgcrypto for UUID generation
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Users table – ensure role column and constraints
-- (Assumes Supabase default auth.users table exists; we extend it via a view or direct ALTER if allowed)
alter table auth.users
  add column if not exists role text not null default 'student',
  add constraint role_check check (role in ('admin','student','reporting_admin','data_entry_admin'));

-- ------------------------------------------------------------
-- Students
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  ut_no text not null unique,
  full_name text not null,
  email text,
  student_type text not null check (student_type in ('blossom','non_blossom')),
  batch text,
  batch_year int,
  district text,
  profile_status text not null default 'draft' check (profile_status in ('draft','submitted','pending_review','approved','locked','edit_request','reopened')),
  dropout_status boolean default false,
  attendance_percentage numeric,
  low_attendance_status boolean default false,
  last_attendance_month text,
  blossom_trust_amount numeric,
  admin_col1_val text,
  admin_col2_val text,
  admin_col3_val numeric,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create index if not exists idx_students_user_id on public.students(user_id);
create index if not exists idx_students_ut_no on public.students(ut_no);

-- ------------------------------------------------------------
-- Attendance History
create table if not exists public.attendance_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  month text not null,
  year int not null,
  attendance_percentage numeric not null,
  status text not null check (status in ('Good','Medium','Low','Critical')),
  uploaded_file text,
  created_at timestamp with time zone default now()
);
create unique index if not exists uniq_attendance_student_month_year on public.attendance_history(student_id, month, year);
create index if not exists idx_attendance_student_id on public.attendance_history(student_id);

-- ------------------------------------------------------------
-- Employment History
create table if not exists public.employment_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  status text not null check (status in ('Employed','Unemployed','Higher Studies','Foreign Employment')),
  company_name text,
  salary numeric,
  employment_date date,
  promotion_history jsonb,
  created_at timestamp with time zone default now()
);
create index if not exists idx_employment_student_id on public.employment_history(student_id);

-- ------------------------------------------------------------
-- Beneficiary Payments (Funding)
create table if not exists public.beneficiary_payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  amount numeric not null,
  payment_date date not null default now(),
  created_at timestamp with time zone default now()
);
create index if not exists idx_funding_student_id on public.beneficiary_payments(student_id);

-- ------------------------------------------------------------
-- Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  body text,
  type text not null,
  is_read boolean default false,
  created_at timestamp with time zone default now()
);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_is_read on public.notifications(is_read);

-- ------------------------------------------------------------
-- Audit Logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id uuid,
  details jsonb,
  created_at timestamp with time zone default now()
);
create index if not exists idx_audit_logs_user_id on public.audit_logs(user_id);
create index if not exists idx_audit_logs_table_name on public.audit_logs(table_name);

-- ------------------------------------------------------------
-- Report History
create table if not exists public.report_history (
  id uuid primary key default gen_random_uuid(),
  generated_by uuid references auth.users(id) on delete set null,
  report_type text not null,
  filters jsonb,
  generated_at timestamp with time zone default now(),
  file_url text
);
create index if not exists idx_report_history_generated_by on public.report_history(generated_by);

-- ------------------------------------------------------------
-- Admin Settings (ensure attendance thresholds exist)
create table if not exists public.admin_settings (
  key text primary key,
  value text not null
);
insert into public.admin_settings (key, value) values
  ('attendance_threshold_good', '90'),
  ('attendance_threshold_medium', '80'),
  ('attendance_threshold_low', '65')
  on conflict (key) do nothing;

-- ------------------------------------------------------------
-- Row Level Security (RLS) Enable & Policies

-- Enable RLS on all tables
alter table public.students enable row level security;
alter table public.attendance_history enable row level security;
alter table public.employment_history enable row level security;
alter table public.beneficiary_payments enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.report_history enable row level security;

-- Helper function public.is_admin(uid) is assumed to exist and return boolean for role = 'admin'

-- Students policies
create policy "students select own or admin"
  on public.students for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy "students insert own or admin"
  on public.students for insert
  with check (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy "students update own or admin"
  on public.students for update
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy "students delete admin only"
  on public.students for delete
  using (public.is_admin(auth.uid()));

-- Attendance policies (owner = student_id -> student.user_id)
create policy "attendance select own or admin"
  on public.attendance_history for select
  using (exists (select 1 from public.students s where s.id = student_id and (auth.uid() = s.user_id or public.is_admin(auth.uid())));

create policy "attendance insert own or admin"
  on public.attendance_history for insert
  with check (exists (select 1 from public.students s where s.id = student_id and (auth.uid() = s.user_id or public.is_admin(auth.uid())));

create policy "attendance update own or admin"
  on public.attendance_history for update
  using (exists (select 1 from public.students s where s.id = student_id and (auth.uid() = s.user_id or public.is_admin(auth.uid())));

create policy "attendance delete admin only"
  on public.attendance_history for delete
  using (public.is_admin(auth.uid()));

-- Employment policies (same pattern)
create policy "employment select own or admin"
  on public.employment_history for select
  using (exists (select 1 from public.students s where s.id = student_id and (auth.uid() = s.user_id or public.is_admin(auth.uid())));

create policy "employment insert own or admin"
  on public.employment_history for insert
  with check (exists (select 1 from public.students s where s.id = student_id and (auth.uid() = s.user_id or public.is_admin(auth.uid())));

create policy "employment update own or admin"
  on public.employment_history for update
  using (exists (select 1 from public.students s where s.id = student_id and (auth.uid() = s.user_id or public.is_admin(auth.uid())));

create policy "employment delete admin only"
  on public.employment_history for delete
  using (public.is_admin(auth.uid()));

-- Funding (beneficiary_payments) policies
create policy "funding select own or admin"
  on public.beneficiary_payments for select
  using (exists (select 1 from public.students s where s.id = student_id and (auth.uid() = s.user_id or public.is_admin(auth.uid())));

create policy "funding insert own or admin"
  on public.beneficiary_payments for insert
  with check (exists (select 1 from public.students s where s.id = student_id and (auth.uid() = s.user_id or public.is_admin(auth.uid())));

create policy "funding update own or admin"
  on public.beneficiary_payments for update
  using (exists (select 1 from public.students s where s.id = student_id and (auth.uid() = s.user_id or public.is_admin(auth.uid())));

create policy "funding delete admin only"
  on public.beneficiary_payments for delete
  using (public.is_admin(auth.uid()));

-- Notifications policies (user‑specific)
create policy "notifications select own"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "notifications insert own"
  on public.notifications for insert
  with check (auth.uid() = user_id);

create policy "notifications update own"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "notifications delete admin only"
  on public.notifications for delete
  using (public.is_admin(auth.uid()));

-- Audit logs policies (admin read, any write)
create policy "audit logs select admin"
  on public.audit_logs for select
  using (public.is_admin(auth.uid()));

create policy "audit logs insert any"
  on public.audit_logs for insert
  with check (true);

-- Report history policies (owner or admin)
create policy "report history select own or admin"
  on public.report_history for select
  using (auth.uid() = generated_by or public.is_admin(auth.uid()));

create policy "report history insert own"
  on public.report_history for insert
  with check (auth.uid() = generated_by);

create policy "report history delete admin only"
  on public.report_history for delete
  using (public.is_admin(auth.uid()));

-- End of migration
