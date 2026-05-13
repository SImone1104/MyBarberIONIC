import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonContent, IonHeader } from '@ionic/angular/standalone';
import { HeaderComponent } from '../../header/header.component';
import { FooterComponent } from '../../footer/footer.component';
import { AdminPrenotazione, AdminService, AdminServizio } from '../../services/admin';

type PeriodoAgenda = 'giorno' | 'settimana' | 'mese';

@Component({
  selector: 'app-barbiere-agenda',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, RouterLinkActive, IonContent, IonHeader, HeaderComponent, FooterComponent],
  templateUrl: './agenda.page.html',
  styleUrls: ['../barbiere-admin.scss']
})
export class BarbiereAgendaPage implements OnInit {
  appuntamenti: AdminPrenotazione[] = [];
  servizi: AdminServizio[] = [];
  periodo: PeriodoAgenda = 'giorno';
  dataFiltro = this.formatDateInput(new Date());
  modificaId: number | null = null;
  messaggio = '';
  messaggioTipo: 'success' | 'error' = 'success';
  isLoading = false;

  modificaForm = this.formBuilder.group({
    data: ['', Validators.required],
    ora: ['', Validators.required],
    servizio: ['', Validators.required],
    note: ['']
  });

  constructor(
    private adminService: AdminService,
    private formBuilder: FormBuilder
  ) {}

  ngOnInit(): void {
    this.caricaServizi();
  }

  ionViewWillEnter(): void {
    this.caricaAgenda();
  }

  caricaServizi(): void {
    this.adminService.getServizi().subscribe({
      next: (servizi) => this.servizi = servizi.filter((servizio) => servizio.attivo),
      error: (err) => console.error('Errore servizi agenda:', err)
    });
  }

  cambiaPeriodo(periodo: PeriodoAgenda): void {
    this.periodo = periodo;
    this.caricaAgenda();
  }

  aggiornaData(event: Event): void {
    this.dataFiltro = (event.target as HTMLInputElement).value;
    this.caricaAgenda();
  }

  caricaAgenda(): void {
    this.isLoading = true;
    this.adminService.getPrenotazioni(this.parametriPeriodo()).subscribe({
      next: (data) => {
        this.appuntamenti = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Errore caricamento agenda:', err);
        this.isLoading = false;
        this.mostraMessaggio('Non riesco a caricare l agenda.', 'error');
      }
    });
  }

  iniziaModifica(appuntamento: AdminPrenotazione): void {
    this.modificaId = appuntamento.id;
    this.modificaForm.setValue({
      data: appuntamento.data,
      ora: appuntamento.ora,
      servizio: appuntamento.servizio,
      note: appuntamento.note || ''
    });
  }

  annullaModifica(): void {
    this.modificaId = null;
    this.modificaForm.reset();
  }

  salvaModifica(): void {
    if (!this.modificaId || this.modificaForm.invalid) {
      return;
    }

    this.adminService.updatePrenotazione(this.modificaId, this.modificaForm.value).subscribe({
      next: () => {
        this.mostraMessaggio('Prenotazione aggiornata.', 'success');
        this.annullaModifica();
        this.caricaAgenda();
      },
      error: (err) => {
        const msg = err.error?.message || 'Aggiornamento non riuscito.';
        this.mostraMessaggio(msg, 'error');
      }
    });
  }

  eliminaPrenotazione(id: number): void {
    if (!confirm('Eliminare questa prenotazione?')) {
      return;
    }

    this.adminService.deletePrenotazione(id).subscribe({
      next: () => {
        this.mostraMessaggio('Prenotazione eliminata.', 'success');
        this.caricaAgenda();
      },
      error: () => this.mostraMessaggio('Eliminazione non riuscita.', 'error')
    });
  }

  isOggi(appuntamento: AdminPrenotazione): boolean {
    return appuntamento.data === this.formatDateInput(new Date());
  }

  euro(value: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
  }

  dataLabel(appuntamento: AdminPrenotazione): string {
    return new Intl.DateTimeFormat('it-IT', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(this.parseDateInput(appuntamento.data));
  }

  private mostraMessaggio(messaggio: string, tipo: 'success' | 'error'): void {
    this.messaggio = messaggio;
    this.messaggioTipo = tipo;
  }

  private parametriPeriodo(): Record<string, string> {
    const data = this.parseDateInput(this.dataFiltro);

    if (this.periodo === 'giorno') {
      return { data: this.dataFiltro };
    }

    const fine = new Date(data);

    if (this.periodo === 'settimana') {
      fine.setDate(data.getDate() + 7);
      return { da: this.dataFiltro, a: this.formatDateInput(fine) };
    }

    fine.setDate(data.getDate() + 30);
    return { da: this.dataFiltro, a: this.formatDateInput(fine) };
  }

  private formatDateInput(data: Date): string {
    const anno = data.getFullYear();
    const mese = String(data.getMonth() + 1).padStart(2, '0');
    const giorno = String(data.getDate()).padStart(2, '0');
    return `${anno}-${mese}-${giorno}`;
  }

  private parseDateInput(data: string): Date {
    const [anno, mese, giorno] = data.split('-').map(Number);
    return new Date(anno, mese - 1, giorno);
  }
}
