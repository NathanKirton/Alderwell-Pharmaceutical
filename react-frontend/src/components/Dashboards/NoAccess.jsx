import React from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getRoleDashboardPath } from '../../utils/roleUtils'
import styles from './NoAccess.module.css'

export default function NoAccess() {
  const navigate = useNavigate()
  const { signOut, user, userProfile, loading, cachedRole } = useAuth()
  const resolvedRole = userProfile?.role || cachedRole

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <p className={styles.message}>Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (resolvedRole && resolvedRole !== 'no_role') {
    return <Navigate to={getRoleDashboardPath(resolvedRole)} replace />
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Access Denied</h1>
        <p className={styles.message}>
          Your account does not have an assigned role yet. Please contact an administrator to assign you a role.
        </p>
        <button onClick={handleLogout} className={styles.button}>
          Logout
        </button>
      </div>
    </div>
  )
}
