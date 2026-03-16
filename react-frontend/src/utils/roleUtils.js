// Maps user roles to their dashboard routes
export const getRoleDashboardPath = (role) => {
  const rolePathMap = {
    admin: '/admin',
    marketing_sales: '/marketing-sales',
    compliance_reviewer: '/compliance-reviewer',
    campaign_management: '/campaign-management',
    liaison_officer: '/liaison-officer',
    no_role: '/no-access',
  }

  return rolePathMap[role] || '/no-access'
}
