/* eslint-disable @typescript-eslint/no-explicit-any */
import { ethers } from "ethers";
import { tickToPrice, Pool } from "@uniswap/v3-sdk";
import IUniswapV3PoolABI from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json";
import { Price, Token } from "@uniswap/sdk-core";
import * as w3c from "@derivation-tech/web3-core";
import { FeeAmount } from "@uniswap/v3-sdk";
import { TokenInfo } from "@synfutures/v3-sdk";

export interface UniswapV3OracleConfig {
  pool: {
    address: string;
    token0: TokenInfo;
    token1: TokenInfo;
    fee: FeeAmount;
  };
  timeInterval: number;
  blockTime: number;
}

function convertTokenInfo(chainId: number, token: TokenInfo): Token {
  return new Token(
    chainId,
    token.address,
    token.decimals,
    token.symbol,
    token.name
  );
}

// Observation type
export interface Observation {
  secondsAgo: number;
  tickCumulative: bigint;
  secondsPerLiquidityCumulativeX128: bigint;
}

function calculateTWAP(observations: Observation[], pool: Pool) {
  const diffTickCumulative =
    observations[0].tickCumulative - observations[1].tickCumulative;
  const secondsBetween =
    observations[1].secondsAgo - observations[0].secondsAgo;

  const averageTick = Number(diffTickCumulative / BigInt(secondsBetween));

  return tickToPrice(pool.token0, pool.token1, averageTick);
}

function calculateTWAL(observations: Observation[]): bigint {
  const diffSecondsPerLiquidityX128 =
    observations[0].secondsPerLiquidityCumulativeX128 -
    observations[1].secondsPerLiquidityCumulativeX128;

  const secondsBetween =
    observations[1].secondsAgo - observations[0].secondsAgo;
  const secondsBetweenX128 = BigInt(secondsBetween) << BigInt(128);

  return secondsBetweenX128 / diffSecondsPerLiquidityX128;
}

export class UniswapV3Oracle {
  ctx: w3c.ChainContext;
  config: UniswapV3OracleConfig;
  poolContract: ethers.Contract;

  constructor(chainId: number | string, config: UniswapV3OracleConfig) {
    this.config = config;
    this.ctx = w3c.ChainContext.getInstance(chainId);
    this.poolContract = new ethers.Contract(
      this.config.pool.address,
      IUniswapV3PoolABI.abi,
      this.ctx.provider
    );
  }

  async observe(secondsAgo: number): Promise<Observation[]> {
    const timestamps = [0, secondsAgo];

    const [tickCumulatives, secondsPerLiquidityCumulatives] =
      await this.ctx.retry<any>(() => this.poolContract.observe(timestamps));

    const observations: Observation[] = timestamps.map((time, i) => {
      return {
        secondsAgo: time,
        tickCumulative: BigInt(tickCumulatives[i]),
        secondsPerLiquidityCumulativeX128: BigInt(
          secondsPerLiquidityCumulatives[i]
        ),
      };
    });
    return observations;
  }
  async increaseObservationCardinalityNext(observationCardinalityNext: number) {
    return this.poolContract["increaseObservationCardinalityNext"](
      observationCardinalityNext
    );
  }

  async getAverages(): Promise<{
    twap: Price<Token, Token>;
    twal: bigint;
  }> {
    const secondsAgo = this.config.timeInterval;
    const observations: Observation[] = await this.observe(secondsAgo);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slot0 = await this.ctx.retry<any>(() => this.poolContract["slot0"]());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const liquidity = await this.ctx.retry<any>(() =>
      this.poolContract["liquidity"]()
    );
    const pool = new Pool(
      convertTokenInfo(this.ctx.chainId, this.config.pool.token0),
      convertTokenInfo(this.ctx.chainId, this.config.pool.token1),
      this.config.pool.fee,
      slot0.sqrtPriceX96,
      liquidity,
      slot0.tick
    );

    const twap = calculateTWAP(observations, pool);
    const twal = calculateTWAL(observations);

    return { twap, twal };
  }
}
