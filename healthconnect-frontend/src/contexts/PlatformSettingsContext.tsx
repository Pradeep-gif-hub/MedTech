import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { buildApiUrl } from '../config/api';

export type PlatformSettings = {
  platform_name: string;
  support_email: string;
  session_timeout: number;
  max_login_attempts: number;
  updated_at?: string;
};

type PlatformSettingsContextType = {
  settings: PlatformSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  saveSettings: (next: Partial<PlatformSettings>) => Promise<PlatformSettings>;
};

const DEFAULT_SETTINGS: PlatformSettings = {
  platform_name: 'MedTech',
  support_email: 'support@healthconnect.com',
  session_timeout: 30,
  max_login_attempts: 5,
};

const STORAGE_KEY = 'platform_settings';

const PlatformSettingsContext = createContext<PlatformSettingsContextType | undefined>(undefined);

const readLocalSettings = (): PlatformSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PlatformSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const persistLocalSettings = (settings: PlatformSettings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('platform-settings-updated', { detail: settings }));
};

export const PlatformSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<PlatformSettings>(() => readLocalSettings());
  const [loading, setLoading] = useState(true);

  const refreshSettings = async () => {
    const res = await fetch(buildApiUrl('/api/admin/settings'));
    if (!res.ok) {
      throw new Error(`Settings fetch failed (${res.status})`);
    }
    const data = (await res.json()) as Partial<PlatformSettings>;
    const next = {
      ...DEFAULT_SETTINGS,
      ...data,
    };
    setSettings(next);
    persistLocalSettings(next);
  };

  const saveSettings = async (next: Partial<PlatformSettings>) => {
    const res = await fetch(buildApiUrl('/api/admin/settings'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });

    if (!res.ok) {
      let message = `Settings update failed (${res.status})`;
      try {
        const body = await res.json();
        message = body?.detail || body?.message || message;
      } catch {
        // noop
      }
      throw new Error(message);
    }

    const body = (await res.json()) as { settings?: PlatformSettings };
    const merged = {
      ...DEFAULT_SETTINGS,
      ...(body.settings || next),
    } as PlatformSettings;

    setSettings(merged);
    persistLocalSettings(merged);
    return merged;
  };

  useEffect(() => {
    const syncFromEvent = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      if (!event.detail || typeof event.detail !== 'object') return;
      setSettings({
        ...DEFAULT_SETTINGS,
        ...(event.detail as Partial<PlatformSettings>),
      });
    };

    window.addEventListener('platform-settings-updated', syncFromEvent as EventListener);

    refreshSettings()
      .catch(() => {
        // Keep local/default settings in offline mode.
      })
      .finally(() => setLoading(false));

    return () => {
      window.removeEventListener('platform-settings-updated', syncFromEvent as EventListener);
    };
  }, []);

  useEffect(() => {
    document.title = settings.platform_name;
  }, [settings.platform_name]);

  const value = useMemo(
    () => ({ settings, loading, refreshSettings, saveSettings }),
    [settings, loading],
  );

  return <PlatformSettingsContext.Provider value={value}>{children}</PlatformSettingsContext.Provider>;
};

export const usePlatformSettings = () => {
  const ctx = useContext(PlatformSettingsContext);
  if (!ctx) {
    throw new Error('usePlatformSettings must be used within PlatformSettingsProvider');
  }
  return ctx;
};
