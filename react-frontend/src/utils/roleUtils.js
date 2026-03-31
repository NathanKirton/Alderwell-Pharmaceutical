// Normalize role aliases from DB/profile values to a canonical role key.
export const normalizeRole = (role) => {
  const normalized = String(role || '').trim().toLowerCase()

  const aliasMap = {
    marketing_sales: 'marketing_sales',
    'marketing & sales': 'marketing_sales',
    marketing_and_sales: 'marketing_sales',
    compliance_reviewer: 'compliance_reviewer',
    campaign_management: 'campaign_management',
    campaign_manager: 'campaign_management',
    liaison_officer: 'liaison_officer',
    no_role: 'no_role',
    admin: 'admin',
  }

  return aliasMap[normalized] || normalized || 'no_role'
}

// Maps user roles to their dashboard routes
export const getRoleDashboardPath = (role) => {
  const normalizedRole = normalizeRole(role)
  const rolePathMap = {
    admin: '/admin',
    marketing_sales: '/marketing-sales',
    compliance_reviewer: '/compliance-reviewer',
    campaign_management: '/campaign-management',
    liaison_officer: '/liaison-officer',
    no_role: '/no-access',
  }

  return rolePathMap[normalizedRole] || '/no-access'
}
