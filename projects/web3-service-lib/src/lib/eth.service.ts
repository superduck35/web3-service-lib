import { Inject, Injectable, OnDestroy } from '@angular/core';
import { Http, Response } from '@angular/http';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';

declare let require: any;
const Web3 = require('web3');
declare var web3;

const gas = '210000';
const gasStationApi = 'https://ethgasstation.info/json/ethgasAPI.json';

export enum WalletType {
  metaMask = 'MetaMask',
  trust = 'Trust'
}

export enum NetworkType {
  main = 'Mainnet',
  ropsten = 'Ropsten',
  rinkeby = 'Rinkeby',
  unknown = 'Unknown'
}

export enum Web3LoadingStatus {
  loading = 'Wallet loading is in progress',
  noMetaMask = 'No wallet has been connected',
  noAccountsAvailable = 'Your wallet is locked or there are no accounts available',
  error = 'Something went wrong when connecting to your wallet',
  complete = 'Successfully connected to your wallet'
}

@Injectable({
  providedIn: 'root'
})
export class EthService implements OnDestroy {

  web3js: any;
  private accountInterval: any;
  netType: NetworkType;
  walletType: WalletType;

  private web3Status = new BehaviorSubject<Web3LoadingStatus>(Web3LoadingStatus.loading);
  public web3Status$ = this.web3Status.asObservable();

  public account = new BehaviorSubject<string>(null);
  public account$ = this.account.asObservable();

  constructor(protected http: Http) {
    if (typeof web3 !== 'undefined') {
      this.web3js = new Web3(web3.currentProvider);
      this.setWalletType();

      try {
        this.web3js.eth.net.getId().then((id: number) => {
          console.log('Web3Service: Network retrieved: ID= ' + id);
          switch (id) {
            case 1:
              this.netType = NetworkType.main;
              break;
            case 3:
              this.netType = NetworkType.ropsten;
              break;
            case 4:
              this.netType = NetworkType.rinkeby;
              break;
            default:
              this.netType = NetworkType.unknown;
          }

          this.setUpAccounts();
        });

      } catch (e) {
        this.web3Status.next(Web3LoadingStatus.error);
      }
    } else {
      this.web3js = new Web3();
      this.web3Status.next(Web3LoadingStatus.noMetaMask);
    }
  }

  ngOnDestroy() {
    if (this.accountInterval) {
      clearInterval(this.accountInterval);
    }
  }

  private setWalletType(): WalletType {
    if (this.web3js.currentProvider.isMetaMask) {
      return this.walletType = WalletType.metaMask;
    }
    if (this.web3js.currentProvider.isTrust) {
      return this.walletType = WalletType.trust;
    }
    return this.walletType = null;
  }

  private setUpAccounts() {
    console.log('Web3Service: Is: ', this.netType);
    this.web3js.eth.getAccounts().then((accs: string[]) => {
      console.log('Web3Service: Got accounts: ' + JSON.stringify(accs));
      this.account.next(accs[0]);
      if (accs[0] !== undefined) {
        this.web3Status.next(Web3LoadingStatus.complete);
      } else {
        this.web3Status.next(Web3LoadingStatus.noAccountsAvailable);
      }
      this.accountInterval = setInterval(() => this.checkAccountMetaMask(), 5000);
    });
  }

  private checkAccountMetaMask() {
    this.web3js.eth.getAccounts().then((accs: string[]) => {
      if (accs[0] !== this.account.value) {
        this.account.next(accs[0]);
        if (accs[0] !== undefined) {
          this.web3Status.next(Web3LoadingStatus.complete);
          return;
        }
        this.web3Status.next(Web3LoadingStatus.noAccountsAvailable);
      }
    });
  }

  async getEthBalanceAsync(userAddress: string = this.account.value): Promise<string> {
    const balance = await this.web3js.eth.getBalance(userAddress);
    if (balance) {
      console.log(balance);
      const tokens = this.web3js.utils.toBN(balance).toString();
      console.log('Eth Owned: ' + this.web3js.utils.fromWei(tokens, 'ether'));
      return Promise.resolve(tokens);
    }

    return Promise.reject(null);
  }

  get defaultGasParam() {
    return gas;
  }

  get defaultGasPriceGwei(): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        this.http.get(gasStationApi).toPromise().then(res => {
          if (res.ok) {
            resolve(JSON.parse(res.text())['fast'].toString() + '00000000');
          } else {
            resolve('11000000000');
          }
        });
      } catch (e) {
        resolve('11000000000');
      }
    });
  }

  createContractInstance(abi, address) {
    return new this.web3js.eth.Contract(abi, address);
  }

  getTransactionReceiptMined(txHash, interval = 500, blockLimit = 0): Promise<any> {
    const transactionReceiptAsync = (resolve, reject) => {
      this.web3js.eth.getTransactionReceipt(txHash, (error, receipt) => {
        if (error) {
          return reject(error);
        }

        if (receipt == null) {
          setTimeout(() => transactionReceiptAsync(resolve, reject), interval);
          return;
        }

        resolve(receipt);
      });
    };

    return new Promise(transactionReceiptAsync);
  }
}
