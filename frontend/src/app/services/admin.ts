import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SaloneContatti } from './salone-contatti';

export type AdminCliente = {
  id: number;
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  ruolo?: string;
  totale_appuntamenti?: number;
  ultimo_appuntamento?: string;
};

export type AdminPrenotazione = {
  id: number;
  user_id: number;
  data: string;
  ora: string;
  oraFine: string;
  durataMinuti: number;
  stato?: 'confermata' | 'da_riprogrammare' | 'annullata' | string;
  servizio: string;
  servizioNome: string;
  prezzo: number;
  note: string;
  cliente: AdminCliente;
};

export type AdminServizio = {
  id: number;
  valore: string;
  nome: string;
  descrizione: string;
  prezzo: number;
  durataMinuti: number;
  badge: string;
  immagine: string;
  dettagli: string[];
  attivo: boolean;
};

export type AdminBloccoDisponibilita = {
  id: number;
  data: string;
  oraInizio: string;
  oraFine: string;
  interaGiornata: boolean;
  motivo: string;
};

export type AdminRegolaDisponibilita = {
  id: number;
  giornoSettimana: number;
  oraInizio: string;
  oraFine: string;
  interaGiornata: boolean;
  motivo: string;
  validaDal: string;
  validaAl: string;
  attiva: boolean;
};

export type AdminDisponibilitaResponse = {
  message: string;
  id?: number;
  creati?: number;
  blocchi?: Array<{ id: number; data: string }>;
  conflitti?: number;
};

export type AdminStatistiche = {
  oggi: { appuntamenti: number; incasso: number };
  settimana: { appuntamenti: number; incasso: number };
  mese: { appuntamenti: number; incasso: number };
  serviziRichiesti: Array<{ servizio: string; nome: string; totale: number; incasso: number }>;
  clientiFrequenti: Array<{ id: number; nome: string; cognome: string; telefono: string; totale: number }>;
  andamento: Array<{ data: string; appuntamenti: number; incasso: number }>;
};

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = 'api/admin';

  constructor(private http: HttpClient) {}

  getPrenotazioni(params: Record<string, string> = {}): Observable<AdminPrenotazione[]> {
    return this.http.get<AdminPrenotazione[]>(`${this.apiUrl}/prenotazioni`, { params });
  }

  creaPrenotazione(payload: unknown): Observable<{ message: string; id: number }> {
    return this.http.post<{ message: string; id: number }>(`${this.apiUrl}/prenotazioni`, payload);
  }

  updatePrenotazione(id: number, payload: unknown): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/prenotazioni/${id}`, payload);
  }

  deletePrenotazione(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/prenotazioni/${id}`);
  }

  getClienti(search = ''): Observable<AdminCliente[]> {
    const params: Record<string, string> = {};

    if (search) {
      params['search'] = search;
    }

    return this.http.get<AdminCliente[]>(`${this.apiUrl}/clienti`, { params });
  }

  getCliente(id: number): Observable<{ cliente: AdminCliente; prenotazioni: AdminPrenotazione[] }> {
    return this.http.get<{ cliente: AdminCliente; prenotazioni: AdminPrenotazione[] }>(`${this.apiUrl}/clienti/${id}`);
  }

  getStatistiche(): Observable<AdminStatistiche> {
    return this.http.get<AdminStatistiche>(`${this.apiUrl}/statistiche`);
  }

  getContattiSalone(): Observable<SaloneContatti> {
    return this.http.get<SaloneContatti>(`${this.apiUrl}/contatti`);
  }

  updateContattiSalone(payload: unknown): Observable<{ message: string; contatti: SaloneContatti }> {
    return this.http.put<{ message: string; contatti: SaloneContatti }>(`${this.apiUrl}/contatti`, payload);
  }

  getDisponibilita(data = ''): Observable<AdminBloccoDisponibilita[]> {
    const params: Record<string, string> = {};

    if (data) {
      params['data'] = data;
    }

    return this.http.get<AdminBloccoDisponibilita[]>(`${this.apiUrl}/disponibilita`, { params });
  }

  creaDisponibilita(payload: unknown): Observable<AdminDisponibilitaResponse> {
    return this.http.post<AdminDisponibilitaResponse>(`${this.apiUrl}/disponibilita`, payload);
  }

  deleteDisponibilita(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/disponibilita/${id}`);
  }

  getDisponibilitaRicorrente(): Observable<AdminRegolaDisponibilita[]> {
    return this.http.get<AdminRegolaDisponibilita[]>(`${this.apiUrl}/disponibilita/ricorrenti`);
  }

  creaDisponibilitaRicorrente(payload: unknown): Observable<AdminDisponibilitaResponse> {
    return this.http.post<AdminDisponibilitaResponse>(`${this.apiUrl}/disponibilita/ricorrenti`, payload);
  }

  deleteDisponibilitaRicorrente(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/disponibilita/ricorrenti/${id}`);
  }

  getServizi(): Observable<AdminServizio[]> {
    return this.http.get<AdminServizio[]>(`${this.apiUrl}/servizi`);
  }

  creaServizio(payload: unknown): Observable<{ message: string; id: number; valore: string }> {
    return this.http.post<{ message: string; id: number; valore: string }>(`${this.apiUrl}/servizi`, payload);
  }

  updateServizio(id: number, payload: unknown): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/servizi/${id}`, payload);
  }

  deleteServizio(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/servizi/${id}`);
  }
}
