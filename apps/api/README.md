# Gold Trading AI Agent — Sprint 1

NestJS + TypeScript + Pyth Lazer WebSocket + PostgreSQL/TimescaleDB + Socket.IO.

Sprint 1 collects XAU/USD reference prices, persists ticks, aggregates M1/M5/M15/H1/H4/D1 candles, and exposes REST + WebSocket updates. It does **not** place trades and does not yet call an LLM.

## Project structure

```text
src/
  database/                  Prisma service + Timescale hypertable setup
  modules/
    market-data/              Pyth provider, tick ingestion, REST, Socket.IO
    candles/                  Multi-timeframe aggregation + REST + close scheduler
    health/                   Database/collector health endpoint
prisma/schema.prisma          Tick and candle models
 docker-compose.yml           TimescaleDB + Redis + optional API profile
Dockerfile                    Multi-stage NestJS image
```

## 0. Requirements

- Node.js 20+
- Docker Desktop / Docker Engine + Compose
- A Pyth Lazer API key with access to the `Metal.XAU/USD` feed

Pyth documentation: https://docs.pyth.network/api-reference/real-time-prices/stream

## 1. Start infrastructure

```bash
cp .env.example .env
# Edit .env and set PYTH_API_KEY. Keep this key on the backend only.
docker compose up -d
```

Optional: run the API container as well (instead of `npm run dev` on the host):

```bash
docker compose --profile app up --build -d
```

## 2. Install and initialize

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run db:setup:dev
```

`prisma db push` creates the tables. `db:setup:dev` converts `market_ticks` and `market_candles` into Timescale hypertables. If your Timescale version does not support a conversion because of an existing constraint, inspect the SQL error before changing keys; hypertable unique indexes must include the time partition column.

## 3. Run API

Host development mode:

```bash
npm run dev
```

Or use the optional Compose `app` profile shown above. Do not run both on port 3000 at the same time.

REST base URL: `http://localhost:3000/api`
Socket.IO namespace: `ws://localhost:3000/market`

## 4. Endpoints

- `GET /api/health`
- `GET /api/market/price?symbol=XAUUSD`
- `GET /api/market/ticks?symbol=XAUUSD&limit=100`
- `GET /api/market/ticks?symbol=XAUUSD&from=2026-11-17T00:00:00.000Z&to=2026-11-17T23:59:59.000Z`
- `GET /api/market/candles?symbol=XAUUSD&timeframe=M5&limit=500`
- Supported timeframes: `M1`, `M5`, `M15`, `H1`, `H4`, `D1`.

Socket.IO namespace `/market` events:

- `gold-price`: normalized Pyth tick
- `gold-candle`: candle upsert (including the currently forming candle)

## 5. Pyth stream details

The collector connects to all three Pyth Lazer endpoints and subscribes by symbol. It requests JSON parsed values for `price`, `exponent`, `confidence`, and `feedUpdateTimestamp`. Reconnect uses exponential backoff. Duplicate feed updates are filtered in-process by monotonic publish time and in the database by `(publishTime, feedId)`.

Pyth Lazer's API key and feed entitlements are account-dependent. If subscription fails with `not entitled`, verify the API key and the symbol in Pyth's feed catalogue. Do not replace the symbol with a Hermes hex feed ID: Lazer `symbols` and numeric `priceFeedIds` are separate identifiers.

## 6. Important data semantics

- Pyth price is a reference feed, not your broker's executable bid/ask.
- `publishTime` comes from the feed update timestamp; `receivedAt` is local ingestion time.
- Confidence is an uncertainty interval, not a guaranteed spread.
- Volume is intentionally omitted because a global OTC XAU/USD volume does not exist in this feed.
- A candle is only marked complete after its time bucket ends. The current candle is mutable.
- A feed may stop publishing during market closure. The API reports `isFresh: false` when the last update is older than the configured threshold.
- This implementation uses the latest tick to update candle close; production hardening should include a durable raw-message replay/reconciliation process and explicit feed market-session state.

## 7. Local smoke test

```bash
curl http://localhost:3000/api/health
curl 'http://localhost:3000/api/market/price?symbol=XAUUSD'
curl 'http://localhost:3000/api/market/candles?symbol=XAUUSD&timeframe=M5&limit=20'
```

WebSocket browser test (install `socket.io-client` in a temporary client):

```ts
import { io } from "socket.io-client";
const socket = io("http://localhost:3000/market");
socket.on("gold-price", console.log);
socket.on("gold-candle", console.log);
```

## 8. Known next steps before production

1. Add automated tests for candle boundaries, duplicate ticks, out-of-order updates and reconnects.
2. Add durable stream failover and health metrics per Pyth endpoint.
3. Add a market-session/market-hours endpoint and configurable stale policy.
4. Add rate-limited REST endpoints, authentication and WebSocket origin restrictions.
5. Add retention/compression policies for tick hypertables.
6. Add broker-specific bid/ask and contract metadata before computing executable SL/TP.
7. Backfill historical candles from an authorized historical source; live collection alone cannot populate 200 bars per timeframe immediately.

## Notes on the initial implementation

This is a runnable starter backend with coherent module boundaries. It is not a trading system, a broker price feed, or a guarantee of uninterrupted market data. Pyth API access, symbol entitlement and network connectivity must be verified in your environment.
