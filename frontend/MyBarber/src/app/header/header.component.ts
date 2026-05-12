import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../services/auth'; // Controlla che il nome sia corretto

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  dropdownOpen = false;
  mobileMenuOpen = false;

  constructor(public authService: AuthService, private router: Router) {}

  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
    if (this.dropdownOpen) this.mobileMenuOpen = false;
  }

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    if (this.mobileMenuOpen) this.dropdownOpen = false;
  }

  closeMenus() {
    this.mobileMenuOpen = false;
    this.dropdownOpen = false;
  }

  eseguireLogout() {
    this.authService.logout();
    this.closeMenus();
    this.router.navigate(['/home']);
  }
}