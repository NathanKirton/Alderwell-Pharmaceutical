import React, { useEffect, useMemo, useRef, useState } from 'react'
import DashboardTemplate from '../Layout/DashboardTemplate'
import FlagMaterialModal from '../Layout/FlagMaterialModal'
import MaterialsLibrary from './Shared/MaterialsLibrary'
import styles from './ComplianceReviewer.module.css'
import campaignStyles from './CampaignManagement.module.css'
import { auditQueries, complianceQueries, folderQueries, materialQueries, campaignQueries } from '../../services/supabaseHelpers'
import { BarChartIcon, CheckCircleIcon, ClipboardIcon, FileIcon, FlagIcon, VideoIcon } from '../Icons/IconSet'

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'material-approval-centre', label: 'Material Approval Centre' },
  { id: 'materials', label: 'Materials' },
  { id: 'campaign-logs', label: 'Campaign Logs' },
  { id: 'audit-logs', label: 'Audit Logs' },
  { id: 'flagged-interactions', label: 'Flagged Interactions' },
  { id: 'reporting-analytics', label: 'Reporting & Analytics' },
]

const WORKSPACE_CAPABILITIES = [
  'Review and decide material approvals',
  'Investigate and resolve compliance flags',
  'Audit traceability across actions',
  'Report risk and compliance trends',
]

const PAGE_INTENTS = {
  dashboard: {
    title: 'Compliance Oversight Dashboard',
    description: 'Track live risk signals and move quickly to the exact review queue that needs attention.',
  },
  'material-approval-centre': {
    title: 'Material Approval Centre',
    description: 'Approve or reject submitted assets with notes to keep decisions transparent and auditable.',
  },
  materials: {
    title: 'Material Evidence Library',
    description: 'Inspect materials, versions, and flags in one place before or after review.',
  },
  'audit-logs': {
    title: 'Audit Logs',
    description: 'Trace who changed what and when to support governance and investigations.',
  },
  'flagged-interactions': {
    title: 'Flagged Interactions',
    description: 'Resolve open flags consistently and escalate high-risk issues without delay.',
  },
  'reporting-analytics': {
    title: 'Compliance Reporting',
    description: 'View trend metrics and risk concentration to inform policy and operations.',
  },
}

const WORKFLOW_ACTIONS = [
  { tabId: 'dashboard', label: 'Overview' },
  { tabId: 'material-approval-centre', label: 'Review Queue' },
  { tabId: 'flagged-interactions', label: 'Resolve Flags' },
  { tabId: 'audit-logs', label: 'Open Audit Trail' },
  { tabId: 'reporting-analytics', label: 'View Reporting' },
]

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

