import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonHeader, IonContent } from '@ionic/angular/standalone';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';
import { AuthService } from '../services/auth';
import { SERVIZI_OFFERTI, ServizioOfferto } from '../shared/servizi';

@Component({
  selector: 'app-servizi',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink, 
    IonHeader, 
    IonContent, 
    HeaderComponent,
    FooterComponent
  ],
  templateUrl: './servizi.page.html',
  styleUrls: ['./servizi.page.scss']
})
export class ServiziPage implements OnInit {
  servizi: ServizioOfferto[] = SERVIZI_OFFERTI;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.getServiziDisponibili().subscribe({
      next: (servizi) => {
        if (servizi.length > 0) {
          this.servizi = servizi;
        }
      },
      error: (err) => console.error('Errore servizi:', err)
    });
  }
}
