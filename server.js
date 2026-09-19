import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI;

if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB Connected Successfully'))
    .catch((err) => console.error('MongoDB Connection Error:', err));
} else {
  console.warn('MONGO_URI is not set in environment variables');
}

app.get('/', (req, res) => {
  res.send('Vault App Backend Running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
