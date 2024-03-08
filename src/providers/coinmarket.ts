/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { Provider } from "./Iprovider";
import Decimal from "decimal.js";
import { logger } from "../logger/logger";

type Coin = {
  pythSymbol: string;
  coinmarketId: string;
  coinmarketConvertId: string;
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
  private updateInterval: number;

  private resolves = new Set<() => void>();
  private stopped = false;
  private coinmarketUpdateLoop: Promise<void> = Promise.resolve();

  constructor(config: CoinmarketConfig) {
    this.apiKey = config.coinmarketApiKey;
    this.updateInterval = config.coinmarketUpdateInterval;
    for (const coin of config.coins) {
      this.symbolToCoin.set(coin.pythSymbol, coin);
    }
  }

  async updatePrice() {
    const symbols = Array.from(this.symbolToCoin.values()).map(
      (p) => p.coinmarketId
    );
    const converts = Array.from(this.symbolToCoin.values()).map(
      (p) => p.coinmarketConvertId
    );
    const convetsSet = new Set(converts);
    const prices = await this.getPriceFromApi(symbols, Array.from(convetsSet));
    for (const [symbol, product] of this.symbolToCoin.entries()) {
      const price = new Decimal(
        prices[product.coinmarketId][product.coinmarketConvertId]
      );
      this.prices.set(symbol, price);
    }
    logger.info("CoinmarketProvider", "updatePrice", this.prices);
  }

  latestPrice(symbol: string) {
    const price = this.prices.get(symbol);
    return price;
  }

  async getPriceFromApi(ids: string[], convertIds: string[]) {
    const headers = {
      "x-cmc_pro_api_key": this.apiKey,
    };

    const params = {
      id: ids.join(","),
      convert_id: convertIds.join(","),
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
    for (const id of ids) {
      result[id] = {};
      for (const convertId of convertIds) {
        result[id][convertId] = data[id].quote[convertId].price;
      }
    }

    return result;
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
      await new Promise<void>((r) => setTimeout(r, 10));
    }
  }

  start() {
    this.coinmarketUpdateLoop = this.loop(
      this.updateInterval,
      this.updatePrice.bind(this)
    );
  }

  async stop() {
    this.stopped = true;
    this.resolves.forEach((r) => r());
    await this.coinmarketUpdateLoop;
  }
}

// async function main() {
//   const provider = new CoinmarketProvider("");
//   const data = await provider.getPriceFromApi(["BTC", "ETH"], ["USD", "BTC"]);
//   console.log(data);
// }

// main();
