import type { Session } from './types'
import { getSessions } from './storage'

export function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return { hours, minutes }
}

export function timeToMinutes(timeStr: string): number {
  const { hours, minutes } = parseTime(timeStr)
  return hours * 60 + minutes
}

export function isTimeInRange(
  currentTime: string,
  startTime: string,
  endTime: string
): boolean {
  const current = timeToMinutes(currentTime)
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)

  if (start <= end) {
    return current >= start && current < end
  } else {
    return current >= start || current < end
  }
}

export function getCurrentTime(): string {
  const now = new Date()
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

export function getCurrentDayOfWeek(): number {
  return new Date().getDay()
}

export function isSessionActive(session: Session): boolean {
  if (!session.enabled) return false

  const currentDay = getCurrentDayOfWeek()
  const daysOfWeek = Array.isArray(session.daysOfWeek) ? session.daysOfWeek : []
  if (!daysOfWeek.includes(currentDay)) return false

  const currentTime = getCurrentTime()
  return isTimeInRange(currentTime, session.startTime, session.endTime)
}

export async function getActiveSession(): Promise<Session | null> {
  const sessions = await getSessions()
  for (const session of sessions) {
    if (isSessionActive(session)) {
      return session
    }
  }
  return null
}

export function getTimeRemainingInSession(session: Session): number {
  const currentTime = getCurrentTime()
  const currentMinutes = timeToMinutes(currentTime)
  const endMinutes = timeToMinutes(session.endTime)

  if (endMinutes > currentMinutes) {
    return endMinutes - currentMinutes
  } else {
    return (24 * 60 - currentMinutes) + endMinutes
  }
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

export function sessionsOverlap(
  session1: { startTime: string; endTime: string; daysOfWeek: number[] },
  session2: { startTime: string; endTime: string; daysOfWeek: number[] }
): boolean {
  const days1 = Array.isArray(session1.daysOfWeek) ? session1.daysOfWeek : []
  const days2 = Array.isArray(session2.daysOfWeek) ? session2.daysOfWeek : []
  const sharedDays = days1.filter(d => days2.includes(d))
  if (sharedDays.length === 0) return false

  const s1Start = timeToMinutes(session1.startTime)
  const s1End = timeToMinutes(session1.endTime)
  const s2Start = timeToMinutes(session2.startTime)
  const s2End = timeToMinutes(session2.endTime)

  const s1CrossesMidnight = s1Start > s1End
  const s2CrossesMidnight = s2Start > s2End

  if (!s1CrossesMidnight && !s2CrossesMidnight) {
    return s1Start < s2End && s2Start < s1End
  }

  if (s1CrossesMidnight && s2CrossesMidnight) {
    return true
  }

  if (s1CrossesMidnight) {
    return s2Start < s1End || s2End > s1Start
  }

  return s1Start < s2End || s1End > s2Start
}

export async function validateNoOverlap(
  newSession: { startTime: string; endTime: string; daysOfWeek: number[]; id?: string }
): Promise<{ valid: boolean; conflictingSession?: Session }> {
  const sessions = await getSessions()

  for (const existing of sessions) {
    if (existing.id === newSession.id) continue
    if (!existing.enabled) continue

    if (sessionsOverlap(newSession, existing)) {
      return { valid: false, conflictingSession: existing }
    }
  }

  return { valid: true }
}
