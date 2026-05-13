import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export type SaloneContatti = {
  nome: string;
  indirizzo: string;
  telefono: string;
  email: string;
  orari: string[];
  latitudine: number;
  longitudine: number;
  mapsUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
};

export const CONTATTI_SALONE_DEFAULT: SaloneContatti = {
  nome: 'MyBarber',
  indirizzo: 'Via Roma, 123 - 90100 Palermo (PA)',
  telefono: '+39 091 1234567',
  email: 'info@mybarber.it',
  orari: ['Lunedi: Chiuso', 'Martedi - Venerdi: 09:00 - 19:30', 'Sabato: 08:30 - 20:00', 'Domenica: Chiuso'],
  latitudine: 38.1157,
  longitudine: 13.3613,
  mapsUrl: 'https://www.google.com/maps/dir/?api=1&destination=38.1157,13.3613',
  instagramUrl: 'https://www.instagram.com/',
  facebookUrl: 'https://www.facebook.com/',
  tiktokUrl: 'https://www.tiktok.com/'
};

@Injectable({
  providedIn: 'root'
})
export class SaloneContattiService {
  private apiUrl = 'api/auth/contatti-salone';

  constructor(private http: HttpClient) {}

  getContatti(): Observable<SaloneContatti> {
    return this.http.get<SaloneContatti>(this.apiUrl);
  }
}
