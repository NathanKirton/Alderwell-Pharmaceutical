// ============================================================================
// supabaseHelpers.js - Database Helper Functions
// ============================================================================
// Place this in: react-frontend/src/services/supabaseHelpers.js
// These helper functions provide consistent patterns for database operations
// ============================================================================

import { normalizeRole } from '../utils/roleUtils'
import { supabase } from './supabaseClient'

const MATERIALS_BUCKET = process.env.REACT_APP_SUPABASE_MATERIALS_BUCKET || 'materials'
const CAMPAIGN_ASSIGNABLE_ROLES = new Set(['marketing_sales', 'liaison_officer'])

const writeAuditLog = async (action, resourceType, resourceId, details = {}, explicitUserId = null) => {
  try {
    let userId = explicitUserId
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id || null
    }

    const payload = {
      action,
      resource_type: resourceType,
      resource_id: resourceId ? String(resourceId) : null,
      details,
      timestamp: new Date().toISOString(),
    }

    if (userId) {
      payload.user_id = userId
    }

    const { error } = await supabase
      .from('activity_logs')
      .insert(payload)

    if (error) {
      console.error('Activity log error:', error)
    }
  } catch (error) {
    console.error('Activity log error:', error)
  }
}

const getCurrentUserRole = async (userId) => {
  if (!userId) return 'no_role'

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Current user role lookup error:', error)
    return 'no_role'
  }

  return normalizeRole(data?.role)
}

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

