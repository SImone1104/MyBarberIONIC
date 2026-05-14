import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, forkJoin, map, of, tap, throwError, timeout } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { normalizzaServizioApi, ServizioOfferto } from '../shared/servizi';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'api/auth'; 
  private appuntamentiDaGestireSubject = new BehaviorSubject<number>(0);
  appuntamentiDaGestire$ = this.appuntamentiDaGestireSubject.asObservable();

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
      localStorage.removeItem('role');
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
          localStorage.setItem('role', response.user?.ruolo || 'user');
          this.refreshAppuntamentiDaGestire().subscribe({ error: () => undefined });
        }
      })
    );
  }

  register(userData: any): Observable<any> {
    if (this.hasLocalStorage()) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('role');
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
      localStorage.removeItem('role');
    }

    this.appuntamentiDaGestireSubject.next(0);
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

  getRole(): string {
    if (this.hasLocalStorage()) {
      const token = localStorage.getItem('token');

      if (token && !this.isTokenExpired(token)) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const role = payload.ruolo || payload.role || localStorage.getItem('role') || 'user';
          localStorage.setItem('role', role);
          return role;
        } catch {
          return localStorage.getItem('role') || 'user';
        }
      }

      return localStorage.getItem('role') || 'user';
    }

    return 'user';
  }

  isAdmin(): boolean {
    return this.isLoggedIn() && this.getRole() === 'admin';
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

  riprogrammaPrenotazione(id: number, datiPrenotazione: any): Observable<any> {
    return this.withAuthHeaders((headers) =>
      this.http.put(`${this.apiUrl}/prenota/${id}/riprogramma`, datiPrenotazione, { headers }).pipe(
        tap(() => this.refreshAppuntamentiDaGestire().subscribe({ error: () => undefined }))
      )
    );
  }

  getPrenotazioni(): Observable<any> {
    return this.withAuthHeaders((headers) =>
      this.http.get(`${this.apiUrl}/miei-appuntamenti`, { headers })
    );
  }

  getNotifiche(): Observable<any[]> {
    return this.withAuthHeaders((headers) =>
      this.http.get<any[]>(`${this.apiUrl}/notifiche`, { headers })
    );
  }

  segnaNotificaLetta(id: number): Observable<any> {
    return this.withAuthHeaders((headers) =>
      this.http.put(`${this.apiUrl}/notifiche/${id}/letta`, {}, { headers }).pipe(
        tap(() => this.refreshAppuntamentiDaGestire().subscribe({ error: () => undefined }))
      )
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
      this.http.delete(`${this.apiUrl}/prenota/${id}`, { headers }).pipe(
        tap(() => this.refreshAppuntamentiDaGestire().subscribe({ error: () => undefined }))
      )
    );
  }

  getServiziDisponibili(): Observable<ServizioOfferto[]> {
    return this.http.get<any[]>(`${this.apiUrl}/servizi`).pipe(
      map((servizi) => servizi.map((servizio) => normalizzaServizioApi(servizio)))
    );
  }

  aggiornaAppuntamentiDaGestire(notifiche: any[] = [], prenotazioni: any[] = []): number {
    const appuntamentiDaRiprogrammare = prenotazioni.filter((prenotazione) => prenotazione.stato === 'da_riprogrammare');
    const appuntamentiDaRiprogrammareIds = new Set(appuntamentiDaRiprogrammare.map((prenotazione) => Number(prenotazione.id)));
    const notificheAttiveCollegate = notifiche.filter((notifica) =>
      !notifica.letta && appuntamentiDaRiprogrammareIds.has(Number(notifica.prenotazioneId))
    );
    const totale = Math.max(appuntamentiDaRiprogrammare.length, notificheAttiveCollegate.length);

    this.appuntamentiDaGestireSubject.next(totale);
    return totale;
  }

  refreshAppuntamentiDaGestire(): Observable<number> {
    if (!this.isLoggedIn() || this.isAdmin()) {
      this.appuntamentiDaGestireSubject.next(0);
      return of(0);
    }

    return forkJoin({
      notifiche: this.getNotifiche().pipe(catchError(() => of([]))),
      prenotazioni: this.getPrenotazioni().pipe(catchError(() => of([])))
    }).pipe(
      map(({ notifiche, prenotazioni }) => this.aggiornaAppuntamentiDaGestire(notifiche, prenotazioni)),
      catchError(() => {
        this.appuntamentiDaGestireSubject.next(0);
        return of(0);
      })
    );
  }
}
