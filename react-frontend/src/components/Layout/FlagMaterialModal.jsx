import React, { useEffect, useState } from 'react'
import styles from './FlagMaterialModal.module.css'

const SEVERITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical']

export default function FlagMaterialModal({ material, isOpen, onClose, onSubmit }) {
  const [reason, setReason] = useState('')
  const [severity, setSeverity] = useState('Medium')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setReason('')
    setSeverity('Medium')
    setDetails('')
    setError('')
    setSubmitting(false)
  }, [isOpen, material?.id])

  if (!isOpen || !material) {
    return null
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      setError('Reason is required.')
      return
    }

    setSubmitting(true)
    setError('')

    const payload = {
      reason: trimmedReason,
      severity,
      details: details.trim(),
    }

    const result = await onSubmit(payload)

    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onClose()
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <h3>Flag Material</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose}>Close</button>
        </div>

        <p className={styles.meta}><strong>Material:</strong> {material.name || material.id}</p>
        <p className={styles.meta}><strong>ID:</strong> {material.id}</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label} htmlFor="flag-reason">Reason *</label>
          <input
            id="flag-reason"
            className={styles.input}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Describe why this item should be reviewed"
            maxLength={240}
          />

          <label className={styles.label} htmlFor="flag-severity">Severity</label>
          <select
            id="flag-severity"
            className={styles.input}
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
          >
            {SEVERITY_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>

          <label className={styles.label} htmlFor="flag-details">Additional Details (optional)</label>
          <textarea
            id="flag-details"
            className={styles.textarea}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Add context for the compliance team"
            rows={4}
          ></textarea>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Flag'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
