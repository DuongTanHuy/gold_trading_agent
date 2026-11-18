import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MarketDataService } from "./market-data.service";
import { PythProvider } from "./providers/pyth.provider";

@Injectable()
export class PythIngestionBridge implements OnApplicationBootstrap {
  private readonly logger = new Logger(PythIngestionBridge.name);
  constructor(
    private readonly provider: PythProvider,
    private readonly market: MarketDataService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get<string>("COLLECTOR_ENABLED", "true") !== "true") {
      this.logger.warn("Collector disabled");
      return;
    }
    this.provider.setPriceHandler((price) => this.market.ingest(price));
    this.provider.start();
  }
}
