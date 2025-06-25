-- CreateTable
CREATE TABLE "sol_usdc_trades" (
    "tradeId" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "quoteQuantity" TEXT NOT NULL,
    "timeStamp" TIMESTAMP(3) NOT NULL,
    "isBuyerMaker" BOOLEAN NOT NULL,

    CONSTRAINT "sol_usdc_trades_pkey" PRIMARY KEY ("tradeId")
);

-- CreateTable
CREATE TABLE "sol_usdc_prices" (
    "id" SERIAL NOT NULL,
    "price" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "sol_usdc_prices_id_key" ON "sol_usdc_prices"("id");
