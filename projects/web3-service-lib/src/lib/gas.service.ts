import { Injectable } from '@angular/core';
import { Http, Response } from '@angular/http';

const gas = { gasPrice: '8000000000', gas: '210000' };
const gasStationApi = 'https://ethgasstation.info/json/ethgasAPI.json';

@Injectable({
  providedIn: 'root'
})
export class GasService {

  constructor(protected http: Http) { }

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
}
