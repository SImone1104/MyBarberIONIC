import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonContent, IonHeader } from '@ionic/angular/standalone';
import { HeaderComponent } from '../../header/header.component';
import { FooterComponent } from '../../footer/footer.component';
import { AdminPrenotazione, AdminService, AdminServizio } from '../../services/admin';

type GiornoAgenda = {
  data: string;
  numero: string;
  isCurrentMonth: boolean;
  isToday: boolean;
};

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
  dataInizioFiltro = this.formatDateInput(new Date());
  dataFineFiltro = this.formatDateInput(new Date());
  meseVisualizzato = new Date();
  giorniCalendario: GiornoAgenda[] = [];
  giorniSettimana = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
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
    this.giorniCalendario = this.creaGiorniCalendario(this.meseVisualizzato);
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

  selezionaGiorno(data: string): void {
    if (this.intervalloSingolo() || data < this.dataInizioFiltro) {
      this.dataInizioFiltro = data;
      this.dataFineFiltro = data;
    } else {
      this.dataFineFiltro = data;
    }

    this.caricaAgenda();
  }

  aggiornaDataInizio(event: Event): void {
    const data = (event.target as HTMLInputElement).value;

    if (!data) {
      return;
    }

    this.dataInizioFiltro = data;

    if (this.dataFineFiltro < data) {
      this.dataFineFiltro = data;
    }

    this.meseVisualizzato = this.parseDateInput(data);
    this.giorniCalendario = this.creaGiorniCalendario(this.meseVisualizzato);
    this.caricaAgenda();
  }

  aggiornaDataFine(event: Event): void {
    const data = (event.target as HTMLInputElement).value;

    if (!data) {
      return;
    }

    this.dataFineFiltro = data < this.dataInizioFiltro ? this.dataInizioFiltro : data;
    this.caricaAgenda();
  }

  cambiaMese(direzione: number): void {
    this.meseVisualizzato = new Date(
      this.meseVisualizzato.getFullYear(),
      this.meseVisualizzato.getMonth() + direzione,
      1
    );
    this.giorniCalendario = this.creaGiorniCalendario(this.meseVisualizzato);
  }

  selezionaPreset(giorni: number): void {
    const inizio = this.parseDateInput(this.dataInizioFiltro);
    const fine = new Date(inizio);
    fine.setDate(inizio.getDate() + giorni - 1);
    this.dataFineFiltro = this.formatDateInput(fine);
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

  meseLabel(): string {
    return new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' })
      .format(this.meseVisualizzato);
  }

  get intervalloConsideratoLabel(): string {
    if (this.intervalloSingolo()) {
      return this.formatDateLabel(this.dataInizioFiltro);
    }

    return `${this.formatDateLabel(this.dataInizioFiltro)} - ${this.formatDateLabel(this.dataFineFiltro)}`;
  }

  appuntamentiDelGiorno(data: string): number {
    return this.appuntamenti.filter((app) => app.data === data && this.appuntamentoConfermato(app)).length;
  }

  appuntamentiDaRiprogrammareDelGiorno(data: string): number {
    return this.appuntamenti.filter((app) => app.data === data && app.stato === 'da_riprogrammare').length;
  }

  appuntamentiConfermatiPeriodo(): number {
    return this.appuntamenti.filter((app) => this.appuntamentoConfermato(app)).length;
  }

  appuntamentiDaRiprogrammarePeriodo(): number {
    return this.appuntamenti.filter((app) => app.stato === 'da_riprogrammare').length;
  }

  isInizioIntervallo(data: string): boolean {
    return data === this.dataInizioFiltro;
  }

  isFineIntervallo(data: string): boolean {
    return data === this.dataFineFiltro;
  }

  isNelIntervallo(data: string): boolean {
    return data >= this.dataInizioFiltro && data <= this.dataFineFiltro;
  }

  private intervalloSingolo(): boolean {
    return this.dataInizioFiltro === this.dataFineFiltro;
  }

  private appuntamentoConfermato(appuntamento: AdminPrenotazione): boolean {
    return (appuntamento.stato || 'confermata') === 'confermata';
  }

  private mostraMessaggio(messaggio: string, tipo: 'success' | 'error'): void {
    this.messaggio = messaggio;
    this.messaggioTipo = tipo;
  }

  private parametriPeriodo(): Record<string, string> {
    if (this.intervalloSingolo()) {
      return { data: this.dataInizioFiltro };
    }

    return { da: this.dataInizioFiltro, a: this.dataFineFiltro };
  }

  private creaGiorniCalendario(meseCorrente: Date): GiornoAgenda[] {
    const anno = meseCorrente.getFullYear();
    const mese = meseCorrente.getMonth();
    const primoGiornoMese = new Date(anno, mese, 1);
    const ultimoGiornoMese = new Date(anno, mese + 1, 0);
    const offsetInizio = (primoGiornoMese.getDay() + 6) % 7;
    const giorniDaMostrare = Math.ceil((offsetInizio + ultimoGiornoMese.getDate()) / 7) * 7;
    const dataInizioCalendario = new Date(anno, mese, 1 - offsetInizio);

    return Array.from({ length: giorniDaMostrare }, (_, index) => {
      const data = new Date(dataInizioCalendario);
      data.setDate(dataInizioCalendario.getDate() + index);
      const dataFormattata = this.formatDateInput(data);

      return {
        data: dataFormattata,
        numero: String(data.getDate()),
        isCurrentMonth: data.getMonth() === mese,
        isToday: dataFormattata === this.formatDateInput(new Date())
      };
    });
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

  private formatDateLabel(data: string): string {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(this.parseDateInput(data));
  }
}
