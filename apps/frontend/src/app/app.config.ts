import {
  ApplicationConfig,
  inject,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  provideHttpClient,
  HttpClient,
  withInterceptors,
} from '@angular/common/http';
import { MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';
import { APP_INITIALIZER, importProvidersFrom } from '@angular/core';

import { appRoutes } from './app.routes';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { errorInterceptor } from '../services/error-interceptor.service';
import { RuntimeConfigService } from '../services/runtime-config.service';
import { VersionedTranslateHttpLoader } from './versioned-translate-http-loader';
import { AppInitService } from './app.init.service';

export function translateLoaderFactory(http: HttpClient) {
  return new VersionedTranslateHttpLoader(http);
}

/**
 * Load runtime config before any app-init HTTP calls so apiUrl is stable
 * (avoids mixed dev-api + localhost when runtime-config overrides mid-bootstrap).
 */
export function appBootstrapInitializer() {
  const runtimeConfig = inject(RuntimeConfigService);
  const appInitService = inject(AppInitService);
  return () => runtimeConfig.load().then(() => appInitService.initialize());
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([errorInterceptor])),
    importProvidersFrom(
      TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useFactory: translateLoaderFactory,
          deps: [HttpClient],
        },
        defaultLanguage: 'he',
      })
    ),
    {
      provide: APP_INITIALIZER,
      useFactory: appBootstrapInitializer,
      multi: true,
    },
    {
      provide: MAT_SNACK_BAR_DEFAULT_OPTIONS,
      useValue: {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      },
    },
  ],
};
