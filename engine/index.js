const { createClient } = require("redis");
const { PrismaClient } = require("../db/generated/client");

class ExchangeEngine {
  constructor() {
    this.redisClient = createClient();
    this.prisma = new PrismaClient();
    
    this.orderbook = {}; // In-memory orderbook
    this.balances = {}; // In-memory user balances
    this.topics = []; // Topics loaded from database
    
    // Queue for database operations
    this.dbQueue = "db_operations";
  }

  async initialize() {
    await this.redisClient.connect();
    console.log("Redis client connected");

    try {
      // Load topics from database
      await this.loadTopics();
      
      // Load existing orders from database
      await this.loadExistingOrders();
      
      console.log("Exchange Engine initialized successfully");
    } catch (error) {
      console.error("Error initializing exchange engine:", error);
      throw error;
    }
  }

  async loadTopics() {
    try {
      this.topics = await this.prisma.topic.findMany();
      console.log(`Loaded ${this.topics.length} topics from database`);
    } catch (error) {
      console.error("Error loading topics:", error);
      throw error;
    }
  }

  async loadExistingOrders() {
    try {
      // Get all open orders from the database
      const openOrders = await this.prisma.order.findMany({
        where: {
          status: "OPEN"
        },
        include: {
          user: true,
          topic: true
        }
      });
      
      console.log(`Loading ${openOrders.length} existing orders into orderbook`);
      
      // Group the orders by topic and add to orderbook
      for (const order of openOrders) {
        const marketId = `${order.topicId}-${order.shareType.toLowerCase()}-usd`;
        
        if (!this.orderbook[marketId]) {
          this.orderbook[marketId] = {
            bids: [],
            asks: []
          };
        }
        
        const orderEntry = {
          price: parseFloat(order.price),
          quantity: parseFloat(order.remainingQuantity),
          userId: order.user.username, // Assuming username is used as userId
          orderId: order.id.toString(),
          timestamp: order.createdAt.getTime()
        };
        
        if (order.side === "BUY") {
          this.orderbook[marketId].bids.push(orderEntry);
        } else {
          this.orderbook[marketId].asks.push(orderEntry);
        }
      }
      
      // Sort the orderbooks
      for (const marketId in this.orderbook) {
        this.orderbook[marketId].bids.sort((a, b) => b.price - a.price || a.timestamp - b.timestamp);
        this.orderbook[marketId].asks.sort((a, b) => a.price - b.price || a.timestamp - b.timestamp);
      }
      
      console.log("Existing orders loaded into orderbook");
    } catch (error) {
      console.error("Error loading existing orders:", error);
      throw error;
    }
  }

  async loadUserBalance(userId) {
    // Check if the balance is already loaded
    if (this.balances[userId]) {
      return this.balances[userId];
    }
    
    try {
      // Find the user in the database
      const user = await this.prisma.user.findUnique({
        where: {
          username: userId
        },
        include: {
          balances: {
            include: {
              topic: true
            }
          }
        }
      });
      
      if (!user) {
        console.error(`User ${userId} not found in database`);
        return null;
      }
      
      // Create the balance object
      const balanceObj = {
        USD: parseFloat(user.balance)
      };
      
      // Add YES/NO shares for each topic
      for (const balance of user.balances) {
        // Format: topicId-yes-usd
        balanceObj[`${balance.topicId}-yes-usd`] = parseFloat(balance.yesShares);
        // Format: topicId-no-usd
        balanceObj[`${balance.topicId}-no-usd`] = parseFloat(balance.noShares);
      }
      
      // Cache the balance
      this.balances[userId] = balanceObj;
      
      console.log(`Loaded balance for user ${userId}: `, balanceObj);
      return balanceObj;
    } catch (error) {
      console.error(`Error loading balance for user ${userId}:`, error);
      throw error;
    }
  }

  // Queue a database operation
  queueDbOperation(operation) {
    // Add timestamp to track when the operation was queued
    const queueItem = {
      ...operation,
      timestamp: Date.now()
    };
    
    // Push to the database operations queue
    this.redisClient.lPush(this.dbQueue, JSON.stringify(queueItem));
    console.log(`Queued DB operation: ${operation.type}`);
  }

