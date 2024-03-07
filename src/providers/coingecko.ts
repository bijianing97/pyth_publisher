import axios from "axios";
import Decimal from "decimal.js";
import { Provider } from "./Iprovider";

type Product = {
  pythSymbol: string;
  coingeckoId: string;
  coingeckoVcCurrencie: string;
};

type CoingeckoConfig = {
  products: Product[];
  coingeckoApiKey: string;
  confidenceRatioBps: number;
  coingeckoUpdateInterval: number;
};

export class CoingeckoProvider implements Provider {
  private symbolToProduct: Map<string, Product> = new Map();
  private apiKey: string;
  private confidenceRatioBps: number;
  private prices: Map<string, Decimal> = new Map();

  updateInterval: number;

  constructor(config: CoingeckoConfig) {
    this.apiKey = config.coingeckoApiKey;
    this.updateInterval = config.coingeckoUpdateInterval;
    this.confidenceRatioBps = config.confidenceRatioBps;
    for (const product of config.products) {
      this.symbolToProduct.set(product.pythSymbol, product);
    }
  }

  async updatePrice() {
    const ids = Array.from(this.symbolToProduct.values()).map(
      (p) => p.coingeckoId
    );
    const vsCurrencies = Array.from(this.symbolToProduct.values()).map(
      (p) => p.coingeckoVcCurrencie
    );
    const vsCurrenciesSet = new Set(vsCurrencies);
    const prices = await this.getPriceFromApi(
      ids,
      Array.from(vsCurrenciesSet),
      "18"
    );
    for (const [symbol, product] of this.symbolToProduct.entries()) {
      const price = new Decimal(
        prices[product.coingeckoId][product.coingeckoVcCurrencie]
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

  async getPriceFromApi(
    ids: string[],
    vs_currencies: string[],
    precision?: string
  ) {
    const headers = {
      "x-cg-pro-api-key": this.apiKey,
    };

    const params = {
      ids: ids.join(","),
      vs_currencies: vs_currencies.join(","),
      precision: precision,
    };

    const response = await axios.get(
      "https://pro-api.coingecko.com/api/v3/simple/price",
      {
        headers,
        params,
      }
    );

    return response.data;
  }
}

// async function main() {
//   const provider = new CoinGeckoProvider("");
//   const price = await provider.getPriceFromApi(["bitcoin"], ["usd,eth"], "18");
//   console.log(price);
// }

// main();
