// ============================================================================
// supabaseHelpers.js - Database Helper Functions
// ============================================================================
// Place this in: react-frontend/src/services/supabaseHelpers.js
// These helper functions provide consistent patterns for database operations
// ============================================================================

import { supabase } from './supabaseClient'

const MATERIALS_BUCKET = process.env.REACT_APP_SUPABASE_MATERIALS_BUCKET || 'materials'

const inferStorageObjectFromPublicUrl = (fileUrl) => {
  try {
    const parsedUrl = new URL(fileUrl)
    const publicPrefix = '/storage/v1/object/public/'
    const signPrefix = '/storage/v1/object/sign/'

    let remainder = null
    if (parsedUrl.pathname.includes(publicPrefix)) {
      remainder = parsedUrl.pathname.split(publicPrefix)[1]
    } else if (parsedUrl.pathname.includes(signPrefix)) {
      remainder = parsedUrl.pathname.split(signPrefix)[1]
    }

    if (!remainder) {
      return null
    }

    const [bucket, ...pathParts] = remainder.split('/')
    const objectPath = pathParts.join('/')
    if (!bucket || !objectPath) {
      return null
    }

    return { bucket, objectPath: decodeURIComponent(objectPath) }
  } catch (error) {
    return null
  }
}

// ============================================================================
// PROFILES
// ============================================================================
export const profileQueries = {
  // Get current user's profile
  getCurrentProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) console.error('Profile fetch error:', error)
    return data
  },

  // Get all users (admin only)
  getAllUsers: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .order('email', { ascending: true })

    if (error) console.error('User list error:', error)
    return data
  },

  // Update user role (admin only)
  updateUserRole: async (userId, newRole) => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()

    if (error) console.error('Role update error:', error)
    return data
  },

  // Update profile
  updateProfile: async (userId, updates) => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()

    if (error) console.error('Profile update error:', error)
    return data
  }
}

// ============================================================================
// CAMPAIGNS
// ============================================================================
export const campaignQueries = {
  // Get all campaigns
  getAllCampaigns: async () => {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*, owner:profiles(full_name)')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Campaign fetch error:', error)
      return { data: [], error: error.message || 'Failed to fetch campaigns.' }
    }
    return { data: data || [], error: null }
  },

  // Get single campaign
  getCampaignById: async (campaignId) => {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*, owner:profiles(full_name, email)')
      .eq('id', campaignId)
      .single()

    if (error) console.error('Campaign fetch error:', error)
    return data
  },

  // Create campaign
  createCampaign: async (campaignData) => {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { data: null, error: 'Not authenticated.' }
    }

    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        ...campaignData,
        owner_id: user.id,
        created_at: new Date().toISOString()
      })
      .select()

    if (error) {
      console.error('Campaign creation error:', error)
      return { data: null, error: error.message || 'Failed to create campaign.' }
    }

    return { data: data?.[0] || null, error: null }
  },

  // Update full campaign record
  updateCampaign: async (campaignId, updates) => {
    const { data, error } = await supabase
      .from('campaigns')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', campaignId)
      .select()

    if (error) {
      console.error('Campaign update error:', error)
      return { data: null, error: error.message || 'Failed to update campaign.' }
    }

    return { data: data?.[0] || null, error: null }
  },

  // Update campaign status
  updateCampaignStatus: async (campaignId, status) => {
    const { data, error } = await supabase
      .from('campaigns')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', campaignId)
      .select()

    if (error) {
      console.error('Campaign status update error:', error)
      return { data: null, error: error.message || 'Failed to update campaign status.' }
    }

    return { data: data?.[0] || null, error: null }
  },

  // Get campaigns by status
  getCampaignsByStatus: async (status) => {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) console.error('Campaign fetch error:', error)
    return data
  }
}

