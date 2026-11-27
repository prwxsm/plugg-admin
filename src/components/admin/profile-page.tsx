import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  LockKeyhole,
  LogOut,
  CheckCircle2,
  User,
  ExternalLink,
  Calendar,
  Mail,
  Phone,
  Shield,
  FileCheck,
  Database,
  ArrowRight,
} from "lucide-react";
import { safeMediaUrl } from "./model";

export interface CurrentUserData {
  id: string;
  name: string;
  username?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  phone?: string | null;
  createdAt?: string | null;
  status?: string;
  artistName?: string | null;
  artistUsername?: string | null;
  verified?: boolean | null;
}

const roleNames: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  moderator: "Review Moderator",
  listener: "User",
  user: "User",
  artist: "Artist",
};

const roleDescriptions: Record<
  string,
  { title: string; subtitle: string; description: string; permissions: string[] }
> = {
  super_admin: {
    title: "Super Administrator",
    subtitle: "Highest administrative authority",
    description: "Unrestricted operational authority across all Plugg systems, releases, and staff accounts.",
    permissions: [
      "Approve, reject, or request changes on all release submissions",
      "Place and release catalog rights holds and takedowns",
      "Provision and edit staff accounts and RBAC role assignments",
      "Inspect complete durable administrative audit history",
      "Manage music catalog, artist verification, and taxonomy",
      "Manage system-wide streaming telemetry and analytics",
    ],
  },
  admin: {
    title: "Administrator",
    subtitle: "Catalog & operations authority",
    description: "Operational authority over releases, catalog, artist verifications, and compliance workflows.",
    permissions: [
      "Approve, reject, or request changes on release submissions",
      "Manage copyright complaints and rights holds",
      "Review artist verification applications",
      "Inspect administrative audit history",
      "Schedule releases and manage music catalog",
    ],
  },
  moderator: {
    title: "Review Moderator",
    subtitle: "Review & inspection authority",
    description: "First-line review authority for artist submissions and technical specifications.",
    permissions: [
      "Inspect submitted audio technical specifications and artwork",
      "Request corrections from artists with structured feedback",
      "Initiate copyright inquiry reviews",
      "All actions require confirmation and are permanently audited",
    ],
  },
};