  async start() {
    try {
      await this.initialize();
      console.log("Exchange Engine started. Listening for events...");
      
      while (true) {
        try {
          // Pull the next event from the queue
          const result = await this.redisClient.brPop("messages", 0);
          
          // Extract the queue name and message
          const queue = result.key;
          const messageText = result.element;
          
          // Parse the message
          const parsedMessage = JSON.parse(messageText);
          const clientId = parsedMessage.clientId;
          const event = parsedMessage.message;
          console.log(`Processing event from client ${clientId}: ${event.type}`);
          
          // Process the event
          const response = await this.processEvent(event);
          
          // Publish the response to the pub/sub channel
          await this.redisClient.publish(clientId, JSON.stringify({
            payload: response
          }));
        } catch (error) {
          console.error("Error processing event:", error);
        }
      }
    } catch (error) {
      console.error("Fatal error in exchange engine:", error);
      // Clean up resources
      await this.prisma.$disconnect();
      await this.redisClient.quit();
      process.exit(1);
    }
  }

  async processEvent(message) {
    const { type, data } = message;
    
    let response;
    switch (type) {
      case "CREATE_ORDER":
        response = await this.handleCreateOrder(data);
        break;
      case "CANCEL_ORDER":
        response = this.handleCancelOrder(data);
        break;
      case "GET_OPEN_ORDER":
        response = this.handleGetOpenOrder(data);
        break;
      case "ON_RAMP":
        response = this.handleOnRamp(data);
        break;
      default:
        response = { type: "ERROR", data: { message: "Unknown event type" } };
    }
    
    // Log the orderbook after processing the event
    this.logOrderbook();
    
    return response;
  }

