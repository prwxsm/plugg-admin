/** Serializable, credential-free admin read models. No database imports or fallback records. */
export interface AdminIdentity {
  username?: string | null;
  avatarUrl?: string | null;
  createdAt?: string | null;
  artistName?: string | null;
  artistUsername?: string | null;
  role: "super_admin" | "admin" | "moderator";
  id: string;
  name: string;
  email: string;
}
export interface AdminTrack {
  id: string;
  pluggTrackId: string | null;
  title: string;
  artistId: string;
  artistName: string;
  releaseId: string;
  releaseTitle: string;
  releaseStatus: string;
  genre: string;
  coverUrl: string;
  audioUrl: string | null;
  durationSeconds: number;
  playCount: number;
  downloadCount: number;
  published: boolean;
  releaseDate: string;
  features: string | null;
  producers: string | null;
  audioProcessingStatus: string;
  recordingType?: string | null;
  hasSamplesOrBeats?: boolean;
  sampleDetails?: string | null;
  isrc?: string | null;
  fileHash?: string | null;
  duplicateMatchesCount?: number;
  technicalValidation: Record<string, string | number | boolean | null>;
  audioVariants: {
    name: string;
    url?: string | null;
    format: string | null;
    type: string | null;
    bitrateKbps: number | null;
    sizeBytes: number | null;
  }[];
}
export interface AdminHistory {
  timestamp: string | null;
  action: string;
  actorName: string | null;
  feedback: string | null;
  notes: string | null;
}
export interface AdminRelease {
  id: string;
  title: string;
  type: string;
  artistId: string;
  artistName: string;
  coverUrl: string;
  label: string | null;
  releaseDate: string;
  goLiveAt: string | null;
  status: string;
  reviewSubmittedAt: string | null;
  reviewedAt: string | null;
  reviewFeedback: string | null;
  audioProcessingStatus: string;
  uploaderRole?: string | null;
  rightsDeclarationAccepted?: boolean;
  rightsDeclarationVersion?: string | null;
  rightsDeclarationTimestamp?: string | null;
  rightsHold?: boolean;
  rightsHoldReason?: string | null;
  rightsHoldPlacedAt?: string | null;
  rightsHoldPlacedBy?: string | null;
  reviewHistory: AdminHistory[];
  trackIds: string[];
}
export interface AdminComplaint {
  id: string;
  complaintReference: string;
  releaseId: string | null;
  trackId: string | null;
  releaseTitle?: string | null;
  trackTitle?: string | null;
  artistName?: string | null;
  complainantName: string;
  complainantEmail: string;
  conflictNature: string;
  evidenceNotes?: string | null;
  status: "received" | "under_investigation" | "resolved" | "dismissed";
  adminNotes?: string | null;
  resolutionNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}
export interface AdminArtist {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string;
  location: string;
  city: string | null;
  country: string | null;
  primaryGenre: string | null;
  phoneNumber: string;
  verified: boolean;
  monthlyListeners: number;
  totalPlays: number;
  fans: number;
  termsAcceptedAt: string | null;
}
export interface AdminGenre {
  id: string;
  name: string;
  slug: string;
  image: string;
  trackCount: number;
  artistCount: number;
}
export interface AdminUser {
  avatarUrl?: string | null;
  phone?: string | null;
  artistUsername?: string | null;
  verified?: boolean | null;
  id: string;
  name: string;
  username: string | null;
  email: string;
  accountType: string;
  artistName: string | null;
  isAdmin: boolean;
  adminRole: string | null;
  adminActive: boolean;
  createdAt: string;
}
export interface AdminPlay {
  id: string;
  createdAt: string;
  title: string;
  pluggTrackId: string | null;
  duration: number;
  ipAddress: string | null;
  sessionLabel: string | null;
}
export interface AdminSnapshot {
  audit: {
    id: string;
    actorName: string;
    actorRole: string;
    action: string;
    targetId: string;
    reason: string | null;
    occurredAt: string;
    result: string;
  }[];
  fetchedAt: string;
  currentUser: AdminIdentity;
  releases: AdminRelease[];
  tracks: AdminTrack[];
  artists: AdminArtist[];
  genres: AdminGenre[];
  users: AdminUser[];
  plays: AdminPlay[];
  complaints: AdminComplaint[];
  metrics: {
    releases: number;
    tracks: number;
    artists: number;
    users: number;
    verifiedArtists: number;
    adminUsers: number;
    pending: number;
    approaching: number;
    breached: number;
    missingSubmissionTime: number;
    scheduled: number;
    nextMidnightScheduled: number;
    overdueScheduled: number;
    missingSchedule: number;
    scheduleMismatches: number;
    qualifiedToday: number;
    recordedPlays: number;
    storedPlayCount: number;
    downloads: number;
    completed: number;
    processing: number;
    failed: number;
    pendingAudio: number;
    playsWithIp: number;
    excludedSeedRecords: number;
    rightsHoldCount: number;
    openComplaints: number;
  };
  dailyPlays: { day: string; plays: number }[];
  files: { category: string; status: string; count: number; bytes: number }[];
  limits: { records: number; recentPlays: number };
}
export type AdminResult =
  | { status: "ok"; data: AdminSnapshot }
  | {
      status: "unauthenticated" | "forbidden" | "unavailable";
      message: string;
      reason?: "session_expired" | undefined;
    };
export const statusLabels: Record<string, string> = {
  published: "Published",
  scheduled: "Scheduled",
  draft: "Draft",
  under_review: "Under review",
  changes_required: "Changes required",
  processing: "Processing",
};
export const count = (n: number) =>
  Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
export const kampala = (value: string | number | null) =>
  value === null || !Number.isFinite(new Date(value).getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Kampala",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value));
export const pendingHours = (
  r: Pick<AdminRelease, "reviewSubmittedAt">,
  now: number,
): number | null =>
  r.reviewSubmittedAt && Number.isFinite(Date.parse(r.reviewSubmittedAt))
    ? Math.max(0, (now - Date.parse(r.reviewSubmittedAt)) / 3600000)
    : null;
export const safeMediaUrl = (value: unknown): string | null => {
  if (
    typeof value !== "string" ||
    !value ||
    /[\\\s]/.test(value) ||
    [...value].some((c) => c.charCodeAt(0) < 32)
  )
    return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
      ? value
      : null;
  } catch {
    return null;
  }
};
/** Older writes stored JSON strings inside JSONB. Decode in memory; never rewrite rows. */
export function decodeJson(value: unknown): unknown {
  let decoded = value;
  for (let i = 0; i < 3 && typeof decoded === "string"; i++) {
    try {
      decoded = JSON.parse(decoded);
    } catch {
      return null;
    }
  }
  return decoded;
}
export function jsonObject(value: unknown): Record<string, unknown> {
  const decoded = decodeJson(value);
  return decoded && typeof decoded === "object" && !Array.isArray(decoded)
    ? (decoded as Record<string, unknown>)
    : {};
}
export function reviewHistory(value: unknown): AdminHistory[] {
  const decoded = decodeJson(value);
  if (!Array.isArray(decoded)) return [];
  return decoded
    .filter((x) => x && typeof x === "object")
    .map((x) => ({
      timestamp: typeof (x.timestamp ?? x.date) === "string" ? (x.timestamp ?? x.date) : null,
      action: typeof x.action === "string" ? x.action : "Unspecified event",
      actorName: typeof x.actorName === "string" ? x.actorName : null,
      feedback: typeof x.feedback === "string" ? x.feedback : null,
      notes: typeof x.notes === "string" ? x.notes : null,
    }));
}
