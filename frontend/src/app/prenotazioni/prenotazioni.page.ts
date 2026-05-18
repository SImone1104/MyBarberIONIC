import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { AuthService } from '../services/auth'; // <--- IMPORTA IL SERVIZIO
import { SERVIZI_OFFERTI, ServizioOfferto } from '../shared/servizi';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonMenuButton,
  IonButton, IonIcon, IonSpinner 
} from '@ionic/angular/standalone';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';

// Rappresenta un singolo giorno mostrato nel calendario personalizzato.
type GiornoCalendario = {
  data: string;
  numero: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  disabled: boolean;
};

type SlotOccupato = {
  ora: string;
  oraFine: string;
  servizio?: string;
  durataMinuti?: number;
};

type SlotOrario = {
  inizio: string;
  fine: string;
};

@Component({
  selector: 'app-prenotazioni',
  templateUrl: './prenotazioni.page.html',
  styleUrls: ['./prenotazioni.page.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule,IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonMenuButton,
    IonButton, IonIcon, IonSpinner,HeaderComponent,FooterComponent]
})
export class PrenotazioniPage implements OnInit, OnDestroy {
  // Form principale: contiene data, ora, servizio e note della prenotazione.
  prenotazioneForm!: FormGroup;

  // Messaggio mostrato dopo salvataggio o errore.
  messaggio = '';
  messaggioTipo: 'success' | 'error' | 'info' = 'info';

  // Intervalli gia occupati nella data selezionata: servono per disabilitare gli slot che si sovrappongono.
  slotOccupati: SlotOccupato[] = [];

  // Giorni renderizzati nella griglia calendario.

  // Indica che il sistema sta caricando gli slot occupati della data selezionata.
  // Finche e true, gli slot restano disabilitati per evitare che sembrino liberi per errore.
  isLoadingOrari = false;
  erroreCaricamentoOrari = false;
  isRicercaRapida = false;

  // Contatore anti-race-condition: ogni richiesta agli orari ha un id progressivo.
  // Se una risposta vecchia arriva dopo una risposta nuova, viene ignorata.
  private richiestaOrariId = 0;
  private timeoutMessaggioId: ReturnType<typeof setTimeout> | null = null;
  private orariSub?: Subscription;

  giorniCalendario: GiornoCalendario[] = [];

  // Mese attualmente visibile nel calendario.
  meseVisualizzato = new Date();

  // Intestazioni della settimana mostrate nel calendario.
  giorniSettimana = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  // Fasce di apertura reali del salone. Uno slot lungo deve stare interamente dentro una di queste finestre.
  finestreApertura = [
    { inizio: '09:00', fine: '13:00' },
    { inizio: '15:00', fine: '19:00' }
  ];
  

  // Le partenze sono ogni 30 minuti, mentre la durata cambia in base al servizio.
  slotStepMinuti = 30;

  // Servizi mostrati come card cliccabili al posto del select classico.
  servizi: ServizioOfferto[] = SERVIZI_OFFERTI;

  // Prima data prenotabile: impedisce di selezionare giorni passati.
  dataMinima = this.formatDateInput(new Date());
  prenotazioneDaRiprogrammareId: number | null = null;

