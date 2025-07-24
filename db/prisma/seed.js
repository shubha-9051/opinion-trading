const { PrismaClient } = require('../generated/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function main() {
  // Clear existing data
  await prisma.trade.deleteMany({})
  await prisma.order.deleteMany({})
  await prisma.userBalance.deleteMany({})
  await prisma.topic.deleteMany({})
  await prisma.user.deleteMany({})

  console.log('Deleted existing data')

  // Create users
  const users = await Promise.all([
    prisma.user.create({
      data: {
        username: 'alice',
        email: 'alice@example.com',
        password: await bcrypt.hash('password123', 10),
        balance: 1000,
      }
    }),
    prisma.user.create({
      data: {
        username: 'bob',
        email: 'bob@example.com',
        password: await bcrypt.hash('password123', 10),
        balance: 1500,
      }
    }),
    prisma.user.create({
      data: {
        username: 'charlie',
        email: 'charlie@example.com',
        password: await bcrypt.hash('password123', 10),
        balance: 2000,
      }
    }),
    prisma.user.create({
      data: {
        username: 'dana',
        email: 'dana@example.com',
        password: await bcrypt.hash('password123', 10),
        balance: 800,
      }
    }),
    prisma.user.create({
      data: {
        username: 'eve',
        email: 'eve@example.com',
        password: await bcrypt.hash('password123', 10),
        balance: 1200,
      }
    }),
    prisma.user.create({
      data: {
        username: 'shubha',
        email: 'shubha@example.com',
        password: await bcrypt.hash('secure123', 10),
        balance: 2500,
      }
    }),
  ])

  console.log('Created users:', users.map(u => u.username).join(', '))

  // Create topics - Adjusted for July 2025
  const topics = await Promise.all([
    prisma.topic.create({
      data: {
        name: 'Will BTC hit $100k before 2026?',
        description: 'The price of Bitcoin must reach or exceed $100,000 USD on any major exchange before January 1, 2026.',
        expiresAt: new Date('2026-01-01T00:00:00Z'),
      }
    }),
    prisma.topic.create({
      data: {
        name: 'Will Apple release AR glasses by end of 2025?',
        description: 'Apple must announce and release consumer AR glasses (not just VR headset) during calendar year 2025.',
        expiresAt: new Date('2025-12-31T23:59:59Z'),
      }
    }),
    prisma.topic.create({
      data: {
        name: 'Will SpaceX launch Starship to orbit more than 5 times in 2025?',
        description: 'SpaceX must successfully launch Starship to orbit at least 6 times during calendar year 2025.',
        expiresAt: new Date('2025-12-31T23:59:59Z'),
      }
    }),
    prisma.topic.create({
      data: {
        name: 'Will AGI be achieved before 2030?',
        description: 'A system must demonstrably pass all criteria for Artificial General Intelligence by consensus of AI researchers.',
        expiresAt: new Date('2030-01-01T00:00:00Z'),
      }
    }),
    prisma.topic.create({
      data: {
        name: 'Will humans land on Mars before 2030?',
        description: 'Any space agency or private company must successfully land at least one human on the surface of Mars before January 1, 2030.',
        expiresAt: new Date('2030-01-01T00:00:00Z'),
      }
    }),
  ])

  console.log('Created topics:', topics.map(t => t.name).join(', '))

  // Create user balances
  const userBalances = []
  for (const user of users) {
    for (const topic of topics) {
      // Give random starting shares to some users for some topics
      if (Math.random() > 0.4) {
        const balance = await prisma.userBalance.create({
          data: {
            userId: user.id,
            topicId: topic.id,
            yesShares: Math.floor(Math.random() * 50),
            noShares: Math.floor(Math.random() * 50),
          }
        })
        userBalances.push(balance)
      }
    }
  }

  console.log(`Created ${userBalances.length} user balances`)

  // Create orders
  const orders = []
  const currentDate = new Date('2025-07-22T17:18:37Z')
  
  for (let i = 0; i < 30; i++) {
    const user = users[Math.floor(Math.random() * users.length)]
    const topic = topics[Math.floor(Math.random() * topics.length)]
    const side = Math.random() > 0.5 ? 'BUY' : 'SELL'
    const shareType = Math.random() > 0.5 ? 'YES' : 'NO'
    
    // For sell orders, ensure user has shares
    let canCreate = true
    if (side === 'SELL') {
      const userBalance = await prisma.userBalance.findUnique({
        where: {
          userId_topicId: {
            userId: user.id,
            topicId: topic.id
          }
        }
      })
      
      if (!userBalance) {
        canCreate = false
      } else {
        const availableShares = shareType === 'YES' ? userBalance.yesShares : userBalance.noShares
        if (availableShares === 0) {
          canCreate = false
        }
      }
    }
    
    if (canCreate) {
      // Generate a random price between 0.1 and 0.9
      const price = parseFloat((Math.random() * 0.8 + 0.1).toFixed(2))
      const quantity = parseFloat((Math.random() * 10 + 1).toFixed(2))
      
      // For some orders, make them partially filled
      let remainingQuantity = quantity
      let status = 'OPEN'
      
      if (Math.random() > 0.7) {
        remainingQuantity = parseFloat((quantity * (Math.random() * 0.9)).toFixed(2))
        status = remainingQuantity === 0 ? 'FILLED' : 'PARTIALLY_FILLED'
      }
      
      // Random date in the last 60 days
      const randomDaysAgo = Math.floor(Math.random() * 60)
      const orderDate = new Date(currentDate)
      orderDate.setDate(orderDate.getDate() - randomDaysAgo)
      
      const order = await prisma.order.create({
        data: {
          userId: user.id,
          topicId: topic.id,
          price,
          quantity,
          remainingQuantity,
          side,
          shareType,
          status,
          createdAt: orderDate
        }
      })
      
      orders.push(order)
    }
  }

  console.log(`Created ${orders.length} orders`)

  // Create trades
  const trades = []
  for (let i = 0; i < 20; i++) {
    const buyer = users[Math.floor(Math.random() * users.length)]
    // Ensure seller is different from buyer
    let seller
    do {
      seller = users[Math.floor(Math.random() * users.length)]
    } while (seller.id === buyer.id)
    
    const topic = topics[Math.floor(Math.random() * topics.length)]
    const shareType = Math.random() > 0.5 ? 'YES' : 'NO'
    const price = parseFloat((Math.random() * 0.8 + 0.1).toFixed(2))
    const quantity = parseFloat((Math.random() * 5 + 1).toFixed(2))
    
    // Random date in the last 60 days
    const randomDaysAgo = Math.floor(Math.random() * 60)
    const tradeDate = new Date(currentDate)
    tradeDate.setDate(tradeDate.getDate() - randomDaysAgo)
    
    const trade = await prisma.trade.create({
      data: {
        buyerId: buyer.id,
        sellerId: seller.id,
        topicId: topic.id,
        price,
        quantity,
        shareType,
        tradeTime: tradeDate
      }
    })
    
    trades.push(trade)
  }

  console.log(`Created ${trades.length} trades`)

  // Since we're in July 2025, let's resolve the election topic as an example
  // Democrats win the 2024 election would be resolved by now
  await prisma.topic.create({
    data: {
      name: 'Did Democrats win the 2024 US Presidential election?',
      description: 'The Democratic party candidate won the 2024 US Presidential election.',
      expiresAt: new Date('2024-11-15T00:00:00Z'),
      resolution: 'RESOLVED_YES', // This is resolved as YES since we're in 2025
    }
  })

  console.log('Created resolved 2024 election topic')

  // Let's also resolve one of the other topics as a demonstration
  await prisma.topic.update({
    where: { id: topics[1].id },
    data: { resolution: 'RESOLVED_NO' } // Apple didn't release AR glasses by mid-2025
  })

  console.log(`Updated resolution for topic: ${topics[1].name}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })