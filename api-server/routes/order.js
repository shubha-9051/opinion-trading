const express = require("express");
const RedisManager = require("../redisManager");

const orderRouter = express.Router();

// POST /order endpoint (your existing code)
orderRouter.post("/", async (req, res) => {
  const { market, price, quantity, side, userId } = req.body;

  console.log({ market, price, quantity, side, userId });

  try {
    // Send the message to Redis and await the response
    const response = await RedisManager.getInstance().sendAndAwait({
      type: "CREATE_ORDER",
      data: {
        market,
        price,
        quantity,
        side,
        userId,
      },
    });

    // Respond with the payload
    res.json(response.payload);
  } catch (error) {
    console.error("Error processing order:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /order/cancel endpoint
orderRouter.post("/cancel", async (req, res) => {
  const { orderId, userId } = req.body;

  if (!orderId || !userId) {
    return res.status(400).json({ 
      success: false, 
      message: "Missing required parameters: orderId and userId" 
    });
  }

  console.log(`Attempting to cancel order: ${orderId} for user: ${userId}`);

  try {
    const response = await RedisManager.getInstance().sendAndAwait({
      type: "CANCEL_ORDER",
      data: {
        orderId,
        userId
      },
    });

    res.json(response.payload);
  } catch (error) {
    console.error("Error canceling order:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /order/open endpoint
orderRouter.get("/open", async (req, res) => {
  const { market, userId } = req.query;

  if (!market || !userId) {
    return res.status(400).json({ 
      success: false, 
      message: "Missing required parameters: market and userId" 
    });
  }

  console.log(`Fetching open orders for user: ${userId} in market: ${market}`);

  try {
    const response = await RedisManager.getInstance().sendAndAwait({
      type: "GET_OPEN_ORDER",
      data: {
        market,
        userId
      },
    });

    res.json(response.payload);
  } catch (error) {
    console.error("Error fetching open orders:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /order/onramp endpoint
orderRouter.post("/onramp", async (req, res) => {
  const { userId, asset, amount } = req.body;

  if (!userId || !asset || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ 
      success: false, 
      message: "Invalid parameters: userId, asset, and a positive amount are required" 
    });
  }

  console.log(`Processing on-ramp: ${amount} ${asset} for user: ${userId}`);

  try {
    const response = await RedisManager.getInstance().sendAndAwait({
      type: "ON_RAMP",
      data: {
        userId,
        asset,
        amount: parseFloat(amount)
      },
    });

    res.json(response.payload);
  } catch (error) {
    console.error("Error processing on-ramp:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = orderRouter;