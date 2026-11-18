import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { MarketDataGateway } from "../market-data/market-data.gateway";
import { CandleAggregatorService } from "./candle-aggregator.service";
import { CandlesController } from "./candles.controller";
import { CandlesScheduler } from "./candles.scheduler";

@Module({
  imports: [PrismaModule],
  controllers: [CandlesController],
  providers: [CandleAggregatorService, CandlesScheduler, MarketDataGateway],
  exports: [CandleAggregatorService, MarketDataGateway],
})
export class CandlesModule {}
