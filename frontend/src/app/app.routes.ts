import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard'; // Assicurati che il percorso sia corretto

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then(m => m.HomePage)
  },
  {
    path: 'servizi',
    loadComponent: () => import('./servizi/servizi.page').then(m => m.ServiziPage)
  },
  {
    path: 'contatti',
    loadComponent: () => import('./contatti/contatti.page').then(m => m.ContattiPage)
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'registrazione',
    loadComponent: () => import('./registrazione/registrazione.page').then(m => m.RegistrazionePage)
  },
  // ROTTE PROTETTE DALLA GUARDIA
  {
    path: 'prenotazioni',
    loadComponent: () => import('./prenotazioni/prenotazioni.page').then(m => m.PrenotazioniPage),
    canActivate: [authGuard] 
  },
  {
    path: 'miei-appuntamenti',
    loadComponent: () => import('./miei-appuntamenti/miei-appuntamenti.page').then(m => m.MieiAppuntamentiPage),
    canActivate: [authGuard]
  },
  {
    path: 'profilo',
    loadComponent: () => import('./profilo/profilo.page').then(m => m.ProfiloPage),
    canActivate: [authGuard]
  },
  // Rilevamento errori o rotte non trovate
  {
    path: '**',
    redirectTo: 'home'
  }
];