// ============================================================================
// MATERIALS & APPROVALS
// ============================================================================
export const materialQueries = {
  // Get all materials
  getAllMaterials: async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('id, name, description, file_type, file_url, status, created_at, updated_at, reviewed_at, campaign:campaigns(name), uploader:profiles!materials_uploaded_by_fkey(full_name, email), reviewer:profiles!materials_reviewed_by_fkey(full_name, email)')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Materials fetch error:', error)
      return { data: [], error: error.message || 'Failed to load materials.' }
    }

    return { data: data || [], error: null }
  },

  // Get all materials for a campaign
  getMaterialsByCampaign: async (campaignId) => {
    const { data, error } = await supabase
      .from('materials')
      .select('*, uploaded_by:profiles!materials_uploaded_by_fkey(full_name), reviewed_by:profiles!materials_reviewed_by_fkey(full_name)')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })

    if (error) console.error('Material fetch error:', error)
    return data
  },

  // Get pending approvals
  getPendingApprovals: async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('*, campaign:campaigns(name), uploaded_by:profiles!materials_uploaded_by_fkey(full_name)')
      .eq('status', 'Submitted')
      .order('submission_date', { ascending: true })

    if (error) {
      console.error('Pending approvals error:', error)
      return { data: [], error: error.message || 'Failed to load pending approvals.' }
    }

    return { data: data || [], error: null }
  },

  // Approve or reject material
  reviewMaterial: async (materialId, status, notes) => {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { data: null, error: 'Not authenticated.' }
    }

    const { data, error } = await supabase
      .from('materials')
      .update({
        status,
        review_notes: notes,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', materialId)
      .select()

    if (error) {
      console.error('Material review error:', error)
      const rawMessage = error.message || 'Failed to review material.'
      if (
        rawMessage.toLowerCase().includes('activity_logs') &&
        rawMessage.toLowerCase().includes('row-level security')
      ) {
        return {
          data: null,
          error:
            'Material update reached audit logging, but activity_logs RLS blocked the insert. Run fix-activity-logs-rls.sql in Supabase SQL Editor, then retry.',
        }
      }
      return { data: null, error: error.message || 'Failed to review material.' }
    }

    return { data: data?.[0] || null, error: null }
  },

  // Upload material
  submitMaterial: async (campaignId, materialData, file) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: 'Not authenticated.' }
    }

    // Upload file to storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    const { error: uploadError } = await supabase.storage
      .from(MATERIALS_BUCKET)
      .upload(fileName, file)

    if (uploadError) {
      console.error('File upload error:', uploadError)
      if ((uploadError.message || '').toLowerCase().includes('bucket not found')) {
        return {
          data: null,
          error: `Storage bucket "${MATERIALS_BUCKET}" was not found. Create that bucket in Supabase or set REACT_APP_SUPABASE_MATERIALS_BUCKET to your existing bucket name.`,
        }
      }
      return { data: null, error: uploadError.message || 'Upload failed.' }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(MATERIALS_BUCKET)
      .getPublicUrl(fileName)

    // Create material record
    const { data, error } = await supabase
      .from('materials')
      .insert({
        campaign_id: campaignId,
        ...materialData,
        file_type: fileExt,
        file_url: urlData.publicUrl,
        uploaded_by: user.id,
        status: 'Submitted',
        submission_date: new Date().toISOString()
      })
      .select()

    if (error) {
      console.error('Material creation error:', error)
      return { data: null, error: error.message || 'Material record creation failed.' }
    }

    return { data, error: null }
  },

  // Get a one-time download URL for approved materials only
  getApprovedMaterialDownloadUrl: async (material) => {
    if (!material) {
      return { data: null, error: 'No material provided.' }
    }

    const status = (material.status || '').toLowerCase()
    if (status !== 'approved') {
      return { data: null, error: 'This file is not downloadable until a reviewer marks it Approved.' }
    }

    if (!material.file_url) {
      return { data: null, error: 'This material does not have a file URL yet.' }
    }

    const inferred = inferStorageObjectFromPublicUrl(material.file_url)
    const bucket = inferred?.bucket || MATERIALS_BUCKET
    const objectPath = inferred?.objectPath || decodeURIComponent(material.file_url.split('/').pop() || '')

    if (!objectPath) {
      return { data: null, error: 'Unable to infer storage object path for this file.' }
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, 120)

    if (error) {
      console.error('Material download URL error:', error)
      const message = error.message || 'Failed to generate download URL.'
      if (message.toLowerCase().includes('bucket not found')) {
        return {
          data: null,
          error: `Storage bucket "${bucket}" was not found. Create it in Supabase or update REACT_APP_SUPABASE_MATERIALS_BUCKET.`,
        }
      }
      return { data: null, error: message }
    }

    return { data: { url: data.signedUrl }, error: null }
  },

  // Replace an existing material file and stamp updater + update time
  replaceMaterialFile: async (materialId, file) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: 'Not authenticated.' }
    }

    if (!materialId) {
      return { data: null, error: 'Material id is required.' }
    }

    if (!file) {
      return { data: null, error: 'No file selected.' }
    }

    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from(MATERIALS_BUCKET)
      .upload(fileName, file)

    if (uploadError) {
      console.error('Material replacement upload error:', uploadError)
      if ((uploadError.message || '').toLowerCase().includes('bucket not found')) {
        return {
          data: null,
          error: `Storage bucket "${MATERIALS_BUCKET}" was not found. Create that bucket in Supabase or set REACT_APP_SUPABASE_MATERIALS_BUCKET to your existing bucket name.`,
        }
      }
      return { data: null, error: uploadError.message || 'Failed to upload replacement file.' }
    }

    const { data: urlData } = supabase.storage
      .from(MATERIALS_BUCKET)
      .getPublicUrl(fileName)

    const updatePayload = {
      file_url: urlData.publicUrl,
      file_type: fileExt,
      uploaded_by: user.id,
      updated_at: new Date().toISOString(),
      submission_date: new Date().toISOString(),
      status: 'Submitted',
      reviewed_by: null,
      reviewed_at: null,
      review_notes: null,
    }

    const { data, error } = await supabase
      .from('materials')
      .update(updatePayload)
      .eq('id', materialId)
      .select('id, name, updated_at, status, uploader:profiles!materials_uploaded_by_fkey(full_name, email)')

    if (error) {
      console.error('Material replacement update error:', error)
      return { data: null, error: error.message || 'Failed to update material after upload.' }
    }

    return { data: data?.[0] || null, error: null }
  }
}

