const { PrismaClient } = require('../generated/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean up existing data if needed (optional)
  await cleanDatabase();

  // Create users
  const users = await createUsers();
  console.log(`Created ${users.length} users`);

  // Create topics
  const topics = await createTopics();
  console.log(`Created ${topics.length} topics`);

  // Create user balances
  await createUserBalances(users, topics);
  console.log('Created user balances');

  // Create orders
  const orders = await createOrders(users, topics);
  console.log(`Created ${orders.length} orders`);

  // Create trades
  const trades = await createTrades(users, topics);
  console.log(`Created ${trades.length} trades`);

  console.log('Seeding completed successfully');
}

async function cleanDatabase() {
  // Delete all existing data in reverse order of dependencies
  await prisma.trade.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.userBalance.deleteMany({});
  await prisma.topic.deleteMany({});
  await prisma.user.deleteMany({});
}

async function createUsers() {
  // Hash for password "password123"
  const passwordHash = await bcrypt.hash('password123', 10);

  const userData = [
    {
      username: 'alice',
      email: 'alice@example.com',
      password: passwordHash,
      balance: 10000.00,
    },
    {
      username: 'bob',
      email: 'bob@example.com',
      password: passwordHash,
      balance: 5000.00,
    },
    {
      username: 'charlie',
      email: 'charlie@example.com',
      password: passwordHash,
      balance: 7500.00,
    },
    {
      username: 'david',
      email: 'david@example.com',
      password: passwordHash,
      balance: 3000.00,
    },
    {
      username: 'emma',
      email: 'emma@example.com',
      password: passwordHash,
      balance: 12000.00,
    },
  ];

  const users = [];
  // Use upsert to handle the case where users might already exist
  for (const user of userData) {
    const createdUser = await prisma.user.upsert({
      where: { username: user.username },
      update: user,
      create: user,
    });
    users.push(createdUser);
  }

  return users;
}

async function createTopics() {
  const topicData = [
    {
      name: 'Will Bitcoin exceed $100,000 by the end of 2023?',
      description: 'This market resolves to YES if the price of Bitcoin exceeds $100,000 USD on any major exchange before January 1, 2024.',
      expiresAt: new Date('2024-01-01'),
      resolution: 'PENDING',
    },
    {
      name: 'Will SpaceX land humans on Mars by 2026?',
      description: 'This market resolves to YES if SpaceX successfully lands at least one human on the surface of Mars before January 1, 2027.',
      expiresAt: new Date('2027-01-01'),
      resolution: 'PENDING',
    },
    {
      name: 'Will the US have a recession in 2023?',
      description: 'This market resolves to YES if the US economy experiences two consecutive quarters of negative GDP growth during the 2023 calendar year.',
      expiresAt: new Date('2024-01-15'),
      resolution: 'PENDING',
    },
    {
      name: 'Will AI surpass human-level general intelligence by 2030?',
      description: 'This market resolves to YES if a widely recognized AI system demonstrates capabilities across multiple domains that match or exceed human-level intelligence before January 1, 2031.',
      expiresAt: new Date('2031-01-01'),
      resolution: 'PENDING',
    },
    {
      name: 'Will the 2024 US presidential election have over 155 million voters?',
      description: 'This market resolves to YES if the total number of voters in the 2024 US presidential election exceeds 155 million, as reported by the Federal Election Commission.',
      expiresAt: new Date('2024-12-31'),
      resolution: 'PENDING',
    },
  ];

  const topics = [];
  for (const topic of topicData) {
    const createdTopic = await prisma.topic.upsert({
      where: { name: topic.name },
      update: topic,
      create: topic,
    });
    topics.push(createdTopic);
  }

  return topics;
}

async function createUserBalances(users, topics) {
  // Create initial balances for each user for each topic
  for (const user of users) {
    for (const topic of topics) {
      // Create random balances of YES and NO shares
      const yesShares = parseFloat((Math.random() * 100).toFixed(2));
      const noShares = parseFloat((Math.random() * 100).toFixed(2));

      await prisma.userBalance.upsert({
        where: {
          userId_topicId: {
            userId: user.id,
            topicId: topic.id,
          },
        },
        update: {
          yesShares,
          noShares,
        },
        create: {
          userId: user.id,
          topicId: topic.id,
          yesShares,
          noShares,
        },
      });
    }
  }
}

