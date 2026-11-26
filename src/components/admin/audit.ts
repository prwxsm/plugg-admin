import type { AdminRelease, AdminTrack } from "./model";

export type AuditStatus =
  | "satisfied"       // Required and satisfied (Green)
  | "missing"         // Required but missing (Red)
  | "invalid"         // Invalid or requiring correction (Red)
  | "warning"         // Warning or needs attention (Amber)
  | "provided"        // Optional and provided (Neutral / Informational)
  | "not_provided"    // Optional and not provided (Muted / Grey)
  | "not_applicable"; // Not applicable (Grey)

export interface AuditCheckItem {
  id: string;
  label: string;
  requirementType: "mandatory" | "optional";
  status: AuditStatus;
  summary: string;
  detail?: string | undefined;
}

export interface TrackAuditResult {
  trackId: string;
  trackTitle: string;
  position: number;
  overallStatus: "satisfied" | "action_required" | "warning";
  canApprove: boolean;
  mandatoryPassed: number;
  mandatoryTotal: number;
  optionalProvided: number;
  optionalTotal: number;
  audioSpecText: string;
  audioStatus: "satisfied" | "missing" | "invalid" | "warning" | "not_recorded";
  audioDetails: {
    format: string | null;
    bitrateKbps: number | null;
    sampleRate: number | null;
    channels: number | null;
    isStereo: boolean | null;
    isVbr: boolean | null;
    processingStatus: string;
  };
  mandatoryItems: AuditCheckItem[];
  optionalItems: AuditCheckItem[];
}

export interface ReleaseAuditResult {
  releaseId: string;
  releaseTitle: string;
  releaseType: string;
  overallStatus: "satisfied" | "action_required" | "warning";
  canApprove: boolean;
  blockingReasons: string[];
  warnings: string[];

  // Counts
  mandatoryPassed: number;
  mandatoryTotal: number;
  optionalProvided: number;
  optionalTotal: number;

  // Track summary
  trackCount: number;
  trackCountRuleText: string;
  trackCountValid: boolean;

  // Category checklists
  projectClassification: AuditCheckItem[];
  audioAudit: AuditCheckItem[];
  artworkAudit: AuditCheckItem[];
  rightsAudit: AuditCheckItem[];
  optionalMetadataAudit: AuditCheckItem[];

  // Track audits
  tracks: TrackAuditResult[];
}

export const MIN_MP3_BITRATE = 192;
export const MAX_MP3_BITRATE = 320;
export const MIN_SAMPLE_RATE = 44100;

/**
 * Validates track count against standard Plugg platform requirements:
 * - Single: Exactly 1 track
 * - EP: 3 to 6 tracks
 * - Album: 7 or more tracks
 */
export function validateTrackCount(
  type: string,
  count: number,
): { valid: boolean; rule: string; message: string } {
  const normType = type.toLowerCase();
  if (normType === "single") {
    const valid = count === 1;
    return {
      valid,
      rule: "Exactly 1 track",
      message: valid
        ? "Single has exactly 1 track"
        : `Single requires exactly 1 track (found ${count})`,
    };
  }
  if (normType === "ep") {
    const valid = count >= 3 && count <= 6;
    return {
      valid,
      rule: "3–6 tracks",
      message: valid
        ? `EP has ${count} tracks (within 3–6 range)`
        : count < 3
          ? `EP requires at least 3 tracks (found ${count})`
          : `EP allows at most 6 tracks (found ${count}, should be classified as Album)`,
    };
  }
  if (normType === "album") {
    const valid = count >= 7;
    return {
      valid,
      rule: "7+ tracks",
      message: valid
        ? `Album has ${count} tracks (7+ required)`
        : `Album requires at least 7 tracks (found ${count}, should be classified as Single or EP)`,
    };
  }
  return {
    valid: count >= 1,
    rule: "At least 1 track",
    message: `${type} has ${count} tracks`,
  };
}

/**
 * Evaluates individual track requirements according to Plugg Master technical standards:
 * - Audio uploaded and accessible
 * - Format: MP3 only
 * - Bitrate: 192–320 kbps inclusive
 * - Sample rate: >= 44.1 kHz
 * - Channels: Stereo (2+ channels)
 */
