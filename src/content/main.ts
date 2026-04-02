import { isYouTubeVideoPage, isYouTubeChannelPage, getYouTubeChannel, getYouTubeChannelId, extractChannelFromUrl } from '@/lib/youtube'
import { waitForContent } from './scanner'
import type { ContentScanResult } from '@/lib/types'

function sendScanResult(result: ContentScanResult): void {
  chrome.runtime.sendMessage({ type: 'SCAN_RESULT', result })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'REDIRECT_TO_BLOCKED_PAGE' || typeof message.url !== 'string') {
    return false
  }

  window.location.replace(message.url)
  sendResponse({ ok: true })
  return false
})

function extractHeadings(): string {
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, title')
  return Array.from(headings)
    .map(h => h.textContent?.trim())
    .filter(Boolean)
    .join(' ')
}

async function scanPage(): Promise<void> {
  const url = window.location.href

  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    return
  }

  let youtubeChannel: string | undefined
  let youtubeChannelId: string | undefined

  if (isYouTubeVideoPage(url)) {
    await waitForYouTubeContent()
    const channel = getYouTubeChannel()
    if (channel) {
      youtubeChannel = channel
    }
    const channelId = getYouTubeChannelId()
    if (channelId) {
      youtubeChannelId = channelId
    }
  } else if (isYouTubeChannelPage(url)) {
    const channelFromUrl = extractChannelFromUrl(url)
    if (channelFromUrl) {
      youtubeChannel = channelFromUrl
      youtubeChannelId = channelFromUrl
    }
  }

  const pageContent = await waitForContent()
  const pageHeadings = extractHeadings()

  const result: ContentScanResult = {
    hasKeywordMatch: false,
    youtubeChannel,
    youtubeChannelId,
    pageHeadings,
    pageContent
  }

  sendScanResult(result)
}

function waitForYouTubeContent(): Promise<void> {
  return new Promise((resolve) => {
    let attempts = 0
    const maxAttempts = 20

    const check = () => {
      attempts++
      const channelElement = document.querySelector('#channel-name a, ytd-channel-name a')
      if (channelElement || attempts >= maxAttempts) {
        resolve()
      } else {
        setTimeout(check, 250)
      }
    }

    if (document.readyState === 'complete') {
      setTimeout(check, 500)
    } else {
      window.addEventListener('load', () => setTimeout(check, 500), { once: true })
    }
  })
}

let scanTimeout: number | undefined

function scheduleScan(delay: number): void {
  if (scanTimeout) {
    window.clearTimeout(scanTimeout)
  }

  scanTimeout = window.setTimeout(() => {
    void scanPage()
  }, delay)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    scheduleScan(100)
  })
} else {
  scheduleScan(100)
}

let lastUrl = window.location.href
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href
    scheduleScan(500)
  }
})

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
})
