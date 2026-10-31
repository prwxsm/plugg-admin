import { retryAdminAudio } from "@/lib/api";
import { useState, type ReactNode } from "react";
import { AlertTriangle, AudioLines, Clock3, Disc3, LockKeyhole } from "lucide-react";
import type { AdminRelease, AdminTrack } from "./model";
import { pendingHours, safeMediaUrl } from "./model";
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
  const v = track.technicalValidation;
  const number = (key: string) => (typeof v[key] === "number" ? (v[key] as number) : null);
  const rawFormat = typeof v["format"] === "string" ? v["format"].toUpperCase() : null;
  const isMp3 = rawFormat === "MP3";
  const rate = number("sampleRate");
  const bits = number("bitDepth");
  const channels = number("channels");
  const bitrate = number("bitrateKbps");
  const isVbr = v["isVbr"] === true;
  const qualityWarning = typeof v["qualityWarning"] === "string" ? v["qualityWarning"] : null;
  const warning = typeof v["warning"] === "string" ? v["warning"] : null;

  return (
    <div className="ad-tags flex flex-wrap gap-1.5 items-center">
      {!rawFormat && rate === null && bits === null && channels === null && bitrate === null ? (
        <Pill>Technical specifications not recorded</Pill>
      ) : (
        <>
          <Pill tone={qualityWarning ? "amber" : ""}>{rawFormat || "Format unknown"}</Pill>
          {isMp3 ? (
            <>
              <Pill tone={qualityWarning ? "amber" : ""}>
                {bitrate === null ? "Bitrate unknown" : `${bitrate} kbps${isVbr ? " VBR" : ""}`}
              </Pill>
              {qualityWarning && <Pill tone="amber">{qualityWarning}</Pill>}
            </>
          ) : (
            <Pill tone={bits === 24 ? "amber" : ""}>
              {bits === null
                ? "Bit depth unknown"
                : `${bits}-bit${v["isLossless"] === true ? " lossless" : ""}`}
            </Pill>
          )}
          <Pill>{rate === null ? "Sample rate unknown" : `${rate / 1000} kHz`}</Pill>
          <Pill tone={channels === 1 ? "red" : ""}>
            {channels === null
              ? "Channels unknown"
              : channels >= 2
                ? "Stereo"
                : "Mono"}
          </Pill>
          {warning && !qualityWarning && <Pill tone="amber">{warning}</Pill>}
        </>
      )}
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
          <select
            value={selectedUrl}
            onChange={(e) => {
              setSelectedUrl(e.target.value);
              setError(false);
              setPlaying(false);
            }}
            className="text-[11px] bg-elevated/80 border border-border rounded px-2 py-1 text-foreground"
            title="Inspect audio variant"
            aria-label="Select audio variant to inspect"
          >
            <option value={track.audioUrl || ""}>Original Source</option>
            {track.audioVariants.map((v) => (
              <option key={v.name} value={v.url || ""}>
                {v.name} ({v.format?.toUpperCase()} · {v.bitrateKbps}k)
              </option>
            ))}
          </select>
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
          disabled={retrying}
          className="ml-2 px-2.5 py-1 text-[11px] rounded bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {retrying ? "Retrying…" : "Retry transcoding"}
        </button>
      )}
    </div>
  );
}
