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
      const defaultDb = { items: [], settings: { reminderDays: 30, recipientEmails: [] }, notifications: [], pricingRules: [] };
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
    return { items: [], settings: { reminderDays: 30, recipientEmails: [] }, notifications: [], pricingRules: [] };
  }
};
const writeDb = (data) => {
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
};

// --- Scheduled Job ---
cron.schedule('* * * * *', () => { /* ... cron job logic ... */ });

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

// UPDATED IMPORT LOGIC
app.post('/api/import/master-list', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).send('No file uploaded.');
  
  const db = readDb();
  const itemsMap = new Map(db.items.map(i => [i.id, i]));
  
  const fileBuffer = fs.readFileSync(file.path);
  const parsedData = file.originalname.endsWith('.csv')
    ? Papa.parse(fileBuffer.toString('utf-8'), { header: true, skipEmptyLines: true }).data
    : XLSX.utils.sheet_to_json(XLSX.read(fileBuffer, { type: 'buffer' }).Sheets[XLSX.read(fileBuffer, { type: 'buffer' }).SheetNames[0]]);

  const mappedData = parsedData.map(row => ({
    id: row['Itemcode']?.toString().trim(),
    description: row['Description']?.toString().trim(),
    group: row['Group Desc']?.toString().trim(),
    subGroup: row['Sub Group Desc']?.toString().trim(),
    brand: row['Brand Desc']?.toString().trim(),
    supplierDescription: row['Kind Desc']?.toString().trim(),
    costPrice: parseFloat(row['Unitpri']) || 0, // Mapped from Unitpri
    discount: parseFloat(row['UnitDisc %']) || 0,
    salePrice: parseFloat(row['Saleprice']) || 0,
    quantity: parseInt(row['Totqty'], 10) || 0,
  })).filter(item => item.id);

  let newCount = 0, updatedCount = 0;
  mappedData.forEach(imported => {
    const existing = itemsMap.get(imported.id);
    const itemData = {
        ...imported,
        costPrice: imported.costPrice * (1 - imported.discount / 100) // Apply discount to cost price
    };

    if (existing) {
      itemsMap.set(imported.id, { 
        ...existing,
        ...itemData,
        isUpdate: true 
      });
      updatedCount++;
    } else {
      itemsMap.set(imported.id, { ...itemData, expiryEntries: [], notes: '', pricingHistory: [], isUpdate: true });
      newCount++;
    }
  });

  db.items = Array.from(itemsMap.values());
  writeDb(db);
  fs.unlinkSync(file.path);
  res.status(200).json({ newCount, updatedCount, updatedItems: db.items });
});

// ... (other endpoints remain)
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

