/**
 * Stock photography for seeded/demo content.
 *
 * Every URL here points at Wikimedia Commons' `upload.wikimedia.org` CDN: freely
 * licensed, permanently addressable, and reachable from any network without a
 * key, a signature or an expiring token. That last part is the requirement —
 * these URLs are handed to mobile clients and to the admin dashboard, so they
 * have to resolve from anywhere, not just from a developer's machine.
 *
 * Why not a placeholder service: the demo data previously used
 * `picsum.photos/seed/<slug>` (a *random* photo per seed — a landscape rendered
 * for "Pickup Basketball Game") and `res.cloudinary.com/demo/...` paths that
 * never existed and answered 404. Both are replaced here by a photo that
 * actually depicts the activity.
 *
 * Rules for editing this file:
 * - Every URL must be verified to return `200 image/*` before it is committed.
 *   A guessed CDN id is how the dead Cloudinary URLs got here in the first place.
 * - Keep the keys aligned with `photoSlug` in `seed-demo.ts`; `db-fix-photos.ts`
 *   resolves existing rows through the same map, so the seeder and the repair
 *   script can never drift apart.
 */

const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons';

/** One photo per sport/theme, keyed by the topic it depicts. */
export const STOCK_PHOTOS = {
  football: `${COMMONS}/thumb/7/77/DFC_5330_Two_players_battle_for_possession_during_an_evening_soccer_match_at_Klet_Kaeo_field_in_Sattahip_Chon_Buri.jpg/960px-DFC_5330_Two_players_battle_for_possession_during_an_evening_soccer_match_at_Klet_Kaeo_field_in_Sattahip_Chon_Buri.jpg`,
  cycling: `${COMMONS}/thumb/5/57/Nighttime_Bike_Ride_%2853601565637%29.jpg/960px-Nighttime_Bike_Ride_%2853601565637%29.jpg`,
  cyclingGroup: `${COMMONS}/thumb/f/f9/Nighttime_Bike_Ride_%2853602648333%29.jpg/960px-Nighttime_Bike_Ride_%2853602648333%29.jpg`,
  swimming: `${COMMONS}/thumb/6/62/Swimming_Pool_Lanes_%28194912721%29.jpeg/960px-Swimming_Pool_Lanes_%28194912721%29.jpeg`,
  basketball: `${COMMONS}/thumb/f/f8/Minnesota_Lynx_teammates_huddle_on_the_court_in_the_Lynx_vs_Sun_game_at_Target_Center.jpg/960px-Minnesota_Lynx_teammates_huddle_on_the_court_in_the_Lynx_vs_Sun_game_at_Target_Center.jpg`,
  skiing: `${COMMONS}/thumb/1/12/Gosau_seen_from_the_ski_slope%2C_2009_%2801%29.jpg/960px-Gosau_seen_from_the_ski_slope%2C_2009_%2801%29.jpg`,
  skiingSlope: `${COMMONS}/thumb/d/d8/Gosau_seen_from_the_ski_slope%2C_2009_%2803%29.jpg/960px-Gosau_seen_from_the_ski_slope%2C_2009_%2803%29.jpg`,
  climbing: `${COMMONS}/thumb/f/ff/Man_climbing_in_bouldering_gym.jpg/960px-Man_climbing_in_bouldering_gym.jpg`,
  tennis: `${COMMONS}/f/f4/Doubles_match_on_outside_court_at_Wimbledon_1988_-_geograph.org.uk_-_2473163.jpg`,
  tableTennis: `${COMMONS}/thumb/e/e4/Table_Tennis_04.jpg/960px-Table_Tennis_04.jpg`,
  badminton: `${COMMONS}/thumb/8/88/2014_US_Open_Grand_Prix_Gold_-_Men%27s_doubles_final_match_1.jpg/960px-2014_US_Open_Grand_Prix_Gold_-_Men%27s_doubles_final_match_1.jpg`,
  handball: `${COMMONS}/thumb/4/4c/Andreas_Nilsson_throwing_1_DKB_Handball_Bundesliga_HSG_Wetzlar_vs_HSV_Hamburg_2014-02_08.jpg/960px-Andreas_Nilsson_throwing_1_DKB_Handball_Bundesliga_HSG_Wetzlar_vs_HSV_Hamburg_2014-02_08.jpg`,
  golf: `${COMMONS}/thumb/7/7e/Schreiner_Golf_Course_Kerrville_Texas.jpg/960px-Schreiner_Golf_Course_Kerrville_Texas.jpg`,
  boxing: `${COMMONS}/thumb/d/d0/US_Navy_081011-N-5345W-057_Cryptologic_Technician_Networks_Seaman_Janea_Arrington_connects_with_a_straight_right_to_the_jaw_of_Aviation_Ordnanceman_Airman_Nakita_Boyd_during_a_sparring_session.jpg/960px-thumbnail.jpg`,
  rowing: `${COMMONS}/4/4d/Gail_Marie_and_Teign_Spirit%2C_river_beach%2C_Teignmouth_-_geograph.org.uk_-_1325181.jpg`,
  walking: `${COMMONS}/thumb/4/42/Sky_Meadows_hikers-on-trail-resized_%2817955838200%29.jpg/960px-Sky_Meadows_hikers-on-trail-resized_%2817955838200%29.jpg`,
  autumn: `${COMMONS}/thumb/4/4e/Autumn_forest_%2815389095799%29.jpg/960px-Autumn_forest_%2815389095799%29.jpg`,
} as const;

