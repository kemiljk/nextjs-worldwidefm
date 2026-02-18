'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';
import { useMediaPlayer } from '@/components/providers/media-player-provider';
import { usePlausible } from 'next-plausible';
import Link from 'next/link';

declare global {
  interface Window {
    io?: (
      url: string,
      options?: {
        auth?: Record<string, string>;
        transports?: string[];
        query?: Record<string, string>;
      }
    ) => {
      on: (event: string, callback: (data?: unknown) => void) => void;
      disconnect: () => void;
      readyState: number;
    };
  }
}

interface StreamState {
  loading: boolean;
  error: string | null;
  connected: boolean;
}

interface LiveMetadata {
  content?: {
    title?: string;
    artist?: string;
    image?: string;
  };
  metadata?: {
    bitrate?: number;
    listeners?: number;
  };
}

export default function LivePlayer() {
  const { isLivePlaying, playLive, pauseLive, liveVolume } = useMediaPlayer();
  const plausible = usePlausible();

  const [streamState, setStreamState] = useState<StreamState>({
    loading: false,
    error: null,
    connected: false,
  });

  const [liveMetadata, setLiveMetadata] = useState<LiveMetadata>({});
  const [matchingShowSlug, setMatchingShowSlug] = useState<string | null>(null);

  // If we receive metadata from WebSocket, we can show show info.
  // Playback should not depend on metadata availability.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const socketRef = useRef<ReturnType<NonNullable<typeof window.io>> | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Environment variables
  const streamUrl = process.env.NEXT_PUBLIC_RADIOCULT_STREAM_URL;
  const stationId = process.env.NEXT_PUBLIC_RADIOCULT_STATION_ID;
  const apiKey = process.env.NEXT_PUBLIC_RADIOCULT_PUBLISHABLE_KEY;

  // Fetch current show immediately on mount for instant display
  // WebSocket will then update it in real-time
  useEffect(() => {
    const fetchCurrentShow = async () => {
      try {
        const response = await fetch('/api/live/current', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        const data = await response.json();

        if (data.success && data.currentEvent) {
          // Set initial show immediately - WebSocket will update it later
          setLiveMetadata({
            content: {
              title: data.currentEvent.showName,
              artist: data.currentEvent.artists?.[0]?.name,
              image: data.currentEvent.imageUrl,
            },
          });

          // Set matching show slug for episode detail linking
          if (data.matchingShowSlug) {
            setMatchingShowSlug(data.matchingShowSlug);
          }
        }
      } catch (error) {
        // Silently fail - WebSocket will provide data
      }
    };

    fetchCurrentShow();
  }, []);
  // Schedule API is unreliable for real-time detection, WebSocket provides instant updates

  // Keep a ref to pauseLive for cleanup without triggering re-runs
  const pauseLiveRef = useRef(pauseLive);
  useEffect(() => {
    pauseLiveRef.current = pauseLive;
  }, [pauseLive]);

  // Initialize audio element once on mount
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    // Note: crossOrigin removed - not needed for audio streams and causes CORS issues
    audioRef.current = audio;

    const handleLoadStart = () => {
      setStreamState(prev => ({ ...prev, loading: true, error: null }));
    };

    const handleCanPlay = () => {
      setStreamState(prev => ({ ...prev, connected: true }));
    };

    const handleError = () => {
      const error = audio.error;

      // Only ignore code 4 when src is empty (cleanup/pause), not when a real stream is set
      if (error && error.code === 4 && !audio.src) {
        return;
      }

      let errorMessage = 'Stream connection failed';

      if (error) {
        switch (error.code) {
          case error.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error';
            break;
          case error.MEDIA_ERR_DECODE:
            errorMessage = 'Stream decode error';
            break;
          case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Stream format not supported';
            break;
          default:
            errorMessage = 'Unknown stream error';
        }
      }

      console.error('Audio error:', {
        code: error?.code,
        message: (error as { message?: string } | null)?.message,
        readyState: audio.readyState,
        networkState: audio.networkState,
      });

      setStreamState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        connected: false,
      }));

      if (pauseLiveRef.current) {
        pauseLiveRef.current();
      }
    };

    const handleEnded = () => {
      setStreamState(prev => ({ ...prev, connected: false }));
      if (pauseLiveRef.current) {
        pauseLiveRef.current();
      }
    };

    const handlePause = () => {
      setStreamState(prev => ({ ...prev, loading: false }));
    };

    const handlePlaying = () => {
      setStreamState(prev => ({ ...prev, loading: false, connected: true, error: null }));
    };

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('playing', handlePlaying);

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('playing', handlePlaying);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audioRef.current = null;
    };
  }, []);

  // WebSocket connection for real-time metadata
  const connectWebSocket = useCallback(() => {
    if (!stationId || !apiKey) {
      console.warn('RadioCult WebSocket: Missing station ID or API key');
      return;
    }

    // Don't connect if already connected
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // Using Socket.IO as mentioned in RadioCult API docs
      if (typeof window !== 'undefined' && window.io) {
        const socket = window.io('https://api.radiocult.fm', {
          auth: {
            'x-api-key': apiKey,
          },
          transports: ['websocket'],
          query: {
            stationId: stationId,
          },
        });

        socket.on('connect', () => {
          setStreamState(prev => ({ ...prev, error: null }));
          // Metadata will arrive immediately after connect, updating to current show
        });

        socket.on('player-metadata', (data?: unknown) => {
          const metadata = data as
            | {
                status?: string;
                content?: { title?: string; artist?: string; image?: string; name?: string };
                metadata?: {
                  bitrate?: number;
                  listeners?: number;
                  title?: string;
                  artist?: string;
                };
              }
            | undefined;

          if (metadata) {
            // Extract content - prioritize show/playlist name (scheduled show) over current track
            // content.name = scheduled show name (e.g., "WWFM Playlist")
            // metadata.title = current track playing (e.g., "Leave The Hall")
            const contentTitle =
              metadata.content?.name || metadata.content?.title || metadata.metadata?.title;
            const contentArtist = metadata.content?.artist || metadata.metadata?.artist;

            // Always update immediately with latest metadata - this is the current live show
            setLiveMetadata({
              content: {
                title: contentTitle,
                artist: contentArtist,
                image: metadata.content?.image,
              },
              metadata: metadata.metadata,
            });
          }
        });

        socket.on('disconnect', () => {
          // Attempt reconnection immediately - don't clear metadata yet
          // Keep showing last known show until we reconnect and get new data
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 1000);
        });

        socket.on('error', (error?: unknown) => {
          console.error('RadioCult WebSocket error:', error);
        });

        socketRef.current = socket;
      }
    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
  }, [stationId, apiKey]);

  // Initialize WebSocket connection immediately on mount
  useEffect(() => {
    if (!stationId || !apiKey) {
      return;
    }

    // Connect immediately - Socket.IO should be preloaded in layout
    // If not available, load it quickly
    if (typeof window !== 'undefined') {
      if (window.io) {
        // Socket.IO already loaded, connect immediately
        connectWebSocket();
      } else {
        // Load Socket.IO with async to not block, but connect as soon as ready
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
        script.async = true;
        script.onload = () => {
          connectWebSocket();
        };
        script.onerror = () => {
          console.error('[LivePlayer] Failed to load Socket.IO');
        };
        document.head.appendChild(script);
      }
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket, stationId, apiKey]);

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = liveVolume;
    }
  }, [liveVolume]);

  // Handle pause when state changes elsewhere
  useEffect(() => {
    if (!audioRef.current) return;

    if (!isLivePlaying) {
      // Pause without clearing src to avoid errors
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
      setStreamState(prev => ({ ...prev, loading: false, connected: false }));
    }
  }, [isLivePlaying]);

  const handlePlayPause = async () => {
    if (!streamUrl) {
      setStreamState(prev => ({
        ...prev,
        error: 'Stream URL not configured',
      }));
      return;
    }

    if (!audioRef.current) {
      return;
    }

    // Create event from WebSocket metadata
    const eventToPlay = {
      showName: liveMetadata.content?.title || 'Live Stream',
      ...liveMetadata.content,
    };

    const hadError = Boolean(streamState.error);

    if (streamState.error) {
      // Retry on error
      setStreamState(prev => ({ ...prev, error: null }));
    }

    if (isLivePlaying) {
      plausible('Live Stream Paused', {
        props: {
          show: eventToPlay.showName || 'Unknown',
        },
      });
      pauseLive();
    } else {
      const audio = audioRef.current;
      const shouldReload = audio.src !== streamUrl || hadError;

      if (audio.src !== streamUrl) {
        audio.src = streamUrl;
      }

      if (shouldReload) {
        audio.load();
      }

      setStreamState(prev => ({ ...prev, loading: true, error: null }));

      try {
        // Call audio.play() FIRST to preserve the user gesture chain.
        // Browsers require play() to be called synchronously within the
        // user-initiated event handler; calling React state updates before
        // play() can break this trust chain and cause NotAllowedError.
        await audio.play();

        // Only update React state AFTER play() succeeds
        plausible('Live Stream Played', {
          props: {
            show: eventToPlay.showName || 'Unknown',
          },
        });
        playLive(eventToPlay);
      } catch (error) {
        const err = error as { name?: string; message?: string };
        // Ignore AbortError - this happens if the user pauses/stops before playback starts
        if (err?.name === 'AbortError') {
          return;
        }

        // Auto-retry once after a short delay — Icecast streams can take
        // a moment to start delivering data, especially on slower connections
        console.warn('[LivePlayer] First play attempt failed, retrying...', {
          name: err?.name,
          message: err?.message,
          code: audio.error?.code,
          readyState: audio.readyState,
          networkState: audio.networkState,
          userAgent: navigator.userAgent,
        });

        try {
          audio.load();
          await new Promise(resolve => setTimeout(resolve, 1000));
          await audio.play();

          // Retry succeeded
          plausible('Live Stream Played', {
            props: {
              show: eventToPlay.showName || 'Unknown',
            },
          });
          playLive(eventToPlay);
        } catch (retryError) {
          const retryErr = retryError as { name?: string; message?: string };
          if (retryErr?.name === 'AbortError') {
            return;
          }

          console.error('[LivePlayer] Stream playback failed after retry:', {
            name: retryErr?.name,
            message: retryErr?.message,
            code: audio.error?.code,
            readyState: audio.readyState,
            networkState: audio.networkState,
            userAgent: navigator.userAgent,
            streamUrl,
          });
          setStreamState(prev => ({
            ...prev,
            loading: false,
            error: 'Failed to start playback',
            connected: false,
          }));
          pauseLive();
        }
      }
    }
  };

  const hasMetadata = Boolean(liveMetadata.content?.title);
  const canPlay = Boolean(streamUrl);

  // Check if this is a playlist (not a scheduled show)
  const currentTitle = liveMetadata.content?.title || '';
  const isPlaylist =
    hasMetadata &&
    (currentTitle.toLowerCase().includes('playlist') ||
      (currentTitle.toLowerCase().includes('wwfm') &&
        !currentTitle.toLowerCase().includes('show')));

  // Display "Check out our schedule" for playlists, otherwise show the show name
  const displayName = hasMetadata
    ? isPlaylist
      ? 'Check out our schedule'
      : currentTitle
    : canPlay
      ? 'Live Stream'
      : 'Stream unavailable';

  // Link destination - schedule for playlists, episode page for matched shows, otherwise schedule
  const linkHref = hasMetadata
    ? isPlaylist
      ? '/schedule'
      : matchingShowSlug
        ? `/episode/${matchingShowSlug}`
        : '/schedule'
    : undefined;

  return (
    <div className='fixed top-0 bg-almostblack text-white dark:bg-black dark:text-white z-50 flex items-center transition-all duration-300 h-11 left-0 right-0 max-w-full'>
      <div className='ml-4 flex items-center shrink-0 transition-opacity duration-200'>
        <button
          className='rounded-full transition-colors disabled:opacity-100 text-white'
          aria-label={isLivePlaying ? 'Pause live stream' : 'Play live stream'}
          data-testid='live-player-toggle'
          data-state={isLivePlaying ? 'playing' : 'paused'}
          data-loading={streamState.loading ? 'true' : 'false'}
          disabled={!canPlay}
          onClick={handlePlayPause}
        >
          {isLivePlaying && streamState.loading ? (
            <Loader2 className='h-3 w-3 animate-spin' />
          ) : isLivePlaying ? (
            <Pause fill='white' className='size-5' />
          ) : (
            <Play fill='white' className='size-5' />
          )}
        </button>
      </div>
      <div className='flex items-center mx-2 gap-2 overflow-hidden flex-1'>
        {linkHref ? (
          <Link
            href={linkHref}
            className='text-m7 font-mono uppercase whitespace-nowrap hover:underline transition-all'
            data-testid='live-player-label'
          >
            {displayName}
          </Link>
        ) : (
          <div
            className='text-m7 font-mono uppercase whitespace-nowrap'
            data-testid='live-player-label'
          >
            {displayName}
          </div>
        )}
        {streamState.error && streamUrl ? (
          <a
            href={streamUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='text-m7 font-mono uppercase whitespace-nowrap underline'
            data-testid='live-player-fallback-link'
          >
            Open stream
          </a>
        ) : null}
      </div>
    </div>
  );
}
