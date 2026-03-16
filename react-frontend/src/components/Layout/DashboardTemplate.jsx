import React, { useState } from 'react'
import Topbar from '../Layout/Topbar'
import Sidebar from '../Layout/Sidebar'
import BottomNavigation from '../Layout/BottomNavigation'
import styles from './DashboardTemplate.module.css'

export default function DashboardTemplate({
  title = 'Dashboard',
  tabs = [],
  defaultTab = null,
  children,
}) {
  const [activeTab, setActiveTab] = useState(defaultTab || (tabs[0]?.id || null))

  return (
    <div className={styles.dashboardLayout}>
      <Topbar title={title} />
      <div className={styles.mainContent}>
        {tabs.length > 0 && (
          <Sidebar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
        )}
        <main className={styles.mainArea}>
          {typeof children === 'function' ? children(activeTab) : children}
        </main>
      </div>
      {tabs.length > 0 && (
        <BottomNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      )}
    </div>
  )
}
