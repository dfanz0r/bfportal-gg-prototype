import type { Game } from '../src/shared/content'

// Rows the site needs before it has any content: categories, tag groups, SDK
// releases and both games' maps. Portal's own tags are in portal-tags.json.

export const experienceCategories: {
  name: string
  game: Game | null
  /** What is submitted in it is a template. */
  marksTemplate?: true
}[] = [
  { name: 'Multiplayer', game: null },
  { name: 'Co-op', game: null },
  { name: 'Solo', game: null },
  // The old site's "Prefab". In Battlefield 6 a template is a choice on the
  // form instead.
  { name: 'Templates', game: 'bf2042', marksTemplate: true },
]

export const scriptCategories = ['Rules', 'AI', 'Interface', 'Admin tools']

type TagGroupSeed = {
  game: Game
  name: string
  description: string
  filter: 'own' | 'shared' | 'none'
  creatorSelectable: boolean
  showOnCard: boolean
  /** Tags an admin would have added. Portal's own are added from the JSON. */
  tags: string[]
}

const STYLES = ['Casual', 'Competitive', 'Showcase', 'Example']

export const tagGroups: TagGroupSeed[] = [
  {
    game: 'bf2042',
    name: 'Era',
    description: 'The Battlefield games its factions and maps come from.',
    filter: 'own',
    // Not asked on the submit form: the maps in the rotation say.
    creatorSelectable: false,
    showOnCard: true,
    tags: [],
  },
  {
    game: 'bf2042',
    name: 'Rules',
    description: 'What Portal says the experience changes.',
    filter: 'shared',
    // Not asked on the submit form: Portal says, for the code.
    creatorSelectable: false,
    showOnCard: false,
    tags: [],
  },
  {
    game: 'bf2042',
    name: 'Style',
    description: 'Who it is for.',
    filter: 'own',
    creatorSelectable: true,
    showOnCard: true,
    tags: STYLES,
  },
  {
    game: 'bf2042',
    name: 'Topic',
    description: 'What kind of experience it is.',
    filter: 'shared',
    creatorSelectable: true,
    showOnCard: true,
    tags: [
      'Zombies',
      'Gun Game',
      'Conquest',
      'Rush',
      'Team Deathmatch',
      'Free For All',
      'Training',
      'Sniper',
      'Race',
    ],
  },
  {
    game: 'bf6',
    name: 'Rules',
    description: 'What Portal says the experience changes.',
    filter: 'shared',
    creatorSelectable: false,
    showOnCard: false,
    tags: [],
  },
  {
    game: 'bf6',
    name: 'Style',
    description: 'Who it is for.',
    filter: 'own',
    creatorSelectable: true,
    showOnCard: true,
    tags: STYLES,
  },
  {
    game: 'bf6',
    name: 'Topic',
    description: 'What kind of experience it is.',
    filter: 'shared',
    creatorSelectable: true,
    showOnCard: true,
    tags: [
      'Capture the Flag',
      'Zombies',
      'Gun Game',
      'Parkour',
      'Objective',
      'Infantry',
      'Vehicles',
      'Training',
    ],
  },
]

/** Portal's ids for the Battlefield 2042 tags that name an era. */
export const eraTagIds = [
  'kingston_era',
  '1942_era',
  'bc2_era',
  'bf3_era',
  'mapdefault_era',
]

/**
 * Spellings from the old site's 2022 bulk import, which tagged eras by hand.
 * Each is an alias of Portal's tag, so old links still find the filter.
 */
export const tagAliases: { game: Game; alias: string; portalId: string }[] = [
  { game: 'bf2042', alias: 'bf2042', portalId: 'kingston_era' },
  { game: 'bf2042', alias: 'bf1942', portalId: '1942_era' },
  { game: 'bf2042', alias: 'bfbc2', portalId: 'bc2_era' },
]

/** Battlefield 6 SDK releases, oldest first. Portal names only the latest. */
export const sdkReleases: { season: string; versions: string[] }[] = [
  { season: 'Launch', versions: ['1.0.1.0'] },
  { season: 'Season 1', versions: ['1.1.1.0', '1.1.2.0', '1.1.3.0'] },
  { season: 'Season 2', versions: ['1.2.1.0', '1.2.2.0', '1.2.3.0'] },
  {
    season: 'Season 3',
    versions: ['1.3.1.0', '1.3.1.1', '1.3.2.0', '1.3.3.0'],
  },
  { season: 'Season 4', versions: ['1.4.1.0', '1.4.2.0', '1.4.3.0'] },
]

