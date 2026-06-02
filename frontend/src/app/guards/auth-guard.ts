import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth'; // Nota il .service finale

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  //Verifica se l' utente è loggato
  if (authService.isLoggedIn()) {
    return true;
  } else {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
};


/*
Utente prova /prenotazioni
        ↓
app.routes.ts vede canActivate: [authGuard]
        ↓
authGuard chiama authService.isLoggedIn()
        ↓
se token valido:
    return true
    entra in PrenotazioniPage

se token assente/scaduto:
    redirect a /login?returnUrl=/prenotazioni
        ↓
    utente fa login
        ↓
    login.page.ts legge returnUrl
        ↓
    torna a /prenotazioni
*/