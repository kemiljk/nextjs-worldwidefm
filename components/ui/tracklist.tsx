import React from "react";

interface TracklistProps {
  content: string;
  className?: string;
}

interface Track {
  artist: string;
  title: string;
}

export function Tracklist({ content, className = "" }: TracklistProps) {
  if (!content) return null;

  // Parse the tracklist content to extract artist and title information
  const parseTracklist = (htmlContent: string): Track[] => {
    // Create a temporary DOM element to parse HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;

    const tracks: Track[] = [];

    // Look for common tracklist patterns
    // Replace <br> tags with newlines to handle mixed content formats
    const contentWithNewlines = htmlContent.replace(/<br\s*\/?>/gi, "\n");
    const tempDiv2 = document.createElement("div");
    tempDiv2.innerHTML = contentWithNewlines;
    const lines = tempDiv2.textContent?.split("\n") || [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Try to parse different formats
      let artist = "";
      let title = "";

      // Format: "Artist - Title"
      if (trimmedLine.includes(" - ")) {
        const parts = trimmedLine.split(" - ");
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(" - ").trim();
        }
      }
      // Format: "Artist: Title"
      else if (trimmedLine.includes(": ")) {
        const parts = trimmedLine.split(": ");
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(": ").trim();
        }
      }
      // Format: "Artist – Title" (en dash)
      else if (trimmedLine.includes(" – ")) {
        const parts = trimmedLine.split(" – ");
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(" – ").trim();
        }
      }
      // Format: "Artist / Title"
      else if (trimmedLine.includes(" / ")) {
        const parts = trimmedLine.split(" / ");
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(" / ").trim();
        }
      }
      // Format: "Artist | Title"
      else if (trimmedLine.includes(" | ")) {
        const parts = trimmedLine.split(" | ");
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(" | ").trim();
        }
      }
      // If no separator found, treat the whole line as title
      else {
        title = trimmedLine;
      }

      if (artist || title) {
        tracks.push({ artist, title });
      }
    }

    return tracks;
  };

  // Parse tracks on the client side
  const [tracks, setTracks] = React.useState<Track[]>([]);

  React.useEffect(() => {
    setTracks(parseTracklist(content));
  }, [content]);

  if (tracks.length === 0) {
    // Fallback to original content if parsing fails
    return (
      <div className={`prose dark:prose-invert max-w-none ${className}`}>
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    );
  }

  return (
    <div className={`space-y-0 ${className}`}>
      {tracks.map((track, index) => (
        <div key={index} className="flex items-center py-3 border-b border-gray-300 dark:border-gray-600 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
          <div className="flex-1 min-w-0 pr-4">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 block leading-tight">{track.artist || "Unknown Artist"}</span>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm text-gray-700 dark:text-gray-300 block leading-tight">{track.title}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Server-side version for static generation
export function TracklistServer({ content, className = "" }: TracklistProps) {
  if (!content) return null;

  // Simple parsing for server-side rendering
  const parseTracklistServer = (htmlContent: string): Track[] => {
    // Replace <br> tags with newlines before removing other HTML tags
    const contentWithNewlines = htmlContent.replace(/<br\s*\/?>/gi, "\n");
    // Remove remaining HTML tags and split by lines
    const cleanContent = contentWithNewlines.replace(/<[^>]*>/g, "");
    const lines = cleanContent.split("\n");

    const tracks: Track[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      let artist = "";
      let title = "";

      // Format: "Artist - Title"
      if (trimmedLine.includes(" - ")) {
        const parts = trimmedLine.split(" - ");
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(" - ").trim();
        }
      }
      // Format: "Artist: Title"
      else if (trimmedLine.includes(": ")) {
        const parts = trimmedLine.split(": ");
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(": ").trim();
        }
      }
      // Format: "Artist – Title" (en dash)
      else if (trimmedLine.includes(" – ")) {
        const parts = trimmedLine.split(" – ");
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(" – ").trim();
        }
      }
      // Format: "Artist / Title"
      else if (trimmedLine.includes(" / ")) {
        const parts = trimmedLine.split(" / ");
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(" / ").trim();
        }
      }
      // Format: "Artist | Title"
      else if (trimmedLine.includes(" | ")) {
        const parts = trimmedLine.split(" | ");
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(" | ").trim();
        }
      }
      // If no separator found, treat the whole line as title
      else {
        title = trimmedLine;
      }

      if (artist || title) {
        tracks.push({ artist, title });
      }
    }

    return tracks;
  };

  const tracks = parseTracklistServer(content);

  if (tracks.length === 0) {
    // Fallback to original content if parsing fails
    return (
      <div className={`prose dark:prose-invert max-w-none ${className}`}>
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    );
  }

  return (
    <div className={`space-y-0 ${className}`}>
      {tracks.map((track, index) => (
        <div key={index} className="flex items-center py-3 border-b border-gray-300 dark:border-gray-600 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
          <div className="flex-1 min-w-0 pr-4">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 block leading-tight">{track.artist || "Unknown Artist"}</span>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm text-gray-700 dark:text-gray-300 block leading-tight">{track.title}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