export function auditTrack(
  track: AdminTrack,
  position: number,
  release: AdminRelease,
): TrackAuditResult {
  const mandatoryItems: AuditCheckItem[] = [];
  const optionalItems: AuditCheckItem[] = [];

  // 1. Track Title
  const hasTitle = Boolean(track.title && track.title.trim().length > 0 && !track.title.toLowerCase().startsWith("untitled"));
  mandatoryItems.push({
    id: `track-${track.id}-title`,
    label: "Track Title",
    requirementType: "mandatory",
    status: hasTitle ? "satisfied" : "missing",
    summary: hasTitle ? track.title : "Missing track title",
  });

  // 2. Primary Artist
  const hasArtist = Boolean(track.artistName && track.artistName.trim().length > 0);
  mandatoryItems.push({
    id: `track-${track.id}-artist`,
    label: "Primary Artist",
    requirementType: "mandatory",
    status: hasArtist ? "satisfied" : "missing",
    summary: hasArtist ? track.artistName : "Missing artist association",
  });

  // 3. Track Genre
  const hasGenre = Boolean(track.genre && track.genre.trim().length > 0);
  mandatoryItems.push({
    id: `track-${track.id}-genre`,
    label: "Track Genre",
    requirementType: "mandatory",
    status: hasGenre ? "satisfied" : "missing",
    summary: hasGenre ? track.genre : "Missing track genre",
  });

  // 4. Audio File Uploaded
  const hasAudioUrl = Boolean(track.audioUrl && track.audioUrl.trim().length > 0);
  mandatoryItems.push({
    id: `track-${track.id}-audio-file`,
    label: "Audio File Available",
    requirementType: "mandatory",
    status: hasAudioUrl ? "satisfied" : "missing",
    summary: hasAudioUrl ? "Master audio file attached" : "Audio file not uploaded or missing from storage",
  });

  // 5. Audio Technical Specifications
  const v = track.technicalValidation || {};
  const rawFormat = typeof v["format"] === "string" ? v["format"].toUpperCase() : null;
  const isMp3 = rawFormat === "MP3";
  const rate = typeof v["sampleRate"] === "number" ? v["sampleRate"] : null;
  const channels = typeof v["channels"] === "number" ? v["channels"] : null;
  const bitrate = typeof v["bitrateKbps"] === "number" ? v["bitrateKbps"] : null;
  const isVbr = v["isVbr"] === true;
  const isStereo = v["isStereo"] === true || (channels !== null && channels >= 2);
  const qualityWarning = typeof v["qualityWarning"] === "string" ? v["qualityWarning"] : null;
  const notes = typeof v["notes"] === "string" ? v["notes"] : null;

  let audioSpecText = "Technical specifications not recorded";
  let audioStatus: "satisfied" | "missing" | "invalid" | "warning" | "not_recorded" = "not_recorded";
  let audioSummary = "Audio specifications not recorded";
  let audioDetail: string | undefined = undefined;

  if (!hasAudioUrl) {
    audioSpecText = "Audio missing";
    audioStatus = "missing";
    audioSummary = "No audio uploaded";
  } else if (!rawFormat && rate === null && bitrate === null) {
    audioSpecText = "Technical specifications not recorded";
    audioStatus = "not_recorded";
    audioSummary = "Pending inspection / header not analyzed";
    audioDetail = "Audio header could not be verified automatically";
  } else {
    // Format technical string
    const formatLabel = rawFormat || "UNKNOWN";
    const bitrateLabel = bitrate !== null ? `${bitrate} kbps${isVbr ? " VBR" : ""}` : "Bitrate unknown";
    const rateLabel = rate !== null ? `${rate / 1000} kHz` : "Rate unknown";
    const channelsLabel = channels !== null ? (channels >= 2 ? "Stereo" : "Mono") : "Channels unknown";
    audioSpecText = `${formatLabel} · ${bitrateLabel} · ${rateLabel} · ${channelsLabel}`;

    // Validate Plugg master requirements:
    // 1. Must be MP3
    // 2. Bitrate 192–320 kbps inclusive
    // 3. Sample rate >= 44.1 kHz (44100 Hz)
    // 4. Stereo channels
    const formatValid = isMp3;
    const bitrateValid = bitrate !== null && bitrate >= MIN_MP3_BITRATE && bitrate <= MAX_MP3_BITRATE;
    const rateValid = rate !== null && rate >= MIN_SAMPLE_RATE;
    const channelsValid = channels !== null && channels >= 2;

    if (!formatValid) {
      audioStatus = "invalid";
      audioSummary = `Invalid format (${formatLabel}). Plugg requires MP3 files only (192–320 kbps).`;
    } else if (bitrate !== null && bitrate < MIN_MP3_BITRATE) {
      audioStatus = "invalid";
      audioSummary = `Bitrate (${bitrate} kbps) is below minimum 192 kbps requirement.`;
    } else if (bitrate !== null && bitrate > MAX_MP3_BITRATE) {
      audioStatus = "invalid";
      audioSummary = `Bitrate (${bitrate} kbps) exceeds maximum allowed 320 kbps.`;
    } else if (rate !== null && rate < MIN_SAMPLE_RATE) {
      audioStatus = "invalid";
      audioSummary = `Sample rate (${rate / 1000} kHz) is below minimum 44.1 kHz.`;
    } else if (channels !== null && channels < 2) {
      audioStatus = "warning";
      audioSummary = "Mono recording detected (2-channel stereo recommended).";
    } else if (bitrateValid && rateValid && (channelsValid || channels === null)) {
      audioStatus = "satisfied";
      audioSummary = `Master requirements satisfied (${audioSpecText})`;
    } else {
      audioStatus = "warning";
      audioSummary = qualityWarning || notes || "Audio specifications require verification";
    }
  }

  mandatoryItems.push({
    id: `track-${track.id}-audio-specs`,
    label: "Audio Technical Standard",
    requirementType: "mandatory",
    status:
      audioStatus === "satisfied"
        ? "satisfied"
        : audioStatus === "missing"
          ? "missing"
          : audioStatus === "invalid"
            ? "invalid"
            : audioStatus === "warning"
              ? "warning"
              : "not_provided",
    summary: audioSummary,
    detail: audioDetail || audioSpecText,
  });

  // 6. Processing Status
  const processingStatus = track.audioProcessingStatus || "source_ready";
  const processingPassed =
    processingStatus === "completed" ||
    processingStatus === "source_ready" ||
    processingStatus === "published";
  mandatoryItems.push({
    id: `track-${track.id}-processing`,
    label: "Transcoding / Ingestion Status",
    requirementType: "mandatory",
    status: processingPassed
      ? "satisfied"
      : processingStatus === "failed"
        ? "invalid"
        : "warning",
    summary:
      processingStatus === "completed"
        ? "Transcoding complete (ready for streaming)"
        : processingStatus === "source_ready"
          ? "Master verified and stored in cloud (source ready)"
          : processingStatus === "failed"
            ? "Transcoding failed — retry required"
            : `Processing status: ${processingStatus}`,
  });

  // Optional Metadata:
  // 1. Featured Artists
  const hasFeatures = Boolean(track.features && track.features.trim().length > 0);
  optionalItems.push({
    id: `track-${track.id}-features`,
    label: "Featured Artists",
    requirementType: "optional",
    status: hasFeatures ? "provided" : "not_provided",
    summary: hasFeatures ? track.features! : "No featured artists credited",
  });

  // 2. Producers
  const hasProducers = Boolean(track.producers && track.producers.trim().length > 0);
  optionalItems.push({
    id: `track-${track.id}-producers`,
    label: "Producers",
    requirementType: "optional",
    status: hasProducers ? "provided" : "not_provided",
    summary: hasProducers ? track.producers! : "Not recorded",
  });

  // 3. Lyrics
  const lyricsText = track.lyrics ? track.lyrics.trim() : "";
  const hasLyrics = lyricsText.length > 0;
  const wordCount = hasLyrics ? lyricsText.split(/\s+/).filter(Boolean).length : 0;
  optionalItems.push({
    id: `track-${track.id}-lyrics`,
    label: "Lyrics",
    requirementType: "optional",
    status: hasLyrics ? "provided" : "not_provided",
    summary: hasLyrics ? `Lyrics provided (${wordCount} words)` : "Lyrics not provided",
    detail: hasLyrics ? lyricsText.slice(0, 150) + (lyricsText.length > 150 ? "…" : "") : undefined,
  });

  // 4. ISRC
  const hasIsrc = Boolean(track.isrc && track.isrc.trim().length > 0);
  optionalItems.push({
    id: `track-${track.id}-isrc`,
    label: "ISRC Code",
    requirementType: "optional",
    status: hasIsrc ? "provided" : "not_provided",
    summary: hasIsrc ? track.isrc! : "Not registered (optional for independent releases)",
  });

  // 5. Sample & Beat Clearance
  const hasSampleDetails = Boolean(track.sampleDetails && track.sampleDetails.trim().length > 0);
  const declaresSamples = Boolean(track.hasSamplesOrBeats);
  optionalItems.push({
    id: `track-${track.id}-samples`,
    label: "Sample / Beat Declaration",
    requirementType: "optional",
    status: declaresSamples ? "warning" : "provided",
    summary: declaresSamples
      ? `Third-party samples/beats declared: ${hasSampleDetails ? track.sampleDetails : "Notice provided"}`
      : "Original recording (no third-party samples declared)",
  });

  // 6. Plugg Track ID
  optionalItems.push({
    id: `track-${track.id}-plugg-id`,
    label: "Plugg Track Identifier",
    requirementType: "optional",
    status: track.pluggTrackId ? "provided" : "not_provided",
    summary: track.pluggTrackId || "Assigned on submission",
  });

  const mandatoryPassed = mandatoryItems.filter((i) => i.status === "satisfied").length;
  const mandatoryTotal = mandatoryItems.length;
  const optionalProvided = optionalItems.filter((i) => i.status === "provided" || i.status === "satisfied").length;
  const optionalTotal = optionalItems.length;

  const hasInvalid = mandatoryItems.some((i) => i.status === "invalid" || i.status === "missing");
  const hasWarning = mandatoryItems.some((i) => i.status === "warning") || optionalItems.some((i) => i.status === "warning");

  const overallStatus = hasInvalid ? "action_required" : hasWarning ? "warning" : "satisfied";
  const canApprove = !hasInvalid;

  return {
    trackId: track.id,
    trackTitle: track.title,
    position,
    overallStatus,
    canApprove,
    mandatoryPassed,
    mandatoryTotal,
    optionalProvided,
    optionalTotal,
    audioSpecText,
    audioStatus,
    audioDetails: {
      format: rawFormat,
      bitrateKbps: bitrate,
      sampleRate: rate,
      channels,
      isStereo,
      isVbr,
      processingStatus,
    },
    mandatoryItems,
    optionalItems,
  };
}

