// ============================================================================
// Migration Guide: From Mock Data to Live Supabase
// ============================================================================
// This file shows how to transition your React components from mock data
// to live Supabase queries
// ============================================================================

// ============================================================================
// EXAMPLE 1: ADMIN COMPONENT - CAMPAIGNS
// ============================================================================

// BEFORE (Using Mock Data):
// --------
// const MOCK_CAMPAIGNS = [
//   { id: 'CMP-001', name: 'CardioShield Q4 Awareness', owner: 'Sarah Johnson', status: 'Active', startDate: '2023-10-01', endDate: '2023-12-31' },
//   { id: 'CMP-002', name: 'DiabetesPlus Educator Training', owner: 'Michael Chen', status: 'Active', startDate: '2023-09-15', endDate: '2024-02-15' },
// ]
//
// const Admin = () => {
//   const [campaigns, setCampaigns] = useState(MOCK_CAMPAIGNS)
//   // ... uses mock data directly
// }

// AFTER (Using Supabase):
// --------
import React, { useEffect, useState } from 'react'
import { campaignQueries } from '../services/supabaseHelpers'

const Admin = () => {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        setLoading(true)
        const data = await campaignQueries.getAllCampaigns()
        setCampaigns(data || [])
      } catch (error) {
        console.error('Failed to load campaigns:', error)
      } finally {
        setLoading(false)
      }
    }

    loadCampaigns()
  }, [])

  if (loading) return <div>Loading campaigns...</div>

  return (
    <div>
      {campaigns.map(campaign => (
        <div key={campaign.id}>
          <h3>{campaign.name}</h3>
          <p>Owner: {campaign.owner?.full_name || 'Unknown'}</p>
          <p>Status: {campaign.status}</p>
          <p>{campaign.start_date} to {campaign.end_date}</p>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// EXAMPLE 2: MARKETING COMPONENT - HCP CONTACTS
// ============================================================================

// BEFORE (Using Mock Data):
// const HCP_DATA = [
//   {
//     id: 1,
//     name: 'Dr. Sarah Jenkins',
//     qualification: 'MBBS, MRCP',
//     specialism: 'Cardiology',
//     organisation: "St. Mary's Hospital",
//     location: 'London, UK',
//     lastInteraction: '12 Oct 2023',
//   },
// ]
//
// const MarketingSales = () => {
//   const [hcps, setHcps] = useState(HCP_DATA)
// }

// AFTER (Using Supabase):
import { hcpQueries } from '../services/supabaseHelpers'

const MarketingSalesHCPTab = () => {
  const [hcps, setHcps] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const loadHCPs = async () => {
      try {
        setLoading(true)
        let data
        if (searchTerm) {
          data = await hcpQueries.searchHCPs(searchTerm)
        } else {
          data = await hcpQueries.getAllHCPs()
        }
        setHcps(data || [])
      } catch (error) {
        console.error('Failed to load HCPs:', error)
      } finally {
        setLoading(false)
      }
    }

    loadHCPs()
  }, [searchTerm])

  return (
    <div>
      <input
        type="text"
        placeholder="Search HCPs..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Qualification</th>
              <th>Specialism</th>
              <th>Organisation</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {hcps.map(hcp => (
              <tr key={hcp.id}>
                <td>{hcp.name}</td>
                <td>{hcp.qualification}</td>
                <td>{hcp.specialism}</td>
                <td>{hcp.organisation}</td>
                <td>{hcp.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ============================================================================
// EXAMPLE 3: MATERIAL APPROVAL WORKFLOW
// ============================================================================

// BEFORE (Mock submissions):
// const MOCK_SUBMISSIONS = [
//   { id: 'SUB-401', campaign: 'CMP-001', material: 'Q4 Brochure Design', submitter: 'Marketing Team', date: '2023-10-15', status: 'Pending Review' },
// ]

// AFTER (Live with approval actions):
const MaterialApprovalCenter = () => {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPendingApprovals()
  }, [])

  const loadPendingApprovals = async () => {
    try {
      setLoading(true)
      const data = await materialQueries.getPendingApprovals()
      setSubmissions(data || [])
    } catch (error) {
      console.error('Failed to load submissions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (materialId) => {
    try {
      await materialQueries.reviewMaterial(materialId, 'Approved', '')
      // Refresh the list
      await loadPendingApprovals()
    } catch (error) {
      console.error('Approval failed:', error)
    }
  }

  const handleReject = async (materialId, reason) => {
    try {
      await materialQueries.reviewMaterial(materialId, 'Rejected', reason)
      // Refresh the list
      await loadPendingApprovals()
    } catch (error) {
      console.error('Rejection failed:', error)
    }
  }

  return (
    <div>
      <h2>Material Approvals</h2>
      {loading ? (
        <p>Loading...</p>
      ) : submissions.length === 0 ? (
        <p>No pending approvals</p>
      ) : (
        <div>
          {submissions.map(sub => (
            <div key={sub.id} className="submission-card">
              <h3>{sub.material?.name || 'Unknown Material'}</h3>
              <p>Campaign: {sub.campaign?.name}</p>
              <p>Submitted by: {sub.submitter?.full_name}</p>
              <p>Status: {sub.status}</p>
              <button onClick={() => handleApprove(sub.material_id)}>
                Approve
              </button>
              <button onClick={() => handleReject(sub.material_id, 'Requires revisions')}>
                Reject
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// EXAMPLE 4: LIAISON OFFICER - VISITS
// ============================================================================

// AFTER (Live visit logging):
const LiaisonOfficerVisitsTab = ({ userId }) => {
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadVisits()
  }, [userId])

  const loadVisits = async () => {
    try {
      setLoading(true)
      const data = await visitQueries.getMyVisits(userId)
      setVisits(data || [])
    } catch (error) {
      console.error('Failed to load visits:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogNewVisit = async (visitData) => {
    try {
      const result = await visitQueries.logVisit(visitData)
      if (result) {
        console.log('Visit logged successfully')
        await loadVisits()
      }
    } catch (error) {
      console.error('Failed to log visit:', error)
    }
  }

  const handleUpdateOutcome = async (visitId, outcome, feedback) => {
    try {
      await visitQueries.updateVisitOutcome(visitId, outcome, feedback)
      await loadVisits()
    } catch (error) {
      console.error('Failed to update visit:', error)
    }
  }

  return (
    <div>
      <h2>My Visits</h2>
      {loading ? (
        <p>Loading visits...</p>
      ) : (
        <div>
          {visits.map(visit => (
            <div key={visit.id} className="visit-card">
              <h3>{visit.hcp?.name}</h3>
              <p>Organisation: {visit.hcp?.organisation}</p>
              <p>Date: {new Date(visit.visit_date).toLocaleDateString()}</p>
              <p>Type: {visit.visit_type}</p>
              <p>Outcome: {visit.outcome || 'Not yet updated'}</p>
              <button 
                onClick={() => handleUpdateOutcome(visit.id, 'Closed', 'Visit completed')}
              >
                Mark as Closed
              </button>
            </div>
          ))}
          <button onClick={() => handleLogNewVisit({
            hcp_id: 'hcp-uuid',
            visit_date: new Date().toISOString(),
            visit_type: 'Product Introduction'
          })}>
            Log New Visit
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// EXAMPLE 5: COMPLIANCE - AUDIT LOGS
// ============================================================================

// AFTER (Live activity logs):
const AuditLogsTab = () => {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ userId: '', resourceType: '' })

  useEffect(() => {
    loadLogs()
  }, [filters])

  const loadLogs = async () => {
    try {
      setLoading(true)
      const data = await auditQueries.getActivityLogs(filters)
      setLogs(data || [])
    } catch (error) {
      console.error('Failed to load logs:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2>Activity Logs</h2>
      <div className="filters">
        <input
          type="text"
          placeholder="Filter by user"
          value={filters.userId}
          onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
        />
        <input
          type="text"
          placeholder="Filter by resource type"
          value={filters.resourceType}
          onChange={(e) => setFilters({ ...filters, resourceType: e.target.value })}
        />
      </div>

      {loading ? (
        <p>Loading logs...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Resource</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td>{new Date(log.timestamp).toLocaleString()}</td>
                <td>{log.user?.full_name || 'System'}</td>
                <td>{log.action}</td>
                <td>{log.resource_type}</td>
                <td>{log.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ============================================================================
// EXAMPLE 6: TASK MANAGEMENT
// ============================================================================

// AFTER (Live tasks with status updates):
const TasksTab = ({ userId, userRole }) => {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    try {
      setLoading(true)
      let data
      if (userRole === 'admin') {
        data = await taskQueries.getAllTasks()
      } else {
        data = await taskQueries.getMyTasks(userId)
      }
      setTasks(data || [])
    } catch (error) {
      console.error('Failed to load tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteTask = async (taskId) => {
    try {
      await taskQueries.updateTaskStatus(taskId, 'Completed')
      await loadTasks()
    } catch (error) {
      console.error('Failed to complete task:', error)
    }
  }

  const handleCreateTask = async (taskData) => {
    try {
      const result = await taskQueries.createTask(taskData)
      if (result) {
        await loadTasks()
      }
    } catch (error) {
      console.error('Failed to create task:', error)
    }
  }

  return (
    <div>
      <h2>{userRole === 'admin' ? 'All Tasks' : 'My Tasks'}</h2>
      {loading ? (
        <p>Loading tasks...</p>
      ) : (
        <div>
          {tasks.map(task => (
            <div key={task.id} className="task-card">
              <h3>{task.title}</h3>
              <p>Due: {new Date(task.due_date).toLocaleDateString()}</p>
              <p>Status: {task.status}</p>
              <p>Priority: {task.priority}</p>
              {task.status !== 'Completed' && (
                <button onClick={() => handleCompleteTask(task.id)}>
                  Mark Complete
                </button>
              )}
            </div>
          ))}
          <button onClick={() => handleCreateTask({
            title: 'New Task',
            description: 'Task description',
            assigned_to: userId,
            priority: 'Medium',
            due_date: new Date().toISOString().split('T')[0]
          })}>
            Create Task
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// STEP-BY-STEP MIGRATION CHECKLIST
// ============================================================================

/*
MIGRATION CHECKLIST - Apply to Each Component:

1. IMPORT HELPERS
   [ ] Add: import { relevantQueries } from '../services/supabaseHelpers'

2. REMOVE MOCK DATA
   [ ] Delete: const MOCK_* = [...]

3. ADD STATE
   [ ] Add: const [data, setData] = useState([])
   [ ] Add: const [loading, setLoading] = useState(true)
   [ ] Add: const [error, setError] = useState(null)

4. ADD USEEFFECT
   [ ] Create useEffect to load initial data
   [ ] Handle loading and error states

5. UPDATE RENDER
   [ ] Replace MOCK_DATA references with state
   [ ] Add conditional rendering for loading/error
   [ ] Update property names to match DB schema

6. ADD CRUD OPERATIONS
   [ ] Create: Add form submission to insert data
   [ ] Read: Populate lists from database
   [ ] Update: Add edit forms that call update queries
   [ ] Delete: Add delete buttons where appropriate

7. ADD REAL-TIME UPDATES
   [ ] Optional: Subscribe to changes using subscriptions helper
   [ ] Auto-refresh data when changes detected

8. TEST
   [ ] Verify data loads correctly
   [ ] Verify CRUD operations work
   [ ] Verify error handling works
   [ ] Verify RLS policies don't block access
   [ ] Check browser console for errors

9. OPTIMIZE
   [ ] Add pagination for large datasets
   [ ] Add debouncing for search inputs
   [ ] Add caching where appropriate
   [ ] Profile performance in React DevTools
*/

// ============================================================================
// COMMON PATTERNS & TIPS
// ============================================================================

/**
 * PATTERN 1: Loading & Error States
 */
const useDataFetch = (queryFn) => {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        const result = await queryFn()
        setData(result || [])
        setError(null)
      } catch (err) {
        setError(err.message)
        setData([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return { data, loading, error }
}

/**
 * PATTERN 2: Search with Debounce
 */
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

// Usage in component:
const [searchTerm, setSearchTerm] = useState('')
const debouncedSearch = useDebounce(searchTerm, 500)

useEffect(() => {
  if (debouncedSearch) {
    loadSearchResults(debouncedSearch)
  }
}, [debouncedSearch])

/**
 * PATTERN 3: Refetch on Action
 */
const [refetchTrigger, setRefetchTrigger] = useState(0)

const handleAction = async () => {
  await performAction()
  setRefetchTrigger(prev => prev + 1) // Triggers useEffect to reload
}

useEffect(() => {
  loadData()
}, [refetchTrigger])

/**
 * PATTERN 4: Pagination
 */
const [page, setPage] = useState(0)
const ITEMS_PER_PAGE = 10

useEffect(() => {
  const offset = page * ITEMS_PER_PAGE
  const query = supabase
    .from('items')
    .select('*')
    .range(offset, offset + ITEMS_PER_PAGE - 1)
  // Load paginated data
}, [page])

// ============================================================================
// FINAL NOTES
// ============================================================================

/*
KEY DIFFERENCES FROM MOCK DATA:

1. ASYNCHRONOUS LOADING
   - Mock: Instant data
   - Real: Need loading states while fetching

2. ID TYPES
   - Mock: Integer IDs (1, 2, 3)
   - Real: UUID or custom ID formats (CMP-001, MAT-0001)

3. FIELD NAMES
   - Mock: May vary (owner, owner_id, ownerName)
   - Real: Consistent DB schema (owner_id for foreign key)

4. RELATIONSHIPS
   - Mock: Nested objects (hcp.name)
   - Real: Often need to be selected explicitly with joins

5. TIMESTAMPS
   - Mock: Simple strings ("12 Oct 2023")
   - Real: ISO format ("2023-10-12T09:30:00Z") - need formatting

6. ERROR HANDLING
   - Mock: No errors possible
   - Real: Must handle network failures, permission errors, etc.

DEBUGGING TIPS:

- Check browser Network tab to see actual API calls
- Look at browser Console for detailed error messages
- Use Supabase Dashboard to verify data exists
- Test RLS policies by querying as different users
- Use React DevTools to inspect component state
- Check server logs in Supabase dashboard
*/

export default {}
