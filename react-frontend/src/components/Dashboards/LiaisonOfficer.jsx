import React, { useEffect, useMemo, useRef, useState } from 'react'
import DashboardTemplate from '../Layout/DashboardTemplate'
import styles from './LiaisonOfficer.module.css'
import { materialQueries, taskQueries, visitQueries } from '../../services/supabaseHelpers'
import {
  PlusIcon,
  CalendarIcon,
  ClipboardIcon,
  FileIcon,
  UserGroupIcon,
  BarChartIcon,
  VideoIcon,
  CheckCircleIcon,
} from '../Icons/IconSet'

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'log-visit', label: 'Log Visit' },
  { id: 'my-visits', label: 'My Visits' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'materials', label: 'Materials' },
]

const QUICK_ACTIONS = [
  { id: 'new-log', label: 'New Log', icon: PlusIcon },
  { id: 'schedule', label: 'Schedule Visit', icon: CalendarIcon },
  { id: 'order-samples', label: 'Order Samples', icon: ClipboardIcon },
  { id: 'submit-report', label: 'Submit Report', icon: FileIcon },
]

const SCHEDULE = [
  {
    id: 1,
    time: '09:00 AM',
    location: 'St. Jude Medical Center',
    detail: 'Dr. Helena Vance • Product Introduction',
    status: 'Confirmed',
  },
  {
    id: 2,
    time: '11:30 AM',
    location: 'City General Pharmacy',
    detail: 'Inventory Check • Mark Lawson',
    status: 'In-Transit',
  },
  {
    id: 3,
    time: '02:00 PM',
    location: 'Alderwell Internal Sync',
    detail: 'Digital Room 4 • Regional Strategy',
    status: 'Internal',
  },
  {
    id: 4,
    time: '04:15 PM',
    location: 'Westside Clinic',
    detail: 'Dr. Marcus Webb • Clinical Trial Data',
    status: 'Pending',
  },
]

const VISITS = [
  {
    id: 1,
    hcp: 'Dr. Helena Vance',
    organisation: 'St. Jude Medical Center',
    date: '24 Oct 2023',
    type: 'Product Introduction',
    outcome: 'Follow-up Required',
  },
  {
    id: 2,
    hcp: 'Mark Lawson',
    organisation: 'City General Pharmacy',
    date: '22 Oct 2023',
    type: 'Inventory Review',
    outcome: 'Closed',
  },
  {
    id: 3,
    hcp: 'Dr. Priya Shah',
    organisation: 'Northgate Clinic',
    date: '19 Oct 2023',
    type: 'Safety Protocol Review',
    outcome: 'Pending Report',
  },
]

const TASKS = [
  {
    id: 1,
    title: 'Schedule specialist referral for Patient #8821',
    detail: 'Pending lab results verification from morning visit.',
    location: "St. Mary's - Room 402",
    due: '24 Oct 2023',
    priority: 'High',
  },
  {
    id: 2,
    title: 'Update insurance documentation',
    detail: 'Liaise with billing regarding the outlier case in Ward B.',
    location: 'Central Clinic',
    due: '25 Oct 2023',
    priority: 'Medium',
  },
  {
    id: 3,
    title: 'Quarterly feedback survey collection',
    detail: 'General follow-up post-discharge for oncology patients.',
    location: 'Oncology Dept.',
    due: '01 Nov 2023',
    priority: 'Low',
  },
  {
    id: 4,
    title: 'Emergency medication procurement',
    detail: 'Coordinate with pharmacy for immediate delivery to ICU.',
    location: 'ICU North',
    due: '24 Oct 2023',
    priority: 'High',
  },
]

