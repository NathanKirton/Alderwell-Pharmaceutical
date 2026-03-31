import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { supabase } from '../../services/supabaseClient'
import { auditQueries, campaignQueries, materialQueries, taskQueries, visitQueries } from '../../services/supabaseHelpers'
import Topbar from '../Layout/Topbar'
import Avatar from '../Shared/Avatar'
import styles from './Admin.module.css'

const ADMIN_TABS = [
  { id: 'user-management', label: 'User Management' },
  { id: 'campaigns', label: 'Campaign Management' },
  { id: 'tasks', label: 'Tasks Oversight' },
  { id: 'visits', label: 'Visit Logs' },
  { id: 'compliance', label: 'Compliance Oversight' },
  { id: 'activity-logs', label: 'Activity Logs' },
  { id: 'system-settings', label: 'System Settings' },
]

const ADMIN_TAB_INTENTS = {
  'user-management': 'Assign roles and maintain profile quality so each user sees the correct workspace.',
  campaigns: 'Oversee campaign setup and lifecycle state across the organisation.',
  tasks: 'Monitor cross-role task progression, ownership, and overdue work.',
  visits: 'Audit visit activity and outcomes recorded by liaison teams.',
  compliance: 'Review material approvals and compliance-sensitive workflows.',
  'activity-logs': 'Trace system actions for auditability and incident review.',
  'system-settings': 'Control platform-level defaults and operational guardrails.',
}

const ROLES = [
  { value: 'no_role', label: 'No Role' },
  { value: 'admin', label: 'Admin' },
  { value: 'marketing_sales', label: 'Marketing & Sales' },
  { value: 'compliance_reviewer', label: 'Compliance Reviewer' },
  { value: 'campaign_management', label: 'Campaign Management' },
  { value: 'liaison_officer', label: 'Liaison Officer' },
]

const ROLE_LABEL_MAP = ROLES.reduce((acc, role) => {
  acc[role.value] = role.label
  return acc
}, {})

const CAMPAIGN_STATUSES = ['Planning', 'Active', 'On Hold', 'Archived']

const normalize = (value) => String(value || '').toLowerCase()

