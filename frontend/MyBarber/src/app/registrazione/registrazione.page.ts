import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../services/auth'; 
import { IonicModule } from '@ionic/angular';


@Component({
  selector: 'app-registrazione',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink,IonicModule],
  templateUrl: './registrazione.page.html',
  styleUrl: './registrazione.page.scss'
})
export class RegistrazionePage implements OnInit {
  registerForm: FormGroup;
  isLoading: boolean = false; // Variabile per gestire lo stato di caricamento

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService // <--- INIETTA IL SERVIZIO QUI
  ) {
    // Inizializziamo il form nel costruttore per sicurezza immediata
    this.registerForm = this.fb.group({

      nome:['',[
        Validators.required,
      ]],

       cognome:['',[
        Validators.required,
      ]],

      email: ['', [
        Validators.required, 
        Validators.email
      ]],
      
      // Password: min 8 caratteri, 1 Maiuscola, 1 Numero, 1 Carattere Speciale
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[$@$!%*?&])[A-Za-z\d$@$!%*?&]{8,}$/)
      ]],
      
      confermaPassword: ['', [Validators.required]],
      
      cellulare: ['', [
        Validators.required,
        Validators.pattern('^[0-9]*$'),
        Validators.minLength(9),
        Validators.maxLength(11)
      ]]
    }, { 
      validators: this.passwordMatchValidator 
    });
  }

  ngOnInit(): void {}

  /**
   * Validatore personalizzato: controlla se password e confermaPassword sono uguali
   */
  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confermaPassword = control.get('confermaPassword')?.value;

    if (password && confermaPassword && password !== confermaPassword) {
      return { mismatch: true };
    }
    return null;
  }

  /**
   * Gestisce l'invio del form con simulazione di caricamento
   */
onSubmit(): void {
  if (this.registerForm.valid) {
    this.isLoading = true;

    // Chiamiamo il metodo register del servizio inviando tutti i dati del form
    this.authService.register(this.registerForm.value).subscribe({
      next: (res) => {
        // La registrazione è andata a buon fine!
        this.isLoading = false;
        console.log('Utente registrato con successo:', res);
        
        this.router.navigate(['/login'], {
          queryParams: { email: this.registerForm.value.email.trim().toLowerCase(), registrazione: 'ok' },
          replaceUrl: true
        });

        /* 
           OPZIONE B: Se il backend del prof dopo la registrazione ti logga già, 
           puoi usare la logica del login automatico, ma solitamente 
           è più sicuro passare dal login.
        */
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Errore durante la registrazione:', err);
        alert('Errore: Email già esistente o server non raggiungibile.');
      }
    });
  } else {
    // Se il form non è valido, mostriamo gli errori
    this.registerForm.markAllAsTouched();
  }
}
}
