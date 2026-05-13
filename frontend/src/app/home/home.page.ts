import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonHeader, IonContent, IonToolbar, IonTitle } from '@ionic/angular/standalone';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';
import { AuthService } from '../services/auth';
import { finalize, timeout } from 'rxjs';
import { SERVIZI_OFFERTI, ServizioOfferto } from '../shared/servizi';

type Appuntamento = {
  id: number;
  data: string;
  ora: string;
  servizio: string;
  note?: string;
};

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink, 
    IonHeader, 
    IonContent, 
    IonToolbar, 
    IonTitle, 
    HeaderComponent, 
    FooterComponent
  ]
})
export class HomePage implements OnInit {
  prossimoAppuntamento: Appuntamento | null = null;
  caricamentoAppuntamento = false;
  servizi = SERVIZI_OFFERTI;
  serviziRapidi: ServizioOfferto[] = this.serviziPopolariDefault();
  titoloServiziRapidi = 'Servizi più richiesti';
  descrizioneServiziRapidi = 'Una selezione rapida dei trattamenti più scelti in barberia.';

  constructor(
    public authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.caricaServizi();

    if (this.authService.isLoggedIn()) {
      this.caricaProssimoAppuntamento();
    }
  }

  caricaServizi() {
    this.authService.getServiziDisponibili().subscribe({
      next: (servizi) => {
        if (servizi.length > 0) {
          this.servizi = servizi;
          this.serviziRapidi = this.serviziPopolariDefault();
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Errore servizi:', err)
    });
  }

  // --- Mantenuta la vostra logica originale di filtraggio appuntamenti ---
  caricaProssimoAppuntamento() {
    this.caricamentoAppuntamento = true;
    this.authService.getPrenotazioni().pipe(
      timeout(6000),
      finalize(() => {
        this.caricamentoAppuntamento = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (prenotazioni: Appuntamento[]) => {
        if (!Array.isArray(prenotazioni)) return;
        const adesso = new Date();
        this.prossimoAppuntamento = prenotazioni
          .filter((app) => this.creaDataAppuntamento(app) >= adesso)
          .sort((a, b) => this.creaDataAppuntamento(a).getTime() - this.creaDataAppuntamento(b).getTime())[0] || null;
        this.aggiornaServiziRapidi(prenotazioni);
      },
      error: (err) => console.error('Errore agenda:', err)
    });
  }

  // Getters per la formattazione italiana (Mantenuti vostri)
  get meseAppuntamento(): string { return this.meseItaliano(this.dataProssimoAppuntamento()); }
  get giornoAppuntamento(): string {
    const data = this.dataProssimoAppuntamento();
    return data ? String(data.getDate()).padStart(2, '0') : '';
  }
  get dataCompletaAppuntamento(): string { return this.dataItaliana(this.dataProssimoAppuntamento()); }

  private dataProssimoAppuntamento(): Date | null {
    return this.prossimoAppuntamento ? this.creaDataAppuntamento(this.prossimoAppuntamento) : null;
  }

  servizioLabel(servizio: string): string { return this.servizioByValore(servizio)?.nome || servizio; }

  meseItaliano(data: Date | null): string {
    if (!data) return '';
    const mesi = ['GEN','FEB','MAR','APR','MAG','GIU','LUG','AGO','SET','OTT','NOV','DIC'];
    return mesi[data.getMonth()];
  }

  dataItaliana(data: Date | null): string {
    return data ? data.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
  }

  private aggiornaServiziRapidi(prenotazioni: Appuntamento[]) {
    const conteggi = prenotazioni.reduce<Record<string, number>>((acc, app) => {
      if (this.servizioByValore(app.servizio)) acc[app.servizio] = (acc[app.servizio] || 0) + 1;
      return acc;
    }, {});
    const serviziFrequenti = Object.entries(conteggi)
      .sort((a, b) => b[1] - a[1])
      .map(([valore]) => this.servizioByValore(valore))
      .filter((s): s is ServizioOfferto => !!s);
    this.serviziRapidi = [...serviziFrequenti, ...this.serviziPopolariDefault().filter(s => !serviziFrequenti.find(f => f.valore === s.valore))].slice(0, 3);
    if (serviziFrequenti.length > 0) {
      this.titoloServiziRapidi = 'I tuoi servizi preferiti';
      this.descrizioneServiziRapidi = 'Riprenotali con un click!';
    }
  }

  private serviziPopolariDefault(): ServizioOfferto[] {
    const preferiti = ['sfumatura', 'completo', 'taglio']
      .map(v => this.servizioByValore(v))
      .filter((s): s is ServizioOfferto => !!s);

    return preferiti.length > 0 ? preferiti : this.servizi.slice(0, 3);
  }

  private servizioByValore(valore: string): ServizioOfferto | undefined {
    return this.servizi.find((servizio) => servizio.valore === valore) || SERVIZI_OFFERTI.find((servizio) => servizio.valore === valore);
  }

  private creaDataAppuntamento(app: Appuntamento): Date {
    const [anno, mese, giorno] = app.data.split('-').map(Number);
    const [ore, minuti] = app.ora.split(':').map(Number);
    return new Date(anno, mese - 1, giorno, ore, minuti);
  }
}
