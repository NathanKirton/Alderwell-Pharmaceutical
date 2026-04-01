import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DashboardTemplate from '../Layout/DashboardTemplate'
import Avatar from '../Shared/Avatar'
import FlagMaterialModal from '../Layout/FlagMaterialModal'
import MaterialsLibrary from './Shared/MaterialsLibrary'
import styles from './MarketingSales.module.css'
import campaignStyles from './CampaignManagement.module.css'
import { auditQueries, campaignQueries, complianceQueries, folderQueries, hcpQueries, materialQueries, taskQueries } from '../../services/supabaseHelpers'
import { useAuth } from '../../contexts/AuthContext'
import {
  PlusIcon,
  CalendarIcon,
  UserGroupIcon,
  EnvelopeIcon,
  FileIcon,
  FlagIcon,
  BarChartIcon,
  VideoIcon,
  ClipboardIcon,
  CheckCircleIcon,
} from '../Icons/IconSet'

// Simple red bin SVG icon
const BinIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="6" width="18" height="14" rx="2"/>
    <line x1="9" y1="10" x2="9" y2="16" />
    <line x1="15" y1="10" x2="15" y2="16" />
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="10" y1="2" x2="14" y2="2" />
    <line x1="12" y1="2" x2="12" y2="6" />
  </svg>
)


export default function MarketingSales() {
  // All hooks/state
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [tasks, setTasks] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [materialSearch, setMaterialSearch] = useState('');
  const [materialTypeFilter, setMaterialTypeFilter] = useState('all');
  const [materialCampaignFilter, setMaterialCampaignFilter] = useState('all');
  const [materialFolderFilter, setMaterialFolderFilter] = useState('all');
  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignStatusFilter, setCampaignStatusFilter] = useState('all');
  const [actionMessage, setActionMessage] = useState('');
  const [hcpList, setHcpList] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingCrm, setIsLoadingCrm] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [crmSearch, setCrmSearch] = useState('');
  const [crmSpecialismFilter, setCrmSpecialismFilter] = useState('all');
  const [crmRegionFilter, setCrmRegionFilter] = useState('all');
  const [currentCrmPage, setCurrentCrmPage] = useState(1);
  const [interactionHcpId, setInteractionHcpId] = useState('');
  const [interactionCampaignId, setInteractionCampaignId] = useState('');
  const [interactionMaterialId, setInteractionMaterialId] = useState('');
  const [interactionType, setInteractionType] = useState('Call');
  const [interactionNotes, setInteractionNotes] = useState('');
  const [interactionHistory, setInteractionHistory] = useState([]);
  const [isLoadingInteractionHistory, setIsLoadingInteractionHistory] = useState(false);
  const [recentActivities, setRecentActivities] = useState([]);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState('All');
  const [isClientsModalOpen, setIsClientsModalOpen] = useState(false);
  const [isAddHcpModalOpen, setIsAddHcpModalOpen] = useState(false);
  const [editingHcpId, setEditingHcpId] = useState(null);
  const [selectedHcp, setSelectedHcp] = useState(null);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isSavingHcp, setIsSavingHcp] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dropTargetStatus, setDropTargetStatus] = useState('');
  const [mobileDraggingTaskId, setMobileDraggingTaskId] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [materialVersions, setMaterialVersions] = useState([]);
  const [loadingMaterialVersions, setLoadingMaterialVersions] = useState(false);
  const [downloadingVersionId, setDownloadingVersionId] = useState(null);
  const [flaggedMaterialIds, setFlaggedMaterialIds] = useState(new Set());
  const [flaggingMaterial, setFlaggingMaterial] = useState(null);
  const [folders, setFolders] = useState([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderCampaignId, setNewFolderCampaignId] = useState('');
  const [uploadForm, setUploadForm] = useState({ campaignId: '', folderId: '', name: '', notes: '' });
  const [materialToReplace, setMaterialToReplace] = useState(null);
  const [isReplacingMaterial, setIsReplacingMaterial] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', due_date: '', priority: 'Medium' });
  const [hcpForm, setHcpForm] = useState({ name: '', qualification: '', specialism: '', organisation: '', location: '', email: '', phone: '', country: '' });
  const replaceMaterialInputRef = useRef(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'crm', label: 'CRM' },
  { id: 'interaction-log', label: 'Interaction Log' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'materials', label: 'Materials' },
]

const WORKSPACE_CAPABILITIES = [
  'Manage HCP relationships',
  'Log campaign-tagged interactions',
  'Execute assigned tasks',
  'Use approved campaign materials',
]

const PAGE_INTENTS = {
  dashboard: {
    title: 'Sales & Marketing Overview',
    description: 'Start here for active priorities, recent activity, and quick actions that connect all tabs.',
  },
  crm: {
    title: 'CRM Operations',
    description: 'Maintain HCP records, segmentation, and coverage so outreach is accurate and current.',
  },
  'interaction-log': {
    title: 'Interaction Log',
    description: 'Capture compliant interactions and tie them directly to campaigns for transparent reporting.',
  },
  tasks: {
    title: 'Task Execution Board',
    description: 'Move work through open, in-progress, and completed stages with clear ownership.',
  },
  campaigns: {
    title: 'Campaign Context',
    description: 'View live campaign context so field activity and messaging stay aligned.',
  },
  materials: {
    title: 'Approved Materials',
    description: 'Access and use approved assets by campaign and folder without compliance ambiguity.',
  },
}

const WORKFLOW_ACTIONS = [
  { tabId: 'dashboard', label: 'Overview' },
  { tabId: 'crm', label: 'Review CRM' },
  { tabId: 'interaction-log', label: 'Log Interaction' },
  { tabId: 'tasks', label: 'Execute Tasks' },
  { tabId: 'materials', label: 'Open Materials' },
]

const TASK_COLUMNS = [
  { id: 'Open', label: 'To Do' },
  { id: 'In Progress', label: 'In Progress' },
  { id: 'Completed', label: 'Completed' },
]

const CRM_PAGE_SIZE = 8