export type StockPhotoKey = keyof typeof STOCK_PHOTOS;

/**
 * `photoSlug` (as used by `seed-demo.ts`) → the photo that depicts it.
 *
 * A few entries deliberately ignore the activity's *category* and follow the
 * activity itself: "Historic Park Run" is filed under Football but is a fun run,
 * so it gets the walking photo. Showing a football pitch there would be exactly
 * the mismatch this file exists to remove.
 */
export const PHOTO_BY_SLUG: Record<string, StockPhotoKey> = {
  'sunset-football-match': 'football',
  'beginner-football-clinic': 'football',
  'weekend-cycling-tour': 'cycling',
  'community-pool-swim': 'swimming',
  'pickup-basketball-game': 'basketball',
  'alpine-skiing-weekend': 'skiing',
  'cancelled-ski-trip': 'skiingSlope',
  'indoor-climbing-session': 'climbing',
  'doubles-tennis-tournament': 'tennis',
  'table-tennis-social': 'tableTennis',
  'badminton-club-night': 'badminton',
  'handball-friendly-match': 'handball',
  'golf-morning-round': 'golf',
  'charity-boxing-sparring': 'boxing',
  'sunday-rowing-practice': 'rowing',
  'historic-park-run': 'walking',
  'morning-hike-lavaux': 'walking',
};

/**
 * Activity *name* → photo, for rows that no seeder produced.
 *
 * These are the hand-entered activities that carried the dead Cloudinary URLs.
 * Their `categoryId` is unreliable (a lakeside walk filed under Badminton), so
 * the name is the better signal.
 */
export const PHOTO_BY_ACTIVITY_NAME: Record<string, StockPhotoKey> = {
  'Lakeside Morning Walk': 'walking',
  'Autumn Photography Outing': 'autumn',
  'Lakeside Morning Ride': 'cyclingGroup',
  'Autumn Colours Ride': 'cyclingGroup',
};

/** Category name → photo, the fallback when neither slug nor name is known. */
export const PHOTO_BY_CATEGORY: Record<string, StockPhotoKey> = {
  Football: 'football',
  Cycling: 'cycling',
  Swimming: 'swimming',
  Basketball: 'basketball',
  Skiing: 'skiing',
  Climbing: 'climbing',
  Tennis: 'tennis',
  'Table Tennis': 'tableTennis',
  Badminton: 'badminton',
  Handball: 'handball',
  Golf: 'golf',
  Boxing: 'boxing',
  Rowing: 'rowing',
};

/** Pravatar serves real face photos over HTTPS from any network. */
export const avatarUrl = (pravatarId: number): string => `https://i.pravatar.cc/300?img=${pravatarId}`;

/** Resolve a slug to a URL, falling back to the walking photo for unknown slugs. */
export const activityPhotoUrl = (slug: string): string =>
  STOCK_PHOTOS[PHOTO_BY_SLUG[slug] ?? 'walking'];

/**
 * Keyword fallback, tried after the slug and exact-name maps but *before* the
 * category.
 *
 * The category is an unreliable last resort on this data: rows such as
 * "Dashboard QA Approved Ride" are filed under Badminton, and resolving them by
 * category put a badminton match on a bike ride. The activity's own wording is
 * the better signal. Order matters — "Table Tennis" must be tested before the
 * bare "tennis" pattern would claim it.
 */
export const PHOTO_BY_KEYWORD: ReadonlyArray<readonly [RegExp, StockPhotoKey]> = [
  [/table\s*tennis|ping[-\s]?pong/i, 'tableTennis'],
  [/badminton|shuttlecock/i, 'badminton'],
  [/photograph|autumn|foliage/i, 'autumn'],
  [/\bride\b|cycl|\bbike\b|bicycle/i, 'cyclingGroup'],
  [/\bwalk|hike|hiking|\brun\b|trail|stroll/i, 'walking'],
  [/swim|\bpool\b/i, 'swimming'],
  [/\bski\b|skiing|slope|snow/i, 'skiing'],
  [/football|soccer/i, 'football'],
  [/basketball/i, 'basketball'],
  [/handball/i, 'handball'],
  [/tennis/i, 'tennis'],
  [/climb|boulder/i, 'climbing'],
  [/\bgolf\b/i, 'golf'],
  [/box(ing)?\b|spar/i, 'boxing'],
  [/row(ing)?\b|scull|regatta/i, 'rowing'],
];

/**
 * Pick the photo that best describes an activity.
 *
 * Precedence: the seeder's slug (exact), the activity name (exact), a keyword in
 * the name, then the category, then a neutral outdoors photo. Everything above
 * the category is there because a row's `categoryId` frequently does not
 * describe it on this data.
 */
export const resolveActivityPhoto = (
  activityName: string,
  categoryName?: string,
  slug?: string,
): string => {
  const key =
    (slug ? PHOTO_BY_SLUG[slug] : undefined) ??
    PHOTO_BY_ACTIVITY_NAME[activityName] ??
    PHOTO_BY_KEYWORD.find(([pattern]) => pattern.test(activityName))?.[1] ??
    PHOTO_BY_CATEGORY[categoryName ?? ''] ??
    'walking';
  return STOCK_PHOTOS[key];
};

/** Every url this catalogue can produce — used to spot rows we set ourselves. */
export const STOCK_PHOTO_URLS: ReadonlySet<string> = new Set(Object.values(STOCK_PHOTOS));
