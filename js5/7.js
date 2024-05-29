const express = require("express");
const app = express();
const multer = require("multer");
const cors = require("cors");
const Tesseract = require("tesseract.js");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Setup Multer for handling file uploads
const upload = multer({ dest: "uploads" });
const jobs = {};

const router = express.Router();

router.post("/files", upload.array("userFiles"), (req, res) => {
  if (req.files && req.files.length > 0) {
    const jobId = uuidv4();
    jobs[jobId] = {
      status: "processing",
      results: [],
    };

    req.files.forEach((file) => {
      const filePath = file.path;
      Tesseract.recognize(filePath, "eng", { logger: (m) => console.log(m) })
        .then(({ data: { text } }) => {
          jobs[jobId].results.push({ fileName: file.originalname, text: text });
          if (jobs[jobId].results.length === req.files.length) {
            jobs[jobId].status = "completed";
          }
          fs.unlink(filePath, (err) => {
            if (err) console.error("Failed to delete file:", filePath, err);
          });
        })
        .catch((err) => {
          console.error("Error processing file:", file.originalname, err);
          jobs[jobId].results.push({
            fileName: file.originalname,
            error: err.message,
          });
          jobs[jobId].status = "failed";
        });
    });

    res.status(202).send({ jobId: jobId, statusUrl: `/api/job/${jobId}` });
  } else {
    res.status(400).send("No files were uploaded");
  }
});

router.get("/api/job/:jobId", (req, res) => {
  const jobId = req.params.jobId;
  if (jobs[jobId]) {
    res.send(jobs[jobId]);
  } else {
    res.status(404).send("Job not found");
  }
});

router.get("/imageAnalysis", (req, res) => {
  res.sendFile("dragDrop.html", {
    root: "./public",
  });
});

module.exports = router;
