/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { Provider } from "./Iprovider";
import Decimal from "decimal.js";
import { logger } from "../logger/logger";

type Coin = {
  pythSymbol: string;
  coinmarketSymbol: string;
  coinmarketConvert: string;
};

export type CoinmarketConfig = {
  coins: Coin[];
  coinmarketApiKey: string;
  coinmarketUpdateInterval: number;
};

export class CoinmarketProvider implements Provider {
  private symbolToCoin: Map<string, Coin> = new Map();
  private apiKey: string;
  private prices: Map<string, Decimal> = new Map();
  updateInterval: number;

  constructor(config: CoinmarketConfig) {
    this.apiKey = config.coinmarketApiKey;
    this.updateInterval = config.coinmarketUpdateInterval;
    for (const coin of config.coins) {
      this.symbolToCoin.set(coin.pythSymbol, coin);
    }
  }

  async updatePrice() {
    const symbols = Array.from(this.symbolToCoin.values()).map(
      (p) => p.coinmarketSymbol
    );
    const converts = Array.from(this.symbolToCoin.values()).map(
      (p) => p.coinmarketConvert
    );
    const convetsSet = new Set(converts);
    const prices = await this.getPriceFromApi(symbols, Array.from(convetsSet));
    for (const [symbol, product] of this.symbolToCoin.entries()) {
      const price = new Decimal(
        prices[product.coinmarketSymbol][product.coinmarketConvert]
      );
      this.prices.set(symbol, price);
    }
    logger.info("CoinmarketProvider", "updatePrice", this.prices);
  }

  latestPrice(symbol: string) {
    const price = this.prices.get(symbol);
    return price;
  }

  async getPriceFromApi(symbols: string[], vs_currencies: string[]) {
    const headers = {
      "x-cmc_pro_api_key": this.apiKey,
    };

    const params = {
      symbol: symbols.join(","),
      convert: vs_currencies.join(","),
    };

    const response = await axios.get(
      "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest",
      {
        headers,
        params,
      }
    );

    const data = response.data.data;
    const result = {};
    for (const symbol of symbols) {
      result[symbol] = {};
      for (const vs_currency of vs_currencies) {
        result[symbol][vs_currency] = data[symbol].quote[vs_currency].price;
      }
    }

    return result;
  }
}

// async function main() {
//   const provider = new CoinmarketProvider("");
//   const data = await provider.getPriceFromApi(["BTC", "ETH"], ["USD", "BTC"]);
//   console.log(data);
// }

// main();
