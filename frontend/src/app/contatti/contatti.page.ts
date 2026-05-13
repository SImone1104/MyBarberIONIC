import { Component, AfterViewInit, Inject, PLATFORM_ID, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { IonHeader, IonContent } from '@ionic/angular/standalone';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';
import { CONTATTI_SALONE_DEFAULT, SaloneContatti, SaloneContattiService } from '../services/salone-contatti';

declare const L: any;

@Component({
  selector: 'app-contatti',
  standalone: true,
  imports: [CommonModule, IonHeader, IonContent, HeaderComponent, FooterComponent],
  templateUrl: './contatti.page.html',
  styleUrls: ['./contatti.page.scss'],
})
export class ContattiPage implements OnInit, AfterViewInit, OnDestroy {
  contatti: SaloneContatti = CONTATTI_SALONE_DEFAULT;
  private map: any;
  private marker: any;
  private viewReady = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private contattiService: SaloneContattiService
  ) {}

  ngOnInit() {
    this.contattiService.getContatti().subscribe({
      next: (contatti) => {
        this.contatti = contatti;
        this.refreshMap();
      },
      error: (err) => console.error('Errore caricamento contatti salone:', err)
    });
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      // Piccolo timeout per essere sicuri che Ionic abbia renderizzato il container
      setTimeout(() => {
        this.viewReady = true;
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

    const lat = this.contatti.latitudine;
    const lng = this.contatti.longitudine;

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

    this.marker = L.marker([lat, lng])
      .addTo(this.map)
      .bindPopup(`<b>${this.contatti.nome}</b><br>${this.contatti.indirizzo}`)
      .openPopup();
  }

  private refreshMap(): void {
    if (!isPlatformBrowser(this.platformId) || !this.viewReady) {
      return;
    }

    if (!this.map) {
      this.initMap();
      return;
    }

    const latLng = [this.contatti.latitudine, this.contatti.longitudine];
    this.map.setView(latLng, 16);

    if (this.marker) {
      this.marker
        .setLatLng(latLng)
        .bindPopup(`<b>${this.contatti.nome}</b><br>${this.contatti.indirizzo}`);
    }
  }
}
