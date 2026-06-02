import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const httpIntInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  const browserHost = window.location.hostname || 'localhost';
  const baseUrl = `http://${browserHost}:3000`;

  const token = localStorage.getItem('token');
  let apiReq = req;

  // 1. Applichiamo la baseUrl del prof
  apiReq = req.clone({
    url: `${baseUrl}/${req.url}` //Importante
  });

  // 2. AGGIUNTA: Se esiste un token, lo inseriamo nell'header
  // (Evitiamo di metterlo se stiamo andando verso login o registrazione)
  if (token && !req.url.includes('login') && !req.url.includes('register')) {
    apiReq = apiReq.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }
  
  return next(apiReq).pipe( //URL completo e pronto per essere mandato al backend
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        console.error('Sessione scaduta o non autorizzato. Redirect al login...');
        
        //svuotiamo il localStorage
        localStorage.clear(); 
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