const ART = 'https://eaassets-a.akamaihd.net/battlelog/battlebinary'

/**
 * Battlefield 6's maps. 27 are the scenes the Portal SDK ships, one per level
 * id; Fort Lyndon, Area 51 and Vegas Strip are not among those.
 *
 * Put together by hand from several places: names from EA's website, pictures
 * from Portal's own map picker, and whether a map needs the paid game from
 * gametools' license requirements list. A null is something nobody has
 * supplied yet. Names were checked against the Portal SDK's own list for
 * version 1.4.3.0.
 */
export const bf6Maps: {
  levelId: string
  name: string | null
  image: string | null
  requiresFullGame: boolean | null
}[] = [
  {
    levelId: 'MP_Abbasid',
    name: 'Siege of Cairo',
    image: 'gamedata/glacier/49/a3/T_UI_Abbasid_Large_OPT-49a3761a.webp',
    requiresFullGame: true,
  },
  {
    levelId: 'MP_Aftermath',
    name: 'Empire State',
    image: 'gamedata/glacier/bf/88/T_UI_Aftermath_Large_OPT-bf883df1.webp',
    requiresFullGame: true,
  },
  {
    levelId: 'MP_Aftermath_Portal',
    name: "Bellum1988's Operation Metro",
    image: 'gamedata/glacier/31/36/T_UI_Aftermath_Portal_OPT-3136bb0c.webp',
    requiresFullGame: true,
  },
  {
    levelId: 'MP_Atoll',
    name: 'Wake Island',
    image: 'gamedata/glacier/73/e9/T_UI_Atoll_Large_OPT-73e9e09b.webp',
    requiresFullGame: true,
  },
  {
    levelId: 'MP_Badlands',
    name: 'Blackwell Fields',
    image: 'gamedata/glacier/68/85/T_UI_Badlands_Large_OPT-6885eb83.webp',
    requiresFullGame: true,
  },
  {
    levelId: 'MP_Battery',
    name: 'Iberian Offensive',
    image: 'gamedata/glacier/03/4d/T_UI_Battery_Large_OPT-034d4636.webp',
    requiresFullGame: true,
  },
  {
    levelId: 'MP_Capstone',
    name: 'Liberation Peak',
    image: 'gamedata/glacier/2c/ca/T_UI_Capstone_Large_OPT-2ccae694.webp',
    requiresFullGame: true,
  },
  {
    levelId: 'MP_Contaminated',
    name: 'Contaminated',
    image: 'gamedata/glacier/da/1d/T_UI_Contaminated_Large_OPT-da1d04ef.webp',
    requiresFullGame: true,
  },
  {
    levelId: 'MP_DryLake',
    name: 'Area 51',
    image: null,
    requiresFullGame: null,
  },
  {
    levelId: 'MP_Dumbo',
    name: 'Manhattan Bridge',
    image: 'gamedata/glacier/20/de/T_UI_Dumbo_Large_OPT-20de031f.webp',
    requiresFullGame: true,
  },
  {
    levelId: 'MP_Eastwood',
    name: 'Eastwood',
    image: 'gamedata/glacier/3b/fa/T_UI_Eastwood_Large_OPT-3bfa6a6f.webp',
    requiresFullGame: true,
  },
  {
    levelId: 'MP_FireStorm',
    name: 'Operation Firestorm',
    image: 'gamedata/glacier/45/d5/T_UI_Firestorm_Large_OPT-45d582ad.webp',
    requiresFullGame: true,
  },
  {
    levelId: 'MP_GolmudRailway',
    name: 'Railway to Golmud',
    image: 'gamedata/glacier/76/66/T_UI_Golmud_Large_OPT-766653bf.webp',
    requiresFullGame: true,
  },
  {
    levelId: 'MP_Granite',
    name: 'Fort Lyndon',
    image: 'gamedata/glacier/68/e0/T_UI_Granite_01-68e04322.png',
    requiresFullGame: false,
  },
  {
    levelId: 'MP_Granite_ClubHouse_Portal',
    name: 'Golf Course',
    image:
      'glacier/vulcanite/maps/T_UI_Granite_Portal_05_Thumb_SML-74ea7be7.jpg',
    requiresFullGame: false,
  },
  {
    levelId: 'MP_Granite_MainStreet_Portal',
    name: 'Downtown',
    image:
      'glacier/vulcanite/maps/T_UI_Granite_Portal_01_Thumb_SML-c1924a54.jpg',
    requiresFullGame: null,
  },
  {
    levelId: 'MP_Granite_Marina_Portal',
    name: 'Marina',
    image:
      'glacier/vulcanite/maps/T_UI_Granite_Portal_02_Thumb_SML-bacdb856.jpg',
    requiresFullGame: null,
  },
  {
    levelId: 'MP_Granite_MilitaryRnD_Portal',
    name: 'Area 22B',
    image:
      'glacier/vulcanite/maps/T_UI_Granite_Portal_03_Thumb_SML-074dbb4f.jpg',
    requiresFullGame: null,
  },
  {
    levelId: 'MP_Granite_MilitaryStorage_Portal',
    name: 'Redline Storage',
    image:
      'glacier/vulcanite/maps/T_UI_Granite_Portal_04_Thumb_SML-e8d5744b.jpg',
    requiresFullGame: null,
  },
  {
    levelId: 'MP_Granite_TechCampus_Portal',
    name: 'Defense Nexus',
    image:
      'glacier/vulcanite/maps/T_UI_Granite_Portal_06_Thumb_SML-80099ba6.jpg',
    requiresFullGame: false,
  },
  {
    levelId: 'MP_Granite_Underground_Portal',
    name: 'Complex 3',
    image:
      'gamedata/glacier/64/29/T_UI_Granite_Portal_08_Large_OPT-64290f15.webp',
    requiresFullGame: null,
  },
  {
    levelId: 'MP_Isolated',
    name: 'Tsuru Reef',
    image: 'gamedata/glacier/58/9b/T_UI_Isolated_Large_OPT-589b9bf7.webp',
    requiresFullGame: true,
  },
  {
    levelId: 'MP_Limestone',
    name: 'Saints Quarter',
    image: 'gamedata/glacier/c9/16/T_UI_Limestone_Large_OPT-c9160897.webp',
    requiresFullGame: true,
  },
  {
    levelId: 'MP_Outskirts',
    name: 'New Sobek City',
    image: 'gamedata/glacier/bf/08/T_UI_Outskirts_Large_OPT-bf08f756.webp',
    requiresFullGame: true,
  },
  {
    levelId: 'MP_Paradise',
    name: 'Vegas Strip',
    image: null,
    requiresFullGame: null,
  },
  {
    levelId: 'MP_Plaza',
    name: 'Cairo Bazaar',
    image: 'gamedata/glacier/68/26/T_UI_Plaza_Large_OPT-6826467e.webp',
    requiresFullGame: true,
  },
  {
    levelId: 'MP_Portal_Ocean',
    name: 'Portal Ocean',
    image: 'gamedata/glacier/3f/e4/T_UI_Portal_Ocean_01_Large-3fe4b8ae.png',
    requiresFullGame: null,
  },
  {
    levelId: 'MP_Portal_Sand',
    name: 'Portal Sandbox',
    image:
      'gamedata/glacier/31/b3/T_UI_Granite_Portal_07_Large_OPT-31b3ad28.webp',
    requiresFullGame: false,
  },
  {
    levelId: 'MP_Subsurface',
    name: 'Hagental Base',
    image: 'gamedata/glacier/a0/9a/T_UI_Subsurface_Large_OPT-a09a144f.webp',
    requiresFullGame: true,
  },
  {
    levelId: 'MP_Tungsten',
    name: 'Mirak Valley',
    image: 'gamedata/glacier/93/5d/T_UI_Tungsten_Large_OPT-935da06b.webp',
    requiresFullGame: true,
  },
].map((map) => ({ ...map, image: map.image && `${ART}/${map.image}` }))

