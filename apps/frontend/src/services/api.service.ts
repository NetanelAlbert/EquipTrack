import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { Observable, throwError } from 'rxjs';
import { endpointMetas, EndpointMeta, OptionalObject } from '@equip-track/shared';
import { AuthStore } from '../store/auth.store';

class EndpointExecutor<Req extends OptionalObject, Res extends OptionalObject> {
  private requestUrl: string;
  constructor(
    private endpointMeta: EndpointMeta<Req, Res>,
    private http: HttpClient,
    private apiUrl: string,
    private authStore: InstanceType<typeof AuthStore>
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
      const token = this.authStore.token();
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
  private authStore = inject(AuthStore);

  endpoints: EndpointsDefinition = Object.entries(endpointMetas).reduce(
    (acc, [key, value]) => {
      const typedKey = key as keyof typeof endpointMetas;
      acc[typedKey] = new EndpointExecutor<
        (typeof value)['requestType'],
        (typeof value)['responseType']
      >(value, this.http, this.apiUrl, this.authStore);
      return acc;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    {} as any
  );
}
