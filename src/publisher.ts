import { logger } from "./logger/logger";
import { Pyth } from "./pyth";
import { Provider } from "./providers";

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
  private resolves = new Set<() => void>();
  private stopped = false;
  private providers: Provider[] = [];

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

  private async loop(interval: number, fn: () => Promise<void>) {
    while (!this.stopped) {
      const now = Math.floor(Date.now() / 1000);
      const next = Math.ceil(now / interval) * interval;

      logger.info("Pubulisher", "interval:", next - now, "next:", next);

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
        logger.error("Pubulisher", "catch error:", err);
      }

      // sleep a while...
      await new Promise<void>((r) => setTimeout(r, 1000));
    }
  }

  async start() {
    this.pyth.connect();
  }
}
