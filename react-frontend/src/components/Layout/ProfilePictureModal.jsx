import React, { useState, useRef } from 'react'
import { CameraIcon } from '../Icons/IconSet'
import styles from './ProfilePictureModal.module.css'

export default function ProfilePictureModal({
  isOpen,
  onClose,
  currentImage,
  onImageChange,
}) {
  const [preview, setPreview] = useState(currentImage)
  const [isDragging, setIsDragging] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef(null)

  React.useEffect(() => {
    setPreview(currentImage || null)
  }, [currentImage, isOpen])

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const processFile = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result
      if (typeof result === 'string') {
        setPreview(result)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      processFile(file)
    }
  }

  const handleSave = async () => {
    if (preview) {
      setIsSaving(true)
      const saved = await onImageChange(preview)
      setIsSaving(false)
      if (saved) {
        onClose()
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className={styles.modalOverlay} onClick={!isSaving ? onClose : undefined}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Upload Profile Picture</h3>
          <button className={styles.closeBtn} onClick={onClose} disabled={isSaving}>
            ×
          </button>
        </div>

        <div
          className={`${styles.dropArea} ${isDragging ? styles.dragover : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isSaving && fileInputRef.current?.click()}
        >
          <div className={styles.dropContent}>
            <CameraIcon size={40} />
            <p>Drag & drop an image here</p>
            <p className={styles.small}>or click to select</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={isSaving}
            hidden
          />
        </div>

        {preview && (
          <div className={styles.previewSection}>
            <h4>Preview</h4>
            <img src={preview} alt="Preview" className={styles.previewImage} />
          </div>
        )}

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={!preview || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Picture'}
          </button>
        </div>
      </div>
    </div>
  )
}
