import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { CandleAggregatorService } from "./candle-aggregator.service";

@Injectable()
export class CandlesScheduler {
  constructor(private readonly candles: CandleAggregatorService) {}
  @Cron("*/10 * * * * *")
  async closeOldCandles() {
    await this.candles.markClosedCandles();
  }
}
