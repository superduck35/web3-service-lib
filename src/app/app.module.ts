import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { Web3ServiceModule } from 'web3-service-lib';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    Web3ServiceModule.forRoot()
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
