// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const session = require("express-session");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve only public assets (CSS, JS, images)
app.use(express.static("public"));

// Serve uploaded PDFs publicly
app.use("/uploads", express.static("uploads"));

const DATA_FILE = path.join(__dirname, "notes.json");

// Ensure notes.json exists
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([]));

// Configure file upload
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// Session configuration
app.use(session({
  secret: "L3arn1ngP0rtal$S3cur3K3y!2025",
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 60 * 60 * 1000 } // 1 hour
}));

// Admin credentials (hashed password)
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD_HASH = "$2a$12$mgM7SHZw6kPNY.qu.QH4vOmUBhz8Dvrj.0XYhTFfs7BfcfMbRgh1i"; // hash of "12345"

// ------------------- Authentication -------------------
// Login route
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USERNAME) return res.json({ success: false, message: "Invalid username" });

  const match = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!match) return res.json({ success: false, message: "Invalid password" });

  req.session.admin = true;
  res.json({ success: true, message: "Login successful" });
});

// Middleware to protect admin routes
function requireAdmin(req, res, next) {
  if (req.session.admin) return next();
  res.status(401).json({ success: false, message: "Unauthorized: Please login" });
}

// Logout route
app.post("/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: "Logged out" });
});

// ------------------- Notes CRUD -------------------
// Get all notes (public)
app.get("/notes", (req, res) => {
  try {
    const notes = JSON.parse(fs.readFileSync(DATA_FILE));
    res.json(notes);
  } catch (err) {
    res.json([]);
  }
});

// Upload new note (admin only)
app.post("/upload-note", requireAdmin, upload.single("pdf"), (req, res) => {
  const { subject, topic } = req.body;
  if (!subject || !topic || !req.file) return res.json({ success: false, message: "All fields are required ❌" });

  const filePath = "uploads/" + req.file.filename;

  let notes = [];
  try { notes = JSON.parse(fs.readFileSync(DATA_FILE)); } catch { notes = []; }

  notes.push({ subject, topic, file: filePath });
  fs.writeFileSync(DATA_FILE, JSON.stringify(notes, null, 2));

  res.json({ success: true, message: "PDF uploaded successfully ✅" });
});

// Edit note by index (admin only)
app.put("/edit-note/:index", requireAdmin, (req, res) => {
  const index = parseInt(req.params.index);
  const { subject, topic } = req.body;

  if (!subject || !topic) return res.json({ success: false, message: "All fields are required ❌" });

  let notes = [];
  try { notes = JSON.parse(fs.readFileSync(DATA_FILE)); } catch { return res.json({ success: false, message: "Failed to read notes ❌" }); }

  if (index < 0 || index >= notes.length) return res.json({ success: false, message: "Invalid note index ❌" });

  notes[index].subject = subject;
  notes[index].topic = topic;
  fs.writeFileSync(DATA_FILE, JSON.stringify(notes, null, 2));

  res.json({ success: true, message: "Note updated successfully ✅" });
});

// Delete note by index (admin only)
app.delete("/delete-note/:index", requireAdmin, (req, res) => {
  const index = parseInt(req.params.index);
  let notes = [];
  try { notes = JSON.parse(fs.readFileSync(DATA_FILE)); } catch { return res.json({ success: false, message: "Failed to read notes ❌" }); }

  if (index < 0 || index >= notes.length) return res.json({ success: false, message: "Invalid note index ❌" });

  const note = notes.splice(index, 1)[0];

  // Delete PDF file
  const filePath = path.join(__dirname, note.file);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  fs.writeFileSync(DATA_FILE, JSON.stringify(notes, null, 2));
  res.json({ success: true, message: "Note deleted successfully ✅" });
});

// Serve main index.html
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// Serve admin.html only if logged in
app.get("/admin.html", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "protected", "admin.html"));
});

const PORT = 5500;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
