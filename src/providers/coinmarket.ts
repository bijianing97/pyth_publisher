/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { Provider } from "./Iprovider";
import Decimal from "decimal.js";

type Product = {
  pythSymbol: string;
  coinmarketSymbol: string;
  coinmarketConvert: string;
};

type CoinmarketConfig = {
  products: Product[];
  coinmarketApiKey: string;
  confidenceRatioBps: number;
  coinmarketUpdateInterval: number;
};

export class CoinmarketProvider implements Provider {
  private symbolToProduct: Map<string, Product> = new Map();
  private apiKey: string;
  private confidenceRatioBps: number;
  private prices: Map<string, Decimal> = new Map();
  updateInterval: number;

  constructor(config: CoinmarketConfig) {
    this.apiKey = config.coinmarketApiKey;
    this.updateInterval = config.coinmarketUpdateInterval;
    this.confidenceRatioBps = config.confidenceRatioBps;
    for (const product of config.products) {
      this.symbolToProduct.set(product.pythSymbol, product);
    }
  }

  async updatePrice() {
    const symbols = Array.from(this.symbolToProduct.values()).map(
      (p) => p.coinmarketSymbol
    );
    const converts = Array.from(this.symbolToProduct.values()).map(
      (p) => p.coinmarketConvert
    );
    const convetsSet = new Set(converts);
    const prices = await this.getPriceFromApi(symbols, Array.from(convetsSet));
    for (const [symbol, product] of this.symbolToProduct.entries()) {
      const price = new Decimal(
        prices[product.coinmarketSymbol][product.coinmarketConvert]
      );
      this.prices.set(symbol, price);
    }
  }

  latestPrice(symbol: string) {
    const price = this.prices.get(symbol);
    if (price === undefined) {
      return { price: new Decimal(0), confidence_ratio_bps: new Decimal(0) };
    }
    return {
      price: price,
      confidence_ratio_bps: price.mul(this.confidenceRatioBps).div(10000),
    };
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
