import React, { useMemo, useState } from 'react'
import campaignStyles from '../CampaignManagement.module.css'
import styles from './MaterialsLibrary.module.css'
import { FlagIcon, PlusIcon } from '../../Icons/IconSet'

const MATERIAL_TYPE_TABS = [
  { id: 'all', label: 'All Assets' },
  { id: 'pdf', label: 'PDFs' },
  { id: 'video', label: 'Videos' },
  { id: 'image', label: 'Images' },
  { id: 'ppt', label: 'Presentations' },
  { id: 'other', label: 'Other' },
]

const getStatusToneClass = (status) => {
  const normalizedStatus = String(status || '').trim().toLowerCase()

  if (normalizedStatus === 'approved') return styles.statusApproved
  if (normalizedStatus === 'rejected') return styles.statusRejected
  if (normalizedStatus.includes('submitted') || normalizedStatus.includes('pending') || normalizedStatus === 'under review') {
    return styles.statusPending
  }

  return styles.statusDefault
}

export default function MaterialsLibrary({
  tabClassName,
  actionMessage,
  actionMessageClassName,
  uploadInputRef,
  replaceInputRef,
  onUploadChange,
  onReplaceChange,
  onUploadClick,
  uploadButtonLabel = 'Upload Material',
  isUploading = false,
  materials = [],
  visibleMaterials = [],
  loading = false,
  materialSearch,
  onMaterialSearchChange,
  materialCampaignFilter,
  onMaterialCampaignFilterChange,
  campaignNames = [],
  materialFolderFilter,
  onMaterialFolderFilterChange,
  visibleFolders = [],
  materialTypeFilter,
  onMaterialTypeFilterChange,
  getFileIcon,
  flaggedMaterialIds,
  onFlagMaterial,
  getMaterialEditorName,
  onOpenDetails,
  onReplaceMaterial,
  isReplacingMaterial = false,
  replacingMaterialId = null,
  onDownloadMaterial,
  canUploadMaterials = true,
  canManageFolders = true,
  canReplaceMaterials = true,
  loadingText = 'Loading materials...',
  emptyTitle = 'No materials found',
  emptyDescription = 'Try adjusting your filters or upload a new asset.',
  folderManager,
  uploadManager,
}) {
  const [showUploadPanel, setShowUploadPanel] = useState(false)
  const [showFolderPanel, setShowFolderPanel] = useState(false)

  const approvedCount = useMemo(
    () => materials.filter((material) => String(material.status || '').trim().toLowerCase() === 'approved').length,
    [materials]
  )

  const flaggedCount = useMemo(() => {
    if (!(flaggedMaterialIds instanceof Set)) return 0
    return materials.filter((material) => flaggedMaterialIds.has(material.id)).length
  }, [materials, flaggedMaterialIds])

  const filteredCount = visibleMaterials.length
  const totalCount = materials.length
  const readyPercent = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0
  const filteredPercent = totalCount > 0 ? Math.round((filteredCount / totalCount) * 100) : 0
  const flaggedPercent = totalCount > 0 ? Math.round((flaggedCount / totalCount) * 100) : 0
  const messageClassName = actionMessageClassName || campaignStyles.rowMeta
  const hasManagedUpload = Boolean(uploadManager?.enabled) && canUploadMaterials
  const hasFolderManager = Boolean(folderManager?.enabled) && canManageFolders
  const uploadFolders = useMemo(() => {
    if (!hasManagedUpload) return []

    return (uploadManager.folders || []).filter((folder) => {
      const selectedCampaignId = uploadManager.form?.campaignId || ''
      return !selectedCampaignId || !folder.campaign_id || folder.campaign_id === selectedCampaignId
    })
  }, [hasManagedUpload, uploadManager])

  const handleManagedUploadButtonClick = () => {
    setShowUploadPanel((prev) => !prev)
    if (showFolderPanel) setShowFolderPanel(false)
  }

  const handleFolderButtonClick = () => {
    setShowFolderPanel((prev) => !prev)
    if (showUploadPanel) setShowUploadPanel(false)
  }

  return (
    <div className={tabClassName || campaignStyles.tabContent}>
      {actionMessage && <p className={messageClassName}>{actionMessage}</p>}

      {!hasManagedUpload && uploadInputRef && onUploadChange && (
        <input ref={uploadInputRef} type="file" hidden onChange={onUploadChange} />
      )}
      {replaceInputRef && onReplaceChange && (
        <input ref={replaceInputRef} type="file" hidden onChange={onReplaceChange} />
      )}

      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div className={styles.heroCopy}>
            <h1>Materials Library</h1>
            <p>Browse approved assets, inspect flagged items, and keep campaign files organised from a single consistent workspace.</p>
          </div>
          <div className={styles.heroActions}>
            {hasFolderManager && (
              <button type="button" className={campaignStyles.secondaryBtn} onClick={handleFolderButtonClick}>
                {showFolderPanel ? 'Hide Folder Form' : 'Create Folder'}
              </button>
            )}
            {hasManagedUpload ? (
              <button
                type="button"
                className={campaignStyles.primaryBtn}
                onClick={handleManagedUploadButtonClick}
                disabled={isUploading}
              >
                <PlusIcon size={16} /> {showUploadPanel ? 'Hide Upload Form' : uploadButtonLabel}
              </button>
            ) : onUploadClick && (
              <button
                type="button"
                className={campaignStyles.primaryBtn}
                onClick={onUploadClick}
                disabled={isUploading}
              >
                <PlusIcon size={16} /> {isUploading ? 'Uploading...' : uploadButtonLabel}
              </button>
            )}
          </div>
        </div>

        {(showUploadPanel || showFolderPanel) && (
          <div className={styles.quickActionsGrid}>
            {showUploadPanel && hasManagedUpload && (
              <section className={styles.quickActionPanel}>
                <div className={styles.quickActionHeader}>
                  <div>
                    <h3>Upload Material</h3>
                    <p>Choose a file, name it properly, and assign it to a campaign or folder before upload.</p>
                  </div>
                  <span className={campaignStyles.rowMeta}>{uploadManager.fileName || 'No file selected yet'}</span>
                </div>

                <div className={styles.quickFormGrid}>
                  <div className={campaignStyles.formField}>
                    <label className={campaignStyles.formLabel}>Material Name</label>
                    <input
                      className={campaignStyles.formInput}
                      value={uploadManager.form?.name || ''}
                      onChange={(event) => uploadManager.onNameChange(event.target.value)}
                      placeholder="Name for this material..."
                    />
                  </div>

                  <div className={campaignStyles.formField}>
                    <label className={campaignStyles.formLabel}>Campaign</label>
                    <select
                      className={campaignStyles.formInput}
                      value={uploadManager.form?.campaignId || ''}
                      onChange={(event) => uploadManager.onCampaignChange(event.target.value)}
                    >
                      <option value="">No campaign / shared</option>
                      {(uploadManager.campaigns || []).map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className={campaignStyles.formField}>
                    <label className={campaignStyles.formLabel}>Folder</label>
                    <select
                      className={campaignStyles.formInput}
                      value={uploadManager.form?.folderId || ''}
                      onChange={(event) => uploadManager.onFolderChange(event.target.value)}
                    >
                      <option value="">No folder</option>
                      {uploadFolders.map((folder) => (
                        <option key={folder.id} value={folder.id}>{folder.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className={campaignStyles.formField}>
                    <label className={campaignStyles.formLabel}>File</label>
                    <input className={campaignStyles.formInput} type="file" onChange={uploadManager.onFileChange} />
                  </div>
                </div>

                <div className={styles.quickActionFooter}>
                  <button type="button" className={campaignStyles.secondaryBtn} onClick={() => {
                    uploadManager.onReset()
                    setShowUploadPanel(false)
                  }}>
                    Cancel
                  </button>
                  <button type="button" className={campaignStyles.primaryBtn} onClick={uploadManager.onSubmit} disabled={isUploading}>
                    {isUploading ? 'Uploading...' : 'Upload Material'}
                  </button>
                </div>
              </section>
            )}

            {showFolderPanel && hasFolderManager && (
              <section className={styles.quickActionPanel}>
                <div className={styles.quickActionHeader}>
                  <div>
                    <h3>Create Folder</h3>
                    <p>Add a shared folder or link one to a campaign so materials stay organised.</p>
                  </div>
                  <span className={campaignStyles.rowMeta}>{folderManager.folders.length} folder{folderManager.folders.length !== 1 ? 's' : ''}</span>
                </div>

                <div className={styles.quickFormGrid}>
                  <div className={campaignStyles.formField}>
                    <label className={campaignStyles.formLabel}>Folder Name</label>
                    <input
                      className={campaignStyles.formInput}
                      placeholder="New folder name..."
                      value={folderManager.newFolderName}
                      onChange={(event) => folderManager.onNewFolderNameChange(event.target.value)}
                    />
                  </div>

                  <div className={campaignStyles.formField}>
                    <label className={campaignStyles.formLabel}>Campaign</label>
                    <select
                      className={campaignStyles.formInput}
                      value={folderManager.newFolderCampaignId}
                      onChange={(event) => folderManager.onNewFolderCampaignIdChange(event.target.value)}
                    >
                      <option value="">All campaigns / shared</option>
                      {folderManager.campaigns.map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.quickActionFooter}>
                  <button type="button" className={campaignStyles.secondaryBtn} onClick={() => setShowFolderPanel(false)}>
                    Close
                  </button>
                  <button type="button" className={campaignStyles.primaryBtn} onClick={folderManager.onCreateFolder}>
                    Create Folder
                  </button>
                </div>
              </section>
            )}
          </div>
        )}

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <p className={styles.statLabel}>Total Assets</p>
            <div className={styles.statValue}>
              <strong>{totalCount}</strong>
              <span>in library</span>
            </div>
            <div className={styles.statTrack}><div className={styles.statFill} style={{ width: '100%' }}></div></div>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statLabel}>Approved</p>
            <div className={styles.statValue}>
              <strong>{approvedCount}</strong>
              <span>{readyPercent}% ready</span>
            </div>
            <div className={styles.statTrack}><div className={styles.statFill} style={{ width: `${readyPercent}%` }}></div></div>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statLabel}>Flagged</p>
            <div className={styles.statValue}>
              <strong>{flaggedCount}</strong>
              <span>{flaggedPercent}% under review</span>
            </div>
            <div className={styles.statTrack}><div className={styles.statFill} style={{ width: `${flaggedPercent}%` }}></div></div>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statLabel}>Visible Results</p>
            <div className={styles.statValue}>
              <strong>{filteredCount}</strong>
              <span>{filteredPercent}% of library</span>
            </div>
            <div className={styles.statTrack}><div className={styles.statFill} style={{ width: `${filteredPercent}%` }}></div></div>
          </div>
        </div>
      </section>

      <section className={styles.toolbarWrap}>
        <div className={styles.toolbarHeader}>
          <div>
            <h3>Filter Materials</h3>
            <p>Search by title, narrow by campaign and folder, or focus on a specific asset type.</p>
          </div>
          <span className={campaignStyles.rowMeta}>{filteredCount} visible result{filteredCount !== 1 ? 's' : ''}</span>
        </div>

        <div className={campaignStyles.toolbar}>
          <input
            className={campaignStyles.searchInput}
            placeholder="Search materials by name, type or status..."
            value={materialSearch}
            onChange={(event) => onMaterialSearchChange(event.target.value)}
          />
          <select
            className={campaignStyles.filterSelect}
            value={materialCampaignFilter}
            onChange={(event) => onMaterialCampaignFilterChange(event.target.value)}
          >
            <option value="all">All Campaigns</option>
            <option value="unassigned">Unassigned</option>
            {campaignNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            className={campaignStyles.filterSelect}
            value={materialFolderFilter}
            onChange={(event) => onMaterialFolderFilterChange(event.target.value)}
          >
            <option value="all">All Folders</option>
            <option value="unassigned">No Folder</option>
            {visibleFolders.map((folder) => (
              <option key={folder.id} value={folder.id}>{folder.name}</option>
            ))}
          </select>
        </div>

        <div className={campaignStyles.materialTabs}>
          {MATERIAL_TYPE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`${campaignStyles.tabPill} ${materialTypeFilter === tab.id ? campaignStyles.activePill : ''}`}
              onClick={() => onMaterialTypeFilterChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {folderManager?.enabled && (
        <section className={styles.folderPanel}>
          <div className={styles.folderPanelHeader}>
            <h3>Recent Folders</h3>
            <p>Your folder shortcuts stay visible here while creation happens from the quick action above.</p>
          </div>
          <div className={campaignStyles.folderPills}>
            {folderManager.folders.slice(0, 8).map((folder) => (
              <span key={folder.id} className={campaignStyles.badge}>{folder.name}</span>
            ))}
            {folderManager.folders.length === 0 && <span className={campaignStyles.rowMeta}>No folders yet.</span>}
          </div>
        </section>
      )}

      <section className={styles.materialsWrap}>
        <div className={campaignStyles.materialsGrid}>
          {visibleMaterials.map((material) => {
            const Icon = getFileIcon(material.file_type)
            const isFlagged = flaggedMaterialIds instanceof Set ? flaggedMaterialIds.has(material.id) : false
            const normalizedStatus = String(material.status || 'Submitted').trim()

            return (
              <article className={campaignStyles.materialCard} key={material.id}>
                <div className={styles.cardHeader}>
                  <div className={campaignStyles.materialIcon}><Icon size={32} /></div>
                  <button
                    type="button"
                    className={`${campaignStyles.flagIconBtn} ${isFlagged ? campaignStyles.flagIconBtnActive : ''}`}
                    onClick={() => onFlagMaterial(material)}
                    title={isFlagged ? 'Flagged for compliance review' : 'Flag for compliance review'}
                    aria-label={isFlagged ? 'Flagged for compliance review' : 'Flag for compliance review'}
                  >
                    <FlagIcon size={16} active={isFlagged} />
                  </button>
                </div>

                <h4 className={styles.materialTitle}>{material.name || 'Untitled'}</h4>

                <div className={styles.statusRow}>
                  <span className={`${styles.statusBadge} ${getStatusToneClass(normalizedStatus)}`}>{normalizedStatus}</span>
                  <span className={styles.fileMeta}>{(material.file_type || 'file').toUpperCase()}</span>
                </div>

                <div className={styles.metaList}>
                  <p className={campaignStyles.rowMeta}><span className={styles.metaLabel}>Campaign:</span> {material.campaign?.name || 'Unassigned'}</p>
                  <p className={campaignStyles.rowMeta}><span className={styles.metaLabel}>Folder:</span> {material.folder?.name || 'No folder'}</p>
                  <p className={campaignStyles.rowMeta}><span className={styles.metaLabel}>Updated:</span> {material.updated_at ? new Date(material.updated_at).toLocaleString('en-GB') : 'N/A'}</p>
                  <p className={campaignStyles.rowMeta}><span className={styles.metaLabel}>Last edited by:</span> {getMaterialEditorName(material)}</p>
                </div>

                <div className={campaignStyles.materialCardActions}>
                  <button type="button" className={campaignStyles.linkBtn} onClick={() => onOpenDetails(material)}>Details</button>
                  {canReplaceMaterials && (
                    <button
                      type="button"
                      className={campaignStyles.linkBtn}
                      onClick={() => onReplaceMaterial(material)}
                      disabled={isReplacingMaterial}
                    >
                      {isReplacingMaterial && replacingMaterialId === material.id ? 'Updating…' : 'Replace'}
                    </button>
                  )}
                  <button
                    type="button"
                    className={campaignStyles.linkBtn}
                    disabled={String(material.status || '').trim().toLowerCase() !== 'approved'}
                    title={String(material.status || '').trim().toLowerCase() !== 'approved' ? 'Only approved materials can be downloaded' : 'Download file'}
                    onClick={() => onDownloadMaterial(material)}
                  >
                    Download
                  </button>
                </div>
              </article>
            )
          })}
        </div>

        {!loading && visibleMaterials.length === 0 && (
          <div className={styles.emptyState}>
            <strong>{emptyTitle}</strong>
            <span>{emptyDescription}</span>
          </div>
        )}

        {loading && <p className={styles.loadingState}>{loadingText}</p>}
      </section>
    </div>
  )
}