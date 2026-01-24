import type { Session, Rule, Settings } from './types'
import { getSessions, getGlobalRules, getSettings } from './storage'

const isDev = import.meta.env.DEV
const log = (...args: unknown[]) => isDev && console.log('[ZenGuard]', ...args)

export interface ConfigExport {
  version: string
  exportedAt: string
  sessions: Session[]
  globalRules: Rule[]
  settings?: Settings
}

export async function exportConfig(): Promise<void> {
  const sessions = await getSessions()
  const globalRules = await getGlobalRules()
  const settings = await getSettings()

  const config: ConfigExport = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    sessions,
    globalRules,
    settings
  }

  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const date = new Date().toISOString().split('T')[0]
  const filename = `zen-guard-config-${date}.json`

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function validateConfig(data: unknown): data is ConfigExport {
  if (typeof data !== 'object' || data === null) {
    log('Validation: not an object')
    return false
  }

  const obj = data as Record<string, unknown>

  if (typeof obj.version !== 'string') {
    log('Validation: missing version')
    return false
  }

  if (!Array.isArray(obj.sessions)) {
    log('Validation: sessions not an array')
    return false
  }

  if (!Array.isArray(obj.globalRules)) {
    log('Validation: globalRules not an array')
    return false
  }

  for (let i = 0; i < obj.sessions.length; i++) {
    if (!isValidSession(obj.sessions[i])) {
      log('Validation: invalid session at index', i, obj.sessions[i])
      return false
    }
  }

  for (let i = 0; i < obj.globalRules.length; i++) {
    if (!isValidRule(obj.globalRules[i])) {
      log('Validation: invalid rule at index', i, obj.globalRules[i])
      return false
    }
  }

  return true
}

function isValidSession(session: unknown): session is Session {
  if (typeof session !== 'object' || session === null) {
    return false
  }

  const s = session as Record<string, unknown>

  // Only require name - other fields will be normalized
  return typeof s.name === 'string'
}

function isValidRule(rule: unknown): rule is Rule {
  if (typeof rule !== 'object' || rule === null) {
    return false
  }

  const r = rule as Record<string, unknown>

  // Only require name and type - other fields will be normalized
  return typeof r.name === 'string' && typeof r.type === 'string'
}

function normalizeRule(rule: Rule): Rule {
  return {
    id: rule.id || crypto.randomUUID(),
    name: rule.name || 'Unnamed Rule',
    type: rule.type,
    value: rule.value || '',
    values: Array.isArray(rule.values) ? [...rule.values] : [],
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

function normalizeSession(session: Session, index: number): Session {
  return {
    id: session.id || crypto.randomUUID(),
    name: session.name || 'Unnamed Session',
    startTime: session.startTime || '09:00',
    endTime: session.endTime || '17:00',
    daysOfWeek: Array.isArray(session.daysOfWeek) ? [...session.daysOfWeek] : [1, 2, 3, 4, 5],
    enabled: session.enabled ?? true,
    rules: Array.isArray(session.rules) ? session.rules.map(normalizeRule) : [],
    message: session.message ?? '',
    order: session.order ?? index
  }
}

function normalizeSettings(settings: Settings | undefined): Settings {
  return {
    globalMessage: settings?.globalMessage ?? '',
    motivationMessages: Array.isArray(settings?.motivationMessages) ? settings.motivationMessages : []
  }
}

export async function importConfig(file: File): Promise<void> {
  log('Starting import...')
  const text = await file.text()
  log('File content length:', text.length)

  let data: unknown

  try {
    data = JSON.parse(text)
    log('Parsed JSON:', data)
  } catch (e) {
    log('JSON parse error:', e)
    throw new Error('Invalid JSON file')
  }

  if (!validateConfig(data)) {
    log('Validation failed for:', data)
    throw new Error('Invalid configuration format')
  }

  log('Validation passed, normalizing...')

  // Normalize all data before saving to ensure proper structure
  const normalizedSessions = data.sessions.map(normalizeSession)
  const normalizedGlobalRules = data.globalRules.map(normalizeRule)
  const normalizedSettings = normalizeSettings(data.settings)

  log('Normalized sessions:', normalizedSessions)
  log('Normalized global rules:', normalizedGlobalRules)
  log('Normalized settings:', normalizedSettings)

  // Clear existing data and replace with imported data
  await chrome.storage.local.set({
    sessions: normalizedSessions,
    globalRules: normalizedGlobalRules,
    settings: normalizedSettings
  })

  log('Import complete!')
}
