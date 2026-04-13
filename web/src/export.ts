/**
 * Export DashboardData to a user-chosen file via showSaveFilePicker (File
 * System Access API). Unlike the download-link hack this lets the user pick
 * the save location and filename natively.
 */

import type { DashboardData } from './api'

export async function exportDashboard(data: DashboardData): Promise<'saved' | 'cancelled'> {
  const today = new Date().toISOString().slice(0, 10)
  const suggestedName = `claude-dashboard-${today}.json`

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: 'Dashboard JSON',
          accept: { 'application/json': ['.json'] },
        },
      ],
    })
    const writable = await handle.createWritable()
    await writable.write(JSON.stringify(data, null, 2))
    await writable.close()
    return 'saved'
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
    throw e
  }
}
