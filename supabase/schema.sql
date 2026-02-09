-- ============================================
-- Mercury Clone - Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES (extends auth.users)
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT DEFAULT '',
  telegram_chat_id TEXT,
  email_alerts BOOLEAN DEFAULT true,
  telegram_alerts BOOLEAN DEFAULT false,
  alert_before_hearing_hours INTEGER DEFAULT 24,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- CASES
-- ============================================
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  court_type TEXT NOT NULL CHECK (court_type IN ('SC', 'HC', 'DC', 'NCLT', 'CF')),
  court_name TEXT,
  court_code TEXT,
  state_code TEXT,
  district_code TEXT,
  case_type TEXT,
  case_type_code TEXT,
  case_number TEXT NOT NULL,
  case_year TEXT,
  cnr_number TEXT,
  case_title TEXT,
  current_status TEXT,
  next_hearing_date DATE,
  last_order_date DATE,
  last_order_summary TEXT,
  petitioner TEXT,
  respondent TEXT,
  petitioner_advocate TEXT,
  respondent_advocate TEXT,
  judges TEXT,
  filing_date DATE,
  registration_date DATE,
  decision_date DATE,
  raw_data JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT '{}',
  notes TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  last_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cases_user_id ON cases(user_id);
CREATE INDEX idx_cases_next_hearing ON cases(next_hearing_date) WHERE next_hearing_date IS NOT NULL;
CREATE INDEX idx_cases_court_type ON cases(court_type);
CREATE INDEX idx_cases_cnr ON cases(cnr_number) WHERE cnr_number IS NOT NULL;
CREATE INDEX idx_cases_active ON cases(is_active) WHERE is_active = true;

-- ============================================
-- CASE UPDATES (change history)
-- ============================================
CREATE TABLE case_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  update_type TEXT NOT NULL CHECK (update_type IN (
    'status_change', 'new_order', 'hearing_date_change',
    'listing', 'advocate_change', 'judge_change', 'new_case'
  )),
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  notified_email BOOLEAN DEFAULT false,
  notified_telegram BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_case_updates_case_id ON case_updates(case_id);

-- ============================================
-- ALERT LOG
-- ============================================
CREATE TABLE alert_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('telegram', 'email')),
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  error_details TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_alert_log_user ON alert_log(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own cases"
  ON cases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cases"
  ON cases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cases"
  ON cases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cases"
  ON cases FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own case updates"
  ON case_updates FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM cases WHERE cases.id = case_updates.case_id AND cases.user_id = auth.uid()
  ));

CREATE POLICY "Users can view own alerts"
  ON alert_log FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