  async handleCreateOrder({ market, price, quantity, side, userId, shareType = "yes" }) {
    // Parse the market to get the topic ID
    // Assuming market format: topicId-yes/no-usd
    const [topicId, shareTypeFromMarket] = market.split('-');
    
    // Use the provided shareType or extract from market
    const finalShareType = shareTypeFromMarket || shareType;
    
    // Load user balance on demand
    if (!this.balances[userId]) {
      const userBalance = await this.loadUserBalance(userId);
      if (!userBalance) {
        return { type: "ERROR", data: { message: `User ${userId} not found` } };
      }
    }
    
    // Determine the asset and required balance
    let asset;
    if (side === "buy") {
      asset = "USD";
    } else {
      // For sell orders, the asset is the specific share type
      asset = `${topicId}-${finalShareType.toLowerCase()}-usd`;
    }
    
    // Initialize the asset balance if it doesn't exist
    if (!this.balances[userId][asset]) {
      this.balances[userId][asset] = 0;
    }
    
    // Calculate required balance for the order
    const requiredBalance = side === "buy" ? price * quantity : quantity;
    
    // Check if user has sufficient balance
    if (this.balances[userId][asset] < requiredBalance) {
      return { 
        type: "ERROR", 
        data: { 
          message: "Insufficient balance", 
          userId,
          asset,
          required: requiredBalance,
          available: this.balances[userId][asset]
        } 
      };
    }
    
    // Lock the balance temporarily
    this.balances[userId][asset] -= requiredBalance;
    
    // Queue the balance update to the database
    this.queueDbOperation({
      type: "UPDATE_BALANCE",
      data: {
        userId,
        asset,
        newBalance: this.balances[userId][asset],
        reason: "ORDER_PLACED"
      }
    });
    
    // Get or create the orderbook for this market
    const orderbook = this.getOrderbook(market);
    
    // Determine which side of the orderbook to match against
    const matches = side === "buy" ? orderbook.asks : orderbook.bids;
    const matchedOrders = [];
    let remainingQuantity = quantity;
    
    // Try to match the order with existing orders
    for (let i = 0; i < matches.length && remainingQuantity > 0; i++) {
      const match = matches[i];
      
      // Check if the price matches
      if ((side === "buy" && price >= match.price) || (side === "sell" && price <= match.price)) {
        const matchedQuantity = Math.min(remainingQuantity, match.quantity);
        remainingQuantity -= matchedQuantity;
        match.quantity -= matchedQuantity;
        
        // Update balances for the matched order
        const counterpartyAsset = side === "buy" 
          ? `${topicId}-${finalShareType.toLowerCase()}-usd` 
          : "USD";
        
        const userAsset = side === "buy" 
          ? `${topicId}-${finalShareType.toLowerCase()}-usd` 
          : "USD";
        
        // Update counterparty's balances
        if (!this.balances[match.userId]) {
          // Load the counterparty's balance if not already loaded
          this.balances[match.userId] = await this.loadUserBalance(match.userId);
        }
        
        if (!this.balances[match.userId][counterpartyAsset]) {
          this.balances[match.userId][counterpartyAsset] = 0;
        }
        
        const matchPrice = side === "buy" ? match.price : price;
        
        // Update counterparty's asset balance
        this.balances[match.userId][counterpartyAsset] += side === "buy" 
          ? matchedQuantity * matchPrice // Seller receives USD
          : matchedQuantity; // Buyer receives shares
        
        // Queue the balance update
        this.queueDbOperation({
          type: "UPDATE_BALANCE",
          data: {
            userId: match.userId,
            asset: counterpartyAsset,
            newBalance: this.balances[match.userId][counterpartyAsset],
            reason: "ORDER_MATCHED"
          }
        });
        
        // Update user's asset balance
        if (!this.balances[userId][userAsset]) {
          this.balances[userId][userAsset] = 0;
        }
        
        this.balances[userId][userAsset] += side === "buy" 
          ? matchedQuantity // Buyer receives shares
          : matchedQuantity * matchPrice; // Seller receives USD
        
        // Queue the balance update
        this.queueDbOperation({
          type: "UPDATE_BALANCE",
          data: {
            userId,
            asset: userAsset,
            newBalance: this.balances[userId][userAsset],
            reason: "ORDER_MATCHED"
          }
        });
        
        // Record the matched order
        const tradeInfo = {
          price: matchPrice,
          quantity: matchedQuantity,
          buyer: side === "buy" ? userId : match.userId,
          seller: side === "buy" ? match.userId : userId,
          topicId: parseInt(topicId),
          shareType: finalShareType.toUpperCase()
        };
        
        matchedOrders.push(tradeInfo);
        
        // Queue the trade for database persistence
        this.queueDbOperation({
          type: "CREATE_TRADE",
          data: tradeInfo
        });
        
        // Remove the order if fully matched
        if (match.quantity === 0) {
          matches.splice(i, 1);
          i--;
          
          // Queue the order update (mark as filled)
          this.queueDbOperation({
            type: "UPDATE_ORDER",
            data: {
              orderId: match.orderId,
              status: "FILLED",
              remainingQuantity: 0
            }
          });
        } else {
          // Queue the order update (update remaining quantity)
          this.queueDbOperation({
            type: "UPDATE_ORDER",
            data: {
              orderId: match.orderId,
              status: "PARTIALLY_FILLED",
              remainingQuantity: match.quantity
            }
          });
        }
      }
    }
    
    // Publish trade details for each matched order
    matchedOrders.forEach((trade) => this.publishTrade(market, trade));
    
    // Publish the updated orderbook
    this.publishOrderbook(market);
    
    // If order is fully filled
    if (remainingQuantity === 0) {
      return {
        type: "ORDER_EXECUTED",
        data: {
          market,
          price,
          quantity,
          side,
          status: "filled",
          matchedOrders,
        },
      };
    }
    
    // If order is partially filled or not filled at all
    if (remainingQuantity > 0) {
      const orderId = this.generateOrderId();
      const newOrder = { 
        price, 
        quantity: remainingQuantity, 
        userId, 
        orderId, 
        timestamp: Date.now() 
      };
      
      // Add the new order to the orderbook
      if (side === "buy") {
        orderbook.bids.push(newOrder);
        orderbook.bids.sort((a, b) => b.price - a.price || a.timestamp - b.timestamp);
      } else {
        orderbook.asks.push(newOrder);
        orderbook.asks.sort((a, b) => a.price - b.price || a.timestamp - b.timestamp);
      }
      
      // Queue the new order for database persistence
      this.queueDbOperation({
        type: "CREATE_ORDER",
        data: {
          orderId,
          userId,
          topicId: parseInt(topicId),
          side: side.toUpperCase(),
          shareType: finalShareType.toUpperCase(),
          price,
          quantity,
          remainingQuantity,
          status: matchedOrders.length > 0 ? "PARTIALLY_FILLED" : "OPEN"
        }
      });
      
      // Publish the updated orderbook
      this.publishOrderbook(market);
      
      return {
        type: "ORDER_PARTIALLY_FILLED",
        data: {
          market,
          price,
          quantity,
          side,
          status: matchedOrders.length > 0 ? "partially_filled" : "open",
          remainingQuantity,
          matchedOrders,
          orderId
        },
      };
    }
  }

