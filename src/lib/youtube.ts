export function isYouTubeVideoPage(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return (
      (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') &&
      urlObj.pathname === '/watch'
    )
  } catch {
    return false
  }
}

export function isYouTubeChannelPage(url: string): boolean {
  try {
    const urlObj = new URL(url)
    if (urlObj.hostname !== 'www.youtube.com' && urlObj.hostname !== 'youtube.com') {
      return false
    }
    return urlObj.pathname.startsWith('/@') || urlObj.pathname.startsWith('/channel/')
  } catch {
    return false
  }
}

export function extractChannelFromDOM(): string | null {
  const channelNameElement = document.querySelector('#channel-name a')
  if (channelNameElement?.textContent) {
    return channelNameElement.textContent.trim()
  }

  const ownerElement = document.querySelector('ytd-channel-name a')
  if (ownerElement?.textContent) {
    return ownerElement.textContent.trim()
  }

  const metaOwner = document.querySelector('span[itemprop="author"] link[itemprop="name"]')
  if (metaOwner) {
    return metaOwner.getAttribute('content')
  }

  return null
}

export function extractChannelIdFromDOM(): string | null {
  // Try to get channel ID from channel link href
  const channelLink = document.querySelector('#channel-name a, ytd-channel-name a') as HTMLAnchorElement | null
  if (channelLink?.href) {
    const match = channelLink.href.match(/\/channel\/(UC[a-zA-Z0-9_-]+)/)
    if (match) return match[1]

    // Extract handle from /@handle links
    const handleMatch = channelLink.href.match(/\/@([a-zA-Z0-9_-]+)/)
    if (handleMatch) return `@${handleMatch[1]}`
  }

  // Try owner info in video metadata
  const ownerLink = document.querySelector('ytd-video-owner-renderer a') as HTMLAnchorElement | null
  if (ownerLink?.href) {
    const match = ownerLink.href.match(/\/channel\/(UC[a-zA-Z0-9_-]+)/)
    if (match) return match[1]

    const handleMatch = ownerLink.href.match(/\/@([a-zA-Z0-9_-]+)/)
    if (handleMatch) return `@${handleMatch[1]}`
  }

  return null
}

export function extractChannelFromInitialData(): string | null {
  const scripts = document.querySelectorAll('script')
  for (const script of scripts) {
    const content = script.textContent || ''
    if (content.includes('ytInitialData')) {
      try {
        const match = content.match(/var ytInitialData = ({.+?});/)
        if (match) {
          const data = JSON.parse(match[1])
          const owner = data?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.find(
            (c: Record<string, unknown>) => c.videoSecondaryInfoRenderer
          )?.videoSecondaryInfoRenderer?.owner?.videoOwnerRenderer?.title?.runs?.[0]?.text

          if (owner) return owner
        }
      } catch {
        // Parsing failed, continue
      }
    }
  }
  return null
}

export function extractChannelIdFromInitialData(): string | null {
  const scripts = document.querySelectorAll('script')
  for (const script of scripts) {
    const content = script.textContent || ''
    if (content.includes('ytInitialData')) {
      try {
        const match = content.match(/var ytInitialData = ({.+?});/)
        if (match) {
          const data = JSON.parse(match[1])

          // Try to get browseId from videoSecondaryInfoRenderer
          const secondaryInfo = data?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.find(
            (c: Record<string, unknown>) => c.videoSecondaryInfoRenderer
          )?.videoSecondaryInfoRenderer

          const browseId = secondaryInfo?.owner?.videoOwnerRenderer?.navigationEndpoint?.browseEndpoint?.browseId
          if (browseId) return browseId

          // Also try to get canonical channel URL which contains the handle
          const canonicalUrl = secondaryInfo?.owner?.videoOwnerRenderer?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl
          if (canonicalUrl?.startsWith('/@')) {
            return canonicalUrl // Returns /@handle format
          }
        }
      } catch {
        // Parsing failed, continue
      }
    }
  }
  return null
}

export function getYouTubeChannel(): string | null {
  let channel = extractChannelFromDOM()
  if (channel) return channel

  channel = extractChannelFromInitialData()
  return channel
}

export function getYouTubeChannelId(): string | null {
  let channelId = extractChannelIdFromDOM()
  if (channelId) return channelId

  channelId = extractChannelIdFromInitialData()
  return channelId
}

export function extractChannelFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    if (urlObj.pathname.startsWith('/@')) {
      // Keep the @ prefix for consistent matching
      return '@' + urlObj.pathname.slice(2).split('/')[0]
    }
    if (urlObj.pathname.startsWith('/channel/')) {
      return urlObj.pathname.split('/')[2]
    }
  } catch {
    return null
  }
  return null
}
