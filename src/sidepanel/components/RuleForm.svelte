<script lang="ts">
  import type { OverrideSettings, Rule, RuleType } from '@/lib/types'

  interface Props {
    rule: Rule | null
    nextOrder: number
    onSave: (rule: Omit<Rule, 'id'> & { id?: string }) => void
    onCancel: () => void
  }

  let { rule, nextOrder, onSave, onCancel }: Props = $props()

  // Create a snapshot of the rule to avoid Svelte 5 reactivity issues
  const initialSnapshot = rule ? $state.snapshot(rule) : null

  let name = $state(initialSnapshot?.name ?? '')
  let type = $state<RuleType>(initialSnapshot?.type ?? 'blacklist_exact')
  let value = $state(initialSnapshot?.value ?? '')
  let values = $state<string[]>(initialSnapshot?.values ? [...initialSnapshot.values] : [])
  let isRegex = $state(initialSnapshot?.isRegex ?? false)
  let skipRemaining = $state(initialSnapshot?.skipRemaining ?? false)
  let searchInUrl = $state(initialSnapshot?.searchInUrl ?? false)
  let searchInHeading = $state(initialSnapshot?.searchInHeading ?? false)
  let searchInBody = $state(initialSnapshot?.searchInBody ?? true)
  let message = $state(initialSnapshot?.message ?? '')
  let hasCustomOverrideSettings = $state(Boolean(initialSnapshot?.overrideSettings))
  let overrideEnabled = $state(initialSnapshot?.overrideSettings?.enabled ?? true)
  let maxOverrideMinutes = $state(initialSnapshot?.overrideSettings?.maxOverrideMinutes ?? 15)
  let resetIntervalMinutes = $state(initialSnapshot?.overrideSettings?.resetIntervalMinutes ?? 1440)
  let requireCountdown = $state(initialSnapshot?.overrideSettings?.requireCountdown ?? true)
  let requireQuoteCompletion = $state(initialSnapshot?.overrideSettings?.requireQuoteCompletion ?? true)
  let error = $state('')
  let newItem = $state('')
  const resetIntervalPresets = [300, 720, 1440]
  let resetIntervalMode = $state<'300' | '720' | '1440' | 'custom'>(
    resetIntervalPresets.includes(resetIntervalMinutes) ? String(resetIntervalMinutes) as '300' | '720' | '1440' : 'custom'
  )

  const ruleTypes: { value: RuleType; label: string; description: string }[] = [
    { value: 'blacklist_exact', label: 'Block URLs', description: 'Block a list of websites or URLs' },
    { value: 'whitelist_exact', label: 'Allow URLs', description: 'Always allow a list of websites or URLs' },
    { value: 'blacklist_keyword', label: 'Block Keyword', description: 'Block pages containing this keyword' },
    { value: 'whitelist_keyword', label: 'Allow Keyword', description: 'Allow pages containing this keyword' },
    { value: 'yt_channel_blacklist', label: 'Block YouTube Channels', description: 'Block videos from these channels' },
    { value: 'yt_channel_whitelist', label: 'Allow YouTube Channels', description: 'Allow videos from these channels' },
  ]

  const isListType = $derived(
    type === 'blacklist_exact' || type === 'whitelist_exact' ||
    type === 'yt_channel_blacklist' || type === 'yt_channel_whitelist'
  )
  const isKeywordType = $derived(type === 'blacklist_keyword' || type === 'whitelist_keyword')
  const isUrlType = $derived(type === 'blacklist_exact' || type === 'whitelist_exact')
  const isYouTubeType = $derived(type === 'yt_channel_blacklist' || type === 'yt_channel_whitelist')

  const itemPlaceholder = $derived(() => {
    if (isUrlType) return 'e.g., twitter.com or https://twitter.com/home'
    if (isYouTubeType) return 'e.g., PewDiePie or @pewdiepie'
    return ''
  })

  function normalizeUrl(url: string): string {
    let normalized = url.trim().toLowerCase()
    // Remove protocol
    normalized = normalized.replace(/^https?:\/\//, '')
    // Remove www.
    normalized = normalized.replace(/^www\./, '')
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '')
    return normalized
  }

  function normalizeChannel(channel: string): string {
    let normalized = channel.trim()
    // Remove YouTube URL if pasted
    const ytMatch = normalized.match(/youtube\.com\/@([a-zA-Z0-9_-]+)/)
    if (ytMatch) {
      return '@' + ytMatch[1]
    }
    const ytChannelMatch = normalized.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/)
    if (ytChannelMatch) {
      return ytChannelMatch[1]
    }
    return normalized
  }

  function addItem() {
    let item = newItem.trim()
    if (!item) return

    // Normalize based on type
    if (isUrlType) {
      item = normalizeUrl(item)
    } else if (isYouTubeType) {
      item = normalizeChannel(item)
    }

    if (item && !values.includes(item)) {
      values = [...values, item]
      newItem = ''
    }
  }

  function removeItem(index: number) {
    values = values.filter((_, i) => i !== index)
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addItem()
    }
  }

  function handleResetIntervalModeChange(value: string) {
    if (value === '300' || value === '720' || value === '1440') {
      resetIntervalMode = value
      resetIntervalMinutes = Number(value)
      return
    }

    resetIntervalMode = 'custom'
  }

  function handleSubmit() {
    error = ''

    if (!name.trim()) {
      error = 'Please enter a rule name'
      return
    }

    if (isListType && values.length === 0) {
      error = 'Please add at least one item'
      return
    }

    if (isKeywordType && !value.trim()) {
      error = 'Please enter a keyword'
      return
    }

    if (isRegex && isKeywordType) {
      try {
        new RegExp(value)
      } catch {
        error = 'Invalid regex pattern'
        return
      }
    }

    if (hasCustomOverrideSettings) {
      if (!Number.isFinite(maxOverrideMinutes) || maxOverrideMinutes <= 0) {
        error = 'Temporary unblock minutes must be greater than 0'
        return
      }

      if (!Number.isFinite(resetIntervalMinutes) || resetIntervalMinutes <= 0) {
        error = 'Reset interval must be greater than 0'
        return
      }
    }

    const overrideSettings: OverrideSettings | undefined = hasCustomOverrideSettings
      ? {
          enabled: overrideEnabled,
          maxOverrideMinutes: Math.floor(maxOverrideMinutes),
          resetIntervalMinutes: Math.floor(resetIntervalMinutes),
          requireCountdown,
          requireQuoteCompletion
        }
      : undefined

    onSave({
      id: initialSnapshot?.id,
      name: name.trim(),
      type,
      value: isKeywordType ? value.trim() : (values[0] || ''),
      values: isListType ? [...values] : [],
      isRegex: isKeywordType ? isRegex : false,
      enabled: initialSnapshot?.enabled ?? true,
      order: initialSnapshot?.order ?? nextOrder,
      skipRemaining,
      searchInUrl: isKeywordType ? searchInUrl : false,
      searchInHeading: isKeywordType ? searchInHeading : false,
      searchInBody: isKeywordType ? searchInBody : true,
      message: message.trim(),
      overrideSettings
    })
  }