export default function Admin() {
  const [users, setUsers] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [activityLogs, setActivityLogs] = useState([])
  const [status, setStatus] = useState('Loading...')
  const [statusType, setStatusType] = useState('info')
  const [loading, setLoading] = useState(true)
  const [savingUserId, setSavingUserId] = useState(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [userSort, setUserSort] = useState('email')
  const [campaignQuery, setCampaignQuery] = useState('')
  const [campaignStatusFilter, setCampaignStatusFilter] = useState('all')
  const [submissionQuery, setSubmissionQuery] = useState('')
  const [logQuery, setLogQuery] = useState('')
  const [logTypeFilter, setLogTypeFilter] = useState('all')
  const [logActorFilter, setLogActorFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('user-management')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [dataRetention, setDataRetention] = useState('90')
  const [showCampaignForm, setShowCampaignForm] = useState(false)
  const [savingCampaignId, setSavingCampaignId] = useState(null)
  const [savingSubmissionId, setSavingSubmissionId] = useState(null)
  const [editingCampaignId, setEditingCampaignId] = useState(null)
  const [editCampaignForm, setEditCampaignForm] = useState({})
  const [allTasks, setAllTasks] = useState([])
  const [allVisits, setAllVisits] = useState([])
  const [taskQuery, setTaskQuery] = useState('')
  const [taskStatusFilter, setTaskStatusFilter] = useState('all')
  const [visitQuery, setVisitQuery] = useState('')
  const [visitOutcomeFilter, setVisitOutcomeFilter] = useState('all')
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    description: '',
    status: 'Planning',
    startDate: '',
    endDate: '',
    category: '',
  })

  const setStatusMessage = (message, type = 'info') => {
    setStatus(message)
    setStatusType(type)
  }

  const loadUsers = useCallback(async (useLoadingState = false) => {
    try {
      if (useLoadingState) {
        setLoading(true)
      }

      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, created_at, avatar_url')
        .order('email', { ascending: true })

      if (error) {
        console.error(error)
        setStatusMessage('Failed to load users.', 'error')
        return
      }

      setUsers(profiles || [])
    } catch (error) {
      console.error(error)
      setStatusMessage('An unexpected error occurred while loading users.', 'error')
    } finally {
      if (useLoadingState) {
        setLoading(false)
      }
    }
  }, [])

  const loadCampaigns = useCallback(async () => {
    const { data, error } = await campaignQueries.getAllCampaigns()
    if (error) {
      setStatusMessage(`Failed to load campaigns: ${error}`, 'error')
      return
    }
    setCampaigns(data || [])
  }, [])

  const loadSubmissions = useCallback(async () => {
    const { data, error } = await materialQueries.getPendingApprovals()
    if (error) {
      setStatusMessage(`Failed to load submissions: ${error}`, 'error')
      return
    }
    setSubmissions(data || [])
  }, [])

  const loadActivityLogs = useCallback(async () => {
    const data = await auditQueries.getActivityLogs()
    setActivityLogs(data || [])
  }, [])

  const loadSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['notification_enabled', 'data_retention_days'])

    if (error) {
      setStatusMessage('Failed to load settings.', 'error')
      return
    }

    const settingsMap = (data || []).reduce((acc, row) => {
      acc[row.setting_key] = row.setting_value
      return acc
    }, {})

    setNotificationsEnabled(settingsMap.notification_enabled !== 'false')
    setDataRetention(settingsMap.data_retention_days || '90')
  }, [])

  const loadAllTasks = useCallback(async () => {
    const data = await taskQueries.getAllTasks()
    setAllTasks(data || [])
  }, [])

  const loadAllVisits = useCallback(async () => {
    const data = await visitQueries.getAllVisits()
    setAllVisits(data || [])
  }, [])

  useEffect(() => {
    loadUsers(true)
    loadCampaigns()
    loadSubmissions()
    loadActivityLogs()
    loadSettings()
    loadAllTasks()
    loadAllVisits()
  }, [loadUsers, loadCampaigns, loadSubmissions, loadActivityLogs, loadSettings, loadAllTasks, loadAllVisits])

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const result = users.filter((user) => {
      const userRole = user.role || 'no_role'
      const matchesRole = roleFilter === 'all' || userRole === roleFilter
      const matchesQuery =
        normalizedQuery.length === 0 ||
        normalize(user.email).includes(normalizedQuery) ||
        normalize(user.full_name).includes(normalizedQuery) ||
        (ROLE_LABEL_MAP[userRole] || userRole).toLowerCase().includes(normalizedQuery)

      return matchesRole && matchesQuery
    })

    if (userSort === 'role') {
      return result.sort((a, b) => {
        const aRole = ROLE_LABEL_MAP[a.role || 'no_role'] || 'No Role'
        const bRole = ROLE_LABEL_MAP[b.role || 'no_role'] || 'No Role'
        return aRole.localeCompare(bRole)
      })
    }

    if (userSort === 'newest') {
      return result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    }

    return result.sort((a, b) => normalize(a.email).localeCompare(normalize(b.email)))
  }, [users, query, roleFilter, userSort])

  const stats = useMemo(() => {
    const total = users.length
    const admins = users.filter((user) => user.role === 'admin').length
    const noRole = users.filter((user) => !user.role || user.role === 'no_role').length
    return { total, admins, noRole }
  }, [users])

  const campaignStats = useMemo(() => {
    return {
      total: campaigns.length,
      active: campaigns.filter((campaign) => normalize(campaign.status) === 'active').length,
      onHold: campaigns.filter((campaign) => normalize(campaign.status) === 'on hold').length,
      archived: campaigns.filter((campaign) => normalize(campaign.status) === 'archived').length,
    }
  }, [campaigns])

  const filteredCampaigns = useMemo(() => {
    const q = normalize(campaignQuery).trim()
    return campaigns.filter((campaign) => {
      const matchesStatus = campaignStatusFilter === 'all' || normalize(campaign.status) === normalize(campaignStatusFilter)
      const matchesQuery = !q ||
        normalize(campaign.name).includes(q) ||
        normalize(campaign.description).includes(q) ||
        normalize(campaign.owner?.full_name).includes(q) ||
        normalize(campaign.category).includes(q)

      return matchesStatus && matchesQuery
    })
  }, [campaigns, campaignQuery, campaignStatusFilter])

  const filteredSubmissions = useMemo(() => {
    const q = normalize(submissionQuery).trim()
    if (!q) {
      return submissions
    }

    return submissions.filter((submission) => (
      normalize(submission.id).includes(q) ||
      normalize(submission.name).includes(q) ||
      normalize(submission.campaign?.name).includes(q) ||
      normalize(submission.uploaded_by?.full_name).includes(q) ||
      normalize(submission.status).includes(q)
    ))
  }, [submissions, submissionQuery])

  const filteredActivityLogs = useMemo(() => {
    const q = normalize(logQuery).trim()

    return activityLogs.filter((log) => {
      const matchesType = logTypeFilter === 'all' || normalize(log.resource_type) === normalize(logTypeFilter)
      const actor = log.user?.full_name || log.user?.email || 'System'
      const matchesActor = logActorFilter === 'all' || normalize(actor) === normalize(logActorFilter)
      const matchesQuery = !q ||
        normalize(actor).includes(q) ||
        normalize(log.action).includes(q) ||
        normalize(log.resource_type).includes(q) ||
        normalize(JSON.stringify(log.details || {})).includes(q)

      return matchesType && matchesActor && matchesQuery
    })
  }, [activityLogs, logActorFilter, logQuery, logTypeFilter])

  const availableResourceTypes = useMemo(() => {
    return [...new Set(activityLogs.map((log) => log.resource_type).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  }, [activityLogs])

  const availableActors = useMemo(() => {
    return [...new Set(activityLogs.map((log) => log.user?.full_name || log.user?.email || 'System'))].sort((a, b) => a.localeCompare(b))
  }, [activityLogs])

  const filteredTasks = useMemo(() => {
    const q = normalize(taskQuery).trim()
    return allTasks.filter((task) => {
      const matchesStatus = taskStatusFilter === 'all' || normalize(task.status) === normalize(taskStatusFilter)
      const matchesQuery = !q ||
        normalize(task.title).includes(q) ||
        normalize(task.assigned_to?.full_name).includes(q) ||
        normalize(task.created_by?.full_name).includes(q) ||
        normalize(task.status).includes(q)
      return matchesStatus && matchesQuery
    })
  }, [allTasks, taskQuery, taskStatusFilter])

  const filteredVisits = useMemo(() => {
    const q = normalize(visitQuery).trim()
    return allVisits.filter((visit) => {
      const matchesOutcome = visitOutcomeFilter === 'all' || normalize(visit.outcome) === normalize(visitOutcomeFilter)
      const matchesQuery = !q ||
        normalize(visit.hcp?.name).includes(q) ||
        normalize(visit.hcp?.organisation).includes(q) ||
        normalize(visit.officer?.full_name).includes(q) ||
        normalize(visit.visit_type).includes(q) ||
        normalize(visit.outcome).includes(q)
      return matchesOutcome && matchesQuery
    })
  }, [allVisits, visitQuery, visitOutcomeFilter])

  const visitOutcomes = useMemo(() => {
    return [...new Set(allVisits.map((v) => v.outcome).filter(Boolean))].sort()
  }, [allVisits])

  const handleRoleChange = async (userId, newRole, currentRole) => {
    if (newRole === currentRole) {
      return
    }

    const previousUsers = users
    setSavingUserId(userId)
    setStatusMessage('Updating role...', 'info')

    setUsers((prevUsers) => prevUsers.map((user) => (user.id === userId ? { ...user, role: newRole } : user)))

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) {
        throw error
      }

      setStatusMessage('Role updated successfully.', 'success')
    } catch (error) {
      console.error(error)
      setUsers(previousUsers)
      const detail = error?.message ? ` ${error.message}` : ''
      setStatusMessage(`Failed to update role. Change was rolled back.${detail}`, 'error')
    } finally {
      setSavingUserId(null)
    }
  }

  const handleResetPassword = async (email) => {
    if (!email) {
      setStatusMessage('Cannot reset password: user email is missing.', 'error')
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) {
      setStatusMessage(`Reset password failed for ${email}: ${error.message}`, 'error')
      return
    }
    setStatusMessage(`Password reset email sent to ${email}.`, 'success')
  }

  const handleDeactivateUser = async (userId) => {
    if (!window.confirm('Deactivate this user by setting role to No Role?')) {
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role: 'no_role' })
      .eq('id', userId)

    if (error) {
      setStatusMessage(`Failed to deactivate user: ${error.message}`, 'error')
      return
    }

    setStatusMessage('User deactivated (role set to No Role).', 'success')
    await loadUsers(false)
  }

  const handleDeleteUser = async (userId, email) => {
    if (!window.confirm(`Permanently delete user ${email}? This cannot be undone.`)) {
      return
    }

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (error) {
      setStatusMessage(`Failed to delete user: ${error.message}`, 'error')
      return
    }

    setStatusMessage(`User ${email} deleted.`, 'success')
    await loadUsers(false)
  }

  const handleStartEditCampaign = (campaign) => {
    setEditingCampaignId(campaign.id)
    setEditCampaignForm({
      name: campaign.name || '',
      description: campaign.description || '',
      status: campaign.status || 'Planning',
      startDate: campaign.start_date || '',
      endDate: campaign.end_date || '',
      category: campaign.category || '',
    })
  }

  const handleSaveEditCampaign = async () => {
    if (!editCampaignForm.name.trim()) {
      setStatusMessage('Campaign name is required.', 'error')
      return
    }
    setSavingCampaignId(editingCampaignId)
    const { error } = await campaignQueries.updateCampaign(editingCampaignId, {
      name: editCampaignForm.name,
      description: editCampaignForm.description,
      status: editCampaignForm.status,
      start_date: editCampaignForm.startDate || null,
      end_date: editCampaignForm.endDate || null,
      category: editCampaignForm.category || null,
    })
    if (error) {
      setStatusMessage(`Failed to update campaign: ${error}`, 'error')
      setSavingCampaignId(null)
      return
    }
    setStatusMessage('Campaign updated.', 'success')
    setEditingCampaignId(null)
    setSavingCampaignId(null)
    await loadCampaigns()
  }

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task? This cannot be undone.')) return
    const { error, mode } = await taskQueries.deleteTask(taskId)
    if (error) {
      setStatusMessage(`Failed to delete task: ${error}`, 'error')
      return
    }
    setStatusMessage(mode === 'hard_delete' ? 'Task deleted.' : 'Task removed from active views.', 'success')
    await loadAllTasks()
  }

  const handleCreateCampaign = async () => {
    if (!campaignForm.name.trim()) {
      setStatusMessage('Campaign name is required.', 'error')
      return
    }

    if (campaignForm.startDate && campaignForm.endDate && campaignForm.startDate > campaignForm.endDate) {
      setStatusMessage('Campaign end date must be after start date.', 'error')
      return
    }

    const { error } = await campaignQueries.createCampaign({
      name: campaignForm.name,
      description: campaignForm.description,
      status: campaignForm.status,
      start_date: campaignForm.startDate || null,
      end_date: campaignForm.endDate || null,
      category: campaignForm.category || null,
    })

    if (error) {
      setStatusMessage(`Failed to create campaign: ${error}`, 'error')
      return
    }

    setStatusMessage('Campaign created successfully.', 'success')
    setShowCampaignForm(false)
    setCampaignForm({
      name: '',
      description: '',
      status: 'Planning',
      startDate: '',
      endDate: '',
      category: '',
    })
    await loadCampaigns()
  }

  const handleCampaignStatusChange = async (campaignId, nextStatus) => {
    setSavingCampaignId(campaignId)
    const { error } = await campaignQueries.updateCampaignStatus(campaignId, nextStatus)
    if (error) {
      setStatusMessage(`Failed to update campaign: ${error}`, 'error')
      setSavingCampaignId(null)
      return
    }

    setStatusMessage(`Campaign ${campaignId} moved to ${nextStatus}.`, 'success')
    await loadCampaigns()
    setSavingCampaignId(null)
  }

  const handleSubmissionAction = async (materialId, statusValue) => {
    setSavingSubmissionId(materialId)
    const { error } = await materialQueries.reviewMaterial(materialId, statusValue, `Updated by admin: ${statusValue}`)
    if (error) {
      setStatusMessage(`Submission update failed: ${error}`, 'error')
      setSavingSubmissionId(null)
      return
    }

    setStatusMessage(`Submission ${materialId} marked ${statusValue}.`, 'success')
    await loadSubmissions()
    setSavingSubmissionId(null)
  }

  const handleSaveSettings = async () => {
    const payload = [
      {
        setting_key: 'notification_enabled',
        setting_value: notificationsEnabled ? 'true' : 'false',
        description: 'System notifications active',
      },
      {
        setting_key: 'data_retention_days',
        setting_value: dataRetention,
        description: 'Days to retain activity logs',
      },
    ]

    const { error } = await supabase
      .from('system_settings')
      .upsert(payload, { onConflict: 'setting_key' })

    if (error) {
      setStatusMessage(`Settings save failed: ${error.message}`, 'error')
      return
    }

    setStatusMessage('System settings saved.', 'success')
  }

  const exportLogs = () => {
    const header = ['User', 'Action', 'Timestamp', 'Details']
    const rows = filteredActivityLogs.map((log) => [
      log.user?.full_name || 'System',
      log.action,
      log.timestamp,
      JSON.stringify(log.details || {}),
    ])

    const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'activity-logs.csv'
    link.click()
    URL.revokeObjectURL(url)
    setStatusMessage('Activity logs exported.', 'success')
  }

  const statusClassName = `${styles.status} ${styles[statusType] || ''}`

  if (loading) {
    return (
      <>
        <Topbar title="Admin Panel" />
        <div className={styles.container}>
          <div className={styles.loadingState}>Loading admin data...</div>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar title="Admin Panel" />
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <div>
            <h2>System Administration</h2>
            <p className={styles.subtitle}>Manage users, campaigns, compliance, and system settings.</p>
          </div>
          <button className={styles.refreshButton} onClick={() => {
            loadUsers(false)
            loadCampaigns()
            loadSubmissions()
            loadActivityLogs()
          }} type="button">
            Refresh
          </button>
        </div>

        <section className={styles.adminGuide}>
          <p className={styles.adminGuideRole}>Admin Workspace</p>
          <h3>{ADMIN_TABS.find((tab) => tab.id === activeTab)?.label || 'Administration'}</h3>
          <p>{ADMIN_TAB_INTENTS[activeTab] || 'Use tab shortcuts below to move between administration areas.'}</p>
          <div className={styles.adminGuideActions}>
            {ADMIN_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={styles.adminGuideActionBtn}
                onClick={() => setActiveTab(tab.id)}
                disabled={activeTab === tab.id}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        <div className={styles.tabBar}>
          {ADMIN_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tabButton} ${activeTab === tab.id ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'user-management' && (
          <div className={styles.tabPane}>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span>Total Users</span>
                <strong>{stats.total}</strong>
              </div>
              <div className={styles.statCard}>
                <span>Admins</span>
                <strong>{stats.admins}</strong>
              </div>
              <div className={styles.statCard}>
                <span>Unassigned Role</span>
                <strong>{stats.noRole}</strong>
              </div>
            </div>

            <div className={styles.filtersRow}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={styles.searchInput}
                placeholder="Search by name, email, or role"
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All roles</option>
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              <select
                value={userSort}
                onChange={(e) => setUserSort(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="email">Sort: Email</option>
                <option value="role">Sort: Role</option>
                <option value="newest">Sort: Newest Users</option>
              </select>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setQuery('')
                  setRoleFilter('all')
                  setUserSort('email')
                }}
              >
                Clear
              </button>
            </div>

            <p className={styles.subtitle}>{filteredUsers.length} user(s) shown</p>

            <div className={styles.tableWrap}>
              <table className={styles.usersTable}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Current Role</th>
                    <th>Created</th>
                    <th>Change Role</th>
                    <th>Security Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className={styles.emptyState}>
                        No users match your current search or filter.
                      </td>
                    </tr>
                  )}
                  {filteredUsers.map((user) => {
                    const currentRole = user.role || 'no_role'
                    return (
                      <tr key={user.id}>
                        <td>
                          <div className={styles.userCell}>
                            <Avatar
                              name={user.full_name || user.email}
                              src={user.avatar_url || user.profile_picture_url || null}
                              size="sm"
                            />
                            <span>{user.full_name || '-'}</span>
                          </div>
                        </td>
                        <td>{user.email || '(no email)'}</td>
                        <td>
                          <span className={styles.roleBadge}>{ROLE_LABEL_MAP[currentRole] || currentRole}</span>
                        </td>
                        <td>{user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</td>
                        <td>
                          <select
                            value={currentRole}
                            onChange={(e) => handleRoleChange(user.id, e.target.value, currentRole)}
                            className={styles.roleSelect}
                            disabled={savingUserId === user.id}
                          >
                            {ROLES.map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div className={styles.actionButtonGroup}>
                            <button
                              type="button"
                              className={styles.smallBtn}
                              onClick={() => handleResetPassword(user.email)}
                            >
                              Reset PWD
                            </button>
                            <button
                              type="button"
                              className={styles.smallBtnDanger}
                              onClick={() => handleDeactivateUser(user.id)}
                            >
                              Deactivate
                            </button>
                            <button
                              type="button"
                              className={styles.smallBtnDanger}
                              onClick={() => handleDeleteUser(user.id, user.email)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'campaigns' && (
          <div className={styles.tabPane}>
            <div className={styles.panelHeader}>
              <div>
                <h3>Active & Archived Campaigns</h3>
                <p>{filteredCampaigns.length} campaign(s) shown</p>
              </div>
              <button type="button" className={styles.primaryBtn} onClick={() => setShowCampaignForm((prev) => !prev)}>
                {showCampaignForm ? 'Cancel' : '+ Create Campaign'}
              </button>
            </div>

            <div className={styles.statsGrid}>
              <div className={styles.statCard}><span>Total</span><strong>{campaignStats.total}</strong></div>
              <div className={styles.statCard}><span>Active</span><strong>{campaignStats.active}</strong></div>
              <div className={styles.statCard}><span>On Hold / Archived</span><strong>{campaignStats.onHold + campaignStats.archived}</strong></div>
            </div>

            <div className={styles.filtersRow}>
              <input
                className={styles.searchInput}
                value={campaignQuery}
                onChange={(e) => setCampaignQuery(e.target.value)}
                placeholder="Search campaigns by name, owner, category"
              />
              <select
                className={styles.filterSelect}
                value={campaignStatusFilter}
                onChange={(e) => setCampaignStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                {CAMPAIGN_STATUSES.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>{statusOption}</option>
                ))}
              </select>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setCampaignQuery('')
                  setCampaignStatusFilter('all')
                }}
              >
                Clear
              </button>
            </div>

            {showCampaignForm && (
              <div className={styles.settingsCard}>
                <h4>Create Campaign</h4>
                <div className={styles.filtersRow}>
                  <input
                    className={styles.searchInput}
                    placeholder="Campaign name"
                    value={campaignForm.name}
                    onChange={(e) => setCampaignForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                  <select
                    className={styles.filterSelect}
                    value={campaignForm.status}
                    onChange={(e) => setCampaignForm((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="Planning">Planning</option>
                    <option value="Active">Active</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
                <div className={styles.filtersRow}>
                  <input
                    className={styles.searchInput}
                    placeholder="Category"
                    value={campaignForm.category}
                    onChange={(e) => setCampaignForm((prev) => ({ ...prev, category: e.target.value }))}
                  />
                  <input
                    type="date"
                    className={styles.filterSelect}
                    value={campaignForm.startDate}
                    onChange={(e) => setCampaignForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                  <input
                    type="date"
                    className={styles.filterSelect}
                    value={campaignForm.endDate}
                    onChange={(e) => setCampaignForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
                <textarea
                  className={styles.searchInput}
                  placeholder="Description"
                  value={campaignForm.description}
                  onChange={(e) => setCampaignForm((prev) => ({ ...prev, description: e.target.value }))}
                />
                <button type="button" className={styles.primaryBtn} onClick={handleCreateCampaign}>
                  Save Campaign
                </button>
              </div>
            )}

            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Campaign ID</th>
                    <th>Campaign Name</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.length === 0 && (
                    <tr>
                      <td colSpan={6} className={styles.emptyState}>No campaigns match the current filters.</td>
                    </tr>
                  )}
                  {filteredCampaigns.map((campaign) => (
                    <React.Fragment key={campaign.id}>
                      <tr>
                        <td>{campaign.id}</td>
                        <td>{campaign.name}</td>
                        <td>{campaign.owner?.full_name || 'Unassigned'}</td>
                        <td>
                          <span className={`${styles.badge} ${styles[(campaign.status || 'planning').toLowerCase().replace(' ', '')]}`}>
                            {campaign.status}
                          </span>
                        </td>
                        <td>{campaign.start_date || '-'} → {campaign.end_date || '-'}</td>
                        <td>
                          <div className={styles.actionButtonGroup}>
                            <button
                              type="button"
                              className={styles.smallBtn}
                              onClick={() => handleStartEditCampaign(campaign)}
                            >
                              Edit
                            </button>
                            <select
                              className={styles.roleSelect}
                              value={campaign.status || 'Planning'}
                              onChange={(e) => handleCampaignStatusChange(campaign.id, e.target.value)}
                              disabled={savingCampaignId === campaign.id}
                            >
                              {CAMPAIGN_STATUSES.map((statusOption) => (
                                <option key={statusOption} value={statusOption}>{statusOption}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                      {editingCampaignId === campaign.id && (
                        <tr>
                          <td colSpan={6} className={styles.editRow}>
                            <div className={styles.settingsCard}>
                              <h4>Edit Campaign</h4>
                              <div className={styles.filtersRow}>
                                <input
                                  className={styles.searchInput}
                                  placeholder="Campaign name"
                                  value={editCampaignForm.name}
                                  onChange={(e) => setEditCampaignForm((p) => ({ ...p, name: e.target.value }))}
                                />
                                <input
                                  className={styles.searchInput}
                                  placeholder="Category"
                                  value={editCampaignForm.category}
                                  onChange={(e) => setEditCampaignForm((p) => ({ ...p, category: e.target.value }))}
                                />
                                <select
                                  className={styles.filterSelect}
                                  value={editCampaignForm.status}
                                  onChange={(e) => setEditCampaignForm((p) => ({ ...p, status: e.target.value }))}
                                >
                                  {CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </div>
                              <div className={styles.filtersRow}>
                                <input
                                  type="date"
                                  className={styles.filterSelect}
                                  value={editCampaignForm.startDate}
                                  onChange={(e) => setEditCampaignForm((p) => ({ ...p, startDate: e.target.value }))}
                                />
                                <input
                                  type="date"
                                  className={styles.filterSelect}
                                  value={editCampaignForm.endDate}
                                  onChange={(e) => setEditCampaignForm((p) => ({ ...p, endDate: e.target.value }))}
                                />
                              </div>
                              <textarea
                                className={`${styles.searchInput} ${styles.textArea}`}
                                placeholder="Description"
                                value={editCampaignForm.description}
                                onChange={(e) => setEditCampaignForm((p) => ({ ...p, description: e.target.value }))}
                              />
                              <div className={styles.actionButtonGroup}>
                                <button type="button" className={styles.primaryBtn} onClick={handleSaveEditCampaign} disabled={savingCampaignId === campaign.id}>
                                  Save
                                </button>
                                <button type="button" className={styles.secondaryBtn} onClick={() => setEditingCampaignId(null)}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className={styles.tabPane}>
            <div className={styles.panelHeader}>
              <div>
                <h3>Tasks Oversight</h3>
                <p>{filteredTasks.length} task(s) shown</p>
              </div>
              <button type="button" className={styles.refreshButton} onClick={loadAllTasks}>Refresh</button>
            </div>
            <div className={styles.filtersRow}>
              <input
                className={styles.searchInput}
                value={taskQuery}
                onChange={(e) => setTaskQuery(e.target.value)}
                placeholder="Search by title, assignee, or creator"
              />
              <select
                className={styles.filterSelect}
                value={taskStatusFilter}
                onChange={(e) => setTaskStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Done">Done</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <button type="button" className={styles.secondaryBtn} onClick={() => { setTaskQuery(''); setTaskStatusFilter('all') }}>Clear</button>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Assigned To</th>
                    <th>Created By</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Due Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.length === 0 && (
                    <tr><td colSpan={7} className={styles.emptyState}>No tasks match current filters.</td></tr>
                  )}
                  {filteredTasks.map((task) => {
                    const assigneeName = task.assigned_to?.full_name || task.assigned_to?.email || '-'
                    const creatorName = task.created_by?.full_name || task.created_by?.email || '-'
                    return (
                      <tr key={task.id}>
                        <td>{task.title}</td>
                        <td>
                          <div className={styles.userCell}>
                            <Avatar
                              name={assigneeName}
                              src={task.assigned_to?.avatar_url || task.assigned_to?.profile_picture_url || null}
                              size="sm"
                            />
                            <span>{assigneeName}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.userCell}>
                            <Avatar
                              name={creatorName}
                              src={task.created_by?.avatar_url || task.created_by?.profile_picture_url || null}
                              size="sm"
                            />
                            <span>{creatorName}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`${styles.badge} ${styles[(task.status || '').toLowerCase().replace(/ /g, '')]}`}>
                            {task.status}
                          </span>
                        </td>
                        <td>
                          <span className={`${styles.badge} ${task.priority === 'High' ? styles.rejected : task.priority === 'Medium' ? styles.pending : styles.archived}`}>
                            {task.priority || 'Normal'}
                          </span>
                        </td>
                        <td>{task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}</td>
                        <td>
                          <button type="button" className={styles.smallBtnDanger} onClick={() => handleDeleteTask(task.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'visits' && (
          <div className={styles.tabPane}>
            <div className={styles.panelHeader}>
              <div>
                <h3>Visit Logs</h3>
                <p>{filteredVisits.length} visit(s) shown</p>
              </div>
              <button type="button" className={styles.refreshButton} onClick={loadAllVisits}>Refresh</button>
            </div>
            <div className={styles.filtersRow}>
              <input
                className={styles.searchInput}
                value={visitQuery}
                onChange={(e) => setVisitQuery(e.target.value)}
                placeholder="Search by HCP, officer, or visit type"
              />
              <select
                className={styles.filterSelect}
                value={visitOutcomeFilter}
                onChange={(e) => setVisitOutcomeFilter(e.target.value)}
              >
                <option value="all">All outcomes</option>
                {visitOutcomes.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <button type="button" className={styles.secondaryBtn} onClick={() => { setVisitQuery(''); setVisitOutcomeFilter('all') }}>Clear</button>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Liaison Officer</th>
                    <th>HCP</th>
                    <th>Organisation</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Outcome</th>
                    <th>Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVisits.length === 0 && (
                    <tr><td colSpan={7} className={styles.emptyState}>No visits match current filters.</td></tr>
                  )}
                  {filteredVisits.map((visit) => {
                    const officerName = visit.officer?.full_name || visit.officer?.email || 'Unknown'
                    return (
                      <tr key={visit.id}>
                        <td>
                          <div className={styles.userCell}>
                            <Avatar
                              name={officerName}
                              src={visit.officer?.avatar_url || visit.officer?.profile_picture_url || null}
                              size="sm"
                            />
                            <span>{officerName}</span>
                          </div>
                        </td>
                        <td>{visit.hcp?.name || '-'}</td>
                        <td>{visit.hcp?.organisation || '-'}</td>
                        <td>{visit.visit_type || '-'}</td>
                        <td>{visit.visit_date ? new Date(visit.visit_date).toLocaleDateString() : '-'}</td>
                        <td>
                          <span className={`${styles.badge} ${styles[normalize(visit.outcome || 'pending')]}`}>
                            {visit.outcome || 'Pending'}
                          </span>
                        </td>
                        <td className={styles.detailsCell}>{visit.hcp_feedback || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'compliance' && (
          <div className={styles.tabPane}>
            <div className={styles.panelHeader}>
              <div>
                <h3>Compliance Submissions Overview</h3>
                <p>{filteredSubmissions.length} submission(s) shown</p>
              </div>
              <button type="button" className={styles.primaryBtn} onClick={loadSubmissions}>
                Refresh Submissions
              </button>
            </div>

            <div className={styles.filtersRow}>
              <input
                className={styles.searchInput}
                value={submissionQuery}
                onChange={(e) => setSubmissionQuery(e.target.value)}
                placeholder="Search submissions by ID, campaign, material, submitter"
              />
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setSubmissionQuery('')}
              >
                Clear
              </button>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Submission ID</th>
                    <th>Campaign</th>
                    <th>Material</th>
                    <th>Submitter</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Admin Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.length === 0 && (
                    <tr>
                      <td colSpan={7} className={styles.emptyState}>No submissions match the current search.</td>
                    </tr>
                  )}
                  {filteredSubmissions.map((sub) => (
                    <tr key={sub.id}>
                      <td>{sub.id}</td>
                      <td>{sub.campaign?.name || '-'}</td>
                      <td>{sub.name || '-'}</td>
                      <td>{sub.uploaded_by?.full_name || '-'}</td>
                      <td>{sub.submission_date ? new Date(sub.submission_date).toLocaleDateString() : '-'}</td>
                      <td>
                        <span className={`${styles.badge} ${styles[(sub.status || '').toLowerCase().replace(' ', '')]}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.linkBtn}
                          disabled={savingSubmissionId === sub.id}
                          onClick={() => handleSubmissionAction(sub.id, 'Approved')}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className={styles.linkBtn}
                          disabled={savingSubmissionId === sub.id}
                          onClick={() => handleSubmissionAction(sub.id, 'Rejected')}
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'activity-logs' && (
          <div className={styles.tabPane}>
            <div className={styles.panelHeader}>
              <div>
                <h3>User Activity Logs</h3>
                <p>{filteredActivityLogs.length} log(s) shown</p>
              </div>
              <button type="button" className={styles.primaryBtn} onClick={exportLogs}>
                Export Log
              </button>
            </div>

            <div className={styles.filtersRow}>
              <input
                className={styles.searchInput}
                value={logQuery}
                onChange={(e) => setLogQuery(e.target.value)}
                placeholder="Search logs by user, action, type, or details"
              />
              <select
                className={styles.filterSelect}
                value={logTypeFilter}
                onChange={(e) => setLogTypeFilter(e.target.value)}
              >
                <option value="all">All resource types</option>
                {availableResourceTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <select
                className={styles.filterSelect}
                value={logActorFilter}
                onChange={(e) => setLogActorFilter(e.target.value)}
              >
                <option value="all">All actors</option>
                {availableActors.map((actor) => (
                  <option key={actor} value={actor}>{actor}</option>
                ))}
              </select>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setLogQuery('')
                  setLogTypeFilter('all')
                  setLogActorFilter('all')
                }}
              >
                Clear
              </button>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Action</th>
                    <th>Resource Type</th>
                    <th>Timestamp</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivityLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className={styles.emptyState}>No activity logs match the current filters.</td>
                    </tr>
                  )}
                  {filteredActivityLogs.map((log) => {
                    const actorName = log.user?.full_name || log.user?.email || 'System'
                    return (
                      <tr key={log.id}>
                        <td>
                          <div className={styles.userCell}>
                            <Avatar
                              name={actorName}
                              src={log.user?.avatar_url || log.user?.profile_picture_url || null}
                              size="sm"
                            />
                            <span>{actorName}</span>
                          </div>
                        </td>
                        <td>{log.action || '-'}</td>
                        <td><span className={`${styles.badge} ${styles.archived}`}>{log.resource_type || '-'}</span></td>
                        <td>{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</td>
                        <td className={styles.detailsCell}>{JSON.stringify(log.details || {})}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'system-settings' && (
          <div className={styles.tabPane}>
            <div className={styles.settingsGrid}>
              <div className={styles.settingsCard}>
                <h4>Notification Settings</h4>
                <div className={styles.settingRow}>
                  <label>
                    <input
                      type="checkbox"
                      checked={notificationsEnabled}
                      onChange={(e) => setNotificationsEnabled(e.target.checked)}
                    />
                    Enable system notifications
                  </label>
                  <p className={styles.settingHint}>Users will receive emails for important events</p>
                </div>
              </div>

              <div className={styles.settingsCard}>
                <h4>Data Retention Policy</h4>
                <div className={styles.settingRow}>
                  <label>
                    Retain logs for{' '}
                    <select value={dataRetention} onChange={(e) => setDataRetention(e.target.value)}>
                      <option value="30">30 days</option>
                      <option value="60">60 days</option>
                      <option value="90">90 days</option>
                      <option value="365">1 year</option>
                    </select>
                  </label>
                  <p className={styles.settingHint}>Older logs will be permanently deleted</p>
                </div>
              </div>
            </div>

            <button type="button" className={styles.primaryBtn} onClick={handleSaveSettings}>
              Save Settings
            </button>
          </div>
        )}

        <p className={statusClassName}>{status}</p>
      </div>
    </>
  )
}
