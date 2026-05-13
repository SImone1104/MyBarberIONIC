import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../services/auth';
import { finalize, timeout } from 'rxjs';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonMenuButton,
  IonButton, IonIcon, IonSpinner 
} from '@ionic/angular/standalone';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';
import { Router } from '@angular/router'; // <--- AGGIUNGI QUESTO


@Component({
  selector: 'app-profilo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule,IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonMenuButton,
    IonButton, IonIcon, IonSpinner,HeaderComponent,FooterComponent],
  templateUrl: './profilo.page.html',
  styleUrl: './profilo.page.scss'
})
export class ProfiloPage implements OnInit {
  profiloForm!: FormGroup;
  messaggio = '';
  messaggioErrore = '';
  isLoading = true;
  isSaving = false;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    public authService: AuthService,
    private router: Router, // <--- INIETTA IL ROUTER
  ) {
    this.profiloForm = this.fb.group({
      nome: ['', Validators.required],
      cognome: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      telefono: ['', [
        Validators.required,
        Validators.pattern('^[0-9]*$'),
        Validators.minLength(9),
        Validators.maxLength(11)
      ]]
    });
  }

  ngOnInit(): void {
    this.caricaProfilo();
  }

  caricaProfilo() {
    this.isLoading = true;
    this.messaggioErrore = '';

    this.authService.getProfile().pipe(
      timeout(8000),
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (user) => {
        this.profiloForm.patchValue({
          nome: user.nome || '',
          cognome: user.cognome || '',
          email: user.email || '',
          telefono: user.telefono || ''
        });
        this.profiloForm.markAsPristine();
      },
      error: (err) => {
        console.error('Errore nel recupero profilo:', err);
        this.messaggioErrore = err.status === 401
          ? 'Sessione scaduta. Effettua di nuovo l accesso.'
          : 'Errore nel caricamento dei dati.';
      }
    });
  }

  salvaModifiche() {
    if (!this.profiloForm.valid) {
      this.profiloForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.messaggio = '';
    this.messaggioErrore = '';

    const datiProfilo = {
      nome: this.profiloForm.value.nome.trim(),
      cognome: this.profiloForm.value.cognome.trim(),
      email: this.profiloForm.value.email.trim().toLowerCase(),
      telefono: this.profiloForm.value.telefono.trim()
    };

    this.authService.updateProfile(datiProfilo).pipe(
      timeout(8000),
      finalize(() => {
        this.isSaving = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (user) => {
        this.profiloForm.patchValue({
          nome: user.nome,
          cognome: user.cognome,
          email: user.email,
          telefono: user.telefono
        });
        this.profiloForm.markAsPristine();
        this.messaggio = 'Profilo aggiornato con successo!';
        setTimeout(() => this.messaggio = '', 3000);
      },
      error: (err) => {
        console.error('Errore aggiornamento profilo:', err);
        this.messaggioErrore = err.status === 409
          ? 'Questa email e gia collegata a un altro account.'
          : err.status === 401
            ? 'Sessione scaduta. Effettua di nuovo l accesso.'
            : 'Non e stato possibile aggiornare il profilo.';
      }
    });
  }
  eseguireLogout() {
  this.authService.logout();
  // Se hai una funzione per chiudere menu globali chiamala qui
  this.router.navigate(['/home']);
}
}
