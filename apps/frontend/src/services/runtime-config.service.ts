import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';

interface RuntimeConfig {
  apiUrl?: string;
  featurePreviewLoginEnabled?: boolean;
}

function isRuntimeConfig(value: unknown): value is RuntimeConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const o = value as Record<string, unknown>;
  if (
    o.featurePreviewLoginEnabled !== undefined &&
    typeof o.featurePreviewLoginEnabled !== 'boolean'
  ) {
    return false;
  }
  return true;
}

/** True when apiUrl targets loopback or RFC1918 — unsafe from a public HTTPS origin (Chrome PNA, mixed behavior). */
function isPrivateOrLoopbackApiUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]') {
      return true;
    }
    if (
      h.startsWith('192.168.') ||
      h.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function shouldIgnoreRuntimeApiUrl(fileApiUrl: string): boolean {
  if (typeof globalThis === 'undefined' || !('location' in globalThis)) {
    return false;
  }
  const loc = globalThis.location as Location;
  const host = loc.hostname;
  const onLoopback =
    host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  if (onLoopback) {
    return false;
  }
  return isPrivateOrLoopbackApiUrl(fileApiUrl);
}

@Injectable({
  providedIn: 'root',
})
export class RuntimeConfigService {
  private config: RuntimeConfig = {
    apiUrl: environment.apiUrl,
  };

  get apiUrl(): string {
    return this.config.apiUrl || environment.apiUrl;
  }

  get featurePreviewLoginEnabled(): boolean {
    return this.config.featurePreviewLoginEnabled === true;
  }

  async load(): Promise<void> {
    try {
      const response = await fetch('/assets/runtime-config.json', {
        cache: 'no-store',
      });
      if (!response.ok) {
        return;
      }

      const configFromFile: unknown = await response.json();
      if (!isRuntimeConfig(configFromFile)) {
        return;
      }

      const fileApiUrl = configFromFile.apiUrl?.trim();
      if (fileApiUrl) {
        if (shouldIgnoreRuntimeApiUrl(fileApiUrl)) {
          console.warn(
            '[RuntimeConfig] Ignoring runtime-config apiUrl pointing to a local/private host while app is served from a public origin. Using build-time environment.apiUrl instead.'
          );
        } else {
          this.config = {
            ...this.config,
            apiUrl: fileApiUrl,
          };
        }
      }
      if (configFromFile.featurePreviewLoginEnabled === true) {
        this.config = {
          ...this.config,
          featurePreviewLoginEnabled: true,
        };
      }
    } catch {
      // No-op fallback to environment config when runtime file is unavailable.
    }
  }
}
