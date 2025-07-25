import { inject, Injectable, Signal, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { Observable, throwError } from 'rxjs';
import { endpointMetas, EndpointMeta } from '@equip-track/shared';

class EndpointExecutor<Req, Res> {
  private requestUrl: string;
  constructor(
    private endpointMeta: EndpointMeta<Req, Res>,
    private http: HttpClient,
    private apiUrl: string,
    private token: Signal<string | null>
  ) {
    this.requestUrl = `${this.apiUrl}${this.endpointMeta.path}`;
  }
  execute(
    data: Req,
    pathParams: Record<string, string> = {},
    withAuth = true
  ): Observable<Res> {
    const headers: Record<string, string | string[]> = {
      'Content-Type': 'application/json',
    };
    if (withAuth) {
      const token = this.token();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        return throwError(() => new Error('No token found'));
      }
    }
    const url = this.requestUrl.replace(
      /{(\w+)}/g,
      (match, key) => pathParams[key] || match
    );
    return this.http.request<Res>(this.endpointMeta.method, url, {
      body: data,
      headers,
    });
  }
}

type EndpointsDefinition = {
  [K in keyof typeof endpointMetas]: (typeof endpointMetas)[K] extends EndpointMeta<
    infer Req,
    infer Res
  >
    ? EndpointExecutor<Req, Res>
    : never;
};

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private apiUrl = environment.apiUrl;
  private http = inject(HttpClient);
  // Note: duplicate of AuthService.token, but we need to keep it here to avoid circular dependency
  private token = signal<string | null>(null);

  endpoints: EndpointsDefinition = Object.entries(endpointMetas).reduce(
    (acc, [key, value]) => {
      const typedKey = key as keyof typeof endpointMetas;
      acc[typedKey] = new EndpointExecutor<
        (typeof value)['requestType'],
        (typeof value)['responseType']
      >(value, this.http, this.apiUrl, this.token);
      return acc;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    {} as any
  );

  setToken(token: string) {
    this.token.set(token);
  }
}
