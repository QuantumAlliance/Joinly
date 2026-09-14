/**
 * Seed data for the mock backend.
 *
 * Every visible string, count and status here is lifted from the Figma frames
 * in `Dashboard figma design/` so the rendered screens can be diffed against them
 * directly. Volumes match the design too (12,540 users, 582 rows / 58 pages,
 * 124 notifications) — the small dev database never exercised pagination.
 */
import type {
  ActivityCard,
  ActivityDetails,
  AdminCategoryRow,
  AdminUserDetails,
  AdminUserRow,
  CategoryDistributionRow,
  ContactInfo,
  DashboardStatistics,
  MyProfile,
  NotificationRow,
  RecentActivityRow,
  RecentUserRow,
  UserStatus,
} from '../app/api/types';

/** Deterministic remote placeholders; every <img> falls back to initials. */
const face = (n: number) => `https://i.pravatar.cc/160?img=${n}`;
const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=640&q=70`;

export const GARDEN_PHOTO = photo('photo-1466692476868-aef1dfb1e735');
export const CERAMICS_PHOTO = photo('photo-1517673132405-a56a62b18caf');
export const MAP_THUMBNAIL = photo('photo-1524661135-423995f22d0b');

// ---------------------------------------------------------------- dashboard

export const statistics: DashboardStatistics = {
  totalUsers: 12540,
  totalActivities: 1248,
  totalRegistrations: 8412,
  pendingApprovals: 18,
};

export const categoryDistribution: CategoryDistributionRow[] = [
  { categoryName: 'Outdoor Activities', activityCount: 799, percentage: 64 },
  { categoryName: 'Indoor Crafts', activityCount: 275, percentage: 22 },
  { categoryName: 'Education & Tech', activityCount: 174, percentage: 14 },
];

export const recentUsers: RecentUserRow[] = [
  {
    id: 'ru-1',
    firstName: 'Jane',
    lastName: 'Dorsey',
    email: 'jane@example.com',
    profilePhoto: null,
    dateJoined: '2023-10-12',
    status: 'Active',
    type: 'Senior Member',
  },
  {
    id: 'ru-2',
    firstName: 'Marcus',
    lastName: 'Kane',
    email: 'm.kane@provider.com',
    profilePhoto: null,
    dateJoined: '2023-10-12',
    status: 'Active',
    type: 'Volunteer',
  },
  {
    id: 'ru-3',
    firstName: 'Elena',
    lastName: 'Lopez',
    email: 'elopez@mail.com',
    profilePhoto: null,
    dateJoined: '2023-10-11',
    status: 'Pending',
    type: 'Senior Member',
  },
  {
    id: 'ru-4',
    firstName: 'Brian',
    lastName: 'Thompson',
    email: 'brian.t@tech.org',
    profilePhoto: null,
    dateJoined: '2023-10-11',
    status: 'Active',
    type: 'Sponsor',
  },
];

export const recentActivities: RecentActivityRow[] = [
  {
    id: 'ra-1',
    activityName: 'Community Garden Day',
    activityPhoto: GARDEN_PHOTO,
    activityLocation: 'Oakridge Community Center',
    categoryName: 'Outdoor',
    activityDate: '2023-10-24',
    status: 'Pending',
  },
  ...Array.from({ length: 7 }, (_, i) => ({
    id: `ra-${i + 2}`,
    activityName: 'Ceramics Workshop',
    activityPhoto: CERAMICS_PHOTO,
    activityLocation: 'Art Studio B',
    categoryName: 'Indoor Craft',
    activityDate: `2023-10-2${(i % 5) + 1}`,
    status: 'Pending' as const,
  })),
];

// --------------------------------------------------------------- categories

export const categories: AdminCategoryRow[] = [
  { id: 'c-1', categoryName: 'Outdoor Gardening', activityCount: 24, status: 'Active' },
  { id: 'c-2', categoryName: 'Community Library', activityCount: 12, status: 'Active' },
  { id: 'c-3', categoryName: 'Local Sports', activityCount: 8, status: 'Active' },
  { id: 'c-4', categoryName: 'Art & Craft', activityCount: 15, status: 'Active' },
  { id: 'c-5', categoryName: 'Cooking Workshops', activityCount: 31, status: 'Active' },
  { id: 'c-6', categoryName: 'Workshops', activityCount: 19, status: 'Active' },
  { id: 'c-7', categoryName: 'Social Engagement', activityCount: 27, status: 'Active' },
  { id: 'c-8', categoryName: 'Health & Wellness', activityCount: 22, status: 'Active' },
  { id: 'c-9', categoryName: 'Music & Dance', activityCount: 11, status: 'Active' },
  { id: 'c-10', categoryName: 'Technology Help', activityCount: 9, status: 'Active' },
  { id: 'c-11', categoryName: 'Book Clubs', activityCount: 6, status: 'Disabled' },
  { id: 'c-12', categoryName: 'Day Trips', activityCount: 4, status: 'Disabled' },
];

// -------------------------------------------------------------------- users

/** The nine rows drawn in the Users frame, in order, plus the details subject. */
const figmaUsers: Array<[string, string, string, string, number, UserStatus]> = [
  ['Arthur', 'Thorne', 'arthur.thorne@provider.com', 'UK', 12, 'Active'],
  ['David', 'Kwan', 'david.kwan@provider.com', 'Canada', 3, 'Inactive'],
  ['Elena', 'Marquez', 'elena.marquez@provider.com', 'Spain', 7, 'Suspended'],
  ['Lars', 'Hansen', 'lars.hansen@provider.com', 'Denmark', 5, 'Active'],
  ['James', 'O’Neil', 'james.oneil@provider.com', 'USA', 20, 'Active'],
  ['Maya', 'Patel', 'maya.patel@provider.com', 'India', 8, 'Active'],
  ['Sofia', 'Moretti', 'sofia.moretti@provider.com', 'Italy', 14, 'Inactive'],
  ['Arthur', 'Thorne', 'arthur.thorne@provider.com', 'UK', 12, 'Active'],
  ['Fatima', 'Al-Sayed', 'fatima.alsayed@provider.com', 'UAE', 9, 'Active'],
  ['Arthur', 'Henderson', 'a.henderson@email.com', 'USA', 24, 'Active'],
];

const firstNames = ['Nora', 'Piotr', 'Yuki', 'Omar', 'Greta', 'Samuel', 'Ines', 'Tomas', 'Aisha', 'Henrik', 'Clara', 'Diego'];
const lastNames = ['Bennett', 'Kowalski', 'Tanaka', 'Haddad', 'Lindqvist', 'Okafor', 'Ferreira', 'Novak', 'Rahman', 'Berg', 'Dubois', 'Silva'];
const countries = ['UK', 'Canada', 'Spain', 'Denmark', 'USA', 'India', 'Italy', 'UAE', 'Germany', 'Brazil', 'Japan', 'France'];
const statusCycle: UserStatus[] = ['Active', 'Active', 'Active', 'Active', 'Inactive', 'Suspended', 'Pending', 'Blocked'];

/** 582 users — the total quoted in the Users frame's "Showing 1 to 10 of 582". */
export const users: AdminUserRow[] = Array.from({ length: 582 }, (_, i) => {
  if (i < figmaUsers.length) {
    const [firstName, lastName, email, country, activities, status] = figmaUsers[i];
    return {
      id: `u-${i + 1}`,
      firstName,
      lastName,
      email,
      country,
      activities,
      status,
      profilePhoto: face((i % 70) + 1),
      dateJoined: '2023-10-12',
    };
  }
  const firstName = firstNames[i % firstNames.length];
  const lastName = lastNames[(i * 7) % lastNames.length];
  return {
    id: `u-${i + 1}`,
    firstName,
    lastName,
    email: `${firstName}.${lastName}`.toLowerCase() + '@provider.com',
    country: countries[(i * 5) % countries.length],
    activities: (i * 3) % 26,
    status: statusCycle[i % statusCycle.length],
    profilePhoto: face((i % 70) + 1),
    dateJoined: `2023-09-${String((i % 28) + 1).padStart(2, '0')}`,
  };
});

/** The User Details frame — Arthur Henderson, seeded at u-10. */
export const userDetailsSeed: AdminUserDetails = {
  id: 'u-10',
  firstName: 'Arthur',
  lastName: 'Henderson',
  email: 'a.henderson@email.com',
  phoneNumber: '+1 (555) 012-3456',
  dateOfBirth: '1951-04-08',
  language: 'English',
  profilePhoto: face(12),
  country: 'USA',
  region: 'OR',
  city: 'Portland',
  role: 'User',
  status: 'Active',
  dateFormat: 'MM/DD/YYYY',
  notificationSounds: true,
  allowNotifications: true,
  isEmailVerified: true,
  memberSince: '2023-10-12',
  activityJoined: 24,
  activityCreated: 8,
  connections: 41,
  neighborhoodClusters: 4,
  interests: [
    { id: 'i-1', categoryName: 'Urban Gardening' },
    { id: 'i-2', categoryName: 'Community Cooking' },
    { id: 'i-3', categoryName: 'Dog Walking' },
    { id: 'i-4', categoryName: 'Chess' },
    { id: 'i-5', categoryName: 'Local History' },
  ],
  activitiesJoined: 24,
  activitiesCreated: 8,
  joinedActivities: [
    { id: 'ja-1', activityName: 'Community Garden Harvest', categoryName: 'Sustainability', activityDate: '2023-10-24', status: 'Completed' },
    { id: 'ja-2', activityName: 'Weekly Neighborhood Chess', categoryName: 'Recreation', activityDate: '2023-11-02', status: 'Approved' },
    { id: 'ja-3', activityName: 'Morning Park Run', categoryName: 'Health', activityDate: '2023-10-19', status: 'Completed' },
    { id: 'ja-4', activityName: 'Potluck Dinner Club', categoryName: 'Social', activityDate: '2023-10-15', status: 'Cancelled' },
  ],
  createdActivities: [
    { id: 'ca-1', activityName: 'Sustainable Urban Gardening Workshop', categoryName: 'Social Engagement', activityDate: '2023-10-24', status: 'Pending' },
    { id: 'ca-2', activityName: 'Evening Bridge Circle', categoryName: 'Recreation', activityDate: '2023-11-08', status: 'Approved' },
  ],
};

// --------------------------------------------------------------- activities

const organizer = {
  id: 'u-org',
  firstName: 'Sarah',
  lastName: 'Jenkins',
  profilePhoto: face(45),
};

const makeActivity = (i: number, status: ActivityCard['status']): ActivityCard => ({
  id: `a-${status.toLowerCase()}-${i}`,
  activityName: 'Urban Garden Initiative',
  activityPhoto: GARDEN_PHOTO,
  categoryName: 'Workshops',
  activityDate: '2023-10-24',
  activityTime: '10:00',
  activityLocation: 'Unity Community Gardens',
  latitude: 39.7817,
  longitude: -89.6501,
  participants: '12/25',
  joinedCount: 12,
  maximumNumberOfParticipants: 25,
  distanceKm: null,
  status,
  organizer,
});

/** 12 per status — the Activities frame reads "Showing 5 of 12 pending activities". */
export const activities: ActivityCard[] = [
  ...Array.from({ length: 12 }, (_, i) => makeActivity(i, 'Pending')),
  ...Array.from({ length: 12 }, (_, i) => makeActivity(i, 'Approved')),
  ...Array.from({ length: 12 }, (_, i) => makeActivity(i, 'Rejected')),
];

const DESCRIPTION_PARAGRAPHS = [
  'Join our local community for an enriching afternoon at the Unity Gardens. This workshop is designed to bridge generational gaps by teaching participants how to cultivate a sustainable urban oasis. Whether you live in a small apartment or have a backyard, you will learn vital skills like soil preparation, companion planting, and natural pest control.',
  'Participants will be guided by master gardeners and will have the opportunity to take home their own starter seed kits. The session concludes with a community tea and feedback circle, fostering deeper bonds between neighbors of all ages.',
].join('\n\n');

/** The Activity Details frame. */
export const activityDetailsSeed: ActivityDetails = {
  id: 'a-pending-0',
  activityName: 'Sustainable Urban Gardening Workshop',
  activityPhoto: GARDEN_PHOTO,
  category: { id: 'c-7', categoryName: 'Social Engagement' },
  activityDate: '2023-10-24',
  activityTime: '10:00',
  activityLocation: 'Unity Community Gardens, 742 Evergreen Terrace, Springfield, IL 62704',
  latitude: 39.7817,
  longitude: -89.6501,
  distanceKm: null,
  participants: '12/25',
  joinedCount: 12,
  maximumNumberOfParticipants: 25,
  participantAvatars: [face(5), face(11), face(23), face(31)],
  descriptions: DESCRIPTION_PARAGRAPHS,
  difficulty: 'Beginner',
  activityEquipment: 'Includes all materials & kit',
  activityDuration: '3 Hours',
  organizer: {
    id: 'u-marcus',
    firstName: 'Marcus',
    lastName: 'Thorne',
    email: 'Marcus.Thorne@gmail.com',
    profilePhoto: face(52),
  },
  minAge: 18,
  maxAge: 85,
  ageLimit: '18 – 85 Years',
  price: 15,
  status: 'Pending',
  rejectionReason: null,
  isJoined: false,
  isFavorite: false,
  createdAt: '2023-10-01',
  ageRangeNote: 'Intergenerational focus',
  priceNote: 'Includes all materials & kit',
  durationNote: 'Saturdays, 10 AM – 1 PM',
  mapImage: MAP_THUMBNAIL,
};

// ------------------------------------------------------------ notifications

const historySeed: Array<[string, string]> = [
  ['Spring Picnic Invitation', 'Join us for the annual community picnic in Oakridge Park. Bring a dish to share.'],
  ['Volunteers Needed', 'Urgent help required for tomorrow’s garden clean-up. Two hours, morning slot.'],
  ['System Maintenance', 'The dashboard will be offline for scheduled maintenance on Sunday night.'],
  ['New Craft Studio Opening', 'Art Studio B opens next week with weekly ceramics and weaving sessions.'],
  ['Winter Programme Published', 'Twelve new indoor activities are now open for registration.'],
];

/** 124 notifications — the total quoted in the Notifications frame. */
export const notifications: NotificationRow[] = Array.from({ length: 124 }, (_, i) => {
  const [notificationTitle, messageContent] = historySeed[i % historySeed.length];
  const day = 12 - (i % 12);
  return {
    id: `n-${i + 1}`,
    notificationTitle,
    messageContent,
    audience: 'Everyone' as const,
    audienceCategories: [],
    recipientCount: 0,
    sentDate: `2024-03-${String(day).padStart(2, '0')}`,
    status: (i % 17 === 5 ? 'Failed' : 'Delivered') as NotificationRow['status'],
  };
});

/**
 * The signed-in admin, as GET /users/me answers it. Backs the Profile screen
 * and the preference rows on Settings.
 */
export const me: MyProfile = {
  id: 'admin-1',
  firstName: 'Admin',
  lastName: 'User',
  email: 'admin@contenthub.io',
  phoneCountryCode: null,
  phoneNumber: null,
  dateOfBirth: null,
  profilePhoto: null,
  role: 'Admin',
  status: 'Active',
  language: 'English (United States)',
  dateFormat: 'MM/DD/YYYY',
  notificationSounds: true,
  allowNotifications: true,
  memberSince: '2024-01-08T09:00:00.000Z',
};

/** Support details the mobile app shows on its Contact Us screen. */
export const contactInfo: ContactInfo = {
  id: 'contact-1',
  email: 'support@seniorconnect.io',
  phoneNumber: '+41 21 555 01 20',
  createdAt: '2024-01-08T09:00:00.000Z',
  updatedAt: '2024-01-08T09:00:00.000Z',
};
