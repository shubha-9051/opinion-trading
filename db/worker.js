const { createClient } = require("redis");
const { PrismaClient } = require('./generated/client');

class DatabaseWorker {
  constructor() {
    this.redisClient = createClient();
    this.prisma = new PrismaClient();
    this.dbQueue = "db_operations";
    this.running = false;
  }

  async start() {
    try {
      await this.redisClient.connect();
      console.log("Redis client connected");
      
      this.running = true;
      console.log("Database worker started. Processing queue...");
      
      await this.processQueue();
    } catch (error) {
      console.error("Error starting database worker:", error);
      await this.cleanup();
      process.exit(1);
    }
  }

  async processQueue() {
    while (this.running) {
      try {
        // Pull the next operation from the queue with a timeout of 1 second
        const result = await this.redisClient.brPop(this.dbQueue, 1);
        
        if (!result) continue; // No operation in the queue
        
        const operation = JSON.parse(result.element);
        console.log(`Processing DB operation: ${operation.type}`);
        
        await this.processOperation(operation);
      } catch (error) {
        console.error("Error processing queue item:", error);
        // Continue processing even if one operation fails
      }
    }
  }

  async processOperation(operation) {
    const { type, data } = operation;
    
    try {
      switch (type) {
        case "CREATE_ORDER":
          await this.createOrder(data);
          break;
        case "UPDATE_ORDER":
          await this.updateOrder(data);
          break;
        case "CREATE_TRADE":
          await this.createTrade(data);
          break;
        case "UPDATE_BALANCE":
          await this.updateBalance(data);
          break;
        default:
          console.warn(`Unknown operation type: ${type}`);
      }
    } catch (error) {
      console.error(`Error processing ${type} operation:`, error);
      // Could implement retry logic here
    }
  }

  async createOrder(data) {
    const { orderId, userId, topicId, side, shareType, price, quantity, remainingQuantity, status } = data;
    
    try {
      // Find user by username
      const user = await this.prisma.user.findUnique({
        where: { username: userId }
      });
      
      if (!user) {
        console.error(`User ${userId} not found`);
        return;
      }
      
      // Create the order WITHOUT specifying the id field
      await this.prisma.order.create({
        data: {
          // Remove this line that's causing the error:
          // id: parseInt(orderId.replace(/\D/g, '')), 
          
          userId: user.id,
          topicId,
          side,
          shareType,
          price,
          quantity,
          remainingQuantity,
          status
        }
      });
      
      console.log(`Order created successfully`);
    } catch (error) {
      console.error(`Error creating order:`, error);
      throw error;
    }
  }

  async updateOrder(data) {
    const { orderId, status, remainingQuantity } = data;
    
    try {
      // Update the order
      await this.prisma.order.update({
        where: {
          id: parseInt(orderId.replace(/\D/g, '')) // Extract numeric ID if needed
        },
        data: {
          status,
          remainingQuantity
        }
      });
      
      console.log(`Order ${orderId} updated successfully`);
    } catch (error) {
      console.error(`Error updating order ${orderId}:`, error);
      throw error;
    }
  }

  async createTrade(data) {
    const { buyer, seller, topicId, shareType, price, quantity } = data;
    
    try {
      // Find buyer and seller by username
      const buyerUser = await this.prisma.user.findUnique({
        where: { username: buyer }
      });
      
      const sellerUser = await this.prisma.user.findUnique({
        where: { username: seller }
      });
      
      if (!buyerUser || !sellerUser) {
        console.error(`Buyer ${buyer} or seller ${seller} not found`);
        return;
      }
      
      // Create the trade
      await this.prisma.trade.create({
        data: {
          buyerId: buyerUser.id,
          sellerId: sellerUser.id,
          topicId,
          shareType,
          price,
          quantity,
          tradeTime: new Date()
        }
      });
      
      console.log(`Trade between ${buyer} and ${seller} recorded successfully`);
    } catch (error) {
      console.error(`Error creating trade:`, error);
      throw error;
    }
  }

  async updateBalance(data) {
    const { userId, asset, newBalance, reason } = data;
    
    try {
      // Find user by username
      const user = await this.prisma.user.findUnique({
        where: { username: userId }
      });
      
      if (!user) {
        console.error(`User ${userId} not found`);
        return;
      }
      
      // Handle USD balance updates
      if (asset === "USD") {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { balance: newBalance }
        });
        console.log(`Updated USD balance for ${userId}: ${newBalance}`);
        return;
      }
      
      // For other assets (YES/NO shares), parse the asset string
      // Format: topicId-yes/no-usd
      const [topicId, shareType] = asset.split('-');
      
      // Get existing balance or create if it doesn't exist
      const userBalance = await this.prisma.userBalance.upsert({
        where: {
          userId_topicId: {
            userId: user.id,
            topicId: parseInt(topicId)
          }
        },
        update: shareType === 'yes' 
          ? { yesShares: newBalance }
          : { noShares: newBalance },
        create: {
          userId: user.id,
          topicId: parseInt(topicId),
          yesShares: shareType === 'yes' ? newBalance : 0,
          noShares: shareType === 'no' ? newBalance : 0
        }
      });
      
      console.log(`Updated ${shareType} balance for ${userId} on topic ${topicId}: ${newBalance}`);
    } catch (error) {
      console.error(`Error updating balance for ${userId}:`, error);
      throw error;
    }
  }

  async cleanup() {
    this.running = false;
    await this.prisma.$disconnect();
    await this.redisClient.quit();
    console.log("Database worker cleaned up");
  }
}

// Initialize and start the worker
const worker = new DatabaseWorker();
worker.start().catch(console.error);

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down database worker...');
  await worker.cleanup();
  process.exit(0);
});