import { Inject, Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';

import { GasService } from './gas.service';
import { toBaseUnit } from './utils';

declare let require: any;
const Web3 = require('web3');
declare var window;
declare var web3;


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
  unableToConnectToSelectedNetwork = 'Unable to connect to the selected network.',
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
  lastSeenAccount: string;

  public web3Status = new BehaviorSubject<Web3LoadingStatus>(Web3LoadingStatus.loading);
  public web3Status$ = this.web3Status.asObservable();

  public account = new BehaviorSubject<string>(null);
  public account$ = this.account.asObservable();

  constructor(@Inject('Config') private conf: any = {}, protected gasService: GasService) {
    if (window.ethereum || web3) {
      if (window.ethereum) {
        this.web3js = new Web3(window.ethereum);
      } else {
        this.web3js = new Web3(web3.currentProvider);
      }
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
    if (this.conf.netType === this.netType || !this.conf.netType) {
      console.log('Web3Service: Is: ', this.netType);
      this.web3js.eth.getAccounts().then((accs: string[]) => {
        console.log('Web3Service: Got accounts: ' + JSON.stringify(accs));
        this.account.next(accs[0]);
        if (accs[0]) {
          this.lastSeenAccount = accs[0];
          this.web3Status.next(Web3LoadingStatus.complete);
        } else {
          window.ethereum.enable();
          this.web3Status.next(Web3LoadingStatus.noAccountsAvailable);
        }
        this.accountInterval = setInterval(() => this.checkForAccounts(), 5000);
      });

      return;
    }

    this.web3Status.next(Web3LoadingStatus.wrongNetwork);
  }

  private checkForAccounts() {
    this.web3js.eth.getAccounts().then((accs: string[]) => {
      if (accs[0] !== this.account.value) {
        this.account.next(accs[0]);
        if (accs[0] !== undefined) {
          this.lastSeenAccount = accs[0];
          if (this.web3Status.value !== Web3LoadingStatus.complete) {
            this.web3Status.next(Web3LoadingStatus.complete);
          }
          return;
        }

        this.web3Status.next(Web3LoadingStatus.noAccountsAvailable);
      }
    });
  }

  async getEthBalanceAsync(userAddress: string = this.currentAccount): Promise<string> {
    const balance = await this.web3js.eth.getBalance(userAddress);
    if (balance) {
      console.log(balance);
      const tokens = this.web3js.utils.toBN(balance).toString();
      console.log('Eth Owned: ' + this.web3js.utils.fromWei(tokens, 'ether'));
      return Promise.resolve(tokens);
    }

    return Promise.reject(null);
  }

  get currentAccount() {
    if (this.web3Status.value === Web3LoadingStatus.noAccountsAvailable) {
      window.ethereum.enable().then(acc => {
        return acc[0];
      }).catch(e => {
        return this.lastSeenAccount;
      });
    } else {
      return this.lastSeenAccount;
    }
  }

  createContractInstance(abi, address) {
    if (!this.web3js) {
      console.log('Error createContractInstance, web3 provider not initialized');
      return;
    }
    return new this.web3js.eth.Contract(abi, address);
  }

  async payWithEther(amount: string, to: string): Promise<any> {
    const gasPrice = await this.gasService.getDefaultGasPriceGwei();
    const from = this.currentAccount;
    return new Promise((resolve, reject) => {
      this.web3js.eth.sendTransaction({
        to,
        from: from,
        value: this.web3js.utils.toWei(amount.toString(), 'ether'),
        gasPrice: gasPrice
      }, async (err, txHash) => this.resolveTransaction(err, from, txHash, resolve, reject));
    });
  }

  async payWithErc20Token(abi, recipient: string, amount: number, address, decimal, gasPrice): Promise<any> {
    const from = this.currentAccount;
    const contract = this.createContractInstance(abi, address);
    const amountWithDecimals = this.amountToERCTokens(amount, decimal);

    return new Promise(async (resolve, reject) => {
      const tx = await contract.methods.transfer(recipient, amountWithDecimals);
      let txGas, txGasPrice;
      try {
        txGas = await tx.estimateGas({ from });
        txGasPrice = await this.gasService.getDefaultGasPriceGwei();
      } catch (e) {
        reject(e);
      }
      tx.send({ from, gas: txGas, gasPrice: txGasPrice },
        async (err, txHash) => this.resolveTransaction(err, from, txHash, resolve, reject));
    });
  }

  amountToERCTokens(amount, decimal): string {
    return toBaseUnit(amount, decimal, this.web3js.utils.BN);
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
