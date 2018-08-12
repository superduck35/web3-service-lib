import { Injectable } from '@angular/core';
import { Http } from '@angular/http';

import { EthService, WalletType, Web3LoadingStatus } from 'web3-service-lib';

@Injectable({
  providedIn: 'root'
})
export class Web3Service extends EthService {

  constructor(http: Http) {
    super(http);
  }
}
