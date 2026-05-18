import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarNumberOutline, closeOutline, locationOutline, menuOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth'; // Controlla che il nome sia corretto

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IonIcon],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
  dropdownOpen = false;
  barberMenuOpen = false;
  appuntamentiDaGestire = 0;

  private badgeSub?: Subscription;
  private badgeRefreshTimer?: ReturnType<typeof setInterval>;

  constructor(public authService: AuthService, private router: Router) {
    addIcons({ calendarNumberOutline, closeOutline, locationOutline, menuOutline });
  }

  ngOnInit(): void {
    this.badgeSub = this.authService.appuntamentiDaGestire$.subscribe((totale) => {
      this.appuntamentiDaGestire = totale;
    });

    if (this.authService.isLoggedIn() && !this.authService.isAdmin()) {
      this.authService.refreshAppuntamentiDaGestire().subscribe({ error: () => undefined });
      this.badgeRefreshTimer = setInterval(() => {
        this.authService.refreshAppuntamentiDaGestire().subscribe({ error: () => undefined });
      }, 15000);
    }
  }

  ngOnDestroy(): void {
    this.badgeSub?.unsubscribe();
    if (this.badgeRefreshTimer) {
      clearInterval(this.badgeRefreshTimer);
    }
  }

  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
    if (this.dropdownOpen) {
      this.barberMenuOpen = false;
    }
  }

  toggleBarberMenu() {
    this.barberMenuOpen = !this.barberMenuOpen;
    if (this.barberMenuOpen) {
      this.dropdownOpen = false;
    }
  }

  closeMenus() {
    this.dropdownOpen = false;
    this.barberMenuOpen = false;
  }

  mostraBadgeAppuntamenti(): boolean {
    return !this.authService.isAdmin() && this.appuntamentiDaGestire > 0;
  }

  eseguireLogout() {
    this.authService.logout();
    this.closeMenus();
    this.router.navigate(['/home']);
  }
}
