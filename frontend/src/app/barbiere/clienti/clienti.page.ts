import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonContent, IonHeader } from '@ionic/angular/standalone';
import { HeaderComponent } from '../../header/header.component';
import { FooterComponent } from '../../footer/footer.component';
import { AdminCliente, AdminPrenotazione, AdminService } from '../../services/admin';

@Component({
  selector: 'app-barbiere-clienti',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IonContent, IonHeader, HeaderComponent, FooterComponent],
  templateUrl: './clienti.page.html',
  styleUrls: ['../barbiere-admin.scss']
})
export class BarbiereClientiPage implements OnInit {
  clienti: AdminCliente[] = [];
  clienteSelezionato: AdminCliente | null = null;
  storico: AdminPrenotazione[] = [];
  clientiDaRiprogrammare = new Set<number>();
  ricerca = '';
  isLoading = false;

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {}

  ionViewWillEnter(): void {
    this.caricaClienti();
    this.caricaClientiDaRiprogrammare();

    if (this.clienteSelezionato) {
      this.ricaricaClienteSelezionato();
    }
  }

  aggiornaRicerca(event: Event): void {
    this.ricerca = (event.target as HTMLInputElement).value;
    this.caricaClienti();
  }

  caricaClienti(): void {
    this.isLoading = true;
    this.adminService.getClienti(this.ricerca).subscribe({
      next: (clienti) => {
        this.clienti = clienti;
        this.ordinaClienti();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Errore clienti:', err);
        this.isLoading = false;
      }
    });
  }

  caricaClientiDaRiprogrammare(): void {
    this.adminService.getPrenotazioni().subscribe({
      next: (appuntamenti) => {
        this.clientiDaRiprogrammare = new Set(
          appuntamenti
            .filter((appuntamento) => appuntamento.stato === 'da_riprogrammare')
            .map((appuntamento) => appuntamento.user_id)
        );
        this.ordinaClienti();
      },
      error: (err) => console.error('Errore clienti da riprogrammare:', err)
    });
  }

  selezionaCliente(cliente: AdminCliente): void {
    this.adminService.getCliente(cliente.id).subscribe({
      next: (dettaglio) => {
        this.clienteSelezionato = dettaglio.cliente;
        this.storico = dettaglio.prenotazioni;
      },
      error: (err) => console.error('Errore dettaglio cliente:', err)
    });
  }

  private ricaricaClienteSelezionato(): void {
    const cliente = this.clienteSelezionato;

    if (!cliente) {
      return;
    }

    this.selezionaCliente(cliente);
  }

  ultimoAppuntamento(cliente: AdminCliente): string {
    if (!cliente.ultimo_appuntamento) {
      return 'Mai';
    }

    return cliente.ultimo_appuntamento;
  }

  deveRiprogrammare(cliente: AdminCliente): boolean {
    return this.clientiDaRiprogrammare.has(cliente.id);
  }

  private ordinaClienti(): void {
    this.clienti = [...this.clienti].sort((a, b) => {
      const prioritaA = this.deveRiprogrammare(a) ? 0 : 1;
      const prioritaB = this.deveRiprogrammare(b) ? 0 : 1;

      if (prioritaA !== prioritaB) {
        return prioritaA - prioritaB;
      }

      return `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it-IT');
    });
  }

  dataLabel(appuntamento: AdminPrenotazione): string {
    const [anno, mese, giorno] = appuntamento.data.split('-').map(Number);
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(new Date(anno, mese - 1, giorno));
  }

  euro(value: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
  }
}
