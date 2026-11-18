import { Controller, Get, Query } from "@nestjs/common";
import { CandleTimeframe } from "@prisma/client";
import { CandlesQueryDto } from "./dto/candles-query.dto";
import { CandleAggregatorService } from "./candle-aggregator.service";

@Controller("market/candles")
export class CandlesController {
  constructor(private readonly candles: CandleAggregatorService) {}

  @Get()
  getCandles(@Query() query: CandlesQueryDto) {
    return this.candles.getCandles(
      query.symbol,
      query.timeframe as CandleTimeframe,
      query.limit,
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );
  }
}
