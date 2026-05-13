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
  ricerca = '';
  isLoading = false;

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {}

  ionViewWillEnter(): void {
    this.caricaClienti();

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
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Errore clienti:', err);
        this.isLoading = false;
      }
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
