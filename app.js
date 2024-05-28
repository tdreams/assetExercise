const express = require("express");
const path = require("path"); // Make sure to require 'path'
const app = express();
const bcrypt = require("bcrypt");
const fs = require("fs").promises;
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const allowedOrigins = [
  "http://localhost:3200",
  "https://assetexercise.onrender.com",
  "https://assetexercise.onrender.com/chatroom",
];
const corsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // Allow cookies to be sent
};

app.use(cors(corsOptions));

// If you have static files to serve directly (e.g., images, CSS, JS for your HTML files),
// you should specify their directory here. If it's not 'public', adjust accordingly.
app.use(express.static("public"));
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Hello");
});

// Import the router from js5/1.js if it's meant to handle requests
const js54Router = require("./js5/4"); // Adjust the path as necessary
app.use(js54Router); // Use the router from js5/1.js

const js55Router = require("./js5/5"); // Adjust the path as necessary
app.use(js55Router);

const js56Router = require("./js5/6"); // Adjust the path as necessary
app.use(js56Router);

const port = process.env.PORT || 8123;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
