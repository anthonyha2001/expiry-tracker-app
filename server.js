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

// --- Middleware & Static Serving ---
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

// --- Scheduled Job ---
// Runs every minute for testing. Change to '0 9 * * *' for daily at 9 AM in production.
cron.schedule('* * * * *', () => {
    console.log('Running recurring check for expiring items...');
    const db = readDb();
    const { items, settings } = db;
    const today = new Date();
    const expiringItems = [];

    items.forEach(item => {
        item.expiryEntries.forEach(entry => {
            const expiryDate = new Date(entry.date);
            const daysUntilExpiry = (expiryDate - today) / (1000 * 60 * 60 * 24);
            if (daysUntilExpiry > 0 && daysUntilExpiry <= settings.reminderDays) {
                expiringItems.push({ id: item.id, description: item.description, expiryDate: entry.date, quantity: entry.quantity });
            }
        });
    });

    const notification = sendReminderEmail(settings.recipientEmails, expiringItems);
    if (notification) {
        const similarExists = db.notifications.some(n => n.content === notification.content && (new Date() - new Date(n.date)) < 300000); // 5 minute cooldown
        if (!similarExists) {
            db.notifications.unshift(notification);
            writeDb(db);
        }
    }
});

// --- API Endpoints ---
app.get('/api/data', (req, res) => res.json(readDb()));

app.post('/api/settings', (req, res) => {
  const { settings } = req.body;
  const db = readDb();
  db.settings = settings;
  writeDb(db);
  res.status(200).json({ message: 'Settings saved.' });
});

app.post('/api/pricing/save', (req, res) => {
    const { items, pricingRules } = req.body;
    if (!Array.isArray(items) || !Array.isArray(pricingRules)) {
        return res.status(400).json({ message: 'Invalid data format.' });
    }
    const db = readDb();
    db.items = items;
    db.pricingRules = pricingRules;
    writeDb(db);
    res.status(200).json({ message: 'Pricing changes saved successfully.' });
});

app.post('/api/import/master-list', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).send('No file uploaded.');
  
  const db = readDb();
  const itemsMap = new Map(db.items.map(i => [i.id, i]));
  
  const fileBuffer = fs.readFileSync(file.path);
  const parsedData = file.originalname.endsWith('.csv')
    ? Papa.parse(fileBuffer.toString('utf-8'), { header: true, skipEmptyLines: true }).data
    : XLSX.utils.sheet_to_json(XLSX.read(fileBuffer, { type: 'buffer' }).Sheets[XLSX.read(fileBuffer, { type: 'buffer' }).SheetNames[0]]);

  const mappedData = parsedData.map(row => {
    const discount = parseFloat(row['UnitDisc %']) || 0;
    const costPrice = parseFloat(row['Unitpri']) || 0;
    const netCost = costPrice * (1 - discount / 100);

    return {
        id: row['Itemcode']?.toString().trim(),
        description: row['Description']?.toString().trim(),
        group: row['Group Desc']?.toString().trim(),
        subGroup: row['Sub Group Desc']?.toString().trim(),
        brand: row['Brand Desc']?.toString().trim(),
        purchaseNumber: row['No.']?.toString().trim(),
        lastPurchaseDate: row['Date']?.toString().trim(),
        supplierDescription: row['Kind Desc']?.toString().trim(),
        costPrice: netCost,
        discount: discount,
        salePrice: parseFloat(row['Saleprice']) || 0,
        quantity: parseInt(row['Totqty'], 10) || 0,
    };
  }).filter(item => item.id);

  let newCount = 0, updatedCount = 0;
  mappedData.forEach(imported => {
    const existing = itemsMap.get(imported.id);
    if (existing) {
      itemsMap.set(imported.id, { 
        ...existing,
        ...imported, 
        isUpdate: true 
      });
      updatedCount++;
    } else {
      itemsMap.set(imported.id, { ...imported, expiryEntries: [], notes: '', pricingHistory: [], isUpdate: true });
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
    if (!file) return res.status(400).json({ message: 'No file uploaded.' });
    
    try {
        const db = readDb();
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
                    const toAdd = newBalance - currentTotal;
                    item.pendingStockQty = (item.pendingStockQty || 0) + toAdd;
                    item.isUpdate = true;
                }
            }
        });
        
        db.items = Array.from(itemsMap.values());
        db.backup = backup;
        writeDb(db);
        fs.unlinkSync(file.path);
        res.status(200).json({ message: `${updates.length} items processed.`, updatedItems: db.items });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/stock-undo', (req, res) => {
    const db = readDb();
    if (db.backup) {
        db.items = db.backup;
        db.backup = null;
        writeDb(db);
        res.status(200).json({ message: 'Undo successful.', updatedItems: db.items });
    } else {
        res.status(404).json({ message: 'No update to undo.' });
    }
});

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});