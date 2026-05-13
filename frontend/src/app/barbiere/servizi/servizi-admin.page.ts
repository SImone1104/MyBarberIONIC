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
  nomeImmagineSelezionata = '';

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
    this.nomeImmagineSelezionata = this.nomeFileDaImmagine(servizio.immagine);
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
    this.nomeImmagineSelezionata = '';
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
        const msg = err.status === 413
          ? 'Immagine troppo grande per il salvataggio. Scegli una foto piu leggera.'
          : err.error?.message || 'Servizio non salvato.';
        this.mostraMessaggio(msg, 'error');
      }
    });
  }

  async selezionaImmagine(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.mostraMessaggio('Seleziona un file immagine valido.', 'error');
      input.value = '';
      return;
    }

    const maxBytes = 8 * 1024 * 1024;

    if (file.size > maxBytes) {
      this.mostraMessaggio('Immagine troppo grande: scegli un file sotto 8 MB.', 'error');
      input.value = '';
      return;
    }

    try {
      const immagine = await this.preparaImmagineServizio(file);
      this.nomeImmagineSelezionata = file.name;
      this.servizioForm.patchValue({ immagine });
      this.mostraMessaggio('', 'success');
    } catch (err) {
      console.error('Errore immagine servizio:', err);
      this.mostraMessaggio('Non riesco a preparare l immagine selezionata.', 'error');
      input.value = '';
    }
  }

  anteprimaImmagine(): string {
    return this.servizioForm.get('immagine')?.value || '';
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

  private preparaImmagineServizio(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => reject(new Error('File non leggibile'));
      reader.onload = () => {
        const img = new Image();

        img.onerror = () => reject(new Error('Immagine non leggibile'));
        img.onload = () => {
          const maxDimensione = 1200;
          const scala = Math.min(1, maxDimensione / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scala));
          canvas.height = Math.max(1, Math.round(img.height * scala));

          const context = canvas.getContext('2d');

          if (!context) {
            reject(new Error('Canvas non disponibile'));
            return;
          }

          context.drawImage(img, 0, 0, canvas.width, canvas.height);

          let qualita = 0.86;
          let dataUrl = canvas.toDataURL('image/jpeg', qualita);

          while (this.dimensioneDataUrl(dataUrl) > 900 * 1024 && qualita > 0.55) {
            qualita -= 0.08;
            dataUrl = canvas.toDataURL('image/jpeg', qualita);
          }

          if (this.dimensioneDataUrl(dataUrl) > 1200 * 1024) {
            reject(new Error('Immagine compressa ancora troppo grande'));
            return;
          }

          resolve(dataUrl);
        };

        img.src = String(reader.result || '');
      };

      reader.readAsDataURL(file);
    });
  }

  private dimensioneDataUrl(dataUrl: string): number {
    const base64 = dataUrl.split(',')[1] || '';
    return Math.ceil((base64.length * 3) / 4);
  }

  private nomeFileDaImmagine(immagine: string): string {
    if (!immagine) {
      return '';
    }

    if (immagine.startsWith('data:image/')) {
      return 'Immagine caricata';
    }

    return immagine.split('/').pop() || immagine;
  }
}
