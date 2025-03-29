interface MixcloudPlayer {
  ready: Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  getDuration: () => Promise<number>;
  getPosition: () => Promise<number>;
  seek: (position: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  getVolume: () => Promise<number>;
  events: {
    play: {
      on: (callback: () => void) => void;
    };
    pause: {
      on: (callback: () => void) => void;
    };
    ended: {
      on: (callback: () => void) => void;
    };
    buffering: {
      on: (callback: () => void) => void;
    };
    error: {
      on: (callback: (error: any) => void) => void;
    };
    progress: {
      on: (callback: (seconds: number) => void) => void;
    };
  };
}

interface MixcloudAPI {
  PlayerWidget: (iframe: HTMLIFrameElement) => MixcloudPlayer;
}

interface Window {
  Mixcloud?: MixcloudAPI;
}
