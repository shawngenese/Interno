-- Supabase Storage RLS Policies for Interno
-- Run this migration on deploy to enforce storage security.
-- Mirrors Firebase Storage rules (storage.rules) for C2 strategy.
-- Storage buckets: documents, tasks, profiles

-- ============================================
-- Helper: extract user role from JWT
-- ============================================
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role',
    ''
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS text AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'companyId',
    ''
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================
-- Documents Bucket Policies
-- ============================================
CREATE POLICY "documents_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND (
      public.user_role() = 'admin'
      OR (
        auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = public.user_company_id()
      )
    )
  );

CREATE POLICY "documents_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
    AND (
      public.user_role() = 'admin'
      OR (storage.foldername(name))[1] = public.user_company_id()
    )
  );

CREATE POLICY "documents_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
    AND (
      public.user_role() = 'admin'
      OR (storage.foldername(name))[1] = public.user_company_id()
    )
  );

CREATE POLICY "documents_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
    AND (
      public.user_role() = 'admin'
      OR (
        public.user_role() = 'trainee'
        AND (storage.foldername(name))[1] = public.user_company_id()
      )
    )
  );

-- ============================================
-- Tasks Bucket Policies
-- ============================================
CREATE POLICY "tasks_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'tasks'
    AND (
      public.user_role() = 'admin'
      OR (
        auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = public.user_company_id()
      )
    )
  );

CREATE POLICY "tasks_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'tasks'
    AND auth.role() = 'authenticated'
    AND (
      public.user_role() = 'admin'
      OR (storage.foldername(name))[1] = public.user_company_id()
    )
  );

CREATE POLICY "tasks_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'tasks'
    AND auth.role() = 'authenticated'
    AND (
      public.user_role() = 'admin'
      OR (storage.foldername(name))[1] = public.user_company_id()
    )
  );

CREATE POLICY "tasks_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'tasks'
    AND auth.role() = 'authenticated'
    AND (
      public.user_role() = 'admin'
      OR public.user_role() = 'supervisor'
      OR (storage.foldername(name))[1] = public.user_company_id()
    )
  );

-- ============================================
-- Profiles Bucket Policies
-- ============================================
CREATE POLICY "profiles_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'profiles'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "profiles_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'profiles'
    AND auth.role() = 'authenticated'
    AND (
      public.user_role() = 'admin'
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

CREATE POLICY "profiles_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'profiles'
    AND auth.role() = 'authenticated'
    AND (
      public.user_role() = 'admin'
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

CREATE POLICY "profiles_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'profiles'
    AND auth.role() = 'authenticated'
    AND (
      public.user_role() = 'admin'
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );
