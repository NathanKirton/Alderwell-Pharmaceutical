import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DashboardTemplate from '../Layout/DashboardTemplate'
import Avatar from '../Shared/Avatar'
import FlagMaterialModal from '../Layout/FlagMaterialModal'
import MaterialsLibrary from './Shared/MaterialsLibrary'
import styles from './LiaisonOfficer.module.css'
import campaignStyles from './CampaignManagement.module.css'
import { complianceQueries, folderQueries, hcpQueries, materialQueries, taskQueries, visitQueries } from '../../services/supabaseHelpers'
import {
  PlusIcon,
  CalendarIcon,
  ClipboardIcon,
  FileIcon,
  FlagIcon,
  BarChartIcon,
  VideoIcon,
  CheckCircleIcon,
  // Add BinIcon for delete
} from '../Icons/IconSet'



const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'log-visit', label: 'Log Visit' },
  { id: 'my-visits', label: 'My Visits' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'materials', label: 'Materials' },
]

const WORKSPACE_CAPABILITIES = [
  'Plan and log HCP visits',
  'Track visit outcomes and follow-ups',
  'Execute field tasks',
  'Use approved field materials',
]

const PAGE_INTENTS = {
  dashboard: {
    title: 'Liaison Field Overview',
    description: 'See today’s schedule, task pressure, and key actions before heading into the field.',
  },
  'log-visit': {
    title: 'Visit Logging',
    description: 'Capture visit details with complete context so downstream teams can act on outcomes quickly.',
  },
  'my-visits': {
    title: 'Visit History',
    description: 'Review outcomes and update pending visits to keep timelines and reporting accurate.',
  },
  tasks: {
    title: 'Field Task Board',
    description: 'Progress tasks from open to completed and keep campaign owners informed.',
  },
  materials: {
    title: 'Field Materials',
    description: 'Access approved content for visits and stay compliant with the latest assets.',
  },
}

const WORKFLOW_ACTIONS = [
  { tabId: 'dashboard', label: 'Overview' },
  { tabId: 'log-visit', label: 'Log Visit' },
  { tabId: 'my-visits', label: 'Review Visits' },
  { tabId: 'tasks', label: 'Open Tasks' },
  { tabId: 'materials', label: 'Approved Materials' },
]

const QUICK_ACTIONS = [
  { id: 'new-log', label: 'New Log', icon: PlusIcon },
  { id: 'schedule', label: 'Schedule Visit', icon: CalendarIcon },
  { id: 'submit-report', label: 'Submit Report', icon: FileIcon },
]

