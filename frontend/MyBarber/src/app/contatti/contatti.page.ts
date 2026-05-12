import { Component, AfterViewInit, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { IonHeader, IonContent } from '@ionic/angular/standalone';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';

declare const L: any;

@Component({
  selector: 'app-contatti',
  standalone: true,
  imports: [CommonModule, IonHeader, IonContent, HeaderComponent, FooterComponent],
  templateUrl: './contatti.page.html',
  styleUrls: ['./contatti.page.scss'],
})
export class ContattiPage implements AfterViewInit, OnDestroy {
  private map: any;

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      // Piccolo timeout per essere sicuri che Ionic abbia renderizzato il container
      setTimeout(() => {
        this.initMap();
      }, 300);
    }
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap(): void {
    if (typeof L === 'undefined' || this.map) return;

    const lat = 38.1157;
    const lng = 13.3613;

    this.map = L.map('map', {
      scrollWheelZoom: false,
      zoomControl: true
    }).setView([lat, lng], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(this.map);

    const customIcon = L.icon({
      iconUrl: 'assets/marker-icon.png', // Assicurati di avere un'icona qui
      shadowUrl: 'assets/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41]
    });

    L.marker([lat, lng])
      .addTo(this.map)
      .bindPopup('<b>MyBarber Shop</b><br>Via Roma, 123')
      .openPopup();
  }
}