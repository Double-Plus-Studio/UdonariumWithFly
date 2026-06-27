import { TestBed, inject } from '@angular/core/testing';

import { SaveDataService } from './save-data.service';

describe('SaveDataService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SaveDataService]
    });
  });

  xit('should be created', inject([SaveDataService], (service: SaveDataService) => {
    expect(service).toBeTruthy();
  }));
});
