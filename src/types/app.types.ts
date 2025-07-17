export interface IApp {
  initialize(): Promise<void>;
  navigate(screen: string, params?: any): void;
  getCurrentState(): AppState;
  destroy(): void;
}

export interface AppState {
  currentScreen: string;
  activeTimer: TimerType | null;
  isConnected: boolean;
  settings: UserSettings;
}

export enum TimerType {
  INTERVAL = 'interval',
  FOR_TIME = 'for_time',
  AMRAP = 'amrap',
  CLOCK = 'clock'
}

export interface UserSettings {
  audio: AudioSettings;
  display: DisplaySettings;
  controls: ControlSettings;
}

export interface AudioSettings {
  enabled: boolean;
  volume: number;
  soundPack: string;
}

export interface DisplaySettings {
  theme: 'dark' | 'light';
  fontSize: 'small' | 'medium' | 'large';
  showProgress: boolean;
}

export interface ControlSettings {
  keyboardShortcuts: boolean;
  clickToToggle: boolean;
  autoFullscreen: boolean;
}