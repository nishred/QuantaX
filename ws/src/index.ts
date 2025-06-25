import express from 'express'
import { WebSocket, WebSocketServer } from "ws"
import { UserManager } from './UserManager';

const app = express();
const httpServer = app.listen(8080);

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection" , (ws : WebSocket, req) => {
    const userId = req.url?.split('?id=')[1];
    console.log(userId)
    if(userId){
        UserManager.getInstance().addUser(userId,ws)
    }
})
