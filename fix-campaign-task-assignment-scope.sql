-- Hotfix: scope campaign task assignment targets
-- Campaign managers/admins can assign tasks only to Sales & Marketing or Liaison Officers.
-- Other operational roles can create tasks only for themselves.

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create tasks" ON tasks;
DROP POLICY IF EXISTS "Operational roles can create tasks" ON tasks;

CREATE POLICY "Operational roles can create tasks" ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    (
      (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('campaign_management', 'admin') AND
        (
          assigned_to IS NULL OR
          assigned_to = auth.uid() OR
          (SELECT role FROM profiles WHERE id = assigned_to) IN ('marketing_sales', 'liaison_officer')
        )
      )
      OR
      (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('marketing_sales', 'liaison_officer', 'compliance_reviewer') AND
        (assigned_to IS NULL OR assigned_to = auth.uid())
      )
    )
  );
