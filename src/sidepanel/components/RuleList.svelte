<script lang="ts">
  import type { Rule } from '@/lib/types'

  interface Props {
    rules: Rule[]
    title: string
    onAdd: () => void
    onEdit: (rule: Rule) => void
    onDelete: (id: string) => void
    onToggle: (rule: Rule) => void
    onReorder: (rules: Rule[]) => void
  }

  let { rules, title, onAdd, onEdit, onDelete, onToggle, onReorder }: Props = $props()

  let draggedIndex = $state<number | null>(null)
  let pendingRules = $state<Rule[] | null>(null)
  let dragStartRules = $state<Rule[] | null>(null)

  const ruleTypeLabels: Record<string, string> = {
    'blacklist_exact': 'Block URLs',
    'whitelist_exact': 'Allow URLs',
    'blacklist_keyword': 'Block Keyword',
    'whitelist_keyword': 'Allow Keyword',
    'yt_channel_blacklist': 'Block YT Channels',
    'yt_channel_whitelist': 'Allow YT Channels',
  }

  function getValueDisplay(rule: Rule): string {
    const isListType = ['blacklist_exact', 'whitelist_exact', 'yt_channel_blacklist', 'yt_channel_whitelist'].includes(rule.type)
    if (isListType) {
      const values = Array.isArray(rule.values) && rule.values.length > 0 ? rule.values : (rule.value ? [rule.value] : [])
      if (values.length === 0) return 'No items'
      if (values.length === 1) return values[0]
      return `${values.length} items`
    }
    return rule.value || ''
  }

  const ruleTypeColors: Record<string, { bg: string; text: string }> = {
    'blacklist_exact': { bg: '#fee2e2', text: '#dc2626' },
    'whitelist_exact': { bg: '#dcfce7', text: '#16a34a' },
    'blacklist_keyword': { bg: '#fef3c7', text: '#d97706' },
    'whitelist_keyword': { bg: '#dbeafe', text: '#2563eb' },
    'yt_channel_blacklist': { bg: '#fce7f3', text: '#db2777' },
    'yt_channel_whitelist': { bg: '#e0e7ff', text: '#4f46e5' },
  }

  function handleDragStart(e: DragEvent, index: number) {
    // Don't start drag if rules are empty
    if (!rules || rules.length === 0) return

    draggedIndex = index
    // Capture a deep copy of rules at drag start to avoid reactivity issues
    dragStartRules = rules.map(r => ({
      ...r,
      values: Array.isArray(r.values) ? [...r.values] : []
    }))
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', index.toString())
    }
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    if (!dragStartRules || dragStartRules.length === 0) return

    // Use captured rules from drag start, or pending rules if already reordered
    const sourceRules = pendingRules ?? dragStartRules

    // Safety check
    if (!sourceRules || sourceRules.length === 0) return
    if (draggedIndex < 0 || draggedIndex >= sourceRules.length) return

    const newRules: Rule[] = sourceRules.map(r => ({
      ...r,
      values: Array.isArray(r.values) ? [...r.values] : []
    }))

    const [removed] = newRules.splice(draggedIndex, 1)
    if (!removed) return

    newRules.splice(index, 0, removed)

    newRules.forEach((rule, i) => {
      rule.order = i
    })

    draggedIndex = index
    pendingRules = newRules
  }

  function handleDragEnd() {
    if (pendingRules && pendingRules.length > 0) {
      // Create a final deep copy for saving
      const rulesToSave = pendingRules.map(r => ({
        ...r,
        values: Array.isArray(r.values) ? [...r.values] : []
      }))
      onReorder(rulesToSave)
    }
    pendingRules = null
    dragStartRules = null
    draggedIndex = null
  }
</script>

<div class="rule-list">
  <div class="header">
    <h3>{title}</h3>
    <button class="add-btn" onclick={onAdd}>+ Add Rule</button>
  </div>

  {#if rules.length === 0}
    <p class="empty">No rules configured</p>
  {:else}
    {@const displayRules = pendingRules ?? rules}
    <div class="rules">
      {#each displayRules as rule, index (rule.id)}
        <div
          class="rule-item"
          class:disabled={!rule.enabled}
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

          <div class="rule-content">
            <div class="rule-header">
              <span class="rule-name">{rule.name}</span>
              <span
                class="rule-type"
                style="background: {ruleTypeColors[rule.type]?.bg}; color: {ruleTypeColors[rule.type]?.text}"
              >
                {ruleTypeLabels[rule.type]}
              </span>
            </div>
            <div class="rule-value">
              {getValueDisplay(rule)}
              {#if rule.isRegex}
                <span class="regex-badge">regex</span>
              {/if}
            </div>
          </div>

          <div class="rule-actions">
            <label class="toggle">
              <input
                type="checkbox"
                checked={rule.enabled}
                onchange={() => onToggle(rule)}
              />
              <span class="toggle-slider"></span>
            </label>
            <button class="icon-btn" onclick={() => onEdit(rule)} title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="icon-btn delete" onclick={() => onDelete(rule.id)} title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .rule-list {
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

  .add-btn {
    padding: 0.375rem 0.75rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .add-btn:hover {
    background: #2563eb;
  }

  .empty {
    text-align: center;
    color: #9ca3af;
    padding: 2rem;
    font-size: 0.875rem;
  }

  .rules {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .rule-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    transition: all 0.2s;
  }

  .rule-item:hover {
    border-color: #d1d5db;
  }

  .rule-item.disabled {
    opacity: 0.6;
  }

  .rule-item.dragging {
    opacity: 0.5;
    background: #e5e7eb;
  }

  .drag-handle {
    cursor: grab;
    color: #9ca3af;
    padding: 0.25rem;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .rule-content {
    flex: 1;
    min-width: 0;
  }

  .rule-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .rule-name {
    font-weight: 500;
    color: #374151;
    font-size: 0.875rem;
  }

  .rule-type {
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.625rem;
    font-weight: 500;
    text-transform: uppercase;
  }

  .rule-value {
    font-size: 0.75rem;
    color: #6b7280;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .regex-badge {
    padding: 0.0625rem 0.375rem;
    background: #f3f4f6;
    border-radius: 0.25rem;
    font-size: 0.625rem;
    color: #6b7280;
  }

  .rule-actions {
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
</style>
