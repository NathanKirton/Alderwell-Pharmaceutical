import React, { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import styles from './Sidebar.module.css'
import ProfilePictureModal from './ProfilePictureModal'
import { supabase } from '../../services/supabaseClient'

const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r="48" fill="%23c8d3cb"/><circle cx="48" cy="38" r="16" fill="%238aa091"/><path d="M20 80c6-14 18-22 28-22s22 8 28 22" fill="%238aa091"/></svg>'

export default function Sidebar({ tabs, activeTab, onTabChange }) {
  const { userProfile, user } = useAuth()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [profilePicture, setProfilePicture] = useState(
    userProfile?.avatar_url || userProfile?.profile_picture_url || null
  )

  useEffect(() => {
    setProfilePicture(userProfile?.avatar_url || userProfile?.profile_picture_url || null)
  }, [userProfile])

  const handleProfilePictureChange = async (imageData) => {
    if (!user) return false

    try {
      // Convert base64 to blob
      const arr = imageData.split(',')
      const mime = arr[0].match(/:(.*?);/)[1]
      const bstr = atob(arr[1])
      const n = bstr.length
      const u8arr = new Uint8Array(n)
      for (let i = 0; i < n; i++) {
        u8arr[i] = bstr.charCodeAt(i)
      }
      const blob = new Blob([u8arr], { type: mime })

      // Upload to Supabase storage
      const fileName = `profile-${user.id}-${Date.now()}.jpg`
      const bucketCandidates = ['avatars', 'profile-pictures']
      let uploadedBucket = null
      let uploadFailure = null

      for (const bucket of bucketCandidates) {
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, blob, {
            cacheControl: '3600',
            upsert: true,
          })

        if (!uploadError) {
          uploadedBucket = bucket
          uploadFailure = null
          break
        }

        uploadFailure = uploadError
      }

      if (!uploadedBucket) {
        throw uploadFailure || new Error('Avatar upload failed.')
      }

      // Get public URL
      const { data: publicData } = supabase.storage
        .from(uploadedBucket)
        .getPublicUrl(fileName)

      // Update user profile with previous-schema field first, then fallback.
      let { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicData.publicUrl })
        .eq('id', user.id)

      if (updateError) {
        const { error: fallbackError } = await supabase
          .from('profiles')
          .update({ profile_picture_url: publicData.publicUrl })
          .eq('id', user.id)

        updateError = fallbackError
      }

      if (updateError) throw updateError

      setProfilePicture(publicData.publicUrl)
      return true
    } catch (error) {
      console.error('Error updating profile picture:', error)
      alert('Failed to update profile picture. Please try again.')
      return false
    }
  }

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.sidebarNav}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.navLink} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={styles.sidebarProfile}>
        <button
          className={styles.profileImgBtn}
          onClick={() => setIsModalOpen(true)}
          title="Click to change profile picture"
        >
          <img
            className={styles.profileImg}
            src={profilePicture || DEFAULT_AVATAR}
            onError={(e) => {
              e.currentTarget.src = DEFAULT_AVATAR
            }}
            alt="Profile"
          />
        </button>
        <div>
          <p className={styles.profileName}>
            {userProfile?.full_name || 'User'}
          </p>
          <p className={styles.profileRole}>
            {userProfile?.role?.replace('_', ' ') || 'No Role'}
          </p>
        </div>
      </div>
      <ProfilePictureModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentImage={profilePicture}
        onImageChange={handleProfilePictureChange}
      />
    </aside>
  )
}