// ============================================================================
// HCP CONTACTS & INTERACTIONS
// ============================================================================
export const hcpQueries = {
  // Get all HCP contacts
  getAllHCPs: async (filters = {}) => {
    let query = supabase
      .from('hcp_contacts')
      .select('*')
      .eq('active', true)

    if (filters.specialism) {
      query = query.eq('specialism', filters.specialism)
    }
    if (filters.organisation) {
      query = query.ilike('organisation', `%${filters.organisation}%`)
    }

    const { data, error } = await query.order('name', { ascending: true })

    if (error) {
      console.error('HCP fetch error:', error)
      return { data: [], error: error.message || 'Failed to load HCP contacts.' }
    }

    return { data: data || [], error: null }
  },

  // Search HCPs
  searchHCPs: async (searchTerm) => {
    const { data, error } = await supabase
      .from('hcp_contacts')
      .select('*')
      .or(`name.ilike.%${searchTerm}%,organisation.ilike.%${searchTerm}%,specialism.ilike.%${searchTerm}%`)
      .eq('active', true)

    if (error) {
      console.error('HCP search error:', error)
      return { data: [], error: error.message || 'Failed to search HCP contacts.' }
    }

    return { data: data || [], error: null }
  },

  // Create HCP contact
  createHCP: async (hcpData) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: 'Not authenticated.' }
    }

    const { data, error } = await supabase
      .from('hcp_contacts')
      .insert({
        ...hcpData,
        created_by: user.id,
        created_at: new Date().toISOString(),
      })
      .select()

    if (error) {
      console.error('HCP creation error:', error)
      return { data: null, error: error.message || 'Failed to create HCP.' }
    }

    return { data: data?.[0] || null, error: null }
  },

  // Log interaction
  logInteraction: async (hcpId, interactionData) => {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { data: null, error: 'Not authenticated.' }
    }

    const { data, error } = await supabase
      .from('interactions')
      .insert({
        ...interactionData,
        hcp_id: hcpId,
        initiated_by: user.id,
        interaction_date: new Date().toISOString()
      })
      .select()

    if (error) {
      console.error('Interaction log error:', error)
      return { data: null, error: error.message || 'Failed to log interaction.' }
    }

    return { data: data?.[0] || null, error: null }
  },

  // Get interaction history for HCP
  getInteractionHistory: async (hcpId) => {
    const { data, error } = await supabase
      .from('interactions')
      .select('*, initiated_by:profiles(full_name)')
      .eq('hcp_id', hcpId)
      .order('interaction_date', { ascending: false })

    if (error) console.error('Interaction history error:', error)
    return data
  }
}

