import { useEffect, useState } from 'react'
import styles from './Avatar.module.css'

// Deterministic pastel colour based on name
const PALETTE = [
  ['#d4eed9', '#1a5c33'],
  ['#d4e4f5', '#1a3d6b'],
  ['#f5e4d4', '#6b3a1a'],
  ['#ead4f5', '#491a6b'],
  ['#f5d4d4', '#6b1a1a'],
  ['#d4f5f0', '#1a6b5c'],
  ['#f5f0d4', '#6b5c1a'],
  ['#d4d4f5', '#1a1a6b'],
]

function getColor(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase() || '??'
}

/**
 * Avatar — shows profile image if provided, otherwise initials with a
 * deterministic colour derived from the name.
 *
 * Props:
 *   name      {string}  — full name used for initials + colour
 *   src       {string}  — optional image URL
 *   size      {'sm'|'md'|'lg'}  — default 'md'
 *   className {string}  — extra CSS class
 */
export default function Avatar({ name = '', src, size = 'md', className = '' }) {
  const [imageFailed, setImageFailed] = useState(false)
  const [bg, fg] = getColor(name)
  const initials = getInitials(name)

  const sizeClass = styles[size] || styles.md
  const combinedClass = [styles.avatar, sizeClass, className].filter(Boolean).join(' ')

  useEffect(() => {
    setImageFailed(false)
  }, [src])

  if (src && !imageFailed) {
    return (
      <img
        src={src}
        alt={name}
        className={[styles.avatarImg, sizeClass, className].filter(Boolean).join(' ')}
        onError={() => setImageFailed(true)}
      />
    )
  }

  return (
    <span
      className={combinedClass}
      style={{ background: bg, color: fg }}
      aria-label={name}
      title={name}
    >
      {initials}
    </span>
  )
}
