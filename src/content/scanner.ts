import type { Rule } from '@/lib/types'

export function scanForKeywords(content: string, rules: Rule[]): { matched: boolean; rule: Rule | null; keyword: string | null } {
  const keywordRules = rules.filter(
    r => r.enabled && (r.type === 'blacklist_keyword' || r.type === 'whitelist_keyword')
  )

  for (const rule of keywordRules) {
    let matches = false

    if (rule.isRegex) {
      try {
        const regex = new RegExp(rule.value, 'i')
        matches = regex.test(content)
      } catch {
        matches = content.toLowerCase().includes(rule.value.toLowerCase())
      }
    } else {
      matches = content.toLowerCase().includes(rule.value.toLowerCase())
    }

    if (matches) {
      return { matched: true, rule, keyword: rule.value }
    }
  }

  return { matched: false, rule: null, keyword: null }
}

export function getPageContent(): string {
  return document.body?.innerText || ''
}

export function waitForContent(timeout: number = 3000): Promise<string> {
  return new Promise((resolve) => {
    if (document.readyState === 'complete') {
      setTimeout(() => resolve(getPageContent()), 500)
      return
    }

    const timeoutId = setTimeout(() => {
      resolve(getPageContent())
    }, timeout)

    window.addEventListener('load', () => {
      clearTimeout(timeoutId)
      setTimeout(() => resolve(getPageContent()), 500)
    }, { once: true })
  })
}
