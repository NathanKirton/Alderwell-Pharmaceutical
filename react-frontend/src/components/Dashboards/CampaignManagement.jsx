import React, { useEffect, useMemo, useRef, useState } from 'react'
import DashboardTemplate from '../Layout/DashboardTemplate'
import styles from './CampaignManagement.module.css'
import { auditQueries, campaignQueries, complianceQueries, materialQueries } from '../../services/supabaseHelpers'
import {
  BarChartIcon,
  CheckCircleIcon,
  ClipboardIcon,
  FileIcon,
  PlusIcon,
  VideoIcon,
} from '../Icons/IconSet'

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'campaign-management', label: 'Campaign Management' },
  { id: 'materials', label: 'Materials' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'reporting-analytics', label: 'Reporting & Analytics' },
]

const CAMPAIGN_STATUSES = ['Planning', 'Active', 'On Hold', 'Archived']

const BLANK_CAMPAIGN_FORM = {
  name: '',
  description: '',
  status: 'Planning',
  start_date: '',
  end_date: '',
  budget: '',
  category: '',
}

const getFileIcon = (fileType) => {
  const t = (fileType || '').toLowerCase()
  if (t.includes('mp4') || t.includes('mov') || t.includes('avi') || t.includes('video')) return VideoIcon
  if (t.includes('ppt') || t.includes('presentation') || t.includes('pptx')) return ClipboardIcon
  if (t.includes('pdf')) return BarChartIcon
  if (t.includes('approved')) return CheckCircleIcon
  return FileIcon
}

const getMaterialEditorName = (material) => {
  return material?.reviewer?.full_name ||
    material?.reviewer?.email ||
    material?.uploader?.full_name ||
    material?.uploader?.email ||
    'Unknown'
}

