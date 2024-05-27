const express = require("express");
const app = express();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs").promises;
const path = require("path");

app.use(
  cors({
    credentials: true, // Allow cookies to be sent
  })
);
app.use(express.static("public"));
app.use(express.json());
app.use(cookieParser());

const router = express.Router();
const usersFilePath = path.join(__dirname, "users.json");

let usersCache = {};
let usersByCredentials = {};

function ensureFileExists() {
  return fs.access(usersFilePath, fs.constants.F_OK).catch(() => {
    // File does not exist, create it with empty object
    console.log("users.json not found, creating new file...");
    const initialData = {};
    return fs
      .writeFile(usersFilePath, JSON.stringify(initialData, null, 2), "utf8")
      .then(() => {
        console.log("users.json created successfully.");
      });
  });
}

function updateUsersByCredentials() {
  usersByCredentials = Object.values(usersCache).reduce((acc, user) => {
    acc[user.username.toLowerCase()] = user;
    acc[user.email.toLowerCase()] = user;
    return acc;
  }, {});
}

function loadUsersToCache() {
  return ensureFileExists()
    .then(() => fs.readFile(usersFilePath, "utf8"))
    .then((data) => {
      usersCache = JSON.parse(data);
      updateUsersByCredentials(); // Update the map after loading users
      console.log("Users loaded into cache successfully");
    })
    .catch((err) => {
      console.error("Failed to load users into cache:", err);
      throw err;
    });
}

// Load users into cache when the application starts
loadUsersToCache().catch((err) => {
  console.error("Error loading users into cache:", err);
});

// Read users from cache
function readUsers() {
  return Promise.resolve(usersCache);
}

// Write users to cache and file
function writeUsers() {
  const data = JSON.stringify(usersCache, null, 2);
  return fs
    .writeFile(usersFilePath, data, "utf8")
    .then(() => console.log("Users data saved successfully."))
    .catch((err) => {
      console.error("Error writing users to file:", err);
      throw err;
    });
}

const SECRET_KEY = "demo-secret";

// Authentication middleware
const authenticate = (req, res, next) => {
  const token = req.cookies ? req.cookies.token : null;
  if (!token) {
    req.isAuthenticated = false;
    return next();
  }

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      console.error("Error during authentication", err);
      req.isAuthenticated = false;
      return next();
    }
    req.user = usersCache[decoded.userId];
    if (!req.user) {
      req.isAuthenticated = false;
      return next();
    }
    req.isAuthenticated = true;
    next();
  });
};

// Create a new user
router.post("/api/users", (req, res) => {
  const { fullname, username, password, email } = req.body;
  if (!fullname || !username || !password || !email) {
    return res.status(400).send("All fields are required");
  }
  if (password.length <= 5) {
    return res.status(400).send("Password must be at least 6 characters");
  }
  if (!/^[a-zA-Z0-9]+$/.test(username)) {
    return res.status(400).send("Username must be alphanumeric.");
  }
  if (!email.includes("@")) {
    return res.status(400).send("Invalid email address");
  }

  readUsers()
    .then((users) => {
      if (
        users[username.toLowerCase()] ||
        Object.values(users).some(
          (user) => user.email.toLowerCase() === email.toLowerCase()
        )
      ) {
        throw new Error("Username or email already exists");
      }
      return bcrypt.hash(password, 10);
    })
    .then((hashPassword) => {
      // Append the new user to the cache
      usersCache[username.toLowerCase()] = {
        fullname,
        username,
        password: hashPassword,
        email,
      };
      updateUsersByCredentials(); // Update the map after adding a new user
      return writeUsers();
    })
    .then(() => {
      res.status(201).send({ fullname, username, email });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send("Server error: " + err.message);
    });
});

// Login route
router.post("/api/sessions", (req, res) => {
  const username = req.body.username.toLowerCase();
  const password = req.body.password;

  readUsers()
    .then((users) => {
      const user = users[username] || users[req.body.username];

      if (!user) {
        return res.status(401).send("Authentication error: User not found.");
      }

      bcrypt
        .compare(password, user.password)
        .then((isMatch) => {
          if (!isMatch) {
            return res
              .status(401)
              .send("Authentication error: Invalid credentials.");
          }

          const token = jwt.sign({ userId: user.username }, SECRET_KEY, {
            expiresIn: "1h",
          });

          res.cookie("token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
          });

          res.status(200).send({
            message: "Logged in successfully",
            user: {
              fullName: user.fullname,
              username: user.username,
              email: user.email,
            },
          });
        })
        .catch((err) => {
          console.error(err);
          res.status(500).send("Authentication error: " + err.message);
        });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send("Server error: " + err.message);
    });
});

// Session verification route
router.get("/api/sessions", authenticate, (req, res) => {
  res.json(req.user);
});

router.get("/welcome", authenticate, (req, res) => {
  const username = req.query.user;
  if (req.isAuthenticated) {
    // If the user is authenticated, send the welcome page
    res.sendFile("welcome.html", { root: "./public" });
  } else {
    // If the user is not authenticated, send the sign-in or log-in page
    res.sendFile("signin.html", { root: "./public" });
  }
});

module.exports = router;
