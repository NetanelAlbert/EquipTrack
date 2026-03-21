import { computed, effect, Injectable, signal, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { STORAGE_KEYS } from '../utils/consts';

export type AppLanguage = 'he' | 'en';
type LanguageDirection = 'rtl' | 'ltr';

export interface LanguageOption {
  code: AppLanguage;
  labelKey: string;
  direction: LanguageDirection;
}

const DEFAULT_LANGUAGE: AppLanguage = 'he';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translateService = inject(TranslateService);
  private readonly currentLanguage = signal<AppLanguage>(DEFAULT_LANGUAGE);

  readonly language = computed(() => this.currentLanguage());
  readonly isRtl = computed(
    () => this.getLanguageDirection(this.currentLanguage()) === 'rtl'
  );
  readonly availableLanguages: readonly LanguageOption[] = [
    { code: 'he', labelKey: 'settings.language.hebrew', direction: 'rtl' },
    { code: 'en', labelKey: 'settings.language.english', direction: 'ltr' },
  ];

  constructor() {
    effect(() => {
      const activeLanguage = this.currentLanguage();
      const direction = this.getLanguageDirection(activeLanguage);

      document.documentElement.lang = activeLanguage;
      document.documentElement.dir = direction;
      document.body.dir = direction;
    });
  }

  initializeLanguage(): AppLanguage {
    this.translateService.setDefaultLang(DEFAULT_LANGUAGE);

    const storedLanguage = this.getPersistedLanguage();
    const initialLanguage = storedLanguage ?? DEFAULT_LANGUAGE;
    this.setLanguage(initialLanguage);

    return initialLanguage;
  }

  setLanguage(language: AppLanguage): void {
    this.currentLanguage.set(language);
    this.translateService.use(language);
    this.persistLanguage(language);
  }

  isSupportedLanguage(language: unknown): language is AppLanguage {
    return (
      typeof language === 'string' &&
      this.availableLanguages.some((item) => item.code === language)
    );
  }

  private getLanguageDirection(language: AppLanguage): LanguageDirection {
    return (
      this.availableLanguages.find((item) => item.code === language)
        ?.direction ?? 'ltr'
    );
  }

  private getPersistedLanguage(): AppLanguage | null {
    try {
      const persistedLanguage = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
      if (!persistedLanguage || !this.isSupportedLanguage(persistedLanguage)) {
        return null;
      }
      return persistedLanguage;
    } catch (error) {
      console.error('Failed to load persisted language:', error);
      return null;
    }
  }

  private persistLanguage(language: AppLanguage): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LANGUAGE, language);
    } catch (error) {
      console.error('Failed to persist language:', error);
    }
  }
}
