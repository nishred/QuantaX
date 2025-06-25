import {Router} from "express"
import { RedisManager } from "../RedisManager";

export const depthRouter = Router();


//data form --> Memory ( orderbook )
depthRouter.get('/',async (req,res) => {
    const market = req.query.market;
    if(!market){
        res.send({
            message : "Market not provided !"
        });
    }
    else{
        const response = await RedisManager.getInstance().sendAndAwait({
            type : "GET_DEPTH",
            data : {
                market : market as string
            }
        })
        res.send(response.payload)
    }
})
