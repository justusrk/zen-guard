import type { Session, Rule, Stats, StorageData, BlockEvent, Settings } from './types'

type LockManagerLike = {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>
}

const STORAGE_LOCK_NAME = 'zen-guard-storage'
let storageWriteQueue: Promise<void> = Promise.resolve()

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

function createDefaultStats(): Stats {
  return {
    blocksThisWeek: 0,
    weekStartDate: getWeekStartDate(),
    blockHistory: []
  }
}

async function withStorageLock<T>(operation: () => Promise<T>): Promise<T> {
  const lockManager = typeof globalThis.navigator === 'object'
    ? (globalThis.navigator as Navigator & { locks?: LockManagerLike }).locks
    : undefined

  if (lockManager?.request) {
    return lockManager.request(STORAGE_LOCK_NAME, operation)
  }

  const previous = storageWriteQueue
  let release: () => void = () => {}
  storageWriteQueue = new Promise<void>(resolve => {
    release = resolve
  })

  await previous

  try {
    return await operation()
  } finally {
    release()
  }
}

async function getStorageData(): Promise<StorageData> {
  const result = await chrome.storage.local.get(['sessions', 'globalRules', 'stats', 'settings'])
  return {
    sessions: Array.isArray(result.sessions) ? result.sessions : [],
    globalRules: Array.isArray(result.globalRules) ? result.globalRules : [],
    stats: (result.stats && typeof result.stats === 'object') ? result.stats as Stats : createDefaultStats(),
    settings: (result.settings && typeof result.settings === 'object') ? result.settings as Settings : {}
  }
}

export async function replaceStorageData(data: Partial<StorageData>): Promise<void> {
  await withStorageLock(async () => {
    await chrome.storage.local.set(data)
  })
}

function normalizeMotivationMessages(messages: unknown): string[] {
  if (!Array.isArray(messages)) {
    return []
  }

  return messages
    .filter((message): message is string => typeof message === 'string')
    .map(message => message.trim())
    .filter(Boolean)
}

type RuleInput = Partial<Rule> & { id?: string }
type SessionInput = Partial<Session> & { id?: string }

function toRuleValues(values: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(values)) {
    return [...fallback]
  }

  return values.filter((value): value is string => typeof value === 'string')
}

function toDaysOfWeek(daysOfWeek: unknown, fallback: number[] = []): number[] {
  if (!Array.isArray(daysOfWeek)) {
    return [...fallback]
  }

  return daysOfWeek.filter((day): day is number => typeof day === 'number')
}

function cloneRuleForStorage(rule: RuleInput, fallback?: Rule, defaultOrder = 0): Rule {
  return {
    id: (typeof rule.id === 'string' && rule.id.length > 0) ? rule.id : (fallback?.id ?? generateId()),
    name: typeof rule.name === 'string' ? rule.name : (fallback?.name ?? ''),
    type: rule.type ?? fallback?.type ?? 'blacklist_exact',
    value: typeof rule.value === 'string' ? rule.value : (fallback?.value ?? ''),
    values: toRuleValues(rule.values, fallback?.values ?? []),
    isRegex: typeof rule.isRegex === 'boolean' ? rule.isRegex : (fallback?.isRegex ?? false),
    enabled: typeof rule.enabled === 'boolean' ? rule.enabled : (fallback?.enabled ?? true),
    order: typeof rule.order === 'number' ? rule.order : (fallback?.order ?? defaultOrder),
    skipRemaining: typeof rule.skipRemaining === 'boolean' ? rule.skipRemaining : (fallback?.skipRemaining ?? false),
    searchInUrl: typeof rule.searchInUrl === 'boolean' ? rule.searchInUrl : (fallback?.searchInUrl ?? false),
    searchInHeading: typeof rule.searchInHeading === 'boolean' ? rule.searchInHeading : (fallback?.searchInHeading ?? false),
    searchInBody: typeof rule.searchInBody === 'boolean' ? rule.searchInBody : (fallback?.searchInBody ?? true),
    message: typeof rule.message === 'string' ? rule.message : (fallback?.message ?? '')
  }
}

