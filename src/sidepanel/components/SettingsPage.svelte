<script lang="ts">
  import type { Settings } from '@/lib/types'
  import { getSettings, saveSettings } from '@/lib/storage'
  import { inspiringMessages } from '@/lib/messages'

  interface ConfirmOptions {
    title?: string
    message: string
    confirmText?: string
    cancelText?: string
    destructive?: boolean
  }

  interface Props {
    onExport: () => void
    onImport: () => void
    showToast: (message: string, type: 'success' | 'error' | 'info') => void
    showConfirm: (options: ConfirmOptions | string) => Promise<boolean>
  }

  let { onExport, onImport, showToast, showConfirm }: Props = $props()

  type Tab = 'general' | 'motivation' | 'data'
  let activeTab = $state<Tab>('general')

  let globalMessage = $state('')
  let motivationMessages = $state<string[]>([])
  let newMotivation = $state('')
  let searchQuery = $state('')
  let loading = $state(true)
  let saving = $state(false)
  let saveSuccess = $state(false)

  const filteredMessages = $derived(
    searchQuery.trim()
      ? motivationMessages.filter(m => m.toLowerCase().includes(searchQuery.toLowerCase()))
      : motivationMessages
  )

  async function loadSettings() {
    try {
      const settings = await getSettings()
      globalMessage = settings.globalMessage || ''

      // If no custom messages exist, initialize with default messages
      if (!settings.motivationMessages || settings.motivationMessages.length === 0) {
        motivationMessages = [...inspiringMessages]
        // Save the defaults so they persist
        await saveSettings({
          ...settings,
          motivationMessages: motivationMessages
        })
      } else {
        motivationMessages = settings.motivationMessages
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    } finally {
      loading = false
    }
  }

  async function handleSave() {
    saving = true
    saveSuccess = false
    try {
      const settings: Settings = {
        globalMessage: globalMessage.trim(),
        motivationMessages: motivationMessages
      }
      await saveSettings(settings)
      saveSuccess = true
      setTimeout(() => { saveSuccess = false }, 2000)
    } catch (e) {
      console.error('Failed to save settings:', e)
    } finally {
      saving = false
    }
  }

  function addMotivation() {
    const trimmed = newMotivation.trim()
    if (trimmed && !motivationMessages.includes(trimmed)) {
      motivationMessages = [...motivationMessages, trimmed]
      newMotivation = ''
    }
  }

  function removeMotivation(index: number) {
    motivationMessages = motivationMessages.filter((_, i) => i !== index)
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addMotivation()
    }
  }

  let motivationFileInput = $state<HTMLInputElement | null>(null)

  function exportMotivationMessages() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      motivationMessages: motivationMessages
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const date = new Date().toISOString().split('T')[0]
    const a = document.createElement('a')
    a.href = url
    a.download = `zen-guard-motivation-${date}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function importMotivationClick() {
    motivationFileInput?.click()
  }

  async function handleMotivationFileChange(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      if (!Array.isArray(data.motivationMessages)) {
        throw new Error('Invalid format: motivationMessages array not found')
      }

      const messages = data.motivationMessages.filter((m: unknown) => typeof m === 'string' && m.trim())

      if (messages.length === 0) {
        throw new Error('No valid messages found in file')
      }

      const confirmed = await showConfirm({
        title: 'Import Messages',
        message: `Import ${messages.length} motivation messages? This will replace your current messages.`,
        confirmText: 'Import',
        destructive: true
      })
      if (!confirmed) {
        input.value = ''
        return
      }

      motivationMessages = messages
      await handleSave()
      showToast('Motivation messages imported successfully!', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to import motivation messages', 'error')
    }

    input.value = ''
  }

  async function resetToDefaults() {
    const confirmed = await showConfirm({
      title: 'Reset Messages',
      message: 'Reset to default motivation messages? This will replace all your current messages.',
      confirmText: 'Reset',
      destructive: true
    })
    if (confirmed) {
      motivationMessages = [...inspiringMessages]
    }
  }

  $effect(() => {
    loadSettings()
  })
</script>

<div class="settings-page">
  <div class="header">
    <h3>Settings</h3>
  </div>

  <div class="tabs">
    <button
      class="tab"
      class:active={activeTab === 'general'}
      onclick={() => activeTab = 'general'}
    >
      General
    </button>
    <button
      class="tab"
      class:active={activeTab === 'motivation'}
      onclick={() => activeTab = 'motivation'}
    >
      Motivation
    </button>
    <button
      class="tab"
      class:active={activeTab === 'data'}
      onclick={() => activeTab = 'data'}
    >
      Data
    </button>
  </div>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else}
    <div class="content">
      {#if activeTab === 'general'}
        <section class="section">
          <h4>Default Block Message</h4>
          <p class="description">
            This message is shown on the blocked page when neither the rule nor session has a custom message.
          </p>
          <textarea
            bind:value={globalMessage}
            placeholder="Enter a default message to show when sites are blocked..."
            rows="3"
          ></textarea>
          <div class="save-row">
            <button class="save-btn" onclick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            {#if saveSuccess}
              <span class="save-success">Saved!</span>
            {/if}
          </div>
        </section>

      {:else if activeTab === 'motivation'}
        <input
          type="file"
          accept=".json"
          bind:this={motivationFileInput}
          onchange={handleMotivationFileChange}
          style="display: none;"
        />

        <div class="motivation-container">
          <div class="motivation-header">
            <div class="add-motivation">
              <input
                type="text"
                bind:value={newMotivation}
                placeholder="Add a new message..."
                onkeydown={handleKeydown}
              />
              <button class="add-btn" onclick={addMotivation} disabled={!newMotivation.trim()}>
                Add
              </button>
            </div>

            <div class="search-bar">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
              <input
                type="text"
                bind:value={searchQuery}
                placeholder="Search messages..."
              />
              {#if searchQuery}
                <button class="clear-search" onclick={() => searchQuery = ''} title="Clear search">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              {/if}
            </div>

            <div class="list-header">
              <span class="message-count">
                {#if searchQuery}
                  {filteredMessages.length} of {motivationMessages.length} messages
                {:else}
                  {motivationMessages.length} messages
                {/if}
              </span>
            </div>
          </div>

          {#if motivationMessages.length > 0}
            <ul class="motivation-list">
              {#each filteredMessages as message}
                {@const originalIndex = motivationMessages.indexOf(message)}
                <li class="motivation-item">
                  <span class="motivation-text">{message}</span>
                  <button class="remove-btn" onclick={() => removeMotivation(originalIndex)} title="Remove">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </li>
              {:else}
                <li class="no-results">No messages match your search</li>
              {/each}
            </ul>
          {:else}
            <p class="empty-message">No messages yet. Add your own above!</p>
          {/if}

          <div class="motivation-footer">
            <div class="save-row">
              <button class="save-btn" onclick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              {#if saveSuccess}
                <span class="save-success">Saved!</span>
              {/if}
            </div>

            <div class="button-row">
              <button class="action-btn" onclick={exportMotivationMessages} title="Export messages">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export
              </button>
              <button class="action-btn" onclick={importMotivationClick} title="Import messages">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Import
              </button>
              <button class="action-btn" onclick={resetToDefaults} title="Reset to default messages">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
                Reset
              </button>
            </div>
          </div>
        </div>

      {:else if activeTab === 'data'}
        <section class="section">
          <h4>Import / Export</h4>
          <p class="description">
            Export your configuration to a file or import from a previously exported file.
          </p>
          <div class="button-row">
            <button class="action-btn" onclick={onExport}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export Configuration
            </button>
            <button class="action-btn" onclick={onImport}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Import Configuration
            </button>
          </div>
        </section>
      {/if}
    </div>
  {/if}
</div>

<style>
  .settings-page {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .tab {
    flex: 1;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab:hover {
    color: #374151;
    background: #f3f4f6;
  }

  .tab.active {
    color: #3b82f6;
    border-bottom-color: #3b82f6;
    background: white;
  }

  .loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6b7280;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
  }

  .section {
    margin-bottom: 2rem;
  }

  .section h4 {
    margin: 0 0 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  .description {
    margin: 0 0 0.75rem;
    font-size: 0.75rem;
    color: #6b7280;
    line-height: 1.4;
  }

  .motivation-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .motivation-header {
    flex-shrink: 0;
  }

  .motivation-footer {
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 0.75rem;
    border-top: 1px solid #e5e7eb;
    margin-top: 0.75rem;
  }

  .search-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    margin-bottom: 0.75rem;
    background: #f9fafb;
  }

  .search-bar svg {
    color: #9ca3af;
    flex-shrink: 0;
  }

  .search-bar input {
    flex: 1;
    border: none;
    background: none;
    font-size: 0.875rem;
    padding: 0;
    outline: none;
  }

  .search-bar:focus-within {
    border-color: #3b82f6;
    background: white;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .clear-search {
    padding: 0.125rem;
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
  }

  .clear-search:hover {
    color: #6b7280;
    background: #e5e7eb;
  }

  textarea,
  input[type="text"] {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-family: inherit;
  }

  textarea {
    resize: vertical;
  }

  textarea:focus,
  input[type="text"]:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .save-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  .save-btn {
    padding: 0.5rem 1rem;
    background: #3b82f6;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: white;
    cursor: pointer;
  }

  .save-btn:hover {
    background: #2563eb;
  }

  .save-btn:disabled {
    background: #93c5fd;
    cursor: not-allowed;
  }

  .save-success {
    font-size: 0.875rem;
    color: #16a34a;
  }

  .add-motivation {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .add-motivation input {
    flex: 1;
  }

  .add-btn {
    padding: 0.5rem 1rem;
    background: #3b82f6;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: white;
    cursor: pointer;
    white-space: nowrap;
  }

  .add-btn:hover {
    background: #2563eb;
  }

  .add-btn:disabled {
    background: #93c5fd;
    cursor: not-allowed;
  }

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .message-count {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .motivation-list {
    list-style: none;
    margin: 0;
    padding: 0;
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .no-results {
    text-align: center;
    color: #9ca3af;
    font-size: 0.875rem;
    padding: 2rem;
  }

  .motivation-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    margin-bottom: 0.5rem;
  }

  .motivation-text {
    flex: 1;
    font-size: 0.875rem;
    color: #374151;
  }

  .remove-btn {
    padding: 0.25rem;
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    border-radius: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .remove-btn:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  .empty-message {
    text-align: center;
    color: #9ca3af;
    font-size: 0.875rem;
    padding: 1.5rem;
    background: #f9fafb;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
  }

  .button-row {
    display: flex;
    gap: 0.75rem;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: #e5e7eb;
  }
</style>
