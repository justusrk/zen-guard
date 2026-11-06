<script lang="ts">
  import { onMount } from 'svelte'
  import { inspiringMessages } from '@/lib/messages'
  import { getActiveSession, getTimeRemainingInSession, formatMinutes } from '@/lib/session-manager'
  import { getMotivationMessages } from '@/lib/storage'
  import { getTemporaryOverrideStatus, grantTemporaryOverride, type TemporaryOverrideStatus } from '@/lib/temporary-overrides'
  import type { Session } from '@/lib/types'

  let inspiringMessage = $state('')
  let challengeQuote = $state('')
  let blockedUrl = $state('')
  let returnUrl = $state('')
  let ruleId = $state('')
  let sessionId = $state('')
  let ruleName = $state('')
  let reason = $state('')
  let customMessage = $state('')
  let activeSession = $state<Session | null>(null)
  let timeRemaining = $state('')
  let overrideStatus = $state<TemporaryOverrideStatus | null>(null)
  let loadingOverride = $state(true)
  let overrideError = $state('')
  let granting = $state(false)
  let requestStep = $state<'idle' | 'countdown' | 'quote'>('idle')
  let countdownRemaining = $state(10)
  let quoteInput = $state('')
  let countdownTimer: number | null = null

  const canSubmitQuote = $derived(
    challengeQuote.length > 0 && quoteInput === challengeQuote
  )

  function getRandomFromList(messages: string[]): string {
    if (messages.length === 0) return ''
    const index = Math.floor(Math.random() * messages.length)
    return messages[index]
  }

  function parseUrlParams() {
    const params = new URLSearchParams(window.location.search)
    blockedUrl = params.get('url') || 'Unknown'
    try {
      const destination = new URL(params.get('returnUrl') || '')
      if (['http:', 'https:'].includes(destination.protocol) && destination.href !== blockedUrl) {
        returnUrl = destination.href
      }
    } catch {
      returnUrl = ''
    }
    ruleId = params.get('ruleId') || ''
    sessionId = params.get('sessionId') || ''
    ruleName = params.get('rule') || 'Unknown rule'
    reason = params.get('reason') || 'Blocked by Zen Guard'
    customMessage = params.get('message') || ''
  }

  async function loadSessionInfo() {
    try {
      activeSession = await getActiveSession()
      if (activeSession) {
        timeRemaining = formatMinutes(getTimeRemainingInSession(activeSession))
      }
    } catch {
      activeSession = null
      timeRemaining = ''
    }
  }

  async function loadInspiringMessage() {
    try {
      const messages = await getMotivationMessages()
      const pool = messages.length > 0 ? messages : inspiringMessages
      inspiringMessage = getRandomFromList(pool)
      challengeQuote = inspiringMessage
    } catch {
      inspiringMessage = getRandomFromList(inspiringMessages)
      challengeQuote = inspiringMessage
    }
  }

  async function loadOverrideStatus() {
    if (!ruleId) {
      loadingOverride = false
      return
    }

    loadingOverride = true
    overrideError = ''

    try {
      overrideStatus = await getTemporaryOverrideStatus(ruleId, sessionId || undefined)
    } catch (error) {
      overrideError = error instanceof Error ? error.message : 'Failed to load temporary unblock status'
    } finally {
      loadingOverride = false
    }
  }

  function formatAllowance(minutes: number): string {
    return `${minutes} min`
  }

  function getDisplayUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname + urlObj.pathname
    } catch {
      return url
    }
  }

  function clearCountdown() {
    if (countdownTimer !== null) {
      window.clearInterval(countdownTimer)
      countdownTimer = null
    }
  }

  function startRequestFlow() {
    if (!overrideStatus?.settings || overrideStatus.remainingMinutes <= 0 || granting) {
      return
    }

    overrideError = ''
    quoteInput = ''

    if (overrideStatus.settings.requireCountdown) {
      requestStep = 'countdown'
      countdownRemaining = 10
      clearCountdown()
      countdownTimer = window.setInterval(() => {
        countdownRemaining -= 1

        if (countdownRemaining <= 0) {
          clearCountdown()
          if (overrideStatus?.settings?.requireQuoteCompletion) {
            requestStep = 'quote'
          } else {
            void confirmTemporaryUnblock()
          }
        }
      }, 1000)
      return
    }

    if (overrideStatus.settings.requireQuoteCompletion) {
      requestStep = 'quote'
      return
    }

    void confirmTemporaryUnblock()
  }

  async function confirmTemporaryUnblock() {
    if (!ruleId || granting) {
      return
    }

    if (overrideStatus?.settings?.requireQuoteCompletion && !canSubmitQuote) {
      return
    }

    granting = true
    overrideError = ''

    try {
      const status = await grantTemporaryOverride(ruleId, sessionId || undefined)
      overrideStatus = status
      window.location.href = blockedUrl
    } catch (error) {
      overrideError = error instanceof Error ? error.message : 'Failed to grant temporary unblock'
      requestStep = 'idle'
      await loadOverrideStatus()
    } finally {
      granting = false
    }
  }

  function blockClipboard(event: ClipboardEvent | DragEvent) {
    event.preventDefault()
  }

  function goBack(event: MouseEvent) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (returnUrl) {
      window.location.replace(returnUrl)
    } else {
      void chrome.tabs.update({ url: 'chrome://newtab/' })
    }
  }

  onMount(() => {
    parseUrlParams()
    void loadSessionInfo()
    void loadInspiringMessage()
    void loadOverrideStatus()

    const interval = window.setInterval(() => {
      void loadSessionInfo()
    }, 60000)

    return () => {
      window.clearInterval(interval)
      clearCountdown()
    }
  })