export default function LiaisonOfficer() {
  const [taskList, setTaskList] = useState([])
  const [visits, setVisits] = useState([])
  const [materials, setMaterials] = useState([])
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [taskSearch, setTaskSearch] = useState('')
  const [materialSearch, setMaterialSearch] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [loadingVisits, setLoadingVisits] = useState(true)
  const [loadingMaterials, setLoadingMaterials] = useState(true)
  const [visitForm, setVisitForm] = useState({
    hcpName: '',
    dateOfVisit: '',
    durationMinutes: '',
    topics: [],
    notes: '',
  })
  const uploadInputRef = useRef(null)

  useEffect(() => {
    loadTasks()
    loadVisits()
    loadMaterials()
  }, [])

  const loadTasks = async () => {
    setLoadingTasks(true)
    const { data, error } = await taskQueries.getCurrentUserTasks()
    if (error) {
      setActionMessage(`Failed to load tasks: ${error}`)
      setTaskList(TASKS)
      setLoadingTasks(false)
      return
    }

    const mappedTasks = (data || []).map((task, index) => ({
      id: task.id,
      title: task.title,
      detail: task.description || 'Task details not provided.',
      location: task.related_campaign_id || 'General',
      due: task.due_date || 'No due date',
      priority: task.priority || ['Low', 'Medium', 'High'][index % 3],
      status: task.status,
    }))

    setTaskList(mappedTasks)
    setLoadingTasks(false)
  }

  const loadVisits = async () => {
    setLoadingVisits(true)
    const rows = await visitQueries.getMyVisits()
    if (!rows) {
      setActionMessage('Failed to load visits.')
      setVisits(VISITS)
      setLoadingVisits(false)
      return
    }

    const mappedVisits = rows.map((visit) => ({
      id: visit.id,
      hcp: visit.hcp?.name || 'Unknown HCP',
      organisation: visit.hcp?.organisation || 'Unknown organisation',
      date: visit.visit_date ? new Date(visit.visit_date).toLocaleDateString('en-GB') : 'N/A',
      type: visit.visit_type || 'Other',
      outcome: visit.outcome || 'Pending',
    }))

    setVisits(mappedVisits)
    setLoadingVisits(false)
  }

  const loadMaterials = async () => {
    setLoadingMaterials(true)
    const { data, error } = await materialQueries.getAllMaterials()
    if (error) {
      setActionMessage(`Failed to load materials: ${error}`)
      setMaterials([])
      setLoadingMaterials(false)
      return
    }

    setMaterials(data || [])
    setLoadingMaterials(false)
  }

  const handlePlaceholderAction = (message = 'Action complete.') => {
    setActionMessage(message)
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
    if (!visitForm.hcpName || !visitForm.dateOfVisit) {
      setActionMessage('Please provide HCP name and visit date.')
      return
    }

    const payload = {
      visit_date: new Date(visitForm.dateOfVisit).toISOString(),
      visit_type: visitForm.topics[0] || 'Other',
      outcome: 'Pending',
      location: 'Field Visit',
      notes: visitForm.notes || null,
      hcp_feedback: visitForm.notes || null,
    }

    const data = await visitQueries.logVisit(payload)
    if (!data) {
      setActionMessage('Failed to save visit log.')
      return
    }

    setActionMessage('Visit log saved successfully.')
    setVisitForm({ hcpName: '', dateOfVisit: '', durationMinutes: '', topics: [], notes: '' })
    await loadVisits()
  }

  const handleCancelVisit = () => {
    setVisitForm({ hcpName: '', dateOfVisit: '', durationMinutes: '', topics: [], notes: '' })
    setActionMessage('Visit log form cleared.')
  }

  const handleResolveTask = (taskId) => {
    const run = async () => {
      const { error } = await taskQueries.updateTaskStatus(taskId, 'Completed')
      if (error) {
        setActionMessage(`Failed to resolve task: ${error}`)
        return
      }

      setActionMessage('Task marked as resolved.')
      await loadTasks()
    }

    run()
  }

  const handlePriorityFilter = () => {
    const next = priorityFilter === 'All' ? 'High' : priorityFilter === 'High' ? 'Medium' : priorityFilter === 'Medium' ? 'Low' : 'All'
    setPriorityFilter(next)
    setActionMessage(`Task filter set to ${next}.`)
  }

  const visibleTasks = useMemo(() => {
    const openTasks = taskList.filter((task) => task.status !== 'Completed')
    const filteredByPriority = priorityFilter === 'All' ? openTasks : openTasks.filter((task) => task.priority === priorityFilter)
    const normalizedSearch = taskSearch.trim().toLowerCase()
    if (!normalizedSearch) {
      return filteredByPriority
    }

    return filteredByPriority.filter((task) => (
      (task.title || '').toLowerCase().includes(normalizedSearch) ||
      (task.detail || '').toLowerCase().includes(normalizedSearch)
    ))
  }, [taskList, priorityFilter, taskSearch])

  const visibleMaterials = useMemo(() => {
    const q = materialSearch.trim().toLowerCase()
    if (!q) return materials
    return materials.filter((row) => (
      (row.name || '').toLowerCase().includes(q) ||
      (row.description || '').toLowerCase().includes(q) ||
      (row.file_type || '').toLowerCase().includes(q)
    ))
  }, [materials, materialSearch])

  const handleCreateTask = () => {
    const run = async () => {
      const now = new Date()
      const dueDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const { error } = await taskQueries.createTask({
        title: `Follow-up Task ${Math.floor(Math.random() * 1000)}`,
        description: 'Created from Liaison Officer dashboard',
        status: 'Open',
        priority: 'Medium',
        due_date: dueDate,
      })

      if (error) {
        setActionMessage(`Failed to create task: ${error}`)
        return
      }

      setActionMessage('New task created.')
      await loadTasks()
    }

    run()
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
        description: 'Uploaded from Liaison Officer dashboard',
      },
      file
    )

    if (error) {
      setActionMessage(`Upload failed: ${error}`)
    } else {
      setActionMessage(`${file.name} uploaded successfully.`)
      await loadMaterials()
    }

    setIsUploading(false)
    event.target.value = ''
  }

  return (
    <DashboardTemplate title="Liaison Officer Portal" tabs={TABS}>
      {(activeTab) => {
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
                        onClick={() => handlePlaceholderAction(`${action.label} opened.`)}
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
                        onClick={() => handlePlaceholderAction('Opened full daily schedule.')}
                      >
                        View All
                      </button>
                    </div>
                    <div className={styles.scheduleList}>
                      {SCHEDULE.map((item) => (
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
                    </div>
                  </section>

                  <section className={styles.metricsCard}>
                    <h3>Visit Metrics (MTD)</h3>
                    <div className={styles.metricRow}>
                      <div className={styles.metricLabelRow}>
                        <span>Total Visits</span>
                        <span>42 / 60</span>
                      </div>
                      <div className={styles.metricTrack}>
                        <div className={styles.metricFill} style={{ width: '70%' }}></div>
                      </div>
                    </div>
                    <div className={styles.metricRow}>
                      <div className={styles.metricLabelRow}>
                        <span>Conversion Rate</span>
                        <span>18%</span>
                      </div>
                      <div className={styles.metricTrack}>
                        <div className={styles.metricFill} style={{ width: '18%' }}></div>
                      </div>
                    </div>
                    <div className={styles.metricRow}>
                      <div className={styles.metricLabelRow}>
                        <span>Follow-Ups Pending</span>
                        <span>12</span>
                      </div>
                      <div className={styles.metricTrack}>
                        <div className={styles.metricFill} style={{ width: '45%' }}></div>
                      </div>
                    </div>

                    <div className={styles.metricsFoot}>
                      <div>
                        <strong>14</strong>
                        <span>Avg Visits / Week</span>
                      </div>
                      <div>
                        <strong>8.5</strong>
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
                    value={visitForm.hcpName}
                    onChange={(e) => setVisitForm((prev) => ({ ...prev, hcpName: e.target.value }))}
                  />

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
                <div className={styles.pageHeader}>
                  <h1>My Visits</h1>
                  <p>Recent field visits and interaction outcomes.</p>
                </div>

                <div className={styles.tableCard}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>HCP</th>
                        <th>Organisation</th>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visits.map((visit) => (
                        <tr key={visit.id}>
                          <td>{visit.hcp}</td>
                          <td>{visit.organisation}</td>
                          <td>{visit.date}</td>
                          <td>{visit.type}</td>
                          <td>{visit.outcome}</td>
                        </tr>
                      ))}
                      {!loadingVisits && visits.length === 0 && (
                        <tr>
                          <td colSpan={5}>No visits logged yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
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
                    <button type="button" className={styles.secondaryBtn} onClick={handlePriorityFilter}>Filter by Priority ({priorityFilter})</button>
                    <button type="button" className={styles.primaryBtn} onClick={handleCreateTask}>+ New Task</button>
                  </div>
                </div>

                <div className={styles.tableCard}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>Prio</th>
                        <th>Follow-Up Task Details</th>
                        <th>Related Visit</th>
                        <th>Due Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTasks.map((task) => (
                        <tr key={task.id}>
                          <td>
                            <span className={`${styles.priorityDot} ${styles[task.priority.toLowerCase()]}`}></span>
                          </td>
                          <td>
                            <strong>{task.title}</strong>
                            <p className={styles.rowMeta}>{task.detail}</p>
                          </td>
                          <td>{task.location}</td>
                          <td>{task.due}</td>
                          <td>
                            <button type="button" className={styles.smallBtn} onClick={() => handleResolveTask(task.id)}>Resolve</button>
                          </td>
                        </tr>
                      ))}
                      {!loadingTasks && visibleTasks.length === 0 && (
                        <tr>
                          <td colSpan={5}>No open tasks found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )

          case 'materials':
            return (
              <div className={styles.tabContent}>
                {actionMessage && <p className={styles.rowMeta}>{actionMessage}</p>}
                <div className={styles.materialsHeader}>
                  <h2>Materials</h2>
                  <div className={styles.materialsActions}>
                    <input
                      type="text"
                      className={styles.materialsSearch}
                      placeholder="Search materials..."
                      value={materialSearch}
                      onChange={(e) => setMaterialSearch(e.target.value)}
                    />
                    <input
                      ref={uploadInputRef}
                      type="file"
                      hidden
                      onChange={handleMaterialFileSelected}
                    />
                    <button type="button" className={styles.uploadBtn} onClick={handleUploadClick} disabled={isUploading}>
                      {isUploading ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                </div>

                <div className={styles.materialsGrid}>
                  {visibleMaterials.map((material) => {
                    const lowerType = (material.file_type || '').toLowerCase()
                    let Icon = FileIcon
                    if (lowerType.includes('mp4') || lowerType.includes('video')) Icon = VideoIcon
                    if (lowerType.includes('pdf')) Icon = BarChartIcon
                    if (lowerType.includes('ppt') || lowerType.includes('presentation')) Icon = UserGroupIcon
                    if (lowerType.includes('zip')) Icon = CheckCircleIcon

                    return (
                      <div className={styles.materialCard} key={material.id}>
                        <div className={styles.materialIcon}><Icon size={32} /></div>
                        <h4>{material.name || 'Untitled Material'}</h4>
                        <p>{(material.file_type || 'File').toUpperCase()} • {material.status || 'Submitted'}</p>
                        <button
                          type="button"
                          className={styles.linkButton}
                          disabled={(material.status || '').toLowerCase() !== 'approved'}
                          onClick={async () => {
                            const { data, error } = await materialQueries.getApprovedMaterialDownloadUrl(material)
                            if (error) {
                              setActionMessage(error)
                              return
                            }
                            window.open(data.url, '_blank', 'noopener,noreferrer')
                            setActionMessage(`Opened ${material.name}.`)
                          }}
                        >
                          Download
                        </button>
                      </div>
                    )
                  })}
                  {!loadingMaterials && visibleMaterials.length === 0 && (
                    <p className={styles.rowMeta}>No materials found.</p>
                  )}
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
