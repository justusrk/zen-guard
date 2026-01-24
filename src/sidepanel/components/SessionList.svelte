<script lang="ts">
  import type { Session } from '@/lib/types'

  interface Props {
    sessions: Session[]
    selectedId: string | null
    onSelect: (id: string | null) => void
    onAdd: () => void
    onEdit: (session: Session) => void
    onDelete: (id: string) => void
    onToggle: (session: Session) => void
    onReorder: (sessions: Session[]) => void
    globalRulesEnabled: boolean
    globalRulesCount: number
    onGlobalToggle: () => void
    onGlobalMessageEdit: () => void
  }

  let { sessions, selectedId, onSelect, onAdd, onEdit, onDelete, onToggle, onReorder, globalRulesEnabled, globalRulesCount, onGlobalToggle, onGlobalMessageEdit }: Props = $props()

  let draggedIndex = $state<number | null>(null)
  let pendingSessions = $state<Session[] | null>(null)
  let dragStartSessions = $state<Session[] | null>(null)

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  function formatDays(days: number[]): string {
    if (!Array.isArray(days) || days.length === 0) return 'No days selected'
    if (days.length === 7) return 'Every day'
    if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Weekdays'
    if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends'
    return days.map(d => dayNames[d]).join(', ')
  }

  function handleDragStart(e: DragEvent, index: number) {
    if (!sessions || sessions.length === 0) return

    draggedIndex = index
    // Capture a deep copy of sessions at drag start
    dragStartSessions = sessions.map(s => ({
      ...s,
      daysOfWeek: Array.isArray(s.daysOfWeek) ? [...s.daysOfWeek] : [],
      rules: Array.isArray(s.rules) ? s.rules.map(r => ({ ...r, values: Array.isArray(r.values) ? [...r.values] : [] })) : []
    }))
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', index.toString())
    }
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    if (!dragStartSessions || dragStartSessions.length === 0) return

    const sourceSessions = pendingSessions ?? dragStartSessions

    if (!sourceSessions || sourceSessions.length === 0) return
    if (draggedIndex < 0 || draggedIndex >= sourceSessions.length) return

    const newSessions: Session[] = sourceSessions.map(s => ({
      ...s,
      daysOfWeek: Array.isArray(s.daysOfWeek) ? [...s.daysOfWeek] : [],
      rules: Array.isArray(s.rules) ? s.rules.map(r => ({ ...r, values: Array.isArray(r.values) ? [...r.values] : [] })) : []
    }))

    const [removed] = newSessions.splice(draggedIndex, 1)
    if (!removed) return

    newSessions.splice(index, 0, removed)

    newSessions.forEach((session, i) => {
      session.order = i
    })

    draggedIndex = index
    pendingSessions = newSessions
  }

  function handleDragEnd() {
    if (pendingSessions && pendingSessions.length > 0) {
      // Create a final deep copy for saving
      const sessionsToSave = pendingSessions.map(s => ({
        ...s,
        daysOfWeek: Array.isArray(s.daysOfWeek) ? [...s.daysOfWeek] : [],
        rules: Array.isArray(s.rules) ? s.rules.map(r => ({ ...r, values: Array.isArray(r.values) ? [...r.values] : [] })) : []
      }))
      onReorder(sessionsToSave)
    }
    pendingSessions = null
    dragStartSessions = null
    draggedIndex = null
  }
</script>

