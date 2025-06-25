import { createClient, RedisClientType } from "redis";
import { MessageToApi } from "./types/toApi";
import {  MessageToWs } from "./types/toWs";
import { MessageToDb } from "./types/toDb";

export class RedisManager {
    private client : RedisClientType;
    private static instance : RedisManager;

    private constructor(){
        this.client = createClient();
        this.client.connect();
        console.log("redis connected !");
    }

    public static getInstance() {
        if (!this.instance)  {
            this.instance = new RedisManager();
        }
        return this.instance;
    }

    public sendToApi(clientId: string, message: MessageToApi) {
        this.client.publish(clientId,JSON.stringify(message));
    }

    public publishToWs(channel : string,message : MessageToWs){
        this.client.publish(channel,JSON.stringify(message))
    }
    
    public sendToDbQueue(queue : string,message : MessageToDb){
        this.client.lPush(queue,JSON.stringify(message))
    }
}