const withResolvedMaterialProfiles = async (rows = []) => {
  const profileIds = [...new Set(
    rows
      .flatMap((row) => [row.uploaded_by, row.reviewed_by])
      .filter(Boolean)
  )]

  if (profileIds.length === 0) {
    return rows
  }

  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', profileIds)

  if (profilesError) {
    console.error('Profile resolution error:', profilesError)
    return rows
  }

  const profileById = new Map((profilesData || []).map((profile) => [profile.id, profile]))

  return rows.map((row) => {
    const uploaderProfile = profileById.get(row.uploaded_by)
    const reviewerProfile = profileById.get(row.reviewed_by)

    const uploader = row.uploader || uploaderProfile
    const reviewer = row.reviewer || reviewerProfile

    const uploaderFallback = row.uploaded_by ? { full_name: `User ${String(row.uploaded_by).slice(0, 8)}` } : null
    const reviewerFallback = row.reviewed_by ? { full_name: `User ${String(row.reviewed_by).slice(0, 8)}` } : null

    return {
      ...row,
      uploader: uploader || uploaderFallback,
      reviewer: reviewer || reviewerFallback,
    }
  })
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

    await writeAuditLog('campaign_created', 'campaigns', data?.[0]?.id, {
      name: data?.[0]?.name || campaignData?.name,
      status: data?.[0]?.status || campaignData?.status,
      category: data?.[0]?.category || campaignData?.category || null,
    }, user.id)

    return { data: data?.[0] || null, error: null }
  },

  // Update full campaign record
  updateCampaign: async (campaignId, updates) => {
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('campaigns')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', campaignId)
      .select()

    if (error) {
      console.error('Campaign update error:', error)
      if ((error.message || '').toLowerCase().includes('row-level security') && (error.message || '').toLowerCase().includes('campaigns')) {
        return {
          data: null,
          error: 'Campaign update blocked by RLS. Run fix-campaign-update-rls.sql in Supabase SQL Editor, then retry.',
        }
      }
      return { data: null, error: error.message || 'Failed to update campaign.' }
    }

    await writeAuditLog('campaign_updated', 'campaigns', campaignId, {
      status: updates?.status || null,
      category: updates?.category || null,
      start_date: updates?.start_date || null,
      end_date: updates?.end_date || null,
    }, user?.id || null)

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
    const enhancedQuery = await supabase
      .from('materials')
      .select('id, name, description, file_type, file_url, status, created_at, submission_date, updated_at, reviewed_at, campaign_id, folder_id, uploaded_by, reviewed_by, campaign:campaigns(id, name), folder:material_folders(id, name, campaign_id), uploader:profiles!materials_uploaded_by_fkey(full_name, email), reviewer:profiles!materials_reviewed_by_fkey(full_name, email)')
      .order('created_at', { ascending: false })

    if (!enhancedQuery.error) {
      const normalized = await withResolvedMaterialProfiles(enhancedQuery.data || [])
      return { data: normalized, error: null }
    }

    const fallbackQuery = await supabase
      .from('materials')
      .select('id, name, description, file_type, file_url, status, created_at, submission_date, updated_at, reviewed_at, campaign_id, uploaded_by, reviewed_by, campaign:campaigns(id, name), uploader:profiles!materials_uploaded_by_fkey(full_name, email), reviewer:profiles!materials_reviewed_by_fkey(full_name, email)')
      .order('created_at', { ascending: false })

    if (fallbackQuery.error) {
      console.error('Materials fetch error:', fallbackQuery.error)
      return { data: [], error: fallbackQuery.error.message || 'Failed to load materials.' }
    }

    const normalized = await withResolvedMaterialProfiles(fallbackQuery.data || [])
    return { data: normalized, error: null }
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

  // Get approvals completed by the current user
  getMyPastApprovals: async () => {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { data: [], error: 'Not authenticated.' }
    }

    const { data, error } = await supabase
      .from('materials')
      .select('id, name, status, review_notes, reviewed_at, updated_at, created_at, campaign:campaigns(name)')
      .eq('reviewed_by', user.id)
      .in('status', ['Approved', 'Rejected'])
      .order('reviewed_at', { ascending: false })

    if (error) {
      console.error('Past approvals fetch error:', error)
      return { data: [], error: error.message || 'Failed to load your past approvals.' }
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

    await writeAuditLog('material_reviewed', 'materials', materialId, {
      status,
      review_notes: notes || null,
    }, user.id)

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
        folder_id: materialData?.folder_id || null,
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

    await writeAuditLog('material_submitted', 'materials', data?.[0]?.id, {
      name: materialData?.name || null,
      campaign_id: campaignId || null,
      folder_id: materialData?.folder_id || null,
      file_type: fileExt,
    }, user.id)

    return { data, error: null }
  },

  // Get historical versions for a material
  getMaterialVersions: async (materialId) => {
    if (!materialId) {
      return { data: [], error: 'Material id is required.' }
    }

    const { data, error } = await supabase
      .from('material_versions')
      .select('id, material_id, version_number, file_url, file_type, uploaded_by, change_reason, created_at, uploader:profiles!material_versions_uploaded_by_fkey(full_name, email)')
      .eq('material_id', materialId)
      .order('version_number', { ascending: false })

    if (error) {
      console.error('Material versions fetch error:', error)
      const message = error.message || 'Failed to load material versions.'
      if (message.toLowerCase().includes('material_versions')) {
        return {
          data: [],
          error: 'material_versions table is missing. Run the new SQL patch for material version history, then retry.',
        }
      }
      return { data: [], error: message }
    }

    return { data: data || [], error: null }
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

  // Get a one-time download URL for a historical material version
  getMaterialVersionDownloadUrl: async (version) => {
    if (!version) {
      return { data: null, error: 'No material version provided.' }
    }

    if (!version.file_url) {
      return { data: null, error: 'This material version does not have a file URL.' }
    }

    const inferred = inferStorageObjectFromPublicUrl(version.file_url)
    const bucket = inferred?.bucket || MATERIALS_BUCKET
    const objectPath = inferred?.objectPath || decodeURIComponent(version.file_url.split('/').pop() || '')

    if (!objectPath) {
      return { data: null, error: 'Unable to infer storage object path for this version file.' }
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, 120)

    if (error) {
      console.error('Material version download URL error:', error)
      const message = error.message || 'Failed to generate version download URL.'
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

  // Replace an existing material file, capture version history, and stamp updater + update time
  replaceMaterialFile: async (materialId, file, changeReason = 'File replaced') => {
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

    const { data: existingMaterial, error: existingMaterialError } = await supabase
      .from('materials')
      .select('id, name, file_url, file_type, uploaded_by')
      .eq('id', materialId)
      .single()

    if (existingMaterialError) {
      console.error('Material lookup error:', existingMaterialError)
      return { data: null, error: existingMaterialError.message || 'Unable to find existing material record.' }
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

    const { data: latestVersionRow, error: latestVersionError } = await supabase
      .from('material_versions')
      .select('version_number')
      .eq('material_id', materialId)
      .order('version_number', { ascending: false })
      .limit(1)

    if (latestVersionError) {
      const message = latestVersionError.message || 'Failed to read material version history.'
      if (message.toLowerCase().includes('material_versions')) {
        return {
          data: null,
          error: 'material_versions table is missing. Run the SQL patch for version control before replacing files.',
        }
      }
      return { data: null, error: message }
    }

    const previousVersion = Array.isArray(latestVersionRow) && latestVersionRow.length > 0
      ? latestVersionRow[0].version_number
      : 0

    const { error: versionInsertError } = await supabase
      .from('material_versions')
      .insert({
        material_id: materialId,
        version_number: previousVersion + 1,
        file_url: existingMaterial.file_url,
        file_type: existingMaterial.file_type,
        uploaded_by: user.id,
        change_reason: changeReason,
        created_at: new Date().toISOString(),
      })

    if (versionInsertError) {
      console.error('Material version insert error:', versionInsertError)
      const message = versionInsertError.message || 'Failed to save material version snapshot.'
      if (message.toLowerCase().includes('row-level security')) {
        return {
          data: null,
          error: 'File replace failed because material_versions RLS blocked the version snapshot insert. Run fix-material-file-replacement-rls.sql in Supabase SQL Editor, then retry.',
        }
      }
      return { data: null, error: message }
    }

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
      const message = error.message || 'Failed to update material after upload.'
      if (message.toLowerCase().includes('row-level security')) {
        return {
          data: null,
          error: 'File replace failed because materials RLS blocked the update. Run fix-material-file-replacement-rls.sql in Supabase SQL Editor, then retry.',
        }
      }
      return { data: null, error: message }
    }

    await writeAuditLog('material_file_replaced', 'materials', materialId, {
      previous_file_url: existingMaterial.file_url,
      new_file_url: urlData.publicUrl,
      previous_file_type: existingMaterial.file_type,
      new_file_type: fileExt,
      version_number: previousVersion + 1,
      change_reason: changeReason,
    }, user.id)

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

  // Update HCP contact
  updateHCP: async (hcpId, updates) => {
    if (!hcpId) {
      return { data: null, error: 'HCP id is required.' }
    }

    const { data, error } = await supabase
      .from('hcp_contacts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', hcpId)
      .select()

    if (error) {
      console.error('HCP update error:', error)
      return { data: null, error: error.message || 'Failed to update HCP.' }
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
        hcp_id: hcpId,
        initiated_by: user.id,
        interaction_type: interactionData?.interaction_type || 'Other',
        campaign_id: interactionData?.campaign_id || null,
        notes: interactionData?.notes || null,
        product_mentioned: interactionData?.product_mentioned || null,
        outcome: interactionData?.outcome || null,
        follow_up_required: Boolean(interactionData?.follow_up_required),
        follow_up_date: interactionData?.follow_up_date || null,
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

    if (!user) {
      return null
    }

    const { data, error } = await supabase
      .from('visits')
      .insert({
        ...visitData,
        liaison_officer_id: user.id
      })
      .select()

    if (error) {
      console.error('Visit log error:', error)
      return null
    }

    await writeAuditLog('visit_logged', 'visits', data?.[0]?.id, {
      visit_date: visitData?.visit_date || null,
      visit_type: visitData?.visit_type || null,
      outcome: visitData?.outcome || null,
    }, user.id)

    return data
  },

  // Get all visits (admin)
  getAllVisits: async () => {
    const { data, error } = await supabase
      .from('visits')
      .select('*, hcp:hcp_contacts(name, organisation), officer:profiles!visits_liaison_officer_id_fkey(full_name, email, avatar_url)')
      .order('visit_date', { ascending: false })

    if (error) console.error('All visits fetch error:', error)
    return data || []
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
      .select('*, assignee:profiles!tasks_assigned_to_fkey(full_name, email, avatar_url), creator:profiles!tasks_created_by_fkey(full_name, email, avatar_url)')
      .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
      .neq('status', 'Cancelled')
      .order('due_date', { ascending: true })

    if (error) {
      console.error('Current user tasks fetch error:', error)
      return { data: [], error: error.message || 'Failed to load tasks.' }
    }

    return { data: data || [], error: null }
  },

  // Get tasks created/assigned by me (for Campaign Manager tracker)
  getTasksAssignedByMe: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: [], error: 'Not authenticated.' }
    }

    const { data, error } = await supabase
      .from('tasks')
      .select('*, assignee:profiles!tasks_assigned_to_fkey(full_name, email, avatar_url)')
      .eq('created_by', user.id)
      .neq('status', 'Cancelled')
      .order('due_date', { ascending: true })

    if (error) {
      console.error('Tasks assigned by me fetch error:', error)
      return { data: [], error: error.message || 'Failed to load tasks.' }
    }

    return { data: data || [], error: null }
  },

  // Get my tasks
  getMyTasks: async (userId) => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, assigned_by:created_by(full_name, email, avatar_url), campaign:campaigns(name)')
      .eq('assigned_to', userId)
      .neq('status', 'Cancelled')
      .order('due_date', { ascending: true })

    if (error) console.error('Tasks fetch error:', error)
    return data
  },

  // Get all tasks (admin)
  getAllTasks: async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, assigned_to:profiles!tasks_assigned_to_fkey(full_name, email, avatar_url), created_by:profiles!tasks_created_by_fkey(full_name, email, avatar_url)')
      .neq('status', 'Cancelled')
      .order('due_date', { ascending: true })

    if (error) console.error('Tasks fetch error:', error)
    return data
  },

  // Get users who can receive campaign tasks
  getAssignableUsers: async () => {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { data: [], error: 'Not authenticated.' }
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, avatar_url')
      .order('full_name', { ascending: true })

    if (error) {
      console.error('Assignable users fetch error:', error)
      return { data: [], error: error.message || 'Failed to load assignable users.' }
    }

    const normalizedProfiles = (data || []).map((profile) => ({
      ...profile,
      role: normalizeRole(profile.role),
    }))

    return { data: normalizedProfiles, error: null }
  },

  // Create task
  createTask: async (taskData) => {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { data: null, error: 'Not authenticated.' }
    }

    const creatorRole = await getCurrentUserRole(user.id)
    const assignedTo = taskData.assigned_to || user.id

    if ((creatorRole === 'campaign_management' || creatorRole === 'admin') && assignedTo !== user.id) {
      const { data: assigneeProfile, error: assigneeError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', assignedTo)
        .single()

      if (assigneeError) {
        console.error('Task assignee role lookup error:', assigneeError)
        return { data: null, error: 'Unable to validate assignee role.' }
      }

      const assigneeRole = normalizeRole(assigneeProfile?.role)
      if (!CAMPAIGN_ASSIGNABLE_ROLES.has(assigneeRole)) {
        return {
          data: null,
          error: 'Campaign managers can assign tasks only to Sales & Marketing or Liaison Officers.',
        }
      }
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        ...taskData,
        assigned_to: assignedTo,
        created_by: user.id,
        created_at: new Date().toISOString()
      })
      .select()

    if (error) {
      console.error('Task creation error:', error)
      return { data: null, error: error.message || 'Failed to create task.' }
    }

    await writeAuditLog('task_created', 'tasks', data?.[0]?.id, {
      title: taskData?.title || null,
      assigned_to: taskData?.assigned_to || null,
      related_campaign_id: taskData?.related_campaign_id || null,
      due_date: taskData?.due_date || null,
      priority: taskData?.priority || null,
    }, user.id)

    return { data: data?.[0] || null, error: null }
  },

  // Update task status
  updateTaskStatus: async (taskId, status) => {
    const { data: { user } } = await supabase.auth.getUser()

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

    if (!data || data.length === 0) {
      return { data: null, error: 'Task not found or you do not have permission to update it.' }
    }

    await writeAuditLog('task_status_updated', 'tasks', taskId, {
      status,
      completion_date: updateData.completion_date || null,
    }, user?.id || null)

    return { data: data?.[0] || null, error: null }
  },

  deleteTask: async (taskId) => {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { data: null, error: 'Not authenticated.', mode: null }
    }

    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)

    if (!deleteError) {
      await writeAuditLog('task_deleted', 'tasks', taskId, { mode: 'hard_delete' }, user.id)
      return { data: { id: taskId }, error: null, mode: 'hard_delete' }
    }

    const { data: cancelledTask, error: cancelError } = await supabase
      .from('tasks')
      .update({
        status: 'Cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .maybeSingle()

    if (cancelError) {
      console.error('Task delete fallback error:', cancelError)
      return {
        data: null,
        error: cancelError.message || deleteError.message || 'Failed to remove task.',
        mode: null,
      }
    }

    await writeAuditLog('task_deleted', 'tasks', taskId, {
      mode: 'soft_delete',
      original_error: deleteError.message || null,
    }, user.id)

    return { data: cancelledTask, error: null, mode: 'soft_delete' }
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
      .select('*, user:user_id(full_name, email, avatar_url)')

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
    await writeAuditLog(action, resourceType, resourceId, details)
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
      .select('*, material:materials(id, name, status, campaign:campaigns(name)), flagged_by:profiles!compliance_flags_flagged_by_fkey(full_name), reviewer:profiles!compliance_flags_reviewer_id_fkey(full_name)')

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

    if (!user) {
      return { data: null, error: 'Not authenticated.' }
    }

    const { data, error } = await supabase
      .from('compliance_flags')
      .insert({
        ...flagData,
        flagged_by: user.id,
        created_at: new Date().toISOString()
      })
      .select()

    if (error) {
      console.error('Flag creation error:', error)
      if ((error.message || '').toLowerCase().includes('row-level security') && (error.message || '').toLowerCase().includes('compliance_flags')) {
        return {
          data: null,
          error: 'Failed to create compliance flag due to RLS policy. Run fix-compliance-flags-and-material-folders.sql in Supabase SQL Editor, then retry.',
        }
      }
      return { data: null, error: error.message || 'Failed to create compliance flag.' }
    }

    await writeAuditLog('compliance_flag_created', 'compliance_flags', data?.[0]?.id, {
      material_id: flagData?.material_id || null,
      severity: flagData?.severity || null,
      status: flagData?.status || null,
    }, user.id)

    return { data: data?.[0] || null, error: null }
  },

  // Resolve flag
  resolveFlag: async (flagId, status, notes) => {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { data: null, error: 'Not authenticated.' }
    }

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

    if (error) {
      console.error('Flag update error:', error)
      return { data: null, error: error.message || 'Failed to update flag status.' }
    }

    if (!data?.length) {
      return { data: null, error: 'Flag update did not apply. Check permissions or flag id.' }
    }

    await writeAuditLog('compliance_flag_updated', 'compliance_flags', flagId, {
      status,
      notes: notes || null,
    }, user.id)

    return { data: data[0], error: null }
  }
}

