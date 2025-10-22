// Mixcloud Widget API types
interface MixcloudWidget {
  ready: Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  load(url: string, autoplay?: boolean): Promise<void>;
  getPosition(): Promise<number>;
  getDuration(): Promise<number>;
  seek(seconds: number): Promise<void>;
  events: {
    play: {
      on(callback: () => void): void;
      off(callback: () => void): void;
    };
    pause: {
      on(callback: () => void): void;
      off(callback: () => void): void;
    };
    ended: {
      on(callback: () => void): void;
      off(callback: () => void): void;
    };
    buffering: {
      on(callback: () => void): void;
      off(callback: () => void): void;
    };
    progress: {
      on(callback: (progress: number) => void): void;
      off(callback: (progress: number) => void): void;
    };
    error: {
      on(callback: (error: any) => void): void;
      off(callback: (error: any) => void): void;
    };
  };
}

interface MixcloudAPI {
  PlayerWidget(iframe: HTMLIFrameElement): MixcloudWidget;
}

interface SocketIOClient {
  on: (event: string, callback: (...args: any[]) => void) => void;
  disconnect: () => void;
  readyState: number;
}

interface SocketIOStatic {
  (url: string, options?: any): SocketIOClient;
}

interface Window {
  Mixcloud?: MixcloudAPI;
  io?: SocketIOStatic;
}

declare global {
  interface Window {
    Mixcloud?: MixcloudAPI;
  }
}

export {};
