import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CONTATTI_SALONE_DEFAULT, SaloneContatti, SaloneContattiService } from '../services/salone-contatti';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit {
  contatti: SaloneContatti = CONTATTI_SALONE_DEFAULT;

  constructor(private contattiService: SaloneContattiService) {}

  ngOnInit(): void {
    this.contattiService.getContatti().subscribe({
      next: (contatti) => this.contatti = contatti,
      error: (err) => console.error('Errore caricamento contatti footer:', err)
    });
  }
}
