import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarNumberOutline, callOutline } from 'ionicons/icons';
import { AuthService } from '../services/auth'; // Controlla che il nome sia corretto

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IonIcon],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  dropdownOpen = false;

  constructor(public authService: AuthService, private router: Router) {
    addIcons({ calendarNumberOutline, callOutline });
  }

  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
  }

  closeMenus() {
    this.dropdownOpen = false;
  }

  eseguireLogout() {
    this.authService.logout();
    this.closeMenus();
    this.router.navigate(['/home']);
  }
}