  handleCancelOrder({ orderId, userId }) {
    // Find the order in all orderbooks
    let foundOrder = null;
    let foundMarket = null;
    let foundSide = null;
    
    for (const market in this.orderbook) {
      // Check in bids
      const bidIndex = this.orderbook[market].bids.findIndex(o => o.orderId === orderId && o.userId === userId);
      if (bidIndex !== -1) {
        foundOrder = this.orderbook[market].bids[bidIndex];
        foundMarket = market;
        foundSide = "bids";
        break;
      }
      
      // Check in asks
      const askIndex = this.orderbook[market].asks.findIndex(o => o.orderId === orderId && o.userId === userId);
      if (askIndex !== -1) {
        foundOrder = this.orderbook[market].asks[askIndex];
        foundMarket = market;
        foundSide = "asks";
        break;
      }
    }
    
    if (!foundOrder) {
      return { type: "ERROR", data: { message: "Order not found", orderId } };
    }
    
    // Remove the order from the orderbook
    const orderIndex = this.orderbook[foundMarket][foundSide].findIndex(o => o.orderId === orderId);
    const [order] = this.orderbook[foundMarket][foundSide].splice(orderIndex, 1);
    
    // Parse the market to get topic ID and share type
    const [topicId, shareType] = foundMarket.split('-');
    
    // Return the locked balance to the user
    const asset = foundSide === "bids" ? "USD" : `${topicId}-${shareType}-usd`;
    if (!this.balances[userId]) {
      this.balances[userId] = {};
    }
    if (!this.balances[userId][asset]) {
      this.balances[userId][asset] = 0;
    }
    
    this.balances[userId][asset] += order.quantity * order.price;
    
    // Queue the balance update
    this.queueDbOperation({
      type: "UPDATE_BALANCE",
      data: {
        userId,
        asset,
        newBalance: this.balances[userId][asset],
        reason: "ORDER_CANCELED"
      }
    });
    
    // Queue the order update
    this.queueDbOperation({
      type: "UPDATE_ORDER",
      data: {
        orderId,
        status: "CANCELED",
        remainingQuantity: 0
      }
    });
    
    // Publish the updated orderbook
    this.publishOrderbook(foundMarket);
    
    return {
      type: "ORDER_CANCELED",
      data: { market: foundMarket, orderId, status: "canceled" },
    };
  }

  handleGetOpenOrder({ market, userId }) {
    // If market is not specified, get all orders for the user
    if (!market) {
      const allOrders = [];
      
      for (const marketId in this.orderbook) {
        const userBids = this.orderbook[marketId].bids.filter(o => o.userId === userId);
        const userAsks = this.orderbook[marketId].asks.filter(o => o.userId === userId);
        
        allOrders.push(...userBids.map(o => ({ ...o, market: marketId, side: "buy" })));
        allOrders.push(...userAsks.map(o => ({ ...o, market: marketId, side: "sell" })));
      }
      
      return {
        type: "OPEN_ORDERS",
        data: { userId, orders: allOrders },
      };
    }
    
    // Get orders for a specific market
    const orderbook = this.getOrderbook(market);
    const userBids = orderbook.bids.filter(o => o.userId === userId).map(o => ({ ...o, side: "buy" }));
    const userAsks = orderbook.asks.filter(o => o.userId === userId).map(o => ({ ...o, side: "sell" }));
    
    return {
      type: "OPEN_ORDERS",
      data: { market, userId, orders: [...userBids, ...userAsks] },
    };
  }

