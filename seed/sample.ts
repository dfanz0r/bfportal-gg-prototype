import type {
  ContentStatus,
  ExperienceType,
  Game,
  PlaytestStatus,
  PortalState,
  ReportType,
  TesterRegion,
} from '../src/shared/content'
import type { Role } from '../src/shared/roles'

// Made-up people and content, after the mockups. Everything that needs
// invented words (update posts, playtest briefs, pending edits, flags) hangs
// off these, never off the real experiences in bf6-experiences.json, so no
// real creator is shown saying something they did not.
//
// Times are days before the moment the seed runs, so "this week" stays this
// week. A negative number is in the future.

export const people: { key: string; name: string; role?: Role }[] = [
  { key: 'matavatar', name: 'Matavatar' },
  { key: 'gala', name: 'Gala' },
  { key: 'kestrel', name: 'kestrel', role: 'moderator' },
  { key: 'battlefielddad', name: 'BattlefieldDad' },
  { key: 'vantage', name: 'vantage' },
  { key: 'north-sector', name: 'north_sector' },
  { key: 'roflkartoffel', name: 'RoflKartoffelDE' },
]

const TILE =
  'https://eaassets-a.akamaihd.net/battlelog/battlebinary/glacier/preApprovedThumbnails'

/** Portal's stock cover pictures, which any experience may use. */
export const stockCovers = [
  'Portal_Experience_Tile_MP_01-ab6fbd7c.jpg',
  'Portal_Experience_Tile_MP_04-66df560b.jpg',
  'Portal_Experience_Tile_MP_05-58cedadf.jpg',
  'Portal_Experience_Tile_Mrktg_04-3ea223f2.jpg',
  'Portal_Experience_Tile_Mrktg_07-b7cc3a7a.jpg',
  'Portal_Experience_Tile_Mrktg_09-10df4570.jpg',
  'Portal_Experience_Tile_RG_02-61f2a47b.jpg',
].map((file) => `${TILE}/${file}`)

export type Rotation = {
  map: string
  mode: string
  rounds: number
  teams: number[]
}[]

const rotation = (mode: string, teams: number[], ...maps: string[]): Rotation =>
  maps.map((map) => ({ map, mode, rounds: 1, teams }))

export type SampleCreator =
  | { user: string; canEdit?: boolean; invited?: boolean }
  | { name: string }

export type SampleExperience = {
  slug: string
  game: Game
  title: string
  description: string
  owner: string
  category: string
  code: string | null
  players: number
  bots?: number
  rotation?: Rotation
  /** An index into `stockCovers`. A 2042 one uses its first map's picture. */
  cover?: number
  gallery?: number[]
  status?: ContentStatus
  /** Days since it was published, or submitted if it never was. */
  age: number
  likes: number
  types?: ExperienceType[]
  isTemplate?: boolean
  style?: string
  topics?: string[]
  portalTags?: string[]
  creators?: SampleCreator[]
  featured?: boolean
  trending?: boolean
  bugged?: boolean
  portalState?: PortalState
  /** Days since Portal's answer became what it is. */
  portalStateAge?: number
  xpMode?: string
  /** Portal's id for it, and whether its creator lets others copy it. */
  playgroundId?: string
  copyAllowed?: boolean
  sdk?: string
  repoUrl?: string
  filesUrl?: string
  reviewNote?: string
  /** A moderator's notes on particular fields, by the form's field names. */
  reviewFieldNotes?: Record<string, string>
  deleted?: boolean
  reports?: Partial<Record<ReportType, number>>
}

