import type { ContentScanResult, BlockEvent, EvaluationResult } from '@/lib/types'
import { evaluateUrl, evaluateUrlOnly } from '@/lib/rules-engine'
import { getActiveSession } from '@/lib/session-manager'
import { getStats, incrementBlockCount, getGlobalMessage } from '@/lib/storage'
import { isYouTubeVideoPage, isYouTubeChannelPage, extractChannelFromUrl } from '@/lib/youtube'

const isDev = import.meta.env.DEV
const log = (...args: unknown[]) => isDev && console.log('[ZenGuard]', ...args)

log('Service worker starting...')

const pendingScans = new Map<number, { url: string }>()

type TabNavigation = { url: string; previousUrl?: string; blocked?: boolean }
const navigationTasks = new Map<number, Promise<unknown>>()

// Session storage survives service-worker suspension without saving browsing history to disk.
function withNavigation<T>(tabId: number, action: (key: string) => Promise<T>): Promise<T> {
  const previous = navigationTasks.get(tabId) ?? Promise.resolve()
  const task = previous.catch(() => {}).then(() => action(`navigation:${tabId}`))
  navigationTasks.set(tabId, task)
  void task.finally(() => {
    if (navigationTasks.get(tabId) === task) navigationTasks.delete(tabId)
  }).catch(() => {})
  return task
}

async function recordNavigation(tabId: number, url: string): Promise<void> {
  // Keep the original destination when the block page loads or reloads.
  if (url.startsWith(chrome.runtime.getURL('src/blocked/index.html'))) return

  await withNavigation(tabId, async key => {
    const stored = await chrome.storage.session.get(key)
    const previous = stored[key] as TabNavigation | undefined
    if (previous?.url === url) return

    const navigation: TabNavigation = {
      url,
      previousUrl: previous?.blocked ? previous.previousUrl : previous?.url
    }
    await chrome.storage.session.set({ [key]: navigation })
  })
}

async function getReturnUrl(tabId: number): Promise<string | undefined> {
  return withNavigation(tabId, async key => {
    const stored = await chrome.storage.session.get(key)
    const navigation = stored[key] as TabNavigation | undefined
    if (!navigation) return undefined

    await chrome.storage.session.set({ [key]: { ...navigation, blocked: true } })
    const previousUrl = navigation.previousUrl
    return previousUrl && /^https?:\/\//i.test(previousUrl) ? previousUrl : undefined
  })
}

chrome.tabs.onRemoved.addListener(async tabId => {
  pendingScans.delete(tabId)
  await withNavigation(tabId, key => chrome.storage.session.remove(key))
})

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function redirectToBlockedPage(tabId: number, blockedPageUrl: string): Promise<void> {
  const returnUrl = await getReturnUrl(tabId)
  if (returnUrl) {
    const destination = new URL(blockedPageUrl)
    destination.searchParams.set('returnUrl', returnUrl)
    blockedPageUrl = destination.href
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'REDIRECT_TO_BLOCKED_PAGE',
        url: blockedPageUrl,
      })
      return
    } catch (error) {
      log('Redirect message failed', { tabId, attempt, error })
      await sleep(50)
    }
  }

  await chrome.tabs.update(tabId, { url: blockedPageUrl })
}

function getBlockedPageUrl(
  blockedUrl: string,
  ruleId: string,
  ruleName: string,
  reason: string,
  sessionId?: string,
  message?: string
): string {
  const params = new URLSearchParams({
    url: blockedUrl,
    ruleId,
    rule: ruleName,
    reason: reason
  })
  if (sessionId) {
    params.set('sessionId', sessionId)
  }
  if (message) {
    params.set('message', message)
  }
  return chrome.runtime.getURL(`src/blocked/index.html?${params.toString()}`)
}

async function getBlockMessage(result: EvaluationResult): Promise<string> {
  // Priority 1: Rule message
  if (result.rule?.message) return result.rule.message

  // Priority 2: Session message
  if (result.session?.message) return result.session.message

  // Priority 3: Global message
  return await getGlobalMessage()
}

