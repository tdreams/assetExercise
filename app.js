const express = require("express");
const path = require("path"); // Make sure to require 'path'
const app = express();
const fs = require("fs").promises;

// If you have static files to serve directly (e.g., images, CSS, JS for your HTML files),
// you should specify their directory here. If it's not 'public', adjust accordingly.
app.use(express.static("public"));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello");
});

// Import the router from js5/1.js if it's meant to handle requests
const js54Router = require("./js5/4"); // Adjust the path as necessary
app.use(js54Router); // Use the router from js5/1.js

const port = process.env.PORT || 8123;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
