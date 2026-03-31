import React from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import Login from './components/LoginSignupScreen/Login'
import Admin from './components/Dashboards/Admin'
import MarketingSales from './components/Dashboards/MarketingSales'
import ComplianceReviewer from './components/Dashboards/ComplianceReviewer'
import CampaignManagement from './components/Dashboards/CampaignManagement'
import LiaisonOfficer from './components/Dashboards/LiaisonOfficer'
import NoAccess from './components/Dashboards/NoAccess'
import { getRoleDashboardPath } from './utils/roleUtils'
import './App.css'

function EntryRedirect() {
  const { user, userProfile, cachedRole, loading } = useAuth()

  if (loading) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={getRoleDashboardPath(userProfile?.role || cachedRole || 'no_role')} replace />
}

function LoginRoute({ initialMode = 'login' }) {
  const { user, userProfile, cachedRole, loading } = useAuth()

  if (loading) {
    return <Login initialMode={initialMode} />
  }

  if (user) {
    return <Navigate to={getRoleDashboardPath(userProfile?.role || cachedRole || 'no_role')} replace />
  }

  return <Login initialMode={initialMode} />
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/signup" element={<LoginRoute initialMode="signup" />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/marketing-sales"
            element={
              <ProtectedRoute requiredRole="marketing_sales">
                <MarketingSales />
              </ProtectedRoute>
            }
          />
          <Route
            path="/compliance-reviewer"
            element={
              <ProtectedRoute requiredRole="compliance_reviewer">
                <ComplianceReviewer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/campaign-management"
            element={
              <ProtectedRoute requiredRole="campaign_management">
                <CampaignManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/liaison-officer"
            element={
              <ProtectedRoute requiredRole="liaison_officer">
                <LiaisonOfficer />
              </ProtectedRoute>
            }
          />
          <Route path="/no-access" element={<NoAccess />} />
          <Route path="/" element={<EntryRedirect />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