async function handleNavigation(tabId: number, url: string): Promise<void> {
  await recordNavigation(tabId, url)

  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
    return
  }

  log('Checking URL:', url)
  const result = await evaluateUrlOnly(url)
  log('Evaluation result:', result)

  if (result.blocked && result.rule) {
    const blockEvent: BlockEvent = {
      url,
      reason: result.reason || 'Blocked by rule',
      timestamp: Date.now(),
      ruleName: result.rule.name
    }
    await incrementBlockCount(blockEvent)

    const message = await getBlockMessage(result)
    const blockedPageUrl = getBlockedPageUrl(
      url,
      result.rule.id,
      result.rule.name,
      result.reason || 'Blocked',
      result.session?.id,
      message
    )
    await redirectToBlockedPage(tabId, blockedPageUrl)
    return
  }

  // For YouTube channel pages, extract channel from URL and evaluate immediately
  if (isYouTubeChannelPage(url)) {
    log('YouTube channel page detected:', url)
    const channelFromUrl = extractChannelFromUrl(url)
    if (channelFromUrl) {
      const channelResult = await evaluateUrl(url, undefined, undefined, channelFromUrl, channelFromUrl)
      if (channelResult.blocked && channelResult.rule) {
        const blockEvent: BlockEvent = {
          url,
          reason: channelResult.reason || 'Blocked by rule',
          timestamp: Date.now(),
          ruleName: channelResult.rule.name
        }
        await incrementBlockCount(blockEvent)
        const message = await getBlockMessage(channelResult)
        const blockedPageUrl = getBlockedPageUrl(
          url,
          channelResult.rule.id,
          channelResult.rule.name,
          channelResult.reason || 'Blocked',
          channelResult.session?.id,
          message
        )
        await redirectToBlockedPage(tabId, blockedPageUrl)
        return
      }
    }
    // Also wait for content script in case of SPA navigation
    pendingScans.set(tabId, { url })
  }

  // For YouTube video pages, wait for content script to send channel info
  if (isYouTubeVideoPage(url)) {
    log('YouTube video page detected, waiting for content script:', url)
    pendingScans.set(tabId, { url })
  }
}

log('Setting up webNavigation listener...')

chrome.webNavigation.onCommitted.addListener(async (details) => {
  log('Navigation event:', details.url, 'frameId:', details.frameId)
  if (details.frameId !== 0) return
  if (details.transitionType === 'auto_subframe') return

  await handleNavigation(details.tabId, details.url)
})

// Handle SPA navigation (History API)
chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
  log('History state updated:', details.url, 'frameId:', details.frameId)
  if (details.frameId !== 0) return

  await handleNavigation(details.tabId, details.url)
})

log('Service worker ready')

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCAN_RESULT' && sender.tab?.id && sender.tab?.url) {
    const tabId = sender.tab.id
    const tabUrl = sender.tab.url
    const pending = pendingScans.get(tabId)
    const scanResult = message.result as ContentScanResult

    // Use pending URL if available, otherwise use current tab URL
    const url = pending?.url || tabUrl

    log('SCAN_RESULT received:', { url, channel: scanResult.youtubeChannel, channelId: scanResult.youtubeChannelId })

    evaluateUrl(url, scanResult.pageContent, scanResult.pageHeadings, scanResult.youtubeChannel, scanResult.youtubeChannelId).then(async (result) => {
      log('Channel evaluation result:', result)
      if (result.blocked && result.rule) {
        const blockEvent: BlockEvent = {
          url,
          reason: result.reason || 'Blocked by rule',
          timestamp: Date.now(),
          ruleName: result.rule.name
        }
        await incrementBlockCount(blockEvent)

        const blockMessage = await getBlockMessage(result)
        const blockedPageUrl = getBlockedPageUrl(
          url,
          result.rule.id,
          result.rule.name,
          result.reason || 'Blocked',
          result.session?.id,
          blockMessage
        )
        await redirectToBlockedPage(tabId, blockedPageUrl)
      }
      pendingScans.delete(tabId)
    })

    return true
  }

  if (message.type === 'GET_STATUS') {
    Promise.all([getActiveSession(), getStats()]).then(([activeSession, stats]) => {
      sendResponse({ activeSession, stats })
    })
    return true
  }

  if (message.type === 'KEYWORD_BLOCK' && sender.tab?.id) {
    const { url, keyword, ruleName, ruleMessage, sessionMessage } = message
    const blockEvent: BlockEvent = {
      url,
      reason: `Keyword "${keyword}" found`,
      timestamp: Date.now(),
      ruleName
    }

    incrementBlockCount(blockEvent).then(async () => {
      // Priority: rule message > session message > global message
      let blockMessage = ruleMessage || sessionMessage || ''
      if (!blockMessage) {
        blockMessage = await getGlobalMessage()
      }
      const blockedPageUrl = getBlockedPageUrl(
        url,
        message.ruleId,
        ruleName,
        `Keyword "${keyword}" blocked`,
        message.sessionId,
        blockMessage
      )
      await redirectToBlockedPage(sender.tab!.id!, blockedPageUrl)
    })
    return true
  }

  return false
})

chrome.alarms.create('weeklyReset', {
  periodInMinutes: 60
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'weeklyReset') {
    await getStats()
  }
})

chrome.runtime.onInstalled.addListener(() => {
  log('Extension installed')
})