export const experiences: SampleExperience[] = [
  // Battlefield 6. The first carries most of what an experience page shows.
  {
    slug: 'capture-the-flag-siege-of-cairo',
    game: 'bf6',
    title: 'Capture the Flag: Siege of Cairo',
    description:
      'Get to the opposing flag, pick it up and carry it home. A dropped flag returns to its base after fifteen seconds, and the first team to three captures takes the round.\n\nSudden death starts when the timer runs out with the score level: the next capture wins.',
    owner: 'matavatar',
    category: 'Multiplayer',
    code: '12qx8',
    players: 32,
    rotation: rotation(
      'Custom',
      [16, 16],
      'MP_Abbasid',
      'MP_Tungsten',
      'MP_Aftermath',
    ),
    cover: 0,
    gallery: [1, 2, 3],
    age: 29,
    likes: 44,
    types: ['script', 'blocks', 'spatial'],
    isTemplate: true,
    style: 'Competitive',
    topics: ['Capture the Flag', 'Objective', 'Infantry'],
    portalTags: ['custom_scripted'],
    creators: [
      { user: 'gala', canEdit: true },
      { user: 'kestrel' },
      { user: 'north-sector', canEdit: true, invited: true },
      { name: 'Coupe' },
    ],
    featured: true,
    trending: true,
    xpMode: 'portal-unranked',
    // Not a real experience, so neither of its Portal pages exists.
    playgroundId: '00000000-0000-4000-8000-000000000001',
    copyAllowed: true,
    sdk: '1.4.3.0',
    repoUrl: 'https://github.com/matavatar/ctf-siege-of-cairo',
  },
  {
    slug: 'zombies-last-light',
    game: 'bf6',
    title: 'Zombies: Last Light',
    description:
      'Four players hold a blacked-out street against waves of bots. Every fifth wave brings a boss, and the lights come back for thirty seconds when you beat it.',
    owner: 'battlefielddad',
    category: 'Co-op',
    code: '1zpr7',
    players: 4,
    bots: 60,
    rotation: rotation('Custom', [4, 60], 'MP_Dumbo'),
    cover: 3,
    age: 41,
    likes: 37,
    types: ['script', 'spatial'],
    style: 'Casual',
    topics: ['Zombies'],
    portalTags: ['custom_scripted', 'Asymmetrical'],
    trending: true,
    xpMode: 'portal-unranked',
    // Two seasons behind: the page says so.
    sdk: '1.3.2.0',
  },
  {
    slug: 'gun-master-2-0',
    game: 'bf6',
    title: 'Gun Master 2.0',
    description:
      'Thirty weapons, one kill each, finishing with the defibrillator. A knife kill sets your victim back a weapon.',
    owner: 'matavatar',
    category: 'Multiplayer',
    code: '1xq89',
    players: 24,
    rotation: rotation('Custom', [12, 12], 'MP_Subsurface', 'MP_Plaza'),
    cover: 6,
    age: 12,
    likes: 52,
    types: ['blocks'],
    style: 'Casual',
    topics: ['Gun Game'],
    portalTags: ['custom_scripted', 'custom_loadouts'],
    featured: true,
    trending: true,
    xpMode: 'portal-unranked',
    sdk: '1.4.2.0',
  },
  {
    slug: 'jump-school',
    game: 'bf6',
    title: 'Jump School',
    description:
      'Twelve parkour routes over the rooftops, each with a par time. Routes 9 to 12 are new.',
    owner: 'matavatar',
    category: 'Solo',
    code: '1w9c2',
    players: 8,
    rotation: rotation('Custom', [8], 'MP_Aftermath'),
    cover: 4,
    age: 60,
    likes: 18,
    types: ['script', 'spatial'],
    style: 'Showcase',
    topics: ['Parkour', 'Training'],
    portalTags: ['custom_scripted'],
    xpMode: 'portal-unranked',
    sdk: '1.4.1.0',
  },
  {
    // Flagged by its players, and still published on Portal.
    slug: 'spearhead-extraction',
    game: 'bf6',
    title: 'Spearhead Extraction',
    description:
      'Three squads, one helicopter. Grab the intel and get out before the other two do.',
    owner: 'vantage',
    category: 'Multiplayer',
    code: '13ktm',
    players: 12,
    rotation: rotation('Custom', [4, 4, 4], 'MP_Battery'),
    cover: 5,
    age: 20,
    likes: 9,
    types: ['script'],
    topics: ['Objective'],
    portalTags: ['custom_scripted'],
    bugged: true,
    reports: { bugged: 9, broken: 1 },
    xpMode: 'portal-unranked',
    sdk: '1.3.3.0',
  },
  {
    // Portal no longer knows the code. Only the nightly check says so.
    slug: 'rooftop-gun-game',
    game: 'bf6',
    title: 'Rooftop Gun Game',
    description: 'Gun game on the Empire State rooftops. Mind the edge.',
    owner: 'north-sector',
    category: 'Multiplayer',
    code: '1bdx4',
    players: 16,
    rotation: rotation('Custom', [8, 8], 'MP_Aftermath'),
    cover: 2,
    age: 75,
    likes: 14,
    types: ['blocks'],
    topics: ['Gun Game'],
    portalState: 'missing',
    portalStateAge: 10,
    reports: { broken: 6 },
    xpMode: 'portal-unranked',
  },
  {
    // A template shared as files only. A template needs no code.
    slug: 'movement-lab',
    game: 'bf6',
    title: 'Movement Lab',
    description:
      'A bare map with ramps, gaps and a timer, for building movement modes on. Take the files and add your own course.',
    owner: 'gala',
    category: 'Solo',
    code: null,
    players: 8,
    cover: 1,
    age: 6,
    likes: 7,
    types: ['script', 'spatial'],
    isTemplate: true,
    style: 'Example',
    topics: ['Training'],
    portalState: 'unchecked',
    sdk: '1.4.3.0',
    repoUrl: 'https://github.com/gala/movement-lab',
    filesUrl: 'https://github.com/gala/movement-lab/releases',
  },
  {
    // A verified mode: official settings and a rotation, nothing custom.
    slug: 'friday-night-conquest',
    game: 'bf6',
    title: 'Friday Night Conquest',
    description: 'Conquest on four maps, full XP. Nothing changed.',
    owner: 'battlefielddad',
    category: 'Multiplayer',
    code: '1bhhn',
    players: 64,
    rotation: rotation(
      'Conquest large',
      [32, 32],
      'MP_Tungsten',
      'MP_FireStorm',
      'MP_Capstone',
      'MP_Atoll',
    ),
    cover: 0,
    age: 3,
    likes: 21,
    types: ['verified'],
    style: 'Casual',
    portalTags: ['Core_Modes'],
    xpMode: 'portal-default',
  },
  // Waiting for a moderator, or turned away.
  {
    slug: 'bridge-parkour-trials',
    game: 'bf6',
    title: 'Bridge Parkour Trials',
    description: 'Time trials across the cables of Manhattan Bridge.',
    owner: 'gala',
    category: 'Solo',
    code: '1r5wd',
    players: 8,
    rotation: rotation('Custom', [8], 'MP_Dumbo'),
    cover: 4,
    status: 'pending',
    age: 0.2,
    likes: 0,
    types: ['script', 'spatial'],
    topics: ['Parkour'],
    sdk: '1.4.3.0',
  },
  {
    slug: 'free-xp-24-7',
    game: 'bf6',
    title: 'Free XP 24/7',
    description: 'xp xp xp',
    owner: 'north-sector',
    category: 'Multiplayer',
    code: '19tq2',
    players: 64,
    cover: 2,
    // Not to be fixed and sent in again: there is nothing to fix.
    status: 'removed',
    age: 2,
    likes: 0,
    reviewNote: 'A duplicate of an existing page, and an XP farm.',
  },
  // Sent back by a moderator, with a note on each field that needs changing.
  {
    slug: 'night-convoy',
    game: 'bf6',
    title: 'Night Convoy',
    description: 'Escort a convoy at night.',
    owner: 'gala',
    category: 'Co-op',
    code: '1nc4v',
    players: 4,
    status: 'changes_requested',
    age: 3,
    likes: 0,
    types: ['script'],
    reviewNote: 'Two changes are needed before this can be approved.',
    reviewFieldNotes: {
      description:
        'The description is a single sentence. Describe what the escorts and the attackers each do, and how a round ends.',
      coverImgUrl: 'There is no cover. Provide a 16:9 image.',
    },
  },
  // Saved and not sent in. Only its owner sees it.
  {
    slug: 'hangar-duel',
    game: 'bf6',
    title: 'Hangar Duel',
    description: 'One on one in a closed hangar. Still being built.',
    owner: 'gala',
    category: 'Multiplayer',
    code: null,
    players: 2,
    cover: 3,
    status: 'draft',
    age: 5,
    likes: 0,
  },
  {
    slug: 'old-test-mode',
    game: 'bf6',
    title: 'Old test mode',
    description: 'Deleted by its owner. Nothing shows this.',
    owner: 'vantage',
    category: 'Multiplayer',
    code: '1n2hk',
    players: 16,
    cover: 1,
    age: 90,
    likes: 0,
    deleted: true,
  },

  // Battlefield 2042. Era comes from the maps as well as from Portal's tags.
  {
    slug: 'rush-classic-arica-harbor',
    game: 'bf2042',
    title: 'Rush Classic: Arica Harbor',
    description:
      'Bad Company 2 Rush as it was: four sets of M-COMs, 75 tickets, no specialists.',
    owner: 'matavatar',
    category: 'Multiplayer',
    code: 'aat4kd',
    players: 32,
    rotation: rotation('Rush', [16, 16], 'MP_Harbor', 'MP_LightHouse'),
    age: 800,
    likes: 58,
    style: 'Competitive',
    topics: ['Rush'],
    portalTags: ['bc2_era', 'hero_restrictions', 'even_team_sizes'],
    featured: true,
    portalState: 'published',
    xpMode: 'portal-default',
  },
  {
    slug: 'zombies-hourglass',
    game: 'bf2042',
    title: 'Zombies: Hourglass',
    description:
      'Survivors against melee-only bots in the sandstorm. The bots get faster every wave.',
    owner: 'battlefielddad',
    category: 'Co-op',
    code: 'aar9xm',
    players: 8,
    bots: 56,
    rotation: rotation('Custom', [8, 56], 'MP_Hourglass'),
    age: 700,
    likes: 49,
    topics: ['Zombies'],
    portalTags: ['kingston_era', 'custom_scripted', 'fixed_ai', 'asym_teams'],
    xpMode: 'portal-unranked',
  },
  {
    // Map Faction and maps from every era, like PAYLOAD on the old site.
    slug: 'gun-master-2042',
    game: 'bf2042',
    title: 'Gun Master 2042',
    description: 'Thirty weapons across four eras, on a map from each.',
    owner: 'gala',
    category: 'Multiplayer',
    code: 'aas2tp',
    players: 24,
    rotation: rotation(
      'Custom',
      [12, 12],
      'MP_Orbital',
      'MP_Harbor',
      'MP_Oasis',
      'MP_Rural',
    ),
    age: 640,
    likes: 45,
    topics: ['Gun Game'],
    portalTags: ['mapdefault_era', 'custom_scripted', 'no_vehicles'],
    xpMode: 'portal-unranked',
  },
  {
    slug: 'conquest-1942-128-players',
    game: 'bf2042',
    title: 'Conquest 1942, 128 players',
    description: 'El Alamein and Battle of the Bulge with every slot filled.',
    owner: 'north-sector',
    category: 'Multiplayer',
    code: 'aaq7ln',
    players: 128,
    rotation: rotation('Conquest Large', [64, 64], 'MP_Oasis', 'MP_Frost'),
    age: 900,
    likes: 40,
    style: 'Casual',
    topics: ['Conquest'],
    portalTags: ['1942_era', 'high_player_count'],
    xpMode: 'portal-default',
  },
  {
    slug: 'noshahr-tdm-24-7',
    game: 'bf2042',
    title: 'Noshahr TDM 24/7',
    description: 'Team deathmatch in the containers. Battlefield 3 kits only.',
    owner: 'vantage',
    category: 'Multiplayer',
    code: 'aaj2fg',
    players: 32,
    rotation: rotation('Team Deathmatch', [16, 16], 'MP_Port'),
    age: 500,
    likes: 27,
    topics: ['Team Deathmatch'],
    portalTags: ['bf3_era', 'no_vehicles', 'custom_loadouts'],
    xpMode: 'portal-default',
  },
  {
    // The code is gone, which the 2042 library hides unless asked.
    slug: 'tank-superiority-el-alamein',
    game: 'bf2042',
    title: 'Tank Superiority: El Alamein',
    description: 'Tanks only, three flags, 1942 armor against 2042 armor.',
    owner: 'north-sector',
    category: 'Multiplayer',
    code: 'aak6db',
    players: 48,
    rotation: rotation('Custom', [24, 24], 'MP_Oasis'),
    age: 760,
    likes: 23,
    portalTags: ['1942_era', 'kingston_era', 'vehicle_superiority'],
    portalState: 'missing',
    portalStateAge: 210,
    xpMode: 'portal-default',
  },
  {
    slug: 'wingsuit-race-breakaway',
    game: 'bf2042',
    title: 'Wingsuit Race: Breakaway',
    description: 'Jump from the rig and thread the rings down to the ice.',
    owner: 'gala',
    category: 'Solo',
    code: 'aap3hv',
    players: 16,
    rotation: rotation('Custom', [16], 'MP_Irreversible'),
    age: 610,
    likes: 31,
    style: 'Showcase',
    topics: ['Race'],
    portalTags: ['kingston_era', 'custom_scripted', 'xp_restricted'],
    xpMode: 'portal-unranked',
  },
  {
    // In the old Prefab category, now Templates.
    slug: 'squad-drill-range',
    game: 'bf2042',
    title: 'Squad Drill Range',
    description:
      'A firing range with moving targets and a scoreboard, to copy into your own experience.',
    owner: 'matavatar',
    category: 'Templates',
    code: null,
    players: 4,
    rotation: rotation('Custom', [4], 'MP_Kaleidoscope'),
    age: 820,
    likes: 12,
    isTemplate: true,
    style: 'Example',
    topics: ['Training'],
    portalTags: ['custom_scripted'],
    portalState: 'unchecked',
  },
]

