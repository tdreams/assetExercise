const express = require("express");
const app = express();
const cors = require("cors");
app.use(cors());
const router = express.Router();

app.use(express.json());
const fs = require("fs").promises;
const path = require("path");
app.use(express.static("public"));

const filesPath = path.join(__dirname, "files");

fs.mkdir(filesPath, { recursive: true }).catch(console.error);

router.delete("/api/files/:fileName", (req, res) => {
  const { fileName } = req.params;
  const filePath = path.join(filesPath, fileName);
  fs.unlink(filePath)
    .then(() => {
      console.log(`Delete ${fileName}`);
      res.status(200).json({ message: "File deleted successfully" });
    })
    .catch((err) => {
      console.error(`Error deleting ${fileName} : ${err}`);
      res.status(500).json({ message: `Failed to delete ${fileName}` });
    });
});

router.post("/api/files", async (req, res) => {
  const { name, content } = req.body;
  if (!name) {
    return res.status(400).json({ message: "File name  is require" });
  }
  const filePath = path.join(filesPath, name);
  fs.writeFile(filePath, content, "utf8")
    .then(() => {
      res.status(200).json({ message: "file successfully created" });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ message: "Failed to create file" });
    });
});

router.get("/api/files", (req, res) => {
  fs.readdir(filesPath)
    .then((files) => {
      res.json(files);
    })
    .catch((err) => {
      res.status(500).json({ message: err.message });
    });
});

router.get("/api/assetExercise", (req, res) => {
  res.sendFile("public/asset.html", {
    root: "./",
  });
});

router.get("/api/files/:fileName", (req, res) => {
  const { fileName } = req.params;
  const filePath = path.join(filesPath, fileName);
  fs.readFile(filePath, "utf8")
    .then((content) => {
      res.send(content);
    })
    .catch((err) => {
      console.error(`Failed to read file: ${err}`);
      res.status(404).json({ message: "File not found" });
    });
});

router.put("/api/files/:fileName", async (req, res) => {
  const { fileName } = req.params;
  const { content } = req.body;

  if (fileName === "challenge") {
    return res
      .status(500)
      .json({ message: "Not allowed to modified this file" });
  }

  const filePath = path.join(filesPath, fileName);

  fs.writeFile(filePath, content, "utf8")
    .then(() => {
      res.status(200).json({ message: "File updated successfully" });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ message: "Failed to update file" });
    });
});

module.exports = router;
