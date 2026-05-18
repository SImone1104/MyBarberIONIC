import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth'; 
import { finalize } from 'rxjs';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink,IonicModule]
})

export class LoginPage implements OnInit {
  loginForm!: FormGroup;
  messaggio: string = "";
  isErrore: boolean = false; // <-- NUOVA VARIABILE
  isLoading = false;
  private returnUrl = '/home';

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}


 ngOnInit() {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    const emailRegistrata = this.route.snapshot.queryParamMap.get('email');

    if (emailRegistrata) {
      this.loginForm.patchValue({ email: emailRegistrata });
    }

    if (this.route.snapshot.queryParamMap.get('registrazione') === 'ok') {
      this.messaggio = 'Registrazione completata. Ora puoi accedere.';
      this.isErrore = false; // <-- VERDE
    }

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

    if (returnUrl?.startsWith('/')) {
      this.returnUrl = returnUrl;
    }
  }

onLogin() {
  if (this.loginForm.valid) {
    this.isLoading = true;
    this.messaggio = '';
    this.isErrore = false; // Resetta ad ogni tentativo


    const credentials = {
      email: this.loginForm.value.email.trim().toLowerCase(),
      password: this.loginForm.value.password
    };
    
    this.authService.login(credentials).pipe(
      finalize(() => {
        this.isLoading = false;
      })
    ).subscribe({
      next: async (res) => {
        if (!res?.token) {
          this.messaggio = 'Accesso non riuscito: token mancante.';
          this.isErrore = true; // <-- ROSSO
          return;
        }

        this.messaggio = 'Accesso eseguito!';
        this.isErrore = false; // <-- VERDE
        const navigazioneOk = await this.router.navigateByUrl(this.returnUrl);

        if (!navigazioneOk) {
          this.messaggio = 'Accesso eseguito, ma non riesco ad aprire la Home.';
          this.isErrore = true; // <-- ROSSO
        }
      },
      error: (err) => {
        this.messaggio = 'Email o password errati.';
        this.isErrore = true; // <-- ROSSO
        console.error(err);
      }
    });
  }
}
}
