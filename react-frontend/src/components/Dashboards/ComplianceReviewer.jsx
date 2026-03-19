import React, { useEffect, useMemo, useRef, useState } from 'react'
import DashboardTemplate from '../Layout/DashboardTemplate'
import styles from './ComplianceReviewer.module.css'
import campaignStyles from './CampaignManagement.module.css'
import { auditQueries, complianceQueries, materialQueries } from '../../services/supabaseHelpers'
import { BarChartIcon, CheckCircleIcon, ClipboardIcon, FileIcon, PlusIcon, VideoIcon } from '../Icons/IconSet'

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'material-approval-centre', label: 'Material Approval Centre' },
  { id: 'materials', label: 'Materials' },
  { id: 'audit-logs', label: 'Audit Logs' },
  { id: 'flagged-interactions', label: 'Flagged Interactions' },
  { id: 'reporting-analytics', label: 'Reporting & Analytics' },
]

const getFileIcon = (fileType) => {
  const t = (fileType || '').toLowerCase()
  if (t.includes('mp4') || t.includes('mov') || t.includes('avi') || t.includes('video')) return VideoIcon
  if (t.includes('ppt') || t.includes('presentation') || t.includes('pptx')) return ClipboardIcon
  if (t.includes('pdf')) return BarChartIcon
  if (t.includes('approved')) return CheckCircleIcon
  return FileIcon
}

