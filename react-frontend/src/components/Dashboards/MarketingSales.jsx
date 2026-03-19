import React, { useEffect, useMemo, useRef, useState } from 'react'
import DashboardTemplate from '../Layout/DashboardTemplate'
import styles from './MarketingSales.module.css'
import campaignStyles from './CampaignManagement.module.css'
import { auditQueries, campaignQueries, complianceQueries, hcpQueries, materialQueries, taskQueries } from '../../services/supabaseHelpers'
import {
  PlusIcon,
  CalendarIcon,
  UserGroupIcon,
  EnvelopeIcon,
  FileIcon,
  BarChartIcon,
  VideoIcon,
  ClipboardIcon,
  CheckCircleIcon,
} from '../Icons/IconSet'

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'crm', label: 'CRM' },
  { id: 'interaction-log', label: 'Interaction Log' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'materials', label: 'Materials' },
]

const HCP_DATA = [
  {
    id: 1,
    name: 'Dr. Sarah Jenkins',
    qualification: 'MBBS, MRCP',
    specialism: 'Cardiology',
    organisation: "St. Mary's Hospital",
    location: 'London, UK',
    lastInteraction: '12 Oct 2023',
  },
  {
    id: 2,
    name: 'Dr. Arjan Singh',
    qualification: 'MBChB, DRCOG',
    specialism: 'General Practice',
    organisation: 'Northway Health Centre',
    location: 'Birmingham, UK',
    lastInteraction: '28 Sep 2023',
  },
  {
    id: 3,
    name: 'Prof. Elena Rossi',
    qualification: 'MD, PhD, FRCP',
    specialism: 'Oncology',
    organisation: 'Royal Marsden NHS Foundation',
    location: 'London, UK',
    lastInteraction: '15 Oct 2023',
  },
  {
    id: 4,
    name: 'Dr. James Miller',
    qualification: 'MBChB, FRCA',
    specialism: 'Anaesthetics',
    organisation: 'City General Hospital',
    location: 'Manchester, UK',
    lastInteraction: '05 Oct 2023',
  },
]

const TASKS = [
  { id: 1, title: 'Review Q4 Sales Targets', due: 'Today', status: 'Open' },
  { id: 2, title: 'Email Dr. Aris follow-up', due: 'Tomorrow', status: 'In Progress' },
  { id: 3, title: 'Update CRM for North Clinic', due: 'Friday', status: 'Completed' },
]

const TASK_COLUMNS = [
  { id: 'Open', label: 'To Do' },
  { id: 'In Progress', label: 'In Progress' },
  { id: 'Completed', label: 'Completed' },
]

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

