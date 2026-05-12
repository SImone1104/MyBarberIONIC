import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MieiAppuntamentiPage } from './miei-appuntamenti.page';

describe('MieiAppuntamentiPage', () => {
  let component: MieiAppuntamentiPage;
  let fixture: ComponentFixture<MieiAppuntamentiPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MieiAppuntamentiPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
