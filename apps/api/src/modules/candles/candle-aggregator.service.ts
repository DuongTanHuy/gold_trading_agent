import { Injectable, Logger } from "@nestjs/common";
import { CandleTimeframe, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.module";
import { MarketPrice } from "../market-data/interfaces/market-price.interface";
import { MarketDataGateway } from "../market-data/market-data.gateway";

const TIMEFRAMES: { name: CandleTimeframe; ms: number }[] = [
  { name: "M1", ms: 60_000 },
  { name: "M5", ms: 300_000 },
  { name: "M15", ms: 900_000 },
  { name: "H1", ms: 3_600_000 },
  { name: "H4", ms: 14_400_000 },
  { name: "D1", ms: 86_400_000 },
];

@Injectable()
export class CandleAggregatorService {
  private readonly logger = new Logger(CandleAggregatorService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MarketDataGateway,
  ) {}

  async addTick(tick: MarketPrice) {
    const price = new Prisma.Decimal(tick.price);
    for (const timeframe of TIMEFRAMES) {
      const bucketMs =
        Math.floor(tick.publishTime.getTime() / timeframe.ms) * timeframe.ms;
      const openTime = new Date(bucketMs);
      const key = {
        symbol_timeframe_openTime: {
          symbol: tick.symbol,
          timeframe: timeframe.name,
          openTime,
        },
      };
      const existing = await this.prisma.marketCandle.findUnique({
        where: key,
      });
      if (!existing) {
        const created = await this.prisma.marketCandle.create({
          data: {
            symbol: tick.symbol,
            timeframe: timeframe.name,
            openTime,
            open: price,
            high: price,
            low: price,
            close: price,
            tickCount: 1,
            lastTickTime: tick.publishTime,
            isComplete: false,
          },
        });
        this.gateway.emitCandle(this.serialize(created));
        continue;
      }
      // A late/out-of-order tick may update high/low, but must not move close backwards.
      const isNewer =
        tick.publishTime.getTime() >= existing.lastTickTime.getTime();
      const updated = await this.prisma.marketCandle.update({
        where: key,
        data: {
          high: Prisma.Decimal.max(existing.high, price),
          low: Prisma.Decimal.min(existing.low, price),
          ...(isNewer ? { close: price, lastTickTime: tick.publishTime } : {}),
          tickCount: { increment: 1 },
        },
      });
      this.gateway.emitCandle(this.serialize(updated));
    }
  }

  async getCandles(
    symbol: string,
    timeframe: CandleTimeframe,
    limit: number,
    from?: Date,
    to?: Date,
  ) {
    return this.prisma.marketCandle
      .findMany({
        where: {
          symbol,
          timeframe,
          ...(from || to
            ? {
                openTime: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              }
            : {}),
        },
        orderBy: { openTime: "desc" },
        take: limit,
      })
      .then((rows) => rows.reverse().map((row) => this.serialize(row)));
  }

  async markClosedCandles(now = new Date()) {
    for (const timeframe of TIMEFRAMES) {
      const currentBucket =
        Math.floor(now.getTime() / timeframe.ms) * timeframe.ms;
      await this.prisma.marketCandle.updateMany({
        where: {
          timeframe: timeframe.name,
          isComplete: false,
          openTime: { lt: new Date(currentBucket) },
        },
        data: { isComplete: true },
      });
    }
  }

  private serialize(row: any) {
    return {
      ...row,
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
    };
  }
}