/**
 * Battlefield 2042's Portal maps, each with the Portal tag for the game it
 * came from. The list and the pictures are the old site's.
 */
export const bf2042Maps: {
  levelId: string
  name: string
  era: string
  image: string
}[] = [
  {
    levelId: 'MP_Orbital',
    name: 'Orbital',
    era: 'kingston_era',
    image: 'gamedata/kingston/d1/5a/Map_Art_BF2042_ORB_L-d15a84f6.png',
  },
  {
    levelId: 'MP_Hourglass',
    name: 'Hourglass',
    era: 'kingston_era',
    image: 'gamedata/kingston/95/35/Map_Art_BF2042_HG_L-9535453c.png',
  },
  {
    levelId: 'MP_Kaleidoscope',
    name: 'Kaleidoscope',
    era: 'kingston_era',
    image: 'gamedata/kingston/6b/a7/Map_Art_BF2042_KS_L-6ba702e0.png',
  },
  {
    levelId: 'MP_Irreversible',
    name: 'Breakaway',
    era: 'kingston_era',
    image: 'gamedata/kingston/19/ee/Map_Art_BF2042_IRR_L-19eeef98.png',
  },
  {
    levelId: 'MP_Discarded',
    name: 'Discarded',
    era: 'kingston_era',
    image: 'gamedata/kingston/76/46/Map_Art_BF2042_DIS_L-764694ca.png',
  },
  {
    levelId: 'MP_LongHaul',
    name: 'Manifest',
    era: 'kingston_era',
    image: 'gamedata/kingston/22/b3/Map_Art_BF2042_LH_L-22b32735.png',
  },
  {
    levelId: 'MP_TheWall',
    name: 'Renewal',
    era: 'kingston_era',
    image: 'gamedata/kingston/ad/09/Map_Art_BF2042_TW_L-ad09f15f.png',
  },
  {
    levelId: 'MP_Ridge',
    name: 'Exposure',
    era: 'kingston_era',
    image: 'gamedata/kingston/66/e8/Map_Art_BF2042_RID_L-66e845a2.png',
  },
  {
    levelId: 'MP_Drained',
    name: 'Stranded',
    era: 'kingston_era',
    image: 'gamedata/kingston/d7/5f/Map_Art_BF2042_DRA_L-d75f98a0.png',
  },
  {
    levelId: 'MP_LightsOut',
    name: 'Spearhead',
    era: 'kingston_era',
    image: 'pyrite/images/Map_Art_BF2042_LO-ce4a8588.jpg',
  },
  {
    levelId: 'MP_Boulder',
    name: 'Flashpoint',
    era: 'kingston_era',
    image: 'pyrite/images/Map_Art_BF2042_BOL-215cc9e7.jpg',
  },
  {
    levelId: 'MP_Scarred',
    name: 'Reclaimed',
    era: 'kingston_era',
    image: 'pyrite/images/Map_Art_BF2042_SC-91339cd1.jpg',
  },
  {
    levelId: 'MP_Harbor',
    name: 'Arica Harbor',
    era: 'bc2_era',
    image: 'gamedata/kingston/60/b4/Map_Art_BFBC2_AH_L-60b49760.png',
  },
  {
    levelId: 'MP_LightHouse',
    name: 'Valparaiso',
    era: 'bc2_era',
    image: 'gamedata/kingston/60/03/Map_Art_BFBC2_VP_L-600385e2.png',
  },
  {
    levelId: 'MP_Frost',
    name: 'Battle of the Bulge',
    era: '1942_era',
    image: 'gamedata/kingston/25/59/Map_Art_BF1942_BB_L-2559980c.png',
  },
  {
    levelId: 'MP_Oasis',
    name: 'El Alamein',
    era: '1942_era',
    image: 'gamedata/kingston/d7/d3/Map_Art_BF1942_EA_L-d7d3186f.png',
  },
  {
    levelId: 'MP_Rural',
    name: 'Caspian Border',
    era: 'bf3_era',
    image: 'gamedata/kingston/df/50/Map_Art_BF3_CB_L-df505a1f.png',
  },
  {
    levelId: 'MP_Port',
    name: 'Noshahr Canals',
    era: 'bf3_era',
    image: 'gamedata/kingston/41/a1/Map_Art_BF3_NC_L-41a1e94f.png',
  },
].map((map) => ({ ...map, image: `${ART}/${map.image}` }))
