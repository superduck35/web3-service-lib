import { TestBed, inject } from '@angular/core/testing';

import { GasService } from './gas.service';

describe('GasService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GasService]
    });
  });

  it('should be created', inject([GasService], (service: GasService) => {
    expect(service).toBeTruthy();
  }));
});
