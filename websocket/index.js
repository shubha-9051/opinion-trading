const WebSocket = require("ws");
const { createClient } = require("redis");

// Create a WebSocket server on port 8080
const wss = new WebSocket.Server({ port: 8080 });

// Create a Redis client for subscribing to pub/sub channels
const redisSubscriber = createClient();
redisSubscriber.connect().then(() => {
  console.log("Redis client connected");
}).catch(err => {
  console.error("Redis connection error:", err);
  process.exit(1);
});

// Map to track client subscriptions
const clientSubscriptions = new Map();

// Function to load all available topics
async function loadAvailableTopics() {
  try {
    // Create a temporary Prisma client for initialization
    const { PrismaClient } = require("../db/generated/client");
    const prisma = new PrismaClient();
    
    const topics = await prisma.topic.findMany({
      select: {
        id: true,
        name: true,
        description: true
      }
    });
    
    await prisma.$disconnect();
    
    // Transform to a format easier to use
    const topicMap = {};
    topics.forEach(topic => {
      topicMap[topic.id] = {
        name: topic.name,
        description: topic.description
      };
    });
    
    return topicMap;
  } catch (error) {
    console.error("Error loading topics:", error);
    return {};
  }
}

let availableTopics = {};

// Load topics on startup
loadAvailableTopics().then(topics => {
  availableTopics = topics;
  console.log(`Loaded ${Object.keys(topics).length} topics`);
});

wss.on("connection", (ws) => {
  console.log("New client connected");

  // Initialize an empty set of subscriptions for the client
  clientSubscriptions.set(ws, new Set());
  
  // Send available topics to the client on connection
  ws.send(JSON.stringify({
    type: "topics",
    data: availableTopics
  }));

  // Handle messages from the client
  ws.on("message", async (message) => {
    try {
      const parsedMessage = JSON.parse(message);

      if (parsedMessage.action === "subscribe" && parsedMessage.market) {
        const market = parsedMessage.market;

        // Validate the market format (should be topicId-yes/no-usd)
        const marketParts = market.split("-");
        if (marketParts.length !== 3 || !["yes", "no"].includes(marketParts[1]) || marketParts[2] !== "usd") {
          ws.send(JSON.stringify({
            type: "error",
            message: "Invalid market format. Expected: topicId-yes/no-usd"
          }));
          return;
        }

        // Add the market to the client's subscriptions
        clientSubscriptions.get(ws).add(market);
        console.log(`Client subscribed to market: ${market}`);
        
        // Send the current orderbook for this market
        try {
          const redisClient = createClient();
          await redisClient.connect();
          
          // Try to get current orderbook from Redis cache if available
          const cachedOrderbook = await redisClient.get(`orderbook:${market}`);
          if (cachedOrderbook) {
            ws.send(JSON.stringify({
              type: "orderbook",
              market,
              data: JSON.parse(cachedOrderbook)
            }));
          }
          
          // Try to get recent trades from Redis cache if available
          const recentTrades = await redisClient.lRange(`recent_trades:${market}`, 0, 19);
          if (recentTrades && recentTrades.length > 0) {
            const trades = recentTrades.map(trade => JSON.parse(trade));
            ws.send(JSON.stringify({
              type: "recent_trades",
              market,
              data: trades
            }));
          }
          
          await redisClient.quit();
        } catch (error) {
          console.error("Error fetching initial market data:", error);
        }
      } else if (parsedMessage.action === "unsubscribe" && parsedMessage.market) {
        const market = parsedMessage.market;

        // Remove the market from the client's subscriptions
        clientSubscriptions.get(ws).delete(market);
        console.log(`Client unsubscribed from market: ${market}`);
      } else if (parsedMessage.action === "get_topics") {
        // Reload topics in case they've changed
        availableTopics = await loadAvailableTopics();
        
        ws.send(JSON.stringify({
          type: "topics",
          data: availableTopics
        }));
      } else {
        console.log("Invalid message from client:", parsedMessage);
      }
    } catch (error) {
      console.error("Error parsing client message:", error);
    }
  });

  // Handle client disconnection
  ws.on("close", () => {
    console.log("Client disconnected");
    clientSubscriptions.delete(ws);
  });
});

// Subscribe to Redis pub/sub channels for orderbook and trades
redisSubscriber.pSubscribe("orderbook_*", (message, channel) => {
  const market = channel.split("_")[1]; // Extract market from channel name
  const parsedMessage = JSON.parse(message);

  // Cache the latest orderbook in Redis for new subscribers
  const redisCache = createClient();
  redisCache.connect().then(async () => {
    await redisCache.set(`orderbook:${market}`, message);
    await redisCache.quit();
  }).catch(console.error);

  // Broadcast the orderbook update to subscribed clients
  broadcastToSubscribedClients(market, {
    type: "orderbook",
    market,
    data: parsedMessage,
  });
});

redisSubscriber.pSubscribe("trades_*", (message, channel) => {
  const market = channel.split("_")[1]; // Extract market from channel name
  const parsedMessage = JSON.parse(message);

  // Cache recent trades in Redis for new subscribers (keep last 20)
  const redisCache = createClient();
  redisCache.connect().then(async () => {
    await redisCache.lPush(`recent_trades:${market}`, message);
    await redisCache.lTrim(`recent_trades:${market}`, 0, 19);
    await redisCache.quit();
  }).catch(console.error);

  // Broadcast the trade update to subscribed clients
  broadcastToSubscribedClients(market, {
    type: "trade",
    market,
    data: parsedMessage,
  });
});

// Function to broadcast messages to clients subscribed to a specific market
function broadcastToSubscribedClients(market, message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      const subscriptions = clientSubscriptions.get(client);

      if (subscriptions && subscriptions.has(market)) {
        client.send(JSON.stringify(message));
      }
    }
  });
}

// Periodically reload topics to keep them fresh
setInterval(async () => {
  try {
    availableTopics = await loadAvailableTopics();
  } catch (error) {
    console.error("Error reloading topics:", error);
  }
}, 60000); // Reload every minute

console.log("WebSocket server is running on ws://localhost:8080");

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down WebSocket server...');
  
  // Close all WebSocket connections
  wss.clients.forEach(client => {
    client.terminate();
  });
  
  // Close the server
  wss.close(() => {
    console.log('WebSocket server closed');
  });
  
  // Disconnect Redis client
  await redisSubscriber.quit();
  
  process.exit(0);
});