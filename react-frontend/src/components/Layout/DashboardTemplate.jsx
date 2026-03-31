import React, { useState } from 'react'
import Topbar from '../Layout/Topbar'
import Sidebar from '../Layout/Sidebar'
import BottomNavigation from '../Layout/BottomNavigation'
import styles from './DashboardTemplate.module.css'

export default function DashboardTemplate({
  title = 'Dashboard',
  tabs = [],
  defaultTab = null,
  roleName = 'User Workspace',
  roleSummary = '',
  roleCapabilities = [],
  pageIntents = {},
  globalActions = [],
  children,
}) {
  const [activeTab, setActiveTab] = useState(defaultTab || (tabs[0]?.id || null))
  const activeTabLabel = tabs.find((tab) => tab.id === activeTab)?.label || activeTab
  const activeIntent = pageIntents[activeTab] || {}
  const actionLinks = globalActions.length > 0 ? globalActions : tabs.slice(0, 6).map((tab) => ({ tabId: tab.id, label: tab.label }))

  return (
    <div className={styles.dashboardLayout}>
      <Topbar title={title} />
      <div className={styles.mainContent}>
        {tabs.length > 0 && (
          <Sidebar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
        )}
        <main className={styles.mainArea}>
          <section className={styles.workspaceGuide}>
            <div className={styles.workspaceGuideHeader}>
              <div>
                <p className={styles.workspaceRole}>{roleName}</p>
                <h2 className={styles.workspaceTitle}>{activeIntent.title || activeTabLabel || 'Workspace'}</h2>
                <p className={styles.workspaceSummary}>
                  {activeIntent.description || roleSummary || 'Use the linked pages below to complete your workflow.'}
                </p>
              </div>
              <div className={styles.workspaceActions}>
                {actionLinks.map((action) => (
                  <button
                    key={action.tabId}
                    type="button"
                    className={styles.workspaceActionBtn}
                    onClick={() => setActiveTab(action.tabId)}
                    disabled={action.tabId === activeTab}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            {roleCapabilities.length > 0 && (
              <div className={styles.workspaceCapabilities}>
                {roleCapabilities.map((capability) => (
                  <span key={capability} className={styles.workspaceCapabilityPill}>{capability}</span>
                ))}
              </div>
            )}
          </section>
          {typeof children === 'function' ? children(activeTab, setActiveTab) : children}
        </main>
      </div>
      {tabs.length > 0 && (
        <BottomNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      )}
    </div>
  )
}
