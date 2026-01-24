<script lang="ts">
  import { onMount } from 'svelte'
  import type { Session, Rule } from '@/lib/types'
  import {
    getSessions,
    saveSession,
    saveSessions,
    deleteSession,
    getGlobalRules,
    saveGlobalRules,
    addRuleToSession,
    deleteRuleFromSession,
    updateSessionRules,
    getSettings,
    saveSettings
  } from '@/lib/storage'
  import { exportConfig, importConfig } from '@/lib/config-io'
  import SessionList from './components/SessionList.svelte'
  import SessionForm from './components/SessionForm.svelte'
  import RuleList from './components/RuleList.svelte'
  import RuleForm from './components/RuleForm.svelte'
  import SettingsPage from './components/SettingsPage.svelte'
  import GlobalMessageForm from './components/GlobalMessageForm.svelte'
  import ToastContainer, { type ToastMessage } from './components/ToastContainer.svelte'
  import ConfirmDialog from './components/ConfirmDialog.svelte'

  const isDev = import.meta.env.DEV
  const log = (...args: unknown[]) => isDev && console.log('[ZenGuard]', ...args)

  let sessions = $state<Session[]>([])
  let globalRules = $state<Rule[]>([])
  let globalRulesEnabled = $state(true)
  let globalMessage = $state('')
  let selectedId = $state<string | null>(null)
  let showSessionForm = $state(false)
  let editingSession = $state<Session | null>(null)
  let showRuleForm = $state(false)
  let editingRule = $state<Rule | null>(null)
  let showGlobalMessageForm = $state(false)
  let fileInputEl: HTMLInputElement | null = null
  let toasts = $state<ToastMessage[]>([])

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const id = crypto.randomUUID()
    toasts = [...toasts, { id, message, type }]
  }

  function removeToast(id: string) {
    toasts = toasts.filter(t => t.id !== id)
  }

  // Confirm dialog state
  interface ConfirmOptions {
    title?: string
    message: string
    confirmText?: string
    cancelText?: string
    destructive?: boolean
  }

  let confirmDialogState = $state<{
    show: boolean
    options: ConfirmOptions
    resolve: ((value: boolean) => void) | null
  }>({
    show: false,
    options: { message: '' },
    resolve: null
  })

  function showConfirm(options: ConfirmOptions | string): Promise<boolean> {
    const opts = typeof options === 'string' ? { message: options } : options
    return new Promise((resolve) => {
      confirmDialogState = {
        show: true,
        options: opts,
        resolve
      }
    })
  }

  function handleConfirmResult(result: boolean) {
    if (confirmDialogState.resolve) {
      confirmDialogState.resolve(result)
    }
    confirmDialogState = {
      show: false,
      options: { message: '' },
      resolve: null
    }
  }

  const selectedSession = $derived(
    selectedId && selectedId !== 'global'
      ? sessions.find(s => s.id === selectedId) ?? null
      : null
  )

  const currentRules = $derived(
    selectedId === 'global' ? globalRules : (selectedSession?.rules ?? [])
  )

  const rulesTitle = $derived(
    selectedId === 'global'
      ? 'Global Rules'
      : selectedSession
        ? `Rules for ${selectedSession.name}`
        : 'Select a session'
  )

  async function loadData() {
    try {
      sessions = await getSessions()
      globalRules = await getGlobalRules()
      const settings = await getSettings()
      globalRulesEnabled = settings.globalRulesEnabled ?? true
      globalMessage = settings.globalMessage ?? ''
    } catch (error) {
      console.error('Failed to load data:', error)
    }
  }

  onMount(() => {
    loadData()
  })

  function handleSelectSession(id: string | null) {
    selectedId = id
  }

  function handleAddSession() {
    editingSession = null
    showSessionForm = true
  }

  function handleEditSession(session: Session) {
    editingSession = session
    showSessionForm = true
  }

  async function handleSaveSession(session: Omit<Session, 'id'> & { id?: string }) {
    try {
      const savedSession = await saveSession(session as Session)
      await loadData()
      showSessionForm = false
      editingSession = null
      if (!selectedId) {
        selectedId = savedSession.id
      }
    } catch (error) {
      console.error('Failed to save session:', error)
    }
  }

  async function handleDeleteSession(id: string) {
    const confirmed = await showConfirm({
      title: 'Delete Zen Window',
      message: 'Delete this Zen Window? This cannot be undone.',
      confirmText: 'Delete',
      destructive: true
    })
    if (confirmed) {
      await deleteSession(id)
      if (selectedId === id) {
        selectedId = null
      }
      await loadData()
    }
  }

  async function handleToggleSession(session: Session) {
    await saveSession({ ...session, enabled: !session.enabled })
    await loadData()
  }

  async function handleReorderSessions(reorderedSessions: Session[]) {
    // Safety check - don't save empty sessions array
    if (!reorderedSessions || reorderedSessions.length === 0) {
      console.warn('[ZenGuard] handleReorderSessions called with empty sessions, ignoring')
      return
    }

    try {
      await saveSessions(reorderedSessions)
      await loadData()
    } catch (error) {
      console.error('[ZenGuard] Failed to reorder sessions:', error)
      await loadData() // Reload to restore state
    }
  }

  function handleAddRule() {
    editingRule = null
    showRuleForm = true
  }

  function handleEditRule(rule: Rule) {
    editingRule = rule
    showRuleForm = true
  }

  async function handleSaveRule(rule: Omit<Rule, 'id'> & { id?: string }) {
    if (selectedId === 'global') {
      const existingIndex = globalRules.findIndex(r => r.id === rule.id)
      if (existingIndex >= 0) {
        globalRules[existingIndex] = rule as Rule
      } else {
        globalRules.push({ ...rule, id: crypto.randomUUID() } as Rule)
      }
      await saveGlobalRules(globalRules)
    } else if (selectedSession) {
      await addRuleToSession(selectedSession.id, rule)
    }
    await loadData()
    showRuleForm = false
    editingRule = null
  }

  async function handleDeleteRule(id: string) {
    const confirmed = await showConfirm({
      title: 'Delete Rule',
      message: 'Delete this rule?',
      confirmText: 'Delete',
      destructive: true
    })
    if (!confirmed) return

    if (selectedId === 'global') {
      globalRules = globalRules.filter(r => r.id !== id)
      await saveGlobalRules(globalRules)
    } else if (selectedSession) {
      await deleteRuleFromSession(selectedSession.id, id)
    }
    await loadData()
  }

  async function handleToggleRule(rule: Rule) {
    const updatedRule = { ...rule, enabled: !rule.enabled }
    if (selectedId === 'global') {
      const index = globalRules.findIndex(r => r.id === rule.id)
      if (index >= 0) {
        globalRules[index] = updatedRule
        await saveGlobalRules(globalRules)
      }
    } else if (selectedSession) {
      await addRuleToSession(selectedSession.id, updatedRule)
    }
    await loadData()
  }

  async function handleReorderRules(rules: Rule[]) {
    // Safety check - don't save empty rules array
    if (!rules || rules.length === 0) {
      console.warn('[ZenGuard] handleReorderRules called with empty rules, ignoring')
      return
    }

    try {
      if (selectedId === 'global') {
        globalRules = [...rules]
        await saveGlobalRules(rules)
      } else if (selectedSession && selectedId) {
        await updateSessionRules(selectedId, rules)
      }
      await loadData()
    } catch (error) {
      console.error('[ZenGuard] Failed to reorder rules:', error)
      await loadData() // Reload to restore state
    }
  }

  function getNextOrder(): number {
    return currentRules.length
  }

  async function handleGlobalToggle() {
    try {
      const settings = await getSettings()
      settings.globalRulesEnabled = !globalRulesEnabled
      await saveSettings(settings)
      globalRulesEnabled = settings.globalRulesEnabled
    } catch (error) {
      console.error('[ZenGuard] Failed to toggle global rules:', error)
    }
  }

  function handleGlobalMessageEdit() {
    showGlobalMessageForm = true
  }

  async function handleSaveGlobalMessage(message: string) {
    try {
      const settings = await getSettings()
      settings.globalMessage = message
      await saveSettings(settings)
      globalMessage = message
      showGlobalMessageForm = false
    } catch (error) {
      console.error('[ZenGuard] Failed to save global message:', error)
    }
  }

  async function handleExport() {
    try {
      await exportConfig()
      showToast('Configuration exported', 'success')
    } catch (error) {
      console.error('Failed to export config:', error)
      showToast('Failed to export configuration', 'error')
    }
  }

  function handleImportClick() {
    log('Import button clicked')
    const input = fileInputEl || document.getElementById('import-file-input') as HTMLInputElement
    log('File input element:', input)
    if (input) {
      input.click()
    } else {
      showToast('Could not find file input element', 'error')
    }
  }

  async function handleFileChange(event: Event) {
    log('handleFileChange triggered')
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    log('File selected:', file?.name, file?.size)
    if (!file) {
      log('No file selected')
      showToast('No file selected', 'error')
      return
    }

    const confirmed = await showConfirm({
      title: 'Import Configuration',
      message: 'This will replace all existing Zen Windows and rules. Continue?',
      confirmText: 'Import',
      destructive: true
    })
    if (!confirmed) {
      log('User cancelled import')
      input.value = ''
      return
    }

    log('User confirmed, starting import...')
    try {
      await importConfig(file)
      await loadData()
      selectedId = null
      showToast('Configuration imported successfully!', 'success')
    } catch (error) {
      console.error('[ZenGuard] Failed to import config:', error)
      showToast(error instanceof Error ? error.message : 'Failed to import configuration', 'error')
    }

    input.value = ''
  }
