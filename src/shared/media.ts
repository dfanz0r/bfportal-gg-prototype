// The links an experience's gallery is made of. Each is kept as it was
// typed, and worked out here into what the page shows: a picture, or a
// video drawn as its thumbnail and played in an embedded player.

export type Media =
  | { kind: 'image'; url: string }
  | {
      kind: 'video'
      /** The link as it was typed, which also plays it on YouTube itself. */
      url: string
      thumbnail: string
      /** The player, to load once someone presses play. */
      embed: string
    }

/** Why a link cannot be shown. */
export type MediaProblem = 'not-https' | 'not-a-video' | 'video-site'

const YOUTUBE_HOSTS = ['youtube.com', 'youtube-nocookie.com', 'youtu.be']
/** Other video sites, whose links would otherwise be taken for pictures. */
const OTHER_VIDEO_HOSTS = ['twitch.tv', 'vimeo.com']
const VIDEO_ID = /^[\w-]{11}$/
/** Paths that end in a video's id, such as `/shorts/<id>`. */
const ID_PATHS = ['shorts', 'embed', 'live', 'v']

const onHost = (hostname: string, hosts: string[]) =>
  hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))

/** YouTube's `t=`, which is seconds or a time such as `1m30s`. */
function seconds(value: string | null) {
  const parts = value?.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/)
  if (!parts) return 0
  const [, hours = 0, minutes = 0, rest = 0] = parts
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(rest)
}

function youtubeId(address: URL) {
  const [first, second] = address.pathname.split('/').filter(Boolean)
  const id = address.hostname.endsWith('youtu.be')
    ? first
    : first === 'watch'
      ? address.searchParams.get('v')
      : ID_PATHS.includes(first ?? '')
        ? second
        : undefined
  return id && VIDEO_ID.test(id) ? id : undefined
}

/** What a link shows in a gallery, or why it cannot be shown. */
export function mediaOf(
  link: string,
): Media | { kind: 'none'; problem: MediaProblem } {
  let address: URL
  try {
    address = new URL(link.trim())
  } catch {
    return { kind: 'none', problem: 'not-https' }
  }
  if (address.protocol !== 'https:') {
    return { kind: 'none', problem: 'not-https' }
  }
  if (onHost(address.hostname, OTHER_VIDEO_HOSTS)) {
    return { kind: 'none', problem: 'video-site' }
  }
  if (!onHost(address.hostname, YOUTUBE_HOSTS)) {
    return { kind: 'image', url: address.href }
  }
  const id = youtubeId(address)
  if (!id) return { kind: 'none', problem: 'not-a-video' }
  const start = seconds(
    address.searchParams.get('t') ?? address.searchParams.get('start'),
  )
  return {
    kind: 'video',
    url: address.href,
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    // The privacy-enhanced player sets no cookies until it is played.
    embed: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1${start ? `&start=${start}` : ''}`,
  }
}

/** The links that can be shown, worked out, in their order. */
export const shownMedia = (links: string[]) =>
  links.map(mediaOf).filter((media): media is Media => media.kind !== 'none')
