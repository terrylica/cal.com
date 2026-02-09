"use client";

import { useCallback } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";

import { Dialog, DialogContent, DialogClose } from "../dialog";
import { Icon } from "../icon";

export type YouTubePlayerModalProps = {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when the modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** YouTube video ID to play */
  videoId: string | null;
  /** Whether to autoplay the video when modal opens (default: true) */
  autoplay?: boolean;
};

/**
 * Extracts a YouTube video ID from various URL formats.
 * Supports:
 * - youtu.be short URLs (e.g., https://youtu.be/VIDEO_ID)
 * - youtube.com watch URLs (e.g., https://youtube.com/watch?v=VIDEO_ID)
 * - youtube.com embed URLs (e.g., https://youtube.com/embed/VIDEO_ID)
 * - youtube.com shorts URLs (e.g., https://youtube.com/shorts/VIDEO_ID)
 * - youtube-nocookie.com embed URLs
 * - YouTube thumbnail URLs (e.g., https://img.youtube.com/vi/VIDEO_ID/0.jpg)
 *
 * @param url - The URL to extract the video ID from
 * @returns The video ID if found, null otherwise
 */
export function extractYouTubeVideoId(url: string): string | null {
  // Handle youtu.be short URLs
  const shortUrlMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortUrlMatch) return shortUrlMatch[1];

  // Handle youtube.com URLs (watch, embed, shorts)
  const longUrlMatch = url.match(/youtube\.com\/(?:watch\?v=|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  if (longUrlMatch) return longUrlMatch[1];

  // Handle youtube-nocookie.com URLs
  const noCookieMatch = url.match(/youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (noCookieMatch) return noCookieMatch[1];

  // Handle YouTube thumbnail URLs
  const thumbnailMatch = url.match(/img\.youtube\.com\/vi\/([a-zA-Z0-9_-]{11})/);
  if (thumbnailMatch) return thumbnailMatch[1];

  return null;
}

/**
 * A reusable modal component for playing YouTube videos in an embedded player.
 * Uses youtube-nocookie.com for privacy-enhanced embedding.
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 * const [videoId, setVideoId] = useState<string | null>(null);
 *
 * // Open modal with a video
 * const handleVideoClick = (url: string) => {
 *   const id = extractYouTubeVideoId(url);
 *   if (id) {
 *     setVideoId(id);
 *     setOpen(true);
 *   }
 * };
 *
 * return (
 *   <>
 *     <button onClick={() => handleVideoClick("https://youtu.be/VIDEO_ID")}>
 *       Watch Video
 *     </button>
 *     <YouTubePlayerModal
 *       open={open}
 *       onOpenChange={setOpen}
 *       videoId={videoId}
 *     />
 *   </>
 * );
 * ```
 */
export function YouTubePlayerModal({
  open,
  onOpenChange,
  videoId,
  autoplay = true,
}: YouTubePlayerModalProps) {
  const { t } = useLocale();

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="xl" className="!max-w-4xl !rounded-xl !bg-black !p-0" enableOverflow>
        <div className="relative">
          {/* Close button positioned above the video */}
          <DialogClose
            className="absolute -top-12 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/90"
            color="minimal">
            <Icon name="x" className="h-5 w-5" />
          </DialogClose>

          {/* Video container with 16:9 aspect ratio */}
          {videoId && (
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                className="absolute left-0 top-0 h-full w-full rounded-xl"
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=${autoplay ? 1 : 0}&rel=0`}
                title={t("video_player")}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
