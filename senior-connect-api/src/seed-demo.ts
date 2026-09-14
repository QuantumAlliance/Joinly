import 'dotenv/config';
import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import mongoose, { Types } from 'mongoose';
import {
  ActivityStatus,
  Difficulty,
  NotificationAudience,
  NotificationStatus,
  ParticipantStatus,
  UserRole,
  UserStatus,
} from './common/enums';
import { mongoUri } from './config/mongoose.config';
import { CategorySchema } from './modules/categories/schemas';
import { ActivitySchema } from './modules/activities/schemas';
import { ActivityParticipantSchema } from './modules/participants/schemas';
import { NotificationSchema, UserNotificationSchema } from './modules/notifications/schemas';
import { UserInterestSchema, UserSchema } from './modules/users/schemas';
import { activityPhotoUrl, avatarUrl } from './stock-photos';

const DEMO_PASSWORD = 'password123';
const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const daysFromNow = (n: number): string =>
  new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

// Real, viewable photos (not placeholders): Pravatar for faces, curated
// Wikimedia Commons photography for activities. Both resolve from any network.
// The catalogue lives in `stock-photos.ts` so that `db-fix-photos.ts` repairs
// existing rows to exactly what a fresh seed would produce.

const demoUsers: Array<{
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  region?: string;
  city?: string;
  status: UserStatus;
  isEmailVerified: boolean;
  joinedDaysAgo: number; // fractional days allowed (e.g. 0.2 = ~5 hours ago) for "Recent Users"
  avatarId: number;
}> = [
  { firstName: 'Arthur', lastName: 'Thorne', email: 'arthur.thorne@provider.com', country: 'UK', region: 'England', city: 'London', status: UserStatus.Active, isEmailVerified: true, joinedDaysAgo: 62, avatarId: 11 },
  { firstName: 'David', lastName: 'Kwan', email: 'david.kwan@provider.com', country: 'Canada', region: 'Ontario', city: 'Toronto', status: UserStatus.Inactive, isEmailVerified: true, joinedDaysAgo: 88, avatarId: 12 },
  { firstName: 'Elena', lastName: 'Marquez', email: 'elena.marquez@provider.com', country: 'Spain', region: 'Catalonia', city: 'Barcelona', status: UserStatus.Suspended, isEmailVerified: true, joinedDaysAgo: 51, avatarId: 47 },
  { firstName: 'Lars', lastName: 'Hansen', email: 'lars.hansen@provider.com', country: 'Denmark', region: 'Capital Region', city: 'Copenhagen', status: UserStatus.Active, isEmailVerified: true, joinedDaysAgo: 40, avatarId: 13 },
  { firstName: 'James', lastName: "O'Neil", email: 'james.oneil@provider.com', country: 'USA', region: 'New York', city: 'New York', status: UserStatus.Active, isEmailVerified: true, joinedDaysAgo: 75, avatarId: 14 },
  { firstName: 'Maya', lastName: 'Patel', email: 'maya.patel@provider.com', country: 'India', region: 'Maharashtra', city: 'Mumbai', status: UserStatus.Active, isEmailVerified: true, joinedDaysAgo: 33, avatarId: 48 },
  { firstName: 'Sofia', lastName: 'Moretti', email: 'sofia.moretti@provider.com', country: 'Italy', region: 'Lombardy', city: 'Milan', status: UserStatus.Inactive, isEmailVerified: true, joinedDaysAgo: 29, avatarId: 49 },
  { firstName: 'Fatima', lastName: 'Al-Sayed', email: 'fatima.alsayed@provider.com', country: 'UAE', region: 'Dubai', city: 'Dubai', status: UserStatus.Active, isEmailVerified: true, joinedDaysAgo: 21, avatarId: 50 },
  // "Recent Users" (last 24h)
  { firstName: 'Jane', lastName: 'Dorsey', email: 'jane@example.com', country: 'USA', region: 'California', city: 'San Diego', status: UserStatus.Active, isEmailVerified: true, joinedDaysAgo: 0.8, avatarId: 45 },
  { firstName: 'Marcus', lastName: 'Kane', email: 'm.kane@provider.com', country: 'Canada', region: 'Quebec', city: 'Montreal', status: UserStatus.Active, isEmailVerified: true, joinedDaysAgo: 0.5, avatarId: 15 },
  { firstName: 'Elena', lastName: 'Lopez', email: 'elopez@mail.com', country: 'Spain', region: 'Madrid', city: 'Madrid', status: UserStatus.Pending, isEmailVerified: false, joinedDaysAgo: 0.3, avatarId: 44 },
  { firstName: 'Brian', lastName: 'Thompson', email: 'brian.t@tech.org', country: 'USA', region: 'Texas', city: 'Austin', status: UserStatus.Active, isEmailVerified: true, joinedDaysAgo: 0.1, avatarId: 16 },
];
async function seedDemo(): Promise<void> {
  await mongoose.connect(mongoUri());

  const UserModel = mongoose.model('User', UserSchema);
  const CategoryModel = mongoose.model('Category', CategorySchema);
  const ActivityModel = mongoose.model('Activity', ActivitySchema);
  const ParticipantModel = mongoose.model('ActivityParticipant', ActivityParticipantSchema);
  const NotificationModel = mongoose.model('Notification', NotificationSchema);
  const UserNotificationModel = mongoose.model('UserNotification', UserNotificationSchema);
  const InterestModel = mongoose.model('UserInterest', UserInterestSchema);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  /**
   * Backdate a document's createdAt. `timestamps: true` overwrites it on every
   * save, so this writes through the raw collection to bypass the plugin.
   */
  const backdate = async (
    model: mongoose.Model<any>,
    id: Types.ObjectId,
    field: string,
    when: Date,
  ): Promise<void> => {
    await model.collection.updateOne({ _id: id }, { $set: { [field]: when } });
  };

  // ---- Users ----
  const userIdByEmail = new Map<string, Types.ObjectId>();
  for (const u of demoUsers) {
    const existing = await UserModel.findOne({ email: u.email });
    const user =
      existing ??
      new UserModel({
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        password: passwordHash,
        country: u.country,
        region: u.region ?? null,
        city: u.city ?? null,
        role: UserRole.User,
        status: u.status,
        isEmailVerified: u.isEmailVerified,
      });
    user.profilePhoto = avatarUrl(u.avatarId);
    await user.save();
    if (!existing) await backdate(UserModel, user._id, 'createdAt', daysAgo(u.joinedDaysAgo));
    userIdByEmail.set(u.email, user._id);
  }
  console.log(`Seeded ${demoUsers.length} demo users with real avatar photos (password: ${DEMO_PASSWORD})`);

  // ---- Backfill photos onto records created outside this script ----
  await UserModel.updateOne({ email: 'admin@contenthub.io' }, { $set: { profilePhoto: avatarUrl(5) } });
  await UserModel.updateOne(
    { email: 'jean.moreau@example.com' },
    { $set: { profilePhoto: avatarUrl(33) } },
  );
  await ActivityModel.updateOne(
    { activityName: 'Morning Hike', activityPhoto: null },
    { $set: { activityPhoto: activityPhotoUrl('morning-hike-lavaux') } },
  );

  // ---- Interests (Arthur + David get a few, for User Details testing) ----
  const categories = await CategoryModel.find();
  const categoryByName = new Map(categories.map((c) => [c.categoryName, c]));
  const assignInterests = async (email: string, names: string[]): Promise<void> => {
    const userId = userIdByEmail.get(email);
    if (!userId) return;
    for (const name of names) {
      const category = categoryByName.get(name);
      if (!category) continue;
      await InterestModel.updateOne(
        { userId, categoryId: category._id },
        { $setOnInsert: { userId, categoryId: category._id } },
        { upsert: true },
      );
    }
  };
  await assignInterests('arthur.thorne@provider.com', ['Football', 'Golf', 'Rowing', 'Boxing']);
  await assignInterests('david.kwan@provider.com', ['Cycling', 'Swimming']);
  await assignInterests('maya.patel@provider.com', ['Badminton', 'Table Tennis', 'Tennis']);

  // ---- Activities ----
  const categoryId = (name: string): Types.ObjectId => {
    const c = categoryByName.get(name);
    if (!c) throw new Error(`Category not found: ${name}`);
    return c._id;
  };
  const organizerId = (email: string): Types.ObjectId => {
    const id = userIdByEmail.get(email);
    if (!id) throw new Error(`User not found: ${email}`);
    return id;
  };

  const demoActivities: Array<{
    activityName: string;
    categoryName: string;
    organizerEmail: string;
    descriptions: string;
    activityDate: string;
    activityTime: string;
    activityDuration: string;
    activityLocation: string;
    minAge: number;
    maxAge: number;
    price: number | null;
    difficulty: Difficulty;
    status: ActivityStatus;
    rejectionReason?: string;
    maximumNumberOfParticipants: number;
    photoSlug: string;
  }> = [
    { activityName: 'Sunset Football Match', categoryName: 'Football', organizerEmail: 'arthur.thorne@provider.com', descriptions: 'A friendly 7-a-side match as the sun goes down. All skill levels welcome, just bring your boots and energy.', activityDate: daysFromNow(5), activityTime: '18:00', activityDuration: '1.5 Hours', activityLocation: 'Hyde Park Sports Field, London', minAge: 16, maxAge: 55, price: 0, difficulty: Difficulty.Beginner, status: ActivityStatus.Approved, maximumNumberOfParticipants: 14, photoSlug: 'sunset-football-match' },
    { activityName: 'Weekend Cycling Tour', categoryName: 'Cycling', organizerEmail: 'david.kwan@provider.com', descriptions: 'A scenic 25km ride along the waterfront trail, ending with coffee at a local cafe.', activityDate: daysFromNow(10), activityTime: '09:00', activityDuration: '3 Hours', activityLocation: 'Toronto Waterfront Trail', minAge: 18, maxAge: 65, price: 5, difficulty: Difficulty.Intermediate, status: ActivityStatus.Approved, maximumNumberOfParticipants: 20, photoSlug: 'weekend-cycling-tour' },
    { activityName: 'Community Pool Swim', categoryName: 'Swimming', organizerEmail: 'elena.marquez@provider.com', descriptions: 'Open swim session for the community pool, lifeguard on duty throughout.', activityDate: daysFromNow(3), activityTime: '10:00', activityDuration: '2 Hours', activityLocation: 'Barcelona Municipal Pool', minAge: 12, maxAge: 70, price: 3, difficulty: Difficulty.Beginner, status: ActivityStatus.Pending, maximumNumberOfParticipants: 30, photoSlug: 'community-pool-swim' },
    { activityName: 'Pickup Basketball Game', categoryName: 'Basketball', organizerEmail: 'lars.hansen@provider.com', descriptions: 'Casual 5-on-5 pickup games, come solo or with a team.', activityDate: daysFromNow(7), activityTime: '17:30', activityDuration: '2 Hours', activityLocation: 'Copenhagen Community Court', minAge: 16, maxAge: 45, price: 0, difficulty: Difficulty.Intermediate, status: ActivityStatus.Approved, maximumNumberOfParticipants: 12, photoSlug: 'pickup-basketball-game' },
    { activityName: 'Alpine Skiing Weekend', categoryName: 'Skiing', organizerEmail: 'james.oneil@provider.com', descriptions: 'A weekend trip to the slopes, carpooling arranged for participants.', activityDate: daysFromNow(20), activityTime: '07:00', activityDuration: '2 Days', activityLocation: 'Adirondack Ski Resort', minAge: 18, maxAge: 60, price: 45, difficulty: Difficulty.Advanced, status: ActivityStatus.Pending, maximumNumberOfParticipants: 8, photoSlug: 'alpine-skiing-weekend' },
    { activityName: 'Indoor Climbing Session', categoryName: 'Climbing', organizerEmail: 'maya.patel@provider.com', descriptions: 'Bouldering and top-rope climbing for all levels at the indoor gym.', activityDate: daysFromNow(2), activityTime: '16:00', activityDuration: '2 Hours', activityLocation: 'Mumbai Indoor Climbing Gym', minAge: 14, maxAge: 50, price: 8, difficulty: Difficulty.Intermediate, status: ActivityStatus.Rejected, rejectionReason: 'Insufficient safety equipment details provided.', maximumNumberOfParticipants: 10, photoSlug: 'indoor-climbing-session' },
    { activityName: 'Doubles Tennis Tournament', categoryName: 'Tennis', organizerEmail: 'sofia.moretti@provider.com', descriptions: 'Friendly doubles tournament with prizes for the top two pairs.', activityDate: daysFromNow(14), activityTime: '09:00', activityDuration: '4 Hours', activityLocation: 'Milan Tennis Club', minAge: 16, maxAge: 65, price: 10, difficulty: Difficulty.Intermediate, status: ActivityStatus.Approved, maximumNumberOfParticipants: 16, photoSlug: 'doubles-tennis-tournament' },
    { activityName: 'Table Tennis Social', categoryName: 'Table Tennis', organizerEmail: 'fatima.alsayed@provider.com', descriptions: 'Relaxed social table tennis evening, all equipment provided.', activityDate: daysFromNow(1), activityTime: '19:00', activityDuration: '2 Hours', activityLocation: 'Dubai Community Hall', minAge: 10, maxAge: 70, price: 0, difficulty: Difficulty.Beginner, status: ActivityStatus.Approved, maximumNumberOfParticipants: 18, photoSlug: 'table-tennis-social' },
    { activityName: 'Badminton Club Night', categoryName: 'Badminton', organizerEmail: 'jane@example.com', descriptions: 'Weekly badminton club night, singles and doubles courts available.', activityDate: daysFromNow(6), activityTime: '18:30', activityDuration: '2 Hours', activityLocation: 'San Diego Badminton Center', minAge: 12, maxAge: 60, price: 4, difficulty: Difficulty.Beginner, status: ActivityStatus.Pending, maximumNumberOfParticipants: 16, photoSlug: 'badminton-club-night' },
    { activityName: 'Handball Friendly Match', categoryName: 'Handball', organizerEmail: 'm.kane@provider.com', descriptions: 'Friendly handball match against a neighboring club.', activityDate: daysFromNow(9), activityTime: '15:00', activityDuration: '1.5 Hours', activityLocation: 'Montreal Sports Complex', minAge: 16, maxAge: 45, price: 0, difficulty: Difficulty.Intermediate, status: ActivityStatus.Approved, maximumNumberOfParticipants: 14, photoSlug: 'handball-friendly-match' },
    { activityName: 'Golf Morning Round', categoryName: 'Golf', organizerEmail: 'elopez@mail.com', descriptions: 'A relaxed 9-hole morning round, great for beginners and regulars alike.', activityDate: daysFromNow(12), activityTime: '08:00', activityDuration: '3 Hours', activityLocation: 'Madrid Golf Course', minAge: 18, maxAge: 75, price: 25, difficulty: Difficulty.Beginner, status: ActivityStatus.Approved, maximumNumberOfParticipants: 8, photoSlug: 'golf-morning-round' },
    { activityName: 'Charity Boxing Sparring', categoryName: 'Boxing', organizerEmail: 'brian.t@tech.org', descriptions: 'Light sparring session raising funds for the local youth center.', activityDate: daysFromNow(4), activityTime: '17:00', activityDuration: '2 Hours', activityLocation: 'Austin Boxing Gym', minAge: 18, maxAge: 40, price: 15, difficulty: Difficulty.Advanced, status: ActivityStatus.Rejected, rejectionReason: 'Requires certified trainer supervision on-site.', maximumNumberOfParticipants: 10, photoSlug: 'charity-boxing-sparring' },
    { activityName: 'Sunday Rowing Practice', categoryName: 'Rowing', organizerEmail: 'arthur.thorne@provider.com', descriptions: 'Early morning rowing practice on the river, coaching provided for beginners.', activityDate: daysFromNow(8), activityTime: '07:30', activityDuration: '2 Hours', activityLocation: 'Thames Rowing Club, London', minAge: 16, maxAge: 60, price: 0, difficulty: Difficulty.Beginner, status: ActivityStatus.Approved, maximumNumberOfParticipants: 12, photoSlug: 'sunday-rowing-practice' },
    { activityName: 'Beginner Football Clinic', categoryName: 'Football', organizerEmail: 'david.kwan@provider.com', descriptions: 'A skills clinic focused on fundamentals for newcomers to the sport.', activityDate: daysFromNow(15), activityTime: '10:00', activityDuration: '2 Hours', activityLocation: 'Toronto Youth Sports Field', minAge: 10, maxAge: 30, price: 0, difficulty: Difficulty.Beginner, status: ActivityStatus.Pending, maximumNumberOfParticipants: 20, photoSlug: 'beginner-football-clinic' },
    { activityName: 'Historic Park Run', categoryName: 'Football', organizerEmail: 'jane@example.com', descriptions: 'A completed community fun run through the historic downtown park.', activityDate: daysFromNow(-20), activityTime: '08:00', activityDuration: '1 Hour', activityLocation: 'San Diego Historic Park', minAge: 10, maxAge: 75, price: 0, difficulty: Difficulty.Beginner, status: ActivityStatus.Completed, maximumNumberOfParticipants: 25, photoSlug: 'historic-park-run' },
    { activityName: 'Cancelled Ski Trip', categoryName: 'Skiing', organizerEmail: 'maya.patel@provider.com', descriptions: 'A ski trip that was cancelled due to insufficient snowfall.', activityDate: daysFromNow(25), activityTime: '07:00', activityDuration: '1 Day', activityLocation: 'Mumbai Indoor Ski Dome', minAge: 18, maxAge: 55, price: 30, difficulty: Difficulty.Intermediate, status: ActivityStatus.Cancelled, maximumNumberOfParticipants: 10, photoSlug: 'cancelled-ski-trip' },
  ];
  const activityIdByName = new Map<string, Types.ObjectId>();
  for (const a of demoActivities) {
    const existing = await ActivityModel.findOne({ activityName: a.activityName });
    const activity =
      existing ??
      new ActivityModel({
        activityName: a.activityName,
        categoryId: categoryId(a.categoryName),
        descriptions: a.descriptions,
        maximumNumberOfParticipants: a.maximumNumberOfParticipants,
        activityDate: a.activityDate,
        activityTime: a.activityTime,
        activityDuration: a.activityDuration,
        activityLocation: a.activityLocation,
        minAge: a.minAge,
        maxAge: a.maxAge,
        price: a.price,
        difficulty: a.difficulty,
        status: a.status,
        rejectionReason: a.rejectionReason ?? null,
        organizerId: organizerId(a.organizerEmail),
      });
    activity.activityPhoto = activityPhotoUrl(a.photoSlug);
    await activity.save();
    activityIdByName.set(a.activityName, activity._id);
  }
  console.log(`Seeded ${demoActivities.length} demo activities with real photos`);

  // ---- Participants (joins) ----
  const joins: Array<{ activityName: string; emails: string[] }> = [
    { activityName: 'Sunset Football Match', emails: ['jane@example.com', 'm.kane@provider.com', 'elopez@mail.com'] },
    { activityName: 'Pickup Basketball Game', emails: ['david.kwan@provider.com', 'sofia.moretti@provider.com'] },
    { activityName: 'Doubles Tennis Tournament', emails: ['fatima.alsayed@provider.com', 'brian.t@tech.org'] },
    { activityName: 'Sunday Rowing Practice', emails: ['james.oneil@provider.com'] },
    { activityName: 'Historic Park Run', emails: ['m.kane@provider.com', 'brian.t@tech.org'] },
  ];
  let joinCount = 0;
  for (const j of joins) {
    const activityId = activityIdByName.get(j.activityName);
    if (!activityId) continue;
    for (const email of j.emails) {
      const userId = userIdByEmail.get(email);
      if (!userId) continue;
      const result = await ParticipantModel.updateOne(
        { activityId, userId },
        { $setOnInsert: { activityId, userId, status: ParticipantStatus.Joined } },
        { upsert: true },
      );
      if (result.upsertedCount > 0) joinCount++;
    }
  }
  // joinedCount is denormalised on the activity, so recompute it from the rows
  // this script just inserted rather than trusting a counter it never touched.
  for (const activityId of activityIdByName.values()) {
    const joined = await ParticipantModel.countDocuments({
      activityId,
      status: ParticipantStatus.Joined,
    });
    await ActivityModel.updateOne({ _id: activityId }, { $set: { joinedCount: joined } });
  }
  console.log(`Seeded ${joinCount} activity participant joins`);

  // ---- Notifications ----
  const admin = await UserModel.findOne({ email: 'admin@contenthub.io' });
  // `targetCategories` names the interest segment a broadcast is aimed at.
  // Empty means Everyone. Phase 7 replaced the old Seniors/Volunteers values —
  // nothing on the user document could resolve them, so they targeted no one.
  const demoNotifications: Array<{
    notificationTitle: string;
    messageContent: string;
    targetCategories: string[];
    status: NotificationStatus;
    sentDaysAgo: number;
  }> = [
    { notificationTitle: 'Spring Picnic Invitation', messageContent: 'Join us for the annual community picnic this Saturday at Central Park.', targetCategories: [], status: NotificationStatus.Delivered, sentDaysAgo: 12 },
    { notificationTitle: 'Rowing Crews Needed for Cleanup', messageContent: "Urgent help required for tomorrow's riverside cleanup event.", targetCategories: ['Rowing', 'Cycling'], status: NotificationStatus.Delivered, sentDaysAgo: 10 },
    { notificationTitle: 'Scheduled Maintenance Tonight', messageContent: 'The dashboard will be offline briefly for scheduled maintenance at 11 PM.', targetCategories: [], status: NotificationStatus.Delivered, sentDaysAgo: 8 },
    { notificationTitle: 'Swimming Wellness Workshop', messageContent: 'A free wellness and mobility workshop for our swimmers next week.', targetCategories: ['Swimming'], status: NotificationStatus.Delivered, sentDaysAgo: 6 },
    { notificationTitle: 'New Badminton Club Launching', messageContent: 'A brand new weekly badminton club is starting — sign up on the app!', targetCategories: ['Badminton'], status: NotificationStatus.Delivered, sentDaysAgo: 5 },
    { notificationTitle: 'Weather Alert: Heavy Rain Expected', messageContent: 'Several outdoor activities this weekend may be affected by heavy rain.', targetCategories: [], status: NotificationStatus.Failed, sentDaysAgo: 3 },
    { notificationTitle: 'Thank You for a Great Season!', messageContent: 'Thanks to everyone who joined an activity this season — see you next month!', targetCategories: [], status: NotificationStatus.Delivered, sentDaysAgo: 2 },
    { notificationTitle: 'Reminder: Update Your Profile', messageContent: 'Please make sure your profile photo and interests are up to date.', targetCategories: [], status: NotificationStatus.Delivered, sentDaysAgo: 1 },
  ];

  // Fan out exactly as compose() does, so seeded rows land in the same inboxes
  // the real endpoint would reach — an Everyone broadcast goes to every active
  // mobile user, an interest broadcast only to users holding that interest.
  const mobileUsers = (
    await UserModel.find({
      role: UserRole.User,
      status: UserStatus.Active,
      allowNotifications: true,
    }).select('_id')
  ).map((u) => u._id);

  const categoryIdByName = new Map(
    (await CategoryModel.find()).map((c) => [c.categoryName as string, c._id]),
  );

  let notifCount = 0;
  let fannedOut = 0;
  for (const n of demoNotifications) {
    const audienceCategoryIds = n.targetCategories.flatMap((name) => {
      const id = categoryIdByName.get(name);
      return id ? [id] : [];
    });
    const audience =
      audienceCategoryIds.length > 0
        ? NotificationAudience.Interests
        : NotificationAudience.Everyone;

    // Narrow to users who actually hold one of the targeted interests.
    let recipientIds = mobileUsers;
    if (audience === NotificationAudience.Interests) {
      const interested = await InterestModel.distinct('userId', {
        categoryId: { $in: audienceCategoryIds },
      });
      const interestedSet = new Set(interested.map((id) => String(id)));
      recipientIds = mobileUsers.filter((id) => interestedSet.has(String(id)));
    }

    let notification = await NotificationModel.findOne({ notificationTitle: n.notificationTitle });
    if (!notification) {
      notification = await NotificationModel.create({
        notificationTitle: n.notificationTitle,
        messageContent: n.messageContent,
        audience,
        audienceCategoryIds,
        recipientCount: recipientIds.length,
        status: n.status,
        sentBy: admin?._id ?? null,
        sentDate: daysAgo(n.sentDaysAgo),
      });
      notifCount++;
    }
    if (recipientIds.length > 0) {
      await UserNotificationModel.bulkWrite(
        recipientIds.map((userId) => ({
          updateOne: {
            filter: { notificationId: notification!._id, userId },
            update: { $setOnInsert: { notificationId: notification!._id, userId } },
            upsert: true,
          },
        })),
      );
      fannedOut += recipientIds.length;
    }
  }
  console.log(`Seeded ${notifCount} demo notifications, ${fannedOut} deliveries across ${mobileUsers.length} mobile users`);

  await mongoose.disconnect();
  console.log('--- Demo seed complete ---');
}

void seedDemo();
