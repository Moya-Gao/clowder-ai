export type ProfileMode = 'subscription' | 'api_key';

export interface ProfileItem {
  id: string;
  provider: 'anthropic';
  name: string;
  mode: ProfileMode;
  baseUrl?: string;
  modelOverride?: string;
  hasApiKey: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderProfilesResponse {
  projectPath: string;
  anthropic: {
    activeProfileId: string | null;
    profiles: ProfileItem[];
  };
}

export interface ProfileTestResult {
  ok: boolean;
  mode: ProfileMode;
  status?: number;
  error?: string;
  message?: string;
}
