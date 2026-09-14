export const PARTICIPANTS_ROUTES = {
  ROOT: 'participants',
  JOIN: 'activities/:activityId/join',
  LEAVE: 'activities/:activityId/leave',
  LIST: 'activities/:activityId/participants',
  /** Phase 5 — organizer ejects a participant from their own activity. */
  REMOVE: 'activities/:activityId/participants/:userId',
} as const;
