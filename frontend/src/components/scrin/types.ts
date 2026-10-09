export interface ScrinOverview {
  configured: boolean;
  linked: boolean;
  lastActive: number | null;
  todaySeconds: number;
  yesterdaySeconds: number;
  weekSeconds: number;
  monthSeconds: number;
  activeDays: string[];
}

export interface ScrinScreenshotApp {
  fromScreen: boolean;
  duration: number;
  applicationName: string;
}

export interface ScrinScreenshot {
  id: number;
  url: string;
  thumbUrl: string;
  takenLocal: string;
  activityLevel: number;
  applications: ScrinScreenshotApp[];
}

export interface ScrinBlock {
  note: string | null;
  offline: boolean;
  from: number;
  to: number;
  fromLocal: string;
  toLocal: string;
  screenshots: ScrinScreenshot[];
}

export interface ScrinDayActivity {
  configured: boolean;
  linked: boolean;
  totalSeconds: number;
  blocks: ScrinBlock[];
}

export interface LightboxShot extends ScrinScreenshot {
  note: string | null;
}
