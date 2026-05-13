import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { forkJoin } from 'rxjs';
import { IonContent, IonHeader } from '@ionic/angular/standalone';
import { HeaderComponent } from '../../header/header.component';
import { FooterComponent } from '../../footer/footer.component';
import { AdminPrenotazione, AdminService, AdminStatistiche } from '../../services/admin';

@Component({
  selector: 'app-barbiere-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IonContent, IonHeader, HeaderComponent, FooterComponent],
  templateUrl: './dashboard.page.html',
  styleUrls: ['../barbiere-admin.scss']
})
export class BarbiereDashboardPage implements OnInit {
  statistiche: AdminStatistiche | null = null;
  appuntamenti: AdminPrenotazione[] = [];
  isLoading = true;

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {}

  ionViewWillEnter(): void {
    this.caricaDashboard();
  }

  caricaDashboard(): void {
    this.isLoading = true;
    forkJoin({
      statistiche: this.adminService.getStatistiche(),
      appuntamenti: this.adminService.getPrenotazioni({ da: this.oggiInput() })
    }).subscribe({
      next: ({ statistiche, appuntamenti }) => {
        this.statistiche = statistiche;
        this.appuntamenti = appuntamenti
          .filter((appuntamento) => this.dataOra(appuntamento) >= new Date() && appuntamento.stato !== 'da_riprogrammare')
          .slice(0, 8);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Errore caricamento dashboard admin:', err);
        this.isLoading = false;
      }
    });
  }

  appuntamentiOggi(): AdminPrenotazione[] {
    return this.appuntamenti.filter((appuntamento) => appuntamento.data === this.oggiInput());
  }

  prossimoAppuntamento(): AdminPrenotazione | null {
    return this.appuntamenti[0] || null;
  }

  servizioTop(): string {
    return this.statistiche?.serviziRichiesti[0]?.nome || 'Nessun dato';
  }

  incassoOggi(): string {
    return this.euro(this.statistiche?.oggi.incasso || 0);
  }

  euro(value: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
  }

  dataLabel(appuntamento: AdminPrenotazione): string {
    return new Intl.DateTimeFormat('it-IT', {
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    }).format(this.dataOra(appuntamento));
  }

  dataOraLabel(appuntamento: AdminPrenotazione): string {
    return `${this.dataLabel(appuntamento)} · ${appuntamento.ora}-${appuntamento.oraFine}`;
  }

  private oggiInput(): string {
    const oggi = new Date();
    const anno = oggi.getFullYear();
    const mese = String(oggi.getMonth() + 1).padStart(2, '0');
    const giorno = String(oggi.getDate()).padStart(2, '0');
    return `${anno}-${mese}-${giorno}`;
  }

  private dataOra(appuntamento: AdminPrenotazione): Date {
    const [anno, mese, giorno] = appuntamento.data.split('-').map(Number);
    const [ore, minuti] = appuntamento.ora.split(':').map(Number);
    return new Date(anno, mese - 1, giorno, ore, minuti, 0, 0);
  }
}
