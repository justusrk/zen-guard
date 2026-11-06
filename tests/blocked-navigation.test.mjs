import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const safeUrl = 'https://work.example/document?section=2'
const blockedUrl = 'https://distraction.example/'

function createWorker({ session = {}, fallback = false } = {}) {
  const listeners = {}
  const redirects = []
  const updates = []
  const event = name => ({ addListener: callback => { listeners[name] = callback } })
  const blocked = { blocked: true, rule: { id: 'rule', name: 'Distractions' } }
  const mocks = {
    '@/lib/rules-engine': {
      evaluateUrlOnly: async url => url === blockedUrl ? blocked : { blocked: false },
      evaluateUrl: async () => blocked
    },
    '@/lib/session-manager': { getActiveSession: async () => null },
    '@/lib/storage': {
      getStats: async () => ({}),
      incrementBlockCount: async () => {},
      getGlobalMessage: async () => ''
    },
    '@/lib/youtube': {
      isYouTubeVideoPage: () => false,
      isYouTubeChannelPage: () => false
    }
  }
  const chrome = {
    storage: { session: {
      get: async key => structuredClone({ [key]: session[key] }),
      set: async values => { Object.assign(session, structuredClone(values)) },
      remove: async key => { delete session[key] }
    } },
    tabs: {
      sendMessage: async (_id, message) => {
        if (fallback) throw new Error('No content script')
        redirects.push(message.url)
      },
      update: async (_id, options) => { redirects.push(options.url); updates.push(options) },
      onRemoved: event('removed')
    },
    webNavigation: {
      onCommitted: event('committed'),
      onHistoryStateUpdated: event('history')
    },
    runtime: {
      getURL: path => `chrome-extension://zen-guard/${path}`,
      onMessage: event('message'),
      onInstalled: event('installed')
    },
    alarms: { create() {}, onAlarm: event('alarm') }
  }
  const modules = new Map()
  function load(path) {
    if (mocks[path]) return mocks[path]
    if (modules.has(path)) return modules.get(path)
    const filename = path.startsWith('@/') ? `src/${path.slice(2)}.ts` : path
    const source = readFileSync(filename, 'utf8').replaceAll('import.meta.env.DEV', 'false')
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    })
    const exports = {}
    modules.set(path, exports)
    new Function('require', 'exports', 'chrome', 'setTimeout', outputText)(load, exports, chrome, callback => callback())
    return exports
  }
  load('src/background/service-worker.ts')
  return {
    session, redirects, updates,
    navigate: (url, type = 'committed', tabId = 1) => listeners[type]({ tabId, url, frameId: 0, transitionType: 'link' }),
    scan: async url => {
      listeners.message({ type: 'SCAN_RESULT', result: {} }, { tab: { id: 1, url } }, () => {})
      await new Promise(resolve => setImmediate(resolve))
    },
    keywordBlock: async url => {
      listeners.message({ type: 'KEYWORD_BLOCK', url, keyword: 'distraction', ruleId: 'rule', ruleName: 'Keyword' }, { tab: { id: 1, url } }, () => {})
      await new Promise(resolve => setImmediate(resolve))
    },
    remove: tabId => listeners.removed(tabId)
  }
}

for (const fallback of [false, true]) {
  test(`block page links to preceding URL (${fallback ? 'fallback' : 'content script'} redirect)`, async () => {
    const worker = createWorker({ fallback })
    await worker.navigate(safeUrl)
    await worker.navigate(blockedUrl)
    assert.equal(new URL(worker.redirects.at(-1)).searchParams.get('returnUrl'), safeUrl)
  })
}

test('SPA content block preserves the previous route across worker restarts', async () => {
  const worker = createWorker()
  await worker.navigate(safeUrl)
  const videoUrl = 'https://work.example/video'
  await worker.navigate(videoUrl, 'history')
  const restarted = createWorker({ session: worker.session })
  await restarted.scan(videoUrl)
  assert.equal(new URL(restarted.redirects.at(-1)).searchParams.get('returnUrl'), safeUrl)
})

test('reloading and retrying a blocked URL retains the preceding page', async () => {
  const worker = createWorker()
  await worker.navigate(safeUrl)
  await worker.navigate(blockedUrl)
  await worker.navigate(worker.redirects.at(-1))
  await worker.navigate(blockedUrl)
  assert.equal(new URL(worker.redirects.at(-1)).searchParams.get('returnUrl'), safeUrl)
})

test('keyword blocks use the same return destination', async () => {
  const worker = createWorker()
  await worker.navigate(safeUrl)
  const contentUrl = 'https://work.example/article'
  await worker.navigate(contentUrl)
  await worker.keywordBlock(contentUrl)
  assert.equal(new URL(worker.redirects.at(-1)).searchParams.get('returnUrl'), safeUrl)
})

test('first navigation in a tab has no return URL; other tabs stay isolated', async () => {
  const worker = createWorker()
  await worker.navigate(safeUrl, 'committed', 2)
  await worker.navigate(blockedUrl)
  assert.equal(new URL(worker.redirects.at(-1)).searchParams.has('returnUrl'), false)
})

test('closed tabs clear navigation state', async () => {
  const worker = createWorker()
  await worker.navigate(safeUrl)
  await worker.remove(1)
  assert.deepEqual(worker.session, {})
})
