import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(
      "CREATE EXTENSION IF NOT EXISTS timescaledb",
    );
    await prisma.$executeRawUnsafe(`
      SELECT create_hypertable('market_ticks', 'publishTime', if_not_exists => TRUE, migrate_data => TRUE)
    `);
    await prisma.$executeRawUnsafe(`
      SELECT create_hypertable('market_candles', 'openTime', if_not_exists => TRUE, migrate_data => TRUE)
    `);
    console.log("TimescaleDB hypertables are ready.");
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
