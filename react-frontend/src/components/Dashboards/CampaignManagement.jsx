import React, { useEffect, useMemo, useRef, useState } from 'react'
import DashboardTemplate from '../Layout/DashboardTemplate'
import Avatar from '../Shared/Avatar'
import FlagMaterialModal from '../Layout/FlagMaterialModal'
import MaterialsLibrary from './Shared/MaterialsLibrary'
import styles from './CampaignManagement.module.css'
import { auditQueries, campaignQueries, complianceQueries, folderQueries, materialQueries, taskQueries } from '../../services/supabaseHelpers'
import { useAuth } from '../../contexts/AuthContext'
import { normalizeRole } from '../../utils/roleUtils'
import {
  BarChartIcon,
  CheckCircleIcon,
  ClipboardIcon,
  FileIcon,
  FlagIcon,
  PlusIcon,
  VideoIcon,
} from '../Icons/IconSet'

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'campaign-management', label: 'Campaign Management' },
  { id: 'task-assignment', label: 'Task Assignment' },
  { id: 'materials', label: 'Materials' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'reporting-analytics', label: 'Reporting & Analytics' },
]

const WORKSPACE_CAPABILITIES = [
  'Plan and launch campaigns',
  'Assign field execution tasks',
  'Coordinate material readiness',
  'Track approvals and outcomes',
]

const PAGE_INTENTS = {
  dashboard: {
    title: 'Campaign Operations Dashboard',
    description: 'Monitor campaign health, pending approvals, and team momentum before deciding your next action.',
  },
  'campaign-management': {
    title: 'Campaign Management',
    description: 'Create, edit, and sequence campaigns so downstream teams always work from a clear plan.',
  },
  'task-assignment': {
    title: 'Task Assignment',
    description: 'Assign the right work to Sales & Marketing and Liaison teams with clear due dates and priorities.',
  },
  materials: {
    title: 'Materials Coordination',
    description: 'Organise campaign assets, folders, and replace outdated files with full visibility.',
  },
  approvals: {
    title: 'Approval Queue',
    description: 'Review pending items and route decisions quickly so campaigns do not stall.',
  },
  'reporting-analytics': {
    title: 'Reporting & Analytics',
    description: 'Understand campaign performance, blockers, and completion trends across activities.',
  },
}

const WORKFLOW_ACTIONS = [
  { tabId: 'dashboard', label: 'Overview' },
  { tabId: 'campaign-management', label: 'Plan Campaigns' },
  { tabId: 'task-assignment', label: 'Assign Work' },
  { tabId: 'materials', label: 'Align Materials' },
  { tabId: 'approvals', label: 'Clear Approvals' },
]

const CAMPAIGN_STATUSES = ['Planning', 'Active', 'On Hold', 'Archived']
const TASK_ASSIGNMENT_ALLOWED_ROLES = new Set(['marketing_sales', 'liaison_officer'])

const BLANK_CAMPAIGN_FORM = {
  name: '',
  description: '',
  status: 'Planning',
  start_date: '',
  end_date: '',
  budget: '',
  category: '',
}

