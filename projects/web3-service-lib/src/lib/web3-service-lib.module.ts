import { ModuleWithProviders } from '@angular/compiler/src/core';
import { NgModule } from '@angular/core';

import { EthService } from './eth.service';

@NgModule({
  imports: [
  ],
  declarations: [],
  exports: []
})
export class Web3ServiceModule {
  static forRoot(): ModuleWithProviders {
    return {
      ngModule: Web3ServiceModule,
      providers: [EthService]
    };
  }
}
