import { Inject, Injectable, OnDestroy } from '@angular/core';
import { Http, Response } from '@angular/http';
import merge from 'lodash.merge';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';

import { Step } from '../canpay-wizard/canpay-wizard.component';

declare let require: any;
const Web3 = require('web3');
declare var window;

const gas = { gasPrice: '8000000000', gas: '210000' };
const gasStationApi = 'https://ethgasstation.info/json/ethgasAPI.json';

export enum WalletType {
  metaMask = 'MetaMask',
  trust = 'Trust'
}

export enum NetworkType {
  main = 'Mainnet',
  ropsten = 'Ropsten',
  rinkeby = 'Rinkeby',
  localhost = 'Localhost',
  unknown = 'Unknown'
}

export enum Web3LoadingStatus {
  loading = 'Wallet loading is in progress',
  unableToConnectToSelectedNetwork = 'Unable to connect to the selected network.', ',
  noMetaMask = 'Wallet is not connected.',
  noAccountsAvailable = 'Your wallet is locked or there are no accounts available.',
  wrongNetwork = 'Your wallet is connected to the wrong Network.',
  error = 'Something went wrong when connecting to your wallet',
  complete = 'Successfully connected to your wallet'
}

@Injectable()
export class EthService implements OnDestroy {
  web3js: any;
  accountInterval: any;
  netType: NetworkType;
  walletType: WalletType;
  ownerAccount: string;

  public web3Status = new BehaviorSubject<Web3LoadingStatus>(Web3LoadingStatus.loading);
  public web3Status$ = this.web3Status.asObservable();

  public account = new BehaviorSubject<string>(null);
  public account$ = this.account.asObservable();

  constructor(protected http: Http) {
    if (typeof window.ethereum !== 'undefined') {

      this.web3js = new Web3(window.ethereum);

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
        console.log('Web3Service: Error: ID');
        this.web3Status.next(Web3LoadingStatus.error);
      }
    } else {
      this.web3js = new Web3();
      this.web3Status.next(Web3LoadingStatus.noMetaMask);
    }

    setTimeout(() => {
      if (!this.netType) {
        this.web3Status.next(Web3LoadingStatus.unableToConnectToSelectedNetwork);
      }
    }, 5000);
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
    if ((this.conf.useTestNet && (this.netType === NetworkType.rinkeby
      || this.netType === NetworkType.ropsten || this.netType === NetworkType.unknown))
      || (!this.conf.useTestNet && this.netType === NetworkType.main)) {
      console.log('Web3Service: Is: ', this.netType);
      this.web3js.eth.getAccounts().then((accs: string[]) => {
        console.log('Web3Service: Got accounts: ' + JSON.stringify(accs));
        this.account.next(accs[0]);
        if (accs[0]) {
          this.ownerAccount = accs[0];
          this.web3Status.next(Web3LoadingStatus.complete);
        } else {
          window.ethereum.enable();
          this.web3Status.next(Web3LoadingStatus.noAccountsAvailable);
        }
        this.accountInterval = setInterval(() => this.checkAccountMetaMask(), 5000);
      });

      return;
    }

    this.web3Status.next(Web3LoadingStatus.wrongNetwork);
  }

  private checkAccountMetaMask() {
    this.web3js.eth.getAccounts().then((accs: string[]) => {
      if (accs[0] !== this.account.value) {
        this.account.next(accs[0]);
        if (accs[0] !== undefined) { // && (this.web3Status.value !== Web3LoadingStatus.complete)
          this.ownerAccount = accs[0];
          this.web3Status.next(Web3LoadingStatus.complete);
          return;
        }

        this.web3Status.next(Web3LoadingStatus.noAccountsAvailable);
      }
    });
  }

  async getEthBalanceAsync(userAddress: string = this.getOwnerAccount()): Promise<string> {
    const balance = await this.web3js.eth.getBalance(userAddress);
    if (balance) {
      console.log(balance);
      const tokens = this.web3js.utils.toBN(balance).toString();
      console.log('Eth Owned: ' + this.web3js.utils.fromWei(tokens, 'ether'));
      return Promise.resolve(tokens);
    }

    return Promise.reject(null);
  }

  getOwnerAccount() {
    if (this.web3Status.value === Web3LoadingStatus.noAccountsAvailable) {
      window.ethereum.enable().then(acc => {
        return acc[0];
      }).catch(e => {
        return this.ownerAccount;
      });
    } else {
      return this.ownerAccount;
    }
  }

  get defaultGasParam() {
    return gas;
  }

  getDefaultGasPriceGwei(): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        this.http.get(gasStationApi).toPromise().then(res => {
          if (res.ok) {
            resolve(JSON.parse(res.text())['fast'].toString() + '00000000');
          } else {
            resolve('11000000000');
          }
        }).catch(e => {
          resolve('11000000000');
        });
      } catch (e) {
        resolve('11000000000');
      }
    });
  }


  amountToERCTokens(amount, decimal) {
    return amount * Math.pow(10, decimal);
  }

  createContractInstance(abi, address) {
    if (!this.web3js) {
      console.log('Error createContractInstance, web3 provider not initialized');
      return;
    }
    return new this.web3js.eth.Contract(abi, address);
  }

  async payWithEther(amount: string, to: string): Promise<any> {
    const gasPrice = await this.getDefaultGasPriceGwei();
    const from = this.getOwnerAccount();
    return new Promise((resolve, reject) => {
      this.web3js.eth.sendTransaction({
        to,
        from: from,
        value: this.web3js.utils.toWei(amount.toString(), 'ether'),
        gasPrice: gasPrice
      }, async (err, txHash) => this.resolveTransaction(err, from, txHash, resolve, reject));
    });
  }

  async resolveTransaction(err, from, txHash, resolve, reject, onTxHash: Function = null) {
    if (err) {
      reject(err);
    } else {
      try {
        if (onTxHash) {
          onTxHash(txHash, from);
        }
        const receipt = await this.getTransactionReceiptMined(txHash);
        receipt.status = typeof (receipt.status) === 'boolean' ? receipt.status : this.web3js.utils.hexToNumber(receipt.status);
        resolve(receipt);
      } catch (e) {
        reject(e);
      }
    }
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