async function createOrders(users, topics) {
  const orders = [];

  // Generate a mix of open orders for different topics
  for (const topic of topics) {
    // Create some YES buy orders
    for (let i = 0; i < 5; i++) {
      const user = users[Math.floor(Math.random() * users.length)];
      const price = parseFloat((0.3 + Math.random() * 0.4).toFixed(2)); // Random price between 0.3 and 0.7
      const quantity = parseFloat((10 + Math.random() * 90).toFixed(2)); // Random quantity between 10 and 100

      const order = await prisma.order.create({
        data: {
          userId: user.id,
          topicId: topic.id,
          price,
          quantity,
          remainingQuantity: quantity,
          side: 'BUY',
          shareType: 'YES',
          status: 'OPEN',
        },
      });
      orders.push(order);
    }

    // Create some YES sell orders
    for (let i = 0; i < 5; i++) {
      const user = users[Math.floor(Math.random() * users.length)];
      const price = parseFloat((0.6 + Math.random() * 0.4).toFixed(2)); // Random price between 0.6 and 1.0
      const quantity = parseFloat((10 + Math.random() * 90).toFixed(2)); // Random quantity between 10 and 100

      const order = await prisma.order.create({
        data: {
          userId: user.id,
          topicId: topic.id,
          price,
          quantity,
          remainingQuantity: quantity,
          side: 'SELL',
          shareType: 'YES',
          status: 'OPEN',
        },
      });
      orders.push(order);
    }

    // Create some NO buy orders
    for (let i = 0; i < 5; i++) {
      const user = users[Math.floor(Math.random() * users.length)];
      const price = parseFloat((0.3 + Math.random() * 0.4).toFixed(2)); // Random price between 0.3 and 0.7
      const quantity = parseFloat((10 + Math.random() * 90).toFixed(2)); // Random quantity between 10 and 100

      const order = await prisma.order.create({
        data: {
          userId: user.id,
          topicId: topic.id,
          price,
          quantity,
          remainingQuantity: quantity,
          side: 'BUY',
          shareType: 'NO',
          status: 'OPEN',
        },
      });
      orders.push(order);
    }

    // Create some NO sell orders
    for (let i = 0; i < 5; i++) {
      const user = users[Math.floor(Math.random() * users.length)];
      const price = parseFloat((0.6 + Math.random() * 0.4).toFixed(2)); // Random price between 0.6 and 1.0
      const quantity = parseFloat((10 + Math.random() * 90).toFixed(2)); // Random quantity between 10 and 100

      const order = await prisma.order.create({
        data: {
          userId: user.id,
          topicId: topic.id,
          price,
          quantity,
          remainingQuantity: quantity,
          side: 'SELL',
          shareType: 'NO',
          status: 'OPEN',
        },
      });
      orders.push(order);
    }

    // Create some filled or partially filled orders
    for (let i = 0; i < 3; i++) {
      const user = users[Math.floor(Math.random() * users.length)];
      const price = parseFloat((0.4 + Math.random() * 0.3).toFixed(2)); // Random price between 0.4 and 0.7
      const quantity = parseFloat((20 + Math.random() * 80).toFixed(2)); // Random quantity between 20 and 100
      const remainingQuantity = parseFloat((Math.random() * quantity / 2).toFixed(2)); // Random remaining quantity
      const status = remainingQuantity > 0 ? 'PARTIALLY_FILLED' : 'FILLED';

      const order = await prisma.order.create({
        data: {
          userId: user.id,
          topicId: topic.id,
          price,
          quantity,
          remainingQuantity,
          side: Math.random() > 0.5 ? 'BUY' : 'SELL',
          shareType: Math.random() > 0.5 ? 'YES' : 'NO',
          status,
        },
      });
      orders.push(order);
    }
  }

  return orders;
}

async function createTrades(users, topics) {
  const trades = [];

  // Generate trade history for each topic
  for (const topic of topics) {
    // Generate trades over the past 30 days
    const today = new Date();
    
    for (let i = 0; i < 50; i++) {
      // Random date within the last 30 days
      const tradeDate = new Date(today);
      tradeDate.setDate(today.getDate() - Math.floor(Math.random() * 30));
      
      const buyer = users[Math.floor(Math.random() * users.length)];
      let seller;
      // Make sure buyer and seller are different
      do {
        seller = users[Math.floor(Math.random() * users.length)];
      } while (seller.id === buyer.id);
      
      const shareType = Math.random() > 0.5 ? 'YES' : 'NO';
      const price = parseFloat((0.3 + Math.random() * 0.6).toFixed(2)); // Random price between 0.3 and 0.9
      const quantity = parseFloat((5 + Math.random() * 95).toFixed(2)); // Random quantity between 5 and 100

      const trade = await prisma.trade.create({
        data: {
          buyerId: buyer.id,
          sellerId: seller.id,
          topicId: topic.id,
          price,
          quantity,
          shareType,
          tradeTime: tradeDate,
        },
      });
      trades.push(trade);
    }
  }

  return trades;
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    // Close the database connection
    await prisma.$disconnect();
  });