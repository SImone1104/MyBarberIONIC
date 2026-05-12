import { FormBuilder } from '@angular/forms';
import { convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { PrenotazioniPage } from './prenotazioni.page';

describe('Prenotazioni', () => {
  let component: PrenotazioniPage;

  beforeEach(() => {
    // Mock del servizio Auth (per non chiamare il backend vero)
    const authServiceMock = {
      getPrenotazioni: () => of([]),
      getOrariOccupati: () => of([]),
      creaPrenotazione: () => of({})
    };

    // Mock della rotta per simulare i parametri URL (es. ?servizio=taglio)
    const routeMock = {
      snapshot: {
        queryParamMap: convertToParamMap({})
      }
    };

    // Mock del ChangeDetectorRef di Angular
    const cdrMock = {
      detectChanges: () => undefined
    };

    // Creiamo l'istanza del componente passando i finti servizi
    component = new PrenotazioniPage(
      new FormBuilder(),
      authServiceMock as any,
      routeMock as any,
      cdrMock as any
    );

    // Inizializziamo il componente
    component.ngOnInit();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // --- I TUOI TEST LOGICI (Mantenuti identici) ---

  it('disabilita gli slot da 30 minuti che si sovrappongono a un servizio da 2 ore', () => {
    component.prenotazioneForm.patchValue({ data: '2099-01-01', servizio: 'taglio', ora: '' });
    component.slotOccupati = [
      { ora: '09:00', oraFine: '11:00', durataMinuti: 120, servizio: 'colore' }
    ];

    expect(component.slotNonDisponibile('09:00')).toBe(true);
    expect(component.slotNonDisponibile('09:30')).toBe(true);
    expect(component.slotNonDisponibile('10:00')).toBe(true);
    expect(component.slotNonDisponibile('10:30')).toBe(true);
    expect(component.slotNonDisponibile('11:00')).toBe(false);
  });

  it('disabilita un servizio da 1 ora quando incrocia una prenotazione esistente', () => {
    component.prenotazioneForm.patchValue({ data: '2099-01-01', servizio: 'completo', ora: '' });
    component.slotOccupati = [
      { ora: '10:30', oraFine: '11:00', durataMinuti: 30, servizio: 'taglio' }
    ];

    expect(component.slotNonDisponibile('10:00')).toBe(true);
    expect(component.slotNonDisponibile('11:00')).toBe(false);
  });

  it('lascia libero 16-17 e blocca 18-19 quando esiste una prenotazione 17-19', () => {
    component.prenotazioneForm.patchValue({ data: '2099-01-01', servizio: 'completo', ora: '' });
    component.slotOccupati = [
      { ora: '17:00', oraFine: '19:00', durataMinuti: 120, servizio: 'colore' }
    ];

    expect(component.slotNonDisponibile('16:00')).toBe(false);
    expect(component.slotNonDisponibile('17:00')).toBe(true);
    expect(component.slotNonDisponibile('18:00')).toBe(true);
  });

  it('disabilita un servizio da 2 ore quando in mezzo esiste gia uno slot occupato', () => {
    component.prenotazioneForm.patchValue({ data: '2099-01-01', servizio: 'colore', ora: '' });
    component.slotOccupati = [
      { ora: '10:00', oraFine: '10:30', durataMinuti: 30, servizio: 'taglio' }
    ];

    expect(component.slotNonDisponibile('09:00')).toBe(true);
    expect(component.slotNonDisponibile('11:00')).toBe(false);
  });

  it('permette a un servizio da 2 ore di partire al primo mezzo slot libero', () => {
    component.prenotazioneForm.patchValue({ data: '2099-01-01', servizio: 'colore', ora: '' });
    component.slotOccupati = [
      { ora: '09:00', oraFine: '10:00', durataMinuti: 60, servizio: 'completo' }
    ];

    expect(component.slotOrari()).toContainEqual({ inizio: '10:00', fine: '12:00' });
    expect(component.slotNonDisponibile('09:00')).toBe(true);
    expect(component.slotNonDisponibile('09:30')).toBe(true);
    expect(component.slotNonDisponibile('10:00')).toBe(false);
  });

  it('usa la durata del servizio occupato anche quando manca oraFine', () => {
    component.prenotazioneForm.patchValue({ data: '2099-01-01', servizio: 'taglio', ora: '' });
    component.slotOccupati = [
      { ora: '09:00', oraFine: '', servizio: 'colore' }
    ];

    expect(component.slotNonDisponibile('10:30')).toBe(true);
    expect(component.slotNonDisponibile('11:00')).toBe(false);
  });

  it('blocca tutti gli slot sovrapposti a un taglio piu colore 09-11 anche con dati API incompleti', () => {
    component.prenotazioneForm.patchValue({ data: '2099-01-01', servizio: 'colore', ora: '' });
    // Usiamo cast a 'any' per testare la funzione privata di normalizzazione
    component.slotOccupati = (component as any).normalizzaSlotOccupati([
      { ora: '09:00', ora_fine: null, durata_minuti: null, servizio: 'Taglio + Colore' }
    ]);

    expect(component.slotNonDisponibile('09:00')).toBe(true);
    expect(component.slotNonDisponibile('09:30')).toBe(true);
    expect(component.slotNonDisponibile('10:00')).toBe(true);
    expect(component.slotNonDisponibile('10:30')).toBe(true);
    expect(component.slotNonDisponibile('11:00')).toBe(false);
  });

  it('applica la regola di sovrapposizione a tutti gli slot del mattino e del pomeriggio', () => {
    const scenari = [
      { occupato: { ora: '09:00', oraFine: '11:00', servizio: 'colore' }, servizio: 'taglio' },
      { occupato: { ora: '15:00', oraFine: '17:00', servizio: 'colore' }, servizio: 'barba' }
    ];

    scenari.forEach(({ occupato, servizio }) => {
      component.prenotazioneForm.patchValue({ data: '2099-01-01', servizio, ora: '' });
      component.slotOccupati = [occupato as any];

      component.slotOrari().forEach((slot) => {
        const slotInizio = oraInMinuti(slot.inizio);
        const slotFine = oraInMinuti(slot.fine);
        const occupatoInizio = oraInMinuti(occupato.ora);
        const occupatoFine = oraInMinuti(occupato.oraFine);
        const deveEssereBloccato = slotInizio < occupatoFine && slotFine > occupatoInizio;

        expect(component.slotNonDisponibile(slot.inizio)).toBe(deveEssereBloccato);
      });
    });
  });
});

// Funzione helper per i calcoli dei test
function oraInMinuti(ora: string): number {
  const [ore, minuti] = ora.split(':').map(Number);
  return ore * 60 + minuti;
}