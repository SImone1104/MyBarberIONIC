import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { provideIonicAngular } from '@ionic/angular/standalone'; // Fondamentale per Ionic!

import { routes } from './app.routes';
import { httpIntInterceptor } from './http-int.interceptor'; // Usa quello del prof

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideIonicAngular(), // Questo abilita i componenti Ionic (Bottoni, Menu, ecc.)
    provideHttpClient(
      withFetch(), 
      withInterceptors([httpIntInterceptor]) // Collega il backend con IP/Localhost
    ),
  ]
};