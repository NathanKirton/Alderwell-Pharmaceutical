import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { supabase } from '../../services/supabaseClient'
import { auditQueries, campaignQueries, materialQueries } from '../../services/supabaseHelpers'
import Topbar from '../Layout/Topbar'
import styles from './Admin.module.css'

const ADMIN_TABS = [
  { id: 'user-management', label: 'User Management' },
  { id: 'campaigns', label: 'Campaign Management' },
  { id: 'compliance', label: 'Compliance Oversight' },
  { id: 'activity-logs', label: 'User Activity Logs' },
  { id: 'system-settings', label: 'System Settings' },
]

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
  const [activeTab, setActiveTab] = useState('user-management')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [dataRetention, setDataRetention] = useState('90')
  const [showCampaignForm, setShowCampaignForm] = useState(false)
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
      setStatusMessage('Loading users...', 'info')

      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, role')
        .order('email', { ascending: true })

      if (error) {
        console.error(error)
        setStatusMessage('Failed to load users.', 'error')
        return
      }

      setUsers(profiles || [])
      setStatusMessage('Users loaded.', 'success')
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

  useEffect(() => {
    loadUsers(true)
    loadCampaigns()
    loadSubmissions()
    loadActivityLogs()
    loadSettings()
  }, [loadUsers, loadCampaigns, loadSubmissions, loadActivityLogs, loadSettings])

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return users.filter((user) => {
      const userRole = user.role || 'no_role'
      const matchesRole = roleFilter === 'all' || userRole === roleFilter
      const matchesQuery =
        normalizedQuery.length === 0 ||
        (user.email || '').toLowerCase().includes(normalizedQuery) ||
        (ROLE_LABEL_MAP[userRole] || userRole).toLowerCase().includes(normalizedQuery)

      return matchesRole && matchesQuery
    })
  }, [users, query, roleFilter])

  const stats = useMemo(() => {
    const total = users.length
    const admins = users.filter((user) => user.role === 'admin').length
    const noRole = users.filter((user) => !user.role || user.role === 'no_role').length
    return { total, admins, noRole }
  }, [users])

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
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) {
      setStatusMessage(`Reset password failed for ${email}: ${error.message}`, 'error')
      return
    }
    setStatusMessage(`Password reset email sent to ${email}.`, 'success')
  }

  const handleDeactivateUser = async (userId) => {
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

  const handleCreateCampaign = async () => {
    if (!campaignForm.name.trim()) {
      setStatusMessage('Campaign name is required.', 'error')
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

  const handleCampaignStatusToggle = async (campaignId, currentStatus) => {
    const nextStatus = currentStatus === 'Active' ? 'On Hold' : 'Active'
    const { error } = await campaignQueries.updateCampaignStatus(campaignId, nextStatus)
    if (error) {
      setStatusMessage(`Failed to update campaign: ${error}`, 'error')
      return
    }

    setStatusMessage(`Campaign ${campaignId} moved to ${nextStatus}.`, 'success')
    await loadCampaigns()
  }

  const handleSubmissionAction = async (materialId, statusValue) => {
    const { error } = await materialQueries.reviewMaterial(materialId, statusValue, `Updated by admin: ${statusValue}`)
    if (error) {
      setStatusMessage(`Submission update failed: ${error}`, 'error')
      return
    }

    setStatusMessage(`Submission ${materialId} marked ${statusValue}.`, 'success')
    await loadSubmissions()
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
    const rows = activityLogs.map((log) => [
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
                placeholder="Search by email or role"
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
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.usersTable}>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Current Role</th>
                    <th>Change Role</th>
                    <th>Security Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={4} className={styles.emptyState}>
                        No users match your current search or filter.
                      </td>
                    </tr>
                  )}
                  {filteredUsers.map((user) => {
                    const currentRole = user.role || 'no_role'
                    return (
                      <tr key={user.id}>
                        <td>{user.email || '(no email)'}</td>
                        <td>
                          <span className={styles.roleBadge}>{ROLE_LABEL_MAP[currentRole] || currentRole}</span>
                        </td>
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
                <p>{campaigns.length} campaigns</p>
              </div>
              <button type="button" className={styles.primaryBtn} onClick={() => setShowCampaignForm((prev) => !prev)}>
                {showCampaignForm ? 'Cancel' : '+ Create Campaign'}
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
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id}>
                      <td>{campaign.id}</td>
                      <td>{campaign.name}</td>
                      <td>{campaign.owner?.full_name || 'Unassigned'}</td>
                      <td>
                        <span className={`${styles.badge} ${styles[(campaign.status || 'planning').toLowerCase().replace(' ', '')]}`}>
                          {campaign.status}
                        </span>
                      </td>
                      <td>{campaign.start_date || '-'} to {campaign.end_date || '-'}</td>
                      <td>
                        <button type="button" className={styles.linkBtn} onClick={() => handleCampaignStatusToggle(campaign.id, campaign.status || 'Planning')}>
                          Toggle Status
                        </button>
                        <button type="button" className={styles.linkBtn} onClick={() => setStatusMessage(`Campaign ${campaign.id}: ${campaign.description || 'No description'}`, 'info')}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
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
                <p>{submissions.length} submissions</p>
              </div>
              <button type="button" className={styles.primaryBtn} onClick={loadSubmissions}>
                Refresh Submissions
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
                  {submissions.map((sub) => (
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
                        <button type="button" className={styles.linkBtn} onClick={() => handleSubmissionAction(sub.id, 'Approved')}>
                          Approve
                        </button>
                        <button type="button" className={styles.linkBtn} onClick={() => handleSubmissionAction(sub.id, 'Rejected')}>
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
                <p>Full audit trail of system actions</p>
              </div>
              <button type="button" className={styles.primaryBtn} onClick={exportLogs}>
                Export Log
              </button>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Action</th>
                    <th>Timestamp</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.user?.full_name || 'System'}</td>
                      <td>{log.action}</td>
                      <td>{log.timestamp}</td>
                      <td className={styles.detailsCell}>{JSON.stringify(log.details || {})}</td>
                    </tr>
                  ))}
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

        <p className={`${styles.status} ${styles[statusType]}`}>{status}</p>
      </div>
    </>
  )
}
