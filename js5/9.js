const express = require("express");
const app = express();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const Jimp = require("jimp");
const fs = require("fs");

app.use(cors({ credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static("public"));

const router = express.Router();

let usersCache = {};
let usersByUsername = {};
let messages = {};
let rooms = [];

// Authentication middleware
function authenticate(req, res, next) {
  const username = req.cookies.username;
  if (username && usersByUsername[username.toLowerCase()]) {
    next();
  } else {
    if (req.accepts("html")) {
      res.sendFile("login.html", {
        root: "./public",
      });
    } else {
      res.status(403).json({ error: "User not authenticated" });
    }
  }
}

// Function to update user by usernames credential
function updateUserByUsername() {
  usersByUsername = Object.values(usersCache).reduce((acc, user) => {
    acc[user.username.toLowerCase()] = user;
    return acc;
  }, {});
}

router.post("/login", (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).send("Username is required");
  if (usersByUsername[username.toLowerCase()]) {
    return res.status(409).send("This username is already taken");
  }

  const user = { username: username, id: Date.now(), room: "defaultRoom" };
  usersCache[user.id] = user;
  updateUserByUsername();

  // Set a cookie with the username
  res.cookie("username", username, {
    httpOnly: false,
    maxAge: 24 * 60 * 60 * 1000,
    path: "/",
  });
  res;
  res
    .status(200)
    .json({ redirect: `/memeChat?user=${username}&room=defaultRoom` });
});

// New route to change room
router.post("/api/changeRoom", authenticate, (req, res) => {
  const { room } = req.body;
  const username = req.cookies.username.toLowerCase();

  if (!room || !username) {
    return res.status(400).json({ error: "Room and username are required" });
  }

  const user = usersByUsername[username];
  if (user) {
    user.room = room;
    res.status(200).json({ message: "Room changed successfully" });
  } else {
    res.status(404).json({ error: "User not found" });
  }
});

// New route to get users in a specific room
router.get("/api/memerooms/:room/users", authenticate, (req, res) => {
  const { room } = req.params;
  const usersInRoom = Object.values(usersCache).reduce((acc, user) => {
    if (user.room === room && user.room !== null) {
      acc.push({
        username:
          user.username === req.cookies.username
            ? `${user.username} (Me)`
            : user.username,
        imagePath: user.imagePath,
      });
    }
    return acc;
  }, []);
  res.json(usersInRoom);
});

// Serve the login page
router.get("/login", (req, res) => {
  res.sendFile("login.html", { root: "public" });
});

router.post("/image", (req, res) => {
  const { username, text, data } = req.body;
  if (!username || !text || !data) {
    return res.status(400).send("Missing username, text, or data");
  }

  const imageData = Buffer.from(data, "base64");

  Jimp.read(imageData)
    .then((image) =>
      Jimp.loadFont(Jimp.FONT_SANS_32_WHITE).then((font) => {
        const textWidth = Jimp.measureText(font, text);
        const x = (image.bitmap.width - textWidth) / 2;
        image.print(font, x, 10, text);
        return image;
      })
    )
    .then((image) => {
      const imagePath = `images/${username}.png`;
      return image.writeAsync(`public/${imagePath}`).then(() => imagePath);
    })
    .then((imagePath) => {
      // Update usersCache with the image path
      const user = Object.values(usersCache).find(
        (user) => user.username.toLowerCase() === username.toLowerCase()
      );
      if (user) {
        user.imagePath = imagePath;
      }
      res.status(201).send("Image processed and saved");
    })
    .catch((error) => {
      console.error("Error processing image", error);
      res.status(500).send("Error processing image");
    });
});

router.get("/image", (req, res) => {
  const username = req.cookies.username;
  if (!username) {
    return res.status(400).send("Username cookie not found");
  }
  fs.readdir("public/images", (err, files) => {
    if (err) {
      console.error("Error reading meme directory:", err);
      return res.status(500).json({ error: "Error reading meme directory" });
    }
    const userFiles = files.filter(
      (file) => file.startsWith(username) && file.endsWith(".png")
    );
    res.json(userFiles);
  });
});

router.get("/video", authenticate, (req, res) => {
  res.sendFile("video.html", { root: "public" });
});

// Serve the chat interface, protected by the authentication middleware
router.get("/memeChat", authenticate, (req, res) => {
  const username = req.cookies.username;
  fs.readdir("public/images", (err, files) => {
    if (err) {
      return res.status(500).send("Error checking meme");
    }
    const userFiles = files.filter(
      (file) => file.startsWith(username) && file.endsWith(".png")
    );
    if (userFiles.length > 0) {
      res.sendFile("memeChat.html", { root: "public" });
    } else {
      res.sendFile("video.html", { root: "public" });
    }
  });
});

router.post("/api/:memeroom/message", authenticate, (req, res) => {
  const room = req.params.memeroom;
  const { text } = req.body;

  const username = req.cookies.username;
  const user = usersByUsername[username.toLowerCase()];

  const message = {
    id: Date.now(),
    text: text,
    user: {
      username: user.username,
      imagePath: user.imagePath,
    },
    timeStamp: new Date(),
  };

  if (!messages[room]) {
    messages[room] = [];
  }
  messages[room].push(message);
  res.status(201).json(message);
});
router.get("/api/:memerooms/message", authenticate, (req, res) => {
  const room = req.params.memerooms;
  res.json(messages[room] || []);
});

router.post("/api/memerooms", authenticate, (req, res) => {
  const { roomName } = req.body;
  if (!roomName) {
    return res.status(400).json({ message: "Room name is required" });
  }
  if (rooms.includes(roomName)) {
    return res.status(409).json({ message: "Room already exists" });
  }
  rooms.push(roomName);
  return res
    .status(201)
    .json({ messages: "Room created successfully", roomName });
});

router.get("/api/memerooms", authenticate, (req, res) => {
  res.json(rooms);
});

module.exports = router;
