import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Grid,
  Eye,
  EyeOff,
  Move,
  Upload,
  CheckCircle2,
  AlertCircle,
  Sliders,
} from "lucide-react";
import { safeMediaUrl } from "./model";

export interface GenreCropperMeta {
  width: number;
  height: number;
  size: number;
  name: string;
}

interface GenreCoverCropperProps {
  rawImageSrc: string;
  initialImage?: string;
  meta: GenreCropperMeta | null;
  genreName: string;
  genreSlug: string;
  onCropExport: (croppedBase64: string) => void;
  onChangeFile: (file: File) => void;
  onReset: () => void;
  onEditExistingArtwork?: () => void;
}

export function GenreCoverCropper({
  rawImageSrc,
  initialImage,
  meta,
  genreName,
  genreSlug,
  onCropExport,
  onChangeFile,
  onReset,
  onEditExistingArtwork,
}: GenreCoverCropperProps) {
  const [zoom, setZoom] = useState(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [viewportWidth, setViewportWidth] = useState(480);
  const [exportWarning, setExportWarning] = useState("");

  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Measure viewport width responsively
  useEffect(() => {
    const updateWidth = () => {
      if (viewportRef.current) {
        setViewportWidth(viewportRef.current.clientWidth || 480);
      }
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    if (viewportRef.current) ro.observe(viewportRef.current);
    window.addEventListener("resize", updateWidth);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  // Load raw image into memory to get natural dimensions
  useEffect(() => {
    if (!rawImageSrc) return;
    setExportWarning("");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const nw = img.naturalWidth || img.width;
      const nh = img.naturalHeight || img.height;
      setNaturalSize({ width: nw, height: nh });
      imgRef.current = img;
      setZoom(1.0);
      setPanOffset({ x: 0, y: 0 });
    };
    img.onerror = () => {
      setExportWarning("Could not load image data for cropping. Try uploading the file again.");
    };
    img.src = rawImageSrc;
  }, [rawImageSrc]);

  // Export 2:1 crop to high-resolution 800x400 canvas
  const exportCrop = useCallback(
    (currentZoom: number, currentPan: { x: number; y: number }) => {
      const img = imgRef.current;
      if (!img || !naturalSize.width || !naturalSize.height) return;

      const nw = naturalSize.width;
      const nh = naturalSize.height;

      // Base 2:1 window in natural pixels
      const baseCropW = Math.min(nw, 2 * nh);
      const wCrop = baseCropW / currentZoom;
      const hCrop = wCrop / 2;

      const maxShiftX = (nw - wCrop) / 2;
      const maxShiftY = (nh - hCrop) / 2;

      const cropX = Math.max(0, Math.min(nw - wCrop, maxShiftX + currentPan.x * maxShiftX));
      const cropY = Math.max(0, Math.min(nh - hCrop, maxShiftY + currentPan.y * maxShiftY));

      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 400;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Dark background fill
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, 800, 400);

      try {
        ctx.drawImage(img, cropX, cropY, wCrop, hCrop, 0, 0, 800, 400);
        let dataUrl = canvas.toDataURL("image/webp", 0.92);
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        }
        onCropExport(dataUrl);
        setExportWarning("");
      } catch (e) {
        console.warn("Canvas crop export error:", e);
        setExportWarning("Image cannot be exported via canvas due to CORS security restrictions. Please select a local file.");
      }
    },
    [naturalSize, onCropExport]
  );

  // Debounce export on zoom / pan changes
  useEffect(() => {
    if (!naturalSize.width || !naturalSize.height) return;
    const timer = setTimeout(() => {
      exportCrop(zoom, panOffset);
    }, 60);
    return () => clearTimeout(timer);
  }, [zoom, panOffset, naturalSize, exportCrop]);

  // Compute live positioning for viewport
  const nw = naturalSize.width || 800;
  const nh = naturalSize.height || 400;
  const baseCropW = Math.min(nw, 2 * nh);
  const wCrop = baseCropW / zoom;
  const hCrop = wCrop / 2;
  const maxShiftX = (nw - wCrop) / 2;
  const maxShiftY = (nh - hCrop) / 2;

  const cropX = Math.max(0, Math.min(nw - wCrop, maxShiftX + panOffset.x * maxShiftX));
  const cropY = Math.max(0, Math.min(nh - hCrop, maxShiftY + panOffset.y * maxShiftY));

  const scale = viewportWidth > 0 ? viewportWidth / wCrop : 1;
  const displayW = nw * scale;
  const displayH = nh * scale;
  const displayLeft = -cropX * scale;
  const displayTop = -cropY * scale;

  // Pointer & Drag handling
  const handlePointerDown = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({ x: clientX, y: clientY });
    setPanStart({ ...panOffset });
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const deltaX = clientX - dragStart.x;
    const deltaY = clientY - dragStart.y;

    let nextPanX = panStart.x;
    if (maxShiftX > 0 && viewportWidth > 0) {
      const shiftPx = (-deltaX * (wCrop / viewportWidth)) / maxShiftX;
      nextPanX = Math.max(-1, Math.min(1, panStart.x + shiftPx));
    }

    const viewportHeight = viewportWidth / 2;
    let nextPanY = panStart.y;
    if (maxShiftY > 0 && viewportHeight > 0) {
      const shiftPx = (-deltaY * (hCrop / viewportHeight)) / maxShiftY;
      nextPanY = Math.max(-1, Math.min(1, panStart.y + shiftPx));
    }

    setPanOffset({ x: nextPanX, y: nextPanY });
  };

  const handlePointerUp = () => {
    if (isDragging) {
      setIsDragging(false);
      exportCrop(zoom, panOffset);
    }
  };

  // If there's an existing image and no new raw image selected yet
  if (!rawImageSrc && initialImage) {
    const displayImg = safeMediaUrl(initialImage) || initialImage;
    return (
      <div className="ad-cropper-container">
        <div className="ad-genre-preview-card">
          <img src={displayImg} alt={`${genreName || "Genre"} preview`} className="ad-genre-preview-img" />
          <div className="ad-genre-preview-overlay">
            <span className="ad-genre-preview-pill">CURRENT ARTWORK</span>
            <h3 className="ad-genre-preview-title">{genreName || "Genre Name"}</h3>
            <p className="ad-genre-preview-slug">/{genreSlug || "slug"}</p>
          </div>
        </div>

        <div className="ad-genre-preview-details">
          <div className="ad-genre-file-info">
            <span className="ad-genre-dim-tag">Cloudflare R2 Stored Artwork</span>
            <span className="ad-genre-size-tag">{initialImage}</span>
          </div>

          <div className="ad-genre-preview-actions">
            {onEditExistingArtwork && (
              <button
                type="button"
                className="ad-btn ad-btn-secondary ad-btn-sm"
                onClick={onEditExistingArtwork}
              >
                <Sliders size={14} />
                <span>Adjust Crop &amp; Zoom</span>
              </button>
            )}
            <label className="ad-btn ad-btn-primary ad-btn-sm" style={{ cursor: "pointer" }}>
              <Upload size={14} />
              <span>Upload new image</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onChangeFile(f);
                }}
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ad-cropper-container">
      {/* 2:1 Interactive Viewport */}
      <div
        ref={viewportRef}
        className={`ad-cropper-viewport ${isDragging ? "is-dragging" : ""}`}
        onMouseDown={(e) => {
          e.preventDefault();
          handlePointerDown(e.clientX, e.clientY);
        }}
        onMouseMove={(e) => {
          handlePointerMove(e.clientX, e.clientY);
        }}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={(e) => {
          if (e.touches.length === 1) {
            handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 1) {
            handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        onTouchEnd={handlePointerUp}
        onTouchCancel={handlePointerUp}
        onWheel={(e) => {
          e.preventDefault();
          const delta = -e.deltaY * 0.0015;
          setZoom((z) => Math.max(1.0, Math.min(3.0, Number((z + delta).toFixed(3)))));
        }}
      >
        {/* Scaled & Positioned Source Image */}
        {rawImageSrc && (
          <img
            src={rawImageSrc}
            alt="Crop target"
            draggable={false}
            className="ad-cropper-image-layer"
            style={{
              position: "absolute",
              width: `${displayW}px`,
              height: `${displayH}px`,
              left: `${displayLeft}px`,
              top: `${displayTop}px`,
              maxWidth: "none",
              maxHeight: "none",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Composition Rule-of-Thirds Grid */}
        {showGrid && (
          <div className="ad-cropper-grid" style={{ pointerEvents: "none" }}>
            <div className="ad-grid-line ad-grid-v1" />
            <div className="ad-grid-line ad-grid-v2" />
            <div className="ad-grid-line ad-grid-h1" />
            <div className="ad-grid-line ad-grid-h2" />
          </div>
        )}

        {/* Discovery Card Overlay (Gradient + Badges) */}
        {showOverlay && (
          <div className="ad-genre-preview-overlay" style={{ pointerEvents: "none" }}>
            <span className="ad-genre-preview-pill">DISCOVERY PREVIEW</span>
            <h3 className="ad-genre-preview-title">{genreName || "Genre Name"}</h3>
            <p className="ad-genre-preview-slug">/{genreSlug || "slug"}</p>
          </div>
        )}

        {/* Quick Pan & Zoom Helper Tag */}
        <div className="ad-cropper-floating-badge" style={{ pointerEvents: "none" }}>
          <Move size={11} />
          <span>Drag to pan · Scroll to zoom</span>
        </div>
      </div>

      {/* Interactive Cropper Controls Toolbar */}
      <div className="ad-cropper-toolbar">
        <div className="ad-cropper-zoom-controls">
          <button
            type="button"
            className="ad-cropper-icon-btn"
            title="Zoom out"
            onClick={() => setZoom((z) => Math.max(1.0, Number((z - 0.15).toFixed(2))))}
            disabled={zoom <= 1.0}
          >
            <ZoomOut size={15} />
          </button>

          <input
            type="range"
            min="1.0"
            max="3.0"
            step="0.02"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="ad-cropper-slider"
            title="Adjust zoom level"
          />

          <button
            type="button"
            className="ad-cropper-icon-btn"
            title="Zoom in"
            onClick={() => setZoom((z) => Math.min(3.0, Number((z + 0.15).toFixed(2))))}
            disabled={zoom >= 3.0}
          >
            <ZoomIn size={15} />
          </button>

          <span className="ad-cropper-zoom-value">{Math.round(zoom * 100)}%</span>
        </div>

        <div className="ad-cropper-tools-group">
          <button
            type="button"
            className="ad-cropper-tool-btn"
            title="Reset position and zoom"
            onClick={() => {
              setZoom(1.0);
              setPanOffset({ x: 0, y: 0 });
            }}
          >
            <RotateCcw size={13} />
            <span>Center</span>
          </button>

          <button
            type="button"
            className={`ad-cropper-tool-btn ${showGrid ? "active" : ""}`}
            title="Toggle 3x3 composition grid"
            onClick={() => setShowGrid(!showGrid)}
          >
            <Grid size={13} />
            <span>Grid</span>
          </button>

          <button
            type="button"
            className={`ad-cropper-tool-btn ${showOverlay ? "active" : ""}`}
            title="Toggle Discovery Card text and gradient overlay"
            onClick={() => setShowOverlay(!showOverlay)}
          >
            {showOverlay ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>Overlay</span>
          </button>
        </div>
      </div>

      {/* Image Metadata & Crop Output Info */}
      <div className="ad-genre-preview-details">
        <div className="ad-genre-file-info">
          {meta ? (
            <>
              <span className="ad-genre-dim-tag">
                Original: {meta.width} × {meta.height} px · {(meta.size / 1024).toFixed(0)} KB
              </span>
              <span className="ad-genre-size-tag">
                Output: 800 × 400 px (2:1 Landscape WebP)
              </span>
            </>
          ) : (
            <>
              <span className="ad-genre-dim-tag">2:1 Framing Ready</span>
              <span className="ad-genre-size-tag">Exporting 800 × 400 px WebP</span>
            </>
          )}
        </div>

        <div className="ad-genre-preview-actions">
          <label className="ad-btn ad-btn-secondary ad-btn-sm" style={{ cursor: "pointer" }}>
            <Upload size={14} />
            <span>Change file</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onChangeFile(f);
              }}
            />
          </label>
          <button
            type="button"
            className="ad-btn ad-btn-danger ad-btn-sm"
            onClick={onReset}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Confirmation Badge */}
      <div className="ad-cropper-success-box">
        <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
        <span>
          Custom 2:1 landscape crop active (800 × 400 px) · Ready for discovery cards.
        </span>
      </div>

      {exportWarning && (
        <div className="ad-genre-warning">
          <AlertCircle size={16} className="shrink-0" />
          <span>{exportWarning}</span>
        </div>
      )}
    </div>
  );
}
