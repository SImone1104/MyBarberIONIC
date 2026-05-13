import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonContent, IonHeader } from '@ionic/angular/standalone';
import { HeaderComponent } from '../../header/header.component';
import { FooterComponent } from '../../footer/footer.component';
import { AdminCliente, AdminService, AdminServizio } from '../../services/admin';
import { AuthService } from '../../services/auth';

type SlotOccupato = {
  ora: string;
  oraFine: string;
  durataMinuti?: number;
};

type SlotOrario = {
  inizio: string;
  fine: string;
};

@Component({
  selector: 'app-barbiere-nuova-prenotazione',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, RouterLinkActive, IonContent, IonHeader, HeaderComponent, FooterComponent],
  templateUrl: './nuova-prenotazione.page.html',
  styleUrls: ['../barbiere-admin.scss']
})
export class BarbiereNuovaPrenotazionePage implements OnInit {
  clienti: AdminCliente[] = [];
  servizi: AdminServizio[] = [];
  slotOccupati: SlotOccupato[] = [];
  clienteMode: 'esistente' | 'nuovo' = 'esistente';
  isLoadingOrari = false;
  isSubmitting = false;
  messaggio = '';
  messaggioTipo: 'success' | 'error' = 'success';
  private richiestaOrariId = 0;

  finestreApertura = [
    { inizio: '09:00', fine: '13:00' },
    { inizio: '15:00', fine: '19:00' }
  ];
  slotStepMinuti = 30;

