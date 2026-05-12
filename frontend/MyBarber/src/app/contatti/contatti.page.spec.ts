import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContattiPage } from './contatti.page';

describe('ContattiPage', () => {
  let component: ContattiPage;
  let fixture: ComponentFixture<ContattiPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ContattiPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
