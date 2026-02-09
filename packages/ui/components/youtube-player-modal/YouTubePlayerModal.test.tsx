import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { extractYouTubeVideoId, YouTubePlayerModal } from "./YouTubePlayerModal";

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale() {
    return { t: (key: string) => key };
  },
}));

vi.mock("@calcom/lib/hooks/useCompatSearchParams", () => ({
  useCompatSearchParams() {
    return new URLSearchParams();
  },
}));

vi.mock("next/navigation", () => ({
  usePathname() {
    return "";
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  useRouter() {
    return {
      push: vi.fn(),
      beforePopState: vi.fn(() => null),
      prefetch: vi.fn(() => null),
    };
  },
}));

describe("extractYouTubeVideoId", () => {
  it("extracts video ID from youtu.be short URLs", () => {
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts video ID from youtube.com watch URLs", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts video ID from youtube.com embed URLs", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts video ID from youtube.com shorts URLs", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts video ID from youtube-nocookie.com embed URLs", () => {
    expect(extractYouTubeVideoId("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts video ID from YouTube thumbnail URLs", () => {
    expect(extractYouTubeVideoId("https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeVideoId("https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("handles video IDs with hyphens and underscores", () => {
    expect(extractYouTubeVideoId("https://youtu.be/abc-_def_12")).toBe("abc-_def_12");
  });

  it("returns null for non-YouTube URLs", () => {
    expect(extractYouTubeVideoId("https://www.google.com")).toBeNull();
    expect(extractYouTubeVideoId("https://vimeo.com/123456")).toBeNull();
  });

  it("returns null for invalid YouTube URLs without a valid video ID", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/")).toBeNull();
    expect(extractYouTubeVideoId("https://www.youtube.com/watch")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractYouTubeVideoId("")).toBeNull();
  });

  it("extracts video ID from URLs with additional query parameters", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120")).toBe("dQw4w9WgXcQ");
  });
});

describe("YouTubePlayerModal", () => {
  it("renders nothing when closed", () => {
    render(<YouTubePlayerModal open={false} onOpenChange={vi.fn()} videoId="dQw4w9WgXcQ" />);

    expect(screen.queryByTitle("video_player")).not.toBeInTheDocument();
  });

  it("renders iframe with correct src when open with videoId", () => {
    render(<YouTubePlayerModal open={true} onOpenChange={vi.fn()} videoId="dQw4w9WgXcQ" />);

    const iframe = screen.getByTitle("video_player");
    expect(iframe).toBeInTheDocument();
    expect(iframe.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0"
    );
  });

  it("disables autoplay when autoplay prop is false", () => {
    render(
      <YouTubePlayerModal open={true} onOpenChange={vi.fn()} videoId="dQw4w9WgXcQ" autoplay={false} />
    );

    const iframe = screen.getByTitle("video_player");
    expect(iframe.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&rel=0"
    );
  });

  it("does not render iframe when videoId is null", () => {
    render(<YouTubePlayerModal open={true} onOpenChange={vi.fn()} videoId={null} />);

    expect(screen.queryByTitle("video_player")).not.toBeInTheDocument();
  });

  it("uses youtube-nocookie.com for privacy", () => {
    render(<YouTubePlayerModal open={true} onOpenChange={vi.fn()} videoId="dQw4w9WgXcQ" />);

    const iframe = screen.getByTitle("video_player");
    expect(iframe.getAttribute("src")).toContain("youtube-nocookie.com");
  });
});