export default function ComplianceReviewer() {
  const [actionMessage, setActionMessage] = useState('')
  const [trendScope, setTrendScope] = useState('Week')
  const [auditTab, setAuditTab] = useState('all')
  const [flagTab, setFlagTab] = useState('pending')
  const [materialSearch, setMaterialSearch] = useState('')
  const [materialTypeFilter, setMaterialTypeFilter] = useState('all')
  const [materialCampaignFilter, setMaterialCampaignFilter] = useState('all')
  const [batchNote, setBatchNote] = useState('')
  const [reviewNotes, setReviewNotes] = useState({})
  const [materials, setMaterials] = useState([])
  const [pendingMaterials, setPendingMaterials] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [materialToReplace, setMaterialToReplace] = useState(null)
  const [isReplacingMaterial, setIsReplacingMaterial] = useState(false)
  const uploadInputRef = useRef(null)
  const replaceMaterialInputRef = useRef(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)

    const [allMaterialsResult, pendingResult, logsResult, flagsResult] = await Promise.all([
      materialQueries.getAllMaterials(),
      materialQueries.getPendingApprovals(),
      auditQueries.getActivityLogs(),
      complianceQueries.getFlags(),
    ])

    if (allMaterialsResult.error) {
      setActionMessage(`Failed to load materials: ${allMaterialsResult.error}`)
    }

    if (pendingResult.error) {
      setActionMessage(`Failed to load pending approvals: ${pendingResult.error}`)
    }

    setMaterials(allMaterialsResult.data || [])
    setPendingMaterials(pendingResult.data || [])
    setAuditLogs(logsResult || [])
    setFlags(flagsResult || [])
    setLoading(false)
  }

  const handleReviewMaterial = async (materialId, status) => {
    const note = reviewNotes[materialId] || batchNote || `Updated by compliance reviewer: ${status}`
    const { error } = await materialQueries.reviewMaterial(materialId, status, note)

    if (error) {
      setActionMessage(`Failed to ${status.toLowerCase()} material: ${error}`)
      return
    }

    setActionMessage(`Material ${materialId} marked ${status}.`)
    await loadData()
  }

  const handleResolveFlag = async (flagId, nextStatus) => {
    const note = batchNote || `Flag reviewed and moved to ${nextStatus}`
    const updated = await complianceQueries.resolveFlag(flagId, nextStatus, note)

    if (!updated) {
      setActionMessage('Failed to update flag status.')
      return
    }

    setActionMessage(`Flag ${flagId} moved to ${nextStatus}.`)
    await loadData()
  }

  const exportAuditCsv = () => {
    const rows = filteredAuditLogs
    const header = ['User', 'Action', 'Timestamp', 'Details']
    const body = rows.map((row) => [
      row.user?.full_name || row.user?.email || 'System',
      row.action || 'Unknown',
      row.timestamp || '',
      JSON.stringify(row.details || {}),
    ])

    const csv = [header, ...body]
      .map((cols) => cols.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'compliance-audit-logs.csv'
    link.click()
    URL.revokeObjectURL(url)
    setActionMessage('Audit logs exported.')
  }

  const handleUploadClick = () => {
    uploadInputRef.current?.click()
  }

  const handleMaterialFileSelected = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setActionMessage('Uploading material...')

    const { error } = await materialQueries.submitMaterial(
      null,
      {
        name: file.name,
        description: 'Uploaded from Compliance Reviewer materials page',
      },
      file
    )

    if (error) {
      setActionMessage(`Upload failed: ${error}`)
    } else {
      setActionMessage(`${file.name} uploaded successfully.`)
      await loadData()
    }

    setIsUploading(false)
    event.target.value = ''
  }

  const handleReplaceMaterialClick = (material) => {
    setMaterialToReplace(material)
    replaceMaterialInputRef.current?.click()
  }

  const handleReplaceMaterialSelected = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !materialToReplace) {
      event.target.value = ''
      return
    }

    setIsReplacingMaterial(true)
    setActionMessage(`Replacing file for ${materialToReplace.name}...`)

    const { data, error } = await materialQueries.replaceMaterialFile(materialToReplace.id, file)
    if (error) {
      setActionMessage(`File replace failed: ${error}`)
      setIsReplacingMaterial(false)
      event.target.value = ''
      return
    }

    const updatedBy = data?.uploader?.full_name || data?.uploader?.email || 'current user'
    const updatedAt = data?.updated_at ? new Date(data.updated_at).toLocaleString('en-GB') : 'now'
    setActionMessage(`Updated ${data?.name || materialToReplace.name}. By ${updatedBy} at ${updatedAt}.`)
    setMaterialToReplace(null)
    setIsReplacingMaterial(false)
    event.target.value = ''
    await loadData()
  }

  const filteredMaterials = useMemo(() => {
    const q = materialSearch.trim().toLowerCase()
    if (!q) return pendingMaterials
    return pendingMaterials.filter((row) => (
      (row.name || '').toLowerCase().includes(q) ||
      (row.campaign?.name || '').toLowerCase().includes(q) ||
      (row.status || '').toLowerCase().includes(q)
    ))
  }, [pendingMaterials, materialSearch])

  const visibleMaterials = useMemo(() => {
    const q = materialSearch.trim().toLowerCase()
    return materials.filter((row) => {
      const type = (row.file_type || '').toLowerCase()
      const campaignName = (row.campaign?.name || '').toLowerCase()
      const status = (row.status || '').toLowerCase()

      const matchesSearch = !q ||
        (row.name || '').toLowerCase().includes(q) ||
        (row.description || '').toLowerCase().includes(q) ||
        type.includes(q) ||
        status.includes(q)

      const matchesType = materialTypeFilter === 'all' ||
        (materialTypeFilter === 'pdf' && type.includes('pdf')) ||
        (materialTypeFilter === 'video' && (type.includes('video') || type.includes('mp4') || type.includes('mov') || type.includes('avi'))) ||
        (materialTypeFilter === 'image' && (type.includes('image') || type.includes('png') || type.includes('jpg') || type.includes('jpeg') || type.includes('gif') || type.includes('webp') || type.includes('svg'))) ||
        (materialTypeFilter === 'ppt' && (type.includes('presentation') || type.includes('ppt') || type.includes('pptx'))) ||
        (materialTypeFilter === 'other' && !type.includes('pdf') && !type.includes('video') && !type.includes('mp4') && !type.includes('mov') && !type.includes('avi') && !type.includes('image') && !type.includes('png') && !type.includes('jpg') && !type.includes('jpeg') && !type.includes('gif') && !type.includes('webp') && !type.includes('svg') && !type.includes('presentation') && !type.includes('ppt') && !type.includes('pptx'))

      const matchesCampaign = materialCampaignFilter === 'all' ||
        (materialCampaignFilter === 'unassigned' && !campaignName) ||
        campaignName === materialCampaignFilter.toLowerCase()

      return matchesSearch && matchesType && matchesCampaign
    })
  }, [materials, materialSearch, materialTypeFilter, materialCampaignFilter])

  const campaignNames = useMemo(() => {
    return Array.from(new Set(materials.map((item) => item.campaign?.name).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [materials])

  const filteredAuditLogs = useMemo(() => {
    if (auditTab === 'all') return auditLogs
    if (auditTab === 'security') {
      return auditLogs.filter((row) => (row.resource_type || '').toLowerCase().includes('security') || (row.action || '').toLowerCase().includes('flag'))
    }
    if (auditTab === 'compliance') {
      return auditLogs.filter((row) => (row.resource_type || '').toLowerCase().includes('material') || (row.action || '').toLowerCase().includes('approve') || (row.action || '').toLowerCase().includes('reject'))
    }
    return auditLogs.filter((row) => !row.user_id)
  }, [auditTab, auditLogs])

  const filteredFlags = useMemo(() => {
    if (flagTab === 'pending') {
      return flags.filter((row) => (row.status || '').toLowerCase() !== 'resolved')
    }
    if (flagTab === 'investigation') {
      return flags.filter((row) => (row.status || '').toLowerCase().includes('investigation'))
    }
    return flags.filter((row) => (row.status || '').toLowerCase() === 'resolved')
  }, [flagTab, flags])

  const urgentFlags = useMemo(() => {
    return flags
      .filter((row) => (row.severity || '').toLowerCase() === 'high' && (row.status || '').toLowerCase() !== 'resolved')
      .slice(0, 3)
  }, [flags])

  const trendBars = useMemo(() => {
    const now = new Date()
    const getEventDate = (row) => new Date(row.reviewed_at || row.submission_date || row.updated_at || row.created_at)
    const reviewedMaterials = materials.filter((row) => ['approved', 'rejected'].includes((row.status || '').toLowerCase()))

    if (trendScope === 'Day') {
      const hourMs = 60 * 60 * 1000
      const bars = Array.from({ length: 7 }, (_, index) => {
        const start = new Date(now.getTime() - ((6 - index) * 4 * hourMs))
        const end = new Date(start.getTime() + (4 * hourMs))
        return reviewedMaterials.filter((row) => {
          const eventDate = getEventDate(row)
          return eventDate >= start && eventDate < end
        }).length
      })
      return bars
    }

    if (trendScope === 'Week') {
      const dayMs = 24 * 60 * 60 * 1000
      const bars = Array.from({ length: 7 }, (_, index) => {
        const start = new Date(now.getTime() - ((6 - index) * dayMs))
        const end = new Date(start.getTime() + dayMs)
        return reviewedMaterials.filter((row) => {
          const eventDate = getEventDate(row)
          return eventDate >= start && eventDate < end
        }).length
      })
      return bars
    }

    const bars = Array.from({ length: 7 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (6 - index), 1)
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      return reviewedMaterials.filter((row) => {
        const eventDate = getEventDate(row)
        return eventDate >= monthDate && eventDate < nextMonthDate
      }).length
    })

    return bars
  }, [trendScope, materials])

  const maxTrendValue = useMemo(() => {
    const maxValue = Math.max(...trendBars, 0)
    return maxValue > 0 ? maxValue : 1
  }, [trendBars])

  const stats = useMemo(() => {
    const pending = materials.filter((row) => (row.status || '').toLowerCase().includes('submitted') || (row.status || '').toLowerCase().includes('pending')).length
    const highRisk = flags.filter((row) => (row.severity || '').toLowerCase() === 'high' && (row.status || '').toLowerCase() !== 'resolved').length
    const totalReviewed = materials.filter((row) => ['approved', 'rejected'].includes((row.status || '').toLowerCase())).length
    const complianceRate = materials.length > 0 ? Math.round((totalReviewed / materials.length) * 1000) / 10 : 0

    return { pending, highRisk, complianceRate, totalReviewed }
  }, [materials, flags])

  if (loading) {
    return (
      <DashboardTemplate title="Compliance Reviewer Portal" tabs={TABS}>
        {() => (
          <div className={styles.tabContent}>
            <p className={styles.rowMeta}>Loading compliance data...</p>
          </div>
        )}
      </DashboardTemplate>
    )
  }

  return (
    <DashboardTemplate title="Compliance Reviewer Portal" tabs={TABS}>
      {(activeTab) => {
        switch (activeTab) {
          case 'dashboard':
            return (
              <div className={styles.tabContent}>
                {actionMessage && <p className={styles.rowMeta}>{actionMessage}</p>}
                <div className={styles.pageHeader}>
                  <h1>Dashboard Overview</h1>
                  <p>Status of pharmaceutical compliance across all departments.</p>
                </div>

                <div className={styles.kpiGrid}>
                  <div className={styles.kpiCard}>
                    <p className={styles.kpiLabel}>Pending Approvals</p>
                    <div className={styles.kpiRow}><h3>{stats.pending}</h3><span>Live</span></div>
                    <div className={styles.kpiTrack}><div className={styles.kpiFill} style={{ width: `${Math.min(100, stats.pending * 8)}%` }}></div></div>
                  </div>
                  <div className={styles.kpiCard}>
                    <p className={styles.kpiLabel}>High-Risk Flags</p>
                    <div className={styles.kpiRow}><h3>{stats.highRisk}</h3><span>Open</span></div>
                    <div className={styles.kpiTrack}><div className={styles.kpiFill} style={{ width: `${Math.min(100, stats.highRisk * 12)}%` }}></div></div>
                  </div>
                  <div className={styles.kpiCard}>
                    <p className={styles.kpiLabel}>Compliance Rate</p>
                    <div className={styles.kpiRow}><h3>{stats.complianceRate}%</h3><span>Reviewed</span></div>
                    <div className={styles.kpiTrack}><div className={styles.kpiFill} style={{ width: `${Math.min(100, stats.complianceRate)}%` }}></div></div>
                  </div>
                </div>

                <div className={styles.dashboardGrid}>
                  <section className={styles.chartCard}>
                    <div className={styles.cardHeader}>
                      <h3>Compliance Status Trend</h3>
                      <div className={styles.pillGroup}>
                        <button type="button" className={styles.filterPill} onClick={() => setTrendScope('Day')}>Day</button>
                        <button type="button" className={styles.filterPill} onClick={() => setTrendScope('Week')}>Week</button>
                        <button type="button" className={styles.filterPill} onClick={() => setTrendScope('Month')}>Month</button>
                      </div>
                    </div>
                    <div className={styles.barChartMock}>
                      {trendBars.map((height, index) => (
                        <div key={`trend-${index}`} style={{ height: `${Math.min(100, (height / maxTrendValue) * 100)}%` }} title={`${height} reviewed`}></div>
                      ))}
                    </div>
                    <p className={styles.rowMeta}>Based on real reviewed material events in the selected time window.</p>
                  </section>

                  <section className={styles.urgentCard}>
                    <h3>Urgent Flags</h3>
                    {urgentFlags.map((flag) => (
                      <div key={flag.id} className={styles.urgentItem}>
                        <strong>{flag.reason || 'Flag requires review'}</strong>
                        <span>{flag.severity || 'Unknown severity'} • {flag.created_at ? new Date(flag.created_at).toLocaleString() : 'No timestamp'}</span>
                      </div>
                    ))}
                    {urgentFlags.length === 0 && <p className={styles.rowMeta}>No urgent flags right now.</p>}
                    <button type="button" className={styles.primaryBtn} onClick={() => setFlagTab('pending')}>View All Flagged</button>
                  </section>
                </div>

                <div className={styles.tableCard}>
                  <div className={styles.cardHeader}>
                    <h3>Recent Material Reviews</h3>
                    <button type="button" className={styles.linkBtn} onClick={loadData}>Refresh</button>
                  </div>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Review ID</th>
                        <th>Campaign</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materials.slice(0, 5).map((row) => (
                        <tr key={row.id}>
                          <td>{row.id}</td>
                          <td>{row.campaign?.name || 'Unassigned'}</td>
                          <td><span className={styles.badge}>{(row.status || '').toLowerCase().includes('submitted') ? 'High' : 'Medium'}</span></td>
                          <td>{row.status}</td>
                          <td><button type="button" className={styles.iconBtn} onClick={() => handleReviewMaterial(row.id, 'Approved')}>Approve</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )

          case 'material-approval-centre':
            return (
              <div className={styles.tabContent}>
                {actionMessage && <p className={styles.rowMeta}>{actionMessage}</p>}
                <div className={styles.pageHeaderRow}>
                  <div>
                    <h1>Pending Materials Review</h1>
                    <p>{filteredMaterials.length} items</p>
                  </div>
                  <div className={styles.toolbarActions}>
                    <input className={styles.searchInput} placeholder="Search materials..." value={materialSearch} onChange={(e) => setMaterialSearch(e.target.value)} />
                    <button type="button" className={styles.secondaryBtn} onClick={loadData}>Refresh</button>
                  </div>
                </div>

                <div className={styles.tableCard}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Material ID</th>
                        <th>Asset Name</th>
                        <th>Submission Date</th>
                        <th>Status</th>
                        <th>Comments</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMaterials.map((row) => (
                        <tr key={row.id}>
                          <td>{row.id}</td>
                          <td>
                            <strong>{row.name}</strong>
                            <p className={styles.rowMeta}>{row.campaign?.name || 'No campaign'}</p>
                          </td>
                          <td>{row.submission_date ? new Date(row.submission_date).toLocaleDateString() : '-'}</td>
                          <td><span className={styles.badge}>{row.status}</span></td>
                          <td>
                            <input
                              className={styles.tableInput}
                              placeholder="Enter comment..."
                              value={reviewNotes[row.id] || ''}
                              onChange={(e) => setReviewNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
                            />
                          </td>
                          <td>
                            <div className={styles.actionStack}>
                              <button type="button" className={styles.primaryMiniBtn} onClick={() => handleReviewMaterial(row.id, 'Approved')}>Approve</button>
                              <button type="button" className={styles.secondaryMiniBtn} onClick={() => handleReviewMaterial(row.id, 'Rejected')}>Reject</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.noteCard}>
                  <h4>Global Batch Actions</h4>
                  <textarea className={styles.noteArea} placeholder="Add a global note to this batch..." value={batchNote} onChange={(e) => setBatchNote(e.target.value)}></textarea>
                  <div className={styles.noteRow}>
                    <span className={styles.rowMeta}>This note is used if a row comment is empty during approval/rejection.</span>
                    <button type="button" className={styles.primaryBtn} onClick={() => setActionMessage('Batch note saved.')}>Post Note</button>
                  </div>
                </div>
              </div>
            )

          case 'materials':
            return (
              <div className={styles.tabContent}>
                {actionMessage && <p className={styles.rowMeta}>{actionMessage}</p>}
                <input
                  ref={uploadInputRef}
                  type="file"
                  hidden
                  onChange={handleMaterialFileSelected}
                />
                <input
                  ref={replaceMaterialInputRef}
                  type="file"
                  hidden
                  onChange={handleReplaceMaterialSelected}
                />

                <div className={campaignStyles.pageHeaderRow}>
                  <div>
                    <h1>Materials Library</h1>
                    <p>Manage and organise your campaign assets. {materials.length} total.</p>
                  </div>
                  <button
                    type="button"
                    className={campaignStyles.primaryBtn}
                    onClick={handleUploadClick}
                    disabled={isUploading}
                  >
                    <PlusIcon size={16} /> {isUploading ? 'Uploading...' : 'Upload Material'}
                  </button>
                </div>

                <div className={campaignStyles.toolbar}>
                  <input
                    className={campaignStyles.searchInput}
                    placeholder="Search materials by name, type or status..."
                    value={materialSearch}
                    onChange={(e) => setMaterialSearch(e.target.value)}
                  />
                  <select
                    className={campaignStyles.filterSelect}
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

                <div className={campaignStyles.materialTabs}>
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
                      className={`${campaignStyles.tabPill} ${materialTypeFilter === tab.id ? campaignStyles.activePill : ''}`}
                      onClick={() => setMaterialTypeFilter(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className={campaignStyles.materialsGrid}>
                  {visibleMaterials.map((material) => {
                    const Icon = getFileIcon(material.file_type)
                    return (
                      <div className={campaignStyles.materialCard} key={material.id}>
                        <div className={campaignStyles.materialIcon}><Icon size={32} /></div>
                        <h4>{material.name || 'Untitled'}</h4>
                        <p>{(material.file_type || 'file').toUpperCase()} • {material.status || 'Submitted'}</p>
                        <p className={campaignStyles.rowMeta}>{material.campaign?.name ? `Campaign: ${material.campaign.name}` : 'Unassigned'}</p>
                        <p className={campaignStyles.rowMeta}>Updated {material.updated_at ? new Date(material.updated_at).toLocaleString('en-GB') : 'N/A'}</p>
                        <p className={campaignStyles.rowMeta}>Last uploaded by {material.uploader?.full_name || material.uploader?.email || 'Unknown'}</p>
                        <div className={campaignStyles.materialCardActions}>
                          <button
                            type="button"
                            className={campaignStyles.linkBtn}
                            onClick={() => setActionMessage(`${material.name || 'Material'} (${material.id})`)}
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            className={campaignStyles.linkBtn}
                            onClick={() => handleReplaceMaterialClick(material)}
                            disabled={isReplacingMaterial}
                          >
                            {isReplacingMaterial && materialToReplace?.id === material.id ? 'Updating…' : 'Replace'}
                          </button>
                          <button
                            type="button"
                            className={campaignStyles.linkBtn}
                            disabled={(material.status || '').toLowerCase() !== 'approved'}
                            title={(material.status || '').toLowerCase() !== 'approved' ? 'Only approved materials can be downloaded' : 'Download file'}
                            onClick={async () => {
                              const { data, error } = await materialQueries.getApprovedMaterialDownloadUrl(material)
                              if (error) {
                                setActionMessage(error)
                                return
                              }
                              window.open(data.url, '_blank', 'noopener,noreferrer')
                            }}
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {!loading && visibleMaterials.length === 0 && <p className={campaignStyles.rowMeta}>No materials found.</p>}
                  {loading && <p className={campaignStyles.rowMeta}>Loading materials...</p>}
                </div>
              </div>
            )

          case 'audit-logs':
            return (
              <div className={styles.tabContent}>
                {actionMessage && <p className={styles.rowMeta}>{actionMessage}</p>}
                <div className={styles.pageHeaderRow}>
                  <div>
                    <h1>Audit Logs</h1>
                    <p>Full traceability of system interactions and compliance changes.</p>
                  </div>
                  <div className={styles.toolbarActions}>
                    <button type="button" className={styles.secondaryBtn} onClick={loadData}>Refresh</button>
                    <button type="button" className={styles.primaryBtn} onClick={exportAuditCsv}>Export CSV</button>
                  </div>
                </div>

                <div className={styles.materialTabs}>
                  <button type="button" className={`${styles.tabPill} ${auditTab === 'all' ? styles.activePill : ''}`} onClick={() => setAuditTab('all')}>All Trails</button>
                  <button type="button" className={`${styles.tabPill} ${auditTab === 'security' ? styles.activePill : ''}`} onClick={() => setAuditTab('security')}>Security Events</button>
                  <button type="button" className={`${styles.tabPill} ${auditTab === 'compliance' ? styles.activePill : ''}`} onClick={() => setAuditTab('compliance')}>Compliance Actions</button>
                  <button type="button" className={`${styles.tabPill} ${auditTab === 'system' ? styles.activePill : ''}`} onClick={() => setAuditTab('system')}>System Logs</button>
                </div>

                <div className={styles.tableCard}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Action</th>
                        <th>Timestamp</th>
                        <th>Change Details</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAuditLogs.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <strong>{row.user?.full_name || row.user?.email || 'System'}</strong>
                            <p className={styles.rowMeta}>{row.user?.email || row.resource_type || 'System action'}</p>
                          </td>
                          <td>{row.action || 'Unknown action'}</td>
                          <td>{row.timestamp ? new Date(row.timestamp).toLocaleString() : '-'}</td>
                          <td>{JSON.stringify(row.details || {})}</td>
                          <td><span className={styles.badge}>{row.resource_type || 'info'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )

          case 'flagged-interactions':
            return (
              <div className={styles.tabContent}>
                {actionMessage && <p className={styles.rowMeta}>{actionMessage}</p>}
                <div className={styles.pageHeaderRow}>
                  <div>
                    <h1>Flagged Interactions</h1>
                    <p>Review and resolve high-risk HCP engagements.</p>
                  </div>
                  <div className={styles.toolbarActions}>
                    <button type="button" className={styles.secondaryBtn} onClick={loadData}>Refresh</button>
                    <button type="button" className={styles.primaryBtn} onClick={() => setActionMessage('Use row-level buttons to process flags.')}>Bulk Action</button>
                  </div>
                </div>

                <div className={styles.materialTabs}>
                  <button type="button" className={`${styles.tabPill} ${flagTab === 'pending' ? styles.activePill : ''}`} onClick={() => setFlagTab('pending')}>Pending Review</button>
                  <button type="button" className={`${styles.tabPill} ${flagTab === 'investigation' ? styles.activePill : ''}`} onClick={() => setFlagTab('investigation')}>Under Investigation</button>
                  <button type="button" className={`${styles.tabPill} ${flagTab === 'resolved' ? styles.activePill : ''}`} onClick={() => setFlagTab('resolved')}>Resolved</button>
                </div>

                <div className={styles.tableCard}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Date</th>
                        <th>HCP Name</th>
                        <th>Sales Rep</th>
                        <th>Risk Level</th>
                        <th>Reason</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFlags.map((row) => (
                        <tr key={row.id}>
                          <td>{row.id}</td>
                          <td>{row.created_at ? new Date(row.created_at).toLocaleDateString() : '-'}</td>
                          <td>{row.hcp_name || row.hcp_id || 'Unknown HCP'}</td>
                          <td>{row.sales_rep_name || row.flagged_by?.full_name || 'Unknown user'}</td>
                          <td><span className={`${styles.badge} ${styles[(row.severity || 'low').toLowerCase()]}`}>{row.severity || 'Low'}</span></td>
                          <td>{row.reason || row.details || 'No reason provided'}</td>
                          <td>
                            {(row.status || '').toLowerCase() === 'resolved' ? (
                              <span className={styles.rowMeta}>Resolved</span>
                            ) : (
                              <>
                                <button type="button" className={styles.linkBtn} onClick={() => handleResolveFlag(row.id, 'Under Investigation')}>Investigate</button>
                                {' / '}
                                <button type="button" className={styles.linkBtn} onClick={() => handleResolveFlag(row.id, 'Resolved')}>Resolve</button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.noteCard}>
                  <h4>Resolution Notes</h4>
                  <p>Use batch note above to attach a standard reason when progressing multiple records.</p>
                </div>
              </div>
            )

          case 'reporting-analytics':
            return (
              <div className={styles.tabContent}>
                <div className={styles.pageHeader}>
                  <h1>Reporting & Analytics</h1>
                  <p>Real-time compliance performance and risk assessment metrics.</p>
                </div>

                <div className={styles.kpiGrid}>
                  <div className={styles.kpiCard}><p className={styles.kpiLabel}>Total Reviews</p><div className={styles.kpiRow}><h3>{stats.totalReviewed}</h3><span>Completed</span></div><div className={styles.kpiTrack}><div className={styles.kpiFill} style={{ width: `${Math.min(100, stats.totalReviewed * 6)}%` }}></div></div></div>
                  <div className={styles.kpiCard}><p className={styles.kpiLabel}>Open Flags</p><div className={styles.kpiRow}><h3>{stats.highRisk}</h3><span>High severity open</span></div><div className={styles.kpiTrack}><div className={styles.kpiFill} style={{ width: `${Math.min(100, stats.highRisk * 12)}%` }}></div></div></div>
                  <div className={styles.kpiCard}><p className={styles.kpiLabel}>Compliance Rate</p><div className={styles.kpiRow}><h3>{stats.complianceRate}%</h3><span>Reviewed</span></div><div className={styles.kpiTrack}><div className={styles.kpiFill} style={{ width: `${Math.min(100, stats.complianceRate)}%` }}></div></div></div>
                </div>

                <div className={styles.analyticsGrid}>
                  <div className={styles.chartCard}>
                    <h3>Compliance Trends</h3>
                    <p>Trend bars are generated from real reviewed material timestamps.</p>
                    <div className={styles.barChartMock}>
                      {trendBars.map((height, index) => (
                        <div key={`analytics-${index}`} style={{ height: `${Math.min(100, (height / maxTrendValue) * 100)}%` }} title={`${height} reviewed`}></div>
                      ))}
                    </div>
                  </div>
                  <div className={styles.chartCard}>
                    <h3>Risk Distribution by Severity</h3>
                    <p>Weighted risk assessment across open flags.</p>
                    {['High', 'Medium', 'Low'].map((severity) => {
                      const count = flags.filter((row) => (row.severity || '').toLowerCase() === severity.toLowerCase()).length
                      const width = flags.length ? Math.round((count / flags.length) * 100) : 0
                      return (
                        <div key={severity} className={styles.barRow}>
                          <span>{severity}</span>
                          <div className={styles.inlineTrack}><div className={styles.inlineFill} style={{ width: `${width}%` }}></div></div>
                          <strong>{count}</strong>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )

          default:
            return null
        }
      }}
    </DashboardTemplate>
  )
}
