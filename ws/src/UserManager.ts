import { SubscriptionManager } from "./SubscriptionManager";
import { User } from "./User";
import WebSocket from "ws"

export class UserManager {
    private static instance : UserManager;
    private users : Map<string , User>;
    private constructor () {
        this.users = new Map();
    }
    public static getInstance(){
        if(!this.instance){
            return this.instance = new UserManager();
        }
        return this.instance;
    }
    
    addUser(userId : string, ws : WebSocket){
        const user = new User(userId,ws)
        this.users.set(userId , user)
    }
    deleteUser(userId : string){
        this.users.delete(userId);
    }
    getUser(userId : string) : User | undefined{
        return this.users.get(userId)
    }
}