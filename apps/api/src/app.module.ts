import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./database/prisma.module";
import { MarketDataModule } from "./modules/market-data/market-data.module";
import { CandlesModule } from "./modules/candles/candles.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env"] }),
    ScheduleModule.forRoot(),
    PrismaModule,
    MarketDataModule,
    CandlesModule,
    HealthModule,
  ],
})
export class AppModule {}
