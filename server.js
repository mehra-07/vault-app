import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer disk staging setup for handling large files safely
const uploadDir = path.join(__dirname, 'temp');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Google Drive Auth using Service Account
const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'credentials.json'),
    scopes: ['https://www.googleapis.com/auth/drive.file']
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const fileSize = req.file.size;
        const fileName = req.file.originalname;
        const mimeType = req.file.mimetype;

        const authClient = await auth.getClient();
        const accessToken = await authClient.getAccessToken();

        // Step 1: Initiate resumable session with Google Drive API v3
        const initResponse = await axios.post(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
            {
                name: fileName,
                parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken.token || accessToken}`,
                    'Content-Type': 'application/json',
                    'X-Upload-Content-Type': mimeType,
                    'X-Upload-Content-Length': fileSize
                }
            }
        );

        const sessionUri = initResponse.headers['location'];

        // Step 2: Stream file in chunks directly from local disk staging
        const fileStream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 * 5 }); // 5MB chunks

        const uploadResponse = await axios.put(sessionUri, fileStream, {
            headers: {
                'Content-Length': fileSize,
                'Content-Type': mimeType
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            onUploadProgress: (progressEvent) => {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / fileSize);
                console.log(`Upload progress: ${percentCompleted}%`);
            }
        });

        // Cleanup local temp file
        fs.unlinkSync(filePath);

        res.status(200).json({
            message: 'File uploaded successfully via chunked stream',
            fileData: uploadResponse.data
        });

    } catch (error) {
        console.error('UPLOAD ERROR:', error.response?.data || error.message);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

app.use((err, req, res, next) => {
    console.error('GLOBAL ERROR:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
});

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

server.timeout = 0;
server.keepAliveTimeout = 60 * 60 * 1000;
server.headersTimeout = 60 * 60 * 1000;