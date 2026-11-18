import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import WebSocket from "ws";
import { MarketPrice } from "../interfaces/market-price.interface";

const PYTH_ENDPOINTS = [
  "wss://pyth-lazer-0.dourolabs.app/v1/stream",
  "wss://pyth-lazer-1.dourolabs.app/v1/stream",
  "wss://pyth-lazer-2.dourolabs.app/v1/stream",
];

@Injectable()
export class PythProvider implements OnModuleDestroy {
  private readonly logger = new Logger(PythProvider.name);
  private sockets: WebSocket[] = [];
  private reconnectTimers = new Map<number, NodeJS.Timeout>();
  private attempts = new Map<number, number>();
  private stopped = false;
  private onPrice?: (price: MarketPrice) => Promise<void> | void;
  private readonly apiKey: string;
  private readonly symbol: string;
  private readonly channel: string;
  private readonly baseDelay: number;
  private readonly maxDelay: number;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>("PYTH_API_KEY", "");
    this.symbol = this.config.get<string>("PYTH_SYMBOL", "Metal.XAU/USD");
    this.channel = this.config.get<string>("PYTH_CHANNEL", "fixed_rate@1000ms");
    this.baseDelay = this.config.get<number>("PYTH_RECONNECT_BASE_MS", 1000);
    this.maxDelay = this.config.get<number>("PYTH_RECONNECT_MAX_MS", 30000);
  }

  setPriceHandler(handler: (price: MarketPrice) => Promise<void> | void) {
    this.onPrice = handler;
  }

  start() {
    if (this.config.get<string>("COLLECTOR_ENABLED", "true") !== "true") {
      this.logger.warn("Collector disabled by COLLECTOR_ENABLED");
      return;
    }
    if (!this.apiKey || this.apiKey === "replace_me") {
      this.logger.error("PYTH_API_KEY is missing. Collector will not connect.");
      return;
    }
    PYTH_ENDPOINTS.forEach((_, index) => this.connect(index));
  }

  private connect(index: number) {
    if (this.stopped) return;
    const url = PYTH_ENDPOINTS[index];
    this.logger.log(`Connecting to Pyth endpoint ${index + 1}`);
    const ws = new WebSocket(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      handshakeTimeout: 15000,
    });
    this.sockets[index] = ws;

    ws.on("open", () => {
      this.attempts.set(index, 0);
      this.logger.log(`Connected to ${url}`);
      ws.send(
        JSON.stringify({
          type: "subscribe",
          subscriptionId: index + 1,
          channel: this.channel,
          formats: [],
          properties: [
            "price",
            "exponent",
            "confidence",
            "feedUpdateTimestamp",
          ],
          symbols: [this.symbol],
          deliveryFormat: "json",
          parsed: true,
        }),
      );
    });

    ws.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === "error" || message.type === "subscriptionError") {
          this.logger.error(
            `Pyth stream error: ${message.error ?? "unknown error"}`,
          );
          return;
        }
        if (message.type === "streamUpdated") this.handleUpdate(message);
      } catch (error) {
        this.logger.warn(
          `Unable to parse Pyth message: ${(error as Error).message}`,
        );
      }
    });

    ws.on("error", (error) =>
      this.logger.warn(`Pyth socket ${index + 1}: ${error.message}`),
    );
    ws.on("close", (code, reason) => {
      this.logger.warn(
        `Pyth socket ${index + 1} closed (${code}): ${reason.toString()}`,
      );
      this.scheduleReconnect(index);
    });
  }

  private handleUpdate(message: any) {
    const feeds = message?.parsed?.priceFeeds;
    if (!Array.isArray(feeds)) return;
    for (const feed of feeds) {
      const exponent = Number(feed.exponent);
      const mantissa = Number(feed.price);
      if (!Number.isFinite(exponent) || !Number.isFinite(mantissa)) continue;
      const price = mantissa * Math.pow(10, exponent);
      const confidenceRaw = feed.confidence;
      const confidence =
        confidenceRaw == null
          ? null
          : Number(confidenceRaw) * Math.pow(10, exponent);
      const timestampUs =
        feed.feedUpdateTimestamp ?? message.parsed.timestampUs;
      const timestampMs = Number(timestampUs) / 1000;
      if (
        !Number.isFinite(price) ||
        price <= 0 ||
        !Number.isFinite(timestampMs)
      )
        continue;
      const value: MarketPrice = {
        symbol: "XAUUSD",
        provider: "PYTH_LAZER",
        feedId: String(feed.priceFeedId ?? this.symbol),
        price,
        confidence,
        publishTime: new Date(timestampMs),
        receivedAt: new Date(),
      };
      Promise.resolve(this.onPrice?.(value)).catch((error) =>
        this.logger.error(`Price handler failed: ${(error as Error).message}`),
      );
    }
  }

  private scheduleReconnect(index: number) {
    if (this.stopped || this.reconnectTimers.has(index)) return;
    const attempt = (this.attempts.get(index) ?? 0) + 1;
    this.attempts.set(index, attempt);
    const delay =
      Math.min(
        this.maxDelay,
        this.baseDelay * Math.pow(2, Math.min(attempt - 1, 8)),
      ) + Math.floor(Math.random() * 500);
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(index);
      this.connect(index);
    }, delay);
    this.reconnectTimers.set(index, timer);
    this.logger.warn(`Reconnecting Pyth endpoint ${index + 1} in ${delay}ms`);
  }

  onModuleDestroy() {
    this.stopped = true;
    for (const timer of this.reconnectTimers.values()) clearTimeout(timer);
    this.reconnectTimers.clear();
    for (const socket of this.sockets) {
      if (
        socket &&
        (socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING)
      )
        socket.close();
    }
  }
}
