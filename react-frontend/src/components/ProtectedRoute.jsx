import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { normalizeRole } from '../utils/roleUtils'

export function ProtectedRoute({ children, requiredRole }) {
  const { user, userProfile, loading, profileLoading, cachedRole } = useAuth()
  const resolvedRole = normalizeRole(userProfile?.role || cachedRole)
  const expectedRole = normalizeRole(requiredRole)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && profileLoading && !resolvedRole) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (requiredRole && resolvedRole !== expectedRole) {
    return <Navigate to="/no-access" replace />
  }

  return children
}
