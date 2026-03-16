import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedRoute({ children, requiredRole }) {
  const { user, userProfile, loading, profileLoading, cachedRole } = useAuth()
  const resolvedRole = userProfile?.role || cachedRole

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

  if (requiredRole && resolvedRole !== requiredRole) {
    return <Navigate to="/no-access" replace />
  }

  return children
}
