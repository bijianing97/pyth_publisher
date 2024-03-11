import axios from "axios";
import Decimal from "decimal.js";
import { Provider } from "./Iprovider";
import { logger } from "../logger";
import { retry } from "../util";

type Coin = {
  pythSymbol: string;
  coingeckoId: string;
  coingeckoVcCurrencie: string;
};

export type CoingeckoConfig = {
  coins: Coin[];
  coingeckoUpdateInterval: number;
};

type CoingeckoConfigWithApiKey = CoingeckoConfig & {
  coingeckoApiKey: string;
};

export class CoingeckoProvider implements Provider {
  private symbolToCoin: Map<string, Coin> = new Map();
  private apiKey: string;
  private prices: Map<string, Decimal> = new Map();
  private updateInterval: number;

  private resolves = new Set<() => void>();
  private stopped = false;
  private coingeckoUpdateLoop: Promise<void> = Promise.resolve();
  private count = 0;

  constructor(config: CoingeckoConfigWithApiKey) {
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

    const prices = await retry(() =>
      this.getPriceFromApi(ids, Array.from(vsCurrenciesSet), "18")
    );

    for (const [symbol, product] of this.symbolToCoin.entries()) {
      const price = new Decimal(
        prices[product.coingeckoId][product.coingeckoVcCurrencie]
      );
      this.prices.set(symbol, price);
    }
    logger.info("CoingeckoProvider", "updatePrice", this.prices, this.count);
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

  private async loop(interval: number, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (err) {
      logger.error("catch error:", err);
    }

    while (!this.stopped) {
      const now = Math.floor(Date.now() / 1000);
      const next = Math.ceil(now / interval) * interval;

      logger.info("interval:", next - now, "next:", next);

      let _r!: () => void;

      await new Promise<void>((r) => {
        this.resolves.add((_r = r));
        setTimeout(r, (next - now) * 1000);
      }).finally(() => this.resolves.delete(_r));

      if (this.stopped) {
        break;
      }

      try {
        await fn();
      } catch (err) {
        logger.error("catch error:", err);
      }

      // sleep a while...
      await new Promise<void>((r) => setTimeout(r, 1000));
      this.count++;
    }
  }

  start() {
    this.coingeckoUpdateLoop = this.loop(
      this.updateInterval,
      this.updatePrice.bind(this)
    );
  }

  async init() {
    await this.updatePrice();
  }

  async stop() {
    this.stopped = true;
    this.resolves.forEach((r) => r());
    await this.coingeckoUpdateLoop;
    logger.info("CoingeckoProvider", "stop", "stopped");
  }
}

// async function main() {
//   const provider = new CoinGeckoProvider("");
//   const price = await provider.getPriceFromApi(["bitcoin"], ["usd,eth"], "18");
//   console.log(price);
// }

// main();
