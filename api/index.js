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

dotenv.config();
const app = express();

// Vercel's serverless environment uses a temporary directory
const UPLOAD_DIR = '/tmp';
const upload = multer({ dest: UPLOAD_DIR }); 
const DB_FILE_PATH = path.join(UPLOAD_DIR, 'inventory-db.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

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
    // Ensure all necessary properties exist
    if (!db.settings) db.settings = { reminderDays: 30, recipientEmails: [] };
    if (!db.notifications) db.notifications = [];
    if (!db.pricingRules) db.pricingRules = [];
    return db;
  } catch (error) {
    console.error("Error reading DB:", error);
    return { items: [], settings: { reminderDays: 30, recipientEmails: [] }, notifications: [], pricingRules: [], backup: null };
  }
};

const writeDb = (data) => {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error("Error writing to DB:", error);
  }
};

// --- API Endpoints ---
app.get('/api/data', (req, res) => {
    res.json(readDb());
});

app.post('/api/settings', (req, res) => {
  const { settings } = req.body;
  if (!settings) {
    return res.status(400).json({ message: 'Invalid data format.' });
  }
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
  if (!file) return res.status(400).json({ message: 'No file uploaded.' });

  try {
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
        itemsMap.set(imported.id, { ...existing, ...imported, isUpdate: true });
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
  } catch (error) {
      console.error("Master import error:", error);
      res.status(500).json({ message: error.message });
  }
});

// We no longer call app.listen(). Instead, we export the app.
export default app;