export default function ComplianceReviewer() {
  const [actionMessage, setActionMessage] = useState('')
  const [trendScope, setTrendScope] = useState('Week')
  const [auditTab, setAuditTab] = useState('all')
  const [flagTab, setFlagTab] = useState('pending')
  const [materialSearch, setMaterialSearch] = useState('')
  const [materialTypeFilter, setMaterialTypeFilter] = useState('all')
  const [materialCampaignFilter, setMaterialCampaignFilter] = useState('all')
  const [materialFolderFilter, setMaterialFolderFilter] = useState('all')
  const [reviewNotes, setReviewNotes] = useState({})
  const [materials, setMaterials] = useState([])
  const [folders, setFolders] = useState([])
  const [pendingMaterials, setPendingMaterials] = useState([])
  const [myPastApprovals, setMyPastApprovals] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [campaignLogs, setCampaignLogs] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [campaignLogFilter, setCampaignLogFilter] = useState('all')
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderCampaignId, setNewFolderCampaignId] = useState('')
  const [uploadForm, setUploadForm] = useState({ campaignId: '', folderId: '', name: '' })
  const [materialToReplace, setMaterialToReplace] = useState(null)
  const [isReplacingMaterial, setIsReplacingMaterial] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [materialVersions, setMaterialVersions] = useState([])
  const [loadingMaterialVersions, setLoadingMaterialVersions] = useState(false)
  const [downloadingVersionId, setDownloadingVersionId] = useState(null)
  const [flaggingMaterial, setFlaggingMaterial] = useState(null)
  const replaceMaterialInputRef = useRef(null)
  const [uploadFile, setUploadFile] = useState(null)

  const handleUploadFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadFile(file)
    if (!uploadForm.name) {
      setUploadForm((prev) => ({ ...prev, name: file.name }))
    }
  }

  const handleSubmitUpload = async () => {
    if (!uploadFile) {
      setActionMessage('Please select a file.')
      return
    }
    if (!uploadForm.name.trim()) {
      setActionMessage('Please enter a material name.')
      return
    }

    setIsUploading(true)
    setActionMessage('Uploading material...')

    const { error } = await materialQueries.submitMaterial(
      uploadForm.campaignId || null,
      {
        name: uploadForm.name.trim(),
        description: 'Uploaded from Compliance Reviewer materials page',
        folder_id: uploadForm.folderId || null,
      },
      uploadFile
    )

    if (error) {
      setActionMessage(`Upload failed: ${error}`)
    } else {
      setActionMessage(`${uploadForm.name.trim()} uploaded successfully.`)
      setUploadForm({ campaignId: '', folderId: '', name: '' })
      setUploadFile(null)
      await loadData()
    }

    setIsUploading(false)
  }

  const resetUploadForm = () => {
    setUploadForm({ campaignId: '', folderId: '', name: '' })
    setUploadFile(null)
  }

  const handleCreateFolder = async () => {
    const trimmedName = newFolderName.trim()
    if (!trimmedName) {
      setActionMessage('Folder name is required.')
      return
    }

    const { error } = await folderQueries.createFolder({
      name: trimmedName,
      campaignId: newFolderCampaignId || null,
    })

    if (error) {
      setActionMessage(`Folder creation failed: ${error}`)
      return
    }

    setActionMessage(`Folder "${trimmedName}" created.`)
    setNewFolderName('')
    setNewFolderCampaignId('')
    await loadData()
  }



  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)

    const [allMaterialsResult, pendingResult, myPastApprovalsResult, logsResult, campaignLogsResult, flagsResult, foldersResult, campaignsResult] = await Promise.all([
      materialQueries.getAllMaterials(),
      materialQueries.getPendingApprovals(),
      materialQueries.getMyPastApprovals(),
      auditQueries.getActivityLogs(),
      auditQueries.getActivityLogs({ resourceType: 'campaigns' }),
      complianceQueries.getFlags(),
      folderQueries.getFolders(),
      campaignQueries.getAllCampaigns(),
    ])

    if (allMaterialsResult.error) {
      setActionMessage(`Failed to load materials: ${allMaterialsResult.error}`)
    }

    if (pendingResult.error) {
      setActionMessage(`Failed to load pending approvals: ${pendingResult.error}`)
    }

    if (myPastApprovalsResult.error) {
      setActionMessage(`Failed to load your past approvals: ${myPastApprovalsResult.error}`)
    }

    setMaterials(allMaterialsResult.data || [])
    setFolders(foldersResult.data || [])
    setPendingMaterials(pendingResult.data || [])
    setMyPastApprovals(myPastApprovalsResult.data || [])
    setAuditLogs(logsResult || [])
    setCampaignLogs(campaignLogsResult || [])
    setFlags(flagsResult || [])
    setCampaigns((campaignsResult && campaignsResult.data) || [])
    setLoading(false)
  }
  // Filtered campaign logs by selected campaign
  const filteredCampaignLogs = useMemo(() => {
    if (campaignLogFilter === 'all') return campaignLogs
    return campaignLogs.filter((log) => String(log.resource_id) === String(campaignLogFilter))
  }, [campaignLogs, campaignLogFilter])

  const handleReviewMaterial = async (materialId, status) => {
    const note = reviewNotes[materialId] || `Updated by compliance reviewer: ${status}`
    const { error } = await materialQueries.reviewMaterial(materialId, status, note)

    if (error) {
      setActionMessage(`Failed to ${status.toLowerCase()} material: ${error}`)
      return
    }

    setActionMessage(`Material ${materialId} marked ${status}.`)
    await loadData()
  }

  const handleResolveFlag = async (flagId, nextStatus) => {
    const note = `Flag reviewed and moved to ${nextStatus}`
    const { error } = await complianceQueries.resolveFlag(flagId, nextStatus, note)

    if (error) {
      setActionMessage(`Failed to update flag status: ${error}`)
      return
    }

    setActionMessage(`Flag ${flagId} moved to ${nextStatus}.`)
    if ((nextStatus || '').toLowerCase() === 'under review') {
      setFlagTab('investigation')
    }
    await loadData()
  }

  const handleFlagMaterial = async (material) => {
    if (!material?.id) {
      setActionMessage('Cannot flag this item: missing material id.')
      return
    }

    setFlaggingMaterial(material)
  }

  const submitFlagForMaterial = async ({ reason, severity, details }) => {
    if (!flaggingMaterial?.id) {
      return { error: 'No material selected.' }
    }

    const normalizedSeverity = (severity || 'Medium').trim()

    const { error } = await complianceQueries.createFlag({
      material_id: flaggingMaterial.id,
      reason: details ? `${reason}\n\nDetails: ${details}` : reason,
      severity: ['Low', 'Medium', 'High', 'Critical'].includes(normalizedSeverity) ? normalizedSeverity : 'Medium',
      status: 'Open',
    })

    if (error) {
      return { error }
    }

    setActionMessage(`Material ${flaggingMaterial.name || flaggingMaterial.id} flagged for compliance review.`)
    setFlaggingMaterial(null)
    await loadData()
    return { error: null }
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

  const openMaterialDetails = async (material) => {
    setSelectedMaterial(material)
    setLoadingMaterialVersions(true)

    const { data, error } = await materialQueries.getMaterialVersions(material.id)
    if (error) {
      setActionMessage(`Version history unavailable: ${error}`)
      setMaterialVersions([])
      setLoadingMaterialVersions(false)
      return
    }

    setMaterialVersions(data || [])
    setLoadingMaterialVersions(false)
  }

  const handleDownloadMaterialVersion = async (version) => {
    if (!version) return

    setDownloadingVersionId(version.id)
    const { data, error } = await materialQueries.getMaterialVersionDownloadUrl(version)
    if (error) {
      setActionMessage(error)
      setDownloadingVersionId(null)
      return
    }

    window.open(data.url, '_blank', 'noopener,noreferrer')
    setDownloadingVersionId(null)
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

      const matchesFolder = materialFolderFilter === 'all' ||
        (materialFolderFilter === 'unassigned' && !row.folder?.id) ||
        row.folder?.id === materialFolderFilter

      return matchesSearch && matchesType && matchesCampaign && matchesFolder
    })
  }, [materials, materialSearch, materialTypeFilter, materialCampaignFilter, materialFolderFilter])

  const campaignNames = useMemo(() => {
    return Array.from(new Set(materials.map((item) => item.campaign?.name).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [materials])

  const uploadCampaigns = useMemo(() => {
    const byId = new Map()
    materials.forEach((item) => {
      if (item.campaign?.id && item.campaign?.name && !byId.has(item.campaign.id)) {
        byId.set(item.campaign.id, { id: item.campaign.id, name: item.campaign.name })
      }
    })
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [materials])

  const visibleFolders = useMemo(() => {
    if (materialCampaignFilter === 'all' || materialCampaignFilter === 'unassigned') {
      return folders
    }
    const campaign = materials.find((item) => item.campaign?.name === materialCampaignFilter)?.campaign
    return folders.filter((folder) => folder.campaign_id === campaign?.id)
  }, [folders, materialCampaignFilter, materials])

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
      return flags.filter((row) => {
        const status = (row.status || '').toLowerCase()
        return status === 'open' || status === 'false alarm'
      })
    }
    if (flagTab === 'investigation') {
      return flags.filter((row) => (row.status || '').toLowerCase() === 'under review')
    }
    return flags.filter((row) => (row.status || '').toLowerCase() === 'resolved')
  }, [flagTab, flags])

  const urgentFlags = useMemo(() => {
    return flags
      .filter((row) => {
        const severity = (row.severity || '').toLowerCase()
        const status = (row.status || '').toLowerCase()
        return (severity === 'high' || severity === 'critical') && status !== 'resolved'
      })
      .slice(0, 3)
  }, [flags])

  const flaggedMaterialIds = useMemo(() => {
    return new Set(
      flags
        .filter((row) => (row.status || '').toLowerCase() !== 'resolved')
        .map((row) => row.material_id)
        .filter(Boolean)
    )
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

  const trendLabels = useMemo(() => {
    const now = new Date()

    if (trendScope === 'Day') {
      const hourMs = 60 * 60 * 1000
      return Array.from({ length: 7 }, (_, index) => {
        const slotStart = new Date(now.getTime() - ((6 - index) * 4 * hourMs))
        return slotStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      })
    }

    if (trendScope === 'Week') {
      const dayMs = 24 * 60 * 60 * 1000
      return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(now.getTime() - ((6 - index) * dayMs))
        return day.toLocaleDateString([], { weekday: 'short' })
      })
    }

    return Array.from({ length: 7 }, (_, index) => {
      const month = new Date(now.getFullYear(), now.getMonth() - (6 - index), 1)
      return month.toLocaleDateString([], { month: 'short' })
    })
  }, [trendScope])

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
      <DashboardTemplate
        title="Compliance Reviewer Portal"
        tabs={TABS}
        roleName="Compliance Reviewer Workspace"
        roleSummary="This workspace links approvals, flag handling, and audit evidence so compliance decisions remain clear and defensible."
        roleCapabilities={WORKSPACE_CAPABILITIES}
        pageIntents={PAGE_INTENTS}
        globalActions={WORKFLOW_ACTIONS}
      >
        {() => (
          <div className={styles.tabContent}>
            <p className={styles.rowMeta}>Loading compliance data...</p>
          </div>
        )}
      </DashboardTemplate>
    )
  }

  return (
    <>
      <DashboardTemplate
        title="Compliance Reviewer Portal"
        tabs={TABS}
        roleName="Compliance Reviewer Workspace"
        roleSummary="This workspace links approvals, flag handling, and audit evidence so compliance decisions remain clear and defensible."
        roleCapabilities={WORKSPACE_CAPABILITIES}
        pageIntents={PAGE_INTENTS}
        globalActions={WORKFLOW_ACTIONS}
      >
      {(activeTab, setActiveTab) => {
        switch (activeTab) {
                    case 'campaign-logs':
                      return (
                        <div className={styles.tabContent}>
                          <div className={styles.pageHeader}>
                            <h1>Campaign Activity Logs</h1>
                            <p>Review all actions and changes related to campaigns for compliance and audit purposes.</p>
                          </div>
                          <div style={{ marginBottom: 16 }}>
                            <label htmlFor="campaign-log-filter" style={{ fontWeight: 500, marginRight: 8 }}>Filter by Campaign:</label>
                            <select
                              id="campaign-log-filter"
                              value={campaignLogFilter}
                              onChange={e => setCampaignLogFilter(e.target.value)}
                              style={{ minWidth: 180, padding: 4 }}
                            >
                              <option value="all">All Campaigns</option>
                              {campaigns.map((c) => (
                                <option key={c.id} value={c.id}>{c.name || c.id}</option>
                              ))}
                            </select>
                          </div>
                          <div className={styles.tableCard}>
                            <table className={styles.table}>
                              <thead>
                                <tr>
                                  <th>Timestamp</th>
                                  <th>User</th>
                                  <th>Action</th>
                                  <th>Campaign</th>
                                  <th>Details</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredCampaignLogs.length === 0 && (
                                  <tr><td colSpan={5} className={styles.rowMeta}>No campaign activity logs found.</td></tr>
                                )}
                                {filteredCampaignLogs.map((log) => {
                                  const campaign = campaigns.find(c => String(c.id) === String(log.resource_id))
                                  return (
                                    <tr key={log.id}>
                                      <td>{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</td>
                                      <td>{log.user?.full_name || log.user?.email || 'System'}</td>
                                      <td>{log.action}</td>
                                      <td>{campaign ? campaign.name : log.resource_id}</td>
                                      <td><pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{JSON.stringify(log.details, null, 2)}</pre></td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
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
                    <div className={styles.chartTimeline}>
                      {trendLabels.map((label, index) => (
                        <span key={`timeline-dashboard-${index}`} className={styles.chartTick}>{label}</span>
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
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={() => {
                        setFlagTab('pending')
                        setActiveTab('flagged-interactions')
                      }}
                    >
                      View All Flagged
                    </button>
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

                <div className={styles.tableCard}>
                  <div className={styles.cardHeader}>
                    <h3>My Past Approvals</h3>
                    <span className={styles.rowMeta}>{myPastApprovals.length} review{myPastApprovals.length !== 1 ? 's' : ''}</span>
                  </div>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Material ID</th>
                        <th>Asset Name</th>
                        <th>Campaign</th>
                        <th>Decision</th>
                        <th>Reviewed On</th>
                        <th>Comment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myPastApprovals.map((row) => (
                        <tr key={`history-${row.id}-${row.reviewed_at || row.updated_at || row.created_at}`}>
                          <td>{row.id}</td>
                          <td>{row.name || 'Untitled'}</td>
                          <td>{row.campaign?.name || 'No campaign'}</td>
                          <td><span className={styles.badge}>{row.status || 'Reviewed'}</span></td>
                          <td>{row.reviewed_at ? new Date(row.reviewed_at).toLocaleString() : '-'}</td>
                          <td>{row.review_notes || 'No comment added'}</td>
                        </tr>
                      ))}
                      {myPastApprovals.length === 0 && (
                        <tr>
                          <td colSpan={6} className={styles.rowMeta}>No past approvals found for your account.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )

          case 'materials':
            return (
              <MaterialsLibrary
                tabClassName={styles.tabContent}
                actionMessage={actionMessage}
                actionMessageClassName={styles.rowMeta}
                replaceInputRef={replaceMaterialInputRef}
                onReplaceChange={handleReplaceMaterialSelected}
                uploadButtonLabel="Upload Material"
                isUploading={isUploading}
                materials={materials}
                visibleMaterials={visibleMaterials}
                loading={loading}
                materialSearch={materialSearch}
                onMaterialSearchChange={setMaterialSearch}
                materialCampaignFilter={materialCampaignFilter}
                onMaterialCampaignFilterChange={setMaterialCampaignFilter}
                campaignNames={campaignNames}
                materialFolderFilter={materialFolderFilter}
                onMaterialFolderFilterChange={setMaterialFolderFilter}
                visibleFolders={visibleFolders}
                materialTypeFilter={materialTypeFilter}
                onMaterialTypeFilterChange={setMaterialTypeFilter}
                getFileIcon={getFileIcon}
                flaggedMaterialIds={flaggedMaterialIds}
                onFlagMaterial={handleFlagMaterial}
                getMaterialEditorName={getMaterialEditorName}
                onOpenDetails={openMaterialDetails}
                onReplaceMaterial={handleReplaceMaterialClick}
                isReplacingMaterial={isReplacingMaterial}
                replacingMaterialId={materialToReplace?.id || null}
                onDownloadMaterial={async (material) => {
                  const { data, error } = await materialQueries.getApprovedMaterialDownloadUrl(material)
                  if (error) {
                    setActionMessage(error)
                    return
                  }
                  window.open(data.url, '_blank', 'noopener,noreferrer')
                }}
                uploadManager={{
                  enabled: true,
                  form: uploadForm,
                  fileName: uploadFile?.name || '',
                  campaigns: uploadCampaigns,
                  folders,
                  onNameChange: (value) => setUploadForm((prev) => ({ ...prev, name: value })),
                  onCampaignChange: (value) => setUploadForm((prev) => ({
                    ...prev,
                    campaignId: value,
                    folderId: prev.folderId && !folders.some((folder) => folder.id === prev.folderId && (!value || !folder.campaign_id || folder.campaign_id === value)) ? '' : prev.folderId,
                  })),
                  onFolderChange: (value) => setUploadForm((prev) => ({ ...prev, folderId: value })),
                  onFileChange: handleUploadFileChange,
                  onSubmit: handleSubmitUpload,
                  onReset: resetUploadForm,
                }}
                folderManager={{
                  enabled: true,
                  newFolderName,
                  onNewFolderNameChange: setNewFolderName,
                  newFolderCampaignId,
                  onNewFolderCampaignIdChange: setNewFolderCampaignId,
                  campaigns: uploadCampaigns,
                  folders,
                  onCreateFolder: handleCreateFolder,
                }}
              />
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
                        <th>Subject</th>
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
                          <td>{row.hcp_name || row.material?.name || row.campaign?.name || row.hcp_id || 'Unknown subject'}</td>
                          <td>{row.sales_rep_name || row.flagged_by?.full_name || row.flagged_by?.email || 'Unknown user'}</td>
                          <td><span className={`${styles.badge} ${styles[(row.severity || 'low').toLowerCase()]}`}>{row.severity || 'Low'}</span></td>
                          <td>{row.reason || row.details || 'No reason provided'}</td>
                          <td>
                            {(row.status || '').toLowerCase() === 'resolved' ? (
                              <span className={styles.rowMeta}>Resolved</span>
                            ) : (
                              <>
                                <button type="button" className={styles.linkBtn} onClick={() => handleResolveFlag(row.id, 'Under Review')}>Investigate</button>
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
                  <p>A default system note is stored automatically for each Investigate or Resolve action.</p>
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
                    <div className={styles.chartTimeline}>
                      {trendLabels.map((label, index) => (
                        <span key={`timeline-analytics-${index}`} className={styles.chartTick}>{label}</span>
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

      {selectedMaterial && (
        <div className={campaignStyles.modalBackdrop} onClick={() => setSelectedMaterial(null)}>
          <div className={campaignStyles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={campaignStyles.cardHeader}>
              <h3>{selectedMaterial.name || 'Material details'}</h3>
              <button type="button" className={campaignStyles.pageBtn} onClick={() => setSelectedMaterial(null)}>Close</button>
            </div>
            <p className={campaignStyles.rowMeta}>ID: {selectedMaterial.id}</p>
            <p className={campaignStyles.rowMeta}>Status: <strong>{selectedMaterial.status || 'Unknown'}</strong></p>
            <p className={campaignStyles.rowMeta}>Campaign: {selectedMaterial.campaign?.name || 'Unassigned'}</p>
            <p className={campaignStyles.rowMeta}>Folder: {selectedMaterial.folder?.name || 'No folder'}</p>
            <p className={campaignStyles.rowMeta}>Last edited by: {getMaterialEditorName(selectedMaterial)}</p>
            <div className={campaignStyles.materialCardActions}>
              <button
                type="button"
                className={`${campaignStyles.flagIconBtn} ${flaggedMaterialIds.has(selectedMaterial.id) ? campaignStyles.flagIconBtnActive : ''}`}
                onClick={() => handleFlagMaterial(selectedMaterial)}
                title={flaggedMaterialIds.has(selectedMaterial.id) ? 'Flagged for compliance review' : 'Flag for compliance review'}
                aria-label={flaggedMaterialIds.has(selectedMaterial.id) ? 'Flagged for compliance review' : 'Flag for compliance review'}
              >
                <FlagIcon size={16} active={flaggedMaterialIds.has(selectedMaterial.id)} />
              </button>
            </div>
            <h4 style={{ margin: '12px 0 6px' }}>Timeline</h4>
            <div className={campaignStyles.timelineList}>
              {buildMaterialTimeline(selectedMaterial).map((entry) => (
                <div key={entry.id} className={campaignStyles.timelineItem}>
                  <span className={campaignStyles.timelineDot}></span>
                  <div>
                    <strong>{entry.label}</strong>
                    <p className={campaignStyles.rowMeta}>By {entry.by}</p>
                    <p className={campaignStyles.rowMeta}>{new Date(entry.at).toLocaleString('en-GB')}</p>
                  </div>
                </div>
              ))}
              {buildMaterialTimeline(selectedMaterial).length === 0 && (
                <p className={campaignStyles.rowMeta}>No timeline events available.</p>
              )}
            </div>
            <h4 style={{ margin: '14px 0 6px' }}>Version History</h4>
            <div className={campaignStyles.timelineList}>
              {loadingMaterialVersions && <p className={campaignStyles.rowMeta}>Loading versions...</p>}
              {!loadingMaterialVersions && materialVersions.map((version) => (
                <div key={version.id} className={campaignStyles.timelineItem}>
                  <span className={campaignStyles.timelineDot}></span>
                  <div>
                    <strong>Version {version.version_number}</strong>
                    <p className={campaignStyles.rowMeta}>{version.file_type || 'file'} uploaded by {version.uploader?.full_name || version.uploader?.email || 'Unknown user'}</p>
                    <p className={campaignStyles.rowMeta}>{version.created_at ? new Date(version.created_at).toLocaleString('en-GB') : 'No timestamp'}</p>
                    {version.change_reason && <p className={campaignStyles.rowMeta}>Reason: {version.change_reason}</p>}
                    <button
                      type="button"
                      className={campaignStyles.linkBtn}
                      onClick={() => handleDownloadMaterialVersion(version)}
                      disabled={downloadingVersionId === version.id}
                    >
                      {downloadingVersionId === version.id ? 'Preparing download...' : 'Download'}
                    </button>
                  </div>
                </div>
              ))}
              {!loadingMaterialVersions && materialVersions.length === 0 && (
                <p className={campaignStyles.rowMeta}>No versions captured yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <FlagMaterialModal
        isOpen={Boolean(flaggingMaterial)}
        material={flaggingMaterial}
        onClose={() => setFlaggingMaterial(null)}
        onSubmit={submitFlagForMaterial}
      />
    </>
  )
}