/** An edit waiting for a moderator, on a published experience. */
export const pendingEdit = {
  experience: 'capture-the-flag-siege-of-cairo',
  by: 'gala',
  age: 0.45,
  payload: {
    title: 'Capture the Flag: Siege of Cairo',
    descriptionMd:
      'Get to the opposing flag, pick it up and carry it home. A dropped flag returns to its base after ten seconds, and the first team to three captures takes the round.',
    credits: ['Coupe', 'Byte'],
  },
}

/** A file shared with a template. The site keeps these as text. */
export const sharedFile = {
  experience: 'capture-the-flag-siege-of-cairo',
  filename: 'Script.ts',
  body: `// Returns a dropped flag to its base after a delay.
const RETURN_AFTER_SECONDS = 15

export function OnFlagDropped(flag: mod.Flag) {
  mod.Wait(RETURN_AFTER_SECONDS)
  if (!mod.IsCarried(flag)) {
    mod.ReturnToBase(flag)
  }
}
`,
}

export const snippets = [
  {
    slug: 'ai-wave-spawner',
    title: 'AI wave spawner',
    description:
      'Spawns escalating waves of bots from every spawner you tag "wave" in the spatial editor. Each wave is larger than the last, and every fifth one brings a boss.',
    owner: 'matavatar',
    category: 'AI',
    age: 29,
    likes: 34,
    sdk: '1.4.3.0',
    featured: true,
    repoUrl: 'https://github.com/matavatar/portal-wave-spawner',
    script: `// Spawns escalating waves of bots from every spawner tagged "wave".
const config = { firstWave: 8, growth: 1.35, bossEvery: 5, restSeconds: 20 }

let wave = 0

export function OnGameModeStarted() {
  startNextWave()
}

function startNextWave() {
  wave += 1
  const size = Math.round(config.firstWave * config.growth ** (wave - 1))
  const spawners = mod.GetSpawnersWithTag('wave')
  for (let i = 0; i < size; i++) {
    mod.SpawnAI(spawners[i % spawners.length], mod.Team.Team2)
  }
}
`,
  },
  {
    slug: 'round-based-economy',
    title: 'Round-based economy',
    description:
      'Buy phases, kill rewards and loss bonuses, driven by one config object.',
    owner: 'roflkartoffel',
    category: 'Rules',
    age: 16,
    likes: 41,
    sdk: '1.3.3.0',
    featured: false,
    repoUrl: null,
    script: `// Money for kills, a bonus for losing streaks, and a buy phase each round.
const economy = { start: 800, kill: 300, lossBonus: [1400, 1900, 2400] }

export function OnRoundStarted() {
  mod.OpenBuyMenu(mod.AllPlayers(), 20)
}
`,
  },
]

