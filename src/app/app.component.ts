import { Component, OnDestroy, OnInit } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';

import { EthService, NetworkType, WalletType, Web3LoadingStatus } from 'web3-service-lib';
import { Web3Service } from './web3.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {

  private web3Sub: Subscription;
  loadingComplete = false;

  pendingTx = false;

  constructor(private web3Service: Web3Service) { }

  ngOnInit() {
    this.web3Sub = this.web3Service.web3Status$.subscribe((status: Web3LoadingStatus) => {
      this.loadingComplete = status === Web3LoadingStatus.complete;
    });
  }

  ngOnDestroy() {
    if (this.web3Sub) { this.web3Sub.unsubscribe(); }
  }

  sendEthTransaction() {
    console.log('Paying ETH');
    this.pendingTx = true;
    this.web3Service.payWithEth('0xfb1d7f6c700a053683f80447b387a891d5f76aac', 0.01)
      .then(tx => tx.status === 0 ? console.log('Transaction failed') : console.log('Transaction success'))
      .catch(err => console.log('Error'))
      .then(() => this.pendingTx = false);
  }
}
