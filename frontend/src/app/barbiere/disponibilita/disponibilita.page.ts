import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonContent, IonHeader } from '@ionic/angular/standalone';
import { HeaderComponent } from '../../header/header.component';
import { FooterComponent } from '../../footer/footer.component';
import { AdminBloccoDisponibilita, AdminPrenotazione, AdminRegolaDisponibilita, AdminService } from '../../services/admin';

type AzioneInAttesa = {
  tipo: 'blocco' | 'ricorrente';
  payload: Record<string, unknown>;
};

type BloccoDisponibilitaVisibile = AdminBloccoDisponibilita & {
  ids?: number[];
};

@Component({
  selector: 'app-barbiere-disponibilita',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, RouterLinkActive, IonContent, IonHeader, HeaderComponent, FooterComponent],
  templateUrl: './disponibilita.page.html',
  styleUrls: ['../barbiere-admin.scss']
})
export class BarbiereDisponibilitaPage implements OnInit {
  blocchi: AdminBloccoDisponibilita[] = [];
  regoleRicorrenti: AdminRegolaDisponibilita[] = [];
  conflitti: AdminPrenotazione[] = [];
  private azioneInAttesa: AzioneInAttesa | null = null;
  messaggio = '';
  messaggioTipo: 'success' | 'error' = 'success';

  giorniSettimana = [
    { valore: 1, label: 'Lunedi' },
    { valore: 2, label: 'Martedi' },
    { valore: 3, label: 'Mercoledi' },
    { valore: 4, label: 'Giovedi' },
    { valore: 5, label: 'Venerdi' },
    { valore: 6, label: 'Sabato' },
    { valore: 0, label: 'Domenica' }
  ];

  bloccoForm = this.formBuilder.group({
    data: [this.formatDateInput(new Date()), Validators.required],
    dataFine: [this.formatDateInput(new Date()), Validators.required],
    interaGiornata: [false],
    oraInizio: ['09:00', Validators.required],
    oraFine: ['09:30', Validators.required],
    motivo: ['']
  });

  regolaForm = this.formBuilder.group({
    giornoSettimana: [1, Validators.required],
    interaGiornata: [true],
    oraInizio: ['09:00', Validators.required],
    oraFine: ['19:00', Validators.required],
    motivo: ['Chiusura settimanale'],
    validaDal: [this.formatDateInput(new Date()), Validators.required],
    validaAl: ['']
  });

  constructor(
    private adminService: AdminService,
    private formBuilder: FormBuilder
  ) {}

  ngOnInit(): void {
    this.bloccoForm.get('data')?.valueChanges.subscribe((data) => {
      const dataFine = this.bloccoForm.get('dataFine')?.value;

      if (data && (!dataFine || dataFine < data)) {
        this.bloccoForm.patchValue({ dataFine: data }, { emitEvent: false });
      }
    });

    this.bloccoForm.get('interaGiornata')?.valueChanges.subscribe((interaGiornata) => {
      this.sincronizzaOrariInteraGiornata(!!interaGiornata, 'blocco');
    });

    this.regolaForm.get('interaGiornata')?.valueChanges.subscribe((interaGiornata) => {
      this.sincronizzaOrariInteraGiornata(!!interaGiornata, 'regola');
    });

    this.sincronizzaOrariInteraGiornata(!!this.bloccoForm.get('interaGiornata')?.value, 'blocco');
    this.sincronizzaOrariInteraGiornata(!!this.regolaForm.get('interaGiornata')?.value, 'regola');
  }

  ionViewWillEnter(): void {
    this.caricaDisponibilita();
  }

  caricaDisponibilita(): void {
    this.caricaBlocchi();
    this.caricaRegoleRicorrenti();
  }

  caricaBlocchi(): void {
    this.adminService.getDisponibilita().subscribe({
      next: (blocchi) => this.blocchi = blocchi,
      error: (err) => {
        console.error('Errore blocchi disponibilita:', err);
        this.mostraMessaggio('Non riesco a caricare i blocchi.', 'error');
      }
    });
  }

  caricaRegoleRicorrenti(): void {
    this.adminService.getDisponibilitaRicorrente().subscribe({
      next: (regole) => this.regoleRicorrenti = regole,
      error: (err) => {
        console.error('Errore regole ricorrenti:', err);
        this.mostraMessaggio('Non riesco a caricare le chiusure ricorrenti.', 'error');
      }
    });
  }

  blocchiVisibili(): BloccoDisponibilitaVisibile[] {
    const gruppi = new Map<string, AdminBloccoDisponibilita[]>();

    for (const blocco of this.blocchi) {
      const chiave = `${blocco.data}|${blocco.motivo || ''}`;
      gruppi.set(chiave, [...(gruppi.get(chiave) || []), blocco]);
    }

    const aggregati: BloccoDisponibilitaVisibile[] = [];

    for (const blocchiGiorno of gruppi.values()) {
      if (this.copreInteraGiornataConRegole(blocchiGiorno)) {
        const primo = blocchiGiorno[0];

        aggregati.push({
          ...primo,
          ids: blocchiGiorno.map((blocco) => blocco.id),
          oraInizio: '00:00',
          oraFine: '23:59',
          interaGiornata: true
        });
        continue;
      }

      aggregati.push(...blocchiGiorno);
    }

    return aggregati.sort((a, b) => {
      const dataCompare = b.data.localeCompare(a.data);
      return dataCompare || a.oraInizio.localeCompare(b.oraInizio);
    });
  }

  creaBlocco(): void {
    if (this.bloccoForm.invalid) {
      return;
    }

    const payload = this.payloadBlocco();

    this.adminService.creaDisponibilita(payload).subscribe({
      next: (response) => {
        this.pulisciConferma();
        const riepilogo = this.riepilogoDisponibilita(response);
        this.mostraMessaggio(`${response.message || 'Disponibilita aggiornata'}${riepilogo}.`, 'success');
        this.caricaBlocchi();
      },
      error: (err) => this.gestisciErroreConflitto(err, 'blocco', payload, 'Blocco non salvato.')
    });
  }

  creaRegolaRicorrente(): void {
    if (this.regolaForm.invalid) {
      return;
    }

    const payload = this.payloadRegolaRicorrente();

    this.adminService.creaDisponibilitaRicorrente(payload).subscribe({
      next: (response) => {
        this.pulisciConferma();
        this.mostraMessaggio(response.message || 'Regola settimanale salvata.', 'success');
        this.caricaRegoleRicorrenti();
      },
      error: (err) => this.gestisciErroreConflitto(err, 'ricorrente', payload, 'Regola settimanale non salvata.')
    });
  }

  confermaRiprogrammazione(): void {
    if (!this.azioneInAttesa) {
      return;
    }

    const payload = {
      ...this.azioneInAttesa.payload,
      confermaRiprogrammazione: true
    };

    const richiesta = this.azioneInAttesa.tipo === 'ricorrente'
      ? this.adminService.creaDisponibilitaRicorrente(payload)
      : this.adminService.creaDisponibilita(payload);

    richiesta.subscribe({
      next: (response) => {
        const tipo = this.azioneInAttesa?.tipo;
        this.pulisciConferma();
        this.mostraMessaggio(response.message || 'Clienti notificati per riprogrammare.', 'success');
        this.caricaBlocchi();

        if (tipo === 'ricorrente') {
          this.caricaRegoleRicorrenti();
        }
      },
      error: (err) => {
        const msg = err.error?.message || 'Conferma non riuscita.';
        this.mostraMessaggio(msg, 'error');
      }
    });
  }

  annullaConferma(): void {
    this.pulisciConferma();
    this.mostraMessaggio('', 'success');
  }

  eliminaBlocco(blocco: BloccoDisponibilitaVisibile): void {
    const ids = blocco.ids?.length ? blocco.ids : [blocco.id];
    let completati = 0;

    for (const id of ids) {
      this.adminService.deleteDisponibilita(id).subscribe({
        next: () => {
          completati += 1;

          if (completati === ids.length) {
            this.mostraMessaggio(ids.length > 1 ? 'Blocchi rimossi.' : 'Blocco rimosso.', 'success');
            this.caricaBlocchi();
          }
        },
        error: () => this.mostraMessaggio('Rimozione non riuscita.', 'error')
      });
    }
  }

  eliminaRegolaRicorrente(id: number): void {
    this.adminService.deleteDisponibilitaRicorrente(id).subscribe({
      next: () => {
        this.mostraMessaggio('Regola settimanale rimossa.', 'success');
        this.caricaRegoleRicorrenti();
      },
      error: () => this.mostraMessaggio('Rimozione regola non riuscita.', 'error')
    });
  }

  dataLabel(data: string): string {
    const [anno, mese, giorno] = data.split('-').map(Number);
    return new Intl.DateTimeFormat('it-IT', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(new Date(anno, mese - 1, giorno));
  }

  giornoLabel(giornoSettimana: number): string {
    return this.giorniSettimana.find((giorno) => giorno.valore === giornoSettimana)?.label || 'Giorno';
  }

  regolaValiditaLabel(regola: AdminRegolaDisponibilita): string {
    if (regola.validaDal && regola.validaAl) {
      return `Dal ${regola.validaDal} al ${regola.validaAl}`;
    }

    if (regola.validaDal) {
      return `Dal ${regola.validaDal}`;
    }

    return 'Sempre attiva';
  }

  clienteLabel(appuntamento: AdminPrenotazione): string {
    const nome = `${appuntamento.cliente?.nome || ''} ${appuntamento.cliente?.cognome || ''}`.trim();
    return nome || appuntamento.cliente?.email || 'Cliente';
  }

  private payloadBlocco(): Record<string, unknown> {
    const value = this.bloccoForm.getRawValue();

    return {
      ...value,
      dataFine: value.dataFine || value.data
    };
  }

  private payloadRegolaRicorrente(): Record<string, unknown> {
    const value = this.regolaForm.getRawValue();

    return {
      ...value,
      validaAl: value.validaAl || ''
    };
  }

  private gestisciErroreConflitto(err: any, tipo: 'blocco' | 'ricorrente', payload: Record<string, unknown>, fallback: string): void {
    if (err.status === 409 && err.error?.requiresConfirmation) {
      this.conflitti = err.error.conflitti || [];
      this.azioneInAttesa = { tipo, payload };
      this.mostraMessaggio(err.error.message || 'Ci sono prenotazioni da riprogrammare.', 'error');
      return;
    }

    this.pulisciConferma();

    if (tipo === 'ricorrente' && err.status === 404) {
      this.mostraMessaggio('Endpoint regole settimanali non disponibile: riavvia il backend aggiornato.', 'error');
      return;
    }

    const msg = err.error?.message || fallback;
    this.mostraMessaggio(msg, 'error');
  }

  private pulisciConferma(): void {
    this.conflitti = [];
    this.azioneInAttesa = null;
  }

  private copreInteraGiornataConRegole(blocchiGiorno: AdminBloccoDisponibilita[]): boolean {
    const data = blocchiGiorno[0]?.data;

    if (!data || blocchiGiorno.some((blocco) => blocco.interaGiornata)) {
      return true;
    }

    const intervalli = [
      ...blocchiGiorno.map((blocco) => ({
        inizio: this.oraInMinuti(blocco.oraInizio),
        fine: this.oraInMinuti(blocco.oraFine)
      })),
      ...this.regoleRicorrenti
        .filter((regola) => this.regolaAttivaPerData(regola, data))
        .map((regola) => ({
          inizio: regola.interaGiornata ? 0 : this.oraInMinuti(regola.oraInizio),
          fine: regola.interaGiornata ? this.oraInMinuti('23:59') : this.oraInMinuti(regola.oraFine)
        }))
    ].sort((a, b) => a.inizio - b.inizio);

    let copertoFinoA = 0;

    for (const intervallo of intervalli) {
      if (intervallo.inizio > copertoFinoA) {
        return false;
      }

      copertoFinoA = Math.max(copertoFinoA, intervallo.fine);

      if (copertoFinoA >= this.oraInMinuti('23:59')) {
        return true;
      }
    }

    return false;
  }

  private regolaAttivaPerData(regola: AdminRegolaDisponibilita, data: string): boolean {
    if (!regola.attiva || regola.giornoSettimana !== this.giornoSettimanaData(data)) {
      return false;
    }

    if (regola.validaDal && data < regola.validaDal) {
      return false;
    }

    if (regola.validaAl && data > regola.validaAl) {
      return false;
    }

    return true;
  }

  private giornoSettimanaData(data: string): number {
    const [anno, mese, giorno] = data.split('-').map(Number);
    return new Date(anno, mese - 1, giorno).getDay();
  }

  private oraInMinuti(ora: string): number {
    const [ore, minuti] = ora.split(':').map(Number);
    return ore * 60 + minuti;
  }

  private sincronizzaOrariInteraGiornata(interaGiornata: boolean, tipo: 'blocco' | 'regola'): void {
    const oraInizio = tipo === 'blocco'
      ? this.bloccoForm.get('oraInizio')
      : this.regolaForm.get('oraInizio');
    const oraFine = tipo === 'blocco'
      ? this.bloccoForm.get('oraFine')
      : this.regolaForm.get('oraFine');

    if (!oraInizio || !oraFine) {
      return;
    }

    if (interaGiornata) {
      oraInizio.setValue('00:00', { emitEvent: false });
      oraFine.setValue('23:59', { emitEvent: false });
      oraInizio.disable({ emitEvent: false });
      oraFine.disable({ emitEvent: false });
      return;
    }

    oraInizio.enable({ emitEvent: false });
    oraFine.enable({ emitEvent: false });

    if (oraInizio.value === '00:00' && oraFine.value === '23:59') {
      oraInizio.setValue('09:00', { emitEvent: false });
      oraFine.setValue(tipo === 'blocco' ? '09:30' : '19:00', { emitEvent: false });
    }
  }

  private riepilogoDisponibilita(response: { creati?: number; ignorati?: number }): string {
    const dettagli: string[] = [];

    if (response.creati && response.creati > 1) {
      dettagli.push(`${response.creati} blocchi creati`);
    }

    if (response.ignorati && response.ignorati > 0) {
      dettagli.push(`${response.ignorati} gia coperti`);
    }

    return dettagli.length ? ` (${dettagli.join(', ')})` : '';
  }

  private mostraMessaggio(messaggio: string, tipo: 'success' | 'error'): void {
    this.messaggio = messaggio;
    this.messaggioTipo = tipo;
  }

  private formatDateInput(data: Date): string {
    const anno = data.getFullYear();
    const mese = String(data.getMonth() + 1).padStart(2, '0');
    const giorno = String(data.getDate()).padStart(2, '0');
    return `${anno}-${mese}-${giorno}`;
  }
}
