import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonContent, IonHeader } from '@ionic/angular/standalone';
import { HeaderComponent } from '../../header/header.component';
import { FooterComponent } from '../../footer/footer.component';
import { AdminService, AdminStatistiche } from '../../services/admin';

@Component({
  selector: 'app-barbiere-statistiche',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IonContent, IonHeader, HeaderComponent, FooterComponent],
  templateUrl: './statistiche.page.html',
  styleUrls: ['../barbiere-admin.scss']
})
export class BarbiereStatistichePage implements OnInit {
  statistiche: AdminStatistiche | null = null;
  isLoading = true;

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {}

  ionViewWillEnter(): void {
    this.caricaStatistiche();
  }

  caricaStatistiche(): void {
    this.isLoading = true;
    this.adminService.getStatistiche().subscribe({
      next: (statistiche) => {
        this.statistiche = statistiche;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Errore statistiche:', err);
        this.isLoading = false;
      }
    });
  }

  euro(value: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value || 0);
  }

  maxServizi(): number {
    return Math.max(...(this.statistiche?.serviziRichiesti.map((item) => item.totale) || [1]), 1);
  }

  maxAndamento(): number {
    return Math.max(...(this.statistiche?.andamento.map((item) => item.appuntamenti) || [1]), 1);
  }

  percent(value: number, max: number): number {
    return Math.max(4, Math.round((value / max) * 100));
  }

  dataBreve(data: string): string {
    const [anno, mese, giorno] = data.split('-').map(Number);
    return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' }).format(new Date(anno, mese - 1, giorno));
  }

  giornoSettimana(data: string): string {
    const [anno, mese, giorno] = data.split('-').map(Number);
    return new Intl.DateTimeFormat('it-IT', { weekday: 'long' })
      .format(new Date(anno, mese - 1, giorno));
  }
}
