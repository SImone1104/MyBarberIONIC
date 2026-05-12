import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ServiziPage } from './servizi.page';

describe('ServiziPage', () => {
  let component: ServiziPage;
  let fixture: ComponentFixture<ServiziPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ServiziPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