</script>

<input
  id="import-file-input"
  type="file"
  accept=".json"
  bind:this={fileInputEl}
  onchange={handleFileChange}
  style="position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0;"
/>

<div class="container">
  <aside class="sidebar">
    <div class="logo">
      <h1>Zen Guard</h1>
    </div>
    <SessionList
      {sessions}
      {selectedId}
      onSelect={handleSelectSession}
      onAdd={handleAddSession}
      onEdit={handleEditSession}
      onDelete={handleDeleteSession}
      onToggle={handleToggleSession}
      onReorder={handleReorderSessions}
      {globalRulesEnabled}
      globalRulesCount={globalRules.length}
      onGlobalToggle={handleGlobalToggle}
      onGlobalMessageEdit={handleGlobalMessageEdit}
    />
  </aside>

  <main class="content">
    {#if selectedId === 'settings'}
      <SettingsPage
        onExport={handleExport}
        onImport={handleImportClick}
        {showToast}
        {showConfirm}
      />
    {:else if selectedId}
      <RuleList
        rules={currentRules}
        title={rulesTitle}
        onAdd={handleAddRule}
        onEdit={handleEditRule}
        onDelete={handleDeleteRule}
        onToggle={handleToggleRule}
        onReorder={handleReorderRules}
      />
    {:else}
      <div class="empty-state">
        <h2>Welcome to Zen Guard</h2>
        <p>Create a Zen Window or select "Global Rules" to get started.</p>
        <p class="hint">Zen Windows activate blocking during specific times. Global rules apply always.</p>
      </div>
    {/if}
  </main>
</div>

{#if showSessionForm}
  <SessionForm
    session={editingSession}
    onSave={handleSaveSession}
    onCancel={() => { showSessionForm = false; editingSession = null; }}
  />
{/if}

{#if showRuleForm}
  <RuleForm
    rule={editingRule}
    nextOrder={getNextOrder()}
    onSave={handleSaveRule}
    onCancel={() => { showRuleForm = false; editingRule = null; }}
  />
{/if}

{#if showGlobalMessageForm}
  <GlobalMessageForm
    message={globalMessage}
    onSave={handleSaveGlobalMessage}
    onCancel={() => { showGlobalMessageForm = false; }}
  />
{/if}

<ToastContainer {toasts} onRemove={removeToast} />

{#if confirmDialogState.show}
  <ConfirmDialog
    title={confirmDialogState.options.title}
    message={confirmDialogState.options.message}
    confirmText={confirmDialogState.options.confirmText}
    cancelText={confirmDialogState.options.cancelText}
    destructive={confirmDialogState.options.destructive}
    onConfirm={() => handleConfirmResult(true)}
    onCancel={() => handleConfirmResult(false)}
  />
{/if}

<style>
  .container {
    display: flex;
    height: 100vh;
    width: 100%;
  }

  .sidebar {
    width: 280px;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    background: #fafafa;
  }

  .logo {
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .logo h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #374151;
  }

  .content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    text-align: center;
    color: #6b7280;
  }

  .empty-state h2 {
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
    font-weight: 600;
    color: #374151;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
  }

  .empty-state .hint {
    margin-top: 1rem;
    font-size: 0.75rem;
    color: #9ca3af;
  }
</style>
