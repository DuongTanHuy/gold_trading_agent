import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.module";
import { MarketPrice } from "./interfaces/market-price.interface";
import { MarketDataGateway } from "./market-data.gateway";
import { CandleAggregatorService } from "../candles/candle-aggregator.service";

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private latest: MarketPrice | null = null;
  private ingestQueue: Promise<void> = Promise.resolve();
  private readonly staleAfterMs: number;
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MarketDataGateway,
    private readonly candles: CandleAggregatorService,
    private readonly config: ConfigService,
  ) {
    this.staleAfterMs = this.config.get<number>("PYTH_STALE_AFTER_MS", 60000);
  }

  onModuleInit() {
    /* provider handler is wired in MarketDataModule factory */
  }

  getLatestInMemory() {
    return this.latest;
  }

  ingest(price: MarketPrice): Promise<void> {
    const task = this.ingestQueue.then(() => this.persist(price));
    this.ingestQueue = task.catch((error) =>
      this.logger.error(`Tick ingestion failed: ${(error as Error).message}`),
    );
    return task;
  }

  private async persist(price: MarketPrice) {
    const age = Date.now() - price.publishTime.getTime();
    if (age < -5000 || age > this.staleAfterMs) {
      this.logger.warn(`Discarding stale/future tick; age=${age}ms`);
      return;
    }
    if (
      this.latest &&
      price.publishTime.getTime() <= this.latest.publishTime.getTime()
    )
      return;

    try {
      await this.prisma.marketTick.create({
        data: {
          symbol: price.symbol,
          provider: price.provider,
          feedId: price.feedId,
          price: new Prisma.Decimal(price.price),
          confidence:
            price.confidence == null
              ? null
              : new Prisma.Decimal(price.confidence),
          publishTime: price.publishTime,
          receivedAt: price.receivedAt,
        },
      });
    } catch (error) {
      if ((error as any)?.code === "P2002") return; // duplicate publish time/feed
      throw error;
    }

    this.latest = price;
    await this.candles.addTick(price);
    this.gateway.emitPrice(price);
  }
}
