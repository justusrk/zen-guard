import type { Rule, EvaluationResult, Session } from './types'
import { getActiveSession } from './session-manager'
import { getGlobalRules, getSettings } from './storage'
import { isTemporaryOverrideActiveForContext } from './temporary-overrides'

const isDev = import.meta.env.DEV
const log = (...args: unknown[]) => isDev && console.log('[ZenGuard]', ...args)

function urlMatchesPattern(url: string, pattern: string): boolean {
  try {
    const urlObj = new URL(url)
    const normalizedUrlHost = urlObj.hostname.replace(/^www\./, '').toLowerCase()
    const normalizedUrlPath = urlObj.pathname.replace(/\/$/, '')

    const normalizedPatternInput = pattern
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .toLowerCase()

    const slashIndex = normalizedPatternInput.indexOf('/')
    const patternHost = slashIndex >= 0
      ? normalizedPatternInput.slice(0, slashIndex)
      : normalizedPatternInput
    const patternPath = slashIndex >= 0
      ? normalizedPatternInput.slice(slashIndex)
      : ''

    if (!patternHost) return false

    const hostMatches =
      normalizedUrlHost === patternHost ||
      normalizedUrlHost.endsWith(`.${patternHost}`)

    if (!hostMatches) {
      return false
    }

    if (!patternPath) {
      return true
    }

    return normalizedUrlPath === patternPath || normalizedUrlPath.startsWith(`${patternPath}/`)
  } catch {
    return url.includes(pattern)
  }
}

function urlMatchesAny(url: string, rule: Rule): { matches: boolean; matchedValue?: string } {
  const values = Array.isArray(rule.values) && rule.values.length > 0 ? rule.values : [rule.value]
  log('Checking URL:', url, 'against patterns:', values)
  for (const pattern of values) {
    if (pattern) {
      const matches = urlMatchesPattern(url, pattern)
      log('Pattern:', pattern, 'matches:', matches)
      if (matches) {
        return { matches: true, matchedValue: pattern }
      }
    }
  }
  return { matches: false }
}

function channelMatchesAny(
  channel: string | undefined,
  channelId: string | undefined,
  rule: Rule
): { matches: boolean; matchedValue?: string } {
  const values = Array.isArray(rule.values) && rule.values.length > 0 ? rule.values : [rule.value]

  for (const pattern of values) {
    if (!pattern) continue
    const normalizedPattern = pattern.toLowerCase().trim()

    // Check against channel name
    if (channel) {
      const normalizedChannel = channel.toLowerCase().trim()
      if (normalizedChannel === normalizedPattern || normalizedChannel.includes(normalizedPattern)) {
        return { matches: true, matchedValue: pattern }
      }
    }

    // Check against channel ID (e.g., UCxxxx)
    if (channelId) {
      const normalizedChannelId = channelId.toLowerCase().trim()
      if (normalizedChannelId === normalizedPattern) {
        return { matches: true, matchedValue: pattern }
      }
      // Also check if pattern matches the handle format (@handle)
      if (normalizedChannelId.startsWith('@') && normalizedPattern.startsWith('@')) {
        if (normalizedChannelId === normalizedPattern) {
          return { matches: true, matchedValue: pattern }
        }
      }
      // Allow matching without @ prefix for handles
      if (normalizedChannelId.startsWith('@')) {
        const handleWithoutAt = normalizedChannelId.slice(1)
        if (handleWithoutAt === normalizedPattern || `@${normalizedPattern}` === normalizedChannelId) {
          return { matches: true, matchedValue: pattern }
        }
      }
    }
  }

  return { matches: false }
}

function contentContains(content: string | undefined, pattern: string, isRegex: boolean): boolean {
  if (!content) return false

  if (isRegex) {
    try {
      const regex = new RegExp(pattern, 'i')
      return regex.test(content)
    } catch {
      return content.toLowerCase().includes(pattern.toLowerCase())
    }
  }

  return content.toLowerCase().includes(pattern.toLowerCase())
}

function keywordMatchesLocations(
  rule: Rule,
  url: string,
  pageHeadings?: string,
  pageContent?: string
): boolean {
  const { value, isRegex, searchInUrl, searchInHeading, searchInBody } = rule

  if (searchInUrl && contentContains(url, value, isRegex)) {
    return true
  }

  if (searchInHeading && contentContains(pageHeadings, value, isRegex)) {
    return true
  }

  if (searchInBody && contentContains(pageContent, value, isRegex)) {
    return true
  }

  return false
}


export async function evaluateUrl(
  url: string,
  pageContent?: string,
  pageHeadings?: string,
  youtubeChannel?: string,
  youtubeChannelId?: string
): Promise<EvaluationResult> {
  const activeSession = await getActiveSession()
  const globalRules = await getGlobalRules()
  const settings = await getSettings()
  const globalRulesEnabled = settings.globalRulesEnabled ?? true

  const allRules: Rule[] = []

  if (activeSession) {
    const enabledSessionRules = activeSession.rules
      .filter(r => r.enabled)
      .sort((a, b) => a.order - b.order)
    allRules.push(...enabledSessionRules)
  }

  if (globalRulesEnabled) {
    const enabledGlobalRules = globalRules
      .filter(r => r.enabled)
      .sort((a, b) => a.order - b.order)
    allRules.push(...enabledGlobalRules)
  }

  let lastResult: EvaluationResult = { blocked: false, rule: null, session: activeSession }

  for (const rule of allRules) {
    switch (rule.type) {
      case 'whitelist_exact': {
        const match = urlMatchesAny(url, rule)
        if (match.matches) {
          const result: EvaluationResult = { blocked: false, rule, session: activeSession, reason: `URL whitelisted: ${match.matchedValue}` }
          if (rule.skipRemaining) {
            return result
          }
          lastResult = result
        }
        break
      }

      case 'blacklist_exact': {
        const match = urlMatchesAny(url, rule)
        if (match.matches) {
          if (await isTemporaryOverrideActiveForContext(rule, activeSession, settings)) {
            break
          }
          const result: EvaluationResult = { blocked: true, rule, session: activeSession, reason: `URL blocked: ${match.matchedValue}` }
          if (rule.skipRemaining) {
            return result
          }
          lastResult = result
        }
        break
      }

      case 'whitelist_keyword':
        if (keywordMatchesLocations(rule, url, pageHeadings, pageContent)) {
          const result: EvaluationResult = { blocked: false, rule, session: activeSession, reason: 'Keyword whitelisted' }
          if (rule.skipRemaining) {
            return result
          }
          lastResult = result
        }
        break

      case 'blacklist_keyword':
        if (keywordMatchesLocations(rule, url, pageHeadings, pageContent)) {
          if (await isTemporaryOverrideActiveForContext(rule, activeSession, settings)) {
            break
          }
          const result: EvaluationResult = { blocked: true, rule, session: activeSession, reason: 'Keyword blocked' }
          if (rule.skipRemaining) {
            return result
          }
          lastResult = result
        }
        break

      case 'yt_channel_whitelist': {
        const match = channelMatchesAny(youtubeChannel, youtubeChannelId, rule)
        if (match.matches) {
          const result: EvaluationResult = { blocked: false, rule, session: activeSession, reason: `YouTube channel whitelisted: ${match.matchedValue}` }
          if (rule.skipRemaining) {
            return result
          }
          lastResult = result
        }
        break
      }

      case 'yt_channel_blacklist': {
        const match = channelMatchesAny(youtubeChannel, youtubeChannelId, rule)
        if (match.matches) {
          if (await isTemporaryOverrideActiveForContext(rule, activeSession, settings)) {
            break
          }
          const result: EvaluationResult = { blocked: true, rule, session: activeSession, reason: `YouTube channel blocked: ${match.matchedValue}` }
          if (rule.skipRemaining) {
            return result
          }
          lastResult = result
        }
        break
      }
    }
  }

  return lastResult
}

export async function evaluateUrlOnly(url: string): Promise<EvaluationResult> {
  const activeSession = await getActiveSession()
  const globalRules = await getGlobalRules()
  const settings = await getSettings()
  const globalRulesEnabled = settings.globalRulesEnabled ?? true

  log('Active session:', activeSession?.name || 'none')
  log('Global rules count:', globalRules.length)
  log('Global rules enabled:', globalRulesEnabled)

  const allRules: Rule[] = []

  if (activeSession) {
    const enabledSessionRules = activeSession.rules
      .filter(r => r.enabled)
      .filter(r => r.type === 'blacklist_exact' || r.type === 'whitelist_exact')
      .sort((a, b) => a.order - b.order)
    allRules.push(...enabledSessionRules)
    log('Session rules:', enabledSessionRules.map(r => ({ name: r.name, values: r.values, value: r.value })))
  }

  if (globalRulesEnabled) {
    const enabledGlobalRules = globalRules
      .filter(r => r.enabled)
      .filter(r => r.type === 'blacklist_exact' || r.type === 'whitelist_exact')
      .sort((a, b) => a.order - b.order)
    allRules.push(...enabledGlobalRules)
    log('Global URL rules:', enabledGlobalRules.map(r => ({ name: r.name, values: r.values, value: r.value })))
  }

  let lastResult: EvaluationResult = { blocked: false, rule: null, session: activeSession }

  for (const rule of allRules) {
    if (rule.type === 'whitelist_exact') {
      const match = urlMatchesAny(url, rule)
      if (match.matches) {
        const result: EvaluationResult = { blocked: false, rule, session: activeSession, reason: `URL whitelisted: ${match.matchedValue}` }
        if (rule.skipRemaining) {
          return result
        }
        lastResult = result
      }
    }
    if (rule.type === 'blacklist_exact') {
      const match = urlMatchesAny(url, rule)
      if (match.matches) {
        if (await isTemporaryOverrideActiveForContext(rule, activeSession, settings)) {
          continue
        }
        const result: EvaluationResult = { blocked: true, rule, session: activeSession, reason: `URL blocked: ${match.matchedValue}` }
        if (rule.skipRemaining) {
          return result
        }
        lastResult = result
      }
    }
  }

  return lastResult
}

export function getRulesForSession(session: Session | null, globalRules: Rule[]): Rule[] {
  const allRules: Rule[] = []

  if (session) {
    allRules.push(...session.rules.filter(r => r.enabled).sort((a, b) => a.order - b.order))
  }

  allRules.push(...globalRules.filter(r => r.enabled).sort((a, b) => a.order - b.order))

  return allRules
}
