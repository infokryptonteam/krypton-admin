import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

@Injectable({ providedIn: 'root' })
export class KryptonApiService {
  constructor(private readonly http: HttpClient) {}

  call<T>(action: string, payload: Record<string, unknown> = {}): Observable<T> {
    const request = this.mapRequest(action, payload);
    return this.http.request<ApiEnvelope<T>>(request.method, request.url, {
      body: request.body,
      withCredentials: true,
    }).pipe(
      map(envelope => {
        if (!envelope?.success) throw new Error(envelope?.message || 'API request failed.');
        return envelope.data as T;
      }),
      catchError((error: unknown) => {
        const responseBody = typeof error === 'object' && error !== null && 'error' in error ? error.error : null;
        const message = typeof responseBody === 'object' && responseBody !== null && 'message' in responseBody
          ? String(responseBody.message)
          : error instanceof Error ? error.message : 'API request failed.';
        return throwError(() => new Error(message));
      }),
    );
  }

  private mapRequest(action: string, payload: Record<string, unknown>): {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    url: string;
    body?: Record<string, unknown>;
  } {
    switch (action) {
      case 'loginUser':
        return { method: 'POST', url: '/api/auth/login', body: { email: payload['email'], password: payload['password'] } };
      case 'getSession':
        return { method: 'GET', url: '/api/auth/session' };
      case 'logoutUser':
        return { method: 'POST', url: '/api/auth/logout', body: {} };
      case 'getAppData':
        return { method: 'GET', url: '/api/data' };
      case 'addClient':
        return { method: 'POST', url: '/api/records/clients', body: { data: payload['data'] } };
      case 'addProject':
        return { method: 'POST', url: '/api/records/projects', body: { data: payload['data'] } };
      case 'addProjectURL':
        return { method: 'POST', url: '/api/records/urls', body: { data: {
          'Client ID': payload['clientId'], 'Project ID': payload['projectId'], 'URL Name': payload['name'],
          URL: payload['url'], Type: payload['type'], Notes: payload['notes'],
        } } };
      case 'addRecord': {
        const entity = String(payload['sheetName'] || '').toLowerCase();
        const route = entity === 'urls' ? 'urls' : entity;
        return { method: 'POST', url: `/api/records/${encodeURIComponent(route)}`, body: { data: payload['data'] } };
      }
      case 'updateRecord': {
        const entity = String(payload['entity'] || '').toLowerCase();
        const recordId = String(payload['recordId'] || '');
        return { method: 'PUT', url: `/api/records/${encodeURIComponent(entity)}/${encodeURIComponent(recordId)}`, body: { data: payload['data'] } };
      }
      case 'deleteRecord': {
        const entity = String(payload['entity'] || '').toLowerCase();
        const recordId = String(payload['recordId'] || '');
        return { method: 'DELETE', url: `/api/records/${encodeURIComponent(entity)}/${encodeURIComponent(recordId)}` };
      }
      case 'createKryptonBackup':
        return { method: 'POST', url: '/api/backup', body: {} };
      default:
        throw new Error(`Unsupported API action: ${action}`);
    }
  }
}