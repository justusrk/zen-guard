import type { Session, Rule, Stats, StorageData, BlockEvent, Settings } from './types'

const DEFAULT_STATS: Stats = {
  blocksThisWeek: 0,
  weekStartDate: getWeekStartDate(),
  blockHistory: []
}

function getWeekStartDate(): string {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diff = now.getDate() - dayOfWeek
  const weekStart = new Date(now.setDate(diff))
  weekStart.setHours(0, 0, 0, 0)
  return weekStart.toISOString().split('T')[0]
}

function generateId(): string {
  return crypto.randomUUID()
}

async function getStorageData(): Promise<StorageData> {
  const result = await chrome.storage.local.get(['sessions', 'globalRules', 'stats', 'settings'])
  return {
    sessions: result.sessions ?? [],
    globalRules: result.globalRules ?? [],
    stats: result.stats ?? { ...DEFAULT_STATS },
    settings: result.settings ?? {}
  }
}

function normalizeRule(rule: Rule): Rule {
  return {
    ...rule,
    values: Array.isArray(rule.values) ? rule.values : [],
    isRegex: rule.isRegex ?? false,
    enabled: rule.enabled ?? true,
    order: rule.order ?? 0,
    skipRemaining: rule.skipRemaining ?? false,
    searchInUrl: rule.searchInUrl ?? false,
    searchInHeading: rule.searchInHeading ?? false,
    searchInBody: rule.searchInBody ?? true,
    message: rule.message ?? ''
  }
}

export async function getSessions(): Promise<Session[]> {
  const data = await getStorageData()
  return data.sessions
    .map((session, index) => ({
      ...session,
      daysOfWeek: Array.isArray(session.daysOfWeek) ? session.daysOfWeek : [],
      rules: Array.isArray(session.rules) ? session.rules.map(normalizeRule) : [],
      message: session.message ?? '',
      order: session.order ?? index
    }))
    .sort((a, b) => a.order - b.order)
}

export async function getSession(id: string): Promise<Session | undefined> {
  const sessions = await getSessions()
  return sessions.find(s => s.id === id)
}

export async function saveSession(session: Omit<Session, 'id'> & { id?: string }): Promise<Session> {
  const sessions = await getSessions()
  const savedSession: Session = {
    ...session,
    id: session.id ?? generateId(),
    order: session.order ?? sessions.length
  }

  const existingIndex = sessions.findIndex(s => s.id === savedSession.id)
  if (existingIndex >= 0) {
    sessions[existingIndex] = savedSession
  } else {
    sessions.push(savedSession)
  }

  await chrome.storage.local.set({ sessions })
  return savedSession
}

export async function saveSessions(sessions: Session[]): Promise<void> {
  // Deep clone sessions to avoid reference issues
  const clonedSessions = sessions.map(s => ({
    ...s,
    daysOfWeek: Array.isArray(s.daysOfWeek) ? [...s.daysOfWeek] : [],
    rules: Array.isArray(s.rules) ? s.rules.map(r => ({
      ...r,
      values: Array.isArray(r.values) ? [...r.values] : []
    })) : []
  }))
  await chrome.storage.local.set({ sessions: clonedSessions })
}

export async function deleteSession(id: string): Promise<void> {
  const sessions = await getSessions()
  const filtered = sessions.filter(s => s.id !== id)
  await chrome.storage.local.set({ sessions: filtered })
}

export async function getGlobalRules(): Promise<Rule[]> {
  const data = await getStorageData()
  return data.globalRules.map(normalizeRule)
}

export async function saveGlobalRules(rules: Rule[]): Promise<void> {
  // Deep clone the rules to avoid reference issues
  const clonedRules = rules.map(r => ({
    ...r,
    values: Array.isArray(r.values) ? [...r.values] : []
  }))
  await chrome.storage.local.set({ globalRules: clonedRules })
}

export async function addGlobalRule(rule: Omit<Rule, 'id'> & { id?: string }): Promise<Rule> {
  const rules = await getGlobalRules()
  const savedRule: Rule = {
    ...rule,
    id: rule.id ?? generateId()
  }

  const existingIndex = rules.findIndex(r => r.id === savedRule.id)
  if (existingIndex >= 0) {
    rules[existingIndex] = savedRule
  } else {
    rules.push(savedRule)
  }

  await saveGlobalRules(rules)
  return savedRule
}

export async function deleteGlobalRule(id: string): Promise<void> {
  const rules = await getGlobalRules()
  const filtered = rules.filter(r => r.id !== id)
  await saveGlobalRules(filtered)
}

export async function getStats(): Promise<Stats> {
  const data = await getStorageData()
  const currentWeekStart = getWeekStartDate()

  if (data.stats.weekStartDate !== currentWeekStart) {
    const resetStats: Stats = {
      blocksThisWeek: 0,
      weekStartDate: currentWeekStart,
      blockHistory: []
    }
    await chrome.storage.local.set({ stats: resetStats })
    return resetStats
  }

  return data.stats
}

export async function incrementBlockCount(event: BlockEvent): Promise<Stats> {
  const stats = await getStats()
  stats.blocksThisWeek += 1
  stats.blockHistory.push(event)

  if (stats.blockHistory.length > 100) {
    stats.blockHistory = stats.blockHistory.slice(-100)
  }

  await chrome.storage.local.set({ stats })
  return stats
}

export async function resetWeeklyStats(): Promise<void> {
  const stats: Stats = {
    blocksThisWeek: 0,
    weekStartDate: getWeekStartDate(),
    blockHistory: []
  }
  await chrome.storage.local.set({ stats })
}

export async function addRuleToSession(
  sessionId: string,
  rule: Omit<Rule, 'id'> & { id?: string }
): Promise<Rule> {
  const sessions = await getSessions()
  const session = sessions.find(s => s.id === sessionId)
  if (!session) throw new Error('Session not found')

  const savedRule: Rule = {
    ...rule,
    id: rule.id ?? generateId()
  }

  const existingIndex = session.rules.findIndex(r => r.id === savedRule.id)
  if (existingIndex >= 0) {
    session.rules[existingIndex] = savedRule
  } else {
    session.rules.push(savedRule)
  }

  await chrome.storage.local.set({ sessions })
  return savedRule
}

export async function deleteRuleFromSession(sessionId: string, ruleId: string): Promise<void> {
  const sessions = await getSessions()
  const session = sessions.find(s => s.id === sessionId)
  if (!session) throw new Error('Session not found')

  session.rules = session.rules.filter(r => r.id !== ruleId)
  await chrome.storage.local.set({ sessions })
}

export async function updateSessionRules(sessionId: string, rules: Rule[]): Promise<void> {
  // Get raw storage data to avoid any transformation issues
  const result = await chrome.storage.local.get(['sessions'])
  const sessions: Session[] = result.sessions ?? []

  const sessionIndex = sessions.findIndex(s => s.id === sessionId)
  if (sessionIndex === -1) throw new Error('Session not found')

  // Deep clone the rules to avoid reference issues
  const clonedRules = rules.map(r => ({
    ...r,
    values: Array.isArray(r.values) ? [...r.values] : []
  }))

  sessions[sessionIndex] = {
    ...sessions[sessionIndex],
    rules: clonedRules
  }

  await chrome.storage.local.set({ sessions })
}

export async function getSettings(): Promise<Settings> {
  const data = await getStorageData()
  return data.settings
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings })
}

export async function getGlobalMessage(): Promise<string> {
  const settings = await getSettings()
  return settings.globalMessage || ''
}

export async function getMotivationMessages(): Promise<string[]> {
  const settings = await getSettings()
  return settings.motivationMessages || []
}
