<script lang="ts">
  import type { OverrideSettings, Session, Rule } from '@/lib/types'

  interface Props {
    session: Session | null
    onSave: (session: Omit<Session, 'id'> & { id?: string }) => void
    onCancel: () => void
  }

  let { session, onSave, onCancel }: Props = $props()

  // Create a snapshot of the session to avoid Svelte 5 reactivity issues
  // This ensures we capture the actual values at component mount time
  const initialSnapshot = session ? $state.snapshot(session) : null
  const initialId = initialSnapshot?.id
  const initialEnabled = initialSnapshot?.enabled ?? true
  const initialRules: Rule[] = Array.isArray(initialSnapshot?.rules)
    ? initialSnapshot.rules.map(rule => ({
      ...rule,
      values: Array.isArray(rule.values) ? [...rule.values] : []
    }))
    : []
  const initialOrder = initialSnapshot?.order

  let name = $state(initialSnapshot?.name ?? '')
  let startTime = $state(initialSnapshot?.startTime ?? '09:00')
  let endTime = $state(initialSnapshot?.endTime ?? '17:00')
  let daysOfWeek = $state<number[]>(initialSnapshot?.daysOfWeek ? [...initialSnapshot.daysOfWeek] : [1, 2, 3, 4, 5])
  let message = $state(initialSnapshot?.message ?? '')
  let hasCustomOverrideSettings = $state(Boolean(initialSnapshot?.overrideSettings))
  let overrideEnabled = $state(initialSnapshot?.overrideSettings?.enabled ?? true)
  let maxOverrideMinutes = $state(initialSnapshot?.overrideSettings?.maxOverrideMinutes ?? 15)
  let resetIntervalMinutes = $state(initialSnapshot?.overrideSettings?.resetIntervalMinutes ?? 1440)
  let requireCountdown = $state(initialSnapshot?.overrideSettings?.requireCountdown ?? true)
  let requireQuoteCompletion = $state(initialSnapshot?.overrideSettings?.requireQuoteCompletion ?? true)
  let error = $state('')
  const resetIntervalPresets = [300, 720, 1440]
  let resetIntervalMode = $state<'300' | '720' | '1440' | 'custom'>(
    resetIntervalPresets.includes(resetIntervalMinutes) ? String(resetIntervalMinutes) as '300' | '720' | '1440' : 'custom'
  )

  const dayOptions = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
  ]

  function toggleDay(day: number) {
    if (daysOfWeek.includes(day)) {
      daysOfWeek = daysOfWeek.filter(d => d !== day)
    } else {
      daysOfWeek = [...daysOfWeek, day].sort()
    }
  }

  function handleSubmit() {
    error = ''

    if (!name.trim()) {
      error = 'Please enter a name'
      return
    }

    if (daysOfWeek.length === 0) {
      error = 'Please select at least one day'
      return
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

    const newSession = {
      id: initialId,
      name: name.trim(),
      startTime,
      endTime,
      daysOfWeek: [...daysOfWeek],
      enabled: initialEnabled,
      rules: initialRules,
      message: message.trim(),
      order: initialOrder,
      overrideSettings
    }

    onSave(newSession)
  }

  function selectWeekdays() {
    daysOfWeek = [1, 2, 3, 4, 5]
  }

  function selectWeekends() {
    daysOfWeek = [0, 6]
  }

  function selectAllDays() {
    daysOfWeek = [0, 1, 2, 3, 4, 5, 6]
  }

  function handleResetIntervalModeChange(value: string) {
    if (value === '300' || value === '720' || value === '1440') {
      resetIntervalMode = value
      resetIntervalMinutes = Number(value)
      return
    }

    resetIntervalMode = 'custom'
  }
</script>

<div class="modal-overlay" onclick={onCancel} onkeydown={(e) => e.key === 'Escape' && onCancel()} role="presentation">
  <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
    <h2>{initialSnapshot ? 'Edit Zen Window' : 'New Zen Window'}</h2>

    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <div class="form-group">
        <label for="name">Name</label>
        <input
          type="text"
          id="name"
          bind:value={name}
          placeholder="e.g., Work Hours"
        />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="startTime">Start Time</label>
          <input type="time" id="startTime" bind:value={startTime} />
        </div>

        <div class="form-group">
          <label for="endTime">End Time</label>
          <input type="time" id="endTime" bind:value={endTime} />
        </div>
      </div>

      <div class="form-group" role="group" aria-labelledby="days-label">
        <span id="days-label" class="label">Days of Week</span>
        <div class="quick-select">
          <button type="button" onclick={selectWeekdays}>Weekdays</button>
          <button type="button" onclick={selectWeekends}>Weekends</button>
          <button type="button" onclick={selectAllDays}>All</button>
        </div>
        <div class="days-grid">
          {#each dayOptions as day}
            <button
              type="button"
              class="day-btn"
              class:selected={daysOfWeek.includes(day.value)}
              onclick={() => toggleDay(day.value)}
            >
              {day.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="form-group">
        <label for="message">Block Message (Optional)</label>
        <textarea
          id="message"
          bind:value={message}
          placeholder="Custom message to show when blocked during this zen window"
          rows="2"
        ></textarea>
        <p class="hint">This message will be displayed if no rule-specific message is set</p>
      </div>

      <div class="form-group checkbox-group">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={hasCustomOverrideSettings} />
          <span>Use Zen Window temporary unblock settings</span>
        </label>
        <p class="hint">Leave off to inherit from global defaults</p>
      </div>

      {#if hasCustomOverrideSettings}
        <div class="override-panel">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={overrideEnabled} />
            <span>Enable temporary unblock requests for this Zen Window</span>
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
    max-width: 400px;
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

  .checkbox-group {
    margin-top: 0.5rem;
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
  input[type="time"],
  select,
  textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }

  textarea {
    resize: vertical;
    font-family: inherit;
  }

  input:focus,
  textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .hint {
    margin: 0.375rem 0 0;
    font-size: 0.75rem;
    color: #6b7280;
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

  .quick-select {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .quick-select button {
    padding: 0.25rem 0.5rem;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    color: #6b7280;
    cursor: pointer;
  }

  .quick-select button:hover {
    background: #e5e7eb;
  }

  .days-grid {
    display: flex;
    gap: 0.5rem;
  }

  .day-btn {
    flex: 1;
    padding: 0.5rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
  }

  .day-btn:hover {
    background: #f3f4f6;
  }

  .day-btn.selected {
    background: #3b82f6;
    border-color: #3b82f6;
    color: white;
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
