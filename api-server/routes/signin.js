const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('../../db/generated/client');

const signinRouter = express.Router();
const prisma = new PrismaClient();

// Signin route - authenticate user with username and password
signinRouter.post('/', async (req, res) => {
  const { username, password } = req.body;
  
  // Validate request
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  try {
    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        email: true,
        password: true,
        balance: true
      }
    });
    
    // Check if user exists
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials1' });
    }
    
    // Validate password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials2' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'default-jwt-secret',
      { expiresIn: '24h' }
    );
    
    // Send token and user info (excluding password)
    res.json({
      token,
      userId: user.id,
      username: user.username,
      email: user.email,
      balance: user.balance.toString() // Convert Decimal to string to avoid JSON issues
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Server error during authentication' });
  }
});

module.exports = signinRouter;