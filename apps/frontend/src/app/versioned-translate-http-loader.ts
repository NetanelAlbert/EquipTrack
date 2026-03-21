import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

/**
 * Loads i18n JSON with a version query so browsers/CDNs fetch fresh files after each deploy.
 * Keep {@link environment.version} in sync with releases (or inject at build time).
 */
@Injectable()
export class VersionedTranslateHttpLoader implements TranslateLoader {
  constructor(private readonly http: HttpClient) {}

  getTranslation(lang: string): Observable<TranslationObject> {
    const v = encodeURIComponent(environment.version);
    return this.http.get<TranslationObject>(
      `./assets/i18n/${lang}.json?v=${v}`,
    );
  }
}
