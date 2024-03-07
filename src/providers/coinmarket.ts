/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { Provider } from "./Iprovider";

export class CoinMarketProvider {
  private apiKey: string;
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getPrice(symbols: string[], vs_currencies: string[]) {
    const headers = {
      "x-cmc_pro_api_key": this.apiKey,
    };

    const params = {
      symbol: symbols.join(","),
      convert: vs_currencies.join(","),
    };

    const response = await axios.get(
      "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest",
      {
        headers,
        params,
      }
    );

    const data = response.data.data;
    const result = {};
    for (const symbol of symbols) {
      result[symbol] = {};
      for (const vs_currency of vs_currencies) {
        result[symbol][vs_currency] = data[symbol].quote[vs_currency].price;
      }
    }

    return result;
  }
}

async function main() {
  const provider = new CoinMarketProvider("");
  const data = await provider.getPrice(["BTC", "ETH"], ["USD", "BTC"]);
  console.log(data);
}

main();