// ============================================================================
// VISITS (Liaison Officer)
// ============================================================================
export const visitQueries = {
  // Get visits for liaison officer
  getMyVisits: async (userId, filters = {}) => {
    let resolvedUserId = userId
    if (!resolvedUserId) {
      const { data: { user } } = await supabase.auth.getUser()
      resolvedUserId = user?.id
    }

    if (!resolvedUserId) {
      return []
    }

    let query = supabase
      .from('visits')
      .select('*, hcp:hcp_contacts(name, organisation)')
      .eq('liaison_officer_id', resolvedUserId)

    if (filters.status) {
      query = query.eq('outcome', filters.status)
    }

    const { data, error } = await query
      .order('visit_date', { ascending: false })

    if (error) console.error('Visits fetch error:', error)
    return data
  },

  // Log visit
  logVisit: async (visitData) => {
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('visits')
      .insert({
        ...visitData,
        liaison_officer_id: user.id
      })
      .select()

    if (error) console.error('Visit log error:', error)
    return data
  },

  // Update visit outcome
  updateVisitOutcome: async (visitId, outcome, feedback) => {
    const { data, error } = await supabase
      .from('visits')
      .update({
        outcome,
        hcp_feedback: feedback,
        updated_at: new Date().toISOString()
      })
      .eq('id', visitId)
      .select()

    if (error) console.error('Visit update error:', error)
    return data
  }
}

// ============================================================================
// TASKS
// ============================================================================
export const taskQueries = {
  // Get current user tasks
  getCurrentUserTasks: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: [], error: 'Not authenticated.' }
    }

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
      .neq('status', 'Cancelled')
      .order('due_date', { ascending: true })

    if (error) {
      console.error('Current user tasks fetch error:', error)
      return { data: [], error: error.message || 'Failed to load tasks.' }
    }

    return { data: data || [], error: null }
  },

  // Get my tasks
  getMyTasks: async (userId) => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, assigned_by:created_by(full_name), campaign:campaigns(name)')
      .eq('assigned_to', userId)
      .order('due_date', { ascending: true })

    if (error) console.error('Tasks fetch error:', error)
    return data
  },

  // Get all tasks (admin)
  getAllTasks: async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, assigned_to:profiles!tasks_assigned_to_fkey(full_name), created_by:profiles!tasks_created_by_fkey(full_name)')
      .order('due_date', { ascending: true })

    if (error) console.error('Tasks fetch error:', error)
    return data
  },

  // Create task
  createTask: async (taskData) => {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { data: null, error: 'Not authenticated.' }
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        ...taskData,
        created_by: user.id,
        created_at: new Date().toISOString()
      })
      .select()

    if (error) {
      console.error('Task creation error:', error)
      return { data: null, error: error.message || 'Failed to create task.' }
    }

    return { data: data?.[0] || null, error: null }
  },

  // Update task status
  updateTaskStatus: async (taskId, status) => {
    const updateData = {
      status,
      updated_at: new Date().toISOString()
    }

    if (status === 'Completed') {
      updateData.completion_date = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .select()

    if (error) {
      console.error('Task update error:', error)
      return { data: null, error: error.message || 'Failed to update task status.' }
    }

    return { data: data?.[0] || null, error: null }
  }
}

