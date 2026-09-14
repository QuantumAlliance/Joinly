import { ActivityStatus, Difficulty } from '../../../common/enums';

/** Figma Home hero banner — "N activities happening near you today". */
export interface ActivitySummary {
  /** The day counted, as an ISO date. */
  date: string;
  count: number;
  /**
   * Radius the count was taken over, or null when no location was available
   * and the figure is therefore not "near you" at all — the banner needs to
   * know the difference before it words itself.
   */
  radiusKm: number | null;
}

/** One row of the search box's autocomplete list. */
export interface ActivitySuggestion {
  id: string;
  activityName: string;
  categoryName: string;
}

export interface ActivityCard {
  id: string;
  activityName: string;
  activityPhoto: string | null;
  categoryName: string;
  activityDate: string;
  activityTime: string;
  activityLocation: string;
  latitude: number | null;
  longitude: number | null;
  participants: string; // "7/12" as shown on Figma cards
  joinedCount: number;
  maximumNumberOfParticipants: number;
  distanceKm: number | null;
  status: ActivityStatus;
  organizer: {
    id: string;
    firstName: string;
    lastName: string;
    profilePhoto: string | null;
  };
}

export interface ActivityDetails {
  id: string;
  activityName: string;
  activityPhoto: string | null;
  category: { id: string; categoryName: string };
  activityDate: string;
  activityTime: string;
  activityLocation: string;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  participants: string;
  joinedCount: number;
  maximumNumberOfParticipants: number;
  participantAvatars: (string | null)[];
  descriptions: string;
  difficulty: Difficulty;
  activityEquipment: string | null;
  activityDuration: string;
  organizer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePhoto: string | null;
  };
  minAge: number;
  maxAge: number;
  ageLimit: string; // "18 Years to 22 Years"
  price: number | null;
  status: ActivityStatus;
  rejectionReason: string | null;
  isJoined: boolean;
  isFavorite: boolean;
  createdAt: Date;
}
