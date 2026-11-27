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
  ChevronDown,
  Clock3,
  Disc3,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tags,
  Users,
  CalendarClock,
  ChartNoAxesCombined,
  ClipboardList,
  Play,
  Download,
  Heart,
  Eye,
  EyeOff,
  Lock,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronsRight,
  ChevronsLeft,
} from "lucide-react";
import { getAdminSnapshot, performAdminOperation } from "@/lib/api";
import { loginUser, logoutUser } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  count,
  safeMediaUrl,
  kampala,
  pendingHours,
  statusLabels,
  formatMetricCount,
  type AdminResult,
  type AdminSnapshot,
  type AdminTrack,
  type AdminComplaint,
  type AdminRelease,
  type AdminHistory,
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
  ReleaseAuditScorecard,
  TrackAuditInspector,
} from "./primitives";
import { computeReleaseAudit, auditTrack } from "./audit";
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
import { AdminDropdown } from "./dropdown";
import { AdminAuditLogView } from "./audit-log";
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
  ["Audit Log", "/admin/audit", ClipboardList],
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
  "Audit Log": "Permanent immutable audit trail of all staff decisions, rights actions, and role updates.",
};
function CollapsibleReviewHistory({ releases }: { releases: AdminRelease[] }) {
  const [open, setOpen] = useState(false);
  const history = releases
    .flatMap((r: AdminRelease) =>
      r.reviewHistory.map((h: AdminHistory, i: number) => ({ ...h, key: `${r.id}-${i}`, release: r.title })),
    )
    .sort(
      (a, b) =>
        (b.timestamp ? Date.parse(b.timestamp) : 0) - (a.timestamp ? Date.parse(a.timestamp) : 0),
    );

  return (
    <section className="ad-panel ad-audit ad-collapsible-panel">
      <button
        type="button"
        className="ad-collapsible-trigger"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <div className="ad-collapsible-info">
          <div className="ad-collapsible-title-row">
            <h2>Recorded release review history</h2>
            <Pill tone="neutral">{history.length} recorded events</Pill>
          </div>
          <p>Read from releases.review_history. This is not a global immutable audit log.</p>
        </div>
        <div className="ad-collapsible-chevron-box">
          <ChevronDown
            size={18}
            className={`ad-collapsible-chevron ${open ? "open" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="ad-collapsible-body">
          {history.map((h) => (
            <div className="ad-log" key={h.key}>
              <span className="ad-log-dot" />
              <time>{kampala(h.timestamp)} EAT</time>
              <p>
                {h.actorName || "Actor not recorded"} · {h.action.replaceAll("_", " ")} · {h.release}
                {h.feedback ? ` — ${h.feedback}` : ""}
                {h.notes ? ` — ${h.notes}` : ""}
              </p>
            </div>
          ))}
          {!history.length && <Empty title="No release review history recorded" />}
        </div>
      )}
    </section>
  );
}

export function AdminApp() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const page = nav.find((n) => n[1] === path.replace(/\/$/, ""))?.[0] || "Overview";
  const [result, setResult] = useState<AdminResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileCardData | null>(null);
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("plugg_admin_sidebar_collapsed") === "true";
    }
    return false;
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("plugg_admin_sidebar_collapsed", String(next));
      }
      return next;
    });
  };
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
        : filter === "processing"
          ? r.status === "processing" ||
            (r.status === "under_review" && ["pending", "processing"].includes(r.audioProcessingStatus))
          : r.status === "under_review" &&
            (filter !== "critical" || (pendingHours(r, now) ?? -1) >= 18),
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
  const verifications = (data.verifications || []).filter((v) =>
    match(`${v.stageName} ${v.legalName} ${v.contactEmail} ${v.primaryGenre || ""}`),
  );

  const handleReviewVerification = async (
    targetId: string,
    status: "approved" | "rejected" | "more_info_required",
    feedbackPrompt?: string,
  ) => {
    let feedback = "";
    if (status !== "approved") {
      const input = window.prompt(feedbackPrompt || "Enter feedback for artist:");
      if (!input || !input.trim()) return;
      feedback = input.trim();
    } else {
      if (
        !window.confirm(
          "Approve this artist's verification application and grant official verified badge?",
        )
      ) {
        return;
      }
    }
    try {
      await performAdminOperation({
        data: {
          action: "review_verification",
          targetId,
          verificationStatus: status,
          feedback,
          reason: feedback || "Approved artist verification application",
          confirmed: true,
        },
      });
      await refresh();
    } catch (err: any) {
      alert(err?.message || "Operation failed");
    }
  };
  return (
    <div className={`ad-app ad-real ${collapsed ? "ad-collapsed" : ""}`}>
      {/* Mobile Drawer Backdrop */}
      {mobile && (
        <div
          className="ad-sidebar-backdrop"
          onClick={() => setMobile(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`ad-sidebar ${mobile ? "open" : ""} ${collapsed ? "collapsed" : ""}`}
        onClick={(e) => {
          if (
            collapsed &&
            (e.target === e.currentTarget ||
              (e.target as HTMLElement).classList.contains("ad-sidebar-header") ||
              (e.target as HTMLElement).classList.contains("ad-sidebar-bottom") ||
              (e.target as HTMLElement).classList.contains("ad-nav-list"))
          ) {
            setCollapsed(false);
            if (typeof window !== "undefined") {
              localStorage.setItem("plugg_admin_sidebar_collapsed", "false");
            }
          }
        }}
      >
        {/* Expand Rail on Collapsed Panel Boundary with Expand Cursor */}
        {collapsed && (
          <div
            className="ad-sidebar-expand-rail"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed(false);
              if (typeof window !== "undefined") {
                localStorage.setItem("plugg_admin_sidebar_collapsed", "false");
              }
            }}
            title="Click to expand sidebar"
            aria-label="Click to expand sidebar"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                setCollapsed(false);
                if (typeof window !== "undefined") {
                  localStorage.setItem("plugg_admin_sidebar_collapsed", "false");
                }
              }
            }}
          >
            <span className="ad-expand-pill" aria-hidden="true">
              <ChevronsRight size={13} />
            </span>
          </div>
        )}

        <div className="ad-sidebar-header">
          <Link
            to="/admin"
            className="ad-brand"
            title="Plugg Admin"
            onClick={() => mobile && setMobile(false)}
          >
            <AdminBrand markOnly={collapsed} />
          </Link>
          <button
            type="button"
            className="ad-sidebar-toggle-btn"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapsed();
            }}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {!collapsed && <p className="ad-staff-label">STAFF BACK-OFFICE</p>}

        <div
          className="ad-environment"
          title="Existing PostgreSQL · Africa/Kampala (UTC+03:00)"
        >
          <span className="ad-dot" />
          {!collapsed ? (
            <>
              Existing PostgreSQL<small>Africa/Kampala (UTC+03:00)</small>
            </>
          ) : (
            <span className="sr-only">Existing PostgreSQL</span>
          )}
        </div>

        {!collapsed && <div className="ad-nav-label">WORKSPACE</div>}

        <nav aria-label="Admin navigation" className="ad-nav-list">
          {nav
            .filter(
              ([name]) =>
                data.currentUser.role === "super_admin" ||
                (data.currentUser.role === "moderator"
                  ? ["Overview", "Review Queue", "Copyright & Complaints"].includes(name)
                  : !["Users", "Staff & Access"].includes(name)),
            )
            .map(([name, to, Icon]) => {
              const pendingCount =
                name === "Review Queue" ? m.pending + (m.pendingVerifications || 0) : 0;
              return (
                <Link
                  key={to}
                  to={to}
                  activeOptions={{ exact: true }}
                  className={`ad-nav-link ${page === name ? "active" : ""}`}
                  aria-current={page === name ? "page" : undefined}
                  data-tooltip={name}
                  title={collapsed ? name : undefined}
                  onClick={() => mobile && setMobile(false)}
                >
                  <div className="ad-nav-icon-wrap">
                    <Icon size={17} className="ad-nav-icon" />
                    {collapsed && pendingCount > 0 && (
                      <span className="ad-nav-badge-dot">{pendingCount}</span>
                    )}
                  </div>
                  {!collapsed && <span>{name}</span>}
                  {!collapsed && pendingCount > 0 && <b>{pendingCount}</b>}
                </Link>
              );
            })}
        </nav>

        <div className="ad-sidebar-bottom">
          {!collapsed && (
            <div className="ad-demo-note">
              <LockKeyhole size={15} />
              <div>
                Role-protected administration<small>Authorized actions are audited</small>
              </div>
            </div>
          )}
          <button
            type="button"
            className="ad-sidebar-profile-trigger"
            onClick={(e) => {
              e.stopPropagation();
              setProfile({
                ...data.currentUser,
                joinedAt: data.currentUser.createdAt ?? null,
                status: "Signed in",
              });
            }}
            title={
              collapsed
                ? `${data.currentUser.name} (${data.currentUser.role ? data.currentUser.role.replace("_", " ") : "staff"})`
                : "Click to view staff profile and RBAC permissions"
            }
            data-tooltip={
              collapsed
                ? `${data.currentUser.name} (${data.currentUser.role ? data.currentUser.role.replace("_", " ") : "staff"})`
                : undefined
            }
          >
            <div className="ad-avatar">
              {data.currentUser.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </div>
            {!collapsed && (
              <>
                <div className="ad-sidebar-profile-text">
                  <strong>{data.currentUser.name}</strong>
                  <small>
                    {data.currentUser.role
                      ? data.currentUser.role.replace("_", " ")
                      : "staff"}
                  </small>
                </div>
                <ChevronRight size={13} className="ad-sidebar-profile-chevron" />
              </>
            )}
          </button>
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
            <button
              type="button"
              className="ad-topbar-sidebar-toggle"
              onClick={toggleCollapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
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
                <AdminDropdown
                  value={newest ? "new" : "old"}
                  onChange={(val) => setNewest(val === "new")}
                  options={[
                    { value: "old", label: "Oldest submission first" },
                    { value: "new", label: "Newest submission first" },
                  ]}
                />
              ) : page === "Music Catalog" ? (
                <AdminDropdown
                  value={filter}
                  onChange={(val) => setFilter(val)}
                  options={[
                    { value: "all", label: "All release statuses" },
                    ...Object.entries(statusLabels).map(([key, title]) => ({
                      value: key,
                      label: title,
                    })),
                  ]}
                />
              ) : null}
            </div>
          )}
          {page === "Review Queue" && (
            <>
              <div className="ad-queue-buttons">
                {[
                  { id: "all", label: "Pending releases", count: m.pending, Icon: Clock3 },
                  {
                    id: "verifications",
                    label: "Artist verifications",
                    count: (data.verifications || []).filter((v) => v.status === "pending").length,
                    Icon: BadgeCheck,
                  },
                  {
                    id: "critical",
                    label: "Critical SLA (≥18h)",
                    count: m.approaching + m.breached,
                    Icon: AlertTriangle,
                  },
                  {
                    id: "processing",
                    label: "Audio processing",
                    count: data.releases.filter(
                      (r) =>
                        r.status === "processing" ||
                        (r.status === "under_review" &&
                          ["pending", "processing"].includes(r.audioProcessingStatus)),
                    ).length,
                    Icon: AudioLines,
                  },
                  {
                    id: "changes",
                    label: "Changes requested",
                    count: data.releases.filter((r) => r.status === "changes_required").length,
                    Icon: RotateCcw,
                  },
                ].map(({ id, label, count, Icon }) => {
                  const isCrit = id === "critical" && count > 0;
                  return (
                    <button
                      className={`ad-queue-btn ${filter === id ? "active" : ""} ${isCrit ? "critical-alert" : ""}`}
                      key={id}
                      onClick={() => setFilter(id)}
                    >
                      <Icon size={14} className="ad-queue-btn-icon" />
                      <span>{label}</span>
                      <span className="ad-queue-btn-badge">{count}</span>
                    </button>
                  );
                })}
              </div>
              <div className="ad-review-list">
                {filter === "verifications" && (
                  <>
                    {verifications.map((v) => (
                      <section className="ad-panel ad-review" key={v.id}>
                        <div className="ad-review-heading">
                          <div style={{ flex: 1 }}>
                            <div
                              className="ad-tags"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <h2 style={{ margin: 0 }}>{v.stageName}</h2>
                              <Pill
                                tone={
                                  v.status === "approved"
                                    ? "green"
                                    : v.status === "pending"
                                      ? "blue"
                                      : v.status === "more_info_required"
                                        ? "amber"
                                        : "red"
                                }
                              >
                                {v.status === "approved"
                                  ? "VERIFIED"
                                  : v.status === "pending"
                                    ? "PENDING REVIEW"
                                    : v.status === "more_info_required"
                                      ? "MORE INFO REQUIRED"
                                      : "DECLINED"}
                              </Pill>
                              {v.primaryGenre && <Pill>{v.primaryGenre}</Pill>}
                            </div>
                            <p style={{ marginTop: 6 }}>
                              Legal Name: <strong>{v.legalName}</strong> · Contact:{" "}
                              <a
                                href={`mailto:${v.contactEmail}`}
                                style={{ color: "var(--color-primary)" }}
                              >
                                {v.contactEmail}
                              </a>
                              {v.contactPhone ? ` · Tel: ${v.contactPhone}` : ""}
                              {v.city || v.country
                                ? ` · Location: ${[v.city, v.country].filter(Boolean).join(", ")}`
                                : ""}
                            </p>
                            <small>
                              Submitted: {kampala(v.createdAt)} EAT
                              {v.reviewedAt ? ` · Last reviewed: ${kampala(v.reviewedAt)} EAT` : ""}
                            </small>
                          </div>
                        </div>

                        <div
                          style={{
                            padding: "12px 16px",
                            borderTop: "1px solid var(--color-border)",
                          }}
                        >
                          <h4
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--color-muted)",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              marginBottom: 6,
                            }}
                          >
                            Supporting Profiles & Links ({v.supportingLinks?.length || 0})
                          </h4>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {(v.supportingLinks || []).map((link, idx) => (
                              <a
                                key={idx}
                                href={safeMediaUrl(link) || undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ad-btn"
                                style={{ fontSize: 12, padding: "4px 10px" }}
                              >
                                {link} ↗
                              </a>
                            ))}
                          </div>

                          {v.note && (
                            <div
                              style={{
                                marginTop: 10,
                                fontSize: 13,
                                background: "rgba(255,255,255,0.03)",
                                padding: "8px 12px",
                                borderRadius: 8,
                              }}
                            >
                              <strong>Artist Note:</strong> {v.note}
                            </div>
                          )}

                          {v.adminFeedback && (
                            <div
                              style={{
                                marginTop: 8,
                                fontSize: 13,
                                color: "var(--color-amber)",
                                background: "rgba(251,191,36,0.08)",
                                padding: "8px 12px",
                                borderRadius: 8,
                              }}
                            >
                              <strong>Previous Admin Feedback:</strong> {v.adminFeedback}
                            </div>
                          )}
                        </div>

                        {data.currentUser.role !== "moderator" && v.status === "pending" && (
                          <div
                            className="ad-review-footer"
                            style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
                          >
                            <button
                              className="ad-btn"
                              style={{ color: "#34d399", borderColor: "rgba(52,211,153,0.3)" }}
                              onClick={() => void handleReviewVerification(v.id, "approved")}
                            >
                              Approve & Grant Verified Badge
                            </button>
                            <button
                              className="ad-btn"
                              style={{ color: "#fbbf24", borderColor: "rgba(251,191,36,0.3)" }}
                              onClick={() =>
                                void handleReviewVerification(
                                  v.id,
                                  "more_info_required",
                                  "Enter details or links required from the artist:",
                                )
                              }
                            >
                              Request More Info
                            </button>
                            <button
                              className="ad-btn"
                              style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}
                              onClick={() =>
                                void handleReviewVerification(
                                  v.id,
                                  "rejected",
                                  "Enter reason for declining verification:",
                                )
                              }
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </section>
                    ))}
                    {!verifications.length && (
                      <Empty title="No verification applications">
                        There are currently no verification applications matching this search.
                      </Empty>
                    )}
                  </>
                )}
                {filter !== "verifications" &&
                  reviews.map((r) => {
                    const audit = computeReleaseAudit(r, data.tracks);
                    return (
                    <section className="ad-panel ad-review" key={r.id}>
                      <div className="ad-review-heading">
                        <Artwork
                          src={r.coverUrl}
                          title={`${r.title} artwork`}
                          className="ad-cover"
                        />
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
                            · {r.label || "Independent (fallback)"}
                          </p>
                          <small>
                            Release date: {r.releaseDate} · Stored go-live: {kampala(r.goLiveAt)}{" "}
                            EAT
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
                      <ReleaseAuditScorecard audit={audit} />
                      {r.trackIds
                        .map((id) => data.tracks.find((t) => t.id === id))
                        .filter((t): t is AdminTrack => !!t)
                        .map((t, i) => {
                          const trackAudit =
                            audit.tracks.find((ta) => ta.trackId === t.id) ||
                            auditTrack(t, i + 1, r);
                          return (
                          <div className="ad-track" key={t.id}>
                            <div className="ad-track-heading">
                              <span className="ad-track-index">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              <div>
                                <strong>
                                  {t.title}
                                  {t.features ? ` feat. ${t.features}` : ""}
                                </strong>
                                <small>
                                  Producer: {t.producers || "Not recorded"} ·{" "}
                                  {Math.floor(t.durationSeconds / 60)}:
                                  {String(t.durationSeconds % 60).padStart(2, "0")} · Plugg ID:{" "}
                                  {t.pluggTrackId || "Not assigned"}
                                  {t.isrc ? ` · Official ISRC: ${t.isrc}` : ""}
                                </small>
                                <div
                                  style={{
                                    marginTop: 6,
                                    display: "flex",
                                    gap: 6,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <Pill
                                    tone={
                                      t.recordingType === "remix" || t.recordingType === "cover"
                                        ? "amber"
                                        : ""
                                    }
                                  >
                                    Type: {(t.recordingType || "original").toUpperCase()}
                                  </Pill>
                                  {t.hasSamplesOrBeats && (
                                    <Pill tone="amber">
                                      3rd-Party Content:{" "}
                                      {t.sampleDetails || "Samples/licensed beats"}
                                    </Pill>
                                  )}
                                  {t.duplicateMatchesCount && t.duplicateMatchesCount > 0 ? (
                                    <Pill tone="red">
                                      DUPLICATE AUDIO: Exact checksum match in other artist catalog
                                      ({t.duplicateMatchesCount})
                                    </Pill>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            <Specs track={t} />
                            <AudioPreview track={t} />
                            <Variants track={t} />
                            <TrackAuditInspector trackAudit={trackAudit} track={t} />
                          </div>
                          );
                        })}
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
                    );
                  })}
                {filter !== "verifications" && !reviews.length && (
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
            <>
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
                        "Plays",
                        "Downloads",
                        "Likes",
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
                          <span className="ad-stat-pill plays" title={`${t.playCount.toLocaleString()} plays`}>
                            <Play size={11} />
                            <span>{formatMetricCount(t.playCount)}</span>
                          </span>
                        </td>
                        <td>
                          <span className="ad-stat-pill downloads" title={`${t.downloadCount.toLocaleString()} downloads`}>
                            <Download size={11} />
                            <span>{formatMetricCount(t.downloadCount)}</span>
                          </span>
                        </td>
                        <td>
                          <span className="ad-stat-pill likes" title={`${(t.likeCount || 0).toLocaleString()} likes`}>
                            <Heart size={11} />
                            <span>{formatMetricCount(t.likeCount || 0)}</span>
                          </span>
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
            <CollapsibleReviewHistory releases={data.releases} />
          </>
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
                    Releases held from Africa/Kampala midnight publication and streaming until
                    rights review is complete.
                  </small>
                </div>
                <div className="ad-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "Release",
                          "Artist",
                          "Status",
                          "Hold Reason",
                          "Hold Placed",
                          "Actions",
                        ].map((x) => (
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
                                  <small>
                                    {r.type} · {r.releaseDate}
                                  </small>
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
                            <td>
                              {r.rightsHoldPlacedAt ? kampala(r.rightsHoldPlacedAt) : "Recorded"}
                            </td>
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
                    There are no catalog or scheduled releases currently blocked by publication
                    holds.
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
                    Privately recorded reports, complainant contacts (staff only), and resolution
                    history.
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
              <div className="ad-filter-buttons">
                {[
                  ["all", "All artists", data.artists.length],
                  ["verified", "Verified", data.artists.filter((a) => a.verified).length],
                  ["unverified", "Unverified", data.artists.filter((a) => !a.verified).length],
                ].map(([id, title, n]) => (
                  <button
                    key={id as string}
                    className={`ad-filter-btn ${filter === id ? "active" : ""}`}
                    onClick={() => setFilter(id as string)}
                  >
                    <span className="ad-filter-btn-label">{title as string}</span>
                    <span className="ad-filter-btn-badge">{n as number}</span>
                  </button>
                ))}
              </div>
              <Unavailable>
                Verification reflects the current badge. Review submitted badge applications in
                Review Queue → Artist verifications.
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
              <div className="ad-filter-buttons">
                {[
                  ["all", "All accounts", data.users.length],
                  [
                    "listener",
                    "Listeners",
                    data.users.filter((u) => u.accountType === "listener").length,
                  ],
                  [
                    "artist",
                    "Artists",
                    data.users.filter((u) => u.accountType === "artist").length,
                  ],
                  [
                    "admin",
                    "Administrators",
                    data.users.filter((u) => u.isAdmin || u.adminRole !== null).length,
                  ],
                ].map(([id, title, n]) => (
                  <button
                    key={id as string}
                    className={`ad-filter-btn ${filter === id ? "active" : ""}`}
                    onClick={() => setFilter(id as string)}
                  >
                    <span className="ad-filter-btn-label">{title as string}</span>
                    <span className="ad-filter-btn-badge">{n as number}</span>
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
          {page === "Audit Log" &&
            (["super_admin", "admin"].includes(data.currentUser.role) ? (
              <AdminAuditLogView data={data} />
            ) : (
              <Empty title="Access restricted" />
            ))}
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
        <DialogContent overlayClassName="ad-dialog-overlay" className="ad-dialog ad-profile-modal">
          <DialogTitle>Staff Profile & Permissions</DialogTitle>
          <DialogDescription>Account identity and role-based permissions in Plugg.</DialogDescription>
          {profile && <ProfileCard profile={profile} onSignOut={() => void signOut()} />}
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
                  <Pill>Plays: {detail.playCount.toLocaleString()}</Pill>
                  <Pill>Downloads: {detail.downloadCount.toLocaleString()}</Pill>
                  <Pill>Likes: {(detail.likeCount || 0).toLocaleString()}</Pill>
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
  const [showPassword, setShowPassword] = useState(false);

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

  const isExpired =
    result?.status === "unauthenticated" && result.reason === "session_expired";
  const isForbidden = result?.status === "forbidden";
  const isUnavailable = result?.status === "unavailable";

  return (
    <div className="ad-app ad-gate">
      <div className="ad-gate-ambient-glow" aria-hidden="true" />
      <div className="ad-gate-card">
        {/* Brand Header */}
        <div className="ad-gate-header">
          <div className="ad-brand">
            <AdminBrand />
          </div>
          <span className="ad-gate-security-pill">
            <ShieldCheck size={13} className="ad-gate-pill-icon" />
            <span>Staff Portal</span>
          </span>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="ad-gate-loading-state">
            <div className="ad-gate-spinner-box">
              <div className="ad-gate-spinner-ring" />
              <LockKeyhole size={22} className="ad-gate-spinner-icon" />
            </div>
            <div className="ad-gate-text-group">
              <h1 className="ad-gate-title">Connecting to Plugg…</h1>
              <p className="ad-gate-description" role="status">
                Verifying your administrative session and role privileges.
              </p>
            </div>
            <div className="ad-gate-pulse-bar">
              <div className="ad-gate-pulse-fill" />
            </div>
          </div>
        ) : (
          <>
            {/* Forbidden / Access Denied */}
            {isForbidden && (
              <div className="ad-gate-status-pane error">
                <div className="ad-gate-icon-circle rose">
                  <ShieldAlert size={28} />
                </div>
                <div className="ad-gate-text-group">
                  <h1 className="ad-gate-title">Access Denied</h1>
                  <p className="ad-gate-description">
                    {result?.message ||
                      "This account does not have active administrative or moderator access to Plugg."}
                  </p>
                </div>
                <div className="ad-gate-actions">
                  <button
                    type="button"
                    className="ad-btn ad-btn-primary ad-gate-submit-btn"
                    onClick={async () => {
                      await logoutUser();
                      await refresh();
                    }}
                  >
                    <span>Sign in with another account</span>
                    <ArrowRight size={14} />
                  </button>
                  <a href="/" className="ad-gate-link-subtle">
                    Return to listener home
                  </a>
                </div>
              </div>
            )}

            {/* Unavailable / Database Down */}
            {isUnavailable && (
              <div className="ad-gate-status-pane warning">
                <div className="ad-gate-icon-circle amber">
                  <AlertTriangle size={28} />
                </div>
                <div className="ad-gate-text-group">
                  <h1 className="ad-gate-title">Database Unavailable</h1>
                  <p className="ad-gate-description">
                    {result?.message ||
                      "Could not reach the Plugg backend. Check your server connection and retry."}
                  </p>
                </div>
                <div className="ad-gate-actions">
                  <button
                    type="button"
                    className="ad-btn ad-btn-primary ad-gate-submit-btn"
                    onClick={() => void refresh()}
                  >
                    <RefreshCw size={14} />
                    <span>Retry connection</span>
                  </button>
                </div>
              </div>
            )}

            {/* Unauthenticated / Sign-in Form */}
            {!isForbidden && !isUnavailable && (
              <div className="ad-gate-auth-pane">
                <div className="ad-gate-text-group">
                  <h1 className="ad-gate-title">Sign in to Plugg Admin</h1>
                  <p className="ad-gate-description">
                    {isExpired
                      ? "Your session expired. Please sign in again to continue."
                      : "Enter your staff credentials to access the control center."}
                  </p>
                </div>

                {isExpired && (
                  <div className="ad-gate-banner warning">
                    <Clock3 size={15} />
                    <span>Session timed out for security. Re-authentication required.</span>
                  </div>
                )}

                <form className="ad-gate-form" onSubmit={submit}>
                  <div className="ad-gate-field">
                    <label className="ad-gate-label" htmlFor="admin-identifier">
                      <span>Email or username</span>
                    </label>
                    <div className="ad-gate-input-wrapper">
                      <User size={16} className="ad-gate-input-icon" />
                      <input
                        id="admin-identifier"
                        name="identifier"
                        className="ad-gate-input"
                        placeholder="e.g. god or staff@plugg.site"
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>

                  <div className="ad-gate-field">
                    <label className="ad-gate-label" htmlFor="admin-password">
                      <span>Password</span>
                    </label>
                    <div className="ad-gate-input-wrapper">
                      <Lock size={16} className="ad-gate-input-icon" />
                      <input
                        id="admin-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        className="ad-gate-input"
                        placeholder="••••••••••••"
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        className="ad-gate-password-toggle"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="ad-gate-banner error" role="alert">
                      <AlertTriangle size={15} />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="ad-btn ad-btn-primary ad-gate-submit-btn"
                    disabled={signingIn}
                  >
                    {signingIn ? (
                      <>
                        <RefreshCw size={15} className="ad-spin" />
                        <span>Verifying credentials…</span>
                      </>
                    ) : (
                      <>
                        <span>Sign in with Plugg</span>
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </>
        )}

        {/* Security Footer */}
        <div className="ad-gate-footer">
          <div className="ad-gate-footer-security">
            <LockKeyhole size={12} />
            <span>Role-protected administration · Real records only</span>
          </div>
          <span className="ad-gate-footer-note">
            Africa/Kampala · Strict RBAC enforcement
          </span>
        </div>
      </div>
    </div>
  );
}
