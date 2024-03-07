export const providerConfig = {
  url: "ws://127.0.0.1:8910",
  confidenceRatioBps: 10,
  pythSymbolToRatio: {
    "Crypto.USDB/USD": {
      coinmarket: 50,
      coingecko: 50,
    },
    "Crypto.BTC/USD": {
      coinmarket: 50,
      coingecko: 50,
    },
  },
  coingecko: {
    coins: [
      {
        pythSymbol: "Crypto.USDB/USD",
        coingeckoId: "usdb",
        coingeckoVcCurrencie: "usd",
      },
      {
        pythSymbol: "Crypto.BTC/USD",
        coingeckoId: "bitcoin",
        coingeckoVcCurrencie: "usd",
      },
    ],
    coingeckoUpdateInterval: 10,
    coingeckoApiKey: "",
  },
  coinmarket: {
    coins: [
      {
        pythSymbol: "Crypto.USDB/USD",
        coinmarketSymbol: "USDB",
        coinmarketConvert: "USD",
      },
      {
        pythSymbol: "Crypto.BTC/USD",
        coinmarketSymbol: "BTC",
        coinmarketConvert: "USD",
      },
    ],
    coinmarketUpdateInterval: 10,
    coinmarketApiKey: "",
  },
};
