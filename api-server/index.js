const express = require("express");
const bodyParser = require("body-parser");
const orderRouter = require("./routes/order");
const signinRouter=require('./routes/signin')
const signupRouter=require('./routes/signup')
const cors = require('cors');

const app = express();
app.use(bodyParser.json());


app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// Use the /order route
app.use("/order", orderRouter);
app.use('/signin',signinRouter);
app.use('/signup',signupRouter);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});