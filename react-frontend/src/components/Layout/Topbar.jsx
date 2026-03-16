import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import styles from './Topbar.module.css'

const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r="48" fill="%23c8d3cb"/><circle cx="48" cy="38" r="16" fill="%238aa091"/><path d="M20 80c6-14 18-22 28-22s22 8 28 22" fill="%238aa091"/></svg>'

export default function Topbar({ title = 'Dashboard' }) {
  const navigate = useNavigate()
  const { signOut, userProfile } = useAuth()

  const profileImage = userProfile?.avatar_url || userProfile?.profile_picture_url || DEFAULT_AVATAR

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <header className={styles.topbar}>
      <div className={styles.topbarLeft}>
        <h1>{title}</h1>
      </div>
      <div className={styles.topbarRight}>
        <img
          src={profileImage}
          alt="Profile"
          className={styles.mobileProfileImg}
          onError={(e) => {
            e.currentTarget.src = DEFAULT_AVATAR
          }}
        />
        <button onClick={handleLogout} className={styles.logoutBtn}>
          Logout
        </button>
      </div>
    </header>
  )
}