// ============================================================================
// ACTIVITY LOGS
// ============================================================================
export const auditQueries = {
  // Get activity logs (compliance/admin)
  getActivityLogs: async (filters = {}) => {
    let query = supabase
      .from('activity_logs')
      .select('*, user:user_id(full_name, email)')

    if (filters.userId) {
      query = query.eq('user_id', filters.userId)
    }
    if (filters.resourceType) {
      query = query.eq('resource_type', filters.resourceType)
    }

    const { data, error } = await query
      .order('timestamp', { ascending: false })
      .limit(100)

    if (error) console.error('Activity logs error:', error)
    return data
  },

  // Log custom activity
  logActivity: async (action, resourceType, resourceId, details = {}) => {
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details,
        timestamp: new Date().toISOString()
      })

    if (error) console.error('Activity log error:', error)
  }
}

// ============================================================================
// COMPLIANCE FLAGS
// ============================================================================
export const complianceQueries = {
  // Get all flags
  getFlags: async (filters = {}) => {
    let query = supabase
      .from('compliance_flags')
      .select('*, flagged_by:profiles!compliance_flags_flagged_by_fkey(full_name), reviewer:profiles!compliance_flags_reviewer_id_fkey(full_name)')

    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.severity) {
      query = query.eq('severity', filters.severity)
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })

    if (error) console.error('Flags fetch error:', error)
    return data
  },

  // Create flag
  createFlag: async (flagData) => {
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('compliance_flags')
      .insert({
        ...flagData,
        flagged_by: user.id,
        created_at: new Date().toISOString()
      })
      .select()

    if (error) console.error('Flag creation error:', error)
    return data
  },

  // Resolve flag
  resolveFlag: async (flagId, status, notes) => {
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('compliance_flags')
      .update({
        status,
        resolution_notes: notes,
        reviewer_id: user.id,
        resolved_at: new Date().toISOString()
      })
      .eq('id', flagId)
      .select()

    if (error) console.error('Flag update error:', error)
    return data
  }
}

// ============================================================================
// SYSTEM SETTINGS
// ============================================================================
export const settingsQueries = {
  // Get setting
  getSetting: async (key) => {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .single()

    if (error) console.error('Settings fetch error:', error)
    return data?.setting_value
  },

  // Update setting (admin only)
  updateSetting: async (key, value) => {
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('system_settings')
      .update({
        setting_value: value,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('setting_key', key)
      .select()

    if (error) console.error('Settings update error:', error)
    return data
  }
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================
export const subscriptions = {
  // Subscribe to material approvals
  watchMaterialApprovals: (campaignId, callback) => {
    return supabase
      .channel(`materials:campaign_id=eq.${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'materials',
          filter: `campaign_id=eq.${campaignId}`
        },
        callback
      )
      .subscribe()
  },

  // Subscribe to activity logs
  watchActivityLogs: (callback) => {
    return supabase
      .channel('activity_logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs'
        },
        callback
      )
      .subscribe()
  }
}

const supabaseHelpers = {
  profileQueries,
  campaignQueries,
  materialQueries,
  hcpQueries,
  visitQueries,
  taskQueries,
  auditQueries,
  complianceQueries,
  settingsQueries,
  subscriptions
}

export default supabaseHelpers
