import { Controller, Get, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.module";
import { LatestPriceQueryDto } from "./dto/latest-price.dto";
import { MarketTicksQueryDto } from "./dto/market-ticks-query.dto";
import { MarketDataService } from "./market-data.service";

@Controller("market")
export class MarketDataController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly market: MarketDataService,
    private readonly config: ConfigService,
  ) {}

  @Get("price")
  async latestPrice(@Query() query: LatestPriceQueryDto) {
    const symbol = query.symbol ?? "XAUUSD";
    const cached = this.market.getLatestInMemory();
    if (cached?.symbol === symbol) {
      return {
        ...cached,
        ageMs: Date.now() - cached.publishTime.getTime(),
        isFresh:
          Date.now() - cached.publishTime.getTime() <=
          (this.config.get<number>("PYTH_STALE_AFTER_MS", 60000) as number),
      };
    }
    const tick = await this.prisma.marketTick.findFirst({
      where: { symbol },
      orderBy: { publishTime: "desc" },
    });
    if (!tick)
      return {
        symbol,
        status: "NO_DATA",
        price: null,
        publishTime: null,
        isFresh: false,
      };
    const ageMs = Date.now() - tick.publishTime.getTime();
    return {
      symbol,
      price: Number(tick.price),
      confidence: tick.confidence ? Number(tick.confidence) : null,
      publishTime: tick.publishTime,
      receivedAt: tick.receivedAt,
      ageMs,
      isFresh:
        ageMs <=
        (this.config.get<number>("PYTH_STALE_AFTER_MS", 60000) as number),
    };
  }

  @Get("ticks")
  async ticks(@Query() query: MarketTicksQueryDto) {
    const where: Prisma.MarketTickWhereInput = {
      symbol: query.symbol,
      ...(query.from || query.to
        ? {
            publishTime: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const rows = await this.prisma.marketTick.findMany({
      where,
      orderBy: { publishTime: "desc" },
      take: query.limit,
    });
    return rows.map((row) => ({
      ...row,
      price: Number(row.price),
      confidence: row.confidence ? Number(row.confidence) : null,
    }));
  }
}
