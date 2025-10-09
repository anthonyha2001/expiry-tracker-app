import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import multer from 'multer';
import cron from 'node-cron';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { sendReminderEmail } from './emailService.js';
import { v4 as uuidv4 } from 'uuid';

// --- Initial Setup ---
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

const upload = multer({ dest: 'uploads/' });
const DB_FILE_PATH = path.join(__dirname, 'inventory-db.json');

// --- Database Functions ---
const readDb = () => {
  try {
    if (!fs.existsSync(DB_FILE_PATH)) {
      const defaultDb = { items: [], settings: { reminderDays: 30, recipientEmails: [] }, notifications: [], pricingRules: [], backup: null };
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(defaultDb, null, 2), 'utf-8');
      return defaultDb;
    }
    const data = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    const db = JSON.parse(data);
    if (!db.settings) db.settings = { reminderDays: 30, recipientEmails: [] };
    if (!db.notifications) db.notifications = [];
    if (!db.pricingRules) db.pricingRules = [];
    return db;
  } catch (error) {
    return { items: [], settings: { reminderDays: 30, recipientEmails: [] }, notifications: [], pricingRules: [], backup: null };
  }
};
const writeDb = (data) => {
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
};

// --- API Endpoints ---
app.get('/api/data', (req, res) => res.json(readDb()));

// CORRECTED STOCK UPDATE LOGIC
app.post('/api/stock-update', upload.single('file'), (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'No file uploaded.' });
    
    try {
        const db = readDb();
        // Create a backup of the current item state before making changes
        const backup = JSON.parse(JSON.stringify(db.items));

        const itemsMap = new Map(db.items.map(i => [i.id, i]));
        
        const fileBuffer = fs.readFileSync(file.path);
        const parsedData = file.originalname.endsWith('.csv')
            ? Papa.parse(fileBuffer.toString('utf-8'), { header: true, skipEmptyLines: true }).data
            : XLSX.utils.sheet_to_json(XLSX.read(fileBuffer, { type: 'buffer' }).Sheets[XLSX.read(fileBuffer, { type: 'buffer' }).SheetNames[0]]);

        const updates = parsedData.map(row => ({
            id: row['Itemcode']?.toString().trim(),
            balance: parseInt(row['balance'], 10),
        })).filter(item => item.id && !isNaN(item.balance));

        if (updates.length === 0) throw new Error("No valid items found in the file.");

        updates.forEach(update => {
            const item = itemsMap.get(update.id);
            if (item) {
                const currentTotal = item.expiryEntries.reduce((sum, e) => sum + e.quantity, 0);
                const newBalance = update.balance;

                if (newBalance < currentTotal) {
                    // FIFO Reduction
                    let toRemove = currentTotal - newBalance;
                    item.expiryEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
                    const remaining = [];
                    for (const entry of item.expiryEntries) {
                        if (toRemove <= 0) { remaining.push(entry); continue; }
                        if (entry.quantity <= toRemove) { toRemove -= entry.quantity; } 
                        else { entry.quantity -= toRemove; toRemove = 0; remaining.push(entry); }
                    }
                    item.expiryEntries = remaining;
                } else if (newBalance > currentTotal) {
                    // Add to pending stock
                    const toAdd = newBalance - currentTotal;
                    item.pendingStockQty = (item.pendingStockQty || 0) + toAdd;
                    item.isUpdate = true;
                }
            }
        });
        
        db.items = Array.from(itemsMap.values());
        db.backup = backup; // Save the backup
        writeDb(db);
        fs.unlinkSync(file.path);
        res.status(200).json({ message: `${updates.length} items processed.`, updatedItems: db.items });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// NEW ENDPOINT FOR UNDO
app.post('/api/stock-undo', (req, res) => {
    const db = readDb();
    if (db.backup) {
        db.items = db.backup; // Restore from backup
        db.backup = null; // Clear the backup
        writeDb(db);
        res.status(200).json({ message: 'Undo successful.', updatedItems: db.items });
    } else {
        res.status(404).json({ message: 'No update to undo.' });
    }
});

// ... (other endpoints remain)
app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));

