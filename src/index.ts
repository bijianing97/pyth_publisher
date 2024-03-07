import * as dotenv from "dotenv";
import { Publisher } from "./publisher";
import { providerConfig } from "./config";

dotenv.config();

async function main() {
  providerConfig.coingecko.coingeckoApiKey = process.env.coingeckoApi!;
  providerConfig.coinmarket.coinmarketApiKey = process.env.coinmarketApi!;
  const publisher = new Publisher(providerConfig);
  await publisher.init();
  publisher.start();
}

main();