<div class="session-list">
  <div class="top-section">
    <div class="global-card" class:selected={selectedId === 'global'} class:disabled={!globalRulesEnabled}>
      <button class="global-content" onclick={() => onSelect('global')}>
        <div class="global-info">
          <span class="global-name">Global Rules</span>
          <span class="global-count">{globalRulesCount} {globalRulesCount === 1 ? 'rule' : 'rules'}</span>
        </div>
      </button>

      <div class="global-actions">
        <label class="toggle">
          <input
            type="checkbox"
            checked={globalRulesEnabled}
            onchange={onGlobalToggle}
          />
          <span class="toggle-slider"></span>
        </label>
        <button class="icon-btn" onclick={onGlobalMessageEdit} title="Edit Message">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>
    </div>
  </div>

  <div class="header">
    <h3>Zen Windows</h3>
  </div>

  <div class="list">
    {#each pendingSessions ?? sessions as session, index (session.id)}
      <div
        class="session-item"
        class:selected={selectedId === session.id}
        class:disabled={!session.enabled}
        class:dragging={draggedIndex === index}
        draggable="true"
        ondragstart={(e) => handleDragStart(e, index)}
        ondragover={(e) => handleDragOver(e, index)}
        ondragend={handleDragEnd}
        role="listitem"
      >
        <div class="drag-handle">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5"/>
            <circle cx="15" cy="6" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/>
            <circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="18" r="1.5"/>
            <circle cx="15" cy="18" r="1.5"/>
          </svg>
        </div>

        <button
          class="session-content"
          onclick={() => onSelect(session.id)}
        >
          <div class="session-info">
            <span class="session-name">{session.name}</span>
            <span class="session-time">{session.startTime} - {session.endTime}</span>
            <span class="session-days">{formatDays(session.daysOfWeek)}</span>
          </div>
        </button>

        <div class="session-actions">
          <label class="toggle">
            <input
              type="checkbox"
              checked={session.enabled}
              onchange={() => onToggle(session)}
            />
            <span class="toggle-slider"></span>
          </label>
          <button class="icon-btn" onclick={() => onEdit(session)} title="Edit">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="icon-btn delete" onclick={() => onDelete(session.id)} title="Delete">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    {:else}
      <p class="empty">No zen windows created yet</p>
    {/each}
  </div>

  <div class="bottom-section">
    <button class="add-btn" onclick={onAdd}>+ Add Zen Window</button>
    <button
      class="settings-btn"
      class:selected={selectedId === 'settings'}
      onclick={() => onSelect('settings')}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
      Settings
    </button>
  </div>
</div>

<style>
  .session-list {
    display: flex;
    flex-direction: column;
    height: 100%;
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

  .add-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 0.75rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .add-btn:hover {
    background: #2563eb;
  }

  .list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .session-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    transition: all 0.2s;
  }

  .session-item:hover {
    border-color: #d1d5db;
  }

  .session-item.selected {
    background: #eff6ff;
    border-color: #3b82f6;
  }

  .session-item.disabled {
    opacity: 0.6;
  }

  .session-item.dragging {
    opacity: 0.5;
    background: #e5e7eb;
  }

  .drag-handle {
    cursor: grab;
    color: #9ca3af;
    padding: 0.25rem;
    flex-shrink: 0;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .session-content {
    flex: 1;
    display: flex;
    align-items: center;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    padding: 0;
  }

  .session-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
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

  .session-days {
    font-size: 0.75rem;
    color: #9ca3af;
  }

  .session-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .toggle {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
  }

  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background-color: #d1d5db;
    transition: 0.3s;
    border-radius: 20px;
  }

  .toggle-slider::before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 2px;
    bottom: 2px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }

  .toggle input:checked + .toggle-slider {
    background-color: #3b82f6;
  }

  .toggle input:checked + .toggle-slider::before {
    transform: translateX(16px);
  }

  .icon-btn {
    padding: 0.375rem;
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    border-radius: 0.25rem;
    transition: all 0.2s;
  }

  .icon-btn:hover {
    background: #e5e7eb;
    color: #374151;
  }

  .icon-btn.delete:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  .empty {
    text-align: center;
    color: #9ca3af;
    padding: 2rem;
    font-size: 0.875rem;
  }

  .top-section {
    padding: 0.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .bottom-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;
    border-top: 1px solid #e5e7eb;
  }

  .settings-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }

  .settings-btn:hover {
    background: #e5e7eb;
  }

  .settings-btn.selected {
    background: #eff6ff;
    border-color: #3b82f6;
    color: #1d4ed8;
  }

  .global-card {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    transition: all 0.2s;
  }

  .global-card:hover {
    border-color: #d1d5db;
  }

  .global-card.selected {
    background: #eff6ff;
    border-color: #3b82f6;
  }

  .global-card.disabled {
    opacity: 0.6;
  }

  .global-content {
    flex: 1;
    display: flex;
    align-items: center;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    padding: 0;
  }

  .global-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .global-name {
    font-weight: 500;
    color: #374151;
    font-size: 0.875rem;
  }

  .global-count {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .global-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
</style>
