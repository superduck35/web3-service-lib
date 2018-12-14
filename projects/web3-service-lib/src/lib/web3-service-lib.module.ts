import { ModuleWithProviders } from '@angular/compiler/src/core';
import { NgModule } from '@angular/core';
import { HttpModule } from '@angular/http';

import { EthService } from './eth.service';
import { GasService } from './gas.service';

@NgModule({
  imports: [
    HttpModule
  ],
  declarations: [],
  exports: [],
  providers: [EthService, GasService]
})
export class Web3ServiceModule {
  static forRoot(config: any): ModuleWithProviders {
    return {
      ngModule: Web3ServiceModule,
      providers: [{ provide: 'config', useValue: config }]
    };
  }
}
