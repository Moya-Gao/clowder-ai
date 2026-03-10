export type ProviderProfileProvider = 'anthropic';
export type ProviderProfileMode = 'subscription' | 'api_key';

export interface ProviderProfileMeta {
  id: string;
  provider: ProviderProfileProvider;
  name: string;
  mode: ProviderProfileMode;
  baseUrl?: string;
  /** Override model identifier when this profile is active (e.g. "opus[1m]") */
  modelOverride?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderProfileView extends ProviderProfileMeta {
  hasApiKey: boolean;
}

export interface ProviderProfilesView {
  anthropic: {
    activeProfileId: string | null;
    profiles: ProviderProfileView[];
  };
}

export interface CreateProviderProfileInput {
  provider: ProviderProfileProvider;
  name: string;
  mode: ProviderProfileMode;
  baseUrl?: string;
  apiKey?: string;
  modelOverride?: string;
  setActive?: boolean;
}

export interface UpdateProviderProfileInput {
  name?: string;
  mode?: ProviderProfileMode;
  baseUrl?: string;
  apiKey?: string;
  modelOverride?: string | null;
}

export interface AnthropicRuntimeProfile {
  id: string;
  mode: ProviderProfileMode;
  baseUrl?: string;
  apiKey?: string;
  modelOverride?: string;
}

export interface ProviderProfilesMetaFile {
  version: 1;
  providers: {
    anthropic: {
      activeProfileId: string | null;
      profiles: ProviderProfileMeta[];
    };
  };
}

export interface ProviderProfilesSecretsFile {
  version: 1;
  providers: {
    anthropic: Record<string, { apiKey?: string }>;
  };
}

export interface NormalizedState<T> {
  value: T;
  dirty: boolean;
}
