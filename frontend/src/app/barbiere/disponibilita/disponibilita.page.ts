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

  creaBlocco(): void {
    if (this.bloccoForm.invalid) {
      return;
    }

    const payload = this.payloadBlocco();

    this.adminService.creaDisponibilita(payload).subscribe({
      next: (response) => {
        this.pulisciConferma();
        const creati = response.creati && response.creati > 1 ? ` (${response.creati} giorni)` : '';
        this.mostraMessaggio(`Disponibilita aggiornata${creati}.`, 'success');
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

  eliminaBlocco(id: number): void {
    this.adminService.deleteDisponibilita(id).subscribe({
      next: () => {
        this.mostraMessaggio('Blocco rimosso.', 'success');
        this.caricaBlocchi();
      },
      error: () => this.mostraMessaggio('Rimozione non riuscita.', 'error')
    });
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
    const value = this.bloccoForm.value;

    return {
      ...value,
      dataFine: value.dataFine || value.data
    };
  }

  private payloadRegolaRicorrente(): Record<string, unknown> {
    const value = this.regolaForm.value;

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
