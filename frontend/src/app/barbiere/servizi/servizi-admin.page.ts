import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonContent, IonHeader } from '@ionic/angular/standalone';
import { HeaderComponent } from '../../header/header.component';
import { FooterComponent } from '../../footer/footer.component';
import { AdminService, AdminServizio } from '../../services/admin';

@Component({
  selector: 'app-barbiere-servizi',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, RouterLinkActive, IonContent, IonHeader, HeaderComponent, FooterComponent],
  templateUrl: './servizi-admin.page.html',
  styleUrls: ['../barbiere-admin.scss']
})
export class BarbiereServiziPage implements OnInit {
  servizi: AdminServizio[] = [];
  servizioInModifica: AdminServizio | null = null;
  messaggio = '';
  messaggioTipo: 'success' | 'error' = 'success';

  servizioForm = this.formBuilder.group({
    nome: ['', Validators.required],
    descrizione: [''],
    prezzo: [0, [Validators.required, Validators.min(0)]],
    durataMinuti: [30, [Validators.required, Validators.min(5)]],
    badge: [''],
    immagine: [''],
    dettagli: [''],
    attivo: [true]
  });

  constructor(
    private adminService: AdminService,
    private formBuilder: FormBuilder
  ) {}

  ngOnInit(): void {}

  ionViewWillEnter(): void {
    this.caricaServizi();
  }

  caricaServizi(): void {
    this.adminService.getServizi().subscribe({
      next: (servizi) => this.servizi = servizi,
      error: (err) => {
        console.error('Errore servizi admin:', err);
        this.mostraMessaggio('Non riesco a caricare i servizi.', 'error');
      }
    });
  }

  modificaServizio(servizio: AdminServizio): void {
    this.servizioInModifica = servizio;
    this.servizioForm.setValue({
      nome: servizio.nome,
      descrizione: servizio.descrizione || '',
      prezzo: servizio.prezzo,
      durataMinuti: servizio.durataMinuti,
      badge: servizio.badge || '',
      immagine: servizio.immagine || '',
      dettagli: servizio.dettagli.join('\n'),
      attivo: servizio.attivo
    });
  }

  nuovoServizio(): void {
    this.servizioInModifica = null;
    this.servizioForm.reset({
      nome: '',
      descrizione: '',
      prezzo: 0,
      durataMinuti: 30,
      badge: '',
      immagine: '',
      dettagli: '',
      attivo: true
    });
  }

  salvaServizio(): void {
    if (this.servizioForm.invalid) {
      return;
    }

    const value = this.servizioForm.value;
    const payload = {
      ...value,
      dettagli: String(value.dettagli || '')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)
    };

    const request = this.servizioInModifica
      ? this.adminService.updateServizio(this.servizioInModifica.id, payload)
      : this.adminService.creaServizio(payload);

    request.subscribe({
      next: () => {
        this.mostraMessaggio(this.servizioInModifica ? 'Servizio aggiornato.' : 'Servizio creato.', 'success');
        this.nuovoServizio();
        this.caricaServizi();
      },
      error: (err) => {
        const msg = err.error?.message || 'Servizio non salvato.';
        this.mostraMessaggio(msg, 'error');
      }
    });
  }

  eliminaServizio(servizio: AdminServizio): void {
    if (!confirm(`Disattivare ${servizio.nome}?`)) {
      return;
    }

    this.adminService.deleteServizio(servizio.id).subscribe({
      next: () => {
        this.mostraMessaggio('Servizio disattivato.', 'success');
        this.caricaServizi();
      },
      error: () => this.mostraMessaggio('Servizio non disattivato.', 'error')
    });
  }

  euro(value: number): string {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
  }

  private mostraMessaggio(messaggio: string, tipo: 'success' | 'error'): void {
    this.messaggio = messaggio;
    this.messaggioTipo = tipo;
  }
}
