import axios from "axios";

export class CoinGeckoProvider {
  private apiKey: string;
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getPrice(ids: string[], vs_currencies: string[], precision?: string) {
    const headers = {
      "x-cg-pro-api-key": this.apiKey,
    };

    const params = {
      ids: ids.join(","),
      vs_currencies: vs_currencies.join(","),
      precision: precision,
    };

    const response = await axios.get(
      "https://pro-api.coingecko.com/api/v3/simple/price",
      {
        headers,
        params,
      }
    );

    return response.data;
  }
}

// async function main() {
//   const provider = new CoinGeckoProvider("");
//   const price = await provider.simplePrice(["bitcoin"], ["usd,eth"], "18");
//   console.log(price);
// }

// main();
