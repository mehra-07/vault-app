import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));

// Serve static files
app.use('/uploads', express.static(uploadDir));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB Connected Successfully'))
    .catch(err => console.error('MongoDB Connection Error:', err));
} else {
  console.log('MongoDB URI missing in env!');
}

// Schemas & Models
const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, default: 'image' },
  folder: { type: String, default: 'General' },
  username: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const Item = mongoose.model('Item', ItemSchema);
const User = mongoose.model('User', UserSchema);

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 150 * 1024 * 1024 }
});

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password required' });
    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ message: 'User already exists' });
    const newUser = new User({ username, password });
    await newUser.save();
    res.json({ message: 'User created successfully', user: username });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ message: 'Login successful', user: username });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Media Routes
app.get('/api/vault', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ message: 'Username required' });
    const items = await Item.find({ username }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vault', async (req, res) => {
  try {
    const { name, url, type, folder, username } = req.body;
    const newItem = new Item({ name, url, type, folder: folder || 'General', username });
    await newItem.save();
    res.json(newItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vault/upload', upload.array('files'), async (req, res) => {
  try {
    const { folder, username } = req.body;
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const savedItems = [];
    for (const file of req.files) {
      const isVideo = file.mimetype.startsWith('video') || file.originalname.match(/\.(mp4|mov|webm)$/i);
      const isImg = file.mimetype.startsWith('image') || file.originalname.match(/\.(jpg|jpeg|png|webp|gif)$/i);
      const type = isVideo ? 'video' : (isImg ? 'image' : 'file');

      const newItem = new Item({
        name: file.originalname,
        url: `/uploads/${file.filename}`,
        type: type,
        folder: folder || 'General',
        username: username || 'default'
      });
      await newItem.save();
      savedItems.push(newItem);
    }

    res.json(savedItems.length === 1 ? savedItems[0] : savedItems);
  } catch (err) {
    console.error('UPLOAD ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/vault/:id', async (req, res) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (item && item.url && item.url.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, item.url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('GLOBAL ERROR:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});