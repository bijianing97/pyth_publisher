import Decimal from "decimal.js";

export interface Provider {
  latestPrice(symbol: string): Decimal | undefined;
  start(): void;
  stop(): Promise<void>;
}
