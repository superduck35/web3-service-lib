import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { Web3ServiceModule } from 'web3-service-lib';
import { environment } from '../environments/environment';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    Web3ServiceModule.forRoot({
      netType: environment.netType
    })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