export function AdminProfilePage({
  currentUser,
  onSignOut,
}: {
  currentUser: CurrentUserData;
  onSignOut: () => void;
}) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const avatar = safeMediaUrl(currentUser.avatarUrl);
  const joined = currentUser.createdAt ? new Date(currentUser.createdAt) : null;
  const roleKey = currentUser.role || "user";
  const roleInfo = roleDescriptions[roleKey] || {
    title: roleNames[roleKey] || "Staff",
    subtitle: "Standard staff access",
    description: "Standard platform account permissions.",
    permissions: ["Standard account access"],
  };

  const initials = currentUser.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="ad-profile-page-container">
      {/* Hero Banner Card */}
      <section className="ad-profile-hero-card">
        <div className="ad-profile-hero-main">
          <div className="ad-profile-hero-avatar">
            {avatar && avatar !== failedAvatar ? (
              <img
                src={avatar}
                alt={currentUser.name}
                onError={() => setFailedAvatar(avatar)}
              />
            ) : (
              <span>{initials || "AD"}</span>
            )}
          </div>
          <div className="ad-profile-hero-meta">
            <div className="ad-profile-hero-name-row">
              <h2>{currentUser.name}</h2>
              <span className="ad-role-badge primary">{roleNames[roleKey] || "Staff"}</span>
              <span className="ad-pill green">Active · Authorized</span>
            </div>
            {currentUser.username && (
              <p className="ad-profile-hero-handle">@{currentUser.username}</p>
            )}
            <p className="ad-profile-hero-caption">
              Authenticated Plugg staff account with role-based operational permissions.
            </p>
          </div>
        </div>

        <div className="ad-profile-hero-actions">
          <button
            type="button"
            className="ad-btn ad-btn-danger"
            onClick={onSignOut}
            title="Sign out of administrative session"
          >
            <LogOut size={15} />
            <span>Sign out</span>
          </button>
        </div>
      </section>

      {/* Main Grid: Identity + RBAC */}
      <div className="ad-profile-page-grid">
        {/* Left Column: Account Identity & Metadata */}
        <div className="ad-profile-col">
          <section className="ad-profile-section-card">
            <div className="ad-profile-card-header">
              <User size={17} className="text-slate-600" />
              <h3>Identity & Account</h3>
            </div>

            <dl className="ad-profile-facts-list">
              <div className="ad-fact-row">
                <dt>Full Name</dt>
                <dd><strong>{currentUser.name}</strong></dd>
              </div>

              {currentUser.username && (
                <div className="ad-fact-row">
                  <dt>Username</dt>
                  <dd>@{currentUser.username}</dd>
                </div>
              )}

              {currentUser.email && (
                <div className="ad-fact-row">
                  <dt>Email Address</dt>
                  <dd>{currentUser.email}</dd>
                </div>
              )}

              {currentUser.phone && (
                <div className="ad-fact-row">
                  <dt>Phone</dt>
                  <dd>{currentUser.phone}</dd>
                </div>
              )}

              <div className="ad-fact-row">
                <dt>Account Role</dt>
                <dd>
                  <span className="ad-role-badge">{roleNames[roleKey] || "Staff"}</span>
                </dd>
              </div>

              <div className="ad-fact-row">
                <dt>Session State</dt>
                <dd>
                  <span className="ad-pill green">Active · Session Validated</span>
                </dd>
              </div>

              {joined && Number.isFinite(joined.getTime()) && (
                <div className="ad-fact-row">
                  <dt>Member Since</dt>
                  <dd>
                    {new Intl.DateTimeFormat("en-GB", {
                      dateStyle: "medium",
                      timeZone: "Africa/Kampala",
                    }).format(joined)}{" "}
                    EAT
                  </dd>
                </div>
              )}

              {currentUser.artistName && (
                <div className="ad-fact-row">
                  <dt>Artist Profile</dt>
                  <dd>
                    {currentUser.artistUsername ? (
                      <a
                        href={"/artist/" + encodeURIComponent(currentUser.artistUsername)}
                        target="_blank"
                        rel="noreferrer"
                        className="ad-artist-link"
                      >
                        {currentUser.artistName}
                        <ExternalLink size={12} />
                      </a>
                    ) : (
                      currentUser.artistName
                    )}
                  </dd>
                </div>
              )}

              {typeof currentUser.verified === "boolean" && (
                <div className="ad-fact-row">
                  <dt>Artist Verification</dt>
                  <dd>
                    <span className={`ad-pill ${currentUser.verified ? "green" : ""}`}>
                      {currentUser.verified ? "Platform verified" : "Unverified"}
                    </span>
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Database Connection & Audit Policy Card */}
          <section className="ad-profile-section-card">
            <div className="ad-profile-card-header">
              <Database size={17} className="text-slate-600" />
              <h3>Environment & Audit Policy</h3>
            </div>

            <div className="ad-profile-env-body">
              <div className="ad-env-pill-line">
                <span className="ad-dot" />
                <span>Existing PostgreSQL · Africa/Kampala (UTC+03:00)</span>
              </div>
              <p className="ad-env-text">
                Every administrative action, release review decision, and permission change is durably committed to the permanent administrative audit log.
              </p>
              <Link to="/admin/audit" className="ad-btn ad-btn-secondary ad-audit-nav-btn">
                <FileCheck size={14} />
                <span>View Administrative Audit Log</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </section>
        </div>

        {/* Right Column: Emphasized RBAC Privileges */}
        <div className="ad-profile-col">
          <section className="ad-profile-section-card rbac-emphasis">
            <div className="ad-profile-card-header">
              <ShieldCheck size={20} className="text-emerald-600" />
              <div>
                <h3>Role-Based Access Control (RBAC)</h3>
                <p className="ad-header-sub">{roleInfo.title} · {roleInfo.subtitle}</p>
              </div>
            </div>

            <div className="ad-rbac-desc-box">
              <p>{roleInfo.description}</p>
            </div>

            <div className="ad-rbac-checklist-wrap">
              <h4>Authorized Operations</h4>
              <ul className="ad-rbac-checklist">
                {roleInfo.permissions.map((perm, idx) => (
                  <li key={idx}>
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>{perm}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="ad-rbac-footer-note">
              <LockKeyhole size={15} className="shrink-0 text-slate-700" />
              <p>
                Authorized actions require explicit confirmation and are permanently recorded with your staff identity in the Plugg audit ledger.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
