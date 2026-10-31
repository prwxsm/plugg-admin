import { ProfileCard } from "./profile-card";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  AudioLines,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Disc3,
  ShieldAlert,
} from "lucide-react";
import { count, kampala, pendingHours, type AdminSnapshot, type AdminTrack } from "./model";
import { Artwork, DisabledAction, Empty, Pill, SLA, Unavailable } from "./primitives";
export function AdminOverview({ data, now }: { data: AdminSnapshot; now: number }) {
  const m = data.metrics;
  const priority = data.releases
    .filter((r) => r.status === "under_review")
    .sort((a, b) => (pendingHours(b, now) ?? -1) - (pendingHours(a, now) ?? -1))
    .slice(0, 5);
  const onTrack = Math.max(0, m.pending - m.approaching - m.breached - m.missingSubmissionTime);
  return (
    <>
      <div className="ad-metrics">
        {[
          {
            label: "Pending review queue",
            number: m.pending,
            Icon: ShieldAlert,
            foot: `${m.approaching} approaching 24h SLA, ${m.breached} breached`,
            tone: "amber",
            extra: "Recorded submissions",
          },
          {
            label: "Next midnight releases",
            number: m.nextMidnightScheduled,
            Icon: Disc3,
            foot: `${m.scheduled} total scheduled releases`,
            tone: "purple",
            extra: "00:00 Africa/Kampala",
          },
          {
            label: "Verified artists",
            number: `${m.verifiedArtists} / ${m.artists}`,
            Icon: BadgeCheck,
            foot: "Database verification flags",
            tone: "blue",
            extra: "KYC requests not tracked",
          },
          {
            label: "Today’s qualified streams",
            number: m.qualifiedToday.toLocaleString(),
            Icon: Activity,
            foot: "Recorded events ≥ 30s · Kampala day",
            tone: "green",
            extra: "Bot-filter pass rate unavailable",
          },
        ].map((x) => (
          <section className={`ad-metric ${x.tone}`} key={x.label}>
            <div>
              <span>{x.label}</span>
              <x.Icon size={18} />
            </div>
            <strong>{x.number}</strong>
            <p>{x.foot}</p>
            <small>{x.extra}</small>
          </section>
        ))}
      </div>
      <div className="ad-overview-grid">
        <section className="ad-panel">
          <div className="ad-panel-head">
            <div>
              <h2>Review SLA radar</h2>
              <p>Based on actual submission timestamps.</p>
            </div>
            <Pill tone={m.approaching + m.breached ? "amber" : "green"}>
              <Clock3 size={12} />
              {m.approaching + m.breached} need attention
            </Pill>
          </div>
          <div className="ad-sla-summary">
            <strong>
              {m.pending}
              <small>pending submissions</small>
            </strong>
            <span>
              <b>
                {m.pending - m.missingSubmissionTime
                  ? `${Math.round(((m.pending - m.missingSubmissionTime - m.breached) / (m.pending - m.missingSubmissionTime)) * 100)}%`
                  : "—"}
              </b>{" "}
              within SLA
            </span>
          </div>
          <div className="ad-sla-bar">
            {[
              { n: onTrack, c: "green" },
              { n: m.approaching, c: "amber" },
              { n: m.breached, c: "red" },
              { n: m.missingSubmissionTime, c: "unknown" },
            ]
              .filter((x) => x.n > 0)
              .map((x) => (
                <span key={x.c} className={x.c} style={{ flex: x.n }} />
              ))}
          </div>
          <div className="ad-sla-legend">
            <span>
              <i className="green" />
              On track <b>{onTrack}</b>
              <small>Under 18 hours</small>
            </span>
            <span>
              <i className="amber" />
              Approaching <b>{m.approaching}</b>
              <small>18–24 hours</small>
            </span>
            <span>
              <i className="red" />
              Breached <b>{m.breached}</b>
              <small>Over 24 hours</small>
            </span>
          </div>
          {m.missingSubmissionTime > 0 && (
            <p className="ad-inline-note">
              {m.missingSubmissionTime} submissions have no timestamp; excluded from the SLA
              percentage.
            </p>
          )}
          <Link className="ad-panel-link" to="/admin/review-queue">
            Open review queue <ArrowRight size={15} />
          </Link>
        </section>
        <section className="ad-panel">
          <div className="ad-panel-head">
            <div>
              <h2>Audio pipeline</h2>
              <p>Current track states, directly from PostgreSQL.</p>
            </div>
            <span className="ad-icon-box green">
              <AudioLines size={20} />
            </span>
          </div>
          <div className="ad-pipeline-healthy">
            <CheckCircle2 size={23} />
            <div>
              <h3>
                {m.failed
                  ? `${m.failed} tracks have failed processing`
                  : "No failed tracks recorded"}
              </h3>
              <p>Job throughput and completion times are not recorded.</p>
            </div>
          </div>
          {[
            ["Completed tracks", m.completed],
            ["Processing / pending", m.processing + m.pendingAudio],
            ["Failed tracks", m.failed],
          ].map(([title, n]) => (
            <div key={title} className="ad-pipeline-row">
              <span>{title}</span>
              <b>{n}</b>
            </div>
          ))}
          <Link to="/admin/processing" className="ad-panel-link">
            Inspect audio processing <ArrowRight size={15} />
          </Link>
        </section>
      </div>
      {m.scheduleMismatches > 0 && (
        <Unavailable>
          {m.scheduleMismatches} releases have stored go-live timestamps that differ from midnight
          Kampala on their release date. Values are displayed as stored; no correction has been
          applied.
        </Unavailable>
      )}
      <section className="ad-panel">
        <div className="ad-panel-head">
          <div>
            <h2>
              Pending submissions <span className="ad-count">{m.pending}</span>
            </h2>
            <p>Oldest pending records first; up to five shown.</p>
          </div>
          <Link to="/admin/review-queue" className="ad-text-link">
            View queue <ArrowRight size={14} />
          </Link>
        </div>
        <div className="ad-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Release / Artist</th>
                <th>Type</th>
                <th>Submitted · EAT</th>
                <th>SLA status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {priority.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="ad-identity">
                      <Artwork src={r.coverUrl} title="" />
                      <div>
                        <strong>{r.title}</strong>
                        <small>{r.artistName}</small>
                      </div>
                    </div>
                  </td>
                  <td>{r.type}</td>
                  <td>{kampala(r.reviewSubmittedAt)}</td>
                  <td>
                    <SLA release={r} now={now} />
                  </td>
                  <td>
                    <Link to="/admin/review-queue" className="ad-btn subtle">
                      Inspect <ArrowRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!priority.length && (
          <Empty title="No pending submissions">There are no non-seed releases under review.</Empty>
        )}
      </section>
      <div className="ad-overview-bottom">
        <div>
          <span className="ad-icon-box amber">
            <Disc3 size={19} />
          </span>
          <div>
            <h3>
              {m.tracks} tracks · {m.releases} releases · {m.artists} artists
            </h3>
            <p>Existing database records. No locally generated content.</p>
          </div>
        </div>
        <span>PLUGG / STAFF OPERATIONS</span>
      </div>
    </>
  );
}
export function AdminProcessing({
  data,
  inspect,
}: {
  data: AdminSnapshot;
  inspect: (t: AdminTrack) => void;
}) {
  const [filter, setFilter] = useState("all");
  const rows = data.tracks.filter((t) => filter === "all" || t.audioProcessingStatus === filter);
  return (
    <>
      <div className="ad-tabs">
        {["all", "completed", "processing", "pending", "failed"].map((x) => (
          <button key={x} onClick={() => setFilter(x)} className={filter === x ? "active" : ""}>
            {x === "all" ? "All tracks" : x}
          </button>
        ))}
      </div>
      <Unavailable>
        “Completed” is the stored processing flag. Missing variant metadata on older tracks is shown
        as missing, not assumed ready. No job history or daily completion counter exists.
      </Unavailable>
      <section className="ad-panel">
        <div className="ad-table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  "Track",
                  "Artist",
                  "Processing status",
                  "Streaming variants",
                  "Download variants",
                  "Details",
                  "Action",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.title}</strong>
                    <small className="ad-block">{t.pluggTrackId}</small>
                  </td>
                  <td>{t.artistName}</td>
                  <td>
                    <Pill
                      tone={
                        t.audioProcessingStatus === "failed"
                          ? "red"
                          : t.audioProcessingStatus === "completed"
                            ? "green"
                            : "amber"
                      }
                    >
                      {t.audioProcessingStatus || "Not recorded"}
                    </Pill>
                  </td>
                  <td>{t.audioVariants.filter((v) => v.type === "stream").length}</td>
                  <td>{t.audioVariants.filter((v) => v.type === "download").length}</td>
                  <td>
                    <button className="ad-btn subtle" onClick={() => inspect(t)}>
                      Inspect {t.title}
                    </button>
                  </td>
                  <td>
                    <DisabledAction>Retry</DisabledAction>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty />}
      </section>
      <section className="ad-panel ad-audit">
        <div className="ad-panel-head">
          <div>
            <h2>Administrative audit log</h2>
            <p>
              Latest 200 durable events. Successful changes and their audit records commit together.
            </p>
          </div>
        </div>
        {data.audit.map((a) => (
          <div className="ad-log" key={a.id}>
            <time>{kampala(a.occurredAt)}</time>
            <p>
              {a.actorName} ({a.actorRole}) · {a.action} · {a.targetId} · {a.result}
              {a.reason ? ` — ${a.reason}` : ""}
            </p>
          </div>
        ))}
        {!data.audit.length && <Empty title="No administrative events" />}
      </section>
      <section className="ad-panel ad-audit">
        <div className="ad-panel-head">
          <div>
            <h2>Stored file metadata</h2>
            <p>Grouped by upload category and recorded status; files are not modified.</p>
          </div>
        </div>
        <div className="ad-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Status</th>
                <th>Files</th>
                <th>Stored size</th>
              </tr>
            </thead>
            <tbody>
              {data.files.map((f) => (
                <tr key={`${f.category}-${f.status}`}>
                  <td>{f.category}</td>
                  <td>{f.status}</td>
                  <td>{f.count}</td>
                  <td>{(f.bytes / 1048576).toFixed(2)} MB</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.files.length && <Empty title="No file metadata recorded" />}
      </section>
    </>
  );
}
export function AdminTelemetry({ data }: { data: AdminSnapshot }) {
  return (
    <>
      <Unavailable>
        Bot-farm detection and purge are unavailable. The current play endpoint rejects
        short/repeated plays without recording those rejected attempts, and does not populate IP
        addresses. No filter pass rate or skipped-play rate can be calculated.
      </Unavailable>
      <section className="ad-panel">
        <div className="ad-panel-head">
          <div>
            <h2>
              Recorded play activity <Pill tone="green">Database snapshot</Pill>
            </h2>
            <p>
              Latest {data.plays.length} of {data.metrics.recordedPlays} events for non-seed tracks;
              at most {data.limits.recentPlays} shown.
            </p>
          </div>
          <DisabledAction>Purge bot plays</DisabledAction>
        </div>
        <div className="ad-table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  "Timestamp · EAT",
                  "Track",
                  "Plugg track ID",
                  "Duration",
                  "IP address",
                  "Session reference",
                  "Duration threshold",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.plays.map((p) => (
                <tr key={p.id}>
                  <td>{kampala(p.createdAt)}</td>
                  <td>
                    <strong>{p.title}</strong>
                  </td>
                  <td>{p.pluggTrackId || "Not recorded"}</td>
                  <td>{p.duration}s</td>
                  <td>{p.ipAddress || "Not recorded"}</td>
                  <td className="ad-mono">{p.sessionLabel || "Not recorded"}</td>
                  <td>
                    <Pill tone={p.duration >= 30 ? "green" : "amber"}>
                      {p.duration >= 30 ? "≥30 seconds" : "<30 seconds"}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.plays.length && (
          <Empty title="No play events recorded">
            The existing database contains no events for the selected non-seed catalog.
          </Empty>
        )}
      </section>
    </>
  );
}
export function AdminAnalytics({ data }: { data: AdminSnapshot }) {
  const m = data.metrics;
  const max = Math.max(1, ...data.dailyPlays.map((d) => d.plays));
  return (
    <>
      <div className="ad-metrics">
        {[
          ["Stored track plays", m.storedPlayCount],
          ["Recorded play events", m.recordedPlays],
          ["Stored downloads", m.downloads],
          ["Qualified events today", m.qualifiedToday],
        ].map(([title, value]) => (
          <section className="ad-metric" key={title}>
            <div>{title}</div>
            <strong>{Number(value).toLocaleString()}</strong>
            <p>
              {title === "Qualified events today"
                ? "Kampala calendar day · ≥30s"
                : "Database aggregate"}
            </p>
          </section>
        ))}
      </div>
      <Unavailable>
        Stored play counters and event rows may differ because of historical data and counting
        workflows. Downloads are aggregate counters, not event-level records. Monthly-listener
        values on artist accounts are stored snapshots, not independently verified unique listeners.
      </Unavailable>
      <section className="ad-panel">
        <div className="ad-panel-head">
          <div>
            <h2>Qualified play events · last 7 days</h2>
            <p>Daily counts from the plays table, grouped in Africa/Kampala.</p>
          </div>
        </div>
        <div
          className="ad-chart"
          role="img"
          aria-label={`Daily qualified plays: ${data.dailyPlays.map((d) => `${d.day}: ${d.plays}`).join(", ")}`}
        >
          {data.dailyPlays.map((d) => (
            <div key={d.day}>
              <strong>{d.plays}</strong>
              <span style={{ height: `${Math.max(2, (d.plays / max) * 125)}px` }} />
              <small>{d.day.slice(5)}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="ad-panel ad-audit">
        <div className="ad-panel-head">
          <div>
            <h2>Administrative audit log</h2>
            <p>
              Latest 200 durable events. Successful changes and their audit records commit together.
            </p>
          </div>
        </div>
        {data.audit.map((a) => (
          <div className="ad-log" key={a.id}>
            <time>{kampala(a.occurredAt)}</time>
            <p>
              {a.actorName} ({a.actorRole}) · {a.action} · {a.targetId} · {a.result}
              {a.reason ? ` — ${a.reason}` : ""}
            </p>
          </div>
        ))}
        {!data.audit.length && <Empty title="No administrative events" />}
      </section>
      <section className="ad-panel ad-audit">
        <div className="ad-panel-head">
          <div>
            <h2>Tracks by stored play count</h2>
            <p>Highest stored counters among loaded non-seed tracks.</p>
          </div>
        </div>
        <div className="ad-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Track</th>
                <th>Artist</th>
                <th>Stored plays</th>
                <th>Stored downloads</th>
              </tr>
            </thead>
            <tbody>
              {[...data.tracks]
                .sort((a, b) => b.playCount - a.playCount)
                .slice(0, 10)
                .map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.title}</strong>
                    </td>
                    <td>{t.artistName}</td>
                    <td>{t.playCount.toLocaleString()}</td>
                    <td>{t.downloadCount.toLocaleString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!data.tracks.length && <Empty />}
      </section>
    </>
  );
}
export function AdminStaff({ data }: { data: AdminSnapshot }) {
  const staff = data.users.filter((u) => u.adminRole !== null);
  const history = data.releases
    .flatMap((r) =>
      r.reviewHistory.map((h, i) => ({ ...h, key: `${r.id}-${i}`, release: r.title })),
    )
    .sort(
      (a, b) =>
        (b.timestamp ? Date.parse(b.timestamp) : 0) - (a.timestamp ? Date.parse(a.timestamp) : 0),
    );
  return (
    <>
      <Unavailable>
        Staff access uses explicit Super Admin, Admin and Moderator memberships. Sensitive changes
        require your current password and explicit confirmation.
      </Unavailable>
      <section className="ad-panel">
        <div className="ad-panel-head">
          <div>
            <h2>Database administrators</h2>
            <p>Existing administrative memberships, including revoked access.</p>
          </div>
          <Pill>{staff.length} loaded accounts</Pill>
        </div>
        <div className="ad-profile-grid" style={{ padding: 20 }}>
          {staff.map((s) => (
            <ProfileCard
              key={s.id}
              profile={{
                ...s,
                role: s.adminRole,
                joinedAt: s.createdAt,
                status: s.adminActive ? "Staff active" : "Revoked",
              }}
            />
          ))}
        </div>
        {!staff.length && <Empty />}
      </section>
      <section className="ad-panel ad-audit">
        <div className="ad-panel-head">
          <div>
            <h2>Administrative audit log</h2>
            <p>
              Latest 200 durable events. Successful changes and their audit records commit together.
            </p>
          </div>
        </div>
        {data.audit.map((a) => (
          <div className="ad-log" key={a.id}>
            <time>{kampala(a.occurredAt)}</time>
            <p>
              {a.actorName} ({a.actorRole}) · {a.action} · {a.targetId} · {a.result}
              {a.reason ? ` — ${a.reason}` : ""}
            </p>
          </div>
        ))}
        {!data.audit.length && <Empty title="No administrative events" />}
      </section>
      <section className="ad-panel ad-audit">
        <div className="ad-panel-head">
          <div>
            <h2>Recorded release review history</h2>
            <p>Read from releases.review_history. This is not a global immutable audit log.</p>
          </div>
        </div>
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
      </section>
    </>
  );
}
