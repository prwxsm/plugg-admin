import { pluggSiteUrl } from "@/lib/site";
import { useState, type ReactNode } from "react";
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
export function ProfileCard({
  profile,
  compact = false,
  actions,
}: {
  profile: ProfileCardData;
  compact?: boolean;
  actions?: ReactNode;
}) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const avatar = safeMediaUrl(profile.avatarUrl);
  const joined = profile.joinedAt ? new Date(profile.joinedAt) : null;
  return (
    <article
      className={`ad-profile-card ${compact ? "compact" : ""}`}
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
          {profile.username && <p>@{profile.username}</p>}
          <span className="ad-role-badge">{roleNames[profile.role || "user"] || "User"}</span>
        </div>
      </div>
      {!compact && (
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
          {profile.status && (
            <>
              <dt>Status</dt>
              <dd>
                <span className={profile.status === "Revoked" ? "ad-pill red" : "ad-pill"}>
                  {profile.status}
                </span>
              </dd>
            </>
          )}
          {joined && Number.isFinite(joined.getTime()) && (
            <>
              <dt>Joined</dt>
              <dd>
                {new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "medium",
                  timeZone: "Africa/Kampala",
                }).format(joined)}
              </dd>
            </>
          )}
          {profile.artistName && (
            <>
              <dt>Artist profile</dt>
              <dd>
                {profile.artistUsername ? (
                  <a href={pluggSiteUrl + "/artist/" + encodeURIComponent(profile.artistUsername)}>
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
      )}
      {actions && <div className="ad-profile-quick-actions">{actions}</div>}
    </article>
  );
}