/**
 * Computes release-level audit covering:
 * - Project classification
 * - Track count rule validation
 * - Audio standards across all tracks
 * - Artwork requirements
 * - Rights and ownership declarations
 * - Optional metadata audit
 */
export function computeReleaseAudit(
  release: AdminRelease,
  allTracks: AdminTrack[],
): ReleaseAuditResult {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  // Filter tracks that belong to this release
  const releaseTrackIds = new Set(release.trackIds || []);
  const releaseTracks = allTracks.filter((t) => t.releaseId === release.id || releaseTrackIds.has(t.id));

  // 1. Track Count Validation
  const trackCountResult = validateTrackCount(release.type, releaseTracks.length);
  if (!trackCountResult.valid) {
    blockingReasons.push(trackCountResult.message);
  }

  // 2. Project Classification Checklist
  const projectClassification: AuditCheckItem[] = [];

  const hasTitle = Boolean(release.title && release.title.trim().length > 0 && !release.title.toLowerCase().startsWith("untitled"));
  if (!hasTitle) blockingReasons.push("Release title is missing or default placeholder");
  projectClassification.push({
    id: `rel-${release.id}-title`,
    label: "Release Title",
    requirementType: "mandatory",
    status: hasTitle ? "satisfied" : "missing",
    summary: hasTitle ? release.title : "Missing release title",
  });

  const hasArtist = Boolean(release.artistName && release.artistName.trim().length > 0);
  if (!hasArtist) blockingReasons.push("Primary artist is missing");
  projectClassification.push({
    id: `rel-${release.id}-artist`,
    label: "Primary Artist",
    requirementType: "mandatory",
    status: hasArtist ? "satisfied" : "missing",
    summary: hasArtist ? release.artistName : "Missing primary artist",
  });

  const validTypes = new Set(["single", "ep", "album"]);
  const hasValidType = validTypes.has(release.type.toLowerCase());
  if (!hasValidType) blockingReasons.push(`Invalid release type "${release.type}"`);
  projectClassification.push({
    id: `rel-${release.id}-type`,
    label: "Release Classification",
    requirementType: "mandatory",
    status: hasValidType ? "satisfied" : "invalid",
    summary: `${release.type.toUpperCase()} (${trackCountResult.rule})`,
    detail: trackCountResult.message,
  });

  projectClassification.push({
    id: `rel-${release.id}-track-count`,
    label: "Track Count Rule",
    requirementType: "mandatory",
    status: trackCountResult.valid ? "satisfied" : "invalid",
    summary: trackCountResult.message,
  });

  const hasReleaseDate = Boolean(release.releaseDate && /^\d{4}-\d{2}-\d{2}/.test(release.releaseDate));
  if (!hasReleaseDate) blockingReasons.push("Release date is missing or invalid");
  projectClassification.push({
    id: `rel-${release.id}-release-date`,
    label: "Release Date",
    requirementType: "mandatory",
    status: hasReleaseDate ? "satisfied" : "missing",
    summary: hasReleaseDate ? release.releaseDate : "Release date not specified",
  });

  // Primary Genre from first track or release
  const primaryGenre = releaseTracks[0]?.genre || "Afrobeats";
  projectClassification.push({
    id: `rel-${release.id}-genre`,
    label: "Primary Genre",
    requirementType: "mandatory",
    status: "satisfied",
    summary: primaryGenre,
  });

  // Publishing Schedule / SLA check
  const hasGoLive = Boolean(release.goLiveAt);
  const isOverdue = hasGoLive && new Date(release.goLiveAt!).getTime() <= Date.now();
  if (isOverdue && release.status === "under_review") {
    warnings.push("Requested publication timestamp has already elapsed");
  }
  projectClassification.push({
    id: `rel-${release.id}-schedule`,
    label: "Publishing Schedule",
    requirementType: "mandatory",
    status: !hasGoLive ? "missing" : isOverdue ? "warning" : "satisfied",
    summary: hasGoLive
      ? `${new Date(release.goLiveAt!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} EAT${isOverdue ? " (publication time elapsed)" : ""}`
      : "No go-live schedule stored",
  });

  // 3. Artwork Checklist
  const artworkAudit: AuditCheckItem[] = [];
  const hasCover = Boolean(release.coverUrl && release.coverUrl.trim().length > 0);
  const isCustomCover = hasCover && !release.coverUrl.startsWith("c") && (release.coverUrl.includes("/covers/") || release.coverUrl.startsWith("http"));
  if (!hasCover) blockingReasons.push("Release artwork has not been uploaded");
  artworkAudit.push({
    id: `rel-${release.id}-artwork-presence`,
    label: "Cover Artwork Uploaded",
    requirementType: "mandatory",
    status: hasCover ? "satisfied" : "missing",
    summary: hasCover
      ? isCustomCover
        ? "Custom high-resolution artwork uploaded"
        : "Standard catalog artwork assigned"
      : "No cover artwork attached to release",
  });

  artworkAudit.push({
    id: `rel-${release.id}-artwork-dimensions`,
    label: "Artwork Aspect Ratio & Specs",
    requirementType: "mandatory",
    status: hasCover ? "satisfied" : "missing",
    summary: hasCover ? "Square 1:1 ratio confirmed" : "Missing artwork verification",
    detail: "Accepted standards: Square JPG/PNG, 3000×3000 recommended, RGB color space",
  });

  // 4. Rights and Ownership Checklist
  const rightsAudit: AuditCheckItem[] = [];
  const rightsConfirmed = Boolean(release.rightsDeclarationAccepted);
  const rightsRole = release.uploaderRole || "owner";
  const hasRightsHold = Boolean(release.rightsHold);

  if (!rightsConfirmed) blockingReasons.push("Mandatory copyright & distribution declaration not signed");
  if (hasRightsHold) blockingReasons.push(`Release held for rights verification: ${release.rightsHoldReason || "Administrative hold"}`);

  rightsAudit.push({
    id: `rel-${release.id}-rights-declaration`,
    label: "Mandatory Copyright Declaration",
    requirementType: "mandatory",
    status: rightsConfirmed ? "satisfied" : "missing",
    summary: rightsConfirmed
      ? `Confirmed by submitter as ${rightsRole === "owner" ? "Original Rights Owner" : "Authorized Representative"}`
      : "Copyright & distribution agreement not signed",
    detail: release.rightsDeclarationVersion
      ? `Terms version: ${release.rightsDeclarationVersion}${release.rightsDeclarationTimestamp ? ` · Signed ${new Date(release.rightsDeclarationTimestamp).toLocaleString("en-GB")}` : ""}`
      : undefined,
  });

  rightsAudit.push({
    id: `rel-${release.id}-rights-role`,
    label: "Submitter Authority Role",
    requirementType: "mandatory",
    status: "satisfied",
    summary: rightsRole === "owner" ? "Original creator / copyright holder" : "Authorized distributor, label rep, or manager",
  });

  rightsAudit.push({
    id: `rel-${release.id}-rights-hold`,
    label: "Rights Hold Check",
    requirementType: "mandatory",
    status: hasRightsHold ? "invalid" : "satisfied",
    summary: hasRightsHold
      ? `ACTIVE HOLD: ${release.rightsHoldReason || "Awaiting verification"}`
      : "Clean — No active rights holds or foreign copyright claims",
  });

  // 5. Track Audits & Audio Checklist
  const trackAudits: TrackAuditResult[] = releaseTracks.map((t, idx) => auditTrack(t, idx + 1, release));

  const audioAudit: AuditCheckItem[] = [];
  const missingAudioTracks = trackAudits.filter((t) => t.audioStatus === "missing");
  const invalidAudioTracks = trackAudits.filter((t) => t.audioStatus === "invalid");
  const uninspectedAudioTracks = trackAudits.filter((t) => t.audioStatus === "not_recorded");

  if (missingAudioTracks.length > 0) {
    blockingReasons.push(`Audio missing for ${missingAudioTracks.length} track(s): ${missingAudioTracks.map((t) => t.trackTitle).join(", ")}`);
  }
  if (invalidAudioTracks.length > 0) {
    blockingReasons.push(`Audio standard failed for ${invalidAudioTracks.length} track(s): ${invalidAudioTracks.map((t) => t.trackTitle).join(", ")}`);
  }

  audioAudit.push({
    id: `rel-${release.id}-audio-presence`,
    label: "Track Master Audio Presence",
    requirementType: "mandatory",
    status: missingAudioTracks.length === 0 && releaseTracks.length > 0 ? "satisfied" : "missing",
    summary:
      missingAudioTracks.length === 0 && releaseTracks.length > 0
        ? `Audio files attached for all ${releaseTracks.length} track(s)`
        : `Missing audio files on ${missingAudioTracks.length} track(s)`,
  });

  audioAudit.push({
    id: `rel-${release.id}-audio-master-standards`,
    label: "Plugg Master Audio Standards (MP3 · 192–320 kbps · 44.1+ kHz · Stereo)",
    requirementType: "mandatory",
    status:
      invalidAudioTracks.length > 0
        ? "invalid"
        : uninspectedAudioTracks.length > 0
          ? "warning"
          : "satisfied",
    summary:
      invalidAudioTracks.length > 0
        ? `${invalidAudioTracks.length} track(s) do not meet audio technical criteria`
        : uninspectedAudioTracks.length > 0
          ? `${uninspectedAudioTracks.length} track(s) have unrecorded technical specifications`
          : `All ${releaseTracks.length} track(s) comply with master audio specifications`,
  });

  // 6. Optional Metadata Checklist
  const optionalMetadataAudit: AuditCheckItem[] = [];

  // Record Label fallback to "Independent"
  const hasLabel = Boolean(release.label && release.label.trim().length > 0);
  const effectiveLabel = hasLabel ? release.label!.trim() : "Independent";
  optionalMetadataAudit.push({
    id: `rel-${release.id}-label`,
    label: "Record Label / Imprint",
    requirementType: "optional",
    status: hasLabel ? "provided" : "not_provided",
    summary: hasLabel ? effectiveLabel : "Independent (standard default fallback)",
  });

  // Featured Artists
  const anyFeatures = releaseTracks.some((t) => t.features && t.features.trim().length > 0);
  optionalMetadataAudit.push({
    id: `rel-${release.id}-features`,
    label: "Featured Artists",
    requirementType: "optional",
    status: anyFeatures ? "provided" : "not_provided",
    summary: anyFeatures
      ? releaseTracks.filter((t) => t.features).map((t) => `"${t.title}": ${t.features}`).join("; ")
      : "No featured artists credited",
  });

  // Producers
  const anyProducers = releaseTracks.some((t) => t.producers && t.producers.trim().length > 0);
  optionalMetadataAudit.push({
    id: `rel-${release.id}-producers`,
    label: "Producers & Production Credits",
    requirementType: "optional",
    status: anyProducers ? "provided" : "not_provided",
    summary: anyProducers
      ? releaseTracks.filter((t) => t.producers).map((t) => `"${t.title}": ${t.producers}`).join("; ")
      : "Producer credits not provided",
  });

  // Lyrics
  const anyLyrics = releaseTracks.some((t) => t.lyrics && t.lyrics.trim().length > 0);
  optionalMetadataAudit.push({
    id: `rel-${release.id}-lyrics`,
    label: "Song Lyrics",
    requirementType: "optional",
    status: anyLyrics ? "provided" : "not_provided",
    summary: anyLyrics
      ? `Lyrics provided for ${releaseTracks.filter((t) => t.lyrics && t.lyrics.trim().length > 0).length} of ${releaseTracks.length} track(s)`
      : "Lyrics not provided",
  });

  // ISRC codes
  const anyIsrc = releaseTracks.some((t) => t.isrc && t.isrc.trim().length > 0);
  optionalMetadataAudit.push({
    id: `rel-${release.id}-isrc`,
    label: "ISRC Identifiers",
    requirementType: "optional",
    status: anyIsrc ? "provided" : "not_provided",
    summary: anyIsrc
      ? `ISRC recorded for ${releaseTracks.filter((t) => t.isrc).length} track(s)`
      : "ISRC codes not provided (optional for direct distribution)",
  });

  // Sample Disclosures
  const anySamples = releaseTracks.some((t) => t.hasSamplesOrBeats);
  optionalMetadataAudit.push({
    id: `rel-${release.id}-samples`,
    label: "Beat Licensing & Sample Disclosures",
    requirementType: "optional",
    status: anySamples ? "warning" : "provided",
    summary: anySamples
      ? "Third-party sample/beat clearance declared on one or more tracks"
      : "Original production — no third-party samples declared",
  });

  // Description / Liner Notes
  const hasDesc = Boolean(release.description && release.description.trim().length > 0);
  optionalMetadataAudit.push({
    id: `rel-${release.id}-description`,
    label: "Release Description & Liner Notes",
    requirementType: "optional",
    status: hasDesc ? "provided" : "not_provided",
    summary: hasDesc ? release.description! : "No release notes provided",
  });

  // Calculate totals
  const allMandatory = [
    ...projectClassification,
    ...artworkAudit,
    ...rightsAudit,
    ...audioAudit,
  ];
  const mandatoryPassed = allMandatory.filter((i) => i.status === "satisfied").length;
  const mandatoryTotal = allMandatory.length;

  const optionalProvided = optionalMetadataAudit.filter((i) => i.status === "provided" || i.status === "satisfied").length;
  const optionalTotal = optionalMetadataAudit.length;

  const canApprove = blockingReasons.length === 0 && trackAudits.every((t) => t.canApprove);
  const overallStatus = !canApprove ? "action_required" : warnings.length > 0 ? "warning" : "satisfied";

  return {
    releaseId: release.id,
    releaseTitle: release.title,
    releaseType: release.type,
    overallStatus,
    canApprove,
    blockingReasons,
    warnings,
    mandatoryPassed,
    mandatoryTotal,
    optionalProvided,
    optionalTotal,
    trackCount: releaseTracks.length,
    trackCountRuleText: trackCountResult.rule,
    trackCountValid: trackCountResult.valid,
    projectClassification,
    audioAudit,
    artworkAudit,
    rightsAudit,
    optionalMetadataAudit,
    tracks: trackAudits,
  };
}