const TASK_COLUMNS = [
  { id: 'Open', label: 'To Do' },
  { id: 'In Progress', label: 'In Progress' },
  { id: 'Completed', label: 'Completed' },
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

const normalizeTaskStatus = (status) => {
  const value = String(status || '').trim().toLowerCase()
  if (value === 'completed' || value === 'done' || value === 'closed') return 'Completed'
  if (value === 'in progress' || value === 'in-progress' || value === 'progress') return 'In Progress'
  return 'Open'
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

export default function LiaisonOfficer() {
  const [taskList, setTaskList] = useState([])
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
    // Delete task handler
    const handleDeleteTask = async (taskId) => {
      setIsDeletingTask(true);
      const { error } = await taskQueries.deleteTask(taskId);
      if (error) {
        setActionMessage('Failed to delete task: ' + error);
        setIsDeletingTask(false);
        return;
      }
      setTaskList((prev) => prev.filter((task) => task.id !== taskId));
      setActionMessage('Task deleted.');
      setDeleteConfirmTaskId(null);
      setIsDeletingTask(false);
    };
  const [visits, setVisits] = useState([])
  const [hcpList, setHcpList] = useState([])
  const [materials, setMaterials] = useState([])
  const [visitOutcomeFilter, setVisitOutcomeFilter] = useState('All')
  const [visitUpdateForm, setVisitUpdateForm] = useState({ visitId: '', outcome: 'Pending', feedback: '' })
  const [isSavingVisitUpdate, setIsSavingVisitUpdate] = useState(false)
  const [isScheduleFormOpen, setIsScheduleFormOpen] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({ hcpId: '', visitDate: '', visitType: 'In-person', notes: '' })
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false)
  const [isSavingTask, setIsSavingTask] = useState(false)
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'Medium',
  })
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [assigneeFilter, setAssigneeFilter] = useState('All')
  const [taskSearch, setTaskSearch] = useState('')
  const [materialSearch, setMaterialSearch] = useState('')
  const [materialTypeFilter, setMaterialTypeFilter] = useState('all')
  const [materialCampaignFilter, setMaterialCampaignFilter] = useState('all')
  const [materialFolderFilter, setMaterialFolderFilter] = useState('all')
  const [actionMessage, setActionMessage] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [materialToReplace, setMaterialToReplace] = useState(null)
  const [isReplacingMaterial, setIsReplacingMaterial] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [materialVersions, setMaterialVersions] = useState([])
  const [loadingMaterialVersions, setLoadingMaterialVersions] = useState(false)
  const [downloadingVersionId, setDownloadingVersionId] = useState(null)
  const [flaggingMaterial, setFlaggingMaterial] = useState(null)
  const [folders, setFolders] = useState([])
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderCampaignId, setNewFolderCampaignId] = useState('')
  const [uploadForm, setUploadForm] = useState({ campaignId: '', folderId: '', name: '' })
  const [flaggedMaterialIds, setFlaggedMaterialIds] = useState(new Set())
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [loadingVisits, setLoadingVisits] = useState(true)
  const [loadingMaterials, setLoadingMaterials] = useState(true)
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [dropTargetStatus, setDropTargetStatus] = useState('')
  const [mobileDraggingTaskId, setMobileDraggingTaskId] = useState(null)
  const [visitForm, setVisitForm] = useState({
    hcpId: '',
    hcpName: '',
    dateOfVisit: '',
    durationMinutes: '',
    topics: [],
    notes: '',
    complianceConfirmed: false,
  })
  const replaceMaterialInputRef = useRef(null)
  const [uploadFile, setUploadFile] = useState(null)

  const formatPriority = (priority) => {
    const normalized = (priority || '').toLowerCase()
    if (normalized === 'high') return 'High'
    if (normalized === 'low') return 'Low'
    return 'Medium'
  }

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
        description: 'Uploaded from Liaison Officer dashboard',
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
      await loadMaterials()
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
    await loadMaterials()
  }

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true)
    const { data, error } = await taskQueries.getCurrentUserTasks()
    if (error) {
      setActionMessage(`Failed to load tasks: ${error}`)
      setTaskList([])
      setLoadingTasks(false)
      return
    }

    const mappedTasks = (data || []).map((task) => ({
      id: task.id,
      title: task.title,
      detail: task.description || 'Task details not provided.',
      location: task.related_campaign_id || 'General',
      due: task.due_date ? new Date(task.due_date).toLocaleDateString('en-GB') : 'No due date',
      priority: formatPriority(task.priority),
      status: normalizeTaskStatus(task.status),
      assignedTo: task.assignee?.full_name || task.assignee?.email || 'You',
      assignedBy: task.creator?.full_name || task.creator?.email || 'You',
      assignedToAvatar: task.assignee?.avatar_url || task.assignee?.profile_picture_url || null,
      assignedByAvatar: task.creator?.avatar_url || task.creator?.profile_picture_url || null,
      assignedToId: task.assigned_to,
      createdById: task.created_by,
    }))

    setTaskList(mappedTasks)
    setLoadingTasks(false)
  }, [])

  const loadVisits = useCallback(async () => {
    setLoadingVisits(true)
    const rows = await visitQueries.getMyVisits()
    if (!rows) {
      setActionMessage('Failed to load visits.')
      setVisits([])
      setLoadingVisits(false)
      return
    }

    const mappedVisits = rows.map((visit) => ({
      id: visit.id,
      hcp: visit.hcp?.name || 'Unknown HCP',
      organisation: visit.hcp?.organisation || 'Unknown organisation',
      date: visit.visit_date ? new Date(visit.visit_date).toLocaleDateString('en-GB') : 'N/A',
      time: visit.visit_date ? new Date(visit.visit_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
      visitDate: visit.visit_date || null,
      type: visit.visit_type || 'Other',
      outcome: visit.outcome || 'Pending',
      location: visit.hcp?.organisation || 'Location not set',
    }))

    setVisits(mappedVisits)
    setLoadingVisits(false)
  }, [])

  const loadMaterials = useCallback(async () => {
    setLoadingMaterials(true)
    const [materialsResult, foldersResult, flagsResult] = await Promise.all([
      materialQueries.getAllMaterials(),
      folderQueries.getFolders(),
      complianceQueries.getFlags(),
    ])

    if (materialsResult.error) {
      setActionMessage(`Failed to load materials: ${materialsResult.error}`)
      setMaterials([])
      setLoadingMaterials(false)
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
    setLoadingMaterials(false)
  }, [])

  const loadHCPs = useCallback(async () => {
    const { data, error } = await hcpQueries.getAllHCPs()
    if (error) {
      setActionMessage(`Failed to load HCP contacts: ${error}`)
      setHcpList([])
      return
    }

    setHcpList(data || [])
  }, [])

  useEffect(() => {
    loadTasks()
    loadVisits()
    loadMaterials()
    loadHCPs()
  }, [loadTasks, loadVisits, loadMaterials, loadHCPs])

  const handleQuickAction = (actionId, setActiveTab) => {
    if (actionId === 'new-log') {
      setActiveTab('log-visit')
      setActionMessage('Ready to log a new visit.')
      return
    }

    if (actionId === 'schedule') {
      setActiveTab('my-visits')
      setIsScheduleFormOpen(true)
      setActionMessage('Schedule a visit using the form below.')
      return
    }

    if (actionId === 'order-samples') {
      setActiveTab('materials')
      setActionMessage('Materials library opened for approved assets.')
      return
    }

    if (actionId === 'submit-report') {
      setActiveTab('tasks')
      setIsTaskFormOpen(true)
      setActionMessage('Fill out the task form to create a follow-up.')
    }
  }

  const handleVisitTopicToggle = (topic) => {
    setVisitForm((prev) => {
      const hasTopic = prev.topics.includes(topic)
      return {
        ...prev,
        topics: hasTopic ? prev.topics.filter((item) => item !== topic) : [...prev.topics, topic],
      }
    })
  }

  const handleSaveVisit = async () => {
    const hcpName = visitForm.hcpName.trim()

    if (!hcpName || !visitForm.dateOfVisit) {
      setActionMessage('Please provide HCP name and visit date.')
      return
    }

    if (!visitForm.complianceConfirmed) {
      setActionMessage('Please confirm that this interaction follows compliance rules before saving.')
      return
    }

    let hcpId = visitForm.hcpId
    if (!hcpId) {
      const existing = hcpList.find((hcp) => (hcp.name || '').trim().toLowerCase() === hcpName.toLowerCase())
      if (existing?.id) {
        hcpId = existing.id
      }
    }

    if (!hcpId) {
      const { data, error } = await hcpQueries.createHCP({
        name: hcpName,
        organisation: 'Not specified',
        location: 'Not specified',
        active: true,
      })

      if (error || !data?.id) {
        setActionMessage(`Failed to save visit log: unable to create HCP record. ${error || ''}`.trim())
        return
      }

      hcpId = data.id
      await loadHCPs()
    }

    const payload = {
      hcp_id: hcpId,
      visit_date: new Date(visitForm.dateOfVisit).toISOString(),
      visit_type: visitForm.topics[0] || 'Other',
      outcome: 'Pending',
      notes: visitForm.notes || null,
      hcp_feedback: visitForm.notes || null,
    }

    const data = await visitQueries.logVisit(payload)
    if (!data) {
      setActionMessage('Failed to save visit log.')
      return
    }

    setActionMessage('Visit log saved successfully.')
    setVisitForm({ hcpId: '', hcpName: '', dateOfVisit: '', durationMinutes: '', topics: [], notes: '', complianceConfirmed: false })
    await loadVisits()
  }

  const handleCancelVisit = () => {
    setVisitForm({ hcpId: '', hcpName: '', dateOfVisit: '', durationMinutes: '', topics: [], notes: '', complianceConfirmed: false })
    setActionMessage('Visit log form cleared.')
  }

  const handleScheduleVisitSubmit = async () => {
    if (!scheduleForm.hcpId) {
      setActionMessage('Please select a Healthcare Professional.')
      return
    }
    if (!scheduleForm.visitDate) {
      setActionMessage('Please set the visit date and time.')
      return
    }

    setIsSavingSchedule(true)
    const payload = {
      hcp_id: scheduleForm.hcpId,
      visit_date: new Date(scheduleForm.visitDate).toISOString(),
      visit_type: scheduleForm.visitType || 'Other',
      outcome: 'Pending',
      notes: scheduleForm.notes.trim() || null,
    }

    const data = await visitQueries.logVisit(payload)
    if (!data) {
      setActionMessage('Failed to schedule visit. Please try again.')
      setIsSavingSchedule(false)
      return
    }

    setActionMessage('Visit scheduled successfully.')
    setScheduleForm({ hcpId: '', visitDate: '', visitType: 'In-person', notes: '' })
    setIsScheduleFormOpen(false)
    await loadVisits()
    setIsSavingSchedule(false)
  }

  const moveTaskToStatus = async (taskId, targetStatus) => {
    const existing = taskList.find((task) => task.id === taskId)
    if (!existing || existing.status === targetStatus) {
      return
    }

    // Only allow update if current user is assignee or creator (by ID)
    const { data: { user } } = await (await import('../../services/supabaseClient')).supabase.auth.getUser();
    const currentUserId = user?.id;
    if (
      !currentUserId ||
      (existing.assignedToId !== currentUserId && existing.createdById !== currentUserId)
    ) {
      setActionMessage('You do not have permission to update this task.');
      return;
    }

    const { error } = await taskQueries.updateTaskStatus(taskId, targetStatus)
    if (error) {
      setActionMessage(`Task update failed: ${error}`)
      return
    }

    setTaskList((prev) => prev.map((task) => (
      task.id === taskId
        ? { ...task, status: targetStatus }
        : task
    )))
    setActionMessage(`Task moved to ${targetStatus}.`)
  }

  const resetTaskForm = () => {
    setTaskForm({
      title: '',
      description: '',
      dueDate: '',
      priority: 'Medium',
    })
  }

  const handleTaskFormSubmit = async () => {
    const title = taskForm.title.trim()
    if (!title) {
      setActionMessage('Task title is required.')
      return
    }

    setIsSavingTask(true)
    const payload = {
      title,
      description: taskForm.description.trim() || 'Task details not provided.',
      status: 'Open',
      priority: taskForm.priority,
      due_date: taskForm.dueDate || null,
    }

    const { error } = await taskQueries.createTask(payload)
    if (error) {
      setActionMessage(`Failed to create task: ${error}`)
      setIsSavingTask(false)
      return
    }

    setActionMessage('New task created.')
    resetTaskForm()
    setIsTaskFormOpen(false)
    await loadTasks()
    setIsSavingTask(false)
  }

  const openVisitUpdateForm = (visit) => {
    if (!visit?.id) return
    setVisitUpdateForm({
      visitId: visit.id,
      outcome: visit.outcome || 'Pending',
      feedback: '',
    })
  }

  const handleVisitUpdateSubmit = async () => {
    if (!visitUpdateForm.visitId) {
      setActionMessage('Select a visit to update first.')
      return
    }

    setIsSavingVisitUpdate(true)
    const result = await visitQueries.updateVisitOutcome(
      visitUpdateForm.visitId,
      visitUpdateForm.outcome,
      visitUpdateForm.feedback.trim() || null
    )

    if (!result) {
      setActionMessage('Failed to update visit outcome.')
      setIsSavingVisitUpdate(false)
      return
    }

    setActionMessage('Visit updated successfully.')
    setVisitUpdateForm({ visitId: '', outcome: 'Pending', feedback: '' })
    await loadVisits()
    setIsSavingVisitUpdate(false)
  }

  const handlePriorityFilter = () => {
    const next = priorityFilter === 'All' ? 'High' : priorityFilter === 'High' ? 'Medium' : priorityFilter === 'Medium' ? 'Low' : 'All'
    setPriorityFilter(next)
    setActionMessage(`Task filter set to ${next}.`)
  }

  const uniqueAssignees = useMemo(() => {
    const names = taskList.map((task) => task.assignedTo).filter(Boolean)
    return ['All', ...Array.from(new Set(names)).sort()]
  }, [taskList])

  const visibleTasks = useMemo(() => {
    let result = priorityFilter === 'All' ? taskList : taskList.filter((task) => task.priority === priorityFilter)
    if (assigneeFilter !== 'All') {
      result = result.filter((task) => task.assignedTo === assigneeFilter)
    }
    const normalizedSearch = taskSearch.trim().toLowerCase()
    if (!normalizedSearch) {
      return result
    }
    return result.filter((task) => (
      (task.title || '').toLowerCase().includes(normalizedSearch) ||
      (task.detail || '').toLowerCase().includes(normalizedSearch)
    ))
  }, [taskList, priorityFilter, assigneeFilter, taskSearch])

  const visibleVisits = useMemo(() => {
    if (visitOutcomeFilter === 'All') return visits
    return visits.filter((visit) => (visit.outcome || '').toLowerCase() === visitOutcomeFilter.toLowerCase())
  }, [visits, visitOutcomeFilter])

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

  const dashboardSchedule = useMemo(() => {
    const now = Date.now()
    return visits
      .filter((visit) => visit.visitDate)
      .sort((a, b) => new Date(a.visitDate) - new Date(b.visitDate))
      .filter((visit) => new Date(visit.visitDate).getTime() >= now - (24 * 60 * 60 * 1000))
      .slice(0, 5)
      .map((visit) => ({
        id: visit.id,
        time: visit.time,
        location: visit.location,
        detail: `${visit.hcp} • ${visit.type}`,
        status: visit.outcome || 'Pending',
      }))
  }, [visits])

  const dashboardMetrics = useMemo(() => {
    const now = new Date()
    const thisMonth = visits.filter((visit) => {
      if (!visit.visitDate) return false
      const d = new Date(visit.visitDate)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })

    const totalVisits = thisMonth.length
    const completedVisits = thisMonth.filter((visit) => {
      const outcome = (visit.outcome || '').toLowerCase()
      return outcome === 'closed' || outcome === 'completed'
    }).length
    const followUpsPending = thisMonth.filter((visit) => {
      const outcome = (visit.outcome || '').toLowerCase()
      return outcome.includes('pending') || outcome.includes('follow')
    }).length
    const conversionRate = totalVisits === 0 ? 0 : Math.round((completedVisits / totalVisits) * 100)
    const progressTarget = 20
    const progressPercent = Math.min(100, Math.round((totalVisits / progressTarget) * 100))
    const monthProgress = now.getDate() / 30
    const weeklyAverage = Math.round(totalVisits / Math.max(monthProgress * 4, 1))
    const completionScore = totalVisits === 0 ? 0 : (completedVisits / totalVisits) * 10

    return {
      totalVisits,
      progressTarget,
      progressPercent,
      conversionRate,
      followUpsPending,
      weeklyAverage,
      qualityScore: completionScore.toFixed(1),
    }
  }, [visits])

  const approvedMaterials = useMemo(
    () => materials.filter((row) => String(row.status || '').toLowerCase() === 'approved'),
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
    await loadMaterials()
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

  return (
    <>
      <DashboardTemplate
        title="Liaison Officer Portal"
        tabs={TABS}
        roleName="Liaison Officer Workspace"
        roleSummary="This workspace links visit logging, task execution, and approved materials so field activity is easy to track and understand."
        roleCapabilities={WORKSPACE_CAPABILITIES}
        pageIntents={PAGE_INTENTS}
        globalActions={WORKFLOW_ACTIONS}
      >
      {(activeTab, setActiveTab) => {
        switch (activeTab) {
          case 'dashboard':
            return (
              <div className={styles.tabContent}>
                {actionMessage && <p className={styles.rowMeta}>{actionMessage}</p>}
                <div className={styles.pageHeader}>
                  <h1>Liaison Overview</h1>
                  <p>Track field visits, schedules, and performance in one view.</p>
                </div>

                <h3 className={styles.sectionTitle}>Quick Actions</h3>
                <div className={styles.quickActionsGrid}>
                  {QUICK_ACTIONS.map((action) => {
                    const Icon = action.icon
                    return (
                      <button
                        type="button"
                        key={action.id}
                        className={styles.quickActionCard}
                        onClick={() => handleQuickAction(action.id, setActiveTab)}
                      >
                        <div className={styles.quickActionIcon}>
                          <Icon size={24} />
                        </div>
                        <p>{action.label}</p>
                      </button>
                    )
                  })}
                </div>

                <div className={styles.overviewGrid}>
                  <section className={styles.scheduleCard}>
                    <div className={styles.cardHeader}>
                      <h3>Daily Schedule</h3>
                      <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => setActiveTab('my-visits')}
                      >
                        View All
                      </button>
                    </div>
                    <div className={styles.scheduleList}>
                      {dashboardSchedule.map((item) => (
                        <div key={item.id} className={styles.scheduleItem}>
                          <span className={styles.scheduleTime}>{item.time}</span>
                          <div className={styles.scheduleInfo}>
                            <p className={styles.scheduleLocation}>{item.location}</p>
                            <p className={styles.scheduleDetail}>{item.detail}</p>
                          </div>
                          <span className={`${styles.statusPill} ${styles[item.status.toLowerCase().replace('-', '')]}`}>
                            {item.status}
                          </span>
                        </div>
                      ))}
                      {!loadingVisits && dashboardSchedule.length === 0 && (
                        <p className={styles.rowMeta}>No upcoming visits yet. Log a visit to populate your schedule.</p>
                      )}
                    </div>
                  </section>

                  <section className={styles.metricsCard}>
                    <h3>Visit Metrics (MTD)</h3>
                    <div className={styles.metricRow}>
                      <div className={styles.metricLabelRow}>
                        <span>Total Visits</span>
                        <span>{dashboardMetrics.totalVisits} / {dashboardMetrics.progressTarget}</span>
                      </div>
                      <div className={styles.metricTrack}>
                        <div className={styles.metricFill} style={{ width: `${dashboardMetrics.progressPercent}%` }}></div>
                      </div>
                    </div>
                    <div className={styles.metricRow}>
                      <div className={styles.metricLabelRow}>
                        <span>Conversion Rate</span>
                        <span>{dashboardMetrics.conversionRate}%</span>
                      </div>
                      <div className={styles.metricTrack}>
                        <div className={styles.metricFill} style={{ width: `${dashboardMetrics.conversionRate}%` }}></div>
                      </div>
                    </div>
                    <div className={styles.metricRow}>
                      <div className={styles.metricLabelRow}>
                        <span>Follow-Ups Pending</span>
                        <span>{dashboardMetrics.followUpsPending}</span>
                      </div>
                      <div className={styles.metricTrack}>
                        <div className={styles.metricFill} style={{ width: `${Math.min(100, dashboardMetrics.followUpsPending * 10)}%` }}></div>
                      </div>
                    </div>

                    <div className={styles.metricsFoot}>
                      <div>
                        <strong>{dashboardMetrics.weeklyAverage}</strong>
                        <span>Avg Visits / Week</span>
                      </div>
                      <div>
                        <strong>{dashboardMetrics.qualityScore}</strong>
                        <span>Quality Score</span>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            )

          case 'log-visit':
            return (
              <div className={styles.tabContent}>
                {actionMessage && <p className={styles.rowMeta}>{actionMessage}</p>}
                <div className={styles.pageHeader}>
                  <h1>Log New Healthcare Provider Visit</h1>
                  <p>Enter the details of your interaction with the healthcare professional.</p>
                </div>

                <form className={styles.visitForm}>
                  <label className={styles.fieldLabel}>Healthcare Professional (HCP) Name</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Search or enter name..."
                    list="liaison-hcp-options"
                    value={visitForm.hcpName}
                    onChange={(e) => {
                      const nextName = e.target.value
                      const matchedHcp = hcpList.find((hcp) => (hcp.name || '').trim().toLowerCase() === nextName.trim().toLowerCase())
                      setVisitForm((prev) => ({ ...prev, hcpName: nextName, hcpId: matchedHcp?.id || '' }))
                    }}
                  />
                  <datalist id="liaison-hcp-options">
                    {hcpList.map((hcp) => (
                      <option key={hcp.id} value={hcp.name} />
                    ))}
                  </datalist>

                  <div className={styles.inlineFields}>
                    <div>
                      <label className={styles.fieldLabel}>Date of Visit</label>
                      <input
                        type="date"
                        className={styles.input}
                        value={visitForm.dateOfVisit}
                        onChange={(e) => setVisitForm((prev) => ({ ...prev, dateOfVisit: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className={styles.fieldLabel}>Duration (Minutes)</label>
                      <input
                        type="number"
                        min="1"
                        className={styles.input}
                        placeholder="e.g. 30"
                        value={visitForm.durationMinutes}
                        onChange={(e) => setVisitForm((prev) => ({ ...prev, durationMinutes: e.target.value }))}
                      />
                    </div>
                  </div>

                  <label className={styles.fieldLabel}>Topics Discussed</label>
                  <div className={styles.checkGrid}>
                    <label><input type="checkbox" checked={visitForm.topics.includes('Product Introduction')} onChange={() => handleVisitTopicToggle('Product Introduction')} /> Product Updates</label>
                    <label><input type="checkbox" checked={visitForm.topics.includes('Training')} onChange={() => handleVisitTopicToggle('Training')} /> Clinical Research</label>
                    <label><input type="checkbox" checked={visitForm.topics.includes('Follow-up')} onChange={() => handleVisitTopicToggle('Follow-up')} /> Safety Protocols</label>
                    <label><input type="checkbox" checked={visitForm.topics.includes('Inventory Review')} onChange={() => handleVisitTopicToggle('Inventory Review')} /> Billing/Admin</label>
                  </div>

                  <label className={styles.fieldLabel}>Detailed Visit Notes</label>
                  <textarea
                    className={styles.textarea}
                    placeholder="Provide a brief summary of the conversation and any action items..."
                    value={visitForm.notes}
                    onChange={(e) => setVisitForm((prev) => ({ ...prev, notes: e.target.value }))}
                  ></textarea>

                  <label className={styles.fieldLabel}>
                    <input
                      type="checkbox"
                      checked={visitForm.complianceConfirmed}
                      onChange={(e) => setVisitForm((prev) => ({ ...prev, complianceConfirmed: e.target.checked }))}
                    />
                    {' '}I confirm this interaction followed approved materials and compliance guidance.
                  </label>

                  <div className={styles.formActions}>
                    <button type="button" className={styles.primaryBtn} onClick={handleSaveVisit}>
                      Save Visit Log
                    </button>
                    <button type="button" className={styles.secondaryBtn} onClick={handleCancelVisit}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )

          case 'my-visits':
            return (
              <div className={styles.tabContent}>
                {actionMessage && <p className={styles.rowMeta}>{actionMessage}</p>}
                <div className={styles.pageHeaderRow}>
                  <div>
                    <h1>My Visits</h1>
                    <p>Field visits, schedules, and interaction outcomes.</p>
                  </div>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => setIsScheduleFormOpen((prev) => !prev)}
                  >
                    {isScheduleFormOpen ? 'Close Schedule Form' : '+ Schedule Visit'}
                  </button>
                </div>

                {isScheduleFormOpen && (
                  <div className={styles.inlineFormCard}>
                    <h3>Schedule a New Visit</h3>
                    <div className={styles.inlineFields}>
                      <div>
                        <label className={styles.fieldLabel}>Healthcare Professional</label>
                        <select
                          className={styles.input}
                          value={scheduleForm.hcpId}
                          onChange={(e) => setScheduleForm((prev) => ({ ...prev, hcpId: e.target.value }))}
                        >
                          <option value="">Select HCP...</option>
                          {hcpList.map((hcp) => (
                            <option key={hcp.id} value={hcp.id}>
                              {hcp.name}{hcp.organisation ? ` — ${hcp.organisation}` : ''}
                            </option>
                          ))}
                        </select>
                        {hcpList.length === 0 && (
                          <small className={styles.rowMeta}>No HCP contacts found. Add contacts via the Admin panel first.</small>
                        )}
                      </div>
                      <div>
                        <label className={styles.fieldLabel}>Visit Date &amp; Time</label>
                        <input
                          type="datetime-local"
                          className={styles.input}
                          value={scheduleForm.visitDate}
                          onChange={(e) => setScheduleForm((prev) => ({ ...prev, visitDate: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className={styles.inlineFields}>
                      <div>
                        <label className={styles.fieldLabel}>Visit Type</label>
                        <select
                          className={styles.input}
                          value={scheduleForm.visitType}
                          onChange={(e) => setScheduleForm((prev) => ({ ...prev, visitType: e.target.value }))}
                        >
                          <option value="In-person">In-person</option>
                          <option value="Virtual">Virtual</option>
                          <option value="Phone">Phone</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                    <label className={styles.fieldLabel}>Notes (optional)</label>
                    <textarea
                      className={styles.textarea}
                      value={scheduleForm.notes}
                      placeholder="Preparation notes, talking points, or reminders for this visit..."
                      onChange={(e) => setScheduleForm((prev) => ({ ...prev, notes: e.target.value }))}
                    ></textarea>
                    <div className={styles.formActions}>
                      <button
                        type="button"
                        className={styles.primaryBtn}
                        disabled={isSavingSchedule}
                        onClick={handleScheduleVisitSubmit}
                      >
                        {isSavingSchedule ? 'Saving...' : 'Schedule Visit'}
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => {
                          setScheduleForm({ hcpId: '', visitDate: '', visitType: 'In-person', notes: '' })
                          setIsScheduleFormOpen(false)
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className={styles.tableCard}>
                  <div className={styles.visitsToolbar}>
                    <label className={styles.fieldLabel}>
                      Outcome Filter
                      <select
                        className={styles.input}
                        value={visitOutcomeFilter}
                        onChange={(e) => setVisitOutcomeFilter(e.target.value)}
                      >
                        <option value="All">All</option>
                        <option value="Pending">Pending</option>
                        <option value="Follow-up Required">Follow-up Required</option>
                        <option value="Closed">Closed</option>
                        <option value="Escalated">Escalated</option>
                      </select>
                    </label>
                  </div>
                  <div className={styles.responsiveTableWrapper}>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>HCP</th>
                          <th>Organisation</th>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Outcome</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleVisits.map((visit) => (
                          <tr key={visit.id}>
                            <td>{visit.hcp}</td>
                            <td>{visit.organisation}</td>
                            <td>{visit.date}</td>
                            <td>{visit.type}</td>
                            <td>{visit.outcome}</td>
                            <td>
                              <div className={styles.visitActions}>
                                <button type="button" className={styles.smallBtn} onClick={() => openVisitUpdateForm(visit)}>Update</button>
                                <button
                                  type="button"
                                  className={styles.smallBtn}
                                  onClick={() => {
                                    setTaskForm({
                                      title: `Follow-up: ${visit.hcp}`,
                                      description: `Follow-up visit from ${visit.date} (${visit.type}).`,
                                      dueDate: '',
                                      priority: 'Medium',
                                    })
                                    setIsTaskFormOpen(true)
                                    setActiveTab('tasks')
                                    setActionMessage('Task form prefilled from selected visit.')
                                  }}
                                >
                                  Create Follow-Up
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!loadingVisits && visibleVisits.length === 0 && (
                          <tr>
                            <td colSpan={6}>No visits found for the selected filter.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {visitUpdateForm.visitId && (
                  <div className={styles.inlineFormCard}>
                    <h3>Update Visit Outcome</h3>
                    <div className={styles.inlineFields}>
                      <div>
                        <label className={styles.fieldLabel}>Outcome</label>
                        <select
                          className={styles.input}
                          value={visitUpdateForm.outcome}
                          onChange={(e) => setVisitUpdateForm((prev) => ({ ...prev, outcome: e.target.value }))}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Follow-up Required">Follow-up Required</option>
                          <option value="Closed">Closed</option>
                          <option value="Escalated">Escalated</option>
                        </select>
                      </div>
                    </div>
                    <label className={styles.fieldLabel}>Feedback / Notes</label>
                    <textarea
                      className={styles.textarea}
                      value={visitUpdateForm.feedback}
                      placeholder="Add optional feedback for this visit update..."
                      onChange={(e) => setVisitUpdateForm((prev) => ({ ...prev, feedback: e.target.value }))}
                    ></textarea>
                    <div className={styles.formActions}>
                      <button type="button" className={styles.primaryBtn} disabled={isSavingVisitUpdate} onClick={handleVisitUpdateSubmit}>
                        {isSavingVisitUpdate ? 'Saving...' : 'Save Update'}
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => setVisitUpdateForm({ visitId: '', outcome: 'Pending', feedback: '' })}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )

          case 'tasks':
            return (
              <div className={styles.tabContent}>
                {actionMessage && <p className={styles.rowMeta}>{actionMessage}</p>}
                <div className={styles.pageHeaderRow}>
                  <div>
                    <h1>Tasks & Follow-Ups</h1>
                    <p>Healthcare Liaison Officer Portal</p>
                  </div>
                </div>

                <div className={styles.tasksToolbar}>
                  <input className={styles.search} placeholder="Search tasks" value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} />
                  <div className={styles.toolbarActions}>
                    <label className={styles.fieldLabel} style={{ margin: 0 }}>
                      Assigned To
                      <select
                        className={styles.input}
                        value={assigneeFilter}
                        onChange={(e) => setAssigneeFilter(e.target.value)}
                      >
                        {uniqueAssignees.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </label>
                    <button type="button" className={styles.secondaryBtn} onClick={handlePriorityFilter}>Priority: {priorityFilter}</button>
                    <button type="button" className={styles.primaryBtn} onClick={() => setIsTaskFormOpen((prev) => !prev)}>
                      {isTaskFormOpen ? 'Close Task Form' : '+ New Task'}
                    </button>
                  </div>
                </div>

                {isTaskFormOpen && (
                  <div className={styles.inlineFormCard}>
                    <h3>Create New Follow-Up Task</h3>
                    <div className={styles.inlineFields}>
                      <div>
                        <label className={styles.fieldLabel}>Task Title</label>
                        <input
                          type="text"
                          className={styles.input}
                          value={taskForm.title}
                          placeholder="Enter task title"
                          onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className={styles.fieldLabel}>Due Date</label>
                        <input
                          type="date"
                          className={styles.input}
                          value={taskForm.dueDate}
                          onChange={(e) => setTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className={styles.inlineFields}>
                      <div>
                        <label className={styles.fieldLabel}>Priority</label>
                        <select
                          className={styles.input}
                          value={taskForm.priority}
                          onChange={(e) => setTaskForm((prev) => ({ ...prev, priority: e.target.value }))}
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>
                    </div>
                    <label className={styles.fieldLabel}>Description</label>
                    <textarea
                      className={styles.textarea}
                      value={taskForm.description}
                      placeholder="Describe required follow-up actions..."
                      onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
                    ></textarea>
                    <div className={styles.formActions}>
                      <button type="button" className={styles.primaryBtn} disabled={isSavingTask} onClick={handleTaskFormSubmit}>
                        {isSavingTask ? 'Saving...' : 'Create Task'}
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => {
                          resetTaskForm()
                          setIsTaskFormOpen(false)
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

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
                            onTouchStart={(e) => { e.preventDefault && e.preventDefault(); handleTaskTouchStart(task.id); }}
                            onTouchMove={(e) => { e.preventDefault && e.preventDefault(); handleTaskTouchMove(e); }}
                            onTouchEnd={(e) => { e.preventDefault && e.preventDefault(); handleTaskTouchEnd(e); }}
                            onTouchCancel={(e) => { e.preventDefault && e.preventDefault(); handleTaskDragEnd(e); }}
                            style={{ position: 'relative' }}
                          >
                            <div className={styles.taskCardHeader}>
                              <p>{task.title}</p>
                              {/* Move bin icon left of priorityDot for better alignment */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <button
                                  type="button"
                                  aria-label="Delete task"
                                  className={styles.binIconBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmTaskId(task.id);
                                  }}
                                  disabled={isDeletingTask}
                                >
                                  <span className="glyphicon" style={{ color: '#dc2626', fontSize: 15 }}>&#xe020;</span>
                                </button>
                                <span className={`${styles.priorityDot} ${styles[task.priority.toLowerCase()]}`}></span>
                              </div>
                            </div>
                            <small>{task.detail}</small>
                            <small>Due: {task.due}</small>
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
                          </div>
                        ))}
                        {!loadingTasks && columnTasks.length === 0 && (
                          <p className={styles.rowMeta}>No tasks in this column.</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )

          case 'materials':
            return (
              <MaterialsLibrary
                tabClassName={styles.tabContent}
                actionMessage={actionMessage}
                actionMessageClassName={styles.rowMeta}
                uploadInputRef={replaceMaterialInputRef /* use as dummy, disables upload */}
                onUploadChange={() => {}}
                replaceInputRef={replaceMaterialInputRef}
                onReplaceChange={handleReplaceMaterialSelected}
                uploadButtonLabel="Upload Material"
                isUploading={isUploading}
                materials={approvedMaterials}
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
                canUploadMaterials={false}
                canManageFolders={false}
                canReplaceMaterials={false}
                onDownloadMaterial={async (material) => {
                  const { data, error } = await materialQueries.getApprovedMaterialDownloadUrl(material)
                  if (error) {
                    setActionMessage(error)
                    return
                  }
                  window.open(data.url, '_blank', 'noopener,noreferrer')
                }}
                uploadManager={{
                  enabled: false,
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
                  onFileChange: () => {},
                  onSubmit: () => {},
                  onReset: resetUploadForm,
                }}
                folderManager={{
                  enabled: false,
                  newFolderName,
                  onNewFolderNameChange: setNewFolderName,
                  newFolderCampaignId,
                  onNewFolderCampaignIdChange: setNewFolderCampaignId,
                  campaigns: uploadCampaigns,
                  folders,
                  onCreateFolder: () => {},
                }}
              />
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
