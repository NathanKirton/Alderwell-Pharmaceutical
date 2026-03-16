import React, { createContext, useState, useContext, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabaseClient'

const AuthContext = createContext()
const PROFILE_FETCH_TIMEOUT_MS = 8000
const CACHED_ROLE_KEY = 'alderwell_cached_role'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [cachedRole, setCachedRole] = useState(() => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(CACHED_ROLE_KEY)
  })

  const fetchUserProfile = useCallback(async (userId) => {
    setProfileLoading(true)
    try {
      const profileRequest = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      const timeoutRequest = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Profile fetch timed out.'))
        }, PROFILE_FETCH_TIMEOUT_MS)
      })

      const { data: profile, error } = await Promise.race([
        profileRequest,
        timeoutRequest,
      ])

      if (error) {
        console.error('Profile fetch error:', error)
        setUserProfile(null)
        return null
      }

      const normalizedProfile = {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        profile_picture_url: profile.profile_picture_url,
      }

      setUserProfile(normalizedProfile)
      if (normalizedProfile.role) {
        setCachedRole(normalizedProfile.role)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(CACHED_ROLE_KEY, normalizedProfile.role)
        }
      }
      return normalizedProfile
    } catch (error) {
      console.error('Unexpected profile error:', error)
      setUserProfile(null)
      return null
    } finally {
      setProfileLoading(false)
    }
  }, [])

  const checkAuth = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        fetchUserProfile(user.id)
      } else {
        setUserProfile(null)
        setProfileLoading(false)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      setUserProfile(null)
      setProfileLoading(false)
    } finally {
      setLoading(false)
    }
  }, [fetchUserProfile])

  // Initialize auth state on mount
  useEffect(() => {
    checkAuth()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setLoading(false)
        setUser(session?.user || null)
        if (session?.user) {
          fetchUserProfile(session.user.id)
        } else {
          setUserProfile(null)
          setProfileLoading(false)
        }
      }
    )

    return () => subscription?.unsubscribe()
  }, [checkAuth, fetchUserProfile])

  const signUp = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (error) throw error
    return data
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    let profile = null
    if (data?.user?.id) {
      setUser(data.user)
      profile = await fetchUserProfile(data.user.id)
    }

    return { ...data, profile }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error

    setUser(null)
    setUserProfile(null)
    setLoading(false)
    setProfileLoading(false)
    setCachedRole(null)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CACHED_ROLE_KEY)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        profileLoading,
        cachedRole,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
