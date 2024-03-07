import { logger } from "./logger/logger";
import EventEmitter from "events";
import {
  Provider,
  CoingeckoConfig,
  CoinmarketConfig,
  CoingeckoProvider,
  CoinmarketProvider,
} from "./providers";
import { JSONRPCWebSocket, WebSocket } from "./jsonRpcWebsoket";
import Decimal from "decimal.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Product = {
  symbol: string;
  productAccount: string;
  priceAccount: string;
  expoent: number;
};

type ProductWithsubscription = Product & { subscription?: number };

type PublisherConfig = {
  url: string;
  confidenceRatioBps: number;
  pythSymbolToRatio: Record<string, Record<string, number>>;
  coingecko: CoingeckoConfig;
  coinmarket: CoinmarketConfig;
};

export class Publisher extends EventEmitter {
  private providers: Record<string, Provider> = {};

  private subscriptionToProduct: Map<number, ProductWithsubscription> =
    new Map();
  private symbolToRoatio: Record<string, Record<string, number>>;

  private resolves = new Set<() => void>();
  private coingeckoUpdateLoop: Promise<void> | undefined;
  private coinmarketUpdateLoop: Promise<void> | undefined;

  private confidenceRatioBps: number;
  private stopped = false;
  rpcjson: JSONRPCWebSocket;

  constructor(config: PublisherConfig) {
    super();
    this.confidenceRatioBps = config.confidenceRatioBps;
    this.rpcjson = new JSONRPCWebSocket(new WebSocket({ url: config.url }));
    this.symbolToRoatio = config.pythSymbolToRatio;
    this.providers.coingecko = new CoingeckoProvider(config.coingecko);
    this.providers.coinmarket = new CoinmarketProvider(config.coinmarket);
  }

  mixLatestPrice(symbol: string) {
    let price = new Decimal(0);
    const priceInfo: Record<string, { ratio: number; price: Decimal }> = {};
    const ratioInfo = this.symbolToRoatio[symbol];
    if (ratioInfo === undefined) {
      throw new Error(`unknown symbol: ${symbol}`);
    }
    const denominator = Object.values(ratioInfo).reduce((a, b) => a + b, 0);
    for (const [provider, ratio] of Object.entries(ratioInfo)) {
      const providerPrice = this.providers[provider].latestPrice(symbol);
      if (providerPrice === undefined) {
        throw new Error(`Can't get price from ${provider} for ${symbol}`);
      }
      price = price.add(providerPrice.mul(ratio).div(denominator));
      priceInfo[provider] = { ratio, price: providerPrice };
    }
    return { price, priceInfo };
  }

  // jsonRpc methods
  private async updatePrice(
    account: string,
    price: number,
    conf: number,
    status: string
  ) {
    await this.rpcjson.request("update_price", [account, price, conf, status]);
  }

  private async getProductList() {
    const result = await this.rpcjson.request("get_product_list", []);
    const products: Product[] = [];
    for (const coin of result) {
      const product = {
        productAccount: coin.account,
        symbol: coin.attr_dict.symbol,
        priceAccount: coin.price[0].account,
        expoent: coin.price[0].price_exponent,
      };
      products.push(product);
    }
    return products;
  }

  private async subscribePriceSched(account: string) {
    const result = await this.rpcjson.request("subscribe_price_sched", [
      account,
    ]);
    return result.subscription;
  }

  private async onNotify(method: string, params: any) {
    if (method !== "notify_price_sched") {
      logger.warn(`unexpected method: ${method}`);
      return;
    }

    params as { subscription: number };

    logger.info(
      "Get price schedule notify  subscription is:",
      params.subscription
    );

    const product = this.subscriptionToProduct.get(params.subscription);
    if (product === undefined) {
      logger.warn(`unknown subscription: ${params.subscription}`);
      return;
    }
    let priceResult: {
      price: Decimal;
      priceInfo: Record<string, { ratio: number; price: Decimal }>;
    };
    try {
      priceResult = this.mixLatestPrice(product.symbol);
    } catch (err) {
      logger.error("mixLatestPrice error:", err);
      return;
    }

    // Scale the price and confidence interval using the Pyth exponent
    const scalePrice = priceResult.price.mul(10 ** -product.expoent);
    const scaleConf = priceResult.price
      .mul(this.confidenceRatioBps)
      .div(10000)
      .mul(10 ** -product.expoent);

    logger.info(
      `sending update_price price for ${
        product.symbol
      } price: ${scalePrice} conf: ${scaleConf} product_account: ${
        product.productAccount
      } price_account: ${product.priceAccount}
       mixed price info: ${JSON.stringify(priceResult.priceInfo)}`
    );

    await this.updatePrice(
      product.priceAccount,
      scalePrice.toNumber(),
      scaleConf.toNumber(),
      "trading"
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
      await new Promise<void>((r) => setTimeout(r, 10));
    }
  }

  async init() {
    this.rpcjson.start();

    const products = await this.getProductList();
    const symbolsToSubscribe = Object.keys(this.symbolToRoatio);
    for (const product of products) {
      if (symbolsToSubscribe.includes(product.symbol)) {
        const subscription = await this.subscribePriceSched(
          product.priceAccount
        );
        this.subscriptionToProduct.set(subscription, {
          ...product,
          subscription,
        });
      }
    }

    this.rpcjson.on("notify", this.onNotify.bind(this));
  }

  start() {
    this.coingeckoUpdateLoop = this.loop(
      this.providers.coingecko.updateInterval,
      () => this.providers.coingecko.updatePrice()
    );

    this.coinmarketUpdateLoop = this.loop(
      this.providers.coinmarket.updateInterval,
      () => this.providers.coinmarket.updatePrice()
    );
  }

  async stop() {
    this.stopped = true;

    this.resolves.forEach((r) => r());

    await this.coingeckoUpdateLoop;

    await this.coinmarketUpdateLoop;

    this.rpcjson.off("notify", this.onNotify);
    this.rpcjson.stop();
  }
}
