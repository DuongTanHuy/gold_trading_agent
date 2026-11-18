import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server } from "socket.io";
import { MarketPrice } from "./interfaces/market-price.interface";

@WebSocketGateway({ namespace: "/market", cors: { origin: "*" } })
export class MarketDataGateway {
  @WebSocketServer() server!: Server;
  emitPrice(price: MarketPrice) {
    this.server?.emit("gold-price", price);
  }
  emitCandle(candle: unknown) {
    this.server?.emit("gold-candle", candle);
  }
}
