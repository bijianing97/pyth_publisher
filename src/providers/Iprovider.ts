import Decimal from "decimal.js";

export interface Provider {
  updateInterval: number;
  updatePrice(): Promise<void>;
  latestPrice(symbol: string): Decimal | undefined;
}