const BLANK_ASSIGNMENT_FORM = {
  title: '',
  description: '',
  assigned_to: '',
  related_campaign_id: '',
  due_date: '',
  priority: 'Medium',
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

const toRoleLabel = (role) => String(role || '')
  .split('_')
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ')

export default function CampaignManagement() {
  const { userProfile, cachedRole } = useAuth()

  // ─── Data state ───────────────────────────────────────────────────────
  const [campaigns, setCampaigns] = useState([])
  const [materials, setMaterials] = useState([])
  const [folders, setFolders] = useState([])
  const [pendingApprovals, setPendingApprovals] = useState([])
  const [activityLogs, setActivityLogs] = useState([])
  const [teamTasks, setTeamTasks] = useState([])
  const [assignableUsers, setAssignableUsers] = useState([])

  // ─── Loading state ────────────────────────────────────────────────────
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)
  const [loadingMaterials, setLoadingMaterials] = useState(true)
  const [loadingApprovals, setLoadingApprovals] = useState(true)
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isReplacingMaterial, setIsReplacingMaterial] = useState(false)
  const [isSavingCampaign, setIsSavingCampaign] = useState(false)
  const [isAssigningTask, setIsAssigningTask] = useState(false)

  // ─── UI state ─────────────────────────────────────────────────────────
  const [actionMessage, setActionMessage] = useState('')
  const [campaignSearch, setCampaignSearch] = useState('')
  const [materialSearch, setMaterialSearch] = useState('')
  const [materialTypeFilter, setMaterialTypeFilter] = useState('all')
  const [materialCampaignFilter, setMaterialCampaignFilter] = useState('all')
  const [materialFolderFilter, setMaterialFolderFilter] = useState('all')
  const [approvalFilter, setApprovalFilter] = useState('all')
  const [reportSearch, setReportSearch] = useState('')
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState('All')
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderCampaignId, setNewFolderCampaignId] = useState('')
  const [assignMaterialId, setAssignMaterialId] = useState('')
  const [assignFolderId, setAssignFolderId] = useState('')
  const [assignmentForm, setAssignmentForm] = useState(BLANK_ASSIGNMENT_FORM)
  const [flaggedMaterialIds, setFlaggedMaterialIds] = useState(new Set())
  const [flaggingMaterial, setFlaggingMaterial] = useState(null)
  const [materialVersions, setMaterialVersions] = useState([])
  const [loadingMaterialVersions, setLoadingMaterialVersions] = useState(false)
  const [downloadingVersionId, setDownloadingVersionId] = useState(null)

  // ─── Modals ───────────────────────────────────────────────────────────
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [campaignForm, setCampaignForm] = useState(BLANK_CAMPAIGN_FORM)
  const [editingCampaignId, setEditingCampaignId] = useState(null)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [materialToReplace, setMaterialToReplace] = useState(null)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [uploadForm, setUploadForm] = useState({ campaignId: '', folderId: '', name: '', notes: '' })
  const [uploadFile, setUploadFile] = useState(null)
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false)
  const [replaceFile, setReplaceFile] = useState(null)
  const [launchOverrideModal, setLaunchOverrideModal] = useState({
    isOpen: false,
    reason: '',
    blockedReason: '',
    payload: null,
  })

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
    setLoadingTasks(true)

    const [campaignsRes, materialsRes, approvalsRes, logs, foldersRes, flagsRes, tasksRes, usersRes] = await Promise.all([
      campaignQueries.getAllCampaigns(),
      materialQueries.getAllMaterials(),
      materialQueries.getPendingApprovals(),
      auditQueries.getActivityLogs(),
      folderQueries.getFolders(),
      complianceQueries.getFlags(),
      taskQueries.getTasksAssignedByMe(),
      taskQueries.getAssignableUsers(),
    ])

    if (campaignsRes.error) setActionMessage(`Campaigns: ${campaignsRes.error}`)
    if (materialsRes.error) setActionMessage(`Materials: ${materialsRes.error}`)
    if (approvalsRes.error) setActionMessage(`Approvals: ${approvalsRes.error}`)
    if (tasksRes.error) setActionMessage(`Tasks: ${tasksRes.error}`)
    if (usersRes.error) setActionMessage(`Assignable users: ${usersRes.error}`)

    setCampaigns(campaignsRes.data || [])
    setMaterials(materialsRes.data || [])
    setPendingApprovals(approvalsRes.data || [])
    setActivityLogs(Array.isArray(logs) ? logs : [])
    setFolders(foldersRes.data || [])
    setTeamTasks(tasksRes.data || [])
    setAssignableUsers(usersRes.data || [])
    setFlaggedMaterialIds(new Set(
      (flagsRes || [])
        .filter((row) => (row.status || '').toLowerCase() !== 'resolved')
        .map((row) => row.material_id)
        .filter(Boolean)
    ))

    setLoadingCampaigns(false)
    setLoadingMaterials(false)
    setLoadingApprovals(false)
    setLoadingTasks(false)
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
    if (materialFolderFilter !== 'all') {
      result = result.filter((m) =>
        materialFolderFilter === 'unassigned'
          ? !m.folder?.id
          : m.folder?.id === materialFolderFilter
      )
    }
    return result
  }, [materials, materialSearch, materialTypeFilter, materialCampaignFilter, materialFolderFilter])

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

  const visibleFolders = useMemo(() => {
    if (materialCampaignFilter === 'all' || materialCampaignFilter === 'unassigned') {
      return folders
    }
    const campaign = campaigns.find((c) => c.name === materialCampaignFilter)
    return folders.filter((folder) => folder.campaign_id === campaign?.id)
  }, [folders, materialCampaignFilter, campaigns])

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

  const assignedTaskMetrics = useMemo(() => {
    const open = teamTasks.filter((task) => (task.status || '').toLowerCase() !== 'completed').length
    const completed = teamTasks.filter((task) => (task.status || '').toLowerCase() === 'completed').length
    const overdue = teamTasks.filter((task) => {
      if (!task.due_date) return false
      if ((task.status || '').toLowerCase() === 'completed') return false
      const due = new Date(task.due_date)
      return !Number.isNaN(due.getTime()) && due < new Date()
    }).length

    return {
      total: teamTasks.length,
      open,
      completed,
      overdue,
    }
  }, [teamTasks])

  const uniqueTaskAssignees = useMemo(() => {
    const names = teamTasks
      .map((task) => task.assignee?.full_name || task.assignee?.email)
      .filter(Boolean)
    return ['All', ...Array.from(new Set(names)).sort()]
  }, [teamTasks])

  const visibleAssignableTasks = useMemo(() => {
    const filtered = taskAssigneeFilter === 'All'
      ? teamTasks
      : teamTasks.filter((task) => {
          const name = task.assignee?.full_name || task.assignee?.email || ''
          return name === taskAssigneeFilter
        })
    return [...filtered]
      .sort((a, b) => {
        const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER
        const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER
        return aDue - bDue
      })
  }, [teamTasks, taskAssigneeFilter])

  const resolvedRole = normalizeRole(userProfile?.role || cachedRole || 'no_role')
  const canOverrideCampaignLaunch = resolvedRole === 'campaign_management' || resolvedRole === 'admin'
  const assignableUsersForCampaignTasks = useMemo(
    () => assignableUsers.filter((user) => TASK_ASSIGNMENT_ALLOWED_ROLES.has(normalizeRole(user.role))),
    [assignableUsers]
  )
  const assigneeHelperText = 'Assign tasks to Sales & Marketing or Liaison Officers only.'

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

  const saveCampaignRecord = async (payload, options = {}) => {
    let result
    if (isEditMode && editingCampaignId) {
      result = await campaignQueries.updateCampaign(editingCampaignId, payload)
    } else {
      result = await campaignQueries.createCampaign(payload)
    }

    if (result.error) {
      return { error: result.error }
    }

    if (options.override) {
      const auditDetails = {
        override_reason: options.overrideReason || 'No reason provided',
        blocked_reason: options.blockedReason || null,
        campaign_name: payload.name,
        campaign_status: payload.status,
        related_materials_checked: options.relatedMaterialCount ?? null,
      }

      await auditQueries.logActivity(
        'campaign_launch_override',
        'campaigns',
        isEditMode ? editingCampaignId : (result.data?.id || null),
        auditDetails
      )
    }

    return { error: null }
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

    if (payload.status === 'Active') {
      if (!isEditMode || !editingCampaignId) {
        setActionMessage('Create campaigns as Planning first. Activate only after approved materials are attached.')
        setIsSavingCampaign(false)
        return
      }

      const relatedMaterials = materials.filter((material) => material.campaign?.id === editingCampaignId)
      if (relatedMaterials.length === 0) {
        const blockedReason = 'Activation blocked: add at least one approved material before launch.'
        if (canOverrideCampaignLaunch) {
          setLaunchOverrideModal({
            isOpen: true,
            reason: '',
            blockedReason,
            payload,
          })
          setIsSavingCampaign(false)
          return
        }
        setActionMessage(blockedReason)
        setIsSavingCampaign(false)
        return
      }

      const unapprovedMaterials = relatedMaterials.filter((material) => (material.status || '').toLowerCase() !== 'approved')
      if (unapprovedMaterials.length > 0) {
        const sampleNames = unapprovedMaterials.slice(0, 3).map((material) => material.name || material.id).join(', ')
        const blockedReason = `Activation blocked: ${unapprovedMaterials.length} material(s) are not approved (${sampleNames}).`
        if (canOverrideCampaignLaunch) {
          setLaunchOverrideModal({
            isOpen: true,
            reason: '',
            blockedReason,
            payload,
          })
          setIsSavingCampaign(false)
          return
        }
        setActionMessage(blockedReason)
        setIsSavingCampaign(false)
        return
      }
    }

    const { error } = await saveCampaignRecord(payload)

    setIsSavingCampaign(false)
    if (error) {
      setActionMessage(`Failed to save campaign: ${error}`)
      return
    }
    setActionMessage(isEditMode ? `Campaign "${payload.name}" updated.` : `Campaign "${payload.name}" created.`)
    setIsCampaignModalOpen(false)
    await loadAll()
  }

  const handleConfirmLaunchOverride = async () => {
    if (!launchOverrideModal.payload) {
      setLaunchOverrideModal({ isOpen: false, reason: '', blockedReason: '', payload: null })
      return
    }

    const reason = launchOverrideModal.reason.trim()
    if (!reason) {
      setActionMessage('Override reason is required to continue.')
      return
    }

    setIsSavingCampaign(true)
    const relatedMaterialCount = materials.filter((material) => material.campaign?.id === editingCampaignId).length
    const { error } = await saveCampaignRecord(launchOverrideModal.payload, {
      override: true,
      overrideReason: reason,
      blockedReason: launchOverrideModal.blockedReason,
      relatedMaterialCount,
    })
    setIsSavingCampaign(false)

    if (error) {
      setActionMessage(`Failed to save campaign override: ${error}`)
      return
    }

    setActionMessage('Campaign activated using override. Reason captured in audit logs.')
    setLaunchOverrideModal({ isOpen: false, reason: '', blockedReason: '', payload: null })
    setIsCampaignModalOpen(false)
    await loadAll()
  }

  const handleAssignTask = async () => {
    if (!assignmentForm.title.trim()) {
      setActionMessage('Task title is required.')
      return
    }

    if (!assignmentForm.assigned_to) {
      setActionMessage('Select a team member to assign this task.')
      return
    }

    const selectedAssignee = assignableUsersForCampaignTasks.find((user) => user.id === assignmentForm.assigned_to)
    if (!selectedAssignee) {
      setActionMessage('Tasks from Campaign Management can only be assigned to Sales & Marketing or Liaison Officers.')
      return
    }

    setIsAssigningTask(true)

    const { error } = await taskQueries.createTask({
      title: assignmentForm.title.trim(),
      description: assignmentForm.description.trim() || null,
      assigned_to: assignmentForm.assigned_to,
      related_campaign_id: assignmentForm.related_campaign_id || null,
      due_date: assignmentForm.due_date || null,
      priority: assignmentForm.priority,
      status: 'Open',
    })

    if (error) {
      setActionMessage(`Task assignment failed: ${error}`)
      setIsAssigningTask(false)
      return
    }

    setActionMessage('Task assigned successfully.')
    setAssignmentForm(BLANK_ASSIGNMENT_FORM)
    setIsAssigningTask(false)
    await loadAll()
  }

  // ─── Upload modal ─────────────────────────────────────────────────────
  const openUploadModal = (preselectedCampaignId = '') => {
    setUploadForm({ campaignId: preselectedCampaignId, folderId: '', name: '', notes: '' })
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
      {
        name: uploadForm.name.trim(),
        description: uploadForm.notes.trim() || 'Uploaded from Campaign Management',
        folder_id: uploadForm.folderId || null,
      },
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

  const resetUploadForm = () => {
    setUploadForm({ campaignId: '', folderId: '', name: '', notes: '' })
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
    await loadAll()
  }

  const handleAssignMaterialToCampaign = async (campaignId) => {
    if (!assignMaterialId) {
      setActionMessage('Choose a material to assign.')
      return
    }

    const { data, error } = await materialQueries.assignMaterialToCampaign(assignMaterialId, campaignId, assignFolderId || null)
    if (error) {
      setActionMessage(`Material assignment failed: ${error}`)
      return
    }

    setActionMessage(`${data?.name || assignMaterialId} assigned to campaign.`)
    setAssignMaterialId('')
    setAssignFolderId('')
    await loadAll()
  }

  // ─── Replace file ─────────────────────────────────────────────────────
  const handleReplaceMaterialClick = (material) => {
    setMaterialToReplace(material)
    setReplaceFile(null)
    setIsReplaceModalOpen(true)
  }

  const handleReplaceFileSelected = (e) => {
    const file = e.target.files?.[0]
    setReplaceFile(file || null)
  }

  const handleSubmitReplace = async () => {
    if (!replaceFile || !materialToReplace) return
    setIsReplacingMaterial(true)
    setActionMessage(`Replacing file for ${materialToReplace.name}...`)
    const { data, error } = await materialQueries.replaceMaterialFile(materialToReplace.id, replaceFile)
    if (error) {
      setActionMessage(`Replace failed: ${error}`)
    } else {
      const by = data?.uploader?.full_name || data?.uploader?.email || 'you'
      setActionMessage(`${data?.name || materialToReplace.name} updated by ${by}.`)
      await loadAll()
    }
    setMaterialToReplace(null)
    setReplaceFile(null)
    setIsReplacingMaterial(false)
    setIsReplaceModalOpen(false)
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

    setFlaggedMaterialIds((prev) => {
      const next = new Set(prev)
      next.add(flaggingMaterial.id)
      return next
    })
    setActionMessage(`Material ${flaggingMaterial.name || flaggingMaterial.id} flagged for compliance review.`)
    setFlaggingMaterial(null)
    await loadAll()
    return { error: null }
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
      <DashboardTemplate
        title="Campaign Management Portal"
        tabs={TABS}
        roleName="Campaign Management Workspace"
        roleSummary="This workspace links planning, task assignment, materials, and approvals so teams can execute campaigns without handoff confusion."
        roleCapabilities={WORKSPACE_CAPABILITIES}
        pageIntents={PAGE_INTENTS}
        globalActions={WORKFLOW_ACTIONS}
      >
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
                            <th>Status</th>
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
                                <span className={styles.badge}>{item.status || 'Submitted'}</span>
                                <p className={styles.rowMeta}>Compliance reviewer action required</p>
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

            /* ──────────────────── TASK ASSIGNMENT ──────────────────── */
            case 'task-assignment':
              return (
                <div className={styles.tabContent}>
                  {actionMessage && <p className={styles.rowMeta}>{actionMessage}</p>}

                  <div className={styles.pageHeaderRow}>
                    <div>
                      <h1>Task Assignment</h1>
                      <p>Assign campaign work to Marketing, Compliance, and Liaison teams.</p>
                    </div>
                    <button type="button" className={styles.secondaryBtn} onClick={loadAll}>Refresh</button>
                  </div>

                  <div className={styles.kpiGrid}>
                    <div className={styles.kpiCard}>
                      <p className={styles.kpiLabel}>Open Tasks</p>
                      <div className={styles.kpiRow}><h3>{loadingTasks ? '—' : assignedTaskMetrics.open}</h3><span>in progress</span></div>
                      <div className={styles.kpiTrack}><div className={styles.kpiFill} style={{ width: `${Math.min(100, assignedTaskMetrics.open * 10)}%` }}></div></div>
                    </div>
                    <div className={styles.kpiCard}>
                      <p className={styles.kpiLabel}>Completed Tasks</p>
                      <div className={styles.kpiRow}><h3>{loadingTasks ? '—' : assignedTaskMetrics.completed}</h3><span>closed</span></div>
                      <div className={styles.kpiTrack}><div className={styles.kpiFill} style={{ width: `${Math.min(100, assignedTaskMetrics.completed * 10)}%` }}></div></div>
                    </div>
                    <div className={styles.kpiCard}>
                      <p className={styles.kpiLabel}>Overdue Tasks</p>
                      <div className={styles.kpiRow}><h3>{loadingTasks ? '—' : assignedTaskMetrics.overdue}</h3><span>needs action</span></div>
                      <div className={styles.kpiTrack}><div className={styles.kpiFill} style={{ width: `${Math.min(100, assignedTaskMetrics.overdue * 20)}%` }}></div></div>
                    </div>
                  </div>

                  <div className={styles.tableCard}>
                    <div className={styles.cardHeader}>
                      <h3>Create Assignment</h3>
                      <span className={styles.rowMeta}>{assigneeHelperText}</span>
                    </div>
                    <div className={styles.formGrid}>
                      <div className={styles.formField}>
                        <label className={styles.formLabel}>Task Title *</label>
                        <input
                          className={styles.formInput}
                          value={assignmentForm.title}
                          placeholder="e.g. Review HCP outreach deck"
                          onChange={(e) => setAssignmentForm((prev) => ({ ...prev, title: e.target.value }))}
                        />
                      </div>
                      <div className={styles.formField}>
                        <label className={styles.formLabel}>Assignee *</label>
                        <select
                          className={styles.formInput}
                          value={assignmentForm.assigned_to}
                          onChange={(e) => setAssignmentForm((prev) => ({ ...prev, assigned_to: e.target.value }))}
                        >
                          <option value="">Select a user</option>
                          {assignableUsersForCampaignTasks.map((user) => (
                            <option key={user.id} value={user.id}>
                              {(user.full_name || user.email || user.id)} - {toRoleLabel(user.role)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.formField}>
                        <label className={styles.formLabel}>Campaign</label>
                        <select
                          className={styles.formInput}
                          value={assignmentForm.related_campaign_id}
                          onChange={(e) => setAssignmentForm((prev) => ({ ...prev, related_campaign_id: e.target.value }))}
                        >
                          <option value="">General / cross-campaign</option>
                          {campaigns.map((campaign) => (
                            <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.formField}>
                        <label className={styles.formLabel}>Priority</label>
                        <select
                          className={styles.formInput}
                          value={assignmentForm.priority}
                          onChange={(e) => setAssignmentForm((prev) => ({ ...prev, priority: e.target.value }))}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                      <div className={styles.formField}>
                        <label className={styles.formLabel}>Due Date</label>
                        <input
                          type="date"
                          className={styles.formInput}
                          value={assignmentForm.due_date}
                          onChange={(e) => setAssignmentForm((prev) => ({ ...prev, due_date: e.target.value }))}
                        />
                      </div>
                      <div className={`${styles.formField} ${styles.formFieldFull}`}>
                        <label className={styles.formLabel}>Task Description</label>
                        <textarea
                          rows={3}
                          className={styles.formInput}
                          value={assignmentForm.description}
                          placeholder="Include expected deliverables and compliance context."
                          onChange={(e) => setAssignmentForm((prev) => ({ ...prev, description: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className={styles.modalFooter}>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => setAssignmentForm(BLANK_ASSIGNMENT_FORM)}
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        className={styles.primaryBtn}
                        disabled={isAssigningTask}
                        onClick={handleAssignTask}
                      >
                        {isAssigningTask ? 'Assigning...' : 'Assign Task'}
                      </button>
                    </div>
                  </div>

                  <div className={styles.tableCard}>
                    <div className={styles.cardHeader}>
                      <h3>Assigned Task Tracker</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.72rem', color: 'var(--text-muted, #888)', gap: '2px' }}>
                          Filter by Assignee
                          <select
                            className={styles.formInput}
                            style={{ minWidth: '180px' }}
                            value={taskAssigneeFilter}
                            onChange={(e) => setTaskAssigneeFilter(e.target.value)}
                          >
                            {uniqueTaskAssignees.map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        </label>
                        <span className={styles.rowMeta}>{visibleAssignableTasks.length} / {assignedTaskMetrics.total} task(s)</span>
                      </div>
                    </div>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Task</th>
                          <th>Assigned To</th>
                          <th>Status</th>
                          <th>Priority</th>
                          <th>Due Date</th>
                          <th>Campaign Link</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleAssignableTasks.map((task) => (
                          <tr key={task.id}>
                            <td>
                              <strong>{task.title || task.id}</strong>
                              <p className={styles.rowMeta}>{task.description || 'No description'}</p>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Avatar
                                  name={task.assignee?.full_name || task.assignee?.email || '?'}
                                  src={task.assignee?.avatar_url || task.assignee?.profile_picture_url || null}
                                  size="sm"
                                />
                                <span>{task.assignee?.full_name || task.assignee?.email || '—'}</span>
                              </div>
                            </td>
                            <td><span className={styles.badge}>{task.status || 'Open'}</span></td>
                            <td>{task.priority || 'Medium'}</td>
                            <td>{task.due_date ? new Date(task.due_date).toLocaleDateString('en-GB') : '—'}</td>
                            <td>{campaigns.find((c) => c.id === task.related_campaign_id)?.name || 'General'}</td>
                          </tr>
                        ))}
                        {!loadingTasks && visibleAssignableTasks.length === 0 && (
                          <tr><td colSpan={6} className={styles.rowMeta}>No tasks assigned yet. Use the form above to assign your first task.</td></tr>
                        )}
                        {loadingTasks && (
                          <tr><td colSpan={6} className={styles.rowMeta}>Loading tasks...</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )

            /* ──────────────────── MATERIALS ──────────────────── */
            case 'materials':
              return (
                <MaterialsLibrary
                  tabClassName={styles.tabContent}
                  actionMessage={actionMessage}
                  actionMessageClassName={styles.rowMeta}
                  uploadButtonLabel="Upload Material"
                  isUploading={isUploading}
                  materials={materials}
                  visibleMaterials={visibleMaterials}
                  loading={loadingMaterials}
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
                    campaigns,
                    folders,
                    onNameChange: (value) => setUploadForm((prev) => ({ ...prev, name: value })),
                    onNotesChange: (value) => setUploadForm((prev) => ({ ...prev, notes: value })),
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
                    campaigns,
                    folders,
                    onCreateFolder: handleCreateFolder,
                  }}
                />
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
                          <th>Status</th>
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
                              <span className={styles.badge}>{row.status || 'Submitted'}</span>
                              <p className={styles.rowMeta}>Read-only in Campaign Management</p>
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
                const isFlagged = flaggedMaterialIds.has(material.id)
                return (
                  <div key={material.id} className={styles.materialCard}>
                    <div className={styles.materialIcon}><Icon size={28} /></div>
                    <button
                      type="button"
                      className={`${styles.flagIconBtn} ${styles.cardFlagTopRight} ${isFlagged ? styles.flagIconBtnActive : ''}`}
                      onClick={() => handleFlagMaterial(material)}
                      title={isFlagged ? 'Flagged for compliance review' : 'Flag for compliance review'}
                      aria-label={isFlagged ? 'Flagged for compliance review' : 'Flag for compliance review'}
                    >
                      <FlagIcon size={16} active={isFlagged} />
                    </button>
                    <h4>{material.name || 'Untitled'}</h4>
                    <p>{(material.file_type || 'file').toUpperCase()} • {material.status || 'Submitted'}</p>
                    <p className={styles.rowMeta}>Folder: {material.folder?.name || 'No folder'}</p>
                    <p className={styles.rowMeta}>Last edited by {getMaterialEditorName(material)}</p>
                    <div className={styles.materialCardActions}>
                      <button type="button" className={styles.linkBtn} onClick={() => { openMaterialDetails(material); setSelectedCampaign(null) }}>Details</button>
                    </div>
                  </div>
                )
              })}
              {materials.filter((m) => m.campaign?.name === selectedCampaign.name).length === 0 && (
                <p className={styles.rowMeta}>No materials assigned to this campaign yet.</p>
              )}
            </div>
            <div className={styles.assignmentBox}>
              <h4 style={{ margin: 0 }}>Assign Existing Material</h4>
              <div className={styles.assignmentRow}>
                <select className={styles.filterSelect} value={assignMaterialId} onChange={(e) => setAssignMaterialId(e.target.value)}>
                  <option value="">Select material</option>
                  {materials
                    .filter((m) => m.campaign?.id !== selectedCampaign.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>{m.name || m.id}</option>
                    ))}
                </select>
                <select className={styles.filterSelect} value={assignFolderId} onChange={(e) => setAssignFolderId(e.target.value)}>
                  <option value="">No folder</option>
                  {folders
                    .filter((folder) => !folder.campaign_id || folder.campaign_id === selectedCampaign.id)
                    .map((folder) => (
                      <option key={folder.id} value={folder.id}>{folder.name}</option>
                    ))}
                </select>
                <button type="button" className={styles.primaryBtn} onClick={() => handleAssignMaterialToCampaign(selectedCampaign.id)}>Assign</button>
              </div>
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
            <p className={styles.rowMeta}>Folder: {selectedMaterial.folder?.name || 'No folder'}</p>
            <p className={styles.rowMeta}>Last edited by: {getMaterialEditorName(selectedMaterial)}</p>
            <div className={styles.materialCardActions}>
              <button
                type="button"
                className={`${styles.flagIconBtn} ${flaggedMaterialIds.has(selectedMaterial.id) ? styles.flagIconBtnActive : ''}`}
                onClick={() => handleFlagMaterial(selectedMaterial)}
                title={flaggedMaterialIds.has(selectedMaterial.id) ? 'Flagged for compliance review' : 'Flag for compliance review'}
                aria-label={flaggedMaterialIds.has(selectedMaterial.id) ? 'Flagged for compliance review' : 'Flag for compliance review'}
              >
                <FlagIcon size={16} active={flaggedMaterialIds.has(selectedMaterial.id)} />
              </button>
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
            <h4 style={{ margin: '14px 0 6px' }}>Version History</h4>
            <div className={styles.timelineList}>
              {loadingMaterialVersions && <p className={styles.rowMeta}>Loading versions...</p>}
              {!loadingMaterialVersions && materialVersions.map((version) => (
                <div key={version.id} className={styles.timelineItem}>
                  <span className={styles.timelineDot}></span>
                  <div>
                    <strong>Version {version.version_number}</strong>
                    <p className={styles.rowMeta}>{version.file_type || 'file'} uploaded by {version.uploader?.full_name || version.uploader?.email || 'Unknown user'}</p>
                    <p className={styles.rowMeta}>{version.created_at ? new Date(version.created_at).toLocaleString('en-GB') : 'No timestamp'}</p>
                    {version.change_reason && <p className={styles.rowMeta}>Reason: {version.change_reason}</p>}
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => handleDownloadMaterialVersion(version)}
                      disabled={downloadingVersionId === version.id}
                    >
                      {downloadingVersionId === version.id ? 'Preparing download...' : 'Download'}
                    </button>
                  </div>
                </div>
              ))}
              {!loadingMaterialVersions && materialVersions.length === 0 && (
                <p className={styles.rowMeta}>No versions captured yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {launchOverrideModal.isOpen && (
        <div className={styles.modalBackdrop} onClick={() => setLaunchOverrideModal({ isOpen: false, reason: '', blockedReason: '', payload: null })}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.cardHeader}>
              <h3>Launch Override Required</h3>
              <button
                type="button"
                className={styles.pageBtn}
                onClick={() => setLaunchOverrideModal({ isOpen: false, reason: '', blockedReason: '', payload: null })}
              >
                Close
              </button>
            </div>
            <p className={styles.rowMeta}>{launchOverrideModal.blockedReason}</p>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Override Reason *</label>
              <textarea
                rows={4}
                className={styles.formInput}
                value={launchOverrideModal.reason}
                placeholder="Explain why launch should proceed despite incomplete approvals."
                onChange={(e) => setLaunchOverrideModal((prev) => ({ ...prev, reason: e.target.value }))}
              />
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setLaunchOverrideModal({ isOpen: false, reason: '', blockedReason: '', payload: null })}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={handleConfirmLaunchOverride}
                disabled={isSavingCampaign}
              >
                {isSavingCampaign ? 'Saving...' : 'Confirm Override and Launch'}
              </button>
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
                <button
                  type="button"
                  className={styles.pageBtn}
                  onClick={() => document.getElementById('campaignUploadFileInput').click()}
                  style={{ marginBottom: '8px' }}
                >
                  Choose File
                </button>
                <input
                  id="campaignUploadFileInput"
                  type="file"
                  hidden
                  onChange={handleUploadFileChange}
                />
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
              <div className={`${styles.formField} ${styles.formFieldFull}`}>
                <label className={styles.formLabel}>Assign to Folder</label>
                <select className={styles.formInput} value={uploadForm.folderId} onChange={(e) => setUploadForm((p) => ({ ...p, folderId: e.target.value }))}>
                  <option value="">No folder</option>
                  {folders
                    .filter((folder) => !uploadForm.campaignId || !folder.campaign_id || folder.campaign_id === uploadForm.campaignId)
                    .map((folder) => (
                      <option key={folder.id} value={folder.id}>{folder.name}</option>
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

      {isReplaceModalOpen && materialToReplace && (
        <div className={styles.modalBackdrop} onClick={() => setIsReplaceModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.cardHeader}>
              <h3>Replace Material</h3>
              <button type="button" className={styles.pageBtn} onClick={() => setIsReplaceModalOpen(false)}>Close</button>
            </div>
            <div className={styles.formGrid}>
              <div className={`${styles.formField} ${styles.formFieldFull}`}>
                <label className={styles.formLabel}>Current Material</label>
                <p className={styles.rowMeta}>{materialToReplace.name}</p>
              </div>
              <div className={`${styles.formField} ${styles.formFieldFull}`}>
                <label className={styles.formLabel}>New File</label>
                <button
                  type="button"
                  className={styles.pageBtn}
                  onClick={() => document.getElementById('campaignReplaceFileInput').click()}
                  style={{ marginBottom: '8px' }}
                >
                  Choose File
                </button>
                <input
                  id="campaignReplaceFileInput"
                  type="file"
                  hidden
                  onChange={handleReplaceFileSelected}
                />
                {replaceFile && <p className={styles.rowMeta}>Selected: {replaceFile.name}</p>}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setIsReplaceModalOpen(false)}>Cancel</button>
              <button type="button" className={styles.primaryBtn} onClick={handleSubmitReplace} disabled={isReplacingMaterial || !replaceFile}>
                {isReplacingMaterial ? 'Replacing...' : 'Replace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
