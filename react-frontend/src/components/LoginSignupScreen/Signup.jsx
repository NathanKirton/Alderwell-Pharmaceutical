import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import styles from './Signup.module.css'

export default function Signup() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const navigate = useNavigate()
  const { signUp } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    setMessageType('')

    try {
      await signUp(email, password, fullName)

      setMessage('Account created successfully! Redirecting to login...')
      setMessageType('success')

      setTimeout(() => {
        navigate('/login')
      }, 1500)
    } catch (error) {
      setMessage(error.message || 'Signup failed')
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
          <h2 className={styles.welcome}>Create Account</h2>
          <p className={styles.subtitle}>
            Sign up to access your campaign dashboard.
          </p>

          <form onSubmit={handleSubmit}>
            <label className={styles.inputLabel}>FULL NAME</label>
            <div className={styles.inputGroup}>
              <span className={styles.inputIcon}>
                <svg
                  width="18"
                  height="18"
                  fill="#aab0b6"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 12c2.7 0 8 1.34 8 4v2H4v-2c0-2.66 5.3-4 8-4zm0-2a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
                </svg>
              </span>
              <input
                type="text"
                id="full_name"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <label className={styles.inputLabel}>EMAIL</label>
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

            <label className={styles.inputLabel}>PASSWORD</label>
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
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className={styles.submitButton}>
              Sign Up <span className={styles.arrow}>→</span>
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
              By signing up, you agree to our{' '}
              <a href="/terms">Terms of Service</a> and{' '}
              <a href="/privacy">Privacy Policy</a>
            </small>
          </div>
        </div>
      </div>
    </div>
  )
}
