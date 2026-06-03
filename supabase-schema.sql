-- ═══════════════════════════════════════════════════════════════
--  NOVAHFALCONS CLIENT PORTAL — Supabase Schema
--  Run this in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Profiles (extends Supabase auth.users) ────────────────────
CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    TEXT NOT NULL,
  company_name TEXT,
  phone        TEXT,
  avatar       TEXT DEFAULT 'XX',
  role         TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin','client')),
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins see all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role, avatar)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    UPPER(LEFT(COALESCE(NEW.raw_user_meta_data->>'full_name', 'XX'), 2))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Projects ──────────────────────────────────────────────────
CREATE TABLE projects (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code           TEXT NOT NULL UNIQUE,
  client_id      UUID NOT NULL REFERENCES profiles(id),
  manager_id     UUID NOT NULL REFERENCES profiles(id),
  service_id     UUID,
  title          TEXT NOT NULL,
  description    TEXT,
  stage          SMALLINT DEFAULT 1 CHECK (stage BETWEEN 1 AND 18),
  progress       SMALLINT DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  risk           TEXT DEFAULT 'low' CHECK (risk IN ('low','medium','high')),
  status         TEXT DEFAULT 'active' CHECK (status IN ('active','completed','paused','cancelled')),
  contract_value NUMERIC(12,2) DEFAULT 0,
  advance_paid   NUMERIC(12,2) DEFAULT 0,
  balance_due    NUMERIC(12,2) DEFAULT 0,
  start_date     DATE,
  estimated_end  DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access projects" ON projects FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Clients see own projects" ON projects FOR SELECT USING (client_id = auth.uid());

-- ── Services ──────────────────────────────────────────────────
CREATE TABLE services (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category    TEXT, tier TEXT, name TEXT NOT NULL,
  description TEXT, price NUMERIC(12,2),
  price_type  TEXT DEFAULT 'fixed', features JSONB,
  is_active   BOOLEAN DEFAULT TRUE, sort_order INT DEFAULT 0
);
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone reads services" ON services FOR SELECT USING (TRUE);
CREATE POLICY "Admins manage services" ON services FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ── Invoices ──────────────────────────────────────────────────
CREATE TABLE invoices (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_no   TEXT NOT NULL UNIQUE,
  project_id   UUID NOT NULL REFERENCES projects(id),
  client_id    UUID NOT NULL REFERENCES profiles(id),
  subtotal     NUMERIC(12,2) DEFAULT 0, discount_pct NUMERIC(5,2) DEFAULT 0,
  tax_pct      NUMERIC(5,2) DEFAULT 18,  tax_amount   NUMERIC(12,2) DEFAULT 0,
  total        NUMERIC(12,2) DEFAULT 0,
  advance_pct  NUMERIC(5,2) DEFAULT 50,  advance_due  NUMERIC(12,2) DEFAULT 0,
  balance_due  NUMERIC(12,2) DEFAULT 0,
  status       TEXT DEFAULT 'draft', due_date DATE, notes TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access invoices" ON invoices FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Clients see own invoices" ON invoices FOR SELECT USING (client_id = auth.uid());

-- ── Payments ──────────────────────────────────────────────────
CREATE TABLE payments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id   UUID NOT NULL REFERENCES projects(id),
  client_id    UUID NOT NULL REFERENCES profiles(id),
  invoice_id   UUID REFERENCES invoices(id),
  amount       NUMERIC(12,2) NOT NULL,
  payment_type TEXT, slip_url TEXT, reference TEXT, notes TEXT,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at  TIMESTAMPTZ, reviewed_by UUID REFERENCES profiles(id)
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access payments" ON payments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Clients see own payments" ON payments FOR SELECT USING (client_id = auth.uid());
CREATE POLICY "Clients insert own payments" ON payments FOR INSERT WITH CHECK (client_id = auth.uid());

-- ── Meetings ──────────────────────────────────────────────────
CREATE TABLE meetings (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id   UUID REFERENCES projects(id),
  title        TEXT NOT NULL, platform TEXT DEFAULT 'google_meet',
  meeting_link TEXT, agenda TEXT, meeting_date DATE NOT NULL,
  meeting_time TIME NOT NULL, duration_min INT DEFAULT 60,
  status       TEXT DEFAULT 'upcoming', notes TEXT, created_by UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access meetings" ON meetings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Clients see own meetings" ON meetings FOR SELECT USING (
  project_id IN (SELECT id FROM projects WHERE client_id = auth.uid())
);

-- ── Documents ─────────────────────────────────────────────────
CREATE TABLE documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID REFERENCES projects(id),
  uploaded_by   UUID REFERENCES profiles(id),
  file_name     TEXT NOT NULL, original_name TEXT,
  file_size     INT, file_type TEXT, storage_path TEXT,
  visibility    TEXT DEFAULT 'internal' CHECK (visibility IN ('internal','client','signed')),
  status        TEXT DEFAULT 'pending',
  uploaded_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access documents" ON documents FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Clients see client-visible docs" ON documents FOR SELECT USING (
  visibility IN ('client','signed') AND
  project_id IN (SELECT id FROM projects WHERE client_id = auth.uid())
);

-- ── Messages (Realtime enabled) ───────────────────────────────
CREATE TABLE messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES profiles(id),
  message    TEXT NOT NULL,
  is_read    BOOLEAN DEFAULT FALSE,
  sent_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members read messages" ON messages FOR SELECT USING (
  project_id IN (SELECT id FROM projects WHERE client_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Project members send messages" ON messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND (
    project_id IN (SELECT id FROM projects WHERE client_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
);
-- Enable Realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ── Notifications ─────────────────────────────────────────────
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT, title TEXT, body TEXT, is_read BOOLEAN DEFAULT FALSE,
  link       TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- ── Activity Log ──────────────────────────────────────────────
CREATE TABLE activity_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action     TEXT NOT NULL, module TEXT, detail TEXT,
  logged_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read activity" ON activity_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users insert activity" ON activity_log FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── Waitlist (for Coming Soon page) ───────────────────────────
CREATE TABLE waitlist (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone inserts waitlist" ON waitlist FOR INSERT WITH CHECK (TRUE);

-- ── Seed: Services ────────────────────────────────────────────
INSERT INTO services (category, tier, name, price, price_type, features) VALUES
('Websites','Starter','Starter Website',29000,'fixed','["5-Page Responsive Website","Mobile-Optimised Design","Basic SEO & Lead Forms","WhatsApp Integration","Hosting Support"]'),
('Websites','Growth','Growth Website',49900,'fixed','["Up to 10-Page Custom Website","Advanced SEO","AI Chatbot for Lead Capture","Booking / Inquiry Systems","Priority Support"]'),
('Websites','Pro','Business Pro Website',89900,'fixed','["Unlimited Pages + E-Commerce","Full SEO + CRM Integration","AI Chatbot + Smart Routing","Advanced Analytics","Dedicated Account Manager"]'),
('Marketing','Starter','Spark Ads',12900,'monthly','["2 Platforms (FB + IG)","4 Ad Creatives / Month","Monthly Performance Report"]'),
('Marketing','Growth','Scale Ads',24900,'monthly','["4 Platforms","8 Ad Creatives / Month","A/B Testing","Retargeting Campaigns"]'),
('Marketing','Pro','Dominate Ads',49000,'monthly','["All Platforms","Unlimited Creatives","Daily Monitoring","Dedicated Ad Manager"]'),
('ERP / AI Systems','Essential','Smart Business ERP',179000,'fixed','["Core Modules: HR, Finance, Inventory","Role-Based Access","1 Year Support"]'),
('ERP / AI Systems','Professional','Smart Business ERP Pro',349000,'fixed','["AI-Powered Analytics","CRM Integration","Custom Workflows","Priority Support"]'),
('ERP / AI Systems','Enterprise','Enterprise AI ERP',750000,'fixed','["Fully Custom ERP","AI Automation Suite","API Integrations","Lifetime Support"]');

-- ── Storage Buckets (run separately if needed) ────────────────
-- INSERT INTO storage.buckets (id, name, public) VALUES ('payment-slips', 'payment-slips', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
