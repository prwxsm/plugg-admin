import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  AudioLines,
  Clock3,
  Disc3,
  LockKeyhole,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Check,
  ChevronDown,
} from "lucide-react";
import type { AdminRelease, AdminTrack } from "./model";
import { pendingHours, safeMediaUrl } from "./model";
import type { AuditStatus, ReleaseAuditResult, TrackAuditResult } from "./audit";
import { AdminDropdown, type AdminDropdownOption, type AdminDropdownProps } from "./dropdown";

export { AdminDropdown, type AdminDropdownOption, type AdminDropdownProps };

export function Pill({ children, tone = "" }: { children: ReactNode; tone?: string }) {
  return <span className={`ad-pill ${tone}`}>{children}</span>;
}

export function Empty({
  title = "No records found",
  children = "No existing records match these filters.",
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="ad-empty">
      <Disc3 size={28} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export function Unavailable({ children }: { children: ReactNode }) {
  return (
    <div className="ad-unavailable">
      <AlertTriangle size={17} />
      <p>{children}</p>
    </div>
  );
}

export function DisabledAction({
  children,
  reason = "This action is unavailable here. Use the authorized actions for this module.",
}: {
  children: ReactNode;
  reason?: string;
}) {
  return (
    <span title={reason}>
      <button className="ad-btn subtle" type="button" disabled>
        <LockKeyhole size={12} />
        {children}
      </button>
    </span>
  );
}

export function Artwork({
  src,
  title,
  className = "",
}: {
  src: string;
  title: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = safeMediaUrl(src);
  return url && !failed ? (
    <img
      src={url}
      alt={title}
      className={className}
      onError={() => setFailed(true)}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  ) : (
    <span
      className={`ad-art-placeholder ${className}`}
      aria-label={`${title}: artwork unavailable`}
    >
      <Disc3 size={23} />
    </span>
  );
}

export function SLA({ release, now }: { release: AdminRelease; now: number }) {
  const h = pendingHours(release, now);
  return (
    <Pill tone={h === null ? "" : h > 24 ? "red" : h >= 18 ? "amber" : "indigo"}>
      <Clock3 size={12} />
      {h === null
        ? "Submission time not recorded"
        : `${Math.floor(h)}h pending · ${h > 24 ? "SLA breached" : h >= 18 ? "Approaching SLA" : "< 24h SLA"}`}
    </Pill>
  );
}

export function Specs({ track }: { track: AdminTrack }) {
  const v = track.technicalValidation || {};
  const rawFormat = typeof v["format"] === "string" ? v["format"].toUpperCase() : null;
  const isMp3 = rawFormat === "MP3";
  const rate = typeof v["sampleRate"] === "number" ? v["sampleRate"] : null;
  const channels = typeof v["channels"] === "number" ? v["channels"] : null;
  const bitrate = typeof v["bitrateKbps"] === "number" ? v["bitrateKbps"] : null;
  const isVbr = v["isVbr"] === true;
  const isStereo = v["isStereo"] === true || (channels !== null && channels >= 2);
  const qualityWarning = typeof v["qualityWarning"] === "string" ? v["qualityWarning"] : null;

  if (!rawFormat && rate === null && bitrate === null && channels === null) {
    return (
      <div className="ad-tags flex flex-wrap gap-1.5 items-center">
        <Pill>Technical specifications not recorded</Pill>
      </div>
    );
  }

  // Master requirements: MP3, 192–320 kbps, 44.1+ kHz, Stereo
  const formatValid = isMp3;
  const bitrateValid = bitrate !== null && bitrate >= 192 && bitrate <= 320;
  const rateValid = rate !== null && rate >= 44100;
  const channelsValid = isStereo;

  const passed = formatValid && bitrateValid && rateValid && channelsValid;
  const isActionRequired =
    !formatValid ||
    (bitrate !== null && (bitrate < 192 || bitrate > 320)) ||
    (rate !== null && rate < 44100);
  const tone = passed ? "green" : isActionRequired ? "red" : "amber";

  const formatStr = rawFormat || "UNKNOWN";
  const bitrateStr = bitrate !== null ? `${bitrate} kbps${isVbr ? " VBR" : ""}` : "Bitrate unknown";
  const rateStr = rate !== null ? `${rate / 1000} kHz` : "Rate unknown";
  const channelsStr = channels !== null ? (channels >= 2 ? "Stereo" : "Mono") : "Channels unknown";

  const fullLabel = `${formatStr} · ${bitrateStr} · ${rateStr} · ${channelsStr}`;

  return (
    <div className="ad-tags flex flex-wrap gap-1.5 items-center">
      <Pill tone={tone}>
        {passed && <CheckCircle2 size={11} />}
        {isActionRequired && <AlertCircle size={11} />}
        {!passed && !isActionRequired && <AlertTriangle size={11} />}
        {fullLabel}
      </Pill>
      {qualityWarning && <Pill tone="amber">{qualityWarning}</Pill>}
      {channels === 1 && <Pill tone="amber">Mono recording</Pill>}
    </div>
  );
}

export function AuditStatusBadge({ status }: { status: AuditStatus }) {
  switch (status) {
    case "satisfied":
      return (
        <Pill tone="green">
          <CheckCircle2 size={11} /> Passed
        </Pill>
      );
    case "missing":
      return (
        <Pill tone="red">
          <XCircle size={11} /> Missing
        </Pill>
      );
    case "invalid":
      return (
        <Pill tone="red">
          <AlertCircle size={11} /> Action Required
        </Pill>
      );
    case "warning":
      return (
        <Pill tone="amber">
          <AlertTriangle size={11} /> Attention
        </Pill>
      );
    case "provided":
      return (
        <Pill tone="indigo">
          <Check size={11} /> Provided
        </Pill>
      );
    case "not_provided":
      return <Pill tone="">Optional</Pill>;
    case "not_applicable":
    default:
      return <Pill tone="">N/A</Pill>;
  }
}

export function ReleaseAuditScorecard({ audit }: { audit: ReleaseAuditResult }) {
  const isSatisfied = audit.overallStatus === "satisfied";
  const isWarning = audit.overallStatus === "warning";

  return (
    <div className="ad-audit-scorecard">
      <div className="ad-audit-header">
        <div className="flex items-center gap-2">
          {isSatisfied ? (
            <Pill tone="green">
              <CheckCircle2 size={12} /> ALL MANDATORY REQUIREMENTS SATISFIED
            </Pill>
          ) : isWarning ? (
            <Pill tone="amber">
              <AlertTriangle size={12} /> READY WITH RECOMMENDATIONS
            </Pill>
          ) : (
            <Pill tone="red">
              <AlertCircle size={12} /> ACTION REQUIRED — MANDATORY CRITERIA MISSING
            </Pill>
          )}
        </div>
        <div className="ad-audit-metrics">
          <span>
            Mandatory: <strong>{audit.mandatoryPassed} / {audit.mandatoryTotal}</strong> Met
          </span>
          <span>·</span>
          <span>
            Optional: <strong>{audit.optionalProvided} / {audit.optionalTotal}</strong> Provided
          </span>
          <span>·</span>
          <span>
            Track Count: <strong>{audit.trackCount}</strong> ({audit.trackCountRuleText}) ·{" "}
            <span style={{ color: audit.trackCountValid ? "var(--ad-green)" : "#a92334" }}>
              {audit.trackCountValid ? "Passed" : "Invalid Count"}
            </span>
          </span>
        </div>
      </div>

      {audit.blockingReasons.length > 0 && (
        <div className="ad-audit-banner-error">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <div>
            <strong>Missing or Invalid Mandatory Criteria:</strong>
            <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
              {audit.blockingReasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {audit.warnings.length > 0 && (
        <div className="ad-audit-banner-warning">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            <strong>Reviewer Advisory Notes:</strong>
            <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
              {audit.warnings.map((warn, idx) => (
                <li key={idx}>{warn}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <details className="ad-audit-details">
        <summary className="ad-audit-summary">
          <ChevronDown size={14} />
          Inspect Full Release Requirements Audit (Classification, Audio, Artwork, Rights, Optional Metadata)
        </summary>
        <div className="ad-audit-body">
          {/* Project Classification */}
          <div className="ad-audit-section">
            <h4>Project Classification</h4>
            <div className="ad-audit-list">
              {audit.projectClassification.map((item) => (
                <div className="ad-audit-item" key={item.id}>
                  <AuditStatusBadge status={item.status} />
                  <div className="ad-audit-item-info">
                    <div className="ad-audit-item-label">{item.label}</div>
                    <div className="ad-audit-item-desc">{item.summary}</div>
                    {item.detail && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {item.detail}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Audio Standards */}
          <div className="ad-audit-section">
            <h4>Audio Master Standards</h4>
            <div className="ad-audit-list">
              {audit.audioAudit.map((item) => (
                <div className="ad-audit-item" key={item.id}>
                  <AuditStatusBadge status={item.status} />
                  <div className="ad-audit-item-info">
                    <div className="ad-audit-item-label">{item.label}</div>
                    <div className="ad-audit-item-desc">{item.summary}</div>
                    {item.detail && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {item.detail}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Artwork */}
          <div className="ad-audit-section">
            <h4>Artwork Requirements</h4>
            <div className="ad-audit-list">
              {audit.artworkAudit.map((item) => (
                <div className="ad-audit-item" key={item.id}>
                  <AuditStatusBadge status={item.status} />
                  <div className="ad-audit-item-info">
                    <div className="ad-audit-item-label">{item.label}</div>
                    <div className="ad-audit-item-desc">{item.summary}</div>
                    {item.detail && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {item.detail}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rights & Declarations */}
          <div className="ad-audit-section">
            <h4>Rights & Ownership</h4>
            <div className="ad-audit-list">
              {audit.rightsAudit.map((item) => (
                <div className="ad-audit-item" key={item.id}>
                  <AuditStatusBadge status={item.status} />
                  <div className="ad-audit-item-info">
                    <div className="ad-audit-item-label">{item.label}</div>
                    <div className="ad-audit-item-desc">{item.summary}</div>
                    {item.detail && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {item.detail}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Optional Metadata */}
          <div className="ad-audit-section" style={{ gridColumn: "1 / -1" }}>
            <h4>Optional Metadata & Distribution Credits</h4>
            <div
              className="ad-audit-list"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 10,
              }}
            >
              {audit.optionalMetadataAudit.map((item) => (
                <div className="ad-audit-item" key={item.id}>
                  <AuditStatusBadge status={item.status} />
                  <div className="ad-audit-item-info">
                    <div className="ad-audit-item-label">{item.label}</div>
                    <div className="ad-audit-item-desc">{item.summary}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

export function TrackAuditInspector({
  trackAudit,
  track,
}: {
  trackAudit: TrackAuditResult;
  track: AdminTrack;
}) {
  const [showLyrics, setShowLyrics] = useState(false);

  return (
    <div className="ad-track-audit-box">
      <details>
        <summary className="ad-track-audit-summary">
          <ChevronDown size={13} />
          <span>
            Inspect Track {String(trackAudit.position).padStart(2, "0")} Requirements & Credits (
            {trackAudit.mandatoryPassed}/{trackAudit.mandatoryTotal} mandatory satisfied ·{" "}
            {trackAudit.optionalProvided}/{trackAudit.optionalTotal} optional provided)
          </span>
        </summary>
        <div className="ad-track-audit-content">
          <div>
            <h5 className="text-[10px] uppercase font-semibold text-muted-foreground mb-2">
              Mandatory Requirements
            </h5>
            <div className="space-y-2">
              {trackAudit.mandatoryItems.map((item) => (
                <div className="flex items-start gap-2 text-[11px]" key={item.id}>
                  <AuditStatusBadge status={item.status} />
                  <div>
                    <span className="font-medium">{item.label}: </span>
                    <span className="text-muted-foreground">{item.summary}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h5 className="text-[10px] uppercase font-semibold text-muted-foreground mb-2">
              Optional Metadata & Credits
            </h5>
            <div className="space-y-2">
              {trackAudit.optionalItems.map((item) => (
                <div className="flex items-start gap-2 text-[11px]" key={item.id}>
                  <AuditStatusBadge status={item.status} />
                  <div className="flex-1">
                    <span className="font-medium">{item.label}: </span>
                    <span className="text-muted-foreground">{item.summary}</span>
                    {item.id.includes("lyrics") && track.lyrics && (
                      <button
                        type="button"
                        onClick={() => setShowLyrics(!showLyrics)}
                        className="ml-2 text-[10px] underline text-primary font-medium cursor-pointer"
                      >
                        {showLyrics ? "Hide lyrics" : "View lyrics"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {showLyrics && track.lyrics && (
              <div className="mt-3 p-3 bg-muted/40 rounded border border-border text-[11px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                {track.lyrics}
              </div>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}

export function AudioPreview({ track }: { track: AdminTrack }) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string>(track.audioUrl || "");

  const hasVariants = track.audioVariants && track.audioVariants.length > 0;

  return !track.audioUrl ? (
    <small>Audio source not recorded</small>
  ) : (
    <div className="ad-audio space-y-1.5">
      <div className="flex items-center gap-2">
        <AudioLines size={19} className={playing ? "ad-wave shrink-0" : "shrink-0"} />
        <audio
          key={selectedUrl}
          aria-label={`Preview ${track.title}`}
          controls
          preload="none"
          src={selectedUrl}
          className="flex-1 max-w-md h-8"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => {
            setError(true);
            setPlaying(false);
          }}
        />
        {hasVariants && (
          <AdminDropdown
            size="sm"
            value={selectedUrl}
            onChange={(url) => {
              setSelectedUrl(url);
              setError(false);
              setPlaying(false);
            }}
            options={[
              { value: track.audioUrl || "", label: "Original Master" },
              ...track.audioVariants.map((v) => ({
                value: v.url || "",
                label: `${v.name}`,
                badge: `${v.format?.toUpperCase()} · ${v.bitrateKbps}k`,
              })),
            ]}
          />
        )}
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {error
            ? "The selected audio file could not be played. Check storage or codec support."
            : selectedUrl === track.audioUrl
              ? "Playing original uploaded master · Review preview"
              : `Playing processed variant (${track.audioVariants.find((v) => v.url === selectedUrl)?.name || "variant"})`}
        </span>
      </div>
    </div>
  );
}

export function Variants({ track }: { track: AdminTrack }) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    try {
      setRetrying(true);
      const { retryAdminAudio } = await import("@/lib/api");
      const res = await retryAdminAudio({ data: { trackId: track.id } });
      if (res.success) {
        window.location.reload();
      } else {
        alert(res.error || "Retry failed. Inspect master audio file.");
      }
    } catch (err: any) {
      alert(err.message || "Retry failed");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className={`ad-variants ${track.audioProcessingStatus} flex items-center justify-between text-xs`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-medium capitalize">Processing: {track.audioProcessingStatus || "not recorded"}</span>
        <span>·</span>
        <span>
          {track.audioVariants.filter((v) => v.type === "stream").length} streaming /{" "}
          {track.audioVariants.filter((v) => v.type === "download").length} download variants
        </span>
      </div>
      {track.audioProcessingStatus === "failed" && (
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying || track.processingAvailable === false}
          className="ml-2 px-2.5 py-1 text-[11px] rounded bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {track.processingAvailable === false ? "Local processing required" : retrying ? "Retrying…" : "Retry transcoding"}
        </button>
      )}
    </div>
  );
}
