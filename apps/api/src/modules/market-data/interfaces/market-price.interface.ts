export interface MarketPrice {
  symbol: string;
  provider: "PYTH_LAZER";
  feedId: string;
  price: number;
  confidence: number | null;
  publishTime: Date;
  receivedAt: Date;
}
