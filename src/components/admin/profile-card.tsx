import React, { useState, type ReactNode } from "react";
import { LockKeyhole, LogOut, ShieldCheck, User } from "lucide-react";
import { safeMediaUrl } from "./model";

export interface ProfileCardData {
  name: string;
  username?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  phone?: string | null;
  status?: string;
  joinedAt?: string | null;
  artistName?: string | null;
  artistUsername?: string | null;
  verified?: boolean | null;
}

const roleNames: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  moderator: "Moderator",
  listener: "User",
  user: "User",
  artist: "Artist",
};

const roleDescriptions: Record<string, { title: string; description: string; permissions: string[] }> = {
  super_admin: {
    title: "Super Administrator",
    description: "Unrestricted operational authority across all Plugg systems and staff accounts.",
    permissions: [
      "Approve, reject, or request changes on all release submissions",
      "Place and release catalog rights holds and takedowns",
      "Provision and edit staff accounts and RBAC role assignments",
      "Inspect complete durable administrative audit history",
      "Manage music catalog, artist verification, and taxonomy",
    ],
  },
  admin: {
    title: "Administrator",
    description: "Operational authority over releases, catalog, and verification workflows.",
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
    description: "First-line review authority for artist submissions and technical inspection.",
    permissions: [
      "Inspect submitted audio technical specifications and artwork",
      "Request corrections from artists with structured feedback",
      "Initiate copyright inquiry reviews",
      "All actions require confirmation and are permanently audited",
    ],
  },
};

export function ProfileCard({
  profile,
  compact = false,
  actions,
  onSignOut,
}: {
  profile: ProfileCardData;
  compact?: boolean;
  actions?: ReactNode;
  onSignOut?: () => void;
}) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const avatar = safeMediaUrl(profile.avatarUrl);
  const joined = profile.joinedAt ? new Date(profile.joinedAt) : null;
  const roleKey = profile.role || "user";
  const roleInfo = roleDescriptions[roleKey] || {
    title: roleNames[roleKey] || "User",
    description: "Standard platform account permissions.",
    permissions: ["Standard account access"],
  };

  return (
    <article
      className={`ad-profile-card ${compact ? "compact" : "full"}`}
      aria-label={`${profile.name} profile`}
    >
      <div className="ad-profile-card-heading">
        <div className="ad-profile-avatar">
          {avatar && avatar !== failedAvatar ? (
            <img src={avatar} alt="" onError={() => setFailedAvatar(avatar)} />
          ) : (
            <span>
              {profile.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </span>
          )}
        </div>
        <div className="ad-profile-identity">
          <h3>{profile.name}</h3>
          {profile.username && <p className="ad-profile-username">@{profile.username}</p>}
          <span className="ad-role-badge">{roleNames[roleKey] || "Staff"}</span>
        </div>
      </div>

      {!compact && (
        <>
          <dl className="ad-profile-facts">
            {profile.email && (
              <>
                <dt>Email</dt>
                <dd>{profile.email}</dd>
              </>
            )}
            {profile.phone && (
              <>
                <dt>Phone</dt>
                <dd>{profile.phone}</dd>
              </>
            )}
            <dt>Session Status</dt>
            <dd>
              <span className="ad-pill green">Active · Authorized</span>
            </dd>
            {joined && Number.isFinite(joined.getTime()) && (
              <>
                <dt>Member Since</dt>
                <dd>
                  {new Intl.DateTimeFormat("en-GB", {
                    dateStyle: "medium",
                    timeZone: "Africa/Kampala",
                  }).format(joined)}{" "}
                  EAT
                </dd>
              </>
            )}
            {profile.artistName && (
              <>
                <dt>Artist Profile</dt>
                <dd>
                  {profile.artistUsername ? (
                    <a href={"/artist/" + encodeURIComponent(profile.artistUsername)} target="_blank" rel="noreferrer">
                      {profile.artistName}
                    </a>
                  ) : (
                    profile.artistName
                  )}
                </dd>
              </>
            )}
            {typeof profile.verified === "boolean" && (
              <>
                <dt>Verification</dt>
                <dd>
                  <span className={`ad-pill ${profile.verified ? "green" : ""}`}>
                    {profile.verified ? "Platform verified" : "Not verified"}
                  </span>
                </dd>
              </>
            )}
          </dl>

          {/* Emphasized RBAC permissions card */}
          <div className="ad-profile-rbac-section">
            <div className="ad-profile-rbac-header">
              <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
              <div>
                <h4>Role-Based Access Control (RBAC)</h4>
                <p>{roleInfo.title} · {roleInfo.description}</p>
              </div>
            </div>
            <ul className="ad-profile-rbac-list">
              {roleInfo.permissions.map((perm, idx) => (
                <li key={idx}>
                  <span className="ad-rbac-bullet" />
                  <span>{perm}</span>
                </li>
              ))}
            </ul>
            <div className="ad-profile-rbac-note">
              <LockKeyhole size={13} className="shrink-0" />
              <span>
                Authorized actions require explicit confirmation and are permanently recorded in the administrative audit log.
              </span>
            </div>
          </div>
        </>
      )}

      {actions ? (
        <div className="ad-profile-quick-actions">{actions}</div>
      ) : onSignOut ? (
        <div className="ad-profile-quick-actions">
          <button
            type="button"
            className="ad-btn ad-btn-danger"
            onClick={onSignOut}
          >
            <LogOut size={14} />
            <span>Sign out of Plugg</span>
          </button>
        </div>
      ) : null}
    </article>
  );
}
