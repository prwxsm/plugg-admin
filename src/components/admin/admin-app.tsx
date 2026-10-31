import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  AudioLines,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Disc3,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tags,
  Users,
  CalendarClock,
  ChartNoAxesCombined,
} from "lucide-react";
import { getAdminSnapshot } from "@/lib/api";
import { loginUser, logoutUser } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  count,
  kampala,
  pendingHours,
  statusLabels,
  type AdminResult,
  type AdminSnapshot,
  type AdminTrack,
  type AdminComplaint,
} from "./model";
import {
  Artwork,
  AudioPreview,
  DisabledAction,
  Empty,
  Pill,
  SLA,
  Specs,
  Unavailable,
  Variants,
} from "./primitives";
import {
  AdminOverview,
  AdminTelemetry,
  AdminAnalytics,
  AdminStaff,
  AdminProcessing,
} from "./operations";
import "./admin.css";
import { AdminBrand } from "./brand";
import { ProfileCard, type ProfileCardData } from "./profile-card";
import { AdminActions } from "./actions";
const nav = [
  ["Overview", "/admin", LayoutDashboard],
  ["Review Queue", "/admin/review-queue", ShieldAlert],
  ["Scheduled Releases", "/admin/scheduled", CalendarClock],
  ["Music Catalog", "/admin/catalog", Disc3],
  ["Copyright & Complaints", "/admin/complaints", AlertTriangle],
  ["Artist Directory", "/admin/artists", Users],
  ["Genre Taxonomy", "/admin/genres", Tags],
  ["Users", "/admin/users", Users],
  ["Audio Processing", "/admin/processing", AudioLines],
  ["Streaming & Anti-Fraud", "/admin/telemetry", Activity],
  ["Analytics", "/admin/analytics", ChartNoAxesCombined],
  ["Staff & Access", "/admin/staff", ShieldCheck],
] as const;
const subtitles: Record<string, string> = {
  Overview: "The pulse of your platform, from the existing Plugg database.",
  "Review Queue":
    "Inspect actual submissions, metadata and audio. Use the review actions to record a decision.",
  "Scheduled Releases":
    "Stored publication dates and scheduler readiness. No automatic publication.",
  "Music Catalog": "Existing tracks and releases, with recorded visibility and audio metadata.",
  "Copyright & Complaints":
    "Internal copyright dispute records received via support@plugg.site and active publication rights holds.",
  "Artist Directory": "Existing artist accounts, identity details and recorded verification.",
  "Genre Taxonomy": "Current discovery taxonomy and matching catalog counts.",
  Users: "Existing Plugg accounts and their database permissions.",
  "Audio Processing": "Recorded processing state and stored variant metadata.",
  "Streaming & Anti-Fraud": "Recorded play events. No simulated traffic or invented fraud alerts.",
  Analytics: "Database aggregates and recorded play events, with their limits made visible.",
  "Staff & Access": "Role-based staff access and durable administrative audit history.",
};
export function AdminApp() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const page = nav.find((n) => n[1] === path.replace(/\/$/, ""))?.[0] || "Overview";
  const [result, setResult] = useState<AdminResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileCardData | null>(null);
  const [mobile, setMobile] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [newest, setNewest] = useState(false);
  const [detail, setDetail] = useState<AdminTrack | null>(null);
  const [now, setNow] = useState(Date.now());
  const requestId = useRef(0);
  const timeAnchor = useRef({ server: Date.now(), local: Date.now() });
  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const next = await getAdminSnapshot();
      if (id !== requestId.current) return;
      setResult(next);
      if (next.status === "ok") {
        timeAnchor.current = { server: Date.parse(next.data.fetchedAt), local: Date.now() };
        setNow(timeAnchor.current.server);
      }
    } catch {
      if (id === requestId.current)
        setResult({
          status: "unavailable",
          message:
            "Could not reach the Plugg backend. Check the server connection and retry. No substitute data has been loaded.",
        });
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    setQuery("");
    setFilter("all");
    setMobile(false);
    setDetail(null);
    return () => {
      requestId.current++;
    };
  }, [path, refresh]);
  useEffect(() => {
    const id = setInterval(
      () => setNow(timeAnchor.current.server + Date.now() - timeAnchor.current.local),
      1000,
    );
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!autoRefresh || result?.status !== "ok") return;
    const id = setInterval(() => void refresh(), 30000);
    return () => clearInterval(id);
  }, [autoRefresh, result?.status, refresh]);
  const signOut = async () => {
    requestId.current++;
    setResult(null);
    setDetail(null);
    setLoading(true);
    try {
      await logoutUser();
      setResult({ status: "unauthenticated", message: "You are signed out of Plugg." });
    } catch {
      setResult({
        status: "unavailable",
        message: "Sign out could not be confirmed. Retry when the backend is reachable.",
      });
    } finally {
      setLoading(false);
    }
  };
  if (!result || result.status !== "ok")
    return <AdminGate result={result} loading={loading} refresh={refresh} />;
  const data = result.data;
  const pageAllowed =
    data.currentUser.role === "super_admin" ||
    (data.currentUser.role === "moderator"
      ? ["Overview", "Review Queue", "Copyright & Complaints"].includes(page)
      : !["Users", "Staff & Access"].includes(page));
  if (!pageAllowed)
    return (
      <AdminGate
        result={{
          status: "forbidden",
          message:
            "Your administrative role does not permit this module. Return to /admin/review-queue.",
        }}
        loading={false}
        refresh={refresh}
      />
    );
  const m = data.metrics;
  const match = (value: string) => value.toLowerCase().includes(query.trim().toLowerCase());
  const releases = data.releases.filter((r) =>
    match(
      `${r.title} ${r.artistName} ${data.tracks
        .filter((t) => t.releaseId === r.id)
        .map((t) => t.pluggTrackId)
        .join(" ")}`,
    ),
  );
  const reviews = releases
    .filter((r) =>
      filter === "changes"
        ? r.status === "changes_required"
        : r.status === "under_review" &&
          (filter === "critical"
            ? (pendingHours(r, now) ?? -1) >= 18
            : filter === "processing"
              ? ["pending", "processing"].includes(r.audioProcessingStatus)
              : true),
    )
    .sort((a, b) => {
      const aTime = a.reviewSubmittedAt ? Date.parse(a.reviewSubmittedAt) : null;
      const bTime = b.reviewSubmittedAt ? Date.parse(b.reviewSubmittedAt) : null;
      if (aTime === null) return 1;
      if (bTime === null) return -1;
      return (aTime - bTime) * (newest ? -1 : 1);
    });
  const artists = data.artists.filter(
    (a) =>
      match(`${a.displayName} ${a.username} ${a.location}`) &&
      (filter === "verified" ? a.verified : filter === "unverified" ? !a.verified : true),
  );
  const tracks = data.tracks.filter(
    (t) =>
      match(`${t.title} ${t.artistName} ${t.pluggTrackId || ""} ${t.releaseTitle}`) &&
      (filter === "all" || t.releaseStatus === filter),
  );
  const users = data.users.filter(
    (u) =>
      match(`${u.name} ${u.username || ""} ${u.email} ${u.artistName || ""}`) &&
      (filter === "admin" ? u.isAdmin : filter === "all" || u.accountType === filter),
  );
  return (
    <div className="ad-app ad-real">
      <aside className={`ad-sidebar ${mobile ? "open" : ""}`}>
        <Link to="/admin" className="ad-brand">
          <AdminBrand />
        </Link>
        <p className="ad-staff-label">STAFF BACK-OFFICE</p>
        <div className="ad-environment">
          <span className="ad-dot" />
          Existing PostgreSQL<small>Africa/Kampala (UTC+03:00)</small>
        </div>
        <div className="ad-nav-label">WORKSPACE</div>
        <nav aria-label="Admin navigation">
          {nav
            .filter(
              ([name]) =>
                data.currentUser.role === "super_admin" ||
                (data.currentUser.role === "moderator"
                  ? ["Overview", "Review Queue", "Copyright & Complaints"].includes(name)
                  : !["Users", "Staff & Access"].includes(name)),
            )
            .map(([name, to, Icon]) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: true }}
                className={`ad-nav-link ${page === name ? "active" : ""}`}
                aria-current={page === name ? "page" : undefined}
              >
                <Icon size={17} />
                <span>{name}</span>
                {name === "Review Queue" && <b>{m.pending}</b>}
              </Link>
            ))}
        </nav>
        <div className="ad-sidebar-bottom">
          <div className="ad-demo-note">
            <LockKeyhole size={17} />
            <div>
              Role-protected administration<small>Authorized actions are audited</small>
            </div>
          </div>
          <ProfileCard
            compact
            profile={data.currentUser}
            actions={
              <>
                <button
                  className="ad-btn"
                  onClick={() =>
                    setProfile({
                      ...data.currentUser,
                      joinedAt: data.currentUser.createdAt ?? null,
                      status: "Signed in",
                    })
                  }
                >
                  My profile
                </button>
                <button className="ad-btn" aria-label="Sign out" onClick={() => void signOut()}>
                  <LogOut size={14} />
                  Sign out
                </button>
              </>
            }
          />
        </div>
      </aside>
      <div className="ad-workspace">
        <header className="ad-topbar">
          <div>
            <button
              className="ad-mobile-menu"
              aria-label="Toggle navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div>
            <span className="ad-system">
              <span className="ad-dot" />
              Database connected
            </span>
            <Clock3 size={14} />
            <span>{kampala(now).split(", ")[1]} EAT</span>
          </div>
        </header>
        <main className="ad-main">
          <div className="ad-page-heading">
            <div>
              <div className="ad-eyebrow">PLUGG CONTROL CENTER</div>
              <h1>{page === "Overview" ? "Platform overview" : page}</h1>
              <p>{subtitles[page]}</p>
            </div>
            <button className="ad-btn" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw size={14} className={loading ? "ad-spin" : ""} />
              {loading ? "Refreshing…" : "Refresh data"}
            </button>
          </div>
          <div className="ad-readonly-banner">
            <LockKeyhole size={15} />
            <span>
              <b>Role-protected administration.</b> Existing records only; seeded records excluded.
              Authorized actions require confirmation and are audited.
            </span>
            <Pill tone="green">RBAC</Pill>
          </div>
          <AdminActions key={page} data={data} page={page} refresh={refresh} />
          <div className="ad-data-meta">
            <span>Snapshot: {kampala(data.fetchedAt)} EAT</span>
            <label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Refresh every 30 seconds
            </label>
          </div>
          {m.releases > data.releases.length ||
          m.tracks > data.tracks.length ||
          m.artists > data.artists.length ||
          m.users > data.users.length ? (
            <Unavailable>
              Lists show up to {data.limits.records} recent records per entity. Overview totals
              cover all matching records; search filters the loaded records.
            </Unavailable>
          ) : null}
          {page === "Overview" && <AdminOverview data={data} now={now} />}
          {[
            "Review Queue",
            "Music Catalog",
            "Artist Directory",
            "Users",
            "Scheduled Releases",
          ].includes(page) && (
            <div className="ad-toolbar">
              <label className="ad-search">
                <Search size={17} />
                <input
                  aria-label={`Search ${page}`}
                  placeholder={
                    page === "Users"
                      ? "Search accounts, email or artist…"
                      : page === "Artist Directory"
                        ? "Search artists, handles or locations…"
                        : "Search releases, artists or Plugg track ID…"
                  }
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              {page === "Review Queue" ? (
                <select
                  aria-label="Submission sort order"
                  value={newest ? "new" : "old"}
                  onChange={(e) => setNewest(e.target.value === "new")}
                >
                  <option value="old">Oldest submission first</option>
                  <option value="new">Newest submission first</option>
                </select>
              ) : page === "Music Catalog" ? (
                <select
                  aria-label="Catalog status"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All release statuses</option>
                  {Object.entries(statusLabels).map(([key, title]) => (
                    <option value={key} key={key}>
                      {title}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          )}
          {page === "Review Queue" && (
            <>
              <div className="ad-tabs">
                {[
                  ["all", "All pending", m.pending],
                  ["critical", "Critical SLA (≥18h)", m.approaching + m.breached],
                  [
                    "processing",
                    "Audio processing",
                    data.releases.filter(
                      (r) =>
                        r.status === "under_review" &&
                        ["pending", "processing"].includes(r.audioProcessingStatus),
                    ).length,
                  ],
                  [
                    "changes",
                    "Changes requested",
                    data.releases.filter((r) => r.status === "changes_required").length,
                  ],
                ].map(([id, label, n]) => (
                  <button
                    className={filter === id ? "active" : ""}
                    key={id}
                    onClick={() => setFilter(String(id))}
                  >
                    {label}
                    <span>{n}</span>
                  </button>
                ))}
              </div>
              <div className="ad-review-list">
                {reviews.map((r) => (
                  <section className="ad-panel ad-review" key={r.id}>
                    <div className="ad-review-heading">
                      <Artwork src={r.coverUrl} title={`${r.title} artwork`} className="ad-cover" />
                      <div>
                        <div className="ad-tags">
                          <h2>{r.title}</h2>
                          <Pill>{r.type}</Pill>
                          {r.rightsHold && (
                            <Pill tone="red">
                              RIGHTS HOLD: {r.rightsHoldReason || "Publication blocked"}
                            </Pill>
                          )}
                          <Pill tone={r.rightsDeclarationAccepted ? "green" : "amber"}>
                            Rights:{" "}
                            {r.rightsDeclarationAccepted
                              ? `Confirmed (${r.uploaderRole || "owner"})`
                              : "Unconfirmed"}
                          </Pill>
                        </div>
                        <p>
                          <Link to="/admin/artists" hash={r.artistId}>
                            {r.artistName}
                          </Link>{" "}
                          · {r.label || "Label not recorded"}
                        </p>
                        <small>
                          Release date: {r.releaseDate} · Stored go-live: {kampala(r.goLiveAt)} EAT
                        </small>
                        {r.goLiveAt && Date.parse(r.goLiveAt) <= now && (
                          <Pill tone="red">Original publication time elapsed</Pill>
                        )}
                      </div>
                      <div className="ad-review-sla">
                        {r.status === "under_review" ? (
                          <SLA release={r} now={now} />
                        ) : (
                          <Pill tone="amber">Changes required</Pill>
                        )}
                      </div>
                    </div>
                    {r.trackIds
                      .map((id) => data.tracks.find((t) => t.id === id))
                      .filter((t): t is AdminTrack => !!t)
                      .map((t, i) => (
                        <div className="ad-track" key={t.id}>
                          <div className="ad-track-heading">
                            <span className="ad-track-index">{String(i + 1).padStart(2, "0")}</span>
                            <div>
                              <strong>
                                {t.title}
                                {t.features ? ` feat. ${t.features}` : ""}
                              </strong>
                              <small>
                                Producer: {t.producers || "Not recorded"} ·{" "}
                                {Math.floor(t.durationSeconds / 60)}:
                                {String(t.durationSeconds % 60).padStart(2, "0")} ·{" "}
                                Plugg ID: {t.pluggTrackId || "Not assigned"}
                                {t.isrc ? ` · Official ISRC: ${t.isrc}` : ""}
                              </small>
                              <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                                <Pill tone={t.recordingType === "remix" || t.recordingType === "cover" ? "amber" : ""}>
                                  Type: {(t.recordingType || "original").toUpperCase()}
                                </Pill>
                                {t.hasSamplesOrBeats && (
                                  <Pill tone="amber">
                                    3rd-Party Content: {t.sampleDetails || "Samples/licensed beats"}
                                  </Pill>
                                )}
                                {t.duplicateMatchesCount && t.duplicateMatchesCount > 0 ? (
                                  <Pill tone="red">
                                    DUPLICATE AUDIO: Exact checksum match in other artist catalog ({t.duplicateMatchesCount})
                                  </Pill>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <Specs track={t} />
                          <AudioPreview track={t} />
                          <Variants track={t} />
                        </div>
                      ))}
                    {!r.trackIds.length && (
                      <Empty title="No linked tracks">
                        This release has no non-seed tracks recorded.
                      </Empty>
                    )}
                    <details className="ad-history">
                      <summary>Recorded review history · {r.reviewHistory.length} events</summary>
                      {r.reviewHistory.map((h, i) => (
                        <div key={i}>
                          <small>
                            {kampala(h.timestamp)} · {h.actorName || "Actor not recorded"}
                          </small>
                          <p>
                            {h.action.replaceAll("_", " ")}
                            {h.feedback ? ` — ${h.feedback}` : ""}
                            {h.notes ? ` — ${h.notes}` : ""}
                          </p>
                        </div>
                      ))}
                      {r.reviewFeedback && <p>Latest feedback: {r.reviewFeedback}</p>}
                      {!r.reviewHistory.length && (
                        <p>No review history is recorded for this release.</p>
                      )}
                    </details>
                    <div className="ad-review-footer">
                      <span>Use the review actions above to record your decision.</span>
                    </div>
                  </section>
                ))}
                {!reviews.length && (
                  <Empty title="No submissions in this view">
                    The database returned no matching review submissions.
                  </Empty>
                )}
              </div>
            </>
          )}
          {page === "Scheduled Releases" && (
            <>
              <Unavailable>
                The existing scheduler publishes only when the listener data loader runs. This admin
                view does not trigger it. Independent midnight scheduling is not implemented.
              </Unavailable>
              <section className="ad-panel">
                <div className="ad-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "Release",
                          "Artist",
                          "Release date",
                          "Stored go-live · EAT",
                          "Readiness",
                        ].map((x) => (
                          <th key={x}>{x}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {releases
                        .filter((r) => r.status === "scheduled")
                        .map((r) => (
                          <tr key={r.id}>
                            <td>
                              <strong>{r.title}</strong>
                            </td>
                            <td>{r.artistName}</td>
                            <td>{r.releaseDate}</td>
                            <td>{kampala(r.goLiveAt)}</td>
                            <td>
                              <Pill
                                tone={
                                  !r.goLiveAt || Date.parse(r.goLiveAt) <= now ? "amber" : "green"
                                }
                              >
                                {!r.goLiveAt
                                  ? "Publication time missing"
                                  : Date.parse(r.goLiveAt) <= now
                                    ? "Overdue · still scheduled"
                                    : r.audioProcessingStatus}
                              </Pill>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {!releases.some((r) => r.status === "scheduled") && (
                  <Empty title="No scheduled releases">
                    There are no matching non-seed scheduled releases in the database.
                  </Empty>
                )}
              </section>
            </>
          )}
          {page === "Music Catalog" && (
            <section className="ad-panel">
              <div className="ad-table-wrap">
                <table>
                  <thead>
                    <tr>
                      {[
                        "Track / Release",
                        "Plugg track ID",
                        "Artist",
                        "Genre",
                        "Release date",
                        "Release status",
                        "Plays / Downloads",
                        "Track visibility",
                        "Details",
                      ].map((x) => (
                        <th key={x}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tracks.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <div className="ad-identity">
                            <Artwork src={t.coverUrl} title="" />
                            <div>
                              <strong>{t.title}</strong>
                              <small>{t.releaseTitle}</small>
                            </div>
                          </div>
                        </td>
                        <td>{t.pluggTrackId || "Not recorded"}</td>
                        <td>{t.artistName}</td>
                        <td>{t.genre || "Not recorded"}</td>
                        <td>{t.releaseDate}</td>
                        <td>
                          <Pill tone={t.releaseStatus === "published" ? "green" : "amber"}>
                            {statusLabels[t.releaseStatus] || t.releaseStatus}
                          </Pill>
                        </td>
                        <td>
                          {t.playCount.toLocaleString()} / {t.downloadCount.toLocaleString()}
                        </td>
                        <td>
                          <Pill tone={t.published ? "green" : ""}>
                            {t.published ? "Published flag on" : "Published flag off"}
                          </Pill>
                        </td>
                        <td>
                          <button className="ad-btn subtle" onClick={() => setDetail(t)}>
                            Inspect {t.title}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!tracks.length && <Empty />}
            </section>
          )}
          {page === "Copyright & Complaints" && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <section className="ad-panel" style={{ padding: "16px 20px" }}>
                  <small style={{ color: "var(--ad-muted, #6b7280)", display: "block" }}>
                    Active Rights Holds
                  </small>
                  <strong style={{ fontSize: 24, color: "var(--ad-red, #dc2626)" }}>
                    {data.releases.filter((r) => r.rightsHold).length}
                  </strong>
                  <div style={{ fontSize: 12, color: "var(--ad-muted, #6b7280)", marginTop: 4 }}>
                    Releases blocked from publishing
                  </div>
                </section>
                <section className="ad-panel" style={{ padding: "16px 20px" }}>
                  <small style={{ color: "var(--ad-muted, #6b7280)", display: "block" }}>
                    Open Disputes / Complaints
                  </small>
                  <strong style={{ fontSize: 24, color: "var(--ad-amber, #d97706)" }}>
                    {
                      (data.complaints || []).filter((c) =>
                        ["received", "under_investigation"].includes(c.status),
                      ).length
                    }
                  </strong>
                  <div style={{ fontSize: 12, color: "var(--ad-muted, #6b7280)", marginTop: 4 }}>
                    support@plugg.site reports pending
                  </div>
                </section>
                <section className="ad-panel" style={{ padding: "16px 20px" }}>
                  <small style={{ color: "var(--ad-muted, #6b7280)", display: "block" }}>
                    Resolved / Dismissed Cases
                  </small>
                  <strong style={{ fontSize: 24, color: "var(--ad-green, #16a34a)" }}>
                    {
                      (data.complaints || []).filter((c) =>
                        ["resolved", "dismissed"].includes(c.status),
                      ).length
                    }
                  </strong>
                  <div style={{ fontSize: 12, color: "var(--ad-muted, #6b7280)", marginTop: 4 }}>
                    Audited resolutions & reinstatements
                  </div>
                </section>
              </div>

              <section className="ad-panel" style={{ marginBottom: 20 }}>
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid var(--ad-border, #e5e7eb)",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Active Rights Holds</h3>
                  <small style={{ color: "var(--ad-muted, #6b7280)" }}>
                    Releases held from Africa/Kampala midnight publication and streaming until rights review is complete.
                  </small>
                </div>
                <div className="ad-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {["Release", "Artist", "Status", "Hold Reason", "Hold Placed", "Actions"].map((x) => (
                          <th key={x}>{x}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.releases
                        .filter((r) => r.rightsHold)
                        .map((r) => (
                          <tr key={r.id}>
                            <td>
                              <div className="ad-identity">
                                <Artwork src={r.coverUrl} title="" />
                                <div>
                                  <strong>{r.title}</strong>
                                  <small>{r.type} · {r.releaseDate}</small>
                                </div>
                              </div>
                            </td>
                            <td>{r.artistName}</td>
                            <td>
                              <Pill tone="amber">{statusLabels[r.status] || r.status}</Pill>
                            </td>
                            <td>
                              <strong style={{ color: "var(--ad-red, #dc2626)" }}>
                                {r.rightsHoldReason || "Rights review pending"}
                              </strong>
                            </td>
                            <td>{r.rightsHoldPlacedAt ? kampala(r.rightsHoldPlacedAt) : "Recorded"}</td>
                            <td>
                              <Pill tone="red">Held</Pill>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {!data.releases.some((r) => r.rightsHold) && (
                  <Empty title="No active rights holds">
                    There are no catalog or scheduled releases currently blocked by publication holds.
                  </Empty>
                )}
              </section>

              <section className="ad-panel">
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid var(--ad-border, #e5e7eb)",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                    Copyright Complaints (support@plugg.site)
                  </h3>
                  <small style={{ color: "var(--ad-muted, #6b7280)" }}>
                    Privately recorded reports, complainant contacts (staff only), and resolution history.
                  </small>
                </div>
                <div className="ad-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "Reference",
                          "Case Status",
                          "Target Release / Track",
                          "Complainant (Confidential)",
                          "Conflict Nature",
                          "Evidence / Admin Notes",
                          "Received At",
                          "Outcome",
                        ].map((x) => (
                          <th key={x}>{x}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(data.complaints || []).map((c) => (
                        <tr key={c.id}>
                          <td>
                            <strong>{c.complaintReference}</strong>
                          </td>
                          <td>
                            <Pill
                              tone={
                                c.status === "resolved"
                                  ? "green"
                                  : c.status === "dismissed"
                                    ? ""
                                    : "amber"
                              }
                            >
                              {c.status.toUpperCase()}
                            </Pill>
                          </td>
                          <td>
                            <div>
                              <strong>{c.releaseTitle || "General catalog"}</strong>
                              {c.trackTitle && <small> · Track: {c.trackTitle}</small>}
                              {c.artistName && <small> · Artist: {c.artistName}</small>}
                            </div>
                          </td>
                          <td>
                            <div>
                              <span>{c.complainantName}</span>
                              <br />
                              <small style={{ color: "var(--ad-muted, #6b7280)" }}>
                                {c.complainantEmail}
                              </small>
                            </div>
                          </td>
                          <td>
                            <p style={{ margin: 0, maxWidth: 280, fontSize: 13 }}>
                              {c.conflictNature}
                            </p>
                          </td>
                          <td>
                            <small>{c.evidenceNotes || c.adminNotes || "None recorded"}</small>
                          </td>
                          <td>{kampala(c.createdAt)}</td>
                          <td>
                            <small>
                              {c.resolutionNotes ||
                                (c.resolvedAt
                                  ? `Closed ${kampala(c.resolvedAt)}`
                                  : "Under evaluation")}
                            </small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!(data.complaints || []).length && (
                  <Empty title="No complaints logged">
                    No copyright dispute records have been logged from support@plugg.site.
                  </Empty>
                )}
              </section>
            </>
          )}
          {page === "Artist Directory" && (
            <>
              <div className="ad-tabs">
                {[
                  ["all", "All artists"],
                  ["verified", "Verified"],
                  ["unverified", "Unverified"],
                ].map(([id, title]) => (
                  <button
                    key={id}
                    className={filter === id ? "active" : ""}
                    onClick={() => setFilter(id!)}
                  >
                    {title}
                  </button>
                ))}
              </div>
              <Unavailable>
                Verification is displayed as stored. Unverified does not imply a pending KYC
                request; no KYC request table or featured-artist field exists.
              </Unavailable>
              <section className="ad-panel">
                <div className="ad-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "Artist",
                          "Location / Genre",
                          "Stored listeners / Plays",
                          "Terms accepted · EAT",
                          "Phone",
                          "Verification",
                          "Actions",
                        ].map((x) => (
                          <th key={x}>{x}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {artists.map((a) => (
                        <tr key={a.id} id={a.id}>
                          <td>
                            <div className="ad-identity">
                              <Artwork src={a.avatarUrl} title="" />
                              <div>
                                <strong>{a.displayName}</strong>
                                <small>@{a.username}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            {a.location ||
                              [a.city, a.country].filter(Boolean).join(", ") ||
                              "Not recorded"}
                            <small className="ad-block">
                              {a.primaryGenre || "Genre not recorded"}
                            </small>
                          </td>
                          <td>
                            {a.monthlyListeners.toLocaleString()} / {a.totalPlays.toLocaleString()}
                          </td>
                          <td>{kampala(a.termsAcceptedAt)}</td>
                          <td>{a.phoneNumber || "Not recorded"}</td>
                          <td>
                            <Pill tone={a.verified ? "blue" : ""}>
                              {a.verified ? (
                                <>
                                  <BadgeCheck size={13} />
                                  Verified
                                </>
                              ) : (
                                "Unverified"
                              )}
                            </Pill>
                          </td>
                          <td>
                            <small>Use artist actions above</small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!artists.length && <Empty />}
              </section>
            </>
          )}
          {page === "Genre Taxonomy" && (
            <>
              <div className="ad-toolbar">
                <span className="ad-muted">
                  Artist counts match the primary genre; track counts match genre name or slug.
                </span>
              </div>
              <div className="ad-genre-grid">
                {data.genres.map((g, i) => (
                  <section className="ad-genre-card" key={g.id}>
                    <Artwork src={g.image} title={`${g.name} artwork`} />
                    <div className="ad-genre-overlay">
                      <Pill>0{i + 1} / DISCOVERY</Pill>
                      <h2>{g.name}</h2>
                      <p>/{g.slug}</p>
                    </div>
                    <div className="ad-genre-footer">
                      <span>
                        <b>{g.trackCount}</b> tracks · <b>{g.artistCount}</b> artists
                      </span>
                      <small>Use genre actions above</small>
                    </div>
                  </section>
                ))}
              </div>
              {!data.genres.length && <Empty title="No genres recorded" />}
            </>
          )}
          {page === "Users" && (
            <>
              <div className="ad-tabs">
                {[
                  ["all", "All accounts"],
                  ["listener", "Listeners"],
                  ["artist", "Artists"],
                  ["admin", "Administrators"],
                ].map(([id, title]) => (
                  <button
                    key={id}
                    className={filter === id ? "active" : ""}
                    onClick={() => setFilter(id!)}
                  >
                    {title}
                  </button>
                ))}
              </div>
              {m.users > 0 && m.users === m.adminUsers && (
                <Unavailable>
                  Every non-seed user currently has the administrator flag enabled in the database.
                  Access governance needs review; this interface has not changed these flags.
                </Unavailable>
              )}
              <section className="ad-panel">
                <div className="ad-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "Name / Handle",
                          "Email",
                          "Account type",
                          "Artist",
                          "Created · EAT",
                          "Administrator",
                        ].map((x) => (
                          <th key={x}>{x}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <button
                              className="ad-profile-link"
                              onClick={() =>
                                setProfile({
                                  ...u,
                                  role: u.adminActive ? u.adminRole : u.accountType,
                                  joinedAt: u.createdAt,
                                  status: u.adminRole
                                    ? u.adminActive
                                      ? "Staff active"
                                      : "Revoked"
                                    : "No staff access",
                                })
                              }
                            >
                              {u.name}
                            </button>
                            <small className="ad-block">
                              {u.username ? `@${u.username}` : "Handle not recorded"}
                            </small>
                          </td>
                          <td>{u.email}</td>
                          <td>{u.accountType}</td>
                          <td>{u.artistName || "Not linked"}</td>
                          <td>{kampala(u.createdAt)}</td>
                          <td>
                            <Pill>{u.isAdmin ? "Yes" : "No"}</Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!users.length && <Empty />}
              </section>
            </>
          )}
          {page === "Audio Processing" && <AdminProcessing data={data} inspect={setDetail} />}
          {page === "Streaming & Anti-Fraud" && <AdminTelemetry data={data} />}
          {page === "Analytics" && <AdminAnalytics data={data} />}
          {page === "Staff & Access" && <AdminStaff data={data} />}
          <footer className="ad-footer">
            <span>
              <span className="ad-dot" />
              Plugg staff operations · Audited administration
            </span>
            <span>{m.excludedSeedRecords} database seed rows excluded · Africa/Kampala</span>
          </footer>
        </main>
        <Outlet />
      </div>
      <Dialog
        open={!!profile}
        onOpenChange={(open) => {
          if (!open) setProfile(null);
        }}
      >
        <DialogContent overlayClassName="ad-dialog-overlay" className="ad-dialog">
          <DialogTitle>Profile</DialogTitle>
          <DialogDescription>Account information from Plugg.</DialogDescription>
          {profile && <ProfileCard profile={profile} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent overlayClassName="ad-dialog-overlay" className="ad-dialog ad-app">
          <DialogTitle>{detail?.title || "Track details"}</DialogTitle>
          <DialogDescription>
            {detail?.pluggTrackId || "Recorded technical specifications"}
          </DialogDescription>
          {detail && (
            <div className="ad-form">
              <div
                style={{
                  background: "var(--ad-bg-subtle, #f9fafb)",
                  border: "1px solid var(--ad-border, #e5e7eb)",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <Pill
                    tone={
                      detail.recordingType === "remix" || detail.recordingType === "cover"
                        ? "amber"
                        : ""
                    }
                  >
                    Recording: {(detail.recordingType || "original").toUpperCase()}
                  </Pill>
                  {detail.isrc && <Pill>Official ISRC: {detail.isrc}</Pill>}
                  <Pill>Plugg Track ID: {detail.pluggTrackId || "Unassigned"}</Pill>
                </div>
                {detail.hasSamplesOrBeats && (
                  <p style={{ margin: "4px 0", fontSize: 13 }}>
                    <strong>3rd-Party Beats / Samples:</strong>{" "}
                    {detail.sampleDetails || "Declared by uploader"}
                  </p>
                )}
                {detail.fileHash && (
                  <p
                    style={{
                      margin: "4px 0",
                      fontSize: 12,
                      fontFamily: "monospace",
                      wordBreak: "break-all",
                    }}
                  >
                    <strong>SHA-256 Checksum:</strong> {detail.fileHash}
                  </p>
                )}
                {detail.duplicateMatchesCount && detail.duplicateMatchesCount > 0 ? (
                  <p
                    style={{
                      margin: "4px 0",
                      fontSize: 13,
                      color: "var(--ad-red, #dc2626)",
                      fontWeight: 600,
                    }}
                  >
                    Exact duplicate audio detected in {detail.duplicateMatchesCount} other account
                    release(s).
                  </p>
                ) : null}
              </div>
              <Specs track={detail} />
              <AudioPreview track={detail} />
              <Variants track={detail} />
              <div className="ad-variant-list">
                {detail.audioVariants.map((v) => (
                  <p key={v.name}>
                    {v.name} · {v.format || "format unknown"} · {v.bitrateKbps ?? "—"} kbps ·{" "}
                    {v.sizeBytes === null
                      ? "size unknown"
                      : `${(v.sizeBytes / 1048576).toFixed(2)} MB`}
                  </p>
                ))}
              </div>
              <div className="ad-dialog-actions">
                <DisabledAction>Retry transcoder</DisabledAction>

                <button className="ad-btn" onClick={() => setDetail(null)}>
                  Close
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function AdminGate({
  result,
  loading,
  refresh,
}: {
  result: AdminResult | null;
  loading: boolean;
  refresh: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSigningIn(true);
    setError("");
    try {
      await loginUser({
        data: {
          identifier: String(form.get("identifier") || ""),
          password: String(form.get("password") || ""),
        },
      });
      await refresh();
    } catch {
      setError("Sign-in failed. Check your Plugg credentials and the backend connection.");
    } finally {
      setSigningIn(false);
    }
  };
  return (
    <div className="ad-app ad-gate">
      <div className="ad-gate-card">
        <div className="ad-brand">
          <AdminBrand />
        </div>
        <Pill>
          <LockKeyhole size={12} />
          Role-protected administration
        </Pill>
        <h1>
          {loading
            ? "Connecting to Plugg…"
            : result?.status === "forbidden"
              ? "Access denied"
              : result?.status === "unavailable"
                ? "Database unavailable"
                : result?.status === "unauthenticated" && result.reason === "session_expired"
                  ? "Session expired"
                  : "Sign in to Plugg Admin"}
        </h1>
        <p role="status">
          {loading
            ? "Verifying your existing session before loading administrative records."
            : result && result.status !== "ok"
              ? result.message
              : ""}
        </p>
        {!loading && result?.status === "unauthenticated" && (
          <form className="ad-form" onSubmit={submit}>
            <label>
              Email or username
              <input name="identifier" autoComplete="username" required />
            </label>
            <label>
              Password
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            {error && <p role="alert">{error}</p>}
            <button className="ad-btn primary" disabled={signingIn}>
              {signingIn ? "Signing in…" : "Sign in with Plugg"}
            </button>
          </form>
        )}
        {!loading && result?.status === "forbidden" && (
          <div className="ad-gate-links">
            <a href="/admin">Back to overview</a>
            <button
              className="ad-btn"
              onClick={async () => {
                await logoutUser();
                await refresh();
              }}
            >
              Use another account
            </button>
          </div>
        )}
        {!loading && result?.status === "unavailable" && (
          <button className="ad-btn" onClick={() => void refresh()}>
            Retry connection
          </button>
        )}
        <small>
          Uses the existing Plugg session and active administrative membership. No demo accounts or
          fallback data.
        </small>
      </div>
    </div>
  );
}
