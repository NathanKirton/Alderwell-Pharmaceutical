import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getRoleDashboardPath } from '../../utils/roleUtils'
import styles from './Login.module.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [staySignedIn, setStaySignedIn] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('') // 'error' or 'success'
  const navigate = useNavigate()
  const { signIn, user, userProfile, loading } = useAuth()

  // Always leave login once there is an authenticated user.
  // If role is missing, route to no-access as a safe fallback.
  useEffect(() => {
    if (!loading && user) {
      const dashboardPath = getRoleDashboardPath(userProfile?.role || 'no_role')
      navigate(dashboardPath, { replace: true })
    }
  }, [loading, user, userProfile, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    setMessageType('')

    try {
      const authResult = await signIn(email, password)

      // Handle 'stay signed in' if needed
      if (staySignedIn) {
        localStorage.setItem('staySignedIn', 'true')
      }

      if (authResult?.user) {
        const resolvedRole = authResult?.profile?.role || userProfile?.role || 'no_role'
        navigate(getRoleDashboardPath(resolvedRole), { replace: true })
        return
      }

      setMessage('Login successful! Redirecting...')
      setMessageType('success')
      
      // The useEffect above will handle navigation once userProfile is loaded
    } catch (err) {
      setMessage(err.message || 'Login failed')
      setMessageType('error')
    }
  }

  return (
    <div className={styles.loginLayout}>
      {/* LEFT PANEL */}
      <div className={styles.loginLeft}>
        <img
          src={`${process.env.PUBLIC_URL}/Collab_Dev_Icon_Logo.png`}
          alt="Alderwell Logo"
          className={styles.bigLogo}
        />
        <div className={styles.companyTitle}>
          <span className={styles.companyMain}>Alderwell</span>
          <span className={styles.companySub}>Pharmaceuticals</span>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className={styles.loginRight}>
        <div className={styles.loginCard}>
          <h2 className={styles.welcome}>Welcome Back</h2>
          <p className={styles.subtitle}>
            Please enter your credentials to access your campaign dashboard.
          </p>

          <form onSubmit={handleSubmit}>
            <label className={styles.inputLabel}>EMAIL OR USERNAME</label>
            <div className={styles.inputGroup}>
              <span className={styles.inputIcon}>
                <svg
                  width="18"
                  height="18"
                  fill="#aab0b6"
                  viewBox="0 0 24 24"
                >
                  <path d="M2 4v16h20V4H2zm18 2v.511l-8 5.333-8-5.333V6h16zm0 12H4V8.489l8 5.333 8-5.333V18z" />
                </svg>
              </span>
              <input
                type="email"
                id="email"
                placeholder="name@pharmacy.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <label className={styles.inputLabel}>
              PASSWORD
              <Link to="/signup" className={styles.forgot}>
                Sign Up Here
              </Link>
            </label>
            <div className={styles.inputGroup}>
              <span className={styles.inputIcon}>
                <svg
                  width="18"
                  height="18"
                  fill="#aab0b6"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6-7V7a6 6 0 0 0-12 0v3a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zm-8-3a4 4 0 0 1 8 0v3H6V7zm10 12H6v-7h12v7z" />
                </svg>
              </span>
              <input
                type="password"
                id="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className={styles.optionsRow}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  id="stay-signed-in"
                  checked={staySignedIn}
                  onChange={(e) => setStaySignedIn(e.target.checked)}
                />
                Stay signed in for 30 days
              </label>
            </div>

            <button type="submit" className={styles.submitButton}>
              Sign In to Dashboard <span className={styles.arrow}>→</span>
            </button>
          </form>

          <p
            className={`${styles.message} ${
              messageType === 'error'
                ? styles.messageError
                : messageType === 'success'
                ? styles.messageSuccess
                : ''
            }`}
          >
            {message}
          </p>

          <div className={styles.formFooter}>
            <small>
              By signing in, you agree to our{' '}
              <a href="/terms">Terms of Service</a> and{' '}
              <a href="/privacy">Privacy Policy</a>
            </small>
          </div>
        </div>
      </div>
    </div>
  )
}
