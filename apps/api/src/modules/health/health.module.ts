import { Controller, Get, Module } from "@nestjs/common";
import { PrismaModule, PrismaService } from "../../database/prisma.module";
import { MarketDataModule } from "../market-data/market-data.module";
import { MarketDataService } from "../market-data/market-data.service";

@Controller("health")
class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly market: MarketDataService,
  ) {}

  @Get()
  async health() {
    let database: "ok" | "error" = "ok";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "error";
    }
    const latest = this.market.getLatestInMemory();
    return {
      status: database === "ok" ? "ok" : "degraded",
      database,
      collector: latest ? "receiving" : "waiting",
      latestPriceAt: latest?.publishTime ?? null,
    };
  }
}

@Module({
  imports: [PrismaModule, MarketDataModule],
  controllers: [HealthController],
})
export class HealthModule {}
