import config from "./config/config.main.json";
import WebSocket from "ws";
import { logger } from "../logger/logger";
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

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  connect() {
    this.ws = new WebSocket(this.endpoint);
    this.ws.on("open", () => {
      logger.info("Pyth connection opened");
    });

    this.ws.on("message", (data) => {});

    this.ws.on("close", () => {
      logger.warn("Pyth connection closed");
      this.connect();
    });
  }
}
