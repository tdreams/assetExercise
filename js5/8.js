const express = require("express");
const app = express();
const fs = require("fs");
const cors = require("cors");
const path = require("path");
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

const router = express.Router();

//Ensure the public/images directory exists
const imagesDir = path.join("./public", "images");
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

router.get("/images", (req, res) => {
  fs.readdir(imagesDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: "Failed to read images directory" });
    }
    const imagesUrls = files.map((file) => `/images/${file}`);
    res.status(200).json(imagesUrls);
  });
});

router.post("/saveImage", (req, res) => {
  const { image } = req.body;
  const filePath = path.join(imagesDir, `image_${Date.now()}.png`);

  fs.writeFile(filePath, image, "base64", (err) => {
    if (err) {
      return res.status(500).json({ error: "Failed to save image" });
    }
    return res.status(200).json({ message: "Image saved successfully" });
  });
});

app.get("/cheese", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "cheese.html"));
});

module.exports = router;
