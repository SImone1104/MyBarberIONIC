import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonContent, IonHeader } from '@ionic/angular/standalone';
import { FooterComponent } from '../../footer/footer.component';
import { HeaderComponent } from '../../header/header.component';
import { AdminService } from '../../services/admin';
import { CONTATTI_SALONE_DEFAULT } from '../../services/salone-contatti';

@Component({
  selector: 'app-barbiere-contatti',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, RouterLinkActive, IonContent, IonHeader, HeaderComponent, FooterComponent],
  templateUrl: './contatti-admin.page.html',
  styleUrls: ['../barbiere-admin.scss']
})
export class BarbiereContattiPage implements OnInit {
  messaggio = '';
  messaggioTipo: 'success' | 'error' = 'success';

  contattiForm = this.formBuilder.group({
    nome: [CONTATTI_SALONE_DEFAULT.nome, Validators.required],
    indirizzo: [CONTATTI_SALONE_DEFAULT.indirizzo, Validators.required],
    telefono: [CONTATTI_SALONE_DEFAULT.telefono, Validators.required],
    email: [CONTATTI_SALONE_DEFAULT.email, [Validators.required, Validators.email]],
    orari: [CONTATTI_SALONE_DEFAULT.orari.join('\n'), Validators.required],
    latitudine: [CONTATTI_SALONE_DEFAULT.latitudine, Validators.required],
    longitudine: [CONTATTI_SALONE_DEFAULT.longitudine, Validators.required],
    mapsUrl: [CONTATTI_SALONE_DEFAULT.mapsUrl],
    instagramUrl: [CONTATTI_SALONE_DEFAULT.instagramUrl],
    facebookUrl: [CONTATTI_SALONE_DEFAULT.facebookUrl],
    tiktokUrl: [CONTATTI_SALONE_DEFAULT.tiktokUrl]
  });

  constructor(
    private adminService: AdminService,
    private formBuilder: FormBuilder
  ) {}

  ngOnInit(): void {}

  ionViewWillEnter(): void {
    this.caricaContatti();
  }

  caricaContatti(): void {
    this.adminService.getContattiSalone().subscribe({
      next: (contatti) => {
        this.contattiForm.patchValue({
          ...contatti,
          orari: contatti.orari.join('\n')
        });
      },
      error: (err) => {
        console.error('Errore caricamento contatti salone:', err);
        this.mostraMessaggio('Non riesco a caricare i contatti del salone.', 'error');
      }
    });
  }

  salva(): void {
    if (this.contattiForm.invalid) {
      this.mostraMessaggio('Compila i campi obbligatori prima di salvare.', 'error');
      return;
    }

    const value = this.contattiForm.value;
    const payload = {
      ...value,
      orari: String(value.orari || '')
        .split('\n')
        .map((riga) => riga.trim())
        .filter(Boolean),
      latitudine: Number(value.latitudine),
      longitudine: Number(value.longitudine)
    };

    this.adminService.updateContattiSalone(payload).subscribe({
      next: () => this.mostraMessaggio('Contatti salone aggiornati.', 'success'),
      error: (err) => {
        const msg = err.error?.message || 'Salvataggio contatti non riuscito.';
        this.mostraMessaggio(msg, 'error');
      }
    });
  }

  private mostraMessaggio(messaggio: string, tipo: 'success' | 'error'): void {
    this.messaggio = messaggio;
    this.messaggioTipo = tipo;
  }
}
