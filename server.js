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

// --- Initial Setup ---
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Serve Static Files for Production ---
app.use(express.static(path.join(__dirname, 'dist')));

// --- File Upload Setup ---
const upload = multer({ dest: 'uploads/' });

// --- Database Setup ---
const DB_FILE_PATH = path.join(__dirname, 'inventory-db.json');

const readDb = () => {
  try {
    if (!fs.existsSync(DB_FILE_PATH)) {
      const defaultDb = { items: [], settings: { reminderDays: 30, recipientEmails: [] }, notifications: [] };
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(defaultDb, null, 2), 'utf-8');
      return defaultDb;
    }
    const data = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    const db = JSON.parse(data);
    if (!db.settings) db.settings = { reminderDays: 30, recipientEmails: [] };
    if (!db.notifications) db.notifications = [];
    return db;
  } catch (error) {
    console.error("Error reading DB:", error);
    return { items: [], settings: { reminderDays: 30, recipientEmails: [] }, notifications: [] };
  }
};

const writeDb = (data) => {
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
};

// --- Scheduled Job for Email Reminders ---
cron.schedule('0 9 * * *', () => {
  console.log('Running daily check for expiring items...');
  const db = readDb();
  const { items, settings } = db;
  const { reminderDays, recipientEmails } = settings;
  const today = new Date();
  
  const expiringItems = [];

  items.forEach(item => {
    item.expiryEntries.forEach(entry => {
      const expiryDate = new Date(entry.date);
      const daysUntilExpiry = (expiryDate - today) / (1000 * 60 * 60 * 24);

      if (daysUntilExpiry > 0 && daysUntilExpiry <= reminderDays) {
        expiringItems.push({
          id: item.id,
          description: item.description,
          expiryDate: entry.date,
          quantity: entry.quantity,
        });
      }
    });
  });

  const notification = sendReminderEmail(recipientEmails, expiringItems);
  if (notification) {
    db.notifications.unshift(notification); // Add new notifications to the top
    writeDb(db);
  }
});

// --- API Endpoints ---
app.get('/api/data', (req, res) => res.json(readDb()));

app.post('/api/notifications/mark-read', (req, res) => {
    const { id } = req.body;
    const db = readDb();
    const notification = db.notifications.find(n => n.id === id);
    if (notification) {
        notification.read = true;
        writeDb(db);
        res.status(200).json({ message: 'Notification marked as read.' });
    } else {
        res.status(404).json({ message: 'Notification not found.' });
    }
});

app.post('/api/items', (req, res) => {
  const { items } = req.body;
  const db = readDb();
  db.items = items;
  writeDb(db);
  res.status(200).json({ message: 'Inventory saved.' });
});

app.post('/api/settings', (req, res) => {
  const { settings } = req.body;
  const db = readDb();
  db.settings = settings;
  writeDb(db);
  res.status(200).json({ message: 'Settings saved.' });
});

app.post('/api/import/master-list', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).send('No file uploaded.');
  const db = readDb();
  const itemsMap = new Map(db.items.map(i => [i.id, i]));
  const fileBuffer = fs.readFileSync(file.path);
  let parsedData;
  if(file.originalname.endsWith('.csv')) {
    parsedData = Papa.parse(fileBuffer.toString('utf-8'), { header: true, skipEmptyLines: true }).data;
  } else {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    parsedData = XLSX.utils.sheet_to_json(ws);
  }
  const mappedData = parsedData.map(row => ({
    id: row['Itemcode']?.toString().trim(),
    description: row['Description']?.toString().trim(),
    group: row['Group Desc']?.toString().trim(),
    salePrice: parseFloat(row['Saleprice']) || 0,
    quantity: parseInt(row['Totqty'], 10) || 0,
  })).filter(item => item.id);
  let newCount = 0, updatedCount = 0;
  mappedData.forEach(imported => {
    const existing = itemsMap.get(imported.id);
    if (existing) {
      itemsMap.set(imported.id, { ...existing, salePrice: imported.salePrice, pendingStockQty: imported.quantity, isUpdate: true });
      updatedCount++;
    } else {
      itemsMap.set(imported.id, { ...imported, expiryEntries: [], notes: '', pendingStockQty: imported.quantity, isUpdate: true });
      newCount++;
    }
  });
  db.items = Array.from(itemsMap.values());
  writeDb(db);
  fs.unlinkSync(file.path);
  res.status(200).json({ newCount, updatedCount, updatedItems: db.items });
});

app.post('/api/stock-update', upload.single('file'), (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).send('No file uploaded.');
    const db = readDb();
    const itemsMap = new Map(db.items.map(i => [i.id, i]));
    const fileBuffer = fs.readFileSync(file.path);
    let parsedData;
    if(file.originalname.endsWith('.csv')) {
        parsedData = Papa.parse(fileBuffer.toString('utf-8'), { header: true, skipEmptyLines: true }).data;
    } else {
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        parsedData = XLSX.utils.sheet_to_json(ws);
    }
    const updates = parsedData.map(row => ({
        id: row['Itemcode']?.toString().trim(),
        balance: parseInt(row['balance'], 10),
    })).filter(item => item.id && !isNaN(item.balance));
    updates.forEach(update => {
        const item = itemsMap.get(update.id);
        if (item) {
            const currentTotal = item.expiryEntries.reduce((sum, e) => sum + e.quantity, 0);
            if (update.balance < currentTotal) {
                let toRemove = currentTotal - update.balance;
                item.expiryEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
                const remaining = [];
                for (const entry of item.expiryEntries) {
                    if (toRemove <= 0) { remaining.push(entry); continue; }
                    if (entry.quantity <= toRemove) { toRemove -= entry.quantity; } 
                    else { entry.quantity -= toRemove; toRemove = 0; remaining.push(entry); }
                }
                item.expiryEntries = remaining;
            }
        }
    });
    db.items = Array.from(itemsMap.values());
    writeDb(db);
    fs.unlinkSync(file.path);
    res.status(200).json({ message: 'Stock updated', updatedItems: db.items });
});

// --- THIS IS THE CORRECTED CATCH-ALL ROUTE ---
// It serves the React app for any request that doesn't match an API route
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- Start the Server ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

