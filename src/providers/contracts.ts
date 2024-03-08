/* eslint-disable @typescript-eslint/no-explicit-any */

import { Provider } from "./Iprovider";
import Decimal from "decimal.js";
import { logger } from "../logger/logger";
import { UniswapV3Oracle, UniswapV3OracleConfig } from "./uniswapV3Oracle";

type Coin = {
  pythSymbol: string;
  networkId: number;
  uniswapV3OracleConfig: UniswapV3OracleConfig;
  getInterval: number; // in seconds
};

export type CointractsConfig = {
  coins: Coin[];
};

type orcleWithInterval = {
  orcle: UniswapV3Oracle;
  getInterval: number;
};

export class ContractsProvider implements Provider {
  private prices: Map<string, Decimal> = new Map();
  private symbolToOracle: Map<string, orcleWithInterval> = new Map();

  private orcaleLoopList: Promise<void>[] = [];
  private resolves = new Set<() => void>();
  private stopped = false;
  private count = 0;

  constructor(config: CointractsConfig) {
    for (const coin of config.coins) {
      this.symbolToOracle.set(coin.pythSymbol, {
        orcle: new UniswapV3Oracle(coin.networkId, coin.uniswapV3OracleConfig),
        getInterval: coin.getInterval,
      });
    }
  }

  latestPrice(symbol: string) {
    const price = this.prices.get(symbol);
    return price;
  }

  async updateTwap(symol: string, oracle: UniswapV3Oracle) {
    const twap = (await oracle.getAverages()).twap;
    const twapDecimal = new Decimal(twap.toSignificant(6));
    this.prices.set(symol, twapDecimal);
    logger.info(
      "ContractsProvider",
      "updateTwap",
      symol,
      twapDecimal,
      this.count
    );
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
    for (const [symbol, oracleWithInterval] of this.symbolToOracle.entries()) {
      this.orcaleLoopList.push(
        this.loop(oracleWithInterval.getInterval, () =>
          this.updateTwap(symbol, oracleWithInterval.orcle)
        )
      );
    }
  }

  async stop() {
    this.stopped = true;
    this.resolves.forEach((r) => r());
    await Promise.all(this.orcaleLoopList);
  }
}