function cloneRulesForStorage(rules: RuleInput[] | undefined, fallbackRules: Rule[] = []): Rule[] {
  if (!Array.isArray(rules)) {
    return fallbackRules.map((rule, index) => cloneRuleForStorage({ ...rule, order: index }, rule, index))
  }

  const fallbackById = new Map(fallbackRules.map(rule => [rule.id, rule]))
  return rules.map((rule, index) => {
    const fallback = (typeof rule.id === 'string' && rule.id.length > 0)
      ? fallbackById.get(rule.id)
      : undefined

    return cloneRuleForStorage({ ...rule, order: index }, fallback, index)
  })
}

function cloneSessionForStorage(session: SessionInput, fallback?: Session, defaultOrder = 0): Session {
  return {
    id: (typeof session.id === 'string' && session.id.length > 0) ? session.id : (fallback?.id ?? generateId()),
    name: typeof session.name === 'string' ? session.name : (fallback?.name ?? ''),
    startTime: typeof session.startTime === 'string' ? session.startTime : (fallback?.startTime ?? '09:00'),
    endTime: typeof session.endTime === 'string' ? session.endTime : (fallback?.endTime ?? '17:00'),
    daysOfWeek: toDaysOfWeek(session.daysOfWeek, fallback?.daysOfWeek ?? []),
    enabled: typeof session.enabled === 'boolean' ? session.enabled : (fallback?.enabled ?? true),
    rules: cloneRulesForStorage(
      Array.isArray(session.rules) ? session.rules : undefined,
      fallback?.rules ?? []
    ),
    message: typeof session.message === 'string' ? session.message : (fallback?.message ?? ''),
    order: typeof session.order === 'number' ? session.order : (fallback?.order ?? defaultOrder)
  }
}

function cloneSessionsForStorage(sessions: SessionInput[] | undefined, fallbackSessions: Session[] = []): Session[] {
  if (!Array.isArray(sessions)) {
    return fallbackSessions.map((session, index) => cloneSessionForStorage({ ...session, order: index }, session, index))
  }

  const fallbackById = new Map(fallbackSessions.map(session => [session.id, session]))
  return sessions.map((session, index) => {
    const fallback = (typeof session.id === 'string' && session.id.length > 0)
      ? fallbackById.get(session.id)
      : undefined

    return cloneSessionForStorage({ ...session, order: index }, fallback, index)
  })
}

async function writeSessions(sessions: SessionInput[], fallbackSessions: Session[] = []): Promise<Session[]> {
  const clonedSessions = cloneSessionsForStorage(sessions, fallbackSessions)
  await chrome.storage.local.set({ sessions: clonedSessions })
  return clonedSessions
}

async function writeGlobalRules(rules: RuleInput[], fallbackRules: Rule[] = []): Promise<Rule[]> {
  const clonedRules = cloneRulesForStorage(rules, fallbackRules)
  await chrome.storage.local.set({ globalRules: clonedRules })
  return clonedRules
}

