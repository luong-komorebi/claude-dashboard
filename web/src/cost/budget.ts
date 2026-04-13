/**
 * Monthly budget, persisted in localStorage.
 * Kept deliberately small — just a single USD amount with an optional label.
 */

const STORAGE_KEY = 'claude-dashboard:budget'

export interface Budget {
  amount: number       // USD
  setAt: number        // epoch ms — for audit/display
}

export function getBudget(): Budget | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Budget
    if (typeof parsed.amount !== 'number' || parsed.amount <= 0) return null
    return parsed
  } catch {
    return null
  }
}

export function setBudget(amount: number): void {
  if (amount <= 0) {
    clearBudget()
    return
  }
  try {
    const entry: Budget = { amount, setAt: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry))
  } catch { /* private mode */ }
}

export function clearBudget(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch { /* private mode */ }
}

/**
 * Given current MTD spend and the day of month, project the full-month total
 * assuming the current daily rate holds.
 */
export function projectMonth(mtdCost: number, daysElapsed: number, daysInMonth: number): number {
  if (daysElapsed <= 0) return 0
  return (mtdCost / daysElapsed) * daysInMonth
}