export const folderQueries = {
  getFolders: async () => {
    const { data, error } = await supabase
      .from('material_folders')
      .select('id, name, campaign_id, created_at, campaign:campaigns(id, name)')
      .order('name', { ascending: true })

    if (error) {
      console.error('Folder fetch error:', error)
      return { data: [], error: error.message || 'Failed to load folders.' }
    }

    return { data: data || [], error: null }
  },

  createFolder: async ({ name, campaignId = null }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: 'Not authenticated.' }
    }

    const { data, error } = await supabase
      .from('material_folders')
      .insert({
        name,
        campaign_id: campaignId,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id, name, campaign_id')

    if (error) {
      console.error('Folder creation error:', error)
      return { data: null, error: error.message || 'Failed to create folder.' }
    }

    return { data: data?.[0] || null, error: null }
  },
}

materialQueries.assignMaterialToCampaign = async (materialId, campaignId, folderId = null) => {
  const { data, error } = await supabase
    .from('materials')
    .update({
      campaign_id: campaignId,
      folder_id: folderId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', materialId)
    .select('id, name, campaign_id, folder_id')

  if (error) {
    console.error('Assign material to campaign error:', error)
    return { data: null, error: error.message || 'Failed to assign material to campaign.' }
  }

  return { data: data?.[0] || null, error: null }
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
  folderQueries,
  hcpQueries,
  visitQueries,
  taskQueries,
  auditQueries,
  complianceQueries,
  settingsQueries,
  subscriptions
}

export default supabaseHelpers