  constructor(
    private formBuilder: FormBuilder, 
    private authService: AuthService, // <--- INIETTA IL SERVIZIO
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {
    // Definizione dei controlli e dei campi obbligatori del form.
    this.prenotazioneForm = this.formBuilder.group({
      data: ['', Validators.required],
      ora: ['', Validators.required],
      servizio: ['', Validators.required],
      note: ['']
    });
  }

  ngOnInit() {
    // All'apertura della pagina inizializza calendario e data odierna.
    this.giorniCalendario = this.creaGiorniCalendario(this.meseVisualizzato);
    this.caricaParametriRiprogrammazione();
    this.caricaServizi();
  }

  ngOnDestroy(): void {
    this.orariSub?.unsubscribe();

    if (this.timeoutMessaggioId) {
      clearTimeout(this.timeoutMessaggioId);
    }
  }

  private caricaParametriRiprogrammazione() {
    const riprenota = Number(this.route.snapshot.queryParamMap.get('riprenota'));
    this.prenotazioneDaRiprogrammareId = Number.isFinite(riprenota) && riprenota > 0 ? riprenota : null;
  }

  private caricaServizi() {
    this.authService.getServiziDisponibili().subscribe({
      next: (servizi) => {
        if (servizi.length > 0) {
          this.servizi = servizi;
        }

        this.applicaServizioDaHome();
      },
      error: (err) => {
        console.error('Errore caricamento servizi:', err);
        this.applicaServizioDaHome();
      }
    });
  }

  private applicaServizioDaHome() {
    const servizio = this.route.snapshot.queryParamMap.get('servizio');

    if (servizio && this.servizioByValore(servizio)) {
      this.prenotazioneForm.patchValue({ servizio, ora: '' });
      this.prenotaPrimaPossibile();
      return;
    }

    this.selezionaData(this.dataMinima);
  }

  private async prenotaPrimaPossibile() {
    const servizio = this.servizioSelezionato();

    if (!this.servizioByValore(servizio)) {
      this.selezionaData(this.dataMinima);
      return;
    }

    const richiestaCorrente = ++this.richiestaOrariId;
    this.isRicercaRapida = true;
    this.isLoadingOrari = true;
    this.erroreCaricamentoOrari = false;
    this.mostraMessaggio('Sto cercando il primo slot disponibile per il servizio scelto...', 'info');
    this.cdr.detectChanges();

    try {
      for (let giorniDaOggi = 0; giorniDaOggi < 30; giorniDaOggi++) {
        if (richiestaCorrente !== this.richiestaOrariId) {
          return;
        }

        const data = this.aggiungiGiorni(this.dataMinima, giorniDaOggi);
        this.prenotazioneForm.patchValue({ data, ora: '' });
        this.meseVisualizzato = this.parseDateInput(data);
        this.giorniCalendario = this.creaGiorniCalendario(this.meseVisualizzato);

        const orari = await firstValueFrom(this.authService.getOrariOccupati(data));

        if (richiestaCorrente !== this.richiestaOrariId) {
          return;
        }

        this.slotOccupati = this.normalizzaSlotOccupati(orari);
        this.isLoadingOrari = false;
        this.erroreCaricamentoOrari = false;

        const primoSlotLibero = this.slotOrari().find((slot) => !this.slotNonDisponibile(slot.inizio));

        if (primoSlotLibero) {
          this.prenotazioneForm.patchValue({ ora: primoSlotLibero.inizio });
          this.mostraMessaggio('Ho selezionato il primo slot disponibile. Controlla i dettagli e conferma la prenotazione.', 'info');
          this.isRicercaRapida = false;
          this.cdr.detectChanges();
          this.pulisciMessaggioDopo(4000, richiestaCorrente);
          return;
        }

        this.isLoadingOrari = true;
        this.cdr.detectChanges();
      }

      this.mostraMessaggio('Non ho trovato slot disponibili nei prossimi 30 giorni. Prova a scegliere manualmente una data.', 'error');
      this.selezionaData(this.dataMinima);
    } catch (err) {
      this.slotOccupati = [];
      this.erroreCaricamentoOrari = true;
      this.mostraMessaggio('Non riesco a cercare il primo slot disponibile. Riprova o scegli manualmente data e ora.', 'error');
      console.error('Errore nella prenotazione rapida:', err);
    } finally {
      if (richiestaCorrente === this.richiestaOrariId) {
        this.isRicercaRapida = false;
        this.isLoadingOrari = false;
        this.cdr.detectChanges();
      }
    }
  }

  // Crea le celle del calendario, includendo eventuali giorni vuoti del mese precedente/successivo.
  creaGiorniCalendario(meseCorrente: Date): GiornoCalendario[] {
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
        isToday: dataFormattata === this.dataMinima,
        disabled: dataFormattata < this.dataMinima
      };
    });
  }

  // Aggiorna la data selezionata e ricarica gli orari gia occupati per quella data.
  selezionaData(data: string) {
    if (data < this.dataMinima) {
      return;
    }

    this.isRicercaRapida = false;
    this.prenotazioneForm.patchValue({ data, ora: '' });
    this.meseVisualizzato = this.parseDateInput(data);
    this.giorniCalendario = this.creaGiorniCalendario(this.meseVisualizzato);
    this.caricaOrariOccupati(data);
  }

  // Sposta il calendario al mese precedente o successivo.
  cambiaMese(direzione: number) {
    this.meseVisualizzato = new Date(
      this.meseVisualizzato.getFullYear(),
      this.meseVisualizzato.getMonth() + direzione,
      1
    );
    this.giorniCalendario = this.creaGiorniCalendario(this.meseVisualizzato);
  }

  // Sincronizza il calendario quando l'utente sceglie una data dall'input manuale.
  sincronizzaDataManuale() {
    const data = this.dataSelezionata();

    if (data) {
      this.selezionaData(data);
    }
  }

  riprovaCaricamentoOrari() {
    const data = this.dataSelezionata();

    if (data) {
      this.caricaOrariOccupati(data);
    }
  }

  // Restituisce il nome del mese visualizzato, ad esempio "maggio 2026".
  meseLabel(): string {
    return new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' })
      .format(this.meseVisualizzato);
  }

  // Se lo slot e disponibile, salva l'orario nel form.
  selezionaOra(ora: string) {
    if (!this.slotNonDisponibile(ora)) {
      this.prenotazioneForm.patchValue({ ora });
    }
  }

  // Getter usati dal template per mostrare lo stato corrente del form.
  dataSelezionata(): string {
    return this.prenotazioneForm.get('data')?.value;
  }

  oraSelezionata(): string {
    return this.prenotazioneForm.get('ora')?.value;
  }

  prenotazioneNonConfermabile(): boolean {
    const ora = this.oraSelezionata();

    return this.prenotazioneForm.invalid
      || this.isLoadingOrari
      || this.erroreCaricamentoOrari
      || (!!ora && this.slotNonDisponibile(ora));
  }

  // Salva il servizio scelto quando l'utente clicca una card.
  selezionaServizio(servizio: string) {
    this.richiestaOrariId++;
    this.isRicercaRapida = false;
    this.prenotazioneForm.patchValue({ servizio, ora: '' });

    const data = this.dataSelezionata();

    if (data) {
      this.caricaOrariOccupati(data);
    } else {
      this.isLoadingOrari = false;
    }
  }

  // Restituisce il servizio attualmente selezionato.
  servizioSelezionato(): string {
    return this.prenotazioneForm.get('servizio')?.value;
  }

  // Durata del servizio selezionato: e il dato che rende variabile la disponibilita degli slot.
  durataServizioSelezionato(): number {
    const servizio = this.servizioByValore(this.servizioSelezionato());

    return servizio?.durataMinuti || 0;
  }

  // Genera partenze ogni 30 minuti e calcola la fine in base alla durata del servizio scelto.
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
        slot.push({
          inizio: this.minutiInOra(minuti),
          fine: this.minutiInOra(minuti + durata)
        });
      }

      return slot;
    });
  }

  // Stabilisce se uno slot va disabilitato perche manca il servizio, il controllo disponibilita non e pronto,
  // e occupato, fuori orario o passato.
  slotNonDisponibile(ora: string): boolean {
    const data = this.dataSelezionata();
    const durata = this.durataServizioSelezionato();

    // Durante il caricamento della data selezionata blocchiamo tutti gli slot:
    // cosi l'utente non vede orari falsamente liberi mentre il backend risponde.
    if (this.isLoadingOrari || this.erroreCaricamentoOrari || !durata) {
      return true;
    }

    if (!this.slotDentroOrarioApertura(ora, durata)) {
      return true;
    }

    if (this.slotOccupati.some((slot) => this.intervalliSovrapposti(ora, durata, slot))) {
      return true;
    }

    if (data === this.dataMinima) {
      const adesso = new Date();
      const [ore, minuti] = ora.split(':').map(Number);
      const slot = new Date();
      slot.setHours(ore, minuti, 0, 0);

      return slot <= adesso;
    }

    return false;
  }

  // Controlla che lo slot inizi e finisca dentro la stessa finestra di apertura.
  private slotDentroOrarioApertura(ora: string, durata: number): boolean {
    const inizio = this.oraInMinuti(ora);
    const fine = inizio + durata;

    return this.finestreApertura.some((finestra) => {
      const apertura = this.oraInMinuti(finestra.inizio);
      const chiusura = this.oraInMinuti(finestra.fine);

      return inizio >= apertura && fine <= chiusura;
    });
  }

  // Due intervalli si sovrappongono quando il nuovo inizia prima della fine esistente e finisce dopo l'inizio esistente.
  private intervalliSovrapposti(ora: string, durata: number, slot: SlotOccupato): boolean {
    const nuovoInizio = this.oraInMinuti(ora);
    const nuovoFine = nuovoInizio + durata;
    const esistenteInizio = this.oraInMinuti(slot.ora);
    const esistenteFine = slot.oraFine
      ? this.oraInMinuti(slot.oraFine)
      : esistenteInizio + this.durataSlotOccupato(slot);

    return nuovoInizio < esistenteFine && nuovoFine > esistenteInizio;
  }

  private durataSlotOccupato(slot: SlotOccupato): number {
    return slot.durataMinuti || this.servizioOccupato(slot.servizio)?.durataMinuti || 30;
  }

  private servizioOccupato(servizio = '') {
    const valore = servizio.trim().toLowerCase();
    const alias: Record<string, string> = {
      'taglio classico': 'taglio',
      'cura barba': 'barba',
      'taglio + barba': 'completo',
      'taglio barba': 'completo',
      'taglio e barba': 'completo',
      'taglio + colore': 'colore',
      'taglio colore': 'colore',
      'taglio e colore': 'colore'
    };

    return this.servizioByValore(alias[valore] || valore);
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

  // Trasforma il valore tecnico del servizio in una label leggibile.
  servizioLabel(): string {
    const servizio = this.prenotazioneForm.get('servizio')?.value;

    return this.servizioByValore(servizio)?.nome || 'Da scegliere';
  }

  // Mostra il prezzo del servizio scelto nel riepilogo.
  servizioPrezzo(): string {
    const servizio = this.servizi.find((item) => item.valore === this.servizioSelezionato());

    return servizio?.prezzo || 'Prezzo';
  }

  private servizioByValore(valore: string): ServizioOfferto | undefined {
    return this.servizi.find((servizio) => servizio.valore === valore)
      || SERVIZI_OFFERTI.find((servizio) => servizio.valore === valore);
  }

  // Converte una data JavaScript nel formato yyyy-mm-dd richiesto dagli input date.
  private formatDateInput(data: Date): string {
    const anno = data.getFullYear();
    const mese = String(data.getMonth() + 1).padStart(2, '0');
    const giorno = String(data.getDate()).padStart(2, '0');

    return `${anno}-${mese}-${giorno}`;
  }

  // Converte una stringa yyyy-mm-dd in Date senza effetti di fuso orario.
  private parseDateInput(data: string): Date {
    const [anno, mese, giorno] = data.split('-').map(Number);

    return new Date(anno, mese - 1, giorno);
  }

  // Recupera dal backend gli orari occupati nella data scelta.
  caricaOrariOccupati(data: string) {
    const richiestaCorrente = ++this.richiestaOrariId;
    this.orariSub?.unsubscribe();

    // Appena cambia giorno svuotiamo gli slot occupati precedenti e mostriamo lo stato di caricamento.
    // Questo evita il bug visivo in cui, per qualche istante, gli slot del nuovo giorno sembrano liberi.
    this.slotOccupati = [];
    this.isLoadingOrari = true;
    this.erroreCaricamentoOrari = false;
    this.cdr.detectChanges();

    this.orariSub = this.authService.getOrariOccupati(data).subscribe({
      next: (orari) => {
        if (richiestaCorrente !== this.richiestaOrariId || data !== this.dataSelezionata()) {
          return;
        }

        this.slotOccupati = this.normalizzaSlotOccupati(orari);
        this.erroreCaricamentoOrari = false;
        this.isLoadingOrari = false;
        const oraSelezionata = this.oraSelezionata();

        if (oraSelezionata && this.slotNonDisponibile(oraSelezionata)) {
          this.prenotazioneForm.patchValue({ ora: '' });
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        if (richiestaCorrente !== this.richiestaOrariId) {
          return;
        }

        this.slotOccupati = [];
        this.erroreCaricamentoOrari = true;
        this.isLoadingOrari = false;
        this.cdr.detectChanges();
        console.error('Errore nel caricamento degli orari occupati:', err);
      }
    });
  }

  private normalizzaSlotOccupati(orari: any[]): SlotOccupato[] {
    return (orari || []).reduce<SlotOccupato[]>((slots, slot) => {
      if (typeof slot === 'string') {
        slots.push({ ora: slot, oraFine: '', durataMinuti: 30 });
        return slots;
      }

      if (!slot?.ora) {
        return slots;
      }

      const durataMinuti = slot.durataMinuti || slot.durata_minuti || this.servizioOccupato(slot.servizio || '')?.durataMinuti || 30;

      slots.push({
        ora: slot.ora,
        oraFine: slot.oraFine || slot.ora_fine || this.minutiInOra(this.oraInMinuti(slot.ora) + durataMinuti),
        durataMinuti,
        servizio: slot.servizio
      });

      return slots;
    }, []);
  }

  private aggiungiGiorni(data: string, giorni: number): string {
    const nuovaData = this.parseDateInput(data);
    nuovaData.setDate(nuovaData.getDate() + giorni);

    return this.formatDateInput(nuovaData);
  }

  private pulisciMessaggioDopo(millisecondi: number, richiestaCorrente: number) {
    if (this.timeoutMessaggioId) {
      clearTimeout(this.timeoutMessaggioId);
    }

    this.timeoutMessaggioId = setTimeout(() => {
      if (richiestaCorrente === this.richiestaOrariId) {
        this.nascondiMessaggio();
        this.cdr.detectChanges();
      }
    }, millisecondi);
  }

  private mostraMessaggio(messaggio: string, tipo: 'success' | 'error' | 'info') {
    if (this.timeoutMessaggioId) {
      clearTimeout(this.timeoutMessaggioId);
      this.timeoutMessaggioId = null;
    }

    this.messaggio = messaggio;
    this.messaggioTipo = tipo;
  }

  private nascondiMessaggio() {
    this.messaggio = '';
  }

  // Invia la prenotazione al backend e aggiorna la pagina dopo il salvataggio.
  onSubmit() {
    if (!this.prenotazioneNonConfermabile()) {
      const dati = this.prenotazioneForm.value;

      // CHIAMATA REALE AL DATABASE
      const riprogrammaId = this.prenotazioneDaRiprogrammareId;
      const eraRiprogrammazione = riprogrammaId !== null;
      const richiesta = eraRiprogrammazione
        ? this.authService.riprogrammaPrenotazione(riprogrammaId, dati)
        : this.authService.creaPrenotazione(dati);

      richiesta.subscribe({
        next: (res) => {
          this.mostraMessaggio('La tua prenotazione è stata registrata correttamente.', 'success');
          
          if (eraRiprogrammazione) {
            this.mostraMessaggio('La tua prenotazione e stata riprogrammata correttamente.', 'success');
          }

          this.prenotazioneDaRiprogrammareId = null;
          this.prenotazioneForm.reset({ servizio: '', data: this.dataMinima, ora: '' });
          this.meseVisualizzato = new Date();
          this.giorniCalendario = this.creaGiorniCalendario(this.meseVisualizzato);
          this.caricaOrariOccupati(this.dataMinima);
          this.pulisciMessaggioDopo(6000, this.richiestaOrariId);
        },
        error: (err) => {
          const messaggio = err.status === 409
            ? 'Questo orario si sovrappone a una prenotazione esistente. Scegli un altro slot.'
            : 'Errore nel salvataggio sul server';
          this.mostraMessaggio(messaggio, 'error');
          this.caricaOrariOccupati(dati.data);
          console.error(err);
        }
      });
    }
  }
}
