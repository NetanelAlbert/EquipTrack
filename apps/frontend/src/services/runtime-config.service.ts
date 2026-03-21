import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';

interface RuntimeConfig {
  apiUrl?: string;
}

function isRuntimeConfig(value: unknown): value is RuntimeConfig {
  return typeof value === 'object' && value !== null;
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
        this.config = {
          ...this.config,
          apiUrl: fileApiUrl,
        };
      }
    } catch {
      // No-op fallback to environment config when runtime file is unavailable.
    }
  }
}