</script>

<div class="modal-overlay" onclick={onCancel} onkeydown={(e) => e.key === 'Escape' && onCancel()} role="presentation">
  <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
    <h2>{initialSnapshot ? 'Edit Rule' : 'New Rule'}</h2>

    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <div class="form-group">
        <label for="name">Rule Name</label>
        <input
          type="text"
          id="name"
          bind:value={name}
          placeholder="e.g., Social Media Block"
        />
      </div>

      <div class="form-group">
        <label for="type">Rule Type</label>
        <select id="type" bind:value={type}>
          {#each ruleTypes as ruleType}
            <option value={ruleType.value}>{ruleType.label}</option>
          {/each}
        </select>
        <p class="type-description">
          {ruleTypes.find(r => r.value === type)?.description}
        </p>
      </div>

      {#if isListType}
        <div class="form-group">
          <label for="new-item">
            {#if isUrlType}URLs / Domains{:else}Channel Names{/if}
          </label>

          <div class="item-input-row">
            <input
              type="text"
              id="new-item"
              bind:value={newItem}
              placeholder={itemPlaceholder()}
              onkeydown={handleKeydown}
            />
            <button type="button" class="add-item-btn" onclick={addItem}>Add</button>
          </div>

          {#if values.length > 0}
            <ul class="items-list">
              {#each values as item, index}
                <li class="item">
                  <span class="item-text">{item}</span>
                  <button type="button" class="remove-item-btn" onclick={() => removeItem(index)} title="Remove item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="empty-list">No items added yet</p>
          {/if}
        </div>
      {:else}
        <div class="form-group">
          <label for="value">Keyword</label>
          <input
            type="text"
            id="value"
            bind:value={value}
            placeholder="e.g., gaming"
          />
        </div>

        <div class="form-group checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={isRegex} />
            <span>Use regular expression</span>
          </label>
          {#if isRegex}
            <p class="hint">Pattern will be matched as a regex (case-insensitive)</p>
          {/if}
        </div>

        <div class="form-group" role="group" aria-labelledby="search-in-label">
          <span id="search-in-label" class="label">Search in</span>
          <div class="search-locations">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={searchInUrl} />
              <span>URL</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={searchInHeading} />
              <span>Heading</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={searchInBody} />
              <span>Body</span>
            </label>
          </div>
        </div>
      {/if}

      <div class="form-group">
        <label for="message">Block Message (Optional)</label>
        <textarea
          id="message"
          bind:value={message}
          placeholder="Custom message to show when blocked (optional)"
          rows="2"
        ></textarea>
        <p class="hint">This message will be displayed on the blocked page</p>
      </div>

      <div class="form-group checkbox-group">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={hasCustomOverrideSettings} />
          <span>Use rule-specific temporary unblock settings</span>
        </label>
        <p class="hint">Leave off to inherit from the active Zen Window or global defaults</p>
      </div>

      {#if hasCustomOverrideSettings}
        <div class="override-panel">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={overrideEnabled} />
            <span>Enable temporary unblock requests for this rule</span>
          </label>

          <div class="form-row">
            <div class="form-group">
              <label for="max-override-minutes">Max Unblock Minutes</label>
              <input type="number" id="max-override-minutes" bind:value={maxOverrideMinutes} min="1" step="1" />
            </div>

            <div class="form-group">
              <label for="reset-interval-mode">Reset Interval</label>
              <select
                id="reset-interval-mode"
                value={resetIntervalMode}
                onchange={(event) => handleResetIntervalModeChange((event.currentTarget as HTMLSelectElement).value)}
              >
                <option value="300">Every 5 hours</option>
                <option value="720">Every 12 hours</option>
                <option value="1440">Every 24 hours</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          {#if resetIntervalMode === 'custom'}
            <div class="form-group">
              <label for="custom-reset-interval">Custom Reset Minutes</label>
              <input type="number" id="custom-reset-interval" bind:value={resetIntervalMinutes} min="1" step="1" />
            </div>
          {/if}

          <div class="override-options">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={requireCountdown} />
              <span>Require 10-second countdown</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={requireQuoteCompletion} />
              <span>Require quote typing</span>
            </label>
          </div>
        </div>
      {/if}

      <div class="form-group checkbox-group">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={skipRemaining} />
          <span>Stop processing rules after match</span>
        </label>
        <p class="hint">When enabled, no further rules will be evaluated if this rule matches</p>
      </div>

      {#if error}
        <p class="error">{error}</p>
      {/if}

      <div class="actions">
        <button type="button" class="cancel-btn" onclick={onCancel}>Cancel</button>
        <button type="submit" class="save-btn">Save</button>
      </div>
    </form>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    width: 90%;
    max-width: 450px;
    max-height: 90vh;
    overflow-y: auto;
  }

  h2 {
    margin: 0 0 1.5rem;
    font-size: 1.25rem;
    font-weight: 600;
    color: #374151;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-row {
    display: flex;
    gap: 1rem;
  }

  .form-row .form-group {
    flex: 1;
  }

  label,
  .label {
    display: block;
    margin-bottom: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }

  input[type="text"],
  input[type="number"],
  select,
  textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    background: white;
  }

  textarea {
    resize: vertical;
    font-family: inherit;
  }

  input:focus,
  select:focus,
  textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .type-description {
    margin: 0.375rem 0 0;
    font-size: 0.75rem;
    color: #6b7280;
  }

  .item-input-row {
    display: flex;
    gap: 0.5rem;
  }

  .item-input-row input {
    flex: 1;
  }

  .add-item-btn {
    padding: 0.5rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    cursor: pointer;
    white-space: nowrap;
  }

  .add-item-btn:hover {
    background: #2563eb;
  }

  .items-list {
    list-style: none;
    margin: 0.75rem 0 0;
    padding: 0;
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
  }

  .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .item:last-child {
    border-bottom: none;
  }

  .item-text {
    font-size: 0.875rem;
    color: #374151;
    word-break: break-all;
  }

  .remove-item-btn {
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

  .remove-item-btn:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  .empty-list {
    margin: 0.75rem 0 0;
    padding: 1rem;
    text-align: center;
    font-size: 0.875rem;
    color: #9ca3af;
    background: #f9fafb;
    border-radius: 0.375rem;
  }

  .checkbox-group {
    margin-top: 0.5rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: normal;
  }

  .checkbox-label input {
    width: 1rem;
    height: 1rem;
  }

  .search-locations {
    display: flex;
    gap: 1rem;
    margin-top: 0.5rem;
  }

  .hint {
    margin: 0.375rem 0 0;
    font-size: 0.75rem;
    color: #6b7280;
  }

  .override-panel {
    margin-bottom: 1rem;
    padding: 0.875rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
  }

  .override-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .error {
    color: #dc2626;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .cancel-btn {
    padding: 0.5rem 1rem;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
  }

  .cancel-btn:hover {
    background: #e5e7eb;
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
</style>