function normalizeRule(rule: Rule): Rule {
  return {
    ...rule,
    values: toRuleValues(rule.values),
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

function normalizeStats(stats: unknown): { stats: Stats; shouldPersist: boolean } {
  const currentWeekStart = getWeekStartDate()

  if (!stats || typeof stats !== 'object') {
    return { stats: createDefaultStats(), shouldPersist: true }
  }

  const rawStats = stats as Partial<Stats>
  if (rawStats.weekStartDate !== currentWeekStart) {
    return {
      stats: {
        blocksThisWeek: 0,
        weekStartDate: currentWeekStart,
        blockHistory: []
      },
      shouldPersist: true
    }
  }

  const blockHistory = Array.isArray(rawStats.blockHistory)
    ? rawStats.blockHistory.filter((event): event is BlockEvent => (
      !!event &&
      typeof event === 'object' &&
      typeof event.url === 'string' &&
      typeof event.reason === 'string' &&
      typeof event.timestamp === 'number' &&
      typeof event.ruleName === 'string'
    ))
    : []

  const normalizedStats: Stats = {
    blocksThisWeek: typeof rawStats.blocksThisWeek === 'number' ? rawStats.blocksThisWeek : 0,
    weekStartDate: currentWeekStart,
    blockHistory: blockHistory.slice(-100)
  }

  const shouldPersist =
    normalizedStats.blocksThisWeek !== rawStats.blocksThisWeek ||
    normalizedStats.blockHistory.length !== blockHistory.length ||
    !Array.isArray(rawStats.blockHistory)

  return { stats: normalizedStats, shouldPersist }
}

async function getCurrentStatsForStorage(): Promise<Stats> {
  const result = await chrome.storage.local.get(['stats'])
  const { stats, shouldPersist } = normalizeStats(result.stats)

  if (shouldPersist) {
    await chrome.storage.local.set({ stats })
  }

  return stats
}

export async function getSessions(): Promise<Session[]> {
  const data = await getStorageData()
  return data.sessions
    .map((session, index) => ({
      ...session,
      daysOfWeek: toDaysOfWeek(session.daysOfWeek),
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

export async function saveSession(session: SessionInput): Promise<Session> {
  return withStorageLock(async () => {
    const sessions = await getSessions()
    const existingIndex = (typeof session.id === 'string' && session.id.length > 0)
      ? sessions.findIndex(s => s.id === session.id)
      : -1
    const existingSession = existingIndex >= 0 ? sessions[existingIndex] : undefined
    const savedSession = cloneSessionForStorage(session, existingSession, sessions.length)

    if (existingIndex >= 0) {
      sessions[existingIndex] = savedSession
    } else {
      sessions.push(savedSession)
    }

    const storedSessions = await writeSessions(sessions, sessions)
    return storedSessions.find(s => s.id === savedSession.id) ?? savedSession
  })
}

export async function saveSessions(sessions: Session[]): Promise<void> {
  await withStorageLock(async () => {
    const existingSessions = await getSessions()
    await writeSessions(sessions, existingSessions)
  })
}

export async function deleteSession(id: string): Promise<void> {
  await withStorageLock(async () => {
    const sessions = await getSessions()
    const filtered = sessions.filter(s => s.id !== id)
    await writeSessions(filtered, sessions)
  })
}

export async function getGlobalRules(): Promise<Rule[]> {
  const data = await getStorageData()
  return data.globalRules.map(normalizeRule)
}

export async function saveGlobalRules(rules: Rule[]): Promise<void> {
  await withStorageLock(async () => {
    const existingRules = await getGlobalRules()
    await writeGlobalRules(rules, existingRules)
  })
}

export async function addGlobalRule(rule: RuleInput): Promise<Rule> {
  return withStorageLock(async () => {
    const rules = await getGlobalRules()
    const existingIndex = (typeof rule.id === 'string' && rule.id.length > 0)
      ? rules.findIndex(r => r.id === rule.id)
      : -1
    const existingRule = existingIndex >= 0 ? rules[existingIndex] : undefined
    const savedRule = cloneRuleForStorage(rule, existingRule, existingRule?.order ?? rules.length)

    if (existingIndex >= 0) {
      rules[existingIndex] = savedRule
    } else {
      rules.push(savedRule)
    }

    const storedRules = await writeGlobalRules(rules, rules)
    return storedRules.find(r => r.id === savedRule.id) ?? savedRule
  })
}

export async function deleteGlobalRule(id: string): Promise<void> {
  await withStorageLock(async () => {
    const rules = await getGlobalRules()
    const filtered = rules.filter(r => r.id !== id)
    await writeGlobalRules(filtered, rules)
  })
}

export async function getStats(): Promise<Stats> {
  return withStorageLock(async () => getCurrentStatsForStorage())
}

export async function incrementBlockCount(event: BlockEvent): Promise<Stats> {
  return withStorageLock(async () => {
    const stats = await getCurrentStatsForStorage()
    stats.blocksThisWeek += 1
    stats.blockHistory.push(event)

    if (stats.blockHistory.length > 100) {
      stats.blockHistory = stats.blockHistory.slice(-100)
    }

    await chrome.storage.local.set({ stats })
    return stats
  })
}

export async function resetWeeklyStats(): Promise<void> {
  await replaceStorageData({ stats: createDefaultStats() })
}

export async function addRuleToSession(
  sessionId: string,
  rule: RuleInput
): Promise<Rule> {
  return withStorageLock(async () => {
    const sessions = await getSessions()
    const session = sessions.find(s => s.id === sessionId)
    if (!session) throw new Error('Session not found')

    const existingIndex = (typeof rule.id === 'string' && rule.id.length > 0)
      ? session.rules.findIndex(r => r.id === rule.id)
      : -1
    const existingRule = existingIndex >= 0 ? session.rules[existingIndex] : undefined
    const savedRule = cloneRuleForStorage(rule, existingRule, existingRule?.order ?? session.rules.length)

    if (existingIndex >= 0) {
      session.rules[existingIndex] = savedRule
    } else {
      session.rules.push(savedRule)
    }

    const storedSessions = await writeSessions(sessions, sessions)
    const storedSession = storedSessions.find(s => s.id === sessionId)
    return storedSession?.rules.find(r => r.id === savedRule.id) ?? savedRule
  })
}

export async function deleteRuleFromSession(sessionId: string, ruleId: string): Promise<void> {
  await withStorageLock(async () => {
    const sessions = await getSessions()
    const session = sessions.find(s => s.id === sessionId)
    if (!session) throw new Error('Session not found')

    session.rules = session.rules.filter(r => r.id !== ruleId)
    await writeSessions(sessions, sessions)
  })
}

export async function updateSessionRules(sessionId: string, rules: Rule[]): Promise<void> {
  await withStorageLock(async () => {
    const sessions = await getSessions()
    const sessionIndex = sessions.findIndex(s => s.id === sessionId)
    if (sessionIndex === -1) throw new Error('Session not found')

    const existingSession = sessions[sessionIndex]
    sessions[sessionIndex] = {
      ...existingSession,
      rules: cloneRulesForStorage(rules, existingSession.rules)
    }

    await writeSessions(sessions, sessions)
  })
}

export async function getSettings(): Promise<Settings> {
  const data = await getStorageData()
  const settings = data.settings ?? {}

  const normalizedSettings: Settings = {
    globalMessage: typeof settings.globalMessage === 'string' ? settings.globalMessage : '',
    motivationMessages: normalizeMotivationMessages(settings.motivationMessages)
  }

  if (typeof settings.globalRulesEnabled === 'boolean') {
    normalizedSettings.globalRulesEnabled = settings.globalRulesEnabled
  }

  return normalizedSettings
}

export async function saveSettings(settings: Settings): Promise<void> {
  await withStorageLock(async () => {
    const existingSettings = await getSettings()
    const mergedSettings: Settings = {
      ...existingSettings,
      ...settings,
      globalMessage: typeof settings.globalMessage === 'string'
        ? settings.globalMessage
        : (existingSettings.globalMessage ?? ''),
      motivationMessages: normalizeMotivationMessages(
        settings.motivationMessages ?? existingSettings.motivationMessages
      )
    }

    if (typeof settings.globalRulesEnabled !== 'boolean' && typeof existingSettings.globalRulesEnabled !== 'boolean') {
      delete mergedSettings.globalRulesEnabled
    }

    await chrome.storage.local.set({ settings: mergedSettings })
  })
}

export async function getGlobalMessage(): Promise<string> {
  const settings = await getSettings()
  return settings.globalMessage || ''
}

export async function getMotivationMessages(): Promise<string[]> {
  const settings = await getSettings()
  return settings.motivationMessages ?? []
}
