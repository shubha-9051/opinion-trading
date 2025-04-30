const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('../../db/generated/client');

const signupRouter = express.Router();
const prisma = new PrismaClient();

// Signup route - create new user
signupRouter.post('/', async (req, res) => {
  const { username, password, email } = req.body;
  
  // Validate required fields
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // If email wasn't provided, use username as email
  const userEmail = email || username;
  
  try {
    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({
      where: { username }
    });
    
    if (existingUsername) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({
      where: { email: userEmail }
    });
    
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    
    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Create the user with default starting balance
    const newUser = await prisma.user.create({
      data: {
        username,
        email: userEmail,
        password: hashedPassword,
        balance: 1000.00, // Default starting balance of $1000
      }
    });
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.id },
      process.env.JWT_SECRET || 'default-jwt-secret',
      { expiresIn: '24h' }
    );
    
    // Send token and user info (excluding password)
    res.status(201).json({
      token,
      userId: newUser.id,
      username: newUser.username,
      email: newUser.email,
      balance: newUser.balance.toString() // Convert Decimal to string to avoid JSON issues
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: `Server error during registration: ${error.message}` });
  }
});

module.exports = signupRouter;