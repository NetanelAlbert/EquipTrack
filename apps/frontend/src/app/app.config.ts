import {
  APP_INITIALIZER,
  ApplicationConfig,
  ErrorHandler,
  importProvidersFrom,
  inject,
  provideZoneChangeDetection,
} from '@angular/core';
import {
  provideHttpClient,
  HttpClient,
  withInterceptors,
} from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';
import { NavigationError, provideRouter, Router } from '@angular/router';

import { appRoutes } from './app.routes';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { errorInterceptor } from '../services/error-interceptor.service';
import { RuntimeConfigService } from '../services/runtime-config.service';
import { VersionedTranslateHttpLoader } from './versioned-translate-http-loader';
import { AppInitService } from './app.init.service';
import { ChunkLoadErrorHandler } from './chunk-load-error.handler';
import { filter } from 'rxjs/operators';

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
  const router = inject(Router);
  const errorHandler = inject(ErrorHandler);
  return () =>
    runtimeConfig.load().then(async () => {
      await appInitService.initialize();
      router.events
        .pipe(
          filter((e): e is NavigationError => e instanceof NavigationError)
        )
        .subscribe((e) => errorHandler.handleError(e.error));
    });
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    { provide: ErrorHandler, useClass: ChunkLoadErrorHandler },
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
