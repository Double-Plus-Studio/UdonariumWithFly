import { TestBed } from '@angular/core/testing';

import { GameObjectInventoryService } from './game-object-inventory.service';

describe('GameObjectInventoryService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  xit('should be created', () => {
    const service: GameObjectInventoryService = TestBed.inject(GameObjectInventoryService);
    expect(service).toBeTruthy();
  });
});
