import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonHeader, IonContent, IonToolbar, IonTitle } from '@ionic/angular/standalone';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';
import { SERVIZI_OFFERTI } from '../shared/servizi';

@Component({
  selector: 'app-servizi',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink, 
    IonHeader, 
    IonContent, 
    IonToolbar, 
    IonTitle,
    HeaderComponent,
    FooterComponent
  ],
  templateUrl: './servizi.page.html',
  styleUrls: ['./servizi.page.scss']
})
export class ServiziPage {
  servizi = SERVIZI_OFFERTI;
}