</script>

<div class="container">
  <div class="content">
    <div class="message-section">
      {#if customMessage}
        <p class="custom-message">{customMessage}</p>
      {/if}

      <p class="inspiring-message">{inspiringMessage}</p>

      <a class="back-link" href={returnUrl || 'chrome://newtab/'} onclick={goBack}>
        {returnUrl ? 'Go back' : 'Open new tab'}
      </a>

      {#if loadingOverride}
        <div class="override-card loading">Loading temporary unblock...</div>
      {:else if overrideStatus?.settings?.enabled}
        <div class="override-card">
          {#if overrideStatus.remainingMinutes > 0}
            <button class="allow-btn" onclick={startRequestFlow} disabled={granting || requestStep !== 'idle'}>
              {granting ? 'Allowing...' : `Allow for ${formatAllowance(overrideStatus.remainingMinutes)}`}
            </button>
            <p class="override-meta">
              Remaining allowance now. Resets every {formatMinutes(overrideStatus.settings.resetIntervalMinutes)}.
            </p>
          {:else}
            <p class="override-exhausted">Temporary unblock allowance exhausted.</p>
          {/if}

          {#if requestStep === 'countdown'}
            <div class="request-step">
              <p class="step-label">Stay intentional. Wait {countdownRemaining}s.</p>
            </div>
          {/if}

          {#if requestStep === 'quote'}
            <div class="request-step quote-step">
              <p class="step-label">Type this quote exactly to continue.</p>
              <blockquote>{challengeQuote}</blockquote>
              <textarea
                bind:value={quoteInput}
                rows="3"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
                placeholder="Type the quote exactly"
                onpaste={blockClipboard}
                ondrop={blockClipboard}
                oncopy={blockClipboard}
                oncut={blockClipboard}
              ></textarea>
              <button class="confirm-btn" onclick={confirmTemporaryUnblock} disabled={!canSubmitQuote || granting}>
                {granting ? 'Allowing...' : `Confirm ${formatAllowance(overrideStatus.remainingMinutes)}`}
              </button>
            </div>
          {/if}

          {#if overrideError}
            <p class="error">{overrideError}</p>
          {/if}
        </div>
      {/if}
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
        <p class="block-reason">{reason}</p>
      </div>
    </div>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    min-height: 100vh;
    font-family: "Iowan Old Style", "Palatino Linotype", serif;
    background:
      radial-gradient(circle at top, rgba(255, 255, 255, 0.18), transparent 35%),
      linear-gradient(135deg, #1d3b35, #2f5e4c 50%, #d2b06d 100%);
    color: #f9f6ef;
  }

  .container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .content {
    width: min(860px, 100%);
    display: flex;
    flex-direction: column;
    gap: 2rem;
    text-align: center;
  }

  .message-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  .custom-message {
    margin: 0;
    font-size: clamp(2rem, 5vw, 3.6rem);
    line-height: 1.15;
  }

  .inspiring-message {
    max-width: 22ch;
    margin: 0;
    font-size: clamp(1.3rem, 3vw, 2rem);
    line-height: 1.4;
    opacity: 0.92;
  }

  .override-card {
    width: min(520px, 100%);
    padding: 1.25rem;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 1rem;
    background: rgba(12, 26, 22, 0.42);
    backdrop-filter: blur(14px);
  }

  .back-link {
    color: #f2d28f;
    font-size: 1rem;
    text-underline-offset: 0.25em;
  }

  .back-link:hover {
    color: #fff;
  }

  .back-link:focus-visible {
    outline: 2px solid #f2d28f;
    outline-offset: 6px;
    border-radius: 2px;
  }

  .override-card.loading {
    color: rgba(249, 246, 239, 0.82);
  }

  .allow-btn,
  .confirm-btn {
    width: 100%;
    padding: 0.9rem 1rem;
    border: none;
    border-radius: 999px;
    background: #f2d28f;
    color: #20322c;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
  }

  .allow-btn:disabled,
  .confirm-btn:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .override-meta,
  .override-exhausted,
  .step-label,
  .error {
    margin: 0.85rem 0 0;
    font-size: 0.88rem;
    line-height: 1.4;
  }

  .override-exhausted,
  .error {
    color: #ffd0d0;
  }

  .request-step {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  blockquote {
    margin: 0;
    padding: 0.9rem 1rem;
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.08);
    font-size: 1rem;
    line-height: 1.5;
  }

  textarea {
    width: 100%;
    padding: 0.85rem 0.95rem;
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.1);
    color: #f9f6ef;
    font: inherit;
    resize: vertical;
  }

  textarea:focus {
    outline: none;
    border-color: rgba(242, 210, 143, 0.8);
    box-shadow: 0 0 0 3px rgba(242, 210, 143, 0.16);
  }

  textarea::placeholder {
    color: rgba(249, 246, 239, 0.55);
  }

  .info-section {
    opacity: 0.84;
  }

  .session-info {
    margin-bottom: 1rem;
    font-size: 1rem;
  }

  .session-label,
  .time-remaining {
    opacity: 0.74;
  }

  .session-name {
    margin-left: 0.5rem;
    font-weight: 600;
  }

  .time-remaining {
    margin-left: 0.5rem;
  }

  .block-info {
    font-size: 0.88rem;
  }

  .blocked-url {
    max-width: 100%;
    margin: 0 0 0.35rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .block-reason {
    margin: 0.15rem 0;
  }

  @media (max-width: 640px) {
    .container {
      padding: 1.25rem;
    }

    .override-card {
      padding: 1rem;
    }
  }
</style>
