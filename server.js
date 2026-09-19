import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// High payload limit for handling base64 / uploads
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// MongoDB Atlas Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mehra25042004_db_user:Mehra007@cluster0.63gozys.mongodb.net/apertureVaultDB?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

// Schemas & Models
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const vaultItemSchema = new mongoose.Schema({
  username: { type: String, required: true, index: true },
  title: { type: String },
  name: { type: String },
  data: { type: mongoose.Schema.Types.Mixed },
  fileUrl: { type: String },
  type: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const VaultItem = mongoose.model('VaultItem', vaultItemSchema);

// Base Route
app.get('/', (req, res) => {
  res.send('Vault App Backend Running');
});

// Auth Routes (/api/auth/register, /api/auth/login)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username aur password zaroori hain' });
    }
    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ message: 'User pehle se registered hai' });
    }
    const newUser = new User({ username, password });
    await newUser.save();
    return res.status(201).json({ message: 'User registered successfully', user: username });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (!user) {
      return res.status(401).json({ message: 'Galat username ya password' });
    }
    return res.status(200).json({ message: 'Login successful', user: username });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Vault Data Routes
app.get('/api/vault', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ message: 'Username query required' });
    const items = await VaultItem.find({ username }).sort({ createdAt: -1 });
    return res.status(200).json(items);
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching items', error: err.message });
  }
});

app.post('/api/vault', async (req, res) => {
  try {
    const itemData = req.body;
    const newItem = new VaultItem(itemData);
    await newItem.save();
    return res.status(201).json(newItem);
  } catch (err) {
    return res.status(500).json({ message: 'Error saving item', error: err.message });
  }
});

app.post('/api/vault/upload', async (req, res) => {
  try {
    const itemData = req.body;
    const newItem = new VaultItem(itemData);
    await newItem.save();
    return res.status(201).json(newItem);
  } catch (err) {
    return res.status(500).json({ message: 'Upload failed', error: err.message });
  }
});

app.delete('/api/vault/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await VaultItem.findByIdAndDelete(id);
    return res.status(200).json({ message: 'Item deleted successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Delete failed', error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
