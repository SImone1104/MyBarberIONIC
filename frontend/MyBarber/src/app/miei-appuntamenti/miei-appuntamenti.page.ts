import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth';
import { servizioByValore } from '../shared/servizi';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonMenuButton,
  IonButton, IonIcon, IonSpinner 
} from '@ionic/angular/standalone';

type Appuntamento = {
  id: number;
  data: string;
  ora: string;
  ora_fine?: string;
  oraFine?: string;
  durata_minuti?: number;
  durataMinuti?: number;
  servizio: string;
  note?: string;
};

@Component({
  selector: 'app-miei-appuntamenti',
  standalone: true,
  imports: [CommonModule, RouterLink,IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonMenuButton,
    IonButton, IonIcon, IonSpinner,HeaderComponent,FooterComponent],
  templateUrl: './miei-appuntamenti.page.html',
  styleUrl: './miei-appuntamenti.page.scss',
})
export class MieiAppuntamentiPage implements OnInit {
  listaAppuntamenti: Appuntamento[] = [];

  constructor(
    public authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.caricaPrenotazioni();
  }

  caricaPrenotazioni() {
    this.authService.getPrenotazioni().subscribe({
      next: (data: Appuntamento[]) => {
        console.log('Appuntamenti ricevuti dal DB:', data);
        this.listaAppuntamenti = Array.isArray(data)
          ? [...data].sort((a, b) => this.creaDataAppuntamento(a).getTime() - this.creaDataAppuntamento(b).getTime())
          : [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Errore nel recupero appuntamenti:', err);
      }
    });
  }

  rimuoviAppuntamento(id: number) {
    if (confirm('Sei sicuro di voler cancellare questa prenotazione?')) {
      this.authService.eliminaPrenotazione(id).subscribe({
        next: (res) => {
          this.listaAppuntamenti = this.listaAppuntamenti.filter((a) => a.id !== id);
          this.cdr.detectChanges();
          console.log('Eliminato:', res.message);
        },
        error: (err) => {
          console.error('Errore durante l eliminazione:', err);
          alert('Non e stato possibile eliminare la prenotazione dal server.');
        }
      });
    }
  }

  appuntamentiFuturi(): Appuntamento[] {
    const adesso = new Date();

    return this.listaAppuntamenti.filter((appuntamento) => this.creaDataAppuntamento(appuntamento) >= adesso);
  }

  appuntamentiPassati(): Appuntamento[] {
    const adesso = new Date();

    return this.listaAppuntamenti.filter((appuntamento) => this.creaDataAppuntamento(appuntamento) < adesso);
  }

  prossimoAppuntamento(): Appuntamento | null {
    return this.appuntamentiFuturi()[0] || null;
  }

  totaleAppuntamenti(): number {
    return this.listaAppuntamenti.length;
  }

  servizioLabel(servizio: string): string {
    return servizioByValore(servizio)?.nome || servizio;
  }

  servizioPrezzo(servizio: string): string {
    return servizioByValore(servizio)?.prezzo || 'Prezzo non disponibile';
  }

  durataAppuntamento(appuntamento: Appuntamento): number {
    return appuntamento.durataMinuti
      || appuntamento.durata_minuti
      || servizioByValore(appuntamento.servizio)?.durataMinuti
      || 30;
  }

  oraFineAppuntamento(appuntamento: Appuntamento): string {
    if (appuntamento.oraFine || appuntamento.ora_fine) {
      return appuntamento.oraFine || appuntamento.ora_fine || '';
    }

    return this.minutiInOra(this.oraInMinuti(appuntamento.ora) + this.durataAppuntamento(appuntamento));
  }

  dataLabel(appuntamento: Appuntamento): string {
    return new Intl.DateTimeFormat('it-IT', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(this.creaDataAppuntamento(appuntamento));
  }

  giornoNumero(appuntamento: Appuntamento): string {
    return new Intl.DateTimeFormat('it-IT', { day: '2-digit' }).format(this.creaDataAppuntamento(appuntamento));
  }

  meseBreve(appuntamento: Appuntamento): string {
    return new Intl.DateTimeFormat('it-IT', { month: 'short' }).format(this.creaDataAppuntamento(appuntamento));
  }

  statoAppuntamento(appuntamento: Appuntamento): string {
    return this.creaDataAppuntamento(appuntamento) >= new Date() ? 'Confermato' : 'Concluso';
  }

  private creaDataAppuntamento(appuntamento: Appuntamento): Date {
    const [anno, mese, giorno] = appuntamento.data.split('-').map(Number);
    const [ore, minuti] = appuntamento.ora.split(':').map(Number);

    return new Date(anno, mese - 1, giorno, ore, minuti, 0, 0);
  }

  private oraInMinuti(ora: string): number {
    const [ore, minuti] = ora.split(':').map(Number);

    return ore * 60 + minuti;
  }

  private minutiInOra(minutiTotali: number): string {
    const ore = String(Math.floor(minutiTotali / 60)).padStart(2, '0');
    const minuti = String(minutiTotali % 60).padStart(2, '0');

    return `${ore}:${minuti}`;
  }
}

