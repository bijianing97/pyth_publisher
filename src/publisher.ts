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
  private confidenceRatioBps: number;
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
    for (const [provider, ratio] of Object.entries(ratioInfo)) {
      const providerPrice = this.providers[provider].latestPrice(symbol);
      if (providerPrice === undefined) {
        throw new Error(`Can't get price from ${provider} for ${symbol}`);
      }
      price = price.add(providerPrice.mul(ratio).div(100));
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
    await this.rpcjson.request("update_price", [
      { account: account, price: price, conf: conf, status: status },
    ]);
  }

  private async getProductList() {
    const result = await this.rpcjson.request("get_product_list", []);
    const products: Product[] = [];
    for (const coin of result) {
      const product = {
        productAccount: coin.account,
        symbol: coin.attr_dict.symbol,
        priceAccount: coin.prices[0].account,
        expoent: coin.prices[0].price_exponent,
      };
      products.push(product);
    }
    return products;
  }

  private async subscribePriceSched(account: string) {
    const result = await this.rpcjson.request("subscribe_price_sched", [
      { account: account },
    ]);
    return result.subscription;
  }

  private async onNotify(method: string, params: any) {
    if (method !== "notify_price_sched") {
      logger.warn(`unexpected method: ${method}`);
      return;
    }

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

  async init() {
    const products = await this.getProductList();
    const symbolsToSubscribe = Object.keys(this.symbolToRoatio);
    for (const product of products) {
      if (symbolsToSubscribe.includes(product.symbol)) {
        const subscription = await this.subscribePriceSched(
          product.productAccount
        );
        this.subscriptionToProduct.set(subscription, {
          ...product,
          subscription,
        });
      }
    }
  }
}
