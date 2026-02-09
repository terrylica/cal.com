"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";

import { Dialog, DialogContent, DialogClose } from "../dialog";
import { Icon } from "../icon";

export type YouTubePlayerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoId: string | null;
  autoplay?: boolean;
};

export function extractYouTubeVideoId(url: string): string | null {
  const shortUrlMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortUrlMatch) return shortUrlMatch[1];

  const longUrlMatch = url.match(/youtube\.com\/(?:watch\?v=|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  if (longUrlMatch) return longUrlMatch[1];

  const noCookieMatch = url.match(/youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (noCookieMatch) return noCookieMatch[1];

  const thumbnailMatch = url.match(/img\.youtube\.com\/vi\/([a-zA-Z0-9_-]{11})/);
  if (thumbnailMatch) return thumbnailMatch[1];

  return null;
}

export function YouTubePlayerModal({
  open,
  onOpenChange,
  videoId,
  autoplay = true,
}: YouTubePlayerModalProps) {
  const { t } = useLocale();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="!max-w-4xl !rounded-xl !bg-black !p-0" enableOverflow>
        <div className="relative">
          <DialogClose
            className="absolute -top-12 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/90"
            color="minimal">
            <Icon name="x" className="h-5 w-5" />
          </DialogClose>

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
