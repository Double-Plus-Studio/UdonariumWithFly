import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { StandElementComponent } from './stand-element.component';

describe('StandElementComponent', () => {
  let component: StandElementComponent;
  let fixture: ComponentFixture<StandElementComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ StandElementComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(StandElementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
