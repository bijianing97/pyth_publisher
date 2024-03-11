/* eslint-disable @typescript-eslint/no-explicit-any */
import Decimal from "decimal.js";

export interface Provider {
  [x: string]: any;
  latestPrice(symbol: string): Decimal | undefined;
  start(): void;
  stop(): Promise<void>;
  init(): Promise<void>;
}
