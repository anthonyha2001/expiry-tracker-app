import React, { useState, useMemo } from 'react';
import { useInventory } from '../hooks/useInventory.js';
import { differenceInDays, parseISO, format } from 'date-fns';
import { Calendar, Clock, Package, ThumbsUp, X } from 'lucide-react';

// Categories for expiry dates
const categories = {
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
    const categorized = {
        '<1mo': [], '1-2mo': [], '2-5mo': [], '5mo-1y': [], '>1y': []
    };
    if (loading) return categorized;

    items.forEach(item => {
        item.expiryEntries.forEach(entry => {
            const daysUntil = differenceInDays(parseISO(entry.date), new Date());
            if (daysUntil < 0) return; // Skip already expired

            const fullItemEntry = { ...item, ...entry, daysUntil };
            
            if (daysUntil <= categories['<1mo'].days) categorized['<1mo'].push(fullItemEntry);
            else if (daysUntil <= categories['1-2mo'].days) categorized['1-2mo'].push(fullItemEntry);
            else if (daysUntil <= categories['2-5mo'].days) categorized['2-5mo'].push(fullItemEntry);
            else if (daysUntil <= categories['5mo-1y'].days) categorized['5mo-1y'].push(fullItemEntry);
            else categorized['>1y'].push(fullItemEntry);
        });
    });
    return categorized;
  }, [items, loading]);

  return (
    <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Get a quick overview of your inventory's expiry status. Click on a card to see details.</p>
        
        <div className="dashboard-cards-grid">
            {Object.entries(categories).map(([key, cat]) => (
                <div key={key} className="dashboard-card" style={{'--card-color': cat.color}} onClick={() => setSelectedCategory(key)}>
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
                <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '800px'}}>
                    <div className="modal-header">
                        <h2 style={{color: categories[selectedCategory].color}}>{categories[selectedCategory].label}</h2>
                        <button className="modal-close-button" onClick={() => setSelectedCategory(null)}><X size={24}/></button>
                    </div>
                    <div className="item-list-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Description</th>
                                    <th>Item Code</th>
                                    <th>Expiry Date</th>
                                    <th>Quantity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categorizedItems[selectedCategory].length > 0 ? (
                                    categorizedItems[selectedCategory]
                                        .sort((a,b) => a.daysUntil - b.daysUntil)
                                        .map(item => (
                                        <tr key={item.id + item.addedAt}>
                                            <td>{item.description}</td>
                                            <td>{item.id}</td>
                                            <td>{format(parseISO(item.date), 'dd-MM-yyyy')}</td>
                                            <td>{item.quantity}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="4" style={{textAlign: 'center'}}>No items in this category.</td></tr>
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

