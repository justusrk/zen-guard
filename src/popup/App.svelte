<script lang="ts">
  import type { Session, Stats } from '@/lib/types'
  import { getActiveSession, getTimeRemainingInSession, formatMinutes } from '@/lib/session-manager'
  import { getStats } from '@/lib/storage'

  let activeSession = $state<Session | null>(null)
  let stats = $state<Stats | null>(null)
  let timeRemaining = $state('')
  let loading = $state(true)

  async function loadStatus() {
    try {
      activeSession = await getActiveSession()
      stats = await getStats()

      if (activeSession) {
        const remaining = getTimeRemainingInSession(activeSession)
        timeRemaining = formatMinutes(remaining)
      }
    } catch (error) {
      console.error('Failed to load status:', error)
    } finally {
      loading = false
    }
  }

  function openSidePanel() {
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })
    window.close()
  }

  $effect(() => {
    loadStatus()

    const interval = setInterval(loadStatus, 30000)
    return () => clearInterval(interval)
  })
</script>

<div class="popup">
  <header>
    <h1>Zen Guard</h1>
  </header>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else}
    <div class="status">
      {#if activeSession}
        <div class="session-active">
          <div class="status-indicator active"></div>
          <div class="session-info">
            <span class="session-name">{activeSession.name}</span>
            <span class="session-time">{timeRemaining} remaining</span>
          </div>
        </div>
      {:else}
        <div class="session-inactive">
          <div class="status-indicator inactive"></div>
          <span>No active session</span>
        </div>
      {/if}
    </div>

    <div class="stats">
      <div class="stat">
        <span class="stat-value">{stats?.blocksThisWeek ?? 0}</span>
        <span class="stat-label">blocks this week</span>
      </div>
    </div>

    <button class="settings-btn" onclick={openSidePanel}>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
      Open Settings
    </button>
  {/if}
</div>

<style>
  .popup {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  h1 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #374151;
  }

  .loading {
    text-align: center;
    color: #9ca3af;
    padding: 1rem;
  }

  .status {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 0.75rem;
  }

  .session-active,
  .session-inactive {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .status-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .status-indicator.active {
    background: #22c55e;
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
  }

  .status-indicator.inactive {
    background: #9ca3af;
  }

  .session-info {
    display: flex;
    flex-direction: column;
  }

  .session-name {
    font-weight: 500;
    color: #374151;
    font-size: 0.875rem;
  }

  .session-time {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .session-inactive {
    color: #6b7280;
    font-size: 0.875rem;
  }

  .stats {
    display: flex;
    justify-content: center;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.5rem 1rem;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 600;
    color: #374151;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .settings-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.625rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .settings-btn:hover {
    background: #2563eb;
  }

  .settings-btn svg {
    flex-shrink: 0;
  }
</style>
