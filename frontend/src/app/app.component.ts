import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendarNumberOutline,
  calendarOutline,
  callOutline,
  cutOutline,
  homeOutline,
  personOutline
} from 'ionicons/icons';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'], // Assicurati che il file esista
  standalone: true,
  imports: [CommonModule, IonApp, IonRouterOutlet, IonTabBar, IonTabButton, IonIcon, IonLabel],
})
export class AppComponent {
  showMobileTabs = true;
  currentUrl = '/home';

  private readonly routesWithoutTabs = ['/login', '/registrazione'];

  constructor(private router: Router) {
    addIcons({
      calendarNumberOutline,
      calendarOutline,
      callOutline,
      cutOutline,
      homeOutline,
      personOutline
    });

    this.updateMobileTabs(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.updateMobileTabs(event.urlAfterRedirects));
  }

  private updateMobileTabs(url: string) {
    this.currentUrl = url.split('?')[0].split('#')[0];
    this.showMobileTabs = !this.routesWithoutTabs.some((route) => this.currentUrl.startsWith(route));
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  isActive(path: string): boolean {
    return this.currentUrl === path || this.currentUrl.startsWith(`${path}/`);
  }
}
