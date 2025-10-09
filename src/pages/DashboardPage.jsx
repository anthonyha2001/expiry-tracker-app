import React, { useState, useMemo } from 'react';
import { useInventory } from '../hooks/useInventory.js';
import { differenceInDays, parseISO, format } from 'date-fns';
import { ArchiveX, Calendar, Clock, Package, ThumbsUp, X, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';

// Categories for expiry dates, including the new 'expired' category
const categories = {
    expired: { label: 'Expired Items', days: 0, icon: ArchiveX, color: '#7f1d1d' }, // Dark Red
    '<1mo': { label: 'Less than 1 Month', days: 30, icon: Clock, color: 'var(--status-expired-text)' },
    '1-2mo': { label: '1-2 Months', days: 60, icon: Calendar, color: 'var(--status-near-expiry-text)' },
    '2-5mo': { label: '2-5 Months', days: 150, icon: Calendar, color: '#0E7490' },
    '5mo-1y': { label: '5 Months - 1 Year', days: 365, icon: Package, color: '#374151' },
    '>1y': { label: 'More than 1 Year', days: Infinity, icon: ThumbsUp, color: 'var(--status-ok-text)' },
};

const DashboardPage = () => {
  const { items, loading } = useInventory();
  const [selectedCategory, setSelectedCategory] = useState(null);

  const categorizedItems = useMemo(() => {
    // Initialize categories
    const categorized = Object.keys(categories).reduce((acc, key) => ({ ...acc, [key]: [] }), {});
    
    if (loading) return categorized;

    items.forEach(item => {
        // Add new properties if they don't exist
        const itemWithDefaults = {
            ...item,
            purchaseNumber: item.purchaseNumber || 'N/A',
            lastPurchaseDate: item.lastPurchaseDate || null,
        };

        itemWithDefaults.expiryEntries.forEach(entry => {
            const daysUntil = differenceInDays(parseISO(entry.date), new Date());
            const fullItemEntry = { ...itemWithDefaults, ...entry, daysUntil };

            // Handle expired items first
            if (daysUntil < 0) {
                categorized.expired.push(fullItemEntry);
            } else if (daysUntil <= categories['<1mo'].days) {
                categorized['<1mo'].push(fullItemEntry);
            } else if (daysUntil <= categories['1-2mo'].days) {
                categorized['1-2mo'].push(fullItemEntry);
            } else if (daysUntil <= categories['2-5mo'].days) {
                categorized['2-5mo'].push(fullItemEntry);
            } else if (daysUntil <= categories['5mo-1y'].days) {
                categorized['5mo-1y'].push(fullItemEntry);
            } else {
                categorized['>1y'].push(fullItemEntry);
            }
        });
    });
    return categorized;
  }, [items, loading]);
  
  const currentCategoryData = selectedCategory ? categorizedItems[selectedCategory] : [];

  const handleExport = () => {
    if (!selectedCategory || currentCategoryData.length === 0) return;

    // Prepare data with the required headers including new fields
    const dataToExport = currentCategoryData.map(item => ({
        'Item Code': item.id,
        'Description': item.description,
        'Supplier Description': item.supplierDescription || 'N/A',
        'Purchase Number': item.purchaseNumber,
        'Last Purchase Date': item.lastPurchaseDate ? format(parseISO(item.lastPurchaseDate), 'dd-MM-yyyy') : 'N/A',
        'Expiry Date': format(parseISO(item.date), 'dd-MM-yyyy'),
        'Quantity': item.quantity
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expiry Report");

    // Generate a filename based on the category
    XLSX.writeFile(wb, `${categories[selectedCategory].label.replace(/ /g, '_')}_Report.xlsx`);
  };

  return (
    <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Get a quick overview of your inventory's expiry status. Click on a card to see details.</p>
        
        <div className="dashboard-cards-grid">
            {Object.entries(categories).map(([key, cat]) => (
                <div 
                    key={key} 
                    className={`dashboard-card ${key === 'expired' ? 'expired-card' : ''}`}
                    style={{'--card-color': cat.color}} 
                    onClick={() => setSelectedCategory(key)}
                >
                    <div className="card-icon"><cat.icon size={28}/></div>
                    <div className="card-content">
                        <span className="card-count">{categorizedItems[key].length}</span>
                        <h3 className="card-title">{cat.label}</h3>
                    </div>
                </div>
            ))}
        </div>

        {selectedCategory && (
            <div className="modal-overlay" onClick={() => setSelectedCategory(null)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '1000px'}}>
                    <div className="modal-header">
                        <h2 style={{color: categories[selectedCategory].color}}>{categories[selectedCategory].label}</h2>
                        <div className="modal-header-actions">
                            <button className="button-secondary" onClick={handleExport}>
                                <FileDown size={16} /> Export to Excel
                            </button>
                            <button className="modal-close-button" onClick={() => setSelectedCategory(null)}><X size={24}/></button>
                        </div>
                    </div>
                    <div className="item-list-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Description</th>
                                    <th>Supplier</th>
                                    <th>Item Code</th>
                                    <th>Purchase No.</th>
                                    <th>Last Purchase</th>
                                    <th>Expiry Date</th>
                                    <th>Quantity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentCategoryData.length > 0 ? (
                                    currentCategoryData
                                        .sort((a,b) => a.daysUntil - b.daysUntil)
                                        .map(item => (
                                        <tr key={item.id + item.addedAt}>
                                            <td>{item.description}</td>
                                            <td>{item.supplierDescription || 'N/A'}</td>
                                            <td>{item.id}</td>
                                            <td>{item.purchaseNumber}</td>
                                            <td>{item.lastPurchaseDate ? format(parseISO(item.lastPurchaseDate), 'dd-MM-yyyy') : 'N/A'}</td>
                                            <td>{format(parseISO(item.date), 'dd-MM-yyyy')}</td>
                                            <td>{item.quantity}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="7" style={{textAlign: 'center'}}>No items in this category.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default DashboardPage;

