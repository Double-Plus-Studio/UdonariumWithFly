import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { StandImageComponent } from './stand-image.component';

describe('StandImageComponent', () => {
  let component: StandImageComponent;
  let fixture: ComponentFixture<StandImageComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ StandImageComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(StandImageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  xit('should create', () => {
    expect(component).toBeTruthy();
  });
});
