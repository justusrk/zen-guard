import type { OverrideSettings, OverrideUsage, Rule, Session, Settings } from './types'
import {
  deleteOverrideUsageEntry,
  getGlobalRules,
  getOverrideUsageEntry,
  getSessions,
  getSettings,
  saveOverrideUsageEntry
} from './storage'

export interface TemporaryOverrideStatus {
  rule: Rule | null
  session: Session | null
  settings: OverrideSettings | null
  usage: OverrideUsage | null
  remainingMinutes: number
  activeUntil?: number
  active: boolean
  exhausted: boolean
}

type RuleContext = {
  rule: Rule | null
  session: Session | null
  settings: Settings
}

const MINUTE_MS = 60 * 1000

export function resolveEffectiveOverrideSettings(
  rule: Rule | null | undefined,
  session: Session | null | undefined,
  settings: Settings | null | undefined
): OverrideSettings | null {
  return rule?.overrideSettings ?? session?.overrideSettings ?? settings?.overrideDefaults ?? null
}

function getResetAt(usage: OverrideUsage, settings: OverrideSettings): number {
  return usage.windowStartedAt + (settings.resetIntervalMinutes * MINUTE_MS)
}

async function normalizeUsage(
  ruleId: string,
  usage: OverrideUsage | undefined,
  settings: OverrideSettings,
  now: number
): Promise<OverrideUsage | null> {
  if (!usage) {
    return null
  }

  const isActive = typeof usage.activeUntil === 'number' && usage.activeUntil > now
  if (isActive) {
    return usage
  }

  if (now >= getResetAt(usage, settings)) {
    await deleteOverrideUsageEntry(ruleId)
    return null
  }

  if (usage.activeUntil !== undefined) {
    const nextUsage = { ...usage }
    delete nextUsage.activeUntil
    await saveOverrideUsageEntry(nextUsage)
    return nextUsage
  }

  return usage
}

async function resolveRuleContext(ruleId: string, sessionId?: string): Promise<RuleContext> {
  const [sessions, globalRules, settings] = await Promise.all([
    getSessions(),
    getGlobalRules(),
    getSettings()
  ])

  const session = sessionId
    ? sessions.find(candidate => candidate.id === sessionId) ?? null
    : null

  if (session) {
    const sessionRule = session.rules.find(candidate => candidate.id === ruleId)
    if (sessionRule) {
      return { rule: sessionRule, session, settings }
    }
  }

  for (const candidate of sessions) {
    const sessionRule = candidate.rules.find(rule => rule.id === ruleId)
    if (sessionRule) {
      return { rule: sessionRule, session: session ?? candidate, settings }
    }
  }

  const globalRule = globalRules.find(candidate => candidate.id === ruleId) ?? null
  return { rule: globalRule, session, settings }
}

export async function getTemporaryOverrideStatusForContext(
  rule: Rule | null | undefined,
  session: Session | null | undefined,
  settings?: Settings
): Promise<TemporaryOverrideStatus> {
  const appSettings = settings ?? await getSettings()
  const effectiveSettings = resolveEffectiveOverrideSettings(rule, session, appSettings)

  if (!rule || !effectiveSettings || !effectiveSettings.enabled) {
    return {
      rule: rule ?? null,
      session: session ?? null,
      settings: effectiveSettings,
      usage: null,
      remainingMinutes: 0,
      active: false,
      exhausted: true
    }
  }

  const now = Date.now()
  const usage = await normalizeUsage(
    rule.id,
    await getOverrideUsageEntry(rule.id),
    effectiveSettings,
    now
  )
  const remainingMinutes = Math.max(0, effectiveSettings.maxOverrideMinutes - (usage?.usedMinutes ?? 0))
  const activeUntil = usage?.activeUntil
  const active = typeof activeUntil === 'number' && activeUntil > now

  return {
    rule,
    session: session ?? null,
    settings: effectiveSettings,
    usage,
    remainingMinutes,
    activeUntil,
    active,
    exhausted: remainingMinutes <= 0
  }
}

export async function getTemporaryOverrideStatus(ruleId: string, sessionId?: string): Promise<TemporaryOverrideStatus> {
  const context = await resolveRuleContext(ruleId, sessionId)
  return getTemporaryOverrideStatusForContext(context.rule, context.session, context.settings)
}

export async function isTemporaryOverrideActiveForContext(
  rule: Rule | null | undefined,
  session: Session | null | undefined,
  settings?: Settings
): Promise<boolean> {
  const status = await getTemporaryOverrideStatusForContext(rule, session, settings)
  return status.active
}

export async function grantTemporaryOverride(ruleId: string, sessionId?: string): Promise<TemporaryOverrideStatus> {
  const context = await resolveRuleContext(ruleId, sessionId)

  if (!context.rule) {
    throw new Error('Rule not found')
  }

  return grantTemporaryOverrideForContext(context.rule, context.session, context.settings)
}

export async function grantTemporaryOverrideForContext(
  rule: Rule,
  session: Session | null | undefined,
  settings?: Settings
): Promise<TemporaryOverrideStatus> {
  const status = await getTemporaryOverrideStatusForContext(rule, session, settings)

  if (!status.settings || !status.settings.enabled) {
    throw new Error('Temporary unblock is disabled for this rule')
  }

  if (status.remainingMinutes <= 0) {
    throw new Error('No temporary unblock time remaining')
  }

  if (status.active) {
    return status
  }

  const now = Date.now()
  await saveOverrideUsageEntry({
    ruleId: rule.id,
    windowStartedAt: status.usage?.windowStartedAt ?? now,
    usedMinutes: status.settings.maxOverrideMinutes,
    activeUntil: now + (status.remainingMinutes * MINUTE_MS)
  })

  return getTemporaryOverrideStatusForContext(rule, session, settings)
}
