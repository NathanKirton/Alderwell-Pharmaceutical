import React from 'react'
import styles from './BottomNavigation.module.css'
import {
  DashboardIcon,
  UserGroupIcon,
  BarChartIcon,
  CheckCircleIcon,
  MegaphoneIcon,
  FileIcon,
  CalendarIcon,
  ClipboardIcon,
} from '../Icons/IconSet'

export default function BottomNavigation({ tabs, activeTab, onTabChange }) {
  return (
    <nav className={styles.bottomNav}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.navItem} ${activeTab === tab.id ? styles.active : ''}`}
          onClick={() => onTabChange(tab.id)}
          title={tab.label}
        >
          <span className={styles.navIcon}>{getIconForTab(tab.id)}</span>
          <span className={styles.navLabel}>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

function getIconForTab(tabId) {
  const iconMap = {
    dashboard: <DashboardIcon size={24} />,
    crm: <UserGroupIcon size={24} />,
    'interaction-log': <BarChartIcon size={24} />,
    tasks: <CheckCircleIcon size={24} />,
    campaigns: <MegaphoneIcon size={24} />,
    'campaign-management': <MegaphoneIcon size={24} />,
    materials: <FileIcon size={24} />,
    approvals: <ClipboardIcon size={24} />,
    'material-approval-centre': <FileIcon size={24} />,
    'audit-logs': <ClipboardIcon size={24} />,
    'flagged-interactions': <CheckCircleIcon size={24} />,
    'reporting-analytics': <BarChartIcon size={24} />,
    'log-visit': <CalendarIcon size={24} />,
    'my-visits': <UserGroupIcon size={24} />,
    schedules: <CalendarIcon size={24} />,
    reports: <ClipboardIcon size={24} />,
  }
  return iconMap[tabId] || '●'
}
