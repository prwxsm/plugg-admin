import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { performAdminOperation, retryAdminAudio } from "@/lib/api";
import { approveReleaseFn, requestChangesReleaseFn } from "@/lib/api";
import type { AdminSnapshot } from "./model";
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
  const [action, setAction] = useState<Action | null>(null),
    [targetId, setTargetId] = useState(""),
    [reason, setReason] = useState(""),
    [date, setDate] = useState(""),
    [name, setName] = useState(""),
    [slug, setSlug] = useState(""),
    [image, setImage] = useState(""),
    [bio, setBio] = useState(""),
    [location, setLocation] = useState(""),
    [role, setRole] = useState("moderator"),
    [verified, setVerified] = useState(true),
    [password, setPassword] = useState(""),
    [email, setEmail] = useState(""),
    [username, setUsername] = useState(""),
    [initialPassword, setInitialPassword] = useState(""),
    [complaintStatus, setComplaintStatus] = useState<
      "received" | "under_investigation" | "resolved" | "dismissed"
    >("received"),
    [complainantName, setComplainantName] = useState(""),
    [complainantEmail, setComplainantEmail] = useState(""),
    [conflictNature, setConflictNature] = useState(""),
    [evidenceNotes, setEvidenceNotes] = useState(""),
    [resolutionNotes, setResolutionNotes] = useState(""),
    [verificationDecision, setVerificationDecision] = useState<
      "approved" | "rejected" | "more_info_required"
    >("approved"),
    [verificationFeedback, setVerificationFeedback] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");

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
      } else if (action === "approve")
        await approveReleaseFn({ data: { releaseId: targetId, newReleaseDate: date } });
      else if (action === "request_changes")
        await requestChangesReleaseFn({ data: { releaseId: targetId, feedback: reason } });
      else {
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
          fields["image"] = image;
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
    <section className="ad-panel" style={{ padding: 16, marginBottom: 16 }}>
      <div className="ad-dialog-actions">
        {allowed.map((a) => (
          <button key={a} className="ad-btn" onClick={() => open(a)}>
            {labels[a]}
          </button>
        ))}
      </div>
      {!action && message && <p role="status">{message}</p>}
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
        <DialogContent overlayClassName="ad-dialog-overlay" className="ad-dialog">
          <DialogTitle>{action ? labels[action] : ""}</DialogTitle>
          <DialogDescription>
            Changes affect the existing Plugg database and are recorded with your account. Review
            the target carefully.
          </DialogDescription>
          <form
            className="ad-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {action !== "create_genre" && action !== "create_staff" && (
              <label>
                Target
                <select required value={targetId} onChange={(e) => selectTarget(e.target.value)}>
                  <option value="">Select an existing record</option>
                  {targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(action === "approve" || action === "reschedule") && (
              <label>
                Future publication date (midnight Kampala)
                <input
                  required
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
            )}
            {(action === "create_genre" || action === "edit_genre" || action === "edit_artist") && (
              <label>
                Name
                <input required value={name} onChange={(e) => setName(e.target.value)} />
              </label>
            )}
            {(action === "create_genre" || action === "edit_genre") && (
              <>
                <label>
                  Slug
                  <input required value={slug} onChange={(e) => setSlug(e.target.value)} />
                </label>
                <label>
                  Artwork URL
                  <input value={image} onChange={(e) => setImage(e.target.value)} />
                </label>
              </>
            )}
            {action === "edit_artist" && (
              <>
                <label>
                  Location
                  <input value={location} onChange={(e) => setLocation(e.target.value)} />
                </label>
                <label>
                  New biography (blank leaves unchanged)
                  <textarea value={bio} onChange={(e) => setBio(e.target.value)} />
                </label>
              </>
            )}
            {action === "verify_artist" && (
              <>
                <p>
                  This records a platform verification decision; it does not perform an identity
                  check.
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={verified}
                    onChange={(e) => setVerified(e.target.checked)}
                  />{" "}
                  Verified artist
                </label>
              </>
            )}
            {action === "review_verification" && (
              <>
                <label>
                  Verification Decision
                  <select
                    value={verificationDecision}
                    onChange={(e) => setVerificationDecision(e.target.value as any)}
                  >
                    <option value="approved">Approve & Verify (Grants verified badge)</option>
                    <option value="more_info_required">Request More Information</option>
                    <option value="rejected">Decline / Reject Application</option>
                  </select>
                </label>
                {(verificationDecision === "more_info_required" ||
                  verificationDecision === "rejected") && (
                  <label>
                    Feedback / Reason for Artist *
                    <textarea
                      required
                      rows={3}
                      value={verificationFeedback}
                      onChange={(e) => setVerificationFeedback(e.target.value)}
                      placeholder="Specify what additional information, links, or documentation are required..."
                    />
                  </label>
                )}
              </>
            )}
            {["staff_role", "create_staff", "edit_staff"].includes(action || "") && (
              <>
                {action !== "staff_role" && (
                  <>
                    <label>
                      Full name
                      <input required value={name} onChange={(e) => setName(e.target.value)} />
                    </label>
                    <label>
                      Username
                      <input
                        required
                        pattern="[a-z0-9_-]{3,30}"
                        autoComplete="off"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </label>
                    <label>
                      Email
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </label>
                  </>
                )}
                {action === "create_staff" && (
                  <>
                    <label>
                      Initial password
                      <input
                        required
                        type="password"
                        minLength={12}
                        maxLength={72}
                        autoComplete="new-password"
                        value={initialPassword}
                        onChange={(e) => setInitialPassword(e.target.value)}
                      />
                    </label>
                    <p>
                      Use at least 12 characters. Share credentials privately with the staff member.
                      No email is sent; they can change the password after signing in.
                    </p>
                  </>
                )}
                {action !== "edit_staff" && (
                  <label>
                    Access
                    <select value={role} onChange={(e) => setRole(e.target.value)}>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                      {action === "staff_role" && <option value="none">Revoke staff access</option>}
                    </select>
                  </label>
                )}
                <label>
                  Your current password
                  <input
                    required
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              </>
            )}
            {action === "record_complaint" && (
              <>
                <label>
                  Complainant name
                  <input
                    required
                    value={complainantName}
                    onChange={(e) => setComplainantName(e.target.value)}
                    placeholder="Rights holder or claimant name"
                  />
                </label>
                <label>
                  Complainant email (stored privately)
                  <input
                    required
                    type="email"
                    value={complainantEmail}
                    onChange={(e) => setComplainantEmail(e.target.value)}
                    placeholder="claimant@example.com"
                  />
                </label>
                <label>
                  Nature of reported conflict
                  <textarea
                    required
                    value={conflictNature}
                    onChange={(e) => setConflictNature(e.target.value)}
                    placeholder="Unauthorized master re-upload, uncleared beat/sample, cover without mechanical license, etc."
                  />
                </label>
                <label>
                  Supporting evidence references (optional)
                  <textarea
                    value={evidenceNotes}
                    onChange={(e) => setEvidenceNotes(e.target.value)}
                    placeholder="Links to original catalog release, registration identifiers, timestamp proof, etc."
                  />
                </label>
                <label>
                  Case status
                  <select
                    value={complaintStatus}
                    onChange={(e) => setComplaintStatus(e.target.value as any)}
                  >
                    <option value="received">Received</option>
                    <option value="under_investigation">Under Investigation</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                </label>
              </>
            )}
            {action === "update_complaint" && (
              <>
                <label>
                  Updated case status
                  <select
                    value={complaintStatus}
                    onChange={(e) => setComplaintStatus(e.target.value as any)}
                  >
                    <option value="received">Received</option>
                    <option value="under_investigation">Under Investigation</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                </label>
                <label>
                  Resolution & decision notes
                  <textarea
                    required
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Findings of investigation, rights documentation verified, or reason for dismissal/reinstatement."
                  />
                </label>
              </>
            )}
            {action !== "approve" && action !== "retry_audio" && action !== "update_complaint" && (
              <label>
                {action === "request_changes"
                  ? "Required artist feedback"
                  : action === "record_complaint"
                    ? "Initial internal notes"
                    : action === "place_rights_hold"
                      ? "Hold reason (visible to artist)"
                      : "Required reason"}
                <textarea required value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
            )}
            <label>
              <input
                required
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />{" "}
              I confirm this action on the selected record
              {["staff_role", "create_staff", "edit_staff"].includes(action || "")
                ? " and have verified the intended staff account"
                : ""}
              .
            </label>
            {message && <p role="alert">{message}</p>}
            <button className="ad-btn ad-btn-primary" disabled={busy || !confirmed} type="submit">
              {busy ? "Saving…" : "Confirm and save"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
