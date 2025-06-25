export type SubscribeMessage = {
    method: "SUBSCRIBE",
    params: string[]
}

export type UnsubscribeMessage = {
    method: "UNSUBSCRIBE",
    params: string[]
}

export type IncomingMessage = SubscribeMessage | UnsubscribeMessage;