export const updates: {
  experience?: string
  snippet?: string
  author: string
  title: string
  body: string
  status?: ContentStatus
  age: number
}[] = [
  {
    experience: 'capture-the-flag-siege-of-cairo',
    author: 'matavatar',
    title: 'Version 1.3: sudden death and a third map',
    body: 'Level at the timer now means sudden death: the next capture wins. Empire State joins the rotation, with the flags on opposite rooftops.',
    age: 0.2,
  },
  {
    experience: 'capture-the-flag-siege-of-cairo',
    author: 'gala',
    title: 'Version 1.2: balance pass',
    body: 'Flag carriers no longer sprint, and a dropped flag returns after fifteen seconds instead of thirty.',
    age: 15,
  },
  {
    experience: 'zombies-last-light',
    author: 'battlefielddad',
    title: 'Looking for testers: four-player hard mode',
    body: 'Hard mode halves the ammo and adds a second boss on wave ten. I need to know whether it can be beaten at all.',
    age: 1.3,
  },
  {
    experience: 'gun-master-2-0',
    author: 'matavatar',
    title: 'Fixed: the knife demotion applied twice',
    body: 'A knife kill was setting the victim back two weapons. It is one again.',
    age: 4,
  },
  {
    // Waiting for a moderator.
    experience: 'jump-school',
    author: 'matavatar',
    title: 'Routes 9 to 12',
    body: 'Four new routes over the north rooftops. Par times are a first guess.',
    status: 'pending',
    age: 0.3,
  },
  {
    snippet: 'ai-wave-spawner',
    author: 'matavatar',
    title: 'Boss waves are now configurable',
    body: 'Set how often a boss wave arrives and what it spawns, all from the config object. Existing setups keep working.',
    age: 0.6,
  },
]

export const playtests: {
  experience?: string
  title?: string
  game: Game
  code: string
  host: string
  summary: string
  brief: string
  regions: TesterRegion[]
  status: PlaytestStatus
  /** Days since it opened, and days until it closes (negative once closed). */
  opened: number
  closesIn: number | null
  resultUpdate?: string
}[] = [
  {
    experience: 'capture-the-flag-siege-of-cairo',
    game: 'bf6',
    code: '12qx8',
    host: 'matavatar',
    summary:
      'Sudden death and the flag positions on Mirak Valley need a full lobby to judge.',
    brief:
      'What to try\n\nPlay a full round on Mirak Valley and let the timer run out with the score level.\n\nPlease report\n\nWhether either flag is easier to reach, and anything odd when sudden death starts.',
    regions: ['eu'],
    status: 'approved',
    opened: 2,
    closesIn: 3,
  },
  {
    experience: 'zombies-last-light',
    game: 'bf6',
    code: '1zpr7',
    host: 'battlefielddad',
    summary:
      'Hard mode halves the ammo and adds a second boss on wave ten. Is it beatable?',
    brief:
      'What to try\n\nFour players, hard mode, as far as you can get.\n\nPlease report\n\nThe wave you died on and what killed you.',
    regions: ['eu', 'na'],
    status: 'approved',
    opened: 1,
    closesIn: 6,
  },
  {
    // No page yet, and held for a moderator.
    title: 'Three-squad extraction',
    game: 'bf6',
    code: '1v4mx',
    host: 'vantage',
    summary:
      'First test of the ruleset. Expect it to break, and tell me where.',
    brief: 'What to try\n\nAnything.\n\nPlease report\n\nEverything.',
    regions: ['na'],
    status: 'pending',
    opened: 0.25,
    closesIn: null,
  },
  {
    experience: 'gun-master-2-0',
    game: 'bf6',
    code: '1xq89',
    host: 'matavatar',
    summary: 'Does the knife demotion feel fair with thirty weapons?',
    brief:
      'What to try\n\nA full match.\n\nPlease report\n\nHow often you were set back.',
    regions: ['eu', 'na', 'oce'],
    status: 'approved',
    opened: 9,
    closesIn: -4,
    resultUpdate: 'Fixed: the knife demotion applied twice',
  },
]

