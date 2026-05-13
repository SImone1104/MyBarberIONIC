import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard'; // Assicurati che il percorso sia corretto
import { adminGuard } from './guards/admin-guard';

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
  {
    path: 'barbiere',
    redirectTo: 'barbiere/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'barbiere/dashboard',
    loadComponent: () => import('./barbiere/dashboard/dashboard.page').then(m => m.BarbiereDashboardPage),
    canActivate: [adminGuard]
  },
  {
    path: 'barbiere/agenda',
    loadComponent: () => import('./barbiere/agenda/agenda.page').then(m => m.BarbiereAgendaPage),
    canActivate: [adminGuard]
  },
  {
    path: 'barbiere/nuova-prenotazione',
    loadComponent: () => import('./barbiere/nuova-prenotazione/nuova-prenotazione.page').then(m => m.BarbiereNuovaPrenotazionePage),
    canActivate: [adminGuard]
  },
  {
    path: 'barbiere/disponibilita',
    loadComponent: () => import('./barbiere/disponibilita/disponibilita.page').then(m => m.BarbiereDisponibilitaPage),
    canActivate: [adminGuard]
  },
  {
    path: 'barbiere/clienti',
    loadComponent: () => import('./barbiere/clienti/clienti.page').then(m => m.BarbiereClientiPage),
    canActivate: [adminGuard]
  },
  {
    path: 'barbiere/servizi',
    loadComponent: () => import('./barbiere/servizi/servizi-admin.page').then(m => m.BarbiereServiziPage),
    canActivate: [adminGuard]
  },
  {
    path: 'barbiere/contatti',
    loadComponent: () => import('./barbiere/contatti/contatti-admin.page').then(m => m.BarbiereContattiPage),
    canActivate: [adminGuard]
  },
  {
    path: 'barbiere/statistiche',
    loadComponent: () => import('./barbiere/statistiche/statistiche.page').then(m => m.BarbiereStatistichePage),
    canActivate: [adminGuard]
  },
  // Rilevamento errori o rotte non trovate
  {
    path: '**',
    redirectTo: 'home'
  }
];
