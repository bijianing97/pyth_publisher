import { logger } from "./logger";
import { retry } from "./util";
import EventEmitter from "events";
import {
  Provider,
  CoingeckoConfig,
  CoinmarketConfig,
  CointractsConfig,
  CoingeckoProvider,
  CoinmarketProvider,
  ContractsProvider,
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

export type PublisherConfig = {
  url: string;
  confidenceRatioBps: number;
  pythSymbolToRatio: Record<string, Record<string, number>>;
  coingecko?: CoingeckoConfig;
  coinmarket?: CoinmarketConfig;
  contracts?: CointractsConfig;
};

export class Publisher extends EventEmitter {
  private providers: Record<string, Provider> = {};

  private subscriptionToProduct: Map<number, ProductWithsubscription> =
    new Map();
  private symbolToRatio: Record<string, Record<string, number>> = {};

  private confidenceRatioBps: number;
  private stopped = false;
  jsonrpc: JSONRPCWebSocket;

  constructor(config: PublisherConfig) {
    super();
    this.confidenceRatioBps = config.confidenceRatioBps;
    this.jsonrpc = new JSONRPCWebSocket(new WebSocket({ url: config.url }));
    Object.keys(config.pythSymbolToRatio).forEach((key) => {
      const newKey = key.replace("=", ".");
      this.symbolToRatio[newKey] = config.pythSymbolToRatio[key];
    });

    if (config.coingecko && process.env["COINGECKO_API_KEY"]) {
      this.providers.coingecko = new CoingeckoProvider({
        ...config.coingecko,
        coingeckoApiKey: process.env["COINGECKO_API_KEY"],
      });
    }
    if (config.coinmarket && process.env["COINMARKET_API_KEY"]) {
      this.providers.coinmarket = new CoinmarketProvider({
        ...config.coinmarket,
        coinmarketApiKey: process.env["COINMARKET_API_KEY"],
      });
    }
    if (config.contracts) {
      this.providers.contracts = new ContractsProvider(config.contracts);
    }
  }

  // Get the mixed price of the product, the mixed price is the weighted average of the prices from the providers
  mixLatestPrice(symbol: string) {
    let price = new Decimal(0);
    const priceInfo: Record<string, { ratio: string; price: Decimal }> = {};
    const ratioInfo = this.symbolToRatio[symbol];
    if (ratioInfo === undefined) {
      throw new Error(`unknown symbol: ${symbol}`);
    }
    const denominator = Object.values(ratioInfo).reduce((a, b) => a + b, 0);
    for (const [provider, ratio] of Object.entries(ratioInfo)) {
      if (this.providers[provider] === undefined) {
        throw new Error(`Can't find provider ${provider}`);
      }
      let providerPrice = this.providers[provider].latestPrice(symbol);
      if (providerPrice === undefined) {
        throw new Error(`Can't get price from ${provider} for ${symbol}`);
      }

      if (provider === "contracts") {
        const covertProvider = this.providers.contracts.covertProvider(symbol);
        if (covertProvider === undefined) {
          throw new Error(`Can't find convert provider for ${provider}`);
        }
        const convertPrice = this.providers[
          covertProvider.convertProvider
        ].latestPrice(covertProvider.convertSymbol);
        if (convertPrice === undefined) {
          throw new Error(
            `Can't get convert ${covertProvider} price for Oracle`
          );
        }
        providerPrice = providerPrice.mul(convertPrice);
      }

      price = price.add(providerPrice.mul(ratio).div(denominator));
      const ratioWithDenominator = `${ratio}/${denominator}`;
      priceInfo[provider] = {
        ratio: ratioWithDenominator,
        price: providerPrice,
      };
    }
    return { price, priceInfo };
  }

  // jsonRpc methods
  // Update the price of the product to the Pyth agent
  private async updatePrice(
    account: string,
    price: number,
    conf: number,
    status: string
  ) {
    await this.jsonrpc.request("update_price", [account, price, conf, status]);
  }

  private async getProductList() {
    const result = await retry(() =>
      this.jsonrpc.request("get_product_list", [])
    );
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

  // Subscribe to the price schedule of the product to the Pyth agent
  private async subscribePriceSched(account: string) {
    const result = await retry(() =>
      this.jsonrpc.request("subscribe_price_sched", [account])
    );
    return result.subscription;
  }

  private async onNotify(method: string, params: any) {
    try {
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
        priceInfo: Record<string, { ratio: string; price: Decimal }>;
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
       mixed price info: mixed price is :${priceResult.price}  ${JSON.stringify(
          priceResult.priceInfo
        )}`
      );

      await this.updatePrice(
        product.priceAccount,
        scalePrice.toNumber(),
        scaleConf.toNumber(),
        "trading"
      );
    } catch (err) {
      logger.error("onNotify error:", err);
    }
  }

  // subscribe to the price schedule of the product in connected event
  private async onConneted() {
    try {
      // this.subscriptionToProduct sweep
      this.subscriptionToProduct = new Map();

      const products = await this.getProductList();
      const symbolsToSubscribe = Object.keys(this.symbolToRatio);
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
    } catch (err) {
      logger.error("Publisher", "subscribe price sched error", err);
      await new Promise((r) => setTimeout(r, 1000));
      this.jsonrpc.ws.reconnect();
    }
  }

  // Initialize the providers
  async init() {
    await Promise.all(Object.values(this.providers).map((p) => p.init()));
  }

  // Start the providers
  start() {
    for (const provider of Object.values(this.providers)) {
      provider.start();
    }
    this.jsonrpc.start();
    this.jsonrpc.ws.on("connected", this.onConneted.bind(this));
    this.jsonrpc.on("notify", this.onNotify.bind(this));
  }

  // Stop the providers
  async stop() {
    this.stopped = true;
    this.jsonrpc.off("notify", this.onNotify);
    this.jsonrpc.off("connected", this.onConneted);
    this.jsonrpc.stop();
    await Promise.all(Object.values(this.providers).map((p) => p.stop()));
  }
}