export default function MarketingSales() {
  const [searchQuery, setSearchQuery] = useState('')
  const [tasks, setTasks] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [materials, setMaterials] = useState([])
  const [materialSearch, setMaterialSearch] = useState('')
  const [materialTypeFilter, setMaterialTypeFilter] = useState('all')
  const [materialCampaignFilter, setMaterialCampaignFilter] = useState('all')
  const [actionMessage, setActionMessage] = useState('')
  const [hcpList, setHcpList] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [isLoadingCrm, setIsLoadingCrm] = useState(true)
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)
  const [crmSearch, setCrmSearch] = useState('')
  const [interactionHcpId, setInteractionHcpId] = useState('')
  const [interactionType, setInteractionType] = useState('Call')
  const [interactionNotes, setInteractionNotes] = useState('')
  const [recentActivities, setRecentActivities] = useState([])
  const [showAllActivity, setShowAllActivity] = useState(false)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false)
  const [isClientsModalOpen, setIsClientsModalOpen] = useState(false)
  const [isAddHcpModalOpen, setIsAddHcpModalOpen] = useState(false)
  const [selectedHcp, setSelectedHcp] = useState(null)
  const [isSavingTask, setIsSavingTask] = useState(false)
  const [isSavingHcp, setIsSavingHcp] = useState(false)
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [dropTargetStatus, setDropTargetStatus] = useState('')
  const [mobileDraggingTaskId, setMobileDraggingTaskId] = useState(null)
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [materialToReplace, setMaterialToReplace] = useState(null)
  const [isReplacingMaterial, setIsReplacingMaterial] = useState(false)
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 'Medium',
  })
  const [hcpForm, setHcpForm] = useState({
    name: '',
    qualification: '',
    specialism: '',
    organisation: '',
    location: '',
    email: '',
    phone: '',
    country: '',
  })
  const uploadInputRef = useRef(null)
  const replaceMaterialInputRef = useRef(null)

  useEffect(() => {
    loadCrm()
    loadTasks()
    loadCampaigns()
    loadMaterials()
    loadRecentActivity()
  }, [])

  const appendLocalActivity = (type, title, detail) => {
    setRecentActivities((prev) => ([
      {
        id: `local-${Date.now()}-${Math.random()}`,
        type,
        title,
        detail,
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ]).slice(0, 25))
  }

  const loadRecentActivity = async () => {
    const logs = await auditQueries.getActivityLogs()
    if (!Array.isArray(logs)) {
      setRecentActivities([])
      return
    }

    const mapped = logs.map((entry) => {
      const type = mapAuditType(entry)
      const actionLabel = (entry.action || 'Activity logged').replace(/_/g, ' ')
      const title = actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)
      const detailParts = [getRelativeTime(entry.timestamp)]
      if (entry.resource_type) detailParts.push(`Resource: ${entry.resource_type}`)

      return {
        id: entry.id,
        type,
        title,
        detail: detailParts.join(' • '),
        timestamp: entry.timestamp,
      }
    })

    setRecentActivities(mapped)
  }

  const loadCampaigns = async () => {
    const { data, error } = await campaignQueries.getAllCampaigns()
    if (error) {
      setActionMessage(`Failed to load campaigns: ${error}`)
      setCampaigns([])
      return
    }
    setCampaigns(data || [])
  }

  const loadMaterials = async () => {
    const { data, error } = await materialQueries.getAllMaterials()
    if (error) {
      setActionMessage(`Failed to load materials: ${error}`)
      setMaterials([])
      return
    }
    setMaterials(data || [])
  }

  const loadCrm = async () => {
    setIsLoadingCrm(true)
    const { data, error } = await hcpQueries.getAllHCPs()
    if (error) {
      setActionMessage(`Failed to load HCPs: ${error}`)
      setHcpList(HCP_DATA)
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
  }

  const loadTasks = async () => {
    setIsLoadingTasks(true)
    const { data, error } = await taskQueries.getCurrentUserTasks()
    if (error) {
      setActionMessage(`Failed to load tasks: ${error}`)
      setTasks(TASKS)
      setIsLoadingTasks(false)
      return
    }

    const mappedTasks = (data || []).map((task) => ({
      id: task.id,
      title: task.title,
      due: task.due_date || 'No due date',
      status: task.status || 'Open',
      completed: task.status === 'Completed',
      created_at: task.created_at,
    }))

    setTasks(mappedTasks)
    setIsLoadingTasks(false)
  }

  const handlePlaceholderAction = (message = 'Action complete.') => {
    setActionMessage(message)
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
    const { error } = await hcpQueries.createHCP({
      ...hcpForm,
      active: true,
    })

    if (error) {
      setActionMessage(`Failed to create HCP: ${error}`)
      setIsSavingHcp(false)
      return
    }

    appendLocalActivity('email', `Added HCP ${hcpForm.name}`, 'CRM record created')
    setActionMessage('New HCP created.')
    setIsAddHcpModalOpen(false)
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
    const { error } = await hcpQueries.logInteraction(interactionHcpId, {
      interaction_type: interactionType,
      notes: interactionNotes || 'No notes provided',
    })

    if (error) {
      setActionMessage(`Failed to log interaction: ${error}`)
      return
    }

    appendLocalActivity('email', `Interaction logged${selected?.name ? ` with ${selected.name}` : ''}`, `${interactionType} • ${getRelativeTime(new Date().toISOString())}`)
    setInteractionNotes('')
    setActionMessage('Interaction logged successfully.')
    if (fromQuickAction) {
      setIsInteractionModalOpen(false)
    }
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
        description: 'Uploaded from Marketing & Sales dashboard',
      },
      file
    )

    if (error) {
      setActionMessage(`Upload failed: ${error}`)
    } else {
      appendLocalActivity('download', `Uploaded material ${file.name}`, 'Awaiting compliance review')
      setActionMessage(`${file.name} uploaded successfully.`)
      await loadMaterials()
      await loadRecentActivity()
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
    appendLocalActivity('download', `Material file updated: ${data?.name || materialToReplace.name}`, `By ${updatedBy} • ${updatedAt}`)
    setActionMessage(`Updated ${data?.name || materialToReplace.name}. By ${updatedBy} at ${updatedAt}.`)
    await loadMaterials()
    await loadRecentActivity()
    setMaterialToReplace(null)
    setIsReplacingMaterial(false)
    event.target.value = ''
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

  const filteredHcps = useMemo(() => {
    const q = crmSearch.trim().toLowerCase()
    if (!q) return hcpList
    return hcpList.filter((hcp) => (
      (hcp.name || '').toLowerCase().includes(q) ||
      (hcp.organisation || '').toLowerCase().includes(q) ||
      (hcp.location || '').toLowerCase().includes(q)
    ))
  }, [hcpList, crmSearch])

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

  return (
    <>
      <DashboardTemplate title="Sales & Marketing" tabs={TABS}>
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
                    <select className={styles.crmFilter}>
                      <option>All Specialisms</option>
                      <option>Cardiology</option>
                      <option>Oncology</option>
                      <option>General Practice</option>
                    </select>
                    <select className={styles.crmFilter}>
                      <option>Region: All</option>
                      <option>London</option>
                      <option>Manchester</option>
                      <option>Birmingham</option>
                    </select>
                    <button type="button" className={styles.addHcpBtn} onClick={() => setIsAddHcpModalOpen(true)}>Add New HCP</button>
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
                      {filteredHcps.map((hcp) => (
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
                              onClick={() => {
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
                                setActionMessage('Edit mode prefilled. Submit Add New HCP form to create a new record with updated details.')
                                setIsAddHcpModalOpen(true)
                              }}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!isLoadingCrm && filteredHcps.length === 0 && (
                        <tr>
                          <td colSpan={6}>No HCPs found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className={styles.crmPagination}>
                  <span>Page 1 of 12</span>
                  {' '}
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={handlePlaceholderAction}
                  >
                    Previous
                  </button>
                  {' '}
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => handlePlaceholderAction('Moved to next page (demo).')}
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
                  <textarea
                    placeholder="Interaction Notes"
                    className={styles.formTextarea}
                    value={interactionNotes}
                    onChange={(e) => setInteractionNotes(e.target.value)}
                  ></textarea>
                  <button type="button" className={styles.submitBtn} onClick={(event) => handleLogInteraction(event, false)}>Log Interaction</button>
                </div>
              </div>
            )

          case 'tasks':
            return (
              <div className={styles.tabContent}>
                {actionMessage && <p className={styles.small}>{actionMessage}</p>}
                <div className={styles.tasksHeader}>
                  <h2>Task Management</h2>
                  <button type="button" className={styles.addTaskFromBoardBtn} onClick={() => setIsTaskModalOpen(true)}>
                    + New Task
                  </button>
                </div>
                <div className={styles.taskBoard}>
                  {TASK_COLUMNS.map((column) => {
                    const columnTasks = tasks.filter((task) => (task.status || 'Open') === column.id)
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
                          >
                            <p>{task.title}</p>
                            <small>Due: {task.due}</small>
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
                <h2>Campaigns</h2>
                <div className={styles.campaignsGrid}>
                  {campaigns.map((campaign) => {
                    const status = (campaign.status || 'Planning').toLowerCase()
                    const progress = status === 'active' ? 70 : status === 'planning' ? 35 : status === 'on hold' ? 45 : 100
                    return (
                      <div className={styles.campaignCard} key={campaign.id}>
                        <h3>{campaign.name}</h3>
                        <p>{campaign.description || 'No description provided'}</p>
                        <div className={styles.progressBar}>
                          <div className={styles.progress} style={{ width: `${progress}%` }}>
                            {campaign.status || 'Planning'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {campaigns.length === 0 && <p className={styles.small}>No campaigns found.</p>}
                </div>
              </div>
            )

          case 'materials':
            return (
              <div className={styles.tabContent}>
                {actionMessage && <p className={styles.small}>{actionMessage}</p>}
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
                        <p className={campaignStyles.rowMeta}>Last edited by {getMaterialEditorName(material)}</p>
                        <div className={campaignStyles.materialCardActions}>
                          <button
                            type="button"
                            className={campaignStyles.linkBtn}
                            onClick={() => setSelectedMaterial(material)}
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            className={campaignStyles.linkBtn}
                            onClick={() => handleFlagMaterial(material)}
                          >
                            Flag
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
                  {visibleMaterials.length === 0 && <p className={campaignStyles.rowMeta}>No materials found.</p>}
                </div>
              </div>
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
            <p className={campaignStyles.rowMeta}>Last edited by: {getMaterialEditorName(selectedMaterial)}</p>
            <div className={campaignStyles.materialCardActions}>
              <button type="button" className={campaignStyles.linkBtn} onClick={() => handleFlagMaterial(selectedMaterial)}>Flag For Compliance</button>
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
          </div>
        </div>
      )}

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
                <button type="button" className={styles.secondaryBtn} onClick={() => setIsAddHcpModalOpen(false)}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={isSavingHcp}>{isSavingHcp ? 'Saving...' : 'Save HCP'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