const getRelativeTime = (value) => {
  if (!value) return 'Recently'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'

  const diffMs = Date.now() - date.getTime()
  if (diffMs < 60 * 1000) return 'Just now'
  if (diffMs < 60 * 60 * 1000) return `${Math.floor(diffMs / (60 * 1000))}m ago`
  if (diffMs < 24 * 60 * 60 * 1000) return `${Math.floor(diffMs / (60 * 60 * 1000))}h ago`
  if (diffMs < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diffMs / (24 * 60 * 60 * 1000))}d ago`
  return date.toLocaleDateString('en-GB')
}

const mapAuditType = (entry = {}) => {
  const action = (entry.action || '').toLowerCase()
  const resourceType = (entry.resource_type || '').toLowerCase()

  if (action.includes('task') || resourceType.includes('task')) return 'task'
  if (action.includes('material') || action.includes('download') || resourceType.includes('material')) return 'download'
  return 'email'
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

const formatCampaignStatus = (status) => {
  const normalized = String(status || 'Planning').trim().toLowerCase()
  if (!normalized) return 'Planning'
  return normalized.split(' ').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

const getCampaignProgress = (status) => {
  const normalized = String(status || 'Planning').trim().toLowerCase()
  if (normalized === 'active') return 72
  if (normalized === 'planning') return 34
  if (normalized === 'on hold') return 48
  if (normalized === 'archived') return 100
  return 55
}

const formatCampaignWindow = (campaign) => {
  if (campaign?.start_date && campaign?.end_date) {
    return `${new Date(campaign.start_date).toLocaleDateString('en-GB')} - ${new Date(campaign.end_date).toLocaleDateString('en-GB')}`
  }
  if (campaign?.start_date) {
    return `Starts ${new Date(campaign.start_date).toLocaleDateString('en-GB')}`
  }
  if (campaign?.end_date) {
    return `Ends ${new Date(campaign.end_date).toLocaleDateString('en-GB')}`
  }
  return 'Timeline not set'
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



// ...existing code...


  const loadCampaigns = useCallback(async () => {
    const { data, error } = await campaignQueries.getAllCampaigns()
    if (error) {
      setActionMessage(`Failed to load campaigns: ${error}`)
      setCampaigns([])
      return
    }
    setCampaigns(data || [])
    setInteractionCampaignId((current) => current || data?.[0]?.id || '')
  }, [])

  const loadMaterials = useCallback(async () => {
    const [materialsResult, foldersResult, flagsResult] = await Promise.all([
      materialQueries.getAllMaterials(),
      folderQueries.getFolders(),
      complianceQueries.getFlags(),
    ])

    if (materialsResult.error) {
      setActionMessage(`Failed to load materials: ${materialsResult.error}`)
      setMaterials([])
      setFolders(foldersResult.data || [])
      return
    }

    setMaterials(materialsResult.data || [])
    setFolders(foldersResult.data || [])
    setFlaggedMaterialIds(new Set(
      (flagsResult || [])
        .filter((row) => (row.status || '').toLowerCase() !== 'resolved')
        .map((row) => row.material_id)
        .filter(Boolean)
    ))
  }, [])

  const loadCrm = useCallback(async () => {
    setIsLoadingCrm(true)
    const { data, error } = await hcpQueries.getAllHCPs()
    if (error) {
      setActionMessage(`Failed to load HCPs: ${error}`)
      setHcpList([])
      setIsLoadingCrm(false)
      return
    }

    setHcpList((data || []).map((hcp) => ({
      ...hcp,
      lastInteraction: hcp.updated_at ? new Date(hcp.updated_at).toLocaleDateString('en-GB') : 'N/A',
    })))

    if (data?.length) {
      setInteractionHcpId(data[0].id)
    }

    setIsLoadingCrm(false)
  }, [])

  const loadInteractionHistory = useCallback(async (hcpId) => {
    if (!hcpId) {
      setInteractionHistory([])
      return
    }

    setIsLoadingInteractionHistory(true)
    const data = await hcpQueries.getInteractionHistory(hcpId)
    const mapped = Array.isArray(data)
      ? data.map((row) => ({
        id: row.id,
        interactionType: row.interaction_type || 'Other',
        campaignId: row.campaign_id || null,
        notes: row.notes || 'No notes provided.',
        interactionDate: row.interaction_date,
        loggedBy: row.initiated_by?.full_name || 'Team member',
      }))
      : []

    setInteractionHistory(mapped)
    setIsLoadingInteractionHistory(false)
  }, [])

  const loadTasks = useCallback(async () => {
    setIsLoadingTasks(true)
    const { data, error } = await taskQueries.getCurrentUserTasks()
    if (error) {
      setActionMessage(`Failed to load tasks: ${error}`)
      setTasks([])
      setIsLoadingTasks(false)
      return
    }

    const mappedTasks = (data || []).map((task) => ({
      id: task.id,
      title: task.title,
      relatedCampaignId: task.related_campaign_id || null,
      due: task.due_date ? new Date(task.due_date).toLocaleDateString('en-GB') : 'No due date',
      status: task.status || 'Open',
      completed: task.status === 'Completed',
      created_at: task.created_at,
      assignedTo: task.assignee?.full_name || task.assignee?.email || 'You',
      assignedBy: task.creator?.full_name || task.creator?.email || 'You',
      assignedToAvatar: task.assignee?.avatar_url || task.assignee?.profile_picture_url || null,
      assignedByAvatar: task.creator?.avatar_url || task.creator?.profile_picture_url || null,
    }))

    setTasks(mappedTasks)
    setIsLoadingTasks(false)
  }, [])

  const loadRecentActivity = useCallback(async () => {
    const data = await auditQueries.getActivityLogs(user?.id ? { userId: user.id } : {})
    const mapped = (data || []).map((entry) => ({
      id: `audit-${entry.id || `${entry.timestamp}-${entry.action}`}`,
      type: mapAuditType(entry),
      title: (entry.action || 'Activity logged').replace(/_/g, ' '),
      detail: `${entry.resource_type || 'system'} • ${getRelativeTime(entry.timestamp)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
    }))
    setRecentActivities(mapped)
  }, [user?.id])

  const appendLocalActivity = useCallback((type, title, detail) => {
    setRecentActivities((prev) => [{
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      title,
      detail,
      timestamp: new Date().toISOString(),
    }, ...prev].slice(0, 25))
  }, [])

  const handleDeleteTask = useCallback(async (taskId) => {
    setIsDeletingTask(true)
    const { error } = await taskQueries.deleteTask(taskId)
    if (error) {
      setActionMessage(`Failed to delete task: ${error}`)
      setIsDeletingTask(false)
      return
    }

    setTasks((prev) => prev.filter((task) => task.id !== taskId))
    setDeleteConfirmTaskId(null)
    appendLocalActivity('task', 'Task deleted', `Task ${taskId} removed from board`)
    await loadRecentActivity()
    setActionMessage('Task deleted.')
    setIsDeletingTask(false)
  }, [appendLocalActivity, loadRecentActivity])

  const handleUploadFileChange = useCallback((event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadFile(file)
    setUploadForm((prev) => ({
      ...prev,
      name: prev.name || file.name,
    }))
  }, [])

  const resetUploadForm = useCallback(() => {
    setUploadForm({ campaignId: '', folderId: '', name: '', notes: '' })
    setUploadFile(null)
  }, [])

  const handleSubmitUpload = useCallback(async () => {
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
        description: uploadForm.notes.trim() || 'Uploaded from Sales & Marketing dashboard',
        folder_id: uploadForm.folderId || null,
      },
      uploadFile
    )

    if (error) {
      setActionMessage(`Upload failed: ${error}`)
      setIsUploading(false)
      return
    }

    setActionMessage(`${uploadForm.name.trim()} uploaded successfully.`)
    resetUploadForm()
    await loadMaterials()
    await loadRecentActivity()
    setIsUploading(false)
  }, [uploadFile, uploadForm, resetUploadForm, loadMaterials, loadRecentActivity])

  const handleCreateFolder = useCallback(async () => {
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
    await loadMaterials()
  }, [newFolderName, newFolderCampaignId, loadMaterials])

  useEffect(() => {
    loadCampaigns()
    loadMaterials()
    loadCrm()
    loadTasks()
    loadRecentActivity()
  }, [loadCampaigns, loadMaterials, loadCrm, loadTasks, loadRecentActivity])

  useEffect(() => {
    loadInteractionHistory(interactionHcpId)
  }, [interactionHcpId, loadInteractionHistory])

  const openAddHcpModal = () => {
    setEditingHcpId(null)
    setHcpForm({
      name: '',
      qualification: '',
      specialism: '',
      organisation: '',
      location: '',
      email: '',
      phone: '',
      country: '',
    })
    setIsAddHcpModalOpen(true)
  }

  const openEditHcpModal = (hcp) => {
    setEditingHcpId(hcp.id)
    setHcpForm({
      name: hcp.name || '',
      qualification: hcp.qualification || '',
      specialism: hcp.specialism || '',
      organisation: hcp.organisation || '',
      location: hcp.location || '',
      email: hcp.email || '',
      phone: hcp.phone || '',
      country: hcp.country || '',
    })
    setIsAddHcpModalOpen(true)
  }

  const toggleTask = (id) => {
    const run = async () => {
      const existing = tasks.find((task) => task.id === id)
      if (!existing) {
        return
      }

      const targetStatus = existing.completed ? 'Open' : 'Completed'
      const { error } = await taskQueries.updateTaskStatus(id, targetStatus)
      if (error) {
        setActionMessage(`Task update failed: ${error}`)
        return
      }

      setTasks((prev) => prev.map((task) => (
        task.id === id ? { ...task, status: targetStatus, completed: targetStatus === 'Completed' } : task
      )))
      setActionMessage('Task status updated.')
      await loadRecentActivity()
    }

    run()
  }

  const handleAddHcp = async (event) => {
    event.preventDefault()
    if (!hcpForm.name.trim()) {
      setActionMessage('HCP name is required.')
      return
    }

    setIsSavingHcp(true)
    const payload = { ...hcpForm, active: true }
    const result = editingHcpId
      ? await hcpQueries.updateHCP(editingHcpId, payload)
      : await hcpQueries.createHCP(payload)

    const { error } = result

    if (error) {
      setActionMessage(`Failed to ${editingHcpId ? 'update' : 'create'} HCP: ${error}`)
      setIsSavingHcp(false)
      return
    }

    appendLocalActivity('email', `${editingHcpId ? 'Updated' : 'Added'} HCP ${hcpForm.name}`, `CRM record ${editingHcpId ? 'updated' : 'created'}`)
    setActionMessage(`HCP ${editingHcpId ? 'updated' : 'created'} successfully.`)
    setIsAddHcpModalOpen(false)
    setEditingHcpId(null)
    setHcpForm({
      name: '',
      qualification: '',
      specialism: '',
      organisation: '',
      location: '',
      email: '',
      phone: '',
      country: '',
    })
    await loadCrm()
    setIsSavingHcp(false)
  }

  const handleLogInteraction = async (event, fromQuickAction = false) => {
    if (event) event.preventDefault()

    if (!interactionHcpId) {
      setActionMessage('Please select an HCP before logging interaction.')
      return
    }

    const selected = hcpList.find((hcp) => String(hcp.id) === String(interactionHcpId))
    const selectedDocument = approvedMaterials.find((material) => String(material.id) === String(interactionMaterialId))
    const noteParts = []
    if (interactionNotes.trim()) {
      noteParts.push(interactionNotes.trim())
    }
    if (selectedDocument) {
      noteParts.push(`Linked document: ${selectedDocument.name}`)
    }

    const { error } = await hcpQueries.logInteraction(interactionHcpId, {
      interaction_type: interactionType,
      campaign_id: interactionCampaignId || null,
      notes: noteParts.length > 0 ? noteParts.join('\n\n') : 'No notes provided',
    })

    if (error) {
      setActionMessage(`Failed to log interaction: ${error}`)
      return
    }

    appendLocalActivity('email', `Interaction logged${selected?.name ? ` with ${selected.name}` : ''}`, `${interactionType} • ${getRelativeTime(new Date().toISOString())}`)
    setInteractionNotes('')
    setInteractionMaterialId('')
    setActionMessage('Interaction logged successfully.')
    if (fromQuickAction) {
      setIsInteractionModalOpen(false)
    }
    await loadInteractionHistory(interactionHcpId)
    await loadCrm()
    await loadRecentActivity()
  }

  const handleCreateTask = async (event) => {
    event.preventDefault()
    if (!taskForm.title.trim()) {
      setActionMessage('Task title is required.')
      return
    }

    setIsSavingTask(true)
    const { error } = await taskQueries.createTask({
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || null,
      due_date: taskForm.due_date || null,
      priority: taskForm.priority,
      status: 'Open',
    })

    if (error) {
      setActionMessage(`Failed to create task: ${error}`)
      setIsSavingTask(false)
      return
    }

    appendLocalActivity('task', `Task created: ${taskForm.title.trim()}`, taskForm.due_date ? `Due ${taskForm.due_date}` : 'No due date')
    setActionMessage('Task created successfully.')
    setTaskForm({
      title: '',
      description: '',
      due_date: '',
      priority: 'Medium',
    })
    setIsTaskModalOpen(false)
    await loadTasks()
    await loadRecentActivity()
    setIsSavingTask(false)
  }

  const moveTaskToStatus = async (taskId, targetStatus) => {
    const existing = tasks.find((task) => task.id === taskId)
    if (!existing || existing.status === targetStatus) {
      return
    }

    const { error } = await taskQueries.updateTaskStatus(taskId, targetStatus)
    if (error) {
      setActionMessage(`Task update failed: ${error}`)
      return
    }

    setTasks((prev) => prev.map((task) => (
      task.id === taskId
        ? { ...task, status: targetStatus, completed: targetStatus === 'Completed' }
        : task
    )))
    appendLocalActivity('task', `Task moved: ${existing.title}`, `Now in ${targetStatus}`)
    setActionMessage(`Task moved to ${targetStatus}.`)
    await loadRecentActivity()
  }

  const handleTaskDragStart = (taskId) => {
    setDraggedTaskId(taskId)
  }

  const handleTaskDragEnd = () => {
    setDraggedTaskId(null)
    setDropTargetStatus('')
  }

  const handleTaskDrop = async (targetStatus) => {
    if (!draggedTaskId) {
      setDropTargetStatus('')
      return
    }

    const taskId = draggedTaskId
    setDraggedTaskId(null)
    setDropTargetStatus('')
    await moveTaskToStatus(taskId, targetStatus)
  }

  const getColumnStatusFromPoint = (x, y) => {
    const target = document.elementFromPoint(x, y)
    const column = target?.closest?.('[data-task-column-status]')
    return column?.getAttribute('data-task-column-status') || ''
  }

  const handleTaskTouchStart = (taskId) => {
    setMobileDraggingTaskId(taskId)
    setDraggedTaskId(taskId)
  }

  const handleTaskTouchMove = (event) => {
    if (!mobileDraggingTaskId) {
      return
    }

    const touch = event.touches?.[0]
    if (!touch) {
      return
    }

    const status = getColumnStatusFromPoint(touch.clientX, touch.clientY)
    setDropTargetStatus(status)
    event.preventDefault()
  }

  const handleTaskTouchEnd = async (event) => {
    if (!mobileDraggingTaskId) {
      setDropTargetStatus('')
      return
    }

    const touch = event.changedTouches?.[0]
    const touchStatus = touch ? getColumnStatusFromPoint(touch.clientX, touch.clientY) : ''
    const targetStatus = touchStatus || dropTargetStatus
    const taskId = mobileDraggingTaskId

    setMobileDraggingTaskId(null)
    setDraggedTaskId(null)
    setDropTargetStatus('')

    if (!targetStatus) {
      setActionMessage('Drag the task over a kanban column, then release to move it.')
      return
    }

    await moveTaskToStatus(taskId, targetStatus)
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
    appendLocalActivity('download', `Material file updated: ${data?.name || materialToReplace.name}`, `By ${updatedBy} • ${updatedAt}`)
    setActionMessage(`Updated ${data?.name || materialToReplace.name}. By ${updatedBy} at ${updatedAt}.`)
    await loadMaterials()
    await loadRecentActivity()
    setMaterialToReplace(null)
    setIsReplacingMaterial(false)
    event.target.value = ''
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
    await loadMaterials()
    return { error: null }
  }

  const filteredHcps = useMemo(() => {
    const q = crmSearch.trim().toLowerCase()
    return hcpList.filter((hcp) => {
      const matchesSearch = !q ||
        (hcp.name || '').toLowerCase().includes(q) ||
        (hcp.organisation || '').toLowerCase().includes(q) ||
        (hcp.location || '').toLowerCase().includes(q)

      const matchesSpecialism = crmSpecialismFilter === 'all' ||
        (hcp.specialism || '').toLowerCase() === crmSpecialismFilter

      const matchesRegion = crmRegionFilter === 'all' ||
        (hcp.location || '').toLowerCase().includes(crmRegionFilter)

      return matchesSearch && matchesSpecialism && matchesRegion
    })
  }, [hcpList, crmSearch, crmSpecialismFilter, crmRegionFilter])

  const crmSpecialismOptions = useMemo(() => {
    return Array.from(new Set(hcpList.map((hcp) => String(hcp.specialism || '').trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b))
  }, [hcpList])

  const crmRegionOptions = useMemo(() => {
    return Array.from(new Set(
      hcpList
        .map((hcp) => String(hcp.location || '').split(',')[0].trim())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b))
  }, [hcpList])

  const totalCrmPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredHcps.length / CRM_PAGE_SIZE))
  }, [filteredHcps.length])

  const paginatedHcps = useMemo(() => {
    const start = (currentCrmPage - 1) * CRM_PAGE_SIZE
    return filteredHcps.slice(start, start + CRM_PAGE_SIZE)
  }, [filteredHcps, currentCrmPage])

  useEffect(() => {
    setCurrentCrmPage(1)
  }, [crmSearch, crmSpecialismFilter, crmRegionFilter])

  useEffect(() => {
    if (currentCrmPage > totalCrmPages) {
      setCurrentCrmPage(totalCrmPages)
    }
  }, [currentCrmPage, totalCrmPages])

  const approvedMaterials = useMemo(
    () => materials.filter((row) => {
      const normalizedStatus = String(row.status || '').trim().toLowerCase()
      return normalizedStatus === 'approved' || normalizedStatus.includes('approved')
    }),
    [materials]
  )

  const visibleMaterials = useMemo(() => {
    const q = materialSearch.trim().toLowerCase()
    return approvedMaterials.filter((row) => {
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
  }, [approvedMaterials, materialSearch, materialTypeFilter, materialCampaignFilter, materialFolderFilter])

  const campaignNames = useMemo(() => {
    return Array.from(new Set(approvedMaterials.map((item) => item.campaign?.name).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [approvedMaterials])

  const uploadCampaigns = useMemo(() => campaigns, [campaigns])

  const responsibleCampaignIds = useMemo(() => new Set(
    tasks.map((task) => task.relatedCampaignId).filter(Boolean)
  ), [tasks])

  const responsibleCampaigns = useMemo(() => campaigns, [campaigns])

  const campaignCards = useMemo(() => {
    return responsibleCampaigns.map((campaign) => {
      const linkedMaterials = approvedMaterials.filter((material) => (
        material.campaign?.id === campaign.id ||
        (!material.campaign?.id && material.campaign?.name === campaign.name)
      ))
      const approvedMaterialsCount = linkedMaterials.filter((material) => String(material.status || '').toLowerCase() === 'approved').length
      const submittedMaterials = linkedMaterials.filter((material) => String(material.status || '').toLowerCase().includes('submitted') || String(material.status || '').toLowerCase().includes('pending')).length
      const progress = getCampaignProgress(campaign.status)
      const normalizedStatus = String(campaign.status || 'Planning').trim().toLowerCase()
      const budgetValue = Number(campaign.budget)
      const healthLabel = linkedMaterials.length === 0
        ? 'Needs assets'
        : approvedMaterialsCount === linkedMaterials.length
          ? 'Ready to use'
          : approvedMaterialsCount > 0
            ? 'Partially ready'
            : 'Awaiting approval'

      return {
        ...campaign,
        statusLabel: formatCampaignStatus(campaign.status),
        progress,
        linkedMaterialsCount: linkedMaterials.length,
        approvedMaterialsCount,
        submittedMaterialsCount: submittedMaterials,
        healthLabel,
        windowLabel: formatCampaignWindow(campaign),
        budgetLabel: Number.isFinite(budgetValue) ? `GBP ${budgetValue.toLocaleString()}` : 'Budget not set',
        normalizedStatus,
      }
    })
  }, [approvedMaterials, responsibleCampaigns])

  const filteredCampaignCards = useMemo(() => {
    const query = campaignSearch.trim().toLowerCase()
    return campaignCards.filter((campaign) => {
      const matchesSearch = !query ||
        (campaign.name || '').toLowerCase().includes(query) ||
        (campaign.description || '').toLowerCase().includes(query) ||
        (campaign.category || '').toLowerCase().includes(query) ||
        campaign.statusLabel.toLowerCase().includes(query)

      const matchesStatus = campaignStatusFilter === 'all' || campaign.normalizedStatus === campaignStatusFilter
      return matchesSearch && matchesStatus
    })
  }, [campaignCards, campaignSearch, campaignStatusFilter])

  const campaignSummary = useMemo(() => {
    const active = campaignCards.filter((campaign) => campaign.normalizedStatus === 'active').length
    const planning = campaignCards.filter((campaign) => campaign.normalizedStatus === 'planning').length
    const onHold = campaignCards.filter((campaign) => campaign.normalizedStatus === 'on hold').length
    const archived = campaignCards.filter((campaign) => campaign.normalizedStatus === 'archived').length
    const linkedMaterialsCount = campaignCards.reduce((sum, campaign) => sum + campaign.linkedMaterialsCount, 0)

    return {
      total: campaignCards.length,
      active,
      planning,
      onHold,
      archived,
      linkedMaterialsCount,
    }
  }, [campaignCards])

  const featuredCampaign = useMemo(() => {
    if (filteredCampaignCards.length === 0) return null

    return [...filteredCampaignCards].sort((left, right) => {
      if (left.normalizedStatus === 'active' && right.normalizedStatus !== 'active') return -1
      if (right.normalizedStatus === 'active' && left.normalizedStatus !== 'active') return 1
      if (right.linkedMaterialsCount !== left.linkedMaterialsCount) return right.linkedMaterialsCount - left.linkedMaterialsCount
      return right.progress - left.progress
    })[0]
  }, [filteredCampaignCards])

  const visibleFolders = useMemo(() => {
    return (folders || []).filter((folder) => {
      const name = (folder.name || '').toLowerCase()
      const q = materialSearch.trim().toLowerCase()
      if (!q) return true
      return name.includes(q)
    })
  }, [folders, materialSearch])

  const fallbackActivities = useMemo(() => {
    const taskItems = tasks.map((task) => ({
      id: `task-${task.id}`,
      type: 'task',
      title: task.status === 'Completed' ? `Task completed: ${task.title}` : `Task in ${task.status || 'Open'}: ${task.title}`,
      detail: `${task.due ? `Due ${task.due}` : 'No due date'}`,
      timestamp: task.created_at || new Date().toISOString(),
    }))

    const hcpItems = hcpList.slice(0, 5).map((hcp) => ({
      id: `hcp-${hcp.id}`,
      type: 'email',
      title: `CRM contact available: ${hcp.name}`,
      detail: `${hcp.organisation || 'Organisation not set'} • ${hcp.lastInteraction || 'Recently updated'}`,
      timestamp: new Date().toISOString(),
    }))

    const materialItems = materials.slice(0, 5).map((material) => ({
      id: `mat-${material.id}`,
      type: 'download',
      title: `Material ${material.status || 'Submitted'}: ${material.name || 'Untitled'}`,
      detail: getRelativeTime(material.created_at),
      timestamp: material.created_at || new Date().toISOString(),
    }))

    return [...taskItems, ...hcpItems, ...materialItems]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 25)
  }, [tasks, hcpList, materials])

  const activityItems = (recentActivities.length ? recentActivities : fallbackActivities)
  const visibleActivityItems = showAllActivity ? activityItems : activityItems.slice(0, 5)

  const uniqueTaskAssignees = useMemo(() => {
    const names = tasks.map((task) => task.assignedTo).filter(Boolean)
    return ['All', ...Array.from(new Set(names)).sort()]
  }, [tasks])

  const visibleTasks = useMemo(() => {
    if (taskAssigneeFilter === 'All') return tasks
    return tasks.filter((task) => task.assignedTo === taskAssigneeFilter)
  }, [tasks, taskAssigneeFilter])
  const activityInsights = useMemo(() => {
    const completedTasks = tasks.filter((task) => task.status === 'Completed').length
    const openTasks = tasks.filter((task) => task.status !== 'Completed').length
    const activeHcps = hcpList.filter((hcp) => hcp.lastInteraction && hcp.lastInteraction !== 'N/A').length
    const hcpCoverage = hcpList.length > 0 ? Math.round((activeHcps / hcpList.length) * 100) : 0

    return {
      totalActivities: activityItems.length,
      completedTasks,
      openTasks,
      hcpCoverage,
    }
  }, [tasks, hcpList, activityItems])

  return (
    <>
      <DashboardTemplate
        title="Sales & Marketing"
        tabs={TABS}
        roleName="Sales & Marketing Workspace"
        roleSummary="This workspace links outreach, execution, and materials so teams can move from planning to logged outcomes without losing context."
        roleCapabilities={WORKSPACE_CAPABILITIES}
        pageIntents={PAGE_INTENTS}
        globalActions={WORKFLOW_ACTIONS}
      >
        {(activeTab) => {
          switch (activeTab) {
          case 'dashboard':
            return (
              <div className={styles.tabContent}>
                {actionMessage && <p className={styles.small}>{actionMessage}</p>}
                <h1>Dashboard Overview</h1>
                <input
                  type="text"
                  className={styles.searchBar}
                  placeholder="Search clients, materials, tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                <div className={styles.dashboardGrid}>
                  <div className={styles.dashboardLeft}>
                    {/* Quick Actions */}
                    <div className={styles.quickActions}>
                      <button
                        type="button"
                        className={styles.actionCard}
                        onClick={() => {
                          if (!interactionHcpId && hcpList[0]?.id) {
                            setInteractionHcpId(hcpList[0].id)
                          }
                          setIsInteractionModalOpen(true)
                        }}
                      >
                        <div className={styles.actionIcon}><PlusIcon size={24} /></div>
                        <p>Log Interaction</p>
                      </button>
                      <button
                        type="button"
                        className={styles.actionCard}
                        onClick={() => setIsTaskModalOpen(true)}
                      >
                        <div className={styles.actionIcon}><CalendarIcon size={24} /></div>
                        <p>Create Task</p>
                      </button>
                      <button
                        type="button"
                        className={styles.actionCard}
                        onClick={() => setIsClientsModalOpen(true)}
                      >
                        <div className={styles.actionIcon}><UserGroupIcon size={24} /></div>
                        <p>View Clients</p>
                      </button>
                    </div>

                    {/* Recent Activity */}
                    <div className={styles.recentActivity}>
                      <div className={styles.activityHeader}>
                        <h3>Recent Activity</h3>
                        <button
                          type="button"
                          className={styles.linkButton}
                          onClick={() => setShowAllActivity((prev) => !prev)}
                        >
                          {showAllActivity ? 'Show less' : 'View all'}
                        </button>
                      </div>
                      {visibleActivityItems.map((activity) => (
                        <div key={activity.id} className={styles.activityItem}>
                          <div
                            className={`${styles.activityIcon} ${styles[activity.type]}`}
                          >
                            {activity.type === 'email' && <EnvelopeIcon size={16} />}
                            {activity.type === 'task' && <div style={{ fontSize: '12px', fontWeight: 'bold' }}>●</div>}
                            {activity.type === 'download' && <CheckCircleIcon size={16} />}
                          </div>
                          <div className={styles.activityDetails}>
                            <p>
                              <strong>{activity.title}</strong>
                            </p>
                            <p className={styles.activityMeta}>{activity.detail}</p>
                          </div>
                        </div>
                      ))}
                      {visibleActivityItems.length === 0 && <p className={styles.small}>No recent activity to show.</p>}
                    </div>
                  </div>

                  {/* Right Panel - Pending Tasks */}
                  <div className={styles.dashboardRight}>
                    <div className={styles.pendingTasks}>
                      <h3>Pending Tasks</h3>
                      {tasks.map((task) => (
                        task.status !== 'Completed' && (
                        <div key={task.id} className={styles.taskItem}>
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => toggleTask(task.id)}
                          />
                          <div className={styles.taskInfo}>
                            <p
                              className={
                                task.completed ? styles.taskCompleted : ''
                              }
                            >
                              <strong>{task.title}</strong>
                            </p>
                            <span className={styles.taskDue}>
                              Due: {task.due}
                            </span>
                          </div>
                        </div>
                        )
                      ))}
                      {!isLoadingTasks && tasks.length === 0 && <p className={styles.small}>No tasks assigned.</p>}
                      <button
                        type="button"
                        className={styles.taskBoardBtn}
                        onClick={() => setIsTaskModalOpen(true)}
                      >
                        Add New Task
                      </button>
                    </div>

                    <div className={styles.pendingTasks} style={{ marginTop: '16px' }}>
                      <h3>Activity Performance Insights</h3>
                      <div className={styles.insightsGrid}>
                        <div className={styles.insightCard}>
                          <p className={styles.insightLabel}>Tracked Activities</p>
                          <div className={styles.insightValueRow}>
                            <h3>{activityInsights.totalActivities}</h3>
                            <span>latest events</span>
                          </div>
                          <div className={styles.insightTrack}><div className={styles.insightFill} style={{ width: `${Math.min(100, activityInsights.totalActivities * 6)}%` }}></div></div>
                        </div>
                        <div className={styles.insightCard}>
                          <p className={styles.insightLabel}>Task Completion</p>
                          <div className={styles.insightValueRow}>
                            <h3>{activityInsights.completedTasks}</h3>
                            <span>{activityInsights.openTasks} open</span>
                          </div>
                          <div className={styles.insightTrack}><div className={styles.insightFill} style={{ width: `${tasks.length > 0 ? (activityInsights.completedTasks / tasks.length) * 100 : 0}%` }}></div></div>
                        </div>
                        <div className={styles.insightCard}>
                          <p className={styles.insightLabel}>HCP Engagement Coverage</p>
                          <div className={styles.insightValueRow}>
                            <h3>{activityInsights.hcpCoverage}%</h3>
                            <span>contacts with interactions</span>
                          </div>
                          <div className={styles.insightTrack}><div className={styles.insightFill} style={{ width: `${activityInsights.hcpCoverage}%` }}></div></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )

          case 'crm':
            return (
              <div className={styles.tabContent}>
                {actionMessage && <p className={styles.small}>{actionMessage}</p>}
                <div className={styles.crmHeader}>
                  <h2>Healthcare Professionals Directory</h2>
                  <div className={styles.crmControls}>
                    <input
                      type="text"
                      className={styles.crmSearch}
                      placeholder="Search HCPs, organisations, locations..."
                      value={crmSearch}
                      onChange={(e) => setCrmSearch(e.target.value)}
                    />
                    <select className={styles.crmFilter} value={crmSpecialismFilter} onChange={(e) => setCrmSpecialismFilter(e.target.value)}>
                      <option value="all">All Specialisms</option>
                      {crmSpecialismOptions.map((option) => (
                        <option key={option} value={option.toLowerCase()}>{option}</option>
                      ))}
                    </select>
                    <select className={styles.crmFilter} value={crmRegionFilter} onChange={(e) => setCrmRegionFilter(e.target.value)}>
                      <option value="all">Region: All</option>
                      {crmRegionOptions.map((option) => (
                        <option key={option} value={option.toLowerCase()}>{option}</option>
                      ))}
                    </select>
                    <button type="button" className={styles.addHcpBtn} onClick={openAddHcpModal}>Add New HCP</button>
                  </div>
                </div>

                <div className={styles.crmTableWrap}>
                  <table className={styles.crmTable}>
                    <thead>
                      <tr>
                        <th>Name / Qualification</th>
                        <th>Specialism</th>
                        <th>Organisation</th>
                        <th>Location</th>
                        <th>Last Interaction</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedHcps.map((hcp) => (
                        <tr key={hcp.id}>
                          <td>
                            <strong>{hcp.name}</strong>
                            <br />
                            <span className={styles.small}>
                              {hcp.qualification}
                            </span>
                          </td>
                          <td>
                            <span className={styles.tag}>{hcp.specialism}</span>
                          </td>
                          <td>{hcp.organisation}</td>
                          <td>{hcp.location}</td>
                          <td>{hcp.lastInteraction}</td>
                          <td>
                            <button
                              type="button"
                              className={styles.linkButton}
                              onClick={() => {
                                setSelectedHcp(hcp)
                                setIsClientsModalOpen(true)
                              }}
                            >
                              View
                            </button>
                            {' / '}
                            <button
                              type="button"
                              className={styles.linkButton}
                              onClick={() => openEditHcpModal(hcp)}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!isLoadingCrm && paginatedHcps.length === 0 && (
                        <tr>
                          <td colSpan={6}>No HCPs found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className={styles.crmPagination}>
                  <span>Page {currentCrmPage} of {totalCrmPages}</span>
                  {' '}
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => setCurrentCrmPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentCrmPage === 1}
                  >
                    Previous
                  </button>
                  {' '}
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => setCurrentCrmPage((prev) => Math.min(totalCrmPages, prev + 1))}
                    disabled={currentCrmPage === totalCrmPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )

          case 'interaction-log':
            return (
              <div className={styles.tabContent}>
                {actionMessage && <p className={styles.small}>{actionMessage}</p>}
                <div className={styles.interactionHeader}>
                  <h2>Interaction Log</h2>
                  <p>Manage and record all client interactions and communications.</p>
                </div>
                <div className={styles.logForm}>
                  <select
                    className={styles.formInput}
                    value={interactionHcpId}
                    onChange={(e) => setInteractionHcpId(e.target.value)}
                  >
                    <option value="">Select HCP</option>
                    {hcpList.map((hcp) => (
                      <option key={hcp.id} value={hcp.id}>{hcp.name}</option>
                    ))}
                  </select>
                  <select className={styles.formInput} value={interactionType} onChange={(e) => setInteractionType(e.target.value)}>
                    <option>Call</option>
                    <option>Meeting</option>
                    <option>Email</option>
                    <option>Visit</option>
                    <option>Other</option>
                  </select>
                  <select className={styles.formInput} value={interactionCampaignId} onChange={(e) => setInteractionCampaignId(e.target.value)}>
                    <option value="">No campaign tag</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                    ))}
                  </select>
                  <select className={styles.formInput} value={interactionMaterialId} onChange={(e) => setInteractionMaterialId(e.target.value)}>
                    <option value="">No document attached</option>
                    {approvedMaterials.map((material) => (
                      <option key={material.id} value={material.id}>{material.name}</option>
                    ))}
                  </select>
                  <textarea
                    placeholder="Interaction Notes"
                    className={styles.formTextarea}
                    value={interactionNotes}
                    onChange={(e) => setInteractionNotes(e.target.value)}
                  ></textarea>
                  <button type="button" className={styles.submitBtn} onClick={(event) => handleLogInteraction(event, false)}>Log Interaction</button>
                </div>

                <div className={styles.interactionHistoryPanel}>
                  <div className={styles.interactionHistoryHeader}>
                    <h3>Recent Interaction Notes</h3>
                    <span className={styles.small}>{interactionHistory.length} record{interactionHistory.length !== 1 ? 's' : ''}</span>
                  </div>
                  {isLoadingInteractionHistory && <p className={styles.small}>Loading interaction history...</p>}
                  {!isLoadingInteractionHistory && interactionHistory.length === 0 && (
                    <p className={styles.small}>No interactions logged yet for this HCP.</p>
                  )}
                  {!isLoadingInteractionHistory && interactionHistory.map((entry) => {
                    const linkedCampaign = campaigns.find((campaign) => String(campaign.id) === String(entry.campaignId))
                    return (
                      <div key={entry.id} className={styles.interactionHistoryItem}>
                        <p>
                          <strong>{entry.interactionType}</strong>
                          {' • '}
                          {entry.interactionDate ? new Date(entry.interactionDate).toLocaleString('en-GB') : 'No timestamp'}
                        </p>
                        <p className={styles.activityMeta}>Campaign: {linkedCampaign?.name || 'No campaign tag'} • Logged by: {entry.loggedBy}</p>
                        <p className={styles.interactionHistoryNotes}>{entry.notes}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )

          case 'tasks':
            return (
              <div className={styles.tabContent}>
                {actionMessage && <p className={styles.small}>{actionMessage}</p>}
                <div className={styles.tasksHeader}>
                  <h2>Task Management</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.72rem', color: 'var(--text-muted, #888)', gap: '2px' }}>
                      Assigned To
                      <select
                        className={styles.addTaskFromBoardBtn}
                        style={{ fontWeight: 400 }}
                        value={taskAssigneeFilter}
                        onChange={(e) => setTaskAssigneeFilter(e.target.value)}
                      >
                        {uniqueTaskAssignees.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </label>
                    <button type="button" className={styles.addTaskFromBoardBtn} onClick={() => setIsTaskModalOpen(true)}>
                      + New Task
                    </button>
                  </div>
                </div>
                <div className={styles.taskBoard}>
                  {TASK_COLUMNS.map((column) => {
                    const columnTasks = visibleTasks.filter((task) => (task.status || 'Open') === column.id)
                    const isDropActive = dropTargetStatus === column.id
                    return (
                      <div
                        key={column.id}
                        className={`${styles.taskColumn} ${isDropActive ? styles.taskColumnDropActive : ''}`}
                        data-task-column-status={column.id}
                        onDragOver={(event) => {
                          event.preventDefault()
                          setDropTargetStatus(column.id)
                        }}
                        onDrop={(event) => {
                          event.preventDefault()
                          handleTaskDrop(column.id)
                        }}
                        onDragLeave={() => setDropTargetStatus((current) => (current === column.id ? '' : current))}
                      >
                        <h3>{column.label}</h3>
                        {columnTasks.map((task) => (
                          <div
                            key={task.id}
                            className={`${styles.taskCard} ${(task.status || 'Open') === 'Completed' ? styles.completed : ''} ${draggedTaskId === task.id ? styles.taskCardDragging : ''}`}
                            draggable
                            onDragStart={() => handleTaskDragStart(task.id)}
                            onDragEnd={handleTaskDragEnd}
                            onTouchStart={() => handleTaskTouchStart(task.id)}
                            onTouchMove={handleTaskTouchMove}
                            onTouchEnd={handleTaskTouchEnd}
                            onTouchCancel={handleTaskDragEnd}
                            style={{ position: 'relative' }}
                          >
                            {/* Bin icon in top right */}
                            <button
                              type="button"
                              aria-label="Delete task"
                              style={{
                                position: 'absolute',
                                top: 6,
                                right: 6,
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                zIndex: 2,
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteConfirmTaskId(task.id)
                              }}
                              disabled={isDeletingTask}
                            >
                              <BinIcon size={18} />
                            </button>
                            <p>{task.title}</p>
                            <small>Due: {task.due}</small>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              <Avatar name={task.assignedTo} src={task.assignedToAvatar} size="sm" />
                              <small>Assigned to: {task.assignedTo}</small>
                            </div>
                            {task.assignedBy !== task.assignedTo && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                <Avatar name={task.assignedBy} src={task.assignedByAvatar} size="sm" />
                                <small>Assigned by: {task.assignedBy}</small>
                              </div>
                            )}
                            {/* Confirm popup */}
                            {deleteConfirmTaskId === task.id && (
                              <div style={{
                                position: 'absolute',
                                top: 32,
                                right: 8,
                                background: '#fff',
                                border: '1px solid #dc2626',
                                borderRadius: 6,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                                padding: '12px 16px',
                                zIndex: 10,
                                minWidth: 180,
                              }}>
                                <div style={{ marginBottom: 8, color: '#dc2626', fontWeight: 600 }}>Delete this task?</div>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}
                                    onClick={() => handleDeleteTask(task.id)}
                                    disabled={isDeletingTask}
                                  >
                                    {isDeletingTask ? 'Deleting...' : 'Delete'}
                                  </button>
                                  <button
                                    type="button"
                                    style={{ background: '#f3f4f6', color: '#222', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}
                                    onClick={() => setDeleteConfirmTaskId(null)}
                                    disabled={isDeletingTask}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {!isLoadingTasks && columnTasks.length === 0 && (
                          <p className={styles.small}>No tasks in this column.</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )

          case 'campaigns':
            return (
              <div className={styles.tabContent}>
                {actionMessage && <p className={styles.small}>{actionMessage}</p>}
                <section className={styles.campaignsHero}>
                  <div>
                    <p className={styles.campaignEyebrow}>Sales Planning Workspace</p>
                    <h2>Campaigns</h2>
                    <p className={styles.campaignIntro}>Track live launches, spot slow-moving campaigns early, and keep asset readiness visible without leaving the sales dashboard.</p>
                  </div>
                  <div className={styles.campaignsControls}>
                    <input
                      type="text"
                      className={styles.campaignSearch}
                      placeholder="Search campaigns by name, status or category..."
                      value={campaignSearch}
                      onChange={(event) => setCampaignSearch(event.target.value)}
                    />
                    <select
                      className={styles.campaignFilter}
                      value={campaignStatusFilter}
                      onChange={(event) => setCampaignStatusFilter(event.target.value)}
                    >
                      <option value="all">All statuses</option>
                      <option value="planning">Planning</option>
                      <option value="active">Active</option>
                      <option value="on hold">On Hold</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </section>

                <div className={styles.campaignStatsGrid}>
                  <div className={styles.campaignStatCard}>
                    <span className={styles.campaignStatLabel}>Active Now</span>
                    <strong>{campaignSummary.active}</strong>
                    <span className={styles.campaignStatMeta}>Campaigns currently live</span>
                  </div>
                  <div className={styles.campaignStatCard}>
                    <span className={styles.campaignStatLabel}>Planning</span>
                    <strong>{campaignSummary.planning}</strong>
                    <span className={styles.campaignStatMeta}>Queued for rollout</span>
                  </div>
                  <div className={styles.campaignStatCard}>
                    <span className={styles.campaignStatLabel}>On Hold</span>
                    <strong>{campaignSummary.onHold}</strong>
                    <span className={styles.campaignStatMeta}>Need follow-up or approval</span>
                  </div>
                  <div className={styles.campaignStatCard}>
                    <span className={styles.campaignStatLabel}>Linked Assets</span>
                    <strong>{campaignSummary.linkedMaterialsCount}</strong>
                    <span className={styles.campaignStatMeta}>Materials tied to campaigns</span>
                  </div>
                </div>

                {featuredCampaign && (
                  <section className={styles.featuredCampaign}>
                    <div className={styles.featuredMain}>
                      <div className={styles.featuredHeader}>
                        <div>
                          <p className={styles.campaignEyebrow}>Featured Campaign</p>
                          <h3>{featuredCampaign.name}</h3>
                        </div>
                        <span className={`${styles.campaignStatusBadge} ${styles[`status${featuredCampaign.statusLabel.replace(/\s+/g, '')}`] || ''}`}>{featuredCampaign.statusLabel}</span>
                      </div>
                      <p className={styles.featuredDescription}>{featuredCampaign.description || 'No description provided yet for this campaign.'}</p>
                      <div className={styles.featuredMetrics}>
                        <div>
                          <span className={styles.featuredMetricLabel}>Window</span>
                          <strong>{featuredCampaign.windowLabel}</strong>
                        </div>
                        <div>
                          <span className={styles.featuredMetricLabel}>Budget</span>
                          <strong>{featuredCampaign.budgetLabel}</strong>
                        </div>
                        <div>
                          <span className={styles.featuredMetricLabel}>Asset Readiness</span>
                          <strong>{featuredCampaign.approvedMaterialsCount}/{featuredCampaign.linkedMaterialsCount || 0} approved</strong>
                        </div>
                      </div>
                    </div>
                    <div className={styles.featuredSideRail}>
                      <div className={styles.campaignProgressWrap}>
                        <div className={styles.campaignProgressHeader}>
                          <span>Execution Progress</span>
                          <strong>{featuredCampaign.progress}%</strong>
                        </div>
                        <div className={styles.progressBar}>
                          <div className={styles.progress} style={{ width: `${featuredCampaign.progress}%` }}></div>
                        </div>
                      </div>
                      <div className={styles.featuredHealthCard}>
                        <span className={styles.featuredMetricLabel}>Current Health</span>
                        <strong>{featuredCampaign.healthLabel}</strong>
                        <p>{featuredCampaign.submittedMaterialsCount > 0 ? `${featuredCampaign.submittedMaterialsCount} asset${featuredCampaign.submittedMaterialsCount !== 1 ? 's' : ''} still in review.` : 'No assets currently waiting on review.'}</p>
                      </div>
                    </div>
                  </section>
                )}

                <div className={styles.campaignsGrid}>
                  {filteredCampaignCards.map((campaign) => (
                    <article className={styles.campaignCard} key={campaign.id}>
                      <div className={styles.campaignCardHeader}>
                        <div>
                          <h3>{campaign.name}</h3>
                          <p className={styles.campaignMeta}>{campaign.category || 'General campaign'}</p>
                        </div>
                        <span className={`${styles.campaignStatusBadge} ${styles[`status${campaign.statusLabel.replace(/\s+/g, '')}`] || ''}`}>{campaign.statusLabel}</span>
                      </div>

                      <p className={styles.campaignDescription}>{campaign.description || 'No description provided yet for this campaign.'}</p>

                      <div className={styles.campaignCardGrid}>
                        <div>
                          <span className={styles.campaignMetaLabel}>Timeline</span>
                          <strong>{campaign.windowLabel}</strong>
                        </div>
                        <div>
                          <span className={styles.campaignMetaLabel}>Budget</span>
                          <strong>{campaign.budgetLabel}</strong>
                        </div>
                        <div>
                          <span className={styles.campaignMetaLabel}>Assets</span>
                          <strong>{campaign.linkedMaterialsCount}</strong>
                        </div>
                        <div>
                          <span className={styles.campaignMetaLabel}>Approved</span>
                          <strong>{campaign.approvedMaterialsCount}</strong>
                        </div>
                      </div>

                      <div className={styles.campaignProgressWrap}>
                        <div className={styles.campaignProgressHeader}>
                          <span>Campaign completion</span>
                          <strong>{campaign.progress}%</strong>
                        </div>
                        <div className={styles.progressBar}>
                          <div className={styles.progress} style={{ width: `${campaign.progress}%` }}></div>
                        </div>
                      </div>

                      <div className={styles.campaignFooterRow}>
                        <span className={styles.campaignHealthPill}>{campaign.healthLabel}</span>
                        <span className={styles.campaignMeta}>{campaign.submittedMaterialsCount > 0 ? `${campaign.submittedMaterialsCount} in review` : 'No assets waiting'}</span>
                      </div>
                    </article>
                  ))}
                  {filteredCampaignCards.length === 0 && <p className={styles.small}>No campaigns match the current filters.</p>}
                </div>
              </div>
            )

          case 'materials':
            return (
              <MaterialsLibrary
                tabClassName={styles.tabContent}
                actionMessage={actionMessage}
                actionMessageClassName={styles.small}
                replaceInputRef={replaceMaterialInputRef}
                onReplaceChange={handleReplaceMaterialSelected}
                uploadButtonLabel="Upload Material"
                isUploading={isUploading}
                materials={approvedMaterials}
                visibleMaterials={visibleMaterials}
                loading={false}
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
                  campaigns: uploadCampaigns,
                  folders,
                  onCreateFolder: handleCreateFolder,
                }}
              />
            )

          default:
            return null
          }
        }}
      </DashboardTemplate>

      {isTaskModalOpen && (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setIsTaskModalOpen(false)}>
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-label="Create task" onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Create Task</h3>
              <button type="button" className={styles.modalClose} onClick={() => setIsTaskModalOpen(false)}>x</button>
            </div>
            <form className={styles.modalForm} onSubmit={handleCreateTask}>
              <input
                type="text"
                className={styles.formInput}
                placeholder="Task title"
                value={taskForm.title}
                onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
                required
              />
              <textarea
                className={styles.formTextarea}
                placeholder="Task details"
                value={taskForm.description}
                onChange={(event) => setTaskForm((prev) => ({ ...prev, description: event.target.value }))}
              />
              <div className={styles.modalGrid}>
                <input
                  type="date"
                  className={styles.formInput}
                  value={taskForm.due_date}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, due_date: event.target.value }))}
                />
                <select
                  className={styles.formInput}
                  value={taskForm.priority}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, priority: event.target.value }))}
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Urgent</option>
                </select>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setIsTaskModalOpen(false)}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={isSavingTask}>{isSavingTask ? 'Saving...' : 'Create Task'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            <p className={campaignStyles.rowMeta}>Notes: {selectedMaterial.description || 'No notes added.'}</p>
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

      {isInteractionModalOpen && (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setIsInteractionModalOpen(false)}>
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-label="Log interaction" onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Log Interaction</h3>
              <button type="button" className={styles.modalClose} onClick={() => setIsInteractionModalOpen(false)}>x</button>
            </div>
            <form className={styles.modalForm} onSubmit={(event) => handleLogInteraction(event, true)}>
              <select
                className={styles.formInput}
                value={interactionHcpId}
                onChange={(event) => setInteractionHcpId(event.target.value)}
                required
              >
                <option value="">Select HCP</option>
                {hcpList.map((hcp) => (
                  <option key={hcp.id} value={hcp.id}>{hcp.name}</option>
                ))}
              </select>
              <select className={styles.formInput} value={interactionType} onChange={(event) => setInteractionType(event.target.value)}>
                <option>Call</option>
                <option>Meeting</option>
                <option>Email</option>
                <option>Visit</option>
                <option>Other</option>
              </select>
              <select className={styles.formInput} value={interactionCampaignId} onChange={(event) => setInteractionCampaignId(event.target.value)}>
                <option value="">No campaign tag</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>
              <select className={styles.formInput} value={interactionMaterialId} onChange={(event) => setInteractionMaterialId(event.target.value)}>
                <option value="">No document attached</option>
                {approvedMaterials.map((material) => (
                  <option key={material.id} value={material.id}>{material.name}</option>
                ))}
              </select>
              <textarea
                className={styles.formTextarea}
                placeholder="Interaction notes"
                value={interactionNotes}
                onChange={(event) => setInteractionNotes(event.target.value)}
              />
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setIsInteractionModalOpen(false)}>Cancel</button>
                <button type="submit" className={styles.submitBtn}>Log Interaction</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isClientsModalOpen && (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setIsClientsModalOpen(false)}>
          <div className={styles.modalCardLarge} role="dialog" aria-modal="true" aria-label="View clients" onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Clients Quick View</h3>
              <button type="button" className={styles.modalClose} onClick={() => setIsClientsModalOpen(false)}>x</button>
            </div>
            <div className={styles.clientsList}>
              {filteredHcps.map((hcp) => (
                <button
                  type="button"
                  key={hcp.id}
                  className={`${styles.clientItem} ${selectedHcp?.id === hcp.id ? styles.clientItemActive : ''}`}
                  onClick={() => setSelectedHcp(hcp)}
                >
                  <strong>{hcp.name}</strong>
                  <span>{hcp.organisation || 'Organisation not set'}</span>
                </button>
              ))}
              {!filteredHcps.length && <p className={styles.small}>No clients match your current filters.</p>}
            </div>
            {selectedHcp && (
              <div className={styles.clientDetails}>
                <h4>{selectedHcp.name}</h4>
                <p>{selectedHcp.qualification || 'No qualification listed'}</p>
                <p>{selectedHcp.specialism || 'No specialism listed'}</p>
                <p>{selectedHcp.organisation || 'No organisation listed'}</p>
                <p>{selectedHcp.location || 'No location listed'}</p>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => {
                      setInteractionHcpId(selectedHcp.id)
                      setIsClientsModalOpen(false)
                      setIsInteractionModalOpen(true)
                    }}
                  >
                    Log Interaction
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isAddHcpModalOpen && (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setIsAddHcpModalOpen(false)}>
          <div className={styles.modalCardLarge} role="dialog" aria-modal="true" aria-label="Add new HCP" onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Add New HCP</h3>
              <h3>{editingHcpId ? 'Edit HCP' : 'Add New HCP'}</h3>
              <button type="button" className={styles.modalClose} onClick={() => setIsAddHcpModalOpen(false)}>x</button>
            </div>
            <form className={styles.modalForm} onSubmit={handleAddHcp}>
              <div className={styles.modalGrid}>
                <input type="text" className={styles.formInput} placeholder="Name" value={hcpForm.name} onChange={(event) => setHcpForm((prev) => ({ ...prev, name: event.target.value }))} required />
                <input type="text" className={styles.formInput} placeholder="Qualification" value={hcpForm.qualification} onChange={(event) => setHcpForm((prev) => ({ ...prev, qualification: event.target.value }))} />
                <input type="text" className={styles.formInput} placeholder="Specialism" value={hcpForm.specialism} onChange={(event) => setHcpForm((prev) => ({ ...prev, specialism: event.target.value }))} />
                <input type="text" className={styles.formInput} placeholder="Organisation" value={hcpForm.organisation} onChange={(event) => setHcpForm((prev) => ({ ...prev, organisation: event.target.value }))} />
                <input type="text" className={styles.formInput} placeholder="Location" value={hcpForm.location} onChange={(event) => setHcpForm((prev) => ({ ...prev, location: event.target.value }))} />
                <input type="text" className={styles.formInput} placeholder="Country" value={hcpForm.country} onChange={(event) => setHcpForm((prev) => ({ ...prev, country: event.target.value }))} />
                <input type="email" className={styles.formInput} placeholder="Email" value={hcpForm.email} onChange={(event) => setHcpForm((prev) => ({ ...prev, email: event.target.value }))} />
                <input type="text" className={styles.formInput} placeholder="Phone" value={hcpForm.phone} onChange={(event) => setHcpForm((prev) => ({ ...prev, phone: event.target.value }))} />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryBtn} onClick={() => {
                  setIsAddHcpModalOpen(false)
                  setEditingHcpId(null)
                }}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={isSavingHcp}>{isSavingHcp ? 'Saving...' : editingHcpId ? 'Update HCP' : 'Save HCP'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
