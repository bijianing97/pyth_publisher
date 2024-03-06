import { logger } from "./logger/logger";
import { Pyth } from "./pyth";

type Product = {
  symbol: string;
  product_account: string;
  price_account: string;
  exponent: number;
  subscription_id: number | undefined;
};

export class Publisher {
  private subscriptions: Map<number, Product> = new Map();
  private products: Product[] = [];
  private pyth: Pyth;

  constructor(endpoint: string) {
    this.pyth = new Pyth(endpoint, this.on_notify_price_sched.bind(this));
  }

  async on_notify_price_sched(subscription: number) {
    logger.info("subscribing to notify_price_sched");

    const newSubscriptions: typeof this.subscriptions = new Map();

    for (const product of this.products) {
      const subscription_id = await this.pyth.subscribe_price_sched(
        product.price_account
      );
      product.subscription_id = subscription_id;
      newSubscriptions.set(subscription_id, product);
    }
    this.subscriptions = newSubscriptions;
  }

  async start() {
    this.pyth.connect();
  }
}
