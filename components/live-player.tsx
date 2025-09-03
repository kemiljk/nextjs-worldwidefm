'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Circle } from 'lucide-react';
import { useMediaPlayer } from '@/components/providers/media-player-provider';

declare global {
  interface Window {
    io?: any;
  }
}

interface StreamState {
  loading: boolean;
  error: string | null;
  connected: boolean;
}

interface LiveMetadata {
  status: 'live' | 'offline';
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
  const { currentLiveEvent, isLivePlaying, playLive, pauseLive, liveVolume, setLiveVolume } =
    useMediaPlayer();

  const [streamState, setStreamState] = useState<StreamState>({
    loading: false,
    error: null,
    connected: false,
  });

  const [liveMetadata, setLiveMetadata] = useState<LiveMetadata>({
    status: 'offline',
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const socketRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const metadataTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Environment variables
  const streamUrl = process.env.NEXT_PUBLIC_RADIOCULT_STREAM_URL;
  const stationId = process.env.NEXT_PUBLIC_RADIOCULT_STATION_ID;
  const apiKey = process.env.NEXT_PUBLIC_RADIOCULT_PUBLISHABLE_KEY;

  // Initialize audio element ONLY when we have a live event
  useEffect(() => {
    // Only initialize audio if we have a live event
    if (!currentLiveEvent) {
      // Clean up audio if no live event
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      return;
    }

    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'none';
      audio.volume = liveVolume;
      audio.crossOrigin = 'anonymous';
      audioRef.current = audio;

      // Set up audio event listeners
      audio.addEventListener('loadstart', () => {
        setStreamState((prev) => ({ ...prev, loading: true, error: null }));
      });

      audio.addEventListener('canplay', () => {
        setStreamState((prev) => ({ ...prev, loading: false, connected: true }));
      });

      audio.addEventListener('error', (e) => {
        const error = audio.error;
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

        console.error('Audio error:', error);
        setStreamState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
          connected: false,
        }));
      });

      audio.addEventListener('ended', () => {
        setStreamState((prev) => ({ ...prev, connected: false }));
        pauseLive();
      });

      audio.addEventListener('pause', () => {
        setStreamState((prev) => ({ ...prev, loading: false }));
      });

      audio.addEventListener('playing', () => {
        setStreamState((prev) => ({ ...prev, loading: false, connected: true, error: null }));
      });
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, [currentLiveEvent, liveVolume, pauseLive]);

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
          console.log('RadioCult WebSocket connected');
          setStreamState((prev) => ({ ...prev, error: null }));
        });

        socket.on('player-metadata', (data: any) => {
          console.log('Received metadata:', data);
          setLiveMetadata({
            status: data.status || 'offline',
            content: data.content,
            metadata: data.metadata,
          });

          // Reset metadata timeout
          if (metadataTimeoutRef.current) {
            clearTimeout(metadataTimeoutRef.current);
          }

          // Set offline after 2 minutes of no updates
          metadataTimeoutRef.current = setTimeout(() => {
            setLiveMetadata((prev) => ({ ...prev, status: 'offline' }));
          }, 120000);
        });

        socket.on('disconnect', () => {
          console.log('RadioCult WebSocket disconnected');
          // Attempt reconnection after 5 seconds
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
        });

        socket.on('error', (error: any) => {
          console.error('RadioCult WebSocket error:', error);
        });

        socketRef.current = socket;
      }
    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
  }, [stationId, apiKey]);

  // Initialize WebSocket connection only when needed
  useEffect(() => {
    // Only connect WebSocket if we have environment variables configured
    // and either have a live event or need to detect one
    if (!stationId || !apiKey) {
      return;
    }

    // Load Socket.IO if not already loaded
    if (typeof window !== 'undefined' && !window.io) {
      const script = document.createElement('script');
      script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
      script.onload = () => {
        connectWebSocket();
      };
      document.head.appendChild(script);
    } else {
      connectWebSocket();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (metadataTimeoutRef.current) {
        clearTimeout(metadataTimeoutRef.current);
      }
    };
  }, [connectWebSocket, stationId, apiKey]);

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = liveVolume;
    }
  }, [liveVolume]);

  // Handle play/pause state changes
  useEffect(() => {
    if (!audioRef.current) return;

    if (isLivePlaying && currentLiveEvent) {
      if (!streamUrl) {
        setStreamState((prev) => ({
          ...prev,
          error: 'Stream URL not configured',
        }));
        pauseLive();
        return;
      }

      if (audioRef.current.src !== streamUrl) {
        audioRef.current.src = streamUrl;
      }

      setStreamState((prev) => ({ ...prev, loading: true, error: null }));

      audioRef.current.play().catch((error) => {
        console.error('Error playing live stream:', error);
        setStreamState((prev) => ({
          ...prev,
          loading: false,
          error: 'Failed to start playback',
          connected: false,
        }));
        pauseLive();
      });
    } else {
      audioRef.current.pause();
      setStreamState((prev) => ({ ...prev, loading: false, connected: false }));
    }
  }, [isLivePlaying, currentLiveEvent, streamUrl, pauseLive]);

  const handlePlayPause = () => {
    if (!currentLiveEvent) return;

    if (streamState.error) {
      // Retry on error
      setStreamState((prev) => ({ ...prev, error: null }));
      if (audioRef.current && streamUrl) {
        audioRef.current.src = streamUrl;
      }
    }

    if (isLivePlaying) {
      pauseLive();
    } else {
      playLive(currentLiveEvent);
    }
  };

  const hasLive = Boolean(currentLiveEvent);
  const isActuallyLive = liveMetadata.status === 'live' || hasLive;

  // Use metadata from WebSocket if available, fallback to event data
  const displayName =
    liveMetadata.content?.title || currentLiveEvent?.showName || 'Nothing currently live';

  return (
    <div className='fixed top-0 bg-almostblack text-white z-50 flex items-center transition-all duration-300 h-12 left-0 right-0 max-w-full'>
      <div
        className={`${isActuallyLive ? 'border-l border-white/20 pl-4' : ''} ml-4 flex items-center shrink-0 transition-opacity duration-200`}
      >
        <button
          className={`rounded-full transition-colors disabled:opacity-20 ${isLivePlaying ? 'text-red-500' : 'text-white'}`}
          disabled={!isActuallyLive}
          onClick={handlePlayPause}
        >
          {isLivePlaying ? (
            <Pause
              fill='white'
              className='h-5 w-5'
            />
          ) : isActuallyLive ? (
            <Circle
              fill='#ef4444'
              className='h-5 w-5 animate-pulse text-red-500'
            />
          ) : (
            <Play
              fill='white'
              className='h-5 w-5'
            />
          )}
        </button>
      </div>
      <div className='flex items-center mx-2 gap-3 overflow-hidden'>
        <div>
          <div className='text-m7 font-mono uppercase whitespace-nowrap'>{displayName}</div>
          {isActuallyLive && (
            <div className='flex items-center gap-1.5'>
              <div className='w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse' />
              <span className='text-xs text-white/90 uppercase'>
                {streamState.loading ? 'Connecting...' : streamState.error ? 'Error' : 'Live'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
