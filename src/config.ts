export const providerConfig = {
  url: "ws://127.0.0.1:8910",
  confidenceRatioBps: 10,
  pythSymbolToRatio: {
    // "Crypto.USDB/USD": {
    //   coinmarket: 50,
    //   coingecko: 50,
    // },
    "Crypto.USDB/USD": {
      contracts: 100,
    },
    "Crypto.BTC/USD": {
      coinmarket: 50,
      coingecko: 50,
    },
    "Crypto.ETH/USD": {
      coinmarket: 50,
      coingecko: 50,
    },
    "Crypto.SOL/USD": {
      coinmarket: 50,
      coingecko: 50,
    },
    "Crypto.AVAX/USD": {
      coinmarket: 50,
      coingecko: 50,
    },
    "Crypto.ETH/BTC": {
      coinmarket: 50,
      coingecko: 50,
    },
    "Crypto.MATIC/USD": {
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
      {
        pythSymbol: "Crypto.ETH/USD",
        coingeckoId: "ethereum",
        coingeckoVcCurrencie: "usd",
      },
      {
        pythSymbol: "Crypto.SOL/USD",
        coingeckoId: "solana",
        coingeckoVcCurrencie: "usd",
      },
      {
        pythSymbol: "Crypto.AVAX/USD",
        coingeckoId: "avalanche-2",
        coingeckoVcCurrencie: "usd",
      },
      {
        pythSymbol: "Crypto.ETH/BTC",
        coingeckoId: "ethereum",
        coingeckoVcCurrencie: "btc",
      },
      {
        pythSymbol: "Crypto.MATIC/USD",
        coingeckoId: "matic-network",
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
        coinmarketId: "29599",
        coinmarketConvertId: "2781",
      },
      {
        pythSymbol: "Crypto.BTC/USD",
        coinmarketId: "1",
        coinmarketConvertId: "2781",
      },
      {
        pythSymbol: "Crypto.ETH/USD",
        coinmarketId: "1027",
        coinmarketConvertId: "2781",
      },
      {
        pythSymbol: "Crypto.SOL/USD",
        coinmarketId: "5426",
        coinmarketConvertId: "2781",
      },
      {
        pythSymbol: "Crypto.AVAX/USD",
        coinmarketId: "5805",
        coinmarketConvertId: "2781",
      },
      {
        pythSymbol: "Crypto.ETH/BTC",
        coinmarketId: "1027",
        coinmarketConvertId: "1",
      },
      {
        pythSymbol: "Crypto.MATIC/USD",
        coinmarketId: "3890",
        coinmarketConvertId: "2781",
      },
    ],
    coinmarketUpdateInterval: 10,
    coinmarketApiKey: "",
  },
  contracts: {
    coins: [
      {
        pythSymbol: "Crypto.USDB/USD",
        networkId: 81457, //Blast
        uniswapV3OracleConfig: {
          pool: {
            address: "0xf00DA13d2960Cf113edCef6e3f30D92E52906537",
            token0: {
              address: "0x4300000000000000000000000000000000000003",
              decimals: 18,
              symbol: "USDB",
              name: "USDB",
            },
            token1: {
              address: "0x4300000000000000000000000000000000000004",
              decimals: 18,
              symbol: "WETH",
              name: "Wrapped Ether",
            },
            fee: 3000,
          },
          timeInterval: 300,
          blockTime: 2,
        },
        getInterval: 10,
      },
    ],
  },
};
