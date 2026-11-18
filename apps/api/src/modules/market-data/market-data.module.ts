import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { CandlesModule } from "../candles/candles.module";
import { MarketDataController } from "./market-data.controller";
import { PythIngestionBridge } from "./pyth-ingestion.bridge";
import { MarketDataService } from "./market-data.service";
import { PythProvider } from "./providers/pyth.provider";

@Module({
  imports: [PrismaModule, CandlesModule],
  controllers: [MarketDataController],
  providers: [MarketDataService, PythProvider, PythIngestionBridge],
  exports: [MarketDataService],
})
export class MarketDataModule {}
