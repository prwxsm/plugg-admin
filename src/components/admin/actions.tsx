import React, { useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  CalendarClock,
  CheckCircle2,
  FileCheck,
  FileEdit,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  Upload,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { performAdminOperation, retryAdminAudio } from "@/lib/api";
import { approveReleaseFn, requestChangesReleaseFn } from "@/lib/api";
import type { AdminSnapshot } from "./model";
import { safeMediaUrl } from "./model";
import { AdminDropdown } from "./dropdown";

type Action =
  | "retry_audio"
  | "approve"
  | "request_changes"
  | "reschedule"
  | "takedown"
  | "reinstate"
  | "place_rights_hold"
  | "release_rights_hold"
  | "record_complaint"
  | "update_complaint"
  | "verify_artist"
  | "edit_artist"
  | "review_verification"
  | "create_genre"
  | "edit_genre"
  | "delete_genre"
  | "staff_role"
  | "create_staff"
  | "edit_staff";

const labels: Record<Action, string> = {
  retry_audio: "Retry failed audio",
  approve: "Approve release",
  request_changes: "Request corrections",
  reschedule: "Reschedule release",
  takedown: "Take down release",
  reinstate: "Reinstate for review",
  place_rights_hold: "Place rights hold",
  release_rights_hold: "Release rights hold",
  record_complaint: "Record copyright complaint",
  update_complaint: "Resolve / update complaint",
  verify_artist: "Set artist verification",
  edit_artist: "Edit artist metadata",
  review_verification: "Review artist verification",
  create_genre: "Create genre",
  edit_genre: "Edit genre",
  delete_genre: "Delete unused genre",
  staff_role: "Assign or change role",
  create_staff: "Create staff account",
  edit_staff: "Edit staff account",
};

const actionIcons: Record<Action, React.ComponentType<{ size?: number; className?: string }>> = {
  retry_audio: RefreshCw,
  approve: CheckCircle2,
  request_changes: FileEdit,
  reschedule: CalendarClock,
  takedown: Ban,
  reinstate: RotateCcw,
  place_rights_hold: ShieldAlert,
  release_rights_hold: ShieldCheck,
  record_complaint: AlertTriangle,
  update_complaint: FileCheck,
  verify_artist: BadgeCheck,
  edit_artist: FileEdit,
  review_verification: UserCheck,
  create_genre: Plus,
  edit_genre: FileEdit,
  delete_genre: Trash2,
  staff_role: Shield,
  create_staff: UserPlus,
  edit_staff: Users,
};

const actionTones: Record<Action, "primary" | "amber" | "rose" | "emerald" | "blue" | "default"> = {
  approve: "primary",
  request_changes: "amber",
  place_rights_hold: "rose",
  release_rights_hold: "emerald",
  review_verification: "blue",
  takedown: "rose",
  reinstate: "emerald",
  reschedule: "default",
  retry_audio: "default",
  record_complaint: "amber",
  update_complaint: "blue",
  verify_artist: "blue",
  edit_artist: "default",
  create_genre: "default",
  edit_genre: "default",
  delete_genre: "rose",
  staff_role: "blue",
  create_staff: "default",
  edit_staff: "default",
};

const pageActions: Record<string, Action[]> = {
  "Audio Processing": ["retry_audio"],
  "Review Queue": [
    "approve",
    "request_changes",
    "place_rights_hold",
    "release_rights_hold",
    "review_verification",
  ],
  "Scheduled Releases": ["reschedule", "place_rights_hold", "release_rights_hold"],
  "Music Catalog": ["takedown", "reinstate", "place_rights_hold", "release_rights_hold"],
  "Copyright & Complaints": [
    "record_complaint",
    "update_complaint",
    "place_rights_hold",
    "release_rights_hold",
  ],
  "Artist Directory": ["verify_artist", "edit_artist", "review_verification"],
  "Genre Taxonomy": ["create_genre", "edit_genre", "delete_genre"],
  "Staff & Access": ["create_staff", "staff_role", "edit_staff"],
};

export function AdminActions({
  data,
  page,
  refresh,
}: {
  data: AdminSnapshot;
  page: string;
  refresh: () => Promise<void>;
}) {
  const [action, setAction] = useState<Action | null>(null);
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [image, setImage] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [role, setRole] = useState("moderator");
  const [verified, setVerified] = useState(true);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [complaintStatus, setComplaintStatus] = useState<
    "received" | "under_investigation" | "resolved" | "dismissed"
  >("received");
  const [complainantName, setComplainantName] = useState("");
  const [complainantEmail, setComplainantEmail] = useState("");
  const [conflictNature, setConflictNature] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [verificationDecision, setVerificationDecision] = useState<
    "approved" | "rejected" | "more_info_required"
  >("approved");
  const [verificationFeedback, setVerificationFeedback] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [imageBase64, setImageBase64] = useState("");
  const [imageMeta, setImageMeta] = useState<{
    width: number;
    height: number;
    size: number;
    name: string;
  } | null>(null);
  const [imageWarning, setImageWarning] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const handleImageFile = (file: File) => {
    setImageWarning("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setImageWarning("Please select a valid PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageWarning("Image file size must be 5 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) return;
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        const ratio = width / height;
        setImageMeta({ width, height, size: file.size, name: file.name });
        setImageBase64(result);
        if (ratio < 1.7 || ratio > 2.3) {
          setImageWarning(
            `Notice: Uploaded image is ${width}×${height} (${ratio.toFixed(2)}:1). Recommended aspect ratio is 2:1 (e.g. 800×400 px) for optimal display on discovery cards.`
          );
        } else if (width < 600 || height < 300) {
          setImageWarning(
            `Notice: Uploaded image resolution (${width}×${height} px) is lower than the recommended 800×400 px minimum.`
          );
        } else {
          setImageWarning("");
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const isModerator = data.currentUser.role === "moderator";
  const rawAllowed = (pageActions[page] || []).filter(
    (action) =>
      action !== "retry_audio" || data.tracks.some((track) => track.processingAvailable !== false),
  );
  // Moderators cannot execute final copyright takedowns/reinstatements/hold releases or staff actions
  const allowed = rawAllowed.filter(
    (a) =>
      !isModerator ||
      ![
        "review_verification",
        "takedown",
        "reinstate",
        "release_rights_hold",
        "update_complaint",
        "staff_role",
        "create_staff",
        "edit_staff",
      ].includes(a),
  );

  if (
    !allowed.length ||
    (data.currentUser.role === "moderator" &&
      !["Review Queue", "Copyright & Complaints"].includes(page)) ||
    (page === "Staff & Access" && data.currentUser.role !== "super_admin")
  )
    return null;

  const targets =
    action === "review_verification"
      ? (data.verifications || [])
          .filter((v) => v.status === "pending")
          .map((v) => ({
            id: v.id,
            label: `${v.stageName} (${v.legalName}) · Status: ${v.status} · Links: ${v.supportingLinks?.length || 0}`,
          }))
      : action === "retry_audio"
        ? data.tracks
            .filter((t) => t.audioProcessingStatus === "failed")
            .map((t) => ({ id: t.id, label: t.title + " · " + t.artistName }))
        : ["staff_role", "edit_staff"].includes(action || "")
          ? data.users
              .filter(
                (u) =>
                  u.id !== data.currentUser.id &&
                  u.adminRole !== "super_admin" &&
                  (action !== "edit_staff" || ["admin", "moderator"].includes(u.adminRole || "")),
              )
              .map((u) => ({
                id: u.id,
                label: `${u.name} · ${u.email} · ${u.adminActive ? u.adminRole : "ordinary user"}`,
              }))
          : action === "update_complaint"
            ? (data.complaints || []).map((c) => ({
                id: c.id,
                label: `${c.complaintReference} · ${c.complainantName} (${c.status})`,
              }))
            : action === "record_complaint"
              ? [
                  { id: "general", label: "General complaint (no specific release)" },
                  ...data.releases.map((r) => ({
                    id: r.id,
                    label: `Release: ${r.title} · ${r.artistName}`,
                  })),
                ]
              : action === "release_rights_hold"
                ? data.releases
                    .filter((r) => r.rightsHold)
                    .map((r) => ({
                      id: r.id,
                      label: `${r.title} · ${r.artistName} (Hold: ${r.rightsHoldReason || "Active"})`,
                    }))
                : action === "place_rights_hold"
                  ? data.releases
                      .filter((r) => !r.rightsHold)
                      .map((r) => ({
                        id: r.id,
                        label: `${r.title} · ${r.artistName} · ${r.status}`,
                      }))
                  : action?.includes("artist")
                    ? data.artists.map((a) => ({ id: a.id, label: a.displayName }))
                    : action?.includes("genre")
                      ? data.genres.map((g) => ({ id: g.id, label: g.name }))
                      : data.releases
                          .filter((r) =>
                            action === "reschedule"
                              ? r.status === "scheduled"
                              : action === "approve" || action === "request_changes"
                                ? r.status === "under_review"
                                : true,
                          )
                          .map((r) => ({
                            id: r.id,
                            label: `${r.title} · ${r.artistName} · ${r.status}`,
                          }));

  const open = (a: Action) => {
    setAction(a);
    setTargetId("");
    setReason("");
    setDate("");
    setName("");
    setSlug("");
    setImage("");
    setBio("");
    setLocation("");
    setPassword("");
    setEmail("");
    setUsername("");
    setInitialPassword("");
    setComplaintStatus("received");
    setComplainantName("");
    setComplainantEmail("");
    setConflictNature("");
    setEvidenceNotes("");
    setResolutionNotes("");
    setRole("moderator");
    setConfirmed(false);
    setMessage("");
    setImageBase64("");
    setImageMeta(null);
    setImageWarning("");
    setDragActive(false);
  };

  const selectTarget = (id: string) => {
    setTargetId(id);
    const user = data.users.find((u) => u.id === id);
    if (user) {
      setName(user.name);
      setUsername(user.username || "");
      setEmail(user.email);
    }
    const r = data.releases.find((x) => x.id === id);
    if (r) setDate(r.releaseDate);
    const g = data.genres.find((x) => x.id === id);
    if (g) {
      setName(g.name);
      setSlug(g.slug);
      setImage(g.image);
      setImageBase64("");
      setImageMeta(null);
      setImageWarning("");
    }
    const a = data.artists.find((x) => x.id === id);
    if (a) {
      setName(a.displayName);
      setLocation(a.location);
      setVerified(a.verified);
    }
    const comp = (data.complaints || []).find((c) => c.id === id);
    if (comp) {
      setComplaintStatus(comp.status);
      setResolutionNotes(comp.resolutionNotes || "");
    }
  };

  const submit = async () => {
    if (!action || !confirmed || busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (action === "retry_audio") {
        const result = await retryAdminAudio({ data: { trackId: targetId } });
        if (!result.success) throw new Error(result.error);
      } else if (action === "approve") {
        await approveReleaseFn({ data: { releaseId: targetId, newReleaseDate: date } });
      } else if (action === "request_changes") {
        await requestChangesReleaseFn({ data: { releaseId: targetId, feedback: reason } });
      } else {
        const fields: Record<string, unknown> = {
          action,
          targetId: ["create_genre", "create_staff"].includes(action) ? "new" : targetId,
          reason: reason || resolutionNotes || "Administrative action recorded.",
          confirmed: true,
        };
        if (action === "reschedule") fields["date"] = date;
        if (action === "record_complaint") {
          fields["complainantName"] = complainantName;
          fields["complainantEmail"] = complainantEmail;
          fields["conflictNature"] = conflictNature;
          fields["evidenceNotes"] = evidenceNotes;
          fields["complaintStatus"] = complaintStatus;
        }
        if (action === "update_complaint") {
          fields["complaintStatus"] = complaintStatus;
          fields["resolutionNotes"] = resolutionNotes;
        }
        if (["staff_role", "create_staff", "edit_staff"].includes(action)) {
          if (action !== "edit_staff") fields["role"] = role;
          if (action !== "staff_role") {
            fields["name"] = name;
            fields["username"] = username;
            fields["email"] = email;
          }
          if (action === "create_staff") fields["initialPassword"] = initialPassword;
          fields["password"] = password;
        }
        if (action === "verify_artist") fields["verified"] = verified;
        if (action === "review_verification") {
          fields["verificationStatus"] = verificationDecision;
          fields["feedback"] = verificationFeedback.trim();
        }
        if (action === "edit_artist") {
          fields["name"] = name;
          fields["location"] = location;
          if (bio) fields["bio"] = bio;
        }
        if (action === "create_genre" || action === "edit_genre") {
          fields["name"] = name;
          fields["slug"] = slug;
          if (imageBase64) {
            fields["imageBase64"] = imageBase64;
          } else if (image) {
            fields["image"] = image;
          }
        }
        await performAdminOperation({ data: fields });
      }
      setPassword("");
      setInitialPassword("");
      setAction(null);
      await refresh();
      setMessage("Change saved and recorded in the administrative audit log.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "The operation failed. Refresh and retry.");
    } finally {
      setBusy(false);
      setPassword("");
      setInitialPassword("");
    }
  };

  return (
    <section className="ad-action-bar">
      {/* Desktop Action Buttons */}
      <div className="ad-action-buttons-desktop">
        {allowed.map((a) => {
          const Icon = actionIcons[a];
          const tone = actionTones[a];
          return (
            <button
              key={a}
              type="button"
              className={`ad-action-btn tone-${tone}`}
              onClick={() => open(a)}
            >
              {Icon && <Icon size={14} className="shrink-0" />}
              <span>{labels[a]}</span>
            </button>
          );
        })}
      </div>

      {/* Mobile Action Dropdown */}
      <div className="ad-action-buttons-mobile">
        <AdminDropdown
          value=""
          placeholder={`Choose Action (${allowed.length})…`}
          onChange={(val) => {
            if (val) open(val as Action);
          }}
          options={allowed.map((a) => ({
            value: a,
            label: labels[a],
            icon: actionIcons[a],
          }))}
          buttonClassName="ad-action-mobile-trigger"
        />
      </div>

      {!action && message && <p className="ad-action-status-msg" role="status">{message}</p>}

      {/* Action Form Modal */}
      <Dialog
        open={!!action}
        onOpenChange={(v) => {
          if (!busy && !v) {
            setAction(null);
            setPassword("");
            setInitialPassword("");
          }
        }}
      >
        <DialogContent overlayClassName="ad-dialog-overlay" className="ad-dialog ad-action-modal">
          <div className="ad-modal-header">
            <div className="ad-modal-badge">
              <span className={`ad-modal-badge-dot tone-${action ? actionTones[action] : "default"}`} />
              <span>Plugg Administration</span>
            </div>
            <DialogTitle className="ad-modal-title">
              {action ? labels[action] : ""}
            </DialogTitle>
            <DialogDescription className="ad-modal-description">
              Changes affect live records in the existing Plugg database. All actions require confirmation and are durably audited.
            </DialogDescription>
          </div>

          <form
            className="ad-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {action !== "create_genre" && action !== "create_staff" && (
              <div className="ad-form-field">
                <span className="ad-form-label">Target Record</span>
                <AdminDropdown
                  fullWidth
                  searchable={targets.length > 5}
                  value={targetId}
                  onChange={selectTarget}
                  placeholder="Select an existing record…"
                  options={targets.map((t) => ({
                    value: t.id,
                    label: t.label,
                  }))}
                />
              </div>
            )}

            {(action === "approve" || action === "reschedule") && (
              <div className="ad-form-field">
                <span className="ad-form-label">Future publication date (midnight Kampala)</span>
                <input
                  required
                  type="date"
                  className="ad-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                <span className="ad-field-hint">Publication takes effect at 00:00 Africa/Kampala (EAT) on the chosen date.</span>
              </div>
            )}

            {(action === "create_genre" || action === "edit_genre" || action === "edit_artist") && (
              <div className="ad-form-field">
                <span className="ad-form-label">Name</span>
                <input
                  required
                  className="ad-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            {(action === "create_genre" || action === "edit_genre") && (
              <>
                <div className="ad-form-field">
                  <span className="ad-form-label">Slug</span>
                  <input
                    required
                    className="ad-input"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                  />
                  <span className="ad-field-hint">URL identifier matching the discovery path, e.g. "afrobeats".</span>
                </div>

                <div className="ad-form-field">
                  <div className="ad-field-header">
                    <span className="ad-form-label">Cover Artwork</span>
                    <span className="ad-badge-req">2:1 Landscape · Rec. 800×400 px</span>
                  </div>

                  {/* Requirements & Guidelines */}
                  <div className="ad-upload-specs">
                    <div className="ad-upload-spec-item">
                      <b>Aspect Ratio:</b> 2:1 Landscape
                    </div>
                    <div className="ad-upload-spec-item">
                      <b>Dimensions:</b> 800 × 400 px recommended (min 600×300)
                    </div>
                    <div className="ad-upload-spec-item">
                      <b>Format & Size:</b> PNG, JPG, or WebP up to 5 MB
                    </div>
                    <div className="ad-upload-spec-item">
                      <b>Cloud Storage:</b> Cloudflare R2 bucket (<code>plugg-private-media</code>)
                    </div>
                  </div>

                  {/* Live Card Preview or Dropzone */}
                  {imageBase64 || image ? (
                    <div className="ad-genre-preview-container">
                      <div className="ad-genre-preview-card">
                        <img
                          src={imageBase64 || safeMediaUrl(image) || image}
                          alt={`${name || "Genre"} preview`}
                          className="ad-genre-preview-img"
                        />
                        <div className="ad-genre-preview-overlay">
                          <span className="ad-genre-preview-pill">DISCOVERY PREVIEW</span>
                          <h3 className="ad-genre-preview-title">{name || "Genre Name"}</h3>
                          <p className="ad-genre-preview-slug">/{slug || "slug"}</p>
                        </div>
                      </div>

                      <div className="ad-genre-preview-details">
                        {imageMeta ? (
                          <div className="ad-genre-file-info">
                            <span className="ad-genre-dim-tag">
                              {imageMeta.width} × {imageMeta.height} px ({(imageMeta.width / imageMeta.height).toFixed(2)}:1)
                            </span>
                            <span className="ad-genre-size-tag">
                              {(imageMeta.size / 1024).toFixed(0)} KB · {imageMeta.name}
                            </span>
                          </div>
                        ) : (
                          <div className="ad-genre-file-info">
                            <span className="ad-genre-dim-tag">Current Cloudflare R2 Artwork</span>
                            <span className="ad-genre-size-tag">{image}</span>
                          </div>
                        )}

                        <div className="ad-genre-preview-actions">
                          <label className="ad-btn ad-btn-secondary ad-btn-sm" style={{ cursor: "pointer" }}>
                            <Upload size={14} />
                            <span>{imageBase64 ? "Change file" : "Upload new image"}</span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              style={{ display: "none" }}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleImageFile(f);
                              }}
                            />
                          </label>
                          {imageBase64 && (
                            <button
                              type="button"
                              className="ad-btn ad-btn-danger ad-btn-sm"
                              onClick={() => {
                                setImageBase64("");
                                setImageMeta(null);
                                setImageWarning("");
                              }}
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`ad-file-dropzone ${dragActive ? "ad-dropzone-active" : ""}`}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        setDragActive(true);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragActive(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setDragActive(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragActive(false);
                        const f = e.dataTransfer.files?.[0];
                        if (f) handleImageFile(f);
                      }}
                    >
                      <Upload size={28} className="ad-dropzone-icon" />
                      <div className="ad-dropzone-text">
                        <span className="ad-dropzone-title">Upload genre cover artwork</span>
                        <span className="ad-dropzone-hint">Drag and drop file here, or click to browse</span>
                      </div>
                      <label className="ad-btn ad-btn-primary ad-btn-sm" style={{ cursor: "pointer" }}>
                        <span>Choose image</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleImageFile(f);
                          }}
                        />
                      </label>
                    </div>
                  )}

                  {imageWarning && (
                    <div className="ad-genre-warning">
                      <AlertTriangle size={15} />
                      <span>{imageWarning}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {action === "edit_artist" && (
              <>
                <div className="ad-form-field">
                  <span className="ad-form-label">Location</span>
                  <input
                    className="ad-input"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
                <div className="ad-form-field">
                  <span className="ad-form-label">Biography (leave blank to keep unchanged)</span>
                  <textarea
                    className="ad-textarea"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                </div>
              </>
            )}

            {action === "verify_artist" && (
              <div className="ad-form-field">
                <span className="ad-field-hint">
                  Records a platform verification badge. Does not replace external legal checks.
                </span>
                <label className="ad-checkbox-label">
                  <input
                    type="checkbox"
                    className="ad-checkbox"
                    checked={verified}
                    onChange={(e) => setVerified(e.target.checked)}
                  />
                  <span>Platform Verified Artist Badge</span>
                </label>
              </div>
            )}

            {action === "review_verification" && (
              <>
                <div className="ad-form-field">
                  <span className="ad-form-label">Verification Decision</span>
                  <AdminDropdown
                    fullWidth
                    value={verificationDecision}
                    onChange={(v) => setVerificationDecision(v as any)}
                    options={[
                      {
                        value: "approved",
                        label: "Approve & Verify (Grants badge)",
                        tone: "green",
                        icon: CheckCircle2,
                      },
                      {
                        value: "more_info_required",
                        label: "Request More Information",
                        tone: "amber",
                        icon: FileEdit,
                      },
                      {
                        value: "rejected",
                        label: "Decline / Reject Application",
                        tone: "red",
                        icon: Ban,
                      },
                    ]}
                  />
                </div>
                {(verificationDecision === "more_info_required" ||
                  verificationDecision === "rejected") && (
                  <div className="ad-form-field">
                    <span className="ad-form-label">Feedback / Reason for Artist *</span>
                    <textarea
                      required
                      rows={3}
                      className="ad-textarea"
                      value={verificationFeedback}
                      onChange={(e) => setVerificationFeedback(e.target.value)}
                      placeholder="Specify what additional documentation, links, or clarification are required…"
                    />
                  </div>
                )}
              </>
            )}

            {["staff_role", "create_staff", "edit_staff"].includes(action || "") && (
              <>
                {action !== "staff_role" && (
                  <>
                    <div className="ad-form-field">
                      <span className="ad-form-label">Full Name</span>
                      <input
                        required
                        className="ad-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="ad-form-field">
                      <span className="ad-form-label">Username</span>
                      <input
                        required
                        pattern="[a-z0-9_-]{3,30}"
                        autoComplete="off"
                        className="ad-input"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </div>
                    <div className="ad-form-field">
                      <span className="ad-form-label">Email Address</span>
                      <input
                        required
                        type="email"
                        className="ad-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </>
                )}
                {action === "create_staff" && (
                  <div className="ad-form-field">
                    <span className="ad-form-label">Initial Temporary Password</span>
                    <input
                      required
                      type="password"
                      minLength={12}
                      maxLength={72}
                      autoComplete="new-password"
                      className="ad-input"
                      value={initialPassword}
                      onChange={(e) => setInitialPassword(e.target.value)}
                    />
                    <span className="ad-field-hint">
                      At least 12 characters. Share credentials securely with the staff member.
                    </span>
                  </div>
                )}
                {action !== "edit_staff" && (
                  <div className="ad-form-field">
                    <span className="ad-form-label">RBAC Access Level</span>
                    <AdminDropdown
                      fullWidth
                      value={role}
                      onChange={setRole}
                      options={[
                        {
                          value: "moderator",
                          label: "Moderator",
                          sublabel: "Can inspect review queue and audio checks",
                        },
                        {
                          value: "admin",
                          label: "Admin",
                          sublabel: "Full release, catalog and rights management",
                        },
                        ...(action === "staff_role"
                          ? [
                              {
                                value: "none",
                                label: "Revoke Staff Access",
                                tone: "red" as const,
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                )}
                <div className="ad-form-field">
                  <span className="ad-form-label">Your Current Password (re-authentication)</span>
                  <input
                    required
                    type="password"
                    autoComplete="current-password"
                    className="ad-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </>
            )}

            {action === "record_complaint" && (
              <>
                <div className="ad-form-field">
                  <span className="ad-form-label">Complainant Name</span>
                  <input
                    required
                    className="ad-input"
                    value={complainantName}
                    onChange={(e) => setComplainantName(e.target.value)}
                    placeholder="Rights holder or claimant name"
                  />
                </div>
                <div className="ad-form-field">
                  <span className="ad-form-label">Complainant Email (stored privately)</span>
                  <input
                    required
                    type="email"
                    className="ad-input"
                    value={complainantEmail}
                    onChange={(e) => setComplainantEmail(e.target.value)}
                    placeholder="claimant@example.com"
                  />
                </div>
                <div className="ad-form-field">
                  <span className="ad-form-label">Nature of Reported Conflict</span>
                  <textarea
                    required
                    className="ad-textarea"
                    value={conflictNature}
                    onChange={(e) => setConflictNature(e.target.value)}
                    placeholder="Unauthorized master re-upload, uncleared beat/sample, cover without license…"
                  />
                </div>
                <div className="ad-form-field">
                  <span className="ad-form-label">Supporting Evidence References (optional)</span>
                  <textarea
                    className="ad-textarea"
                    value={evidenceNotes}
                    onChange={(e) => setEvidenceNotes(e.target.value)}
                    placeholder="Links to original catalog release, registration identifiers, timestamp proof…"
                  />
                </div>
                <div className="ad-form-field">
                  <span className="ad-form-label">Case Status</span>
                  <AdminDropdown
                    fullWidth
                    value={complaintStatus}
                    onChange={(v) => setComplaintStatus(v as any)}
                    options={[
                      { value: "received", label: "Received", tone: "amber" },
                      { value: "under_investigation", label: "Under Investigation", tone: "blue" },
                      { value: "resolved", label: "Resolved", tone: "green" },
                      { value: "dismissed", label: "Dismissed", tone: "default" },
                    ]}
                  />
                </div>
              </>
            )}

            {action === "update_complaint" && (
              <>
                <div className="ad-form-field">
                  <span className="ad-form-label">Updated Case Status</span>
                  <AdminDropdown
                    fullWidth
                    value={complaintStatus}
                    onChange={(v) => setComplaintStatus(v as any)}
                    options={[
                      { value: "received", label: "Received", tone: "amber" },
                      { value: "under_investigation", label: "Under Investigation", tone: "blue" },
                      { value: "resolved", label: "Resolved", tone: "green" },
                      { value: "dismissed", label: "Dismissed", tone: "default" },
                    ]}
                  />
                </div>
                <div className="ad-form-field">
                  <span className="ad-form-label">Resolution & Decision Notes</span>
                  <textarea
                    required
                    className="ad-textarea"
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Findings of investigation, rights documentation verified, or reason for dismissal…"
                  />
                </div>
              </>
            )}

            {action !== "approve" && action !== "retry_audio" && action !== "update_complaint" && (
              <div className="ad-form-field">
                <span className="ad-form-label">
                  {action === "request_changes"
                    ? "Required Artist Feedback / Corrections"
                    : action === "record_complaint"
                      ? "Initial Internal Notes"
                      : action === "place_rights_hold"
                        ? "Hold Reason (visible to artist)"
                        : "Required Reason / Justification"}
                </span>
                <textarea
                  required
                  className="ad-textarea"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Detail the rationale for this administrative action…"
                />
              </div>
            )}

            <div className="ad-form-confirmation">
              <label className="ad-checkbox-label">
                <input
                  required
                  type="checkbox"
                  className="ad-checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span className="ad-checkbox-text">
                  I confirm this action on the selected record
                  {["staff_role", "create_staff", "edit_staff"].includes(action || "")
                    ? " and have verified the intended staff account"
                    : ""}
                  .
                </span>
              </label>
            </div>

            {message && (
              <div className="ad-form-alert" role="alert">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <div className="ad-form-actions">
              <button
                type="button"
                className="ad-btn ad-btn-secondary"
                onClick={() => setAction(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                className="ad-btn ad-btn-primary ad-confirm-btn"
                disabled={busy || !confirmed || (action !== "create_genre" && action !== "create_staff" && !targetId)}
                type="submit"
              >
                {busy ? (
                  <>
                    <RefreshCw size={13} className="ad-spin mr-1.5" />
                    Saving…
                  </>
                ) : (
                  "Confirm and save"
                )}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
