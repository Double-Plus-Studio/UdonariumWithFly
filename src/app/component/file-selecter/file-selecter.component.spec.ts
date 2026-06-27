import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { FileSelectorComponent } from './file-selector.component';

describe('FileSelectorComponent', () => {
  let component: FileSelectorComponent;
  let fixture: ComponentFixture<FileSelectorComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ FileSelectorComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FileSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