  handleOnRamp({ userId, asset, amount }) {
    // Initialize user balance if not already loaded
    if (!this.balances[userId]) {
      this.balances[userId] = {};
    }
    
    // Initialize asset balance if not already set
    if (!this.balances[userId][asset]) {
      this.balances[userId][asset] = 0;
    }
    
    // Update the balance
    this.balances[userId][asset] += amount;
    
    // Queue the balance update
    this.queueDbOperation({
      type: "UPDATE_BALANCE",
      data: {
        userId,
        asset,
        newBalance: this.balances[userId][asset],
        reason: "ON_RAMP"
      }
    });
    
    return {
      type: "ON_RAMP_SUCCESS",
      data: { userId, asset, amount, balance: this.balances[userId][asset] },
    };
  }

  getOrderbook(market) {
    if (!this.orderbook[market]) {
      this.orderbook[market] = { bids: [], asks: [] };
    }
    return this.orderbook[market];
  }

  generateOrderId() {
    return `ord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  publishOrderbook(market) {
  const orderbook = this.getOrderbook(market);
  
  // Aggregate bids by price
  const aggregatedBids = this.aggregateOrdersByPrice(orderbook.bids);
  
  // Aggregate asks by price
  const aggregatedAsks = this.aggregateOrdersByPrice(orderbook.asks);
  
  // Format the orderbook
  const formattedOrderbook = {
    market,
    bids: aggregatedBids,
    asks: aggregatedAsks,
  };
  
  // Publish the orderbook to the market-specific channel
  const channel = `orderbook_${market}`;
  this.redisClient.publish(channel, JSON.stringify(formattedOrderbook));
}

// Helper method to aggregate orders by price
aggregateOrdersByPrice(orders) {
  // Use a Map to group orders by price
  const priceMap = new Map();
  
  // Sum quantities for each price level
  orders.forEach(order => {
    const price = order.price;
    if (!priceMap.has(price)) {
      priceMap.set(price, 0);
    }
    priceMap.set(price, priceMap.get(price) + order.quantity);
  });
  
  // Convert Map to array of price/quantity objects
  const aggregated = Array.from(priceMap.entries()).map(([price, quantity]) => ({
    price,
    quantity
  }));
  
  // Sort by price (descending for bids, ascending for asks would be handled by the caller)
  return aggregated;
}

  publishTrade(market, tradeDetails) {
    // Format the trade details
    const formattedTrade = {
      market,
      price: tradeDetails.price,
      quantity: tradeDetails.quantity,
      buyer: tradeDetails.buyer,
      seller: tradeDetails.seller,
      timestamp: Date.now(),
    };
    
    // Publish the trade to the market-specific channel
    const channel = `trades_${market}`;
    this.redisClient.publish(channel, JSON.stringify(formattedTrade));
  }

  logOrderbook() {
    console.log("\n=== Current Orderbook ===");
    for (const market in this.orderbook) {
      console.log(`Market: ${market}`);
      console.log("Bids:");
      this.orderbook[market].bids.forEach((bid, index) => {
        console.log(
          `  ${index + 1}. Price: ${bid.price}, Quantity: ${bid.quantity}, User: ${bid.userId}, Order ID: ${bid.orderId}`
        );
      });
      console.log("Asks:");
      this.orderbook[market].asks.forEach((ask, index) => {
        console.log(
          `  ${index + 1}. Price: ${ask.price}, Quantity: ${ask.quantity}, User: ${ask.userId}, Order ID: ${ask.orderId}`
        );
      });
    }
    console.log("=========================\n");
  }
}

// Initialize and start the engine
const engine = new ExchangeEngine();
engine.start().catch(error => {
  console.error("Failed to start exchange engine:", error);
  process.exit(1);
});