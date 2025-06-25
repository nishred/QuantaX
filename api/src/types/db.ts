export type KlineData = {
    bucket: Date,
    symbol: string,
    open: number,
    high: number,
    low: number,
    close: number,
    volume: number,
    quotevolume: number,
    trades: number
}

export type TradesData = {
    trade_id: number,
    time: Date,
    price: number,
    qty: number,
    quote_qty: number,
    is_buyer_maker: false
}
export type TickerData = {
    firstprice : number,
    high : number,
    lastprice : number,
    low : number,
    pricechange : number,
    pricechangepercent : number,
    quotevolume : number,
    symbol : string,
    trades : number,
    volume : number
}