  prenotazioneForm = this.formBuilder.group({
    userId: [''],
    nome: [''],
    cognome: [''],
    email: [''],
    telefono: [''],
    data: [this.formatDateInput(new Date()), Validators.required],
    servizio: ['', Validators.required],
    ora: ['', Validators.required],
    note: ['']
  });

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private formBuilder: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.prenotazioneForm.get('data')?.valueChanges.subscribe(() => {
      this.prenotazioneForm.patchValue({ ora: '' }, { emitEvent: false });
      this.caricaOrariOccupati();
    });
    this.prenotazioneForm.get('servizio')?.valueChanges.subscribe(() => {
      this.prenotazioneForm.patchValue({ ora: '' }, { emitEvent: false });
      this.caricaOrariOccupati();
    });
  }

  ionViewWillEnter(): void {
    this.caricaDatiBase();

    if (this.servizioSelezionato()) {
      this.caricaOrariOccupati();
    }
  }

  caricaDatiBase(): void {
    this.adminService.getClienti().subscribe({
      next: (clienti) => this.clienti = clienti,
      error: (err) => console.error('Errore clienti:', err)
    });

    this.adminService.getServizi().subscribe({
      next: (servizi) => {
        this.servizi = servizi.filter((servizio) => servizio.attivo);

        if (this.servizioSelezionato() && !this.durataServizioSelezionato()) {
          this.prenotazioneForm.patchValue({ servizio: '', ora: '' }, { emitEvent: false });
          this.slotOccupati = [];
        }
      },
      error: (err) => console.error('Errore servizi:', err)
    });
  }

  cambiaClienteMode(mode: 'esistente' | 'nuovo'): void {
    this.clienteMode = mode;
    this.prenotazioneForm.patchValue({ userId: '', nome: '', cognome: '', email: '', telefono: '' });
  }

  caricaOrariOccupati(): void {
    const data = this.dataSelezionata();
    const richiestaCorrente = ++this.richiestaOrariId;

    if (!data) {
      this.slotOccupati = [];
      this.isLoadingOrari = false;
      return;
    }

    this.isLoadingOrari = true;
    this.authService.getOrariOccupati(data).subscribe({
      next: (orari) => {
        if (richiestaCorrente !== this.richiestaOrariId) {
          return;
        }

        this.slotOccupati = orari.map((slot) => ({
          ora: slot.ora,
          oraFine: slot.oraFine || slot.ora_fine || '',
          durataMinuti: slot.durataMinuti || slot.durata_minuti
        }));
        this.isLoadingOrari = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (richiestaCorrente !== this.richiestaOrariId) {
          return;
        }

        console.error('Errore orari occupati admin:', err);
        this.slotOccupati = [];
        this.isLoadingOrari = false;
        this.mostraMessaggio('Non riesco a verificare gli slot.', 'error');
      }
    });
  }

  slotOrari(): SlotOrario[] {
    const durata = this.durataServizioSelezionato();

    if (!durata) {
      return [];
    }

    return this.finestreApertura.flatMap((finestra) => {
      const apertura = this.oraInMinuti(finestra.inizio);
      const ultimoInizio = this.oraInMinuti(finestra.fine) - durata;
      const slot: SlotOrario[] = [];

      for (let minuti = apertura; minuti <= ultimoInizio; minuti += this.slotStepMinuti) {
        slot.push({ inizio: this.minutiInOra(minuti), fine: this.minutiInOra(minuti + durata) });
      }

      return slot;
    });
  }

  selezionaOra(ora: string): void {
    if (!this.slotNonDisponibile(ora)) {
      this.prenotazioneForm.patchValue({ ora });
    }
  }

  slotNonDisponibile(ora: string): boolean {
    const durata = this.durataServizioSelezionato();
    const data = this.dataSelezionata();

    if (this.isLoadingOrari || !durata || !data) {
      return true;
    }

    if (this.slotOccupati.some((slot) => this.intervalliSovrapposti(ora, durata, slot))) {
      return true;
    }

    if (data === this.formatDateInput(new Date())) {
      const [ore, minuti] = ora.split(':').map(Number);
      const slot = new Date();
      slot.setHours(ore, minuti, 0, 0);
      return slot <= new Date();
    }

    return false;
  }

  onSubmit(): void {
    if (this.prenotazioneForm.invalid || this.isSubmitting) {
      return;
    }

    if (this.clienteMode === 'esistente' && !this.prenotazioneForm.get('userId')?.value) {
      this.mostraMessaggio('Seleziona un cliente esistente.', 'error');
      return;
    }

    if (this.clienteMode === 'nuovo' && !this.nuovoClienteValido()) {
      this.mostraMessaggio('Completa nome, cognome, email e telefono del nuovo cliente.', 'error');
      return;
    }

    const value = this.prenotazioneForm.value;

    if (this.slotNonDisponibile(value.ora || '')) {
      this.mostraMessaggio('Scegli uno slot ancora disponibile.', 'error');
      return;
    }

    const payload = this.clienteMode === 'esistente'
      ? {
        userId: Number(value.userId),
        data: value.data,
        ora: value.ora,
        servizio: value.servizio,
        note: value.note
      }
      : {
        cliente: {
          nome: value.nome,
          cognome: value.cognome,
          email: value.email,
          telefono: value.telefono
        },
        data: value.data,
        ora: value.ora,
        servizio: value.servizio,
        note: value.note
      };

    this.isSubmitting = true;
    this.adminService.creaPrenotazione(payload).subscribe({
      next: () => {
        this.mostraMessaggio('Prenotazione inserita in agenda.', 'success');
        this.isSubmitting = false;

        if (this.clienteMode === 'nuovo') {
          this.clienteMode = 'esistente';
          this.prenotazioneForm.patchValue({
            userId: '',
            nome: '',
            cognome: '',
            email: '',
            telefono: '',
            ora: '',
            note: ''
          });
          this.caricaDatiBase();
        } else {
          this.prenotazioneForm.patchValue({ ora: '', note: '' });
        }

        this.caricaOrariOccupati();
      },
      error: (err) => {
        this.isSubmitting = false;
        const msg = err.error?.message || 'Prenotazione non salvata.';
        this.mostraMessaggio(msg, 'error');
      }
    });
  }

  oraSelezionata(): string {
    return this.prenotazioneForm.get('ora')?.value || '';
  }

  dataSelezionata(): string {
    return this.prenotazioneForm.get('data')?.value || '';
  }

  servizioSelezionato(): string {
    return this.prenotazioneForm.get('servizio')?.value || '';
  }

  servizioLabel(): string {
    const servizio = this.servizi.find((item) => item.valore === this.servizioSelezionato());
    return servizio?.nome || 'Da scegliere';
  }

  durataServizioSelezionato(): number {
    const servizio = this.servizi.find((item) => item.valore === this.servizioSelezionato());
    return servizio?.durataMinuti || 0;
  }

  private nuovoClienteValido(): boolean {
    return ['nome', 'cognome', 'email', 'telefono'].every((campo) => !!this.prenotazioneForm.get(campo)?.value);
  }

  private intervalliSovrapposti(ora: string, durata: number, slot: SlotOccupato): boolean {
    const nuovoInizio = this.oraInMinuti(ora);
    const nuovoFine = nuovoInizio + durata;
    const esistenteInizio = this.oraInMinuti(slot.ora);
    const esistenteFine = slot.oraFine
      ? this.oraInMinuti(slot.oraFine)
      : esistenteInizio + (slot.durataMinuti || 30);

    return nuovoInizio < esistenteFine && nuovoFine > esistenteInizio;
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

  private formatDateInput(data: Date): string {
    const anno = data.getFullYear();
    const mese = String(data.getMonth() + 1).padStart(2, '0');
    const giorno = String(data.getDate()).padStart(2, '0');
    return `${anno}-${mese}-${giorno}`;
  }

  private mostraMessaggio(messaggio: string, tipo: 'success' | 'error'): void {
    this.messaggio = messaggio;
    this.messaggioTipo = tipo;
  }
}
