const express = require("express");
const app = express();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");

const allowedOrigins = [
  "http://localhost:3200",
  "https://assetexercise.onrender.com/",
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
app.use(express.json());
app.use(cookieParser());
app.use(express.static("public"));
const router = express.Router();

const authenticate = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(403).json({ message: "No token provided" });
  }
  fetch("https://js5.c0d3.com/auth/api/session", {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((resp) => resp.json())
    .then((data) => {
      req.user = data;
      if (!req.user || !req.user.username) {
        return res.status(403).json({ message: "Invalid token" });
      }
      next();
    })
    .catch((err) => res.status(403).json({ message: "Invalid token" }));
};

router.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  fetch("https://js5.c0d3.com/auth/api/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: username,
      password: btoa(password),
    }),
  })
    .then((resp) => {
      if (!resp.ok) {
        throw new Error("Invalid username or password");
      }
      return resp.json();
    })
    .then((data) => {
      const token = data.jwt;
      res.cookie("token", token, { httpOnly: true, sameSite: "strict" });
      res.json({ message: "Logged in successfully", token });
    })
    .catch((err) => {
      console.error("Error logging in:", err);
      res.status(401).json({ message: "Invalid username or password" });
    });
});

router.post("/api/signup", (req, res) => {
  const { fullname, username, email, password } = req.body;

  fetch("https://js5.c0d3.com/auth/api/users", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: fullname,
      username: username,
      email: email,
      password: btoa(password),
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.error) {
        throw new Error(data.message);
      }
      res.json({ message: "Signup successful", user: data });
    })
    .catch((err) => {
      console.error("Signup error:", err);
      res.status(500).json({ message: "Signup failed", error: err.message });
    });
});

router.get("/api/session", authenticate, (req, res) => {
  res.json(req.user);
});

let messages = {};
let rooms = [];

router.post("/api/:room/messages", authenticate, (req, res) => {
  const { room } = req.params;
  const message = {
    id: uuidv4(),
    user: req.user.username,
    text: req.body.text,
    timestamp: new Date(),
  };

  if (!messages[room]) {
    messages[room] = [];
  }

  messages[room].push(message);
  res.status(201).json(message);
});

router.post("/api/rooms", authenticate, (req, res) => {
  const { roomName } = req.body;
  if (!roomName) {
    return res.status(400).json({ messgae: "Room name is required" });
  }
  if (rooms.includes(roomName)) {
    return res.status(409).json({ messages: "Room already exists" });
  }
  rooms.push(roomName);
  res.status(200).json({ messages: "Room created successfully", roomName });
});
router.get("/api/:room/messages", authenticate, (req, res) => {
  const { room } = req.params;
  res.json(messages[room] || []);
});

router.get("/api/rooms", authenticate, (req, res) => {
  res.json(rooms);
});

router.get("/chatroom", (req, res) => {
  const { token } = req.cookies;

  fetch("https://js5.c0d3.com/auth/api/session", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then((resp) => resp.json())
    .then((data) => {
      if (data.username) {
        res.sendFile("chat.html", {
          root: "./public",
        });
      } else {
        res.sendFile("signOrLog.html", {
          root: "./public",
        });
      }
    })
    .catch((err) => {
      console.error("Error verifiyng token:", err);
      res.sendFile("signOrLog.html", {
        root: "./public",
      });
    });
});

module.exports = router;
