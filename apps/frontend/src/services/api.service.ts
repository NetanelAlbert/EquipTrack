import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { endpointMetas, EndpointMeta, OptionalObject } from '@equip-track/shared';
import { AuthStore } from '../store/auth.store';
import { RuntimeConfigService } from './runtime-config.service';

class EndpointExecutor<Req extends OptionalObject, Res extends OptionalObject> {
  constructor(
    private endpointMeta: EndpointMeta<Req, Res>,
    private http: HttpClient,
    private getApiUrl: () => string,
    private authStore: InstanceType<typeof AuthStore>
  ) {}

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
    const requestUrl = `${this.getApiUrl()}${this.endpointMeta.path}`;
    const url = requestUrl.replace(
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
  private http = inject(HttpClient);
  private authStore = inject(AuthStore);
  private runtimeConfig = inject(RuntimeConfigService);

  endpoints: EndpointsDefinition = this.createEndpointExecutors();

  private createEndpointExecutors(): EndpointsDefinition {
    const endpoints = {} as EndpointsDefinition;

    const setEndpointExecutor = <K extends keyof typeof endpointMetas>(
      key: K
    ) => {
      const endpointMeta = endpointMetas[key];

      endpoints[key] = new EndpointExecutor<
        (typeof endpointMeta)['requestType'],
        (typeof endpointMeta)['responseType']
      >(
        endpointMeta,
        this.http,
        () => this.runtimeConfig.apiUrl,
        this.authStore
      ) as EndpointsDefinition[K];
    };

    for (const key of Object.keys(endpointMetas) as Array<
      keyof typeof endpointMetas
    >) {
      setEndpointExecutor(key);
    }

    return endpoints;
  }
}
