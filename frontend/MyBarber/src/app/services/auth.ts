import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, throwError, timeout } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'api/auth'; 

  constructor(private http: HttpClient) { }

private hasLocalStorage(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  }

  private authHeadersOrError(): HttpHeaders {
    const token = this.getToken();

    if (!token || this.isTokenExpired(token)) {
      this.logout();
      throw { status: 401, message: 'Sessione scaduta' };
    }

    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  private withAuthHeaders<T>(request: (headers: HttpHeaders) => Observable<T>): Observable<T> {
    try {
      return request(this.authHeadersOrError());
    } catch (err) {
      return throwError(() => err);
    }
  }

  login(credentials: any): Observable<any> {
    if (this.hasLocalStorage()) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
    }

    const loginData = {
      email: (credentials.email || '').trim().toLowerCase(),
      password: credentials.password || ''
    };

    return this.http.post<any>(`${this.apiUrl}/login`, loginData).pipe(
      tap((response) => {
        if (response.token && this.hasLocalStorage()) {
          localStorage.setItem('token', response.token);
          const username = response.user?.nome || loginData.email.split('@')[0];
          localStorage.setItem('username', username);
        }
      })
    );
  }

  register(userData: any): Observable<any> {
    if (this.hasLocalStorage()) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
    }

    const registrationData = {
      nome: (userData.nome || '').trim(),
      cognome: (userData.cognome || '').trim(),
      email: (userData.email || '').trim().toLowerCase(),
      password: userData.password || '',
      telefono: (userData.telefono || userData.cellulare || '').trim()
    };

    return this.http.post(`${this.apiUrl}/register`, registrationData);
  }

  logout() {
    if (this.hasLocalStorage()) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
    }
  }

  isLoggedIn(): boolean {
    if (this.hasLocalStorage()) {
      const token = localStorage.getItem('token');

      if (!token || this.isTokenExpired(token)) {
        this.logout();
        return false;
      }

      return true;
    }

    return false;
  }

  getUsername(): string {
    if (this.hasLocalStorage()) {
      return localStorage.getItem('username') || 'Utente';
    }

    return 'Utente';
  }

  getToken(): string | null {
    if (this.hasLocalStorage()) {
      return localStorage.getItem('token');
    }

    return null;
  }

  getProfile(): Observable<any> {
    return this.withAuthHeaders((headers) =>
      this.http.get(`${this.apiUrl}/profile`, { headers })
    );
  }

  updateProfile(profileData: any): Observable<any> {
    return this.withAuthHeaders((headers) =>
      this.http.put(`${this.apiUrl}/profile`, profileData, { headers }).pipe(
        tap((response: any) => {
          if (response?.nome && this.hasLocalStorage()) {
            localStorage.setItem('username', response.nome);
          }
        })
      )
    );
  }

  creaPrenotazione(datiPrenotazione: any): Observable<any> {
    return this.withAuthHeaders((headers) =>
      this.http.post(`${this.apiUrl}/prenota`, datiPrenotazione, { headers })
    );
  }

  getPrenotazioni(): Observable<any> {
    return this.withAuthHeaders((headers) =>
      this.http.get(`${this.apiUrl}/miei-appuntamenti`, { headers })
    );
  }

  getOrariOccupati(data: string): Observable<any[]> {
    return this.withAuthHeaders((headers) =>
      this.http.get<any[]>(`${this.apiUrl}/orari-occupati?data=${encodeURIComponent(data)}`, { headers }).pipe(
        timeout(8000)
      )
    );
  }

  eliminaPrenotazione(id: number): Observable<any> {
    return this.withAuthHeaders((headers) =>
      this.http.delete(`${this.apiUrl}/prenota/${id}`, { headers })
    );
  }
}