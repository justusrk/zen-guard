<script lang="ts">
  import { inspiringMessages } from '@/lib/messages'
  import { getActiveSession, getTimeRemainingInSession, formatMinutes } from '@/lib/session-manager'
  import { getMotivationMessages } from '@/lib/storage'
  import type { Session } from '@/lib/types'

  let inspiringMessage = $state('')
  let blockedUrl = $state('')
  let ruleName = $state('')
  let reason = $state('')
  let customMessage = $state('')
  let activeSession = $state<Session | null>(null)
  let timeRemaining = $state('')

  function getRandomFromList(messages: string[]): string {
    if (messages.length === 0) return ''
    const index = Math.floor(Math.random() * messages.length)
    return messages[index]
  }

  function parseUrlParams() {
    const params = new URLSearchParams(window.location.search)
    blockedUrl = params.get('url') || 'Unknown'
    ruleName = params.get('rule') || 'Unknown rule'
    reason = params.get('reason') || 'Blocked by Zen Guard'
    customMessage = params.get('message') || ''
  }

  async function loadSessionInfo() {
    try {
      activeSession = await getActiveSession()
      if (activeSession) {
        const remaining = getTimeRemainingInSession(activeSession)
        timeRemaining = formatMinutes(remaining)
      }
    } catch {
      // Session info not available
    }
  }

  async function loadInspiringMessage() {
    try {
      const messages = await getMotivationMessages()
      // Use user's messages if they have any, otherwise fall back to defaults
      if (messages.length > 0) {
        inspiringMessage = getRandomFromList(messages)
      } else {
        inspiringMessage = getRandomFromList(inspiringMessages)
      }
    } catch {
      // Fall back to default messages
      inspiringMessage = getRandomFromList(inspiringMessages)
    }
  }

  function getDisplayUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname + urlObj.pathname
    } catch {
      return url
    }
  }

  $effect(() => {
    parseUrlParams()
    loadSessionInfo()
    loadInspiringMessage()

    const interval = setInterval(() => {
      loadSessionInfo()
    }, 60000)

    return () => clearInterval(interval)
  })
</script>

<div class="container">
  <div class="content">
    <div class="message-section">
      {#if customMessage}
        <p class="custom-message">{customMessage}</p>
      {/if}
      <p class="inspiring-message">{inspiringMessage}</p>
    </div>

    <div class="info-section">
      {#if activeSession}
        <div class="session-info">
          <span class="session-label">Zen Window:</span>
          <span class="session-name">{activeSession.name}</span>
          {#if timeRemaining}
            <span class="time-remaining">({timeRemaining} remaining)</span>
          {/if}
        </div>
      {/if}

      <div class="block-info">
        <p class="blocked-url" title={blockedUrl}>{getDisplayUrl(blockedUrl)}</p>
        <p class="block-reason">Blocked by: {ruleName}</p>
      </div>
    </div>
  </div>
</div>

<style>
  .container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .content {
    max-width: 800px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4rem;
  }

  .message-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2rem;
  }

  .custom-message {
    font-size: 3rem;
    font-weight: 400;
    line-height: 1.3;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    text-align: center;
  }

  .inspiring-message {
    font-size: 2rem;
    font-weight: 300;
    line-height: 1.4;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    opacity: 0.85;
  }

  .info-section {
    opacity: 0.8;
  }

  .session-info {
    margin-bottom: 1rem;
    font-size: 1rem;
  }

  .session-label {
    opacity: 0.7;
  }

  .session-name {
    font-weight: 500;
    margin-left: 0.5rem;
  }

  .time-remaining {
    opacity: 0.7;
    margin-left: 0.5rem;
  }

  .block-info {
    font-size: 0.875rem;
    opacity: 0.6;
  }

  .blocked-url {
    max-width: 400px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 0.25rem;
  }

  .block-reason {
    font-size: 0.75rem;
  }
</style>