export default function CampaignManagement() {
  // ─── Data state ───────────────────────────────────────────────────────
  const [campaigns, setCampaigns] = useState([])
  const [materials, setMaterials] = useState([])
  const [pendingApprovals, setPendingApprovals] = useState([])
  const [activityLogs, setActivityLogs] = useState([])

  // ─── Loading state ────────────────────────────────────────────────────
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)
  const [loadingMaterials, setLoadingMaterials] = useState(true)
  const [loadingApprovals, setLoadingApprovals] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isReplacingMaterial, setIsReplacingMaterial] = useState(false)
  const [isSavingCampaign, setIsSavingCampaign] = useState(false)

  // ─── UI state ─────────────────────────────────────────────────────────
  const [actionMessage, setActionMessage] = useState('')
  const [campaignSearch, setCampaignSearch] = useState('')
  const [materialSearch, setMaterialSearch] = useState('')
  const [materialTypeFilter, setMaterialTypeFilter] = useState('all')
  const [materialCampaignFilter, setMaterialCampaignFilter] = useState('all')
  const [approvalFilter, setApprovalFilter] = useState('all')
  const [reportSearch, setReportSearch] = useState('')

  // ─── Modals ───────────────────────────────────────────────────────────
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [campaignForm, setCampaignForm] = useState(BLANK_CAMPAIGN_FORM)
  const [editingCampaignId, setEditingCampaignId] = useState(null)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [materialToReplace, setMaterialToReplace] = useState(null)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [uploadForm, setUploadForm] = useState({ campaignId: '', name: '' })
  const [uploadFile, setUploadFile] = useState(null)

  // ─── Refs ─────────────────────────────────────────────────────────────
  const replaceInputRef = useRef(null)

  // ─── Data loading ─────────────────────────────────────────────────────
  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoadingCampaigns(true)
    setLoadingMaterials(true)
    setLoadingApprovals(true)

    const [campaignsRes, materialsRes, approvalsRes, logs] = await Promise.all([
      campaignQueries.getAllCampaigns(),
      materialQueries.getAllMaterials(),
      materialQueries.getPendingApprovals(),
      auditQueries.getActivityLogs(),
    ])

    if (campaignsRes.error) setActionMessage(`Campaigns: ${campaignsRes.error}`)
    if (materialsRes.error) setActionMessage(`Materials: ${materialsRes.error}`)
    if (approvalsRes.error) setActionMessage(`Approvals: ${approvalsRes.error}`)

    setCampaigns(campaignsRes.data || [])
    setMaterials(materialsRes.data || [])
    setPendingApprovals(approvalsRes.data || [])
    setActivityLogs(Array.isArray(logs) ? logs : [])

    setLoadingCampaigns(false)
    setLoadingMaterials(false)
    setLoadingApprovals(false)
  }

  // ─── Computed values ──────────────────────────────────────────────────
  const visibleCampaigns = useMemo(() => {
    const q = campaignSearch.trim().toLowerCase()
    if (!q) return campaigns
    return campaigns.filter((c) =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.status || '').toLowerCase().includes(q) ||
      (c.category || '').toLowerCase().includes(q)
    )
  }, [campaigns, campaignSearch])

  const visibleMaterials = useMemo(() => {
    let result = materials
    const q = materialSearch.trim().toLowerCase()
    if (q) {
      result = result.filter((m) =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q) ||
        (m.file_type || '').toLowerCase().includes(q) ||
        (m.status || '').toLowerCase().includes(q)
      )
    }
    if (materialTypeFilter !== 'all') {
      result = result.filter((m) => {
        const t = (m.file_type || '').toLowerCase()
        if (materialTypeFilter === 'pdf') return t.includes('pdf')
        if (materialTypeFilter === 'video') return t.includes('mp4') || t.includes('mov') || t.includes('avi') || t.includes('video')
        if (materialTypeFilter === 'image') return t.includes('jpg') || t.includes('jpeg') || t.includes('png') || t.includes('gif') || t.includes('svg') || t.includes('webp')
        if (materialTypeFilter === 'ppt') return t.includes('ppt') || t.includes('pptx') || t.includes('presentation')
        return !t.includes('pdf') && !t.includes('mp4') && !t.includes('mov') && !t.includes('jpg') && !t.includes('jpeg') && !t.includes('png') && !t.includes('ppt')
      })
    }
    if (materialCampaignFilter !== 'all') {
      result = result.filter((m) =>
        materialCampaignFilter === 'unassigned'
          ? !m.campaign?.name
          : m.campaign?.name === materialCampaignFilter
      )
    }
    return result
  }, [materials, materialSearch, materialTypeFilter, materialCampaignFilter])

  const filteredApprovals = useMemo(() => {
    if (approvalFilter === 'all') return pendingApprovals
    if (approvalFilter === 'materials') return pendingApprovals.filter((r) => (r.file_type || '').toLowerCase() !== 'campaign')
    return pendingApprovals.filter((r) => (r.file_type || '').toLowerCase() === 'campaign')
  }, [pendingApprovals, approvalFilter])

  const dashboardStats = useMemo(() => ({
    activeCampaigns: campaigns.filter((c) => c.status === 'Active').length,
    totalCampaigns: campaigns.length,
    pendingCount: pendingApprovals.length,
    totalMaterials: materials.length,
    approvedMaterials: materials.filter((m) => (m.status || '').toLowerCase() === 'approved').length,
  }), [campaigns, pendingApprovals, materials])

  const recentActivity = useMemo(() => activityLogs.slice(0, 8), [activityLogs])

  const campaignNames = useMemo(() => {
    const names = materials.map((m) => m.campaign?.name).filter(Boolean)
    return [...new Set(names)].sort()
  }, [materials])

  const materialsByCampaign = useMemo(() => {
    const result = {}
    materials.forEach((m) => {
      const key = m.campaign?.name || 'Unassigned'
      result[key] = (result[key] || 0) + 1
    })
    return Object.entries(result).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [materials])

  const maxMaterialCount = useMemo(() => Math.max(...materialsByCampaign.map(([, n]) => n), 1), [materialsByCampaign])

  const reportVisibleCampaigns = useMemo(() => {
    const q = reportSearch.trim().toLowerCase()
    if (!q) return campaigns
    return campaigns.filter((c) =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.category || '').toLowerCase().includes(q) ||
      (c.status || '').toLowerCase().includes(q)
    )
  }, [campaigns, reportSearch])

  // ─── Material timeline builder ────────────────────────────────────────
  const buildMaterialTimeline = (material) => {
    if (!material) return []
    const uploaderName = material.uploader?.full_name || material.uploader?.email || 'Unknown user'
    const reviewerName = material.reviewer?.full_name || material.reviewer?.email || 'Unknown reviewer'
    const events = []
    if (material.created_at) events.push({ id: `c-${material.id}`, label: 'Material created', by: uploaderName, at: material.created_at })
    if (material.submission_date) events.push({ id: `s-${material.id}`, label: 'Submitted for review', by: uploaderName, at: material.submission_date })
    if (material.reviewed_at) events.push({ id: `r-${material.id}`, label: `Review completed (${material.status || 'Updated'})`, by: reviewerName, at: material.reviewed_at })
    if (material.updated_at && material.updated_at !== material.created_at && material.updated_at !== material.reviewed_at) {
      events.push({ id: `u-${material.id}`, label: 'Material updated', by: uploaderName, at: material.updated_at })
    }
    return events.filter((e) => e.at).sort((a, b) => new Date(b.at) - new Date(a.at))
  }

  // ─── Campaign modal actions ───────────────────────────────────────────
  const openCreateModal = () => {
    setCampaignForm(BLANK_CAMPAIGN_FORM)
    setIsEditMode(false)
    setEditingCampaignId(null)
    setIsCampaignModalOpen(true)
  }

  const openEditModal = (campaign) => {
    setCampaignForm({
      name: campaign.name || '',
      description: campaign.description || '',
      status: campaign.status || 'Planning',
      start_date: campaign.start_date ? campaign.start_date.slice(0, 10) : '',
      end_date: campaign.end_date ? campaign.end_date.slice(0, 10) : '',
      budget: campaign.budget !== null && campaign.budget !== undefined ? String(campaign.budget) : '',
      category: campaign.category || '',
    })
    setIsEditMode(true)
    setEditingCampaignId(campaign.id)
    setIsCampaignModalOpen(true)
  }

  const handleSaveCampaign = async () => {
    if (!campaignForm.name.trim()) {
      setActionMessage('Campaign name is required.')
      return
    }
    setIsSavingCampaign(true)
    const payload = {
      name: campaignForm.name.trim(),
      description: campaignForm.description.trim() || null,
      status: campaignForm.status,
      start_date: campaignForm.start_date || null,
      end_date: campaignForm.end_date || null,
      budget: campaignForm.budget ? parseFloat(campaignForm.budget) : null,
      category: campaignForm.category.trim() || null,
    }

    let error
    if (isEditMode && editingCampaignId) {
      const res = await campaignQueries.updateCampaign(editingCampaignId, payload)
      error = res.error
    } else {
      const res = await campaignQueries.createCampaign(payload)
      error = res.error
    }

    setIsSavingCampaign(false)
    if (error) {
      setActionMessage(`Failed to save campaign: ${error}`)
      return
    }
    setActionMessage(isEditMode ? `Campaign "${payload.name}" updated.` : `Campaign "${payload.name}" created.`)
    setIsCampaignModalOpen(false)
    await loadAll()
  }

  // ─── Approval actions ─────────────────────────────────────────────────
  const handleApproveMaterial = async (id) => {
    const item = pendingApprovals.find((r) => r.id === id)
    const { error } = await materialQueries.reviewMaterial(id, 'Approved', 'Approved from Campaign Management')
    if (error) { setActionMessage(`Approval failed: ${error}`); return }
    setActionMessage(`${item?.name || id} approved.`)
    await loadAll()
  }

  const handleRejectMaterial = async (id) => {
    const item = pendingApprovals.find((r) => r.id === id)
    const { error } = await materialQueries.reviewMaterial(id, 'Rejected', 'Rejected from Campaign Management')
    if (error) { setActionMessage(`Rejection failed: ${error}`); return }
    setActionMessage(`${item?.name || id} rejected.`)
    await loadAll()
  }

  // ─── Upload modal ─────────────────────────────────────────────────────
  const openUploadModal = (preselectedCampaignId = '') => {
    setUploadForm({ campaignId: preselectedCampaignId, name: '' })
    setUploadFile(null)
    setIsUploadModalOpen(true)
  }

  const handleUploadFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadFile(file)
    if (!uploadForm.name) setUploadForm((prev) => ({ ...prev, name: file.name }))
  }

  const handleSubmitUpload = async () => {
    if (!uploadFile) { setActionMessage('Please select a file.'); return }
    if (!uploadForm.name.trim()) { setActionMessage('Please enter a material name.'); return }
    setIsUploading(true)
    setActionMessage('Uploading...')
    const { error } = await materialQueries.submitMaterial(
      uploadForm.campaignId || null,
      { name: uploadForm.name.trim(), description: 'Uploaded from Campaign Management' },
      uploadFile
    )
    if (error) {
      setActionMessage(`Upload failed: ${error}`)
    } else {
      setActionMessage(`${uploadForm.name} uploaded successfully.`)
      setIsUploadModalOpen(false)
      await loadAll()
    }
    setIsUploading(false)
  }

  // ─── Replace file ─────────────────────────────────────────────────────
  const handleReplaceMaterialClick = (material) => {
    setMaterialToReplace(material)
    replaceInputRef.current?.click()
  }

  const handleReplaceFileSelected = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !materialToReplace) { e.target.value = ''; return }
    setIsReplacingMaterial(true)
    setActionMessage(`Replacing file for ${materialToReplace.name}...`)
    const { data, error } = await materialQueries.replaceMaterialFile(materialToReplace.id, file)
    if (error) {
      setActionMessage(`Replace failed: ${error}`)
    } else {
      const by = data?.uploader?.full_name || data?.uploader?.email || 'you'
      setActionMessage(`${data?.name || materialToReplace.name} updated by ${by}.`)
      await loadAll()
    }
    setMaterialToReplace(null)
    setIsReplacingMaterial(false)
    e.target.value = ''
  }

  const handleFlagMaterial = async (material) => {
    if (!material?.id) {
      setActionMessage('Cannot flag this item: missing material id.')
      return
    }

    const reasonInput = window.prompt('Why are you flagging this material for compliance review?', `Manual compliance flag for ${material.name || material.id}`)
    if (reasonInput === null) {
      return
    }

    const reason = reasonInput.trim()
    if (!reason) {
      setActionMessage('Flag cancelled: reason is required.')
      return
    }

    const severityInput = (window.prompt('Flag severity (Low, Medium, High, Critical)', 'Medium') || 'Medium').trim()
    const normalizedSeverity = severityInput.charAt(0).toUpperCase() + severityInput.slice(1).toLowerCase()
    const severity = ['Low', 'Medium', 'High', 'Critical'].includes(normalizedSeverity) ? normalizedSeverity : 'Medium'

    const { error } = await complianceQueries.createFlag({
      material_id: material.id,
      reason,
      severity,
      status: 'Open',
    })

    if (error) {
      setActionMessage(`Failed to flag material: ${error}`)
      return
    }

    setActionMessage(`Material ${material.name || material.id} flagged for compliance review.`)
  }

  // ─── Export campaigns CSV ─────────────────────────────────────────────
  const handleExportCsv = () => {
    const header = ['ID', 'Name', 'Status', 'Category', 'Budget', 'Start Date', 'End Date', 'Owner']
    const rows = campaigns.map((c) => [
      c.id, c.name, c.status, c.category || '', c.budget ?? '',
      c.start_date || '', c.end_date || '', c.owner?.full_name || '',
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'campaigns.csv'
    link.click()
    URL.revokeObjectURL(url)
    setActionMessage('Campaigns exported to CSV.')
  }

  return (
    <>
      <DashboardTemplate title="Campaign Management Portal" tabs={TABS}>
        {(activeTab) => {
          switch (activeTab) {

            /* ──────────────────── DASHBOARD ──────────────────── */
            case 'dashboard':
              return (
                <div className={styles.tabContent}>
                  {actionMessage && <p className={styles.rowMeta}>{actionMessage}</p>}
                  <div className={styles.pageHeader}>
                    <h1>Dashboard Overview</h1>
                    <p>Live campaign metrics and pending task queue.</p>
                  </div>

                  <div className={styles.kpiGrid}>
                    <div className={styles.kpiCard}>
                      <p className={styles.kpiLabel}>Active Campaigns</p>
                      <div className={styles.kpiRow}>
                        <h3>{loadingCampaigns ? '—' : dashboardStats.activeCampaigns}</h3>
                        <span>of {dashboardStats.totalCampaigns} total</span>
                      </div>
                      <div className={styles.kpiTrack}>
                        <div className={styles.kpiFill} style={{ width: `${dashboardStats.totalCampaigns > 0 ? (dashboardStats.activeCampaigns / dashboardStats.totalCampaigns) * 100 : 0}%` }}></div>
                      </div>
                    </div>
                    <div className={styles.kpiCard}>
                      <p className={styles.kpiLabel}>Pending Approvals</p>
                      <div className={styles.kpiRow}>
                        <h3>{loadingApprovals ? '—' : dashboardStats.pendingCount}</h3>
                        <span>awaiting review</span>
                      </div>
                      <div className={styles.kpiTrack}>
                        <div className={styles.kpiFill} style={{ width: `${Math.min(100, dashboardStats.pendingCount * 12)}%` }}></div>
                      </div>
                    </div>
                    <div className={styles.kpiCard}>
                      <p className={styles.kpiLabel}>Total Materials</p>
                      <div className={styles.kpiRow}>
                        <h3>{loadingMaterials ? '—' : dashboardStats.totalMaterials}</h3>
                        <span>{dashboardStats.approvedMaterials} approved</span>
                      </div>
                      <div className={styles.kpiTrack}>
                        <div className={styles.kpiFill} style={{ width: `${dashboardStats.totalMaterials > 0 ? (dashboardStats.approvedMaterials / dashboardStats.totalMaterials) * 100 : 0}%` }}></div>
                      </div>
                    </div>
                    <div className={styles.kpiCard}>
                      <p className={styles.kpiLabel}>Approval Rate</p>
                      <div className={styles.kpiRow}>
                        <h3>{dashboardStats.totalMaterials > 0 ? `${Math.round((dashboardStats.approvedMaterials / dashboardStats.totalMaterials) * 100)}%` : '—'}</h3>
                        <span>of all materials</span>
                      </div>
                      <div className={styles.kpiTrack}>
                        <div className={styles.kpiFill} style={{ width: `${dashboardStats.totalMaterials > 0 ? (dashboardStats.approvedMaterials / dashboardStats.totalMaterials) * 100 : 0}%` }}></div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.dashboardGrid}>
                    <section className={styles.activityCard}>
                      <div className={styles.cardHeader}>
                        <h3>Recent Activity</h3>
                        <button type="button" className={styles.linkBtn} onClick={loadAll}>Refresh</button>
                      </div>
                      <div className={styles.activityList}>
                        {recentActivity.length === 0 && <p className={styles.rowMeta}>No recent activity logged.</p>}
                        {recentActivity.map((log) => (
                          <div key={log.id} className={styles.activityItem}>
                            <span className={styles.dot}></span>
                            <div>
                              <p>{(log.action || 'Activity logged').replace(/_/g, ' ')}</p>
                              <span>{log.timestamp ? new Date(log.timestamp).toLocaleString('en-GB') : 'Recently'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className={styles.pendingCard}>
                      <div className={styles.cardHeader}>
                        <h3>Pending Approvals</h3>
                        <span className={styles.rowMeta}>{pendingApprovals.length} item{pendingApprovals.length !== 1 ? 's' : ''}</span>
                      </div>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Material</th>
                            <th>Campaign</th>
                            <th>Uploaded by</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingApprovals.slice(0, 5).map((item) => (
                            <tr key={item.id}>
                              <td>
                                <strong>{item.name || item.id}</strong>
                                <p className={styles.rowMeta}>{item.file_type || 'file'}</p>
                              </td>
                              <td>{item.campaign?.name || 'Unassigned'}</td>
                              <td>{item.uploaded_by?.full_name || item.uploaded_by?.email || 'Unknown'}</td>
                              <td>
                                <button type="button" className={styles.iconBtn} title="Approve" onClick={() => handleApproveMaterial(item.id)}>✓</button>
                                {' '}
                                <button type="button" className={styles.iconBtn} title="Reject" onClick={() => handleRejectMaterial(item.id)}>✕</button>
                              </td>
                            </tr>
                          ))}
                          {!loadingApprovals && pendingApprovals.length === 0 && (
                            <tr><td colSpan={4} className={styles.rowMeta}>No pending approvals.</td></tr>
                          )}
                          {loadingApprovals && (
                            <tr><td colSpan={4} className={styles.rowMeta}>Loading...</td></tr>
                          )}
                        </tbody>
                      </table>
                    </section>
                  </div>
                </div>
              )

            /* ──────────────────── CAMPAIGN MANAGEMENT ──────────────────── */
            case 'campaign-management':
              return (
                <div className={styles.tabContent}>
                  {actionMessage && <p className={styles.rowMeta}>{actionMessage}</p>}
                  <div className={styles.pageHeaderRow}>
                    <div>
                      <h1>Campaign Management</h1>
                      <p>Create, edit, and monitor your pharmaceutical marketing campaigns.</p>
                    </div>
                    <button type="button" className={styles.primaryBtn} onClick={openCreateModal}>
                      <PlusIcon size={16} /> New Campaign
                    </button>
                  </div>

                  <div className={styles.toolbar}>
                    <input
                      className={styles.searchInput}
                      placeholder="Search by name, status or category..."
                      value={campaignSearch}
                      onChange={(e) => setCampaignSearch(e.target.value)}
                    />
                    <button type="button" className={styles.secondaryBtn} onClick={loadAll}>Refresh</button>
                  </div>

                  <div className={styles.tableCard}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Campaign</th>
                          <th>Status</th>
                          <th>Category</th>
                          <th>Dates</th>
                          <th>Budget</th>
                          <th>Owner</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleCampaigns.map((item) => {
                          const campaignMaterials = materials.filter((m) => m.campaign?.name === item.name)
                          return (
                            <tr key={item.id}>
                              <td>
                                <strong>{item.name}</strong>
                                <p className={styles.rowMeta}>ID: {item.id}</p>
                                {item.description && <p className={styles.rowMeta}>{item.description.length > 55 ? item.description.slice(0, 55) + '…' : item.description}</p>}
                              </td>
                              <td>
                                <span className={`${styles.badge} ${item.status === 'Active' ? styles.badgeActive : ''}`}>{item.status}</span>
                              </td>
                              <td>{item.category || '—'}</td>
                              <td>
                                <p className={styles.rowMeta}>{item.start_date ? new Date(item.start_date).toLocaleDateString('en-GB') : '—'}</p>
                                <p className={styles.rowMeta}>{item.end_date ? new Date(item.end_date).toLocaleDateString('en-GB') : '—'}</p>
                              </td>
                              <td>{item.budget !== null && item.budget !== undefined ? `£${Number(item.budget).toLocaleString()}` : '—'}</td>
                              <td>{item.owner?.full_name || 'Unassigned'}</td>
                              <td>
                                <div className={styles.actionBtns}>
                                  <button type="button" className={styles.secondaryMiniBtn} onClick={() => openEditModal(item)}>Edit</button>
                                  <button type="button" className={styles.linkBtn} onClick={() => setSelectedCampaign(item)}>
                                    Materials ({campaignMaterials.length})
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        {!loadingCampaigns && visibleCampaigns.length === 0 && (
                          <tr><td colSpan={7} className={styles.rowMeta}>No campaigns found.</td></tr>
                        )}
                        {loadingCampaigns && (
                          <tr><td colSpan={7} className={styles.rowMeta}>Loading campaigns...</td></tr>
                        )}
                      </tbody>
                    </table>
                    <div className={styles.paginationRow}>
                      <span>Showing {visibleCampaigns.length} of {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              )

            /* ──────────────────── MATERIALS ──────────────────── */
            case 'materials':
              return (
                <div className={styles.tabContent}>
                  {actionMessage && <p className={styles.rowMeta}>{actionMessage}</p>}
                  <input ref={replaceInputRef} type="file" hidden onChange={handleReplaceFileSelected} />
                  <div className={styles.pageHeaderRow}>
                    <div>
                      <h1>Materials Library</h1>
                      <p>Manage and organise your campaign assets. {materials.length} total.</p>
                    </div>
                    <button type="button" className={styles.primaryBtn} onClick={() => openUploadModal('')}>
                      <PlusIcon size={16} /> Upload Material
                    </button>
                  </div>

                  <div className={styles.toolbar}>
                    <input
                      className={styles.searchInput}
                      placeholder="Search materials by name, type or status..."
                      value={materialSearch}
                      onChange={(e) => setMaterialSearch(e.target.value)}
                    />
                    <select
                      className={styles.filterSelect}
                      value={materialCampaignFilter}
                      onChange={(e) => setMaterialCampaignFilter(e.target.value)}
                    >
                      <option value="all">All Campaigns</option>
                      <option value="unassigned">Unassigned</option>
                      {campaignNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.materialTabs}>
                    {[
                      { id: 'all', label: 'All Assets' },
                      { id: 'pdf', label: 'PDFs' },
                      { id: 'video', label: 'Videos' },
                      { id: 'image', label: 'Images' },
                      { id: 'ppt', label: 'Presentations' },
                      { id: 'other', label: 'Other' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={`${styles.tabPill} ${materialTypeFilter === tab.id ? styles.activePill : ''}`}
                        onClick={() => setMaterialTypeFilter(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className={styles.materialsGrid}>
                    {visibleMaterials.map((material) => {
                      const Icon = getFileIcon(material.file_type)
                      return (
                        <div className={styles.materialCard} key={material.id}>
                          <div className={styles.materialIcon}><Icon size={32} /></div>
                          <h4>{material.name || 'Untitled'}</h4>
                          <p>{(material.file_type || 'file').toUpperCase()} • {material.status || 'Submitted'}</p>
                          <p className={styles.rowMeta}>Campaign: {material.campaign?.name || 'Unassigned'}</p>
                          <p className={styles.rowMeta}>Updated {material.updated_at ? new Date(material.updated_at).toLocaleString('en-GB') : 'N/A'}</p>
                          <p className={styles.rowMeta}>Last edited by {getMaterialEditorName(material)}</p>
                          <div className={styles.materialCardActions}>
                            <button type="button" className={styles.linkBtn} onClick={() => setSelectedMaterial(material)}>Details</button>
                            <button type="button" className={styles.linkBtn} onClick={() => handleFlagMaterial(material)}>Flag</button>
                            <button
                              type="button"
                              className={styles.linkBtn}
                              onClick={() => handleReplaceMaterialClick(material)}
                              disabled={isReplacingMaterial}
                            >
                              {isReplacingMaterial && materialToReplace?.id === material.id ? 'Updating…' : 'Replace'}
                            </button>
                            <button
                              type="button"
                              className={styles.linkBtn}
                              disabled={(material.status || '').toLowerCase() !== 'approved'}
                              title={(material.status || '').toLowerCase() !== 'approved' ? 'Only approved materials can be downloaded' : 'Download file'}
                              onClick={async () => {
                                const { data, error } = await materialQueries.getApprovedMaterialDownloadUrl(material)
                                if (error) { setActionMessage(error); return }
                                window.open(data.url, '_blank', 'noopener,noreferrer')
                              }}
                            >
                              Download
                            </button>
                          </div>
                        </div>
                      )
                    })}
                    {!loadingMaterials && visibleMaterials.length === 0 && <p className={styles.rowMeta}>No materials found.</p>}
                    {loadingMaterials && <p className={styles.rowMeta}>Loading materials...</p>}
                  </div>
                </div>
              )

            /* ──────────────────── APPROVALS ──────────────────── */
            case 'approvals':
              return (
                <div className={styles.tabContent}>
                  {actionMessage && <p className={styles.rowMeta}>{actionMessage}</p>}
                  <div className={styles.pageHeaderRow}>
                    <div>
                      <h1>Approvals</h1>
                      <p>{pendingApprovals.length} item{pendingApprovals.length !== 1 ? 's' : ''} awaiting review.</p>
                    </div>
                    <button type="button" className={styles.secondaryBtn} onClick={loadAll}>Refresh</button>
                  </div>

                  <div className={styles.materialTabs}>
                    {[
                      { id: 'all', label: 'All Requests' },
                      { id: 'materials', label: 'Materials' },
                      { id: 'campaigns', label: 'Campaigns' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={`${styles.tabPill} ${approvalFilter === tab.id ? styles.activePill : ''}`}
                        onClick={() => setApprovalFilter(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className={styles.tableCard}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th>Campaign</th>
                          <th>Uploaded by</th>
                          <th>Submitted</th>
                          <th>Type</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredApprovals.map((row) => (
                          <tr key={row.id}>
                            <td>
                              <strong>{row.name || row.id}</strong>
                              <p className={styles.rowMeta}>ID: {row.id}</p>
                            </td>
                            <td>{row.campaign?.name || 'Unassigned'}</td>
                            <td>{row.uploaded_by?.full_name || row.uploaded_by?.email || 'Unknown'}</td>
                            <td>{row.submission_date ? new Date(row.submission_date).toLocaleDateString('en-GB') : '—'}</td>
                            <td><span className={styles.badge}>{row.file_type || 'file'}</span></td>
                            <td>
                              <button type="button" className={styles.primaryMiniBtn} onClick={() => handleApproveMaterial(row.id)}>Approve</button>
                              {' '}
                              <button type="button" className={styles.secondaryMiniBtn} onClick={() => handleRejectMaterial(row.id)}>Reject</button>
                            </td>
                          </tr>
                        ))}
                        {!loadingApprovals && filteredApprovals.length === 0 && (
                          <tr><td colSpan={6} className={styles.rowMeta}>No pending approvals.</td></tr>
                        )}
                        {loadingApprovals && (
                          <tr><td colSpan={6} className={styles.rowMeta}>Loading...</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )

            /* ──────────────────── REPORTING & ANALYTICS ──────────────────── */
            case 'reporting-analytics':
              return (
                <div className={styles.tabContent}>
                  {actionMessage && <p className={styles.rowMeta}>{actionMessage}</p>}
                  <div className={styles.pageHeaderRow}>
                    <div>
                      <h1>Reporting & Analytics</h1>
                      <p>Campaign performance and material compliance at a glance.</p>
                    </div>
                    <button type="button" className={styles.secondaryBtn} onClick={handleExportCsv}>Export CSV</button>
                  </div>

                  <div className={styles.kpiGrid}>
                    <div className={styles.kpiCard}>
                      <p className={styles.kpiLabel}>Total Campaigns</p>
                      <div className={styles.kpiRow}>
                        <h3>{campaigns.length}</h3>
                        <span>{campaigns.filter((c) => c.status === 'Active').length} active</span>
                      </div>
                      <div className={styles.kpiTrack}>
                        <div className={styles.kpiFill} style={{ width: `${campaigns.length > 0 ? (campaigns.filter((c) => c.status === 'Active').length / campaigns.length) * 100 : 0}%` }}></div>
                      </div>
                    </div>
                    <div className={styles.kpiCard}>
                      <p className={styles.kpiLabel}>Total Materials</p>
                      <div className={styles.kpiRow}>
                        <h3>{materials.length}</h3>
                        <span>{materials.filter((m) => (m.status || '').toLowerCase() === 'approved').length} approved</span>
                      </div>
                      <div className={styles.kpiTrack}>
                        <div className={styles.kpiFill} style={{ width: `${materials.length > 0 ? (materials.filter((m) => (m.status || '').toLowerCase() === 'approved').length / materials.length) * 100 : 0}%` }}></div>
                      </div>
                    </div>
                    <div className={styles.kpiCard}>
                      <p className={styles.kpiLabel}>Pending Approvals</p>
                      <div className={styles.kpiRow}>
                        <h3>{pendingApprovals.length}</h3>
                        <span>outstanding</span>
                      </div>
                      <div className={styles.kpiTrack}>
                        <div className={styles.kpiFill} style={{ width: `${Math.min(100, pendingApprovals.length * 12)}%` }}></div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.reportGrid}>
                    <div className={styles.chartCard}>
                      <h3>Campaigns by Status</h3>
                      {CAMPAIGN_STATUSES.map((status) => {
                        const count = campaigns.filter((c) => c.status === status).length
                        const pct = campaigns.length > 0 ? Math.round((count / campaigns.length) * 100) : 0
                        return (
                          <div key={status} className={styles.barRow}>
                            <span>{status}</span>
                            <div className={styles.inlineTrack}><div className={styles.inlineFill} style={{ width: `${pct}%` }}></div></div>
                            <strong>{count}</strong>
                          </div>
                        )
                      })}
                    </div>
                    <div className={styles.chartCard}>
                      <h3>Materials by Campaign</h3>
                      {materialsByCampaign.map(([name, count]) => (
                        <div key={name} className={styles.barRow}>
                          <span title={name}>{name.length > 18 ? name.slice(0, 18) + '…' : name}</span>
                          <div className={styles.inlineTrack}><div className={styles.inlineFill} style={{ width: `${Math.round((count / maxMaterialCount) * 100)}%` }}></div></div>
                          <strong>{count}</strong>
                        </div>
                      ))}
                      {materialsByCampaign.length === 0 && <p className={styles.rowMeta}>No material data yet.</p>}
                    </div>
                  </div>

                  <div className={styles.tableCard}>
                    <div className={styles.cardHeader}>
                      <h3>Campaign Overview</h3>
                      <input
                        className={styles.searchInline}
                        placeholder="Search campaigns..."
                        value={reportSearch}
                        onChange={(e) => setReportSearch(e.target.value)}
                      />
                    </div>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Campaign Name</th>
                          <th>Category</th>
                          <th>Status</th>
                          <th>Start Date</th>
                          <th>Budget</th>
                          <th>Materials</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportVisibleCampaigns.map((c) => {
                          const matCount = materials.filter((m) => m.campaign?.name === c.name).length
                          return (
                            <tr key={c.id}>
                              <td>
                                <strong>{c.name}</strong>
                                {c.description && <p className={styles.rowMeta}>{c.description.slice(0, 60)}</p>}
                              </td>
                              <td>{c.category || '—'}</td>
                              <td><span className={`${styles.badge} ${c.status === 'Active' ? styles.badgeActive : ''}`}>{c.status}</span></td>
                              <td>{c.start_date ? new Date(c.start_date).toLocaleDateString('en-GB') : '—'}</td>
                              <td>{c.budget !== null && c.budget !== undefined ? `£${Number(c.budget).toLocaleString()}` : '—'}</td>
                              <td>{matCount}</td>
                            </tr>
                          )
                        })}
                        {reportVisibleCampaigns.length === 0 && (
                          <tr><td colSpan={6} className={styles.rowMeta}>No campaigns found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )

            default:
              return null
          }
        }}
      </DashboardTemplate>

      {/* ── Campaign Create / Edit Modal ── */}
      {isCampaignModalOpen && (
        <div className={styles.modalBackdrop} onClick={() => setIsCampaignModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.cardHeader}>
              <h3>{isEditMode ? 'Edit Campaign' : 'New Campaign'}</h3>
              <button type="button" className={styles.pageBtn} onClick={() => setIsCampaignModalOpen(false)}>Close</button>
            </div>
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Campaign Name *</label>
                <input className={styles.formInput} value={campaignForm.name} onChange={(e) => setCampaignForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Q3 Oncology Push" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Category</label>
                <input className={styles.formInput} value={campaignForm.category} onChange={(e) => setCampaignForm((p) => ({ ...p, category: e.target.value }))} placeholder="e.g. Oncology" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Status</label>
                <select className={styles.formInput} value={campaignForm.status} onChange={(e) => setCampaignForm((p) => ({ ...p, status: e.target.value }))}>
                  {CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Budget (£)</label>
                <input type="number" className={styles.formInput} value={campaignForm.budget} onChange={(e) => setCampaignForm((p) => ({ ...p, budget: e.target.value }))} placeholder="0.00" min="0" step="0.01" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Start Date</label>
                <input type="date" className={styles.formInput} value={campaignForm.start_date} onChange={(e) => setCampaignForm((p) => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>End Date</label>
                <input type="date" className={styles.formInput} value={campaignForm.end_date} onChange={(e) => setCampaignForm((p) => ({ ...p, end_date: e.target.value }))} />
              </div>
              <div className={`${styles.formField} ${styles.formFieldFull}`}>
                <label className={styles.formLabel}>Description</label>
                <textarea className={styles.formInput} rows={3} value={campaignForm.description} onChange={(e) => setCampaignForm((p) => ({ ...p, description: e.target.value }))} placeholder="Short description of this campaign..." />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setIsCampaignModalOpen(false)}>Cancel</button>
              <button type="button" className={styles.primaryBtn} onClick={handleSaveCampaign} disabled={isSavingCampaign}>
                {isSavingCampaign ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Campaign Materials Modal (view / add materials for a campaign) ── */}
      {selectedCampaign && !isCampaignModalOpen && !isUploadModalOpen && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedCampaign(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.cardHeader}>
              <div>
                <h3>{selectedCampaign.name}</h3>
                <p className={styles.rowMeta}>{selectedCampaign.description || 'No description'}</p>
              </div>
              <button type="button" className={styles.pageBtn} onClick={() => setSelectedCampaign(null)}>Close</button>
            </div>
            <div className={styles.materialTabs} style={{ marginTop: 8 }}>
              <span className={`${styles.badge} ${selectedCampaign.status === 'Active' ? styles.badgeActive : ''}`}>{selectedCampaign.status}</span>
              {selectedCampaign.category && <span className={styles.badge}>{selectedCampaign.category}</span>}
              {selectedCampaign.budget !== null && selectedCampaign.budget !== undefined && (
                <span className={styles.rowMeta}>Budget: £{Number(selectedCampaign.budget).toLocaleString()}</span>
              )}
            </div>
            <h4 style={{ margin: '14px 0 8px' }}>Materials assigned to this campaign</h4>
            <div className={styles.materialsGrid}>
              {materials.filter((m) => m.campaign?.name === selectedCampaign.name).map((material) => {
                const Icon = getFileIcon(material.file_type)
                return (
                  <div key={material.id} className={styles.materialCard}>
                    <div className={styles.materialIcon}><Icon size={28} /></div>
                    <h4>{material.name || 'Untitled'}</h4>
                    <p>{(material.file_type || 'file').toUpperCase()} • {material.status || 'Submitted'}</p>
                    <p className={styles.rowMeta}>Last edited by {getMaterialEditorName(material)}</p>
                    <div className={styles.materialCardActions}>
                      <button type="button" className={styles.linkBtn} onClick={() => { setSelectedMaterial(material); setSelectedCampaign(null) }}>Details</button>
                      <button type="button" className={styles.linkBtn} onClick={() => handleFlagMaterial(material)}>Flag</button>
                    </div>
                  </div>
                )
              })}
              {materials.filter((m) => m.campaign?.name === selectedCampaign.name).length === 0 && (
                <p className={styles.rowMeta}>No materials assigned to this campaign yet.</p>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.primaryBtn} onClick={() => {
                const campId = selectedCampaign.id
                setSelectedCampaign(null)
                openUploadModal(campId)
              }}>
                <PlusIcon size={14} /> Add Material
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Material Detail / Timeline Modal ── */}
      {selectedMaterial && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedMaterial(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.cardHeader}>
              <h3>{selectedMaterial.name || 'Material details'}</h3>
              <button type="button" className={styles.pageBtn} onClick={() => setSelectedMaterial(null)}>Close</button>
            </div>
            <p className={styles.rowMeta}>ID: {selectedMaterial.id}</p>
            <p className={styles.rowMeta}>Status: <strong>{selectedMaterial.status || 'Unknown'}</strong></p>
            <p className={styles.rowMeta}>Campaign: {selectedMaterial.campaign?.name || 'Unassigned'}</p>
            <p className={styles.rowMeta}>Last edited by: {getMaterialEditorName(selectedMaterial)}</p>
            <div className={styles.materialCardActions}>
              <button type="button" className={styles.linkBtn} onClick={() => handleFlagMaterial(selectedMaterial)}>Flag For Compliance</button>
            </div>
            <h4 style={{ margin: '12px 0 6px' }}>Timeline</h4>
            <div className={styles.timelineList}>
              {buildMaterialTimeline(selectedMaterial).map((entry) => (
                <div key={entry.id} className={styles.timelineItem}>
                  <span className={styles.timelineDot}></span>
                  <div>
                    <strong>{entry.label}</strong>
                    <p className={styles.rowMeta}>By {entry.by}</p>
                    <p className={styles.rowMeta}>{new Date(entry.at).toLocaleString('en-GB')}</p>
                  </div>
                </div>
              ))}
              {buildMaterialTimeline(selectedMaterial).length === 0 && (
                <p className={styles.rowMeta}>No timeline events available.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Upload Material Modal ── */}
      {isUploadModalOpen && (
        <div className={styles.modalBackdrop} onClick={() => setIsUploadModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.cardHeader}>
              <h3>Upload Material</h3>
              <button type="button" className={styles.pageBtn} onClick={() => setIsUploadModalOpen(false)}>Close</button>
            </div>
            <div className={styles.formGrid}>
              <div className={`${styles.formField} ${styles.formFieldFull}`}>
                <label className={styles.formLabel}>File</label>
                <input type="file" onChange={handleUploadFileChange} style={{ padding: '8px 0' }} />
                {uploadFile && <p className={styles.rowMeta}>Selected: {uploadFile.name}</p>}
              </div>
              <div className={`${styles.formField} ${styles.formFieldFull}`}>
                <label className={styles.formLabel}>Material Name *</label>
                <input className={styles.formInput} value={uploadForm.name} onChange={(e) => setUploadForm((p) => ({ ...p, name: e.target.value }))} placeholder="Name for this material..." />
              </div>
              <div className={`${styles.formField} ${styles.formFieldFull}`}>
                <label className={styles.formLabel}>Assign to Campaign</label>
                <select className={styles.formInput} value={uploadForm.campaignId} onChange={(e) => setUploadForm((p) => ({ ...p, campaignId: e.target.value }))}>
                  <option value="">No campaign (unassigned)</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setIsUploadModalOpen(false)}>Cancel</button>
              <button type="button" className={styles.primaryBtn} onClick={handleSubmitUpload} disabled={isUploading || !uploadFile}>
                {isUploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
