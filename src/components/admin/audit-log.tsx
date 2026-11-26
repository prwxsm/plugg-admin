import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  AudioLines,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Copy,
  FileCheck,
  FileEdit,
  History,
  Lock,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Tags,
  Unlock,
  UserCheck,
  Users,
} from "lucide-react";
import type { AdminSnapshot } from "./model";
import { kampala } from "./model";
import { AdminDropdown, type AdminDropdownOption } from "./dropdown";

export function AdminAuditLogView({ data }: { data: AdminSnapshot }) {
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const rawAudit = data.audit || [];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Metrics computation
  const metrics = useMemo(() => {
    let approvals = 0;
    let corrections = 0;
    let rightsActions = 0;
    let staffActions = 0;
    let verifications = 0;

    for (const item of rawAudit) {
      if (item.action === "release.approve") approvals++;
      else if (item.action === "release.request_changes") corrections++;
      else if (
        item.action.includes("rights_hold") ||
        item.action.includes("takedown") ||
        item.action.includes("reinstate")
      ) {
        rightsActions++;
      } else if (item.action.startsWith("staff.") || item.action === "staff_role") {
        staffActions++;
      } else if (item.action.includes("verification")) {
        verifications++;
      }
    }

    return {
      total: rawAudit.length,
      approvals,
      corrections,
      rightsActions,
      staffActions,
      verifications,
    };
  }, [rawAudit]);

  // Action classification helper
  const getActionMeta = (action: string) => {
    switch (action) {
      case "release.approve":
        return {
          label: "Approved Release",
          tone: "green" as const,
          icon: CheckCircle2,
          category: "release",
        };
      case "release.request_changes":
        return {
          label: "Requested Corrections",
          tone: "amber" as const,
          icon: FileEdit,
          category: "release",
        };
      case "release.reschedule":
        return {
          label: "Rescheduled Release",
          tone: "default" as const,
          icon: Clock3,
          category: "release",
        };
      case "release.place_rights_hold":
        return {
          label: "Placed Rights Hold",
          tone: "red" as const,
          icon: ShieldAlert,
          category: "rights",
        };
      case "release.release_rights_hold":
        return {
          label: "Released Rights Hold",
          tone: "green" as const,
          icon: ShieldCheck,
          category: "rights_release",
        };
      case "release.takedown":
        return {
          label: "Takedown Release",
          tone: "red" as const,
          icon: Lock,
          category: "rights",
        };
      case "release.reinstate":
        return {
          label: "Reinstated Release",
          tone: "green" as const,
          icon: Unlock,
          category: "rights_release",
        };
      case "artist.verify_artist":
        return {
          label: "Updated Verification",
          tone: "blue" as const,
          icon: BadgeCheck,
          category: "verification",
        };
      case "artist.review_verification":
        return {
          label: "Reviewed Verification Application",
          tone: "blue" as const,
          icon: UserCheck,
          category: "verification",
        };
      case "artist.edit_artist":
        return {
          label: "Edited Artist Metadata",
          tone: "default" as const,
          icon: FileCheck,
          category: "artist",
        };
      case "staff.staff_role":
        return {
          label: "Changed Staff Role",
          tone: "blue" as const,
          icon: Shield,
          category: "staff",
        };
      case "staff.create_staff":
        return {
          label: "Created Staff Account",
          tone: "blue" as const,
          icon: Users,
          category: "staff",
        };
      case "staff.edit_staff":
        return {
          label: "Edited Staff Account",
          tone: "default" as const,
          icon: Users,
          category: "staff",
        };
      case "complaint.record_complaint":
        return {
          label: "Recorded Copyright Dispute",
          tone: "amber" as const,
          icon: AlertTriangle,
          category: "complaint",
        };
      case "complaint.update_complaint":
        return {
          label: "Resolved / Updated Dispute",
          tone: "blue" as const,
          icon: FileCheck,
          category: "complaint",
        };
      case "processing.retry":
        return {
          label: "Retried Audio Transcoding",
          tone: "default" as const,
          icon: RefreshCw,
          category: "processing",
        };
      case "processing.result":
        return {
          label: "Audio Transcoding Result",
          tone: "default" as const,
          icon: AudioLines,
          category: "processing",
        };
      case "genre.create_genre":
      case "genre.edit_genre":
      case "genre.delete_genre":
        return {
          label: action.replace("genre.", "").replace("_", " ").toUpperCase(),
          tone: "default" as const,
          icon: Tags,
          category: "genre",
        };
      default:
        return {
          label: action.replace(".", " · "),
          tone: "default" as const,
          icon: History,
          category: "other",
        };
    }
  };

  const actionFilterOptions: AdminDropdownOption[] = [
    { value: "all", label: `All Actions (${rawAudit.length})`, icon: History },
    { value: "release.approve", label: "Release Approvals", icon: CheckCircle2, tone: "green" },
    { value: "release.request_changes", label: "Correction Requests", icon: FileEdit, tone: "amber" },
    { value: "rights", label: "Rights Holds & Takedowns", icon: ShieldAlert, tone: "red" },
    { value: "rights_release", label: "Rights Releases & Reinstates", icon: ShieldCheck, tone: "green" },
    { value: "verification", label: "Artist Verifications", icon: BadgeCheck, tone: "blue" },
    { value: "staff", label: "Staff & Role Assignments", icon: Users, tone: "blue" },
    { value: "complaint", label: "Copyright Disputes", icon: AlertTriangle, tone: "amber" },
    { value: "processing", label: "Audio Processing", icon: AudioLines, tone: "default" },
    { value: "genre", label: "Genre Taxonomy", icon: Tags, tone: "default" },
  ];

  // Filtered and sorted audit logs
  const filteredAudit = useMemo(() => {
    let list = rawAudit;

    // Action filter
    if (actionFilter !== "all") {
      if (actionFilter === "rights") {
        list = list.filter(
          (item) =>
            item.action === "release.place_rights_hold" || item.action === "release.takedown"
        );
      } else if (actionFilter === "rights_release") {
        list = list.filter(
          (item) =>
            item.action === "release.release_rights_hold" || item.action === "release.reinstate"
        );
      } else if (actionFilter === "verification") {
        list = list.filter((item) => item.action.includes("verification"));
      } else if (actionFilter === "staff") {
        list = list.filter((item) => item.action.startsWith("staff."));
      } else if (actionFilter === "complaint") {
        list = list.filter((item) => item.action.startsWith("complaint."));
      } else if (actionFilter === "processing") {
        list = list.filter((item) => item.action.startsWith("processing."));
      } else if (actionFilter === "genre") {
        list = list.filter((item) => item.action.startsWith("genre."));
      } else {
        list = list.filter((item) => item.action === actionFilter);
      }
    }

    // Search query
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (item) =>
          item.actorName.toLowerCase().includes(q) ||
          item.actorRole.toLowerCase().includes(q) ||
          item.action.toLowerCase().includes(q) ||
          item.targetId.toLowerCase().includes(q) ||
          (item.reason && item.reason.toLowerCase().includes(q))
      );
    }

    // Sort order
    return [...list].sort((a, b) => {
      const timeA = Date.parse(a.occurredAt) || 0;
      const timeB = Date.parse(b.occurredAt) || 0;
      return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });
  }, [rawAudit, actionFilter, query, sortOrder]);

  return (
    <div className="ad-audit-page">
      {/* Metrics Row */}
      <div className="ad-metrics ad-metrics-5">
        <article className="ad-metric-card">
          <span>Total audit entries</span>
          <strong>{metrics.total}</strong>
          <small>Durable event log</small>
        </article>
        <article className="ad-metric-card">
          <span>Release approvals</span>
          <strong className="text-emerald-500">{metrics.approvals}</strong>
          <small>Reviewed & approved</small>
        </article>
        <article className="ad-metric-card">
          <span>Changes requested</span>
          <strong className="text-amber-500">{metrics.corrections}</strong>
          <small>Sent back to artists</small>
        </article>
        <article className="ad-metric-card">
          <span>Rights & holds</span>
          <strong className="text-rose-500">{metrics.rightsActions}</strong>
          <small>Holds, takedowns, reinstates</small>
        </article>
        <article className="ad-metric-card">
          <span>Staff & roles</span>
          <strong className="text-blue-500">{metrics.staffActions}</strong>
          <small>RBAC privilege updates</small>
        </article>
      </div>

      {/* Toolbar */}
      <div className="ad-toolbar ad-audit-toolbar">
        <label className="ad-search flex-1">
          <Search size={16} />
          <input
            type="search"
            aria-label="Search audit log"
            placeholder="Search by actor name, action, target ID or recorded reason…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <div className="ad-audit-filters flex items-center gap-2">
          <AdminDropdown
            value={actionFilter}
            options={actionFilterOptions}
            onChange={setActionFilter}
            label="Filter action:"
            className="shrink-0"
          />

          <AdminDropdown
            value={sortOrder}
            options={[
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
            ]}
            onChange={(val) => setSortOrder(val as "newest" | "oldest")}
            label="Order:"
            className="shrink-0"
          />
        </div>
      </div>

      {/* Audit Log Entries List */}
      <div className="ad-audit-list">
        {filteredAudit.length === 0 ? (
          <div className="ad-empty-state">
            <History size={32} className="ad-empty-icon" />
            <h3>No audit records match your filters</h3>
            <p>
              {rawAudit.length === 0
                ? "No administrative decisions have been recorded yet. Decisions made by staff will be durably recorded here."
                : "Try clearing your search query or choosing 'All Actions'."}
            </p>
          </div>
        ) : (
          filteredAudit.map((entry) => {
            const meta = getActionMeta(entry.action);
            const ActionIcon = meta.icon;
            const isCopied = copiedId === entry.targetId;

            return (
              <article key={entry.id} className="ad-audit-card">
                <div className="ad-audit-card-header">
                  <div className="ad-audit-actor">
                    <span className="ad-audit-avatar">
                      {entry.actorName
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                    <div className="ad-audit-actor-info">
                      <div className="ad-audit-actor-name-row">
                        <strong>{entry.actorName}</strong>
                        <span className="ad-role-badge">
                          {entry.actorRole === "super_admin"
                            ? "Super Admin"
                            : entry.actorRole === "admin"
                              ? "Admin"
                              : entry.actorRole === "moderator"
                                ? "Moderator"
                                : entry.actorRole}
                        </span>
                      </div>
                      <time className="ad-audit-time" dateTime={entry.occurredAt}>
                        <Clock3 size={11} className="inline mr-1" />
                        {kampala(entry.occurredAt)} EAT
                      </time>
                    </div>
                  </div>

                  <div className="ad-audit-status-badge">
                    <span className={`ad-pill ${meta.tone === "green" ? "green" : meta.tone === "amber" ? "amber" : meta.tone === "red" ? "red" : ""}`}>
                      <ActionIcon size={12} className="inline mr-1 shrink-0" />
                      {meta.label}
                    </span>
                  </div>
                </div>

                <div className="ad-audit-body">
                  <div className="ad-audit-meta-row">
                    <span className="ad-audit-meta-label">Target ID:</span>
                    <button
                      type="button"
                      className="ad-audit-target-chip"
                      onClick={() => copyToClipboard(entry.targetId)}
                      title="Click to copy target ID"
                    >
                      <code>{entry.targetId}</code>
                      <Copy size={11} className="ad-copy-icon" />
                      {isCopied && <span className="ad-copied-toast">Copied!</span>}
                    </button>
                    <span className="ad-audit-meta-label ml-auto">Result:</span>
                    <span className={`ad-audit-result-pill ${entry.result === "success" ? "success" : "failed"}`}>
                      {entry.result || "recorded"}
                    </span>
                  </div>

                  {entry.reason ? (
                    <div className="ad-audit-reason-box">
                      <span className="ad-audit-reason-title">Recorded reason / feedback:</span>
                      <p className="ad-audit-reason-text">{entry.reason}</p>
                    </div>
                  ) : (
                    <div className="ad-audit-no-reason">
                      <span>No specific explanation recorded</span>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
