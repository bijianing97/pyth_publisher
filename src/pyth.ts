import config from "./providers/config/config.main.json";
import WebSocket from "ws";
import { logger } from "./logger/logger";

interface Price {
  account: string;
  priceExponent: number;
}

interface Metadata {
  symbol: string;
}

interface Product {
  account: string;
  metadata: Metadata;
  prices: Price[];
}

const TRADING = "trading";

export class Pyth {
  // Create a new WebSocket.
  private ws: WebSocket | null = null;
  private endpoint: string;
  on_notify_price_sched: (subscription: number) => void;

  constructor(
    endpoint: string,
    on_notify_price_sched: (subscription: number) => void
  ) {
    this.endpoint = endpoint;
    this.on_notify_price_sched = on_notify_price_sched;
  }

  connect() {
    this.ws = new WebSocket(this.endpoint);
    this.ws.on("open", () => {
      logger.info("Pyth connection connected at " + this.endpoint);
    });

    this.ws.on("close", () => {
      logger.warn("Pyth connection closed");
      // retry connection
      setTimeout(() => {
        this.connect();
      }, 1000);
    });

    this.ws!.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.method === "notify_price_sched") {
          resolve(msg.params[0]);
        }
      });
    });
  }

  async subscribe_price_sched(account: string) {
    return new Promise<number>((resolve, reject) => {
      this.ws!.send(
        JSON.stringify({
          method: "subscribe_price_sched",
          params: [account],
        })
      );

  }

  async update_price(
    account: string,
    price: number,
    conf: number,
    status: string
  ) {
    this.ws!.send(
      JSON.stringify({
        method: "update_price",
        params: [account, price, conf, status],
      })
    );
  }
}
