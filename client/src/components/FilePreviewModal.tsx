import { useState, useEffect } from "react";
import { X, Download, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PreviewFile {
  id: number;
  fileNameOriginal: string;
  fileType: string;
  fileSize: number;
  url: string; // presigned/download URL
}

interface FilePreviewModalProps {
  files: PreviewFile[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

export function FilePreviewModal({ files, initialIndex = 0, open, onClose }: FilePreviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);

  const current = files[currentIndex];
  const isImage = current?.fileType?.startsWith("image/");
  const isPdf = current?.fileType === "application/pdf";

  // Reset state when file changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setLoading(true);
  }, [currentIndex]);

  // Reset index when modal opens
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setZoom(1);
      setRotation(0);
      setLoading(true);
    }
  }, [open, initialIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && currentIndex > 0) setCurrentIndex(i => i - 1);
      if (e.key === "ArrowRight" && currentIndex < files.length - 1) setCurrentIndex(i => i + 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, currentIndex, files.length, onClose]);

  if (!open || !current) return null;

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = current.url;
    a.download = current.fileNameOriginal;
    a.target = "_blank";
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />

      {/* Modal container */}
      <div className="relative z-10 flex flex-col w-full h-full max-w-5xl max-h-screen p-2 sm:p-4">
        {/* Top toolbar */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2 min-w-0">
            {files.length > 1 && (
              <span className="text-white/60 text-sm shrink-0">
                {currentIndex + 1} / {files.length}
              </span>
            )}
            <p className="text-white text-sm font-medium truncate max-w-xs sm:max-w-md">
              {current.fileNameOriginal}
            </p>
            <span className="text-white/40 text-xs shrink-0">
              {(current.fileSize / 1024).toFixed(0)} KB
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isImage && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                  title="ย่อ"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-white/60 text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={() => setZoom(z => Math.min(4, z + 0.25))}
                  title="ขยาย"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={() => setRotation(r => (r + 90) % 360)}
                  title="หมุน"
                >
                  <RotateCw className="w-4 h-4" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={handleDownload}
              title="ดาวน์โหลด"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={onClose}
              title="ปิด"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content area */}
        <div className="relative flex-1 flex items-center justify-center overflow-hidden rounded-lg bg-black/30">
          {/* Prev/Next navigation */}
          {files.length > 1 && currentIndex > 0 && (
            <button
              className="absolute left-2 z-10 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
              onClick={() => setCurrentIndex(i => i - 1)}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {files.length > 1 && currentIndex < files.length - 1 && (
            <button
              className="absolute right-2 z-10 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
              onClick={() => setCurrentIndex(i => i + 1)}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* Image preview */}
          {isImage && (
            <div className="w-full h-full flex items-center justify-center overflow-auto">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
              <img
                key={current.url}
                src={current.url}
                alt={current.fileNameOriginal}
                className={cn(
                  "max-w-none object-contain transition-all duration-200",
                  loading ? "opacity-0" : "opacity-100"
                )}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  maxHeight: zoom === 1 ? "calc(100vh - 120px)" : "none",
                  maxWidth: zoom === 1 ? "100%" : "none",
                }}
                onLoad={() => setLoading(false)}
                onError={() => setLoading(false)}
                draggable={false}
              />
            </div>
          )}

          {/* PDF preview */}
          {isPdf && (
            <div className="w-full h-full flex flex-col">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
              <iframe
                key={current.url}
                src={`${current.url}#toolbar=1&navpanes=0`}
                className={cn(
                  "w-full flex-1 rounded border-0 transition-opacity duration-200",
                  loading ? "opacity-0" : "opacity-100"
                )}
                title={current.fileNameOriginal}
                onLoad={() => setLoading(false)}
              />
            </div>
          )}

          {/* Unsupported file type */}
          {!isImage && !isPdf && (
            <div className="flex flex-col items-center gap-4 text-white/70">
              <FileText className="w-16 h-16 text-white/30" />
              <p className="text-sm">ไม่รองรับการ preview ไฟล์ประเภทนี้</p>
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/20"
                onClick={handleDownload}
              >
                <Download className="w-4 h-4 mr-2" />
                ดาวน์โหลดไฟล์
              </Button>
            </div>
          )}
        </div>

        {/* Thumbnail strip (when multiple files) */}
        {files.length > 1 && (
          <div className="flex gap-2 mt-2 overflow-x-auto pb-1 justify-center">
            {files.map((f, i) => {
              const isImg = f.fileType?.startsWith("image/");
              return (
                <button
                  key={f.id}
                  onClick={() => setCurrentIndex(i)}
                  className={cn(
                    "w-12 h-12 rounded-lg border-2 flex items-center justify-center shrink-0 overflow-hidden transition-all",
                    i === currentIndex
                      ? "border-white opacity-100"
                      : "border-white/20 opacity-50 hover:opacity-75"
                  )}
                >
                  {isImg ? (
                    <img
                      src={f.url}
                      alt={f.fileNameOriginal}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileText className="w-5 h-5 text-white/60" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
