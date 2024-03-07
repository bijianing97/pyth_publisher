import axios from "axios";
import Decimal from "decimal.js";
import { Provider } from "./Iprovider";

type Product = {
  symbol: string; //pythSymbol
  id: string; //coingeckoId
  vs_currencie: string; //coingeckoVsCurrencie
};

type CoingeckoConfig = {
  products: Product[];
  apiKey: string;
  confidenceRatioBps: number;
  updateInterval: number;
};

export class CoinGeckoProvider implements Provider {
  private symbolToProduct: Map<string, Product> = new Map();
  private apiKey: string;
  private confidenceRatioBps: number;
  private prices: Map<string, Decimal> = new Map();

  updateInterval: number;

  constructor(config: CoingeckoConfig) {
    this.apiKey = config.apiKey;
    this.updateInterval = config.updateInterval;
    this.confidenceRatioBps = config.confidenceRatioBps;
    for (const product of config.products) {
      this.symbolToProduct.set(product.symbol, product);
    }
  }

  async updatePrice() {
    const ids = Array.from(this.symbolToProduct.values()).map((p) => p.id);
    const vs_currencies = Array.from(this.symbolToProduct.values()).map(
      (p) => p.vs_currencie
    );
    const vs_currenciesSet = new Set(vs_currencies);
    const prices = await this.getPriceFromApi(
      ids,
      Array.from(vs_currenciesSet),
      "18"
    );
    for (const [symbol, product] of this.symbolToProduct.entries()) {
      const price = new Decimal(prices[product.id][product.vs_currencie]);
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
//   const price = await provider.simplePrice(["bitcoin"], ["usd,eth"], "18");
//   console.log(price);
// }

// main();