export const events: {
  slug: string
  title: string
  summary: string
  host: string
  /** Days from now it starts, and how many hours it runs. */
  startsIn: number
  hours: number
  capacity: number | null
  interested: number
}[] = [
  {
    slug: 'new-experiences-playtest',
    title: 'New experiences playtest',
    summary:
      "We are playing this week's new experiences, with their creators on voice.",
    host: 'kestrel',
    // Under way now.
    startsIn: -0.04,
    hours: 3,
    capacity: 64,
    interested: 38,
  },
  {
    slug: 'friday-night-battlefield',
    title: 'Friday Night Battlefield',
    summary:
      "The weekly community night. Three experiences picked from this week's trending list.",
    host: 'battlefielddad',
    startsIn: 4,
    hours: 3,
    capacity: 64,
    interested: 27,
  },
  {
    slug: 'hardcore-rush-cup',
    title: 'Hardcore Rush Cup',
    summary: 'Eight teams of eight, single elimination.',
    host: 'north-sector',
    startsIn: 11,
    hours: 5,
    capacity: 64,
    interested: 19,
  },
  {
    slug: 'scripting-workshop',
    title: 'Scripting workshop',
    summary: 'From an empty script to a working game mode in ninety minutes.',
    host: 'matavatar',
    startsIn: -12,
    hours: 2,
    capacity: null,
    interested: 44,
  },
]

/** The notice across the home page, tied to the event that is under way. */
export const banner = {
  event: 'new-experiences-playtest',
  label: 'Live now',
  message: "We are playing this week's new experiences. Come and join.",
  linkLabel: 'See the event',
  by: 'kestrel',
}
