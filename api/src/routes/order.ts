import {Router} from "express"
import { RedisManager } from "../RedisManager";

export const orderRouter = Router();

orderRouter.post('/',async (req,res) => {
    const { market, price, quantity, side, userId } = req.body;
    if(!market || !price || !quantity || !side || !userId){
        res.json({
            success : false,
            data : {
                mesage : "All fields required!"
            }
        })
    }
    else{
        const response = await RedisManager.getInstance().sendAndAwait({
            type : "CREATE_ORDER",
            data : {
                market,
                price,
                quantity,
                side,
                userId
            }
        });
        if(response.type == 'ORDER_PLACED'){
            res.json({
                success : true,
                data : response.payload
            })
        }
        else if(response.type == 'ORDER_FAILED'){
            res.json({
                success : false,
                data : response.payload
            })
        }
    }
})

orderRouter.get('/',async (req,res) => {
    const market = req.query.market as string;
    const userId = req.query.userId as string;
    const response = await RedisManager.getInstance().sendAndAwait({
        type : "GET_OPEN_ORDERS",
        data : {
            market : market,
            userId : userId
        }
    })
    res.json(response.payload)
})


orderRouter.delete('/',async (req,res) => {
    const {market , orderId} = req.body;
    const response = await RedisManager.getInstance().sendAndAwait({
        type : "CANCEL_ORDER",
        data : {
            market : market,
            orderId : orderId
        }
    })
    if(response.type == 'ORDER_CANCELLED'){
        res.json({
            success : true,
            data : response.payload
        })
    }else if (response.type == 'CANCEL_ORDER_FAILED'){
        res.json({
            success : false,
            data : response.payload
        })
    }
    
})
