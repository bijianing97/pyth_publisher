import axios from "axios";
import Decimal from "decimal.js";
import { Provider } from "./Iprovider";

type Coin = {
  pythSymbol: string;
  coingeckoId: string;
  coingeckoVcCurrencie: string;
};

export type CoingeckoConfig = {
  coins: Coin[];
  coingeckoApiKey: string;
  coingeckoUpdateInterval: number;
};

export class CoingeckoProvider implements Provider {
  private symbolToCoin: Map<string, Coin> = new Map();
  private apiKey: string;
  private prices: Map<string, Decimal> = new Map();

  updateInterval: number;

  constructor(config: CoingeckoConfig) {
    this.apiKey = config.coingeckoApiKey;
    this.updateInterval = config.coingeckoUpdateInterval;
    for (const coin of config.coins) {
      this.symbolToCoin.set(coin.pythSymbol, coin);
    }
  }

  async updatePrice() {
    const ids = Array.from(this.symbolToCoin.values()).map(
      (p) => p.coingeckoId
    );
    const vsCurrencies = Array.from(this.symbolToCoin.values()).map(
      (p) => p.coingeckoVcCurrencie
    );
    const vsCurrenciesSet = new Set(vsCurrencies);
    const prices = await this.getPriceFromApi(
      ids,
      Array.from(vsCurrenciesSet),
      "18"
    );
    for (const [symbol, product] of this.symbolToCoin.entries()) {
      const price = new Decimal(
        prices[product.coingeckoId][product.coingeckoVcCurrencie]
      );
      this.prices.set(symbol, price);
    }
  }

  latestPrice(symbol: string) {
    const price = this.prices.get(symbol);
    return price;
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
