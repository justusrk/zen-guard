export type RuleType =
  | 'blacklist_exact'
  | 'whitelist_exact'
  | 'blacklist_keyword'
  | 'whitelist_keyword'
  | 'yt_channel_blacklist'
  | 'yt_channel_whitelist'

export interface Rule {
  id: string
  name: string
  type: RuleType
  value: string
  values: string[]
  isRegex: boolean
  enabled: boolean
  order: number
  skipRemaining: boolean
  searchInUrl: boolean
  searchInHeading: boolean
  searchInBody: boolean
  message?: string
}

export interface Session {
  id: string
  name: string
  startTime: string
  endTime: string
  daysOfWeek: number[]
  enabled: boolean
  rules: Rule[]
  message?: string
  order: number
}

export interface Settings {
  globalMessage?: string
  motivationMessages?: string[]
  globalRulesEnabled?: boolean
}

export interface BlockEvent {
  url: string
  reason: string
  timestamp: number
  ruleName: string
}

export interface Stats {
  blocksThisWeek: number
  weekStartDate: string
  blockHistory: BlockEvent[]
}

export interface StorageData {
  sessions: Session[]
  globalRules: Rule[]
  stats: Stats
  settings: Settings
}

export interface EvaluationResult {
  blocked: boolean
  rule: Rule | null
  session?: Session | null
  reason?: string
}

export interface ContentScanResult {
  hasKeywordMatch: boolean
  matchedKeyword?: string
  youtubeChannel?: string
  youtubeChannelId?: string
  pageHeadings?: string
  pageContent?: string
}

export type MessageType =
  | { type: 'SCAN_PAGE'; url: string }
  | { type: 'SCAN_RESULT'; result: ContentScanResult }
  | { type: 'GET_STATUS' }
  | { type: 'STATUS_RESPONSE'; activeSession: Session | null; stats: Stats }
