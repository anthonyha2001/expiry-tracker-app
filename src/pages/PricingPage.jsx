import React, { useState, useMemo, useEffect } from 'react';
import { useInventory } from '../hooks/useInventory.js';
import { Plus, Trash2, Save, Percent, CheckCircle, UploadCloud } from 'lucide-react';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';

// --- Helper Functions ---
const calculatePrice = (cost, percentage, includesVat) => {
    // Formula: (cost * 1.11) / (1 - percentage)
    if (!cost || percentage === null || percentage === '') return cost;
    const margin = 1 - (parseFloat(percentage) / 100);
    if (margin <= 0) return cost * 10; // Handle high margins to avoid negative/infinite prices
    const priceWithVat = (cost * 1.11) / margin;
    return includesVat ? priceWithVat : priceWithVat / 1.11;
};

const getMarginStatus = (cost, newPrice, includesVat) => {
    if (!cost || !newPrice) return 'margin-ok';
    const priceBeforeVat = includesVat ? newPrice / 1.11 : newPrice;
    if (priceBeforeVat < cost) return 'margin-loss'; // Under cost
    const margin = ((priceBeforeVat - cost) / priceBeforeVat) * 100;
    if (margin <= 5) return 'margin-low'; // 5% or less margin
    return 'margin-ok';
};


// --- Main Pricing Page Component ---
const PricingPage = () => {
    const { items, pricingRules, savePricingChanges } = useInventory();
    
    const [localItems, setLocalItems] = useState([]);
    const [localRules, setLocalRules] = useState([]);
    const [saveMessage, setSaveMessage] = useState('');
    const [importMessage, setImportMessage] = useState('');

    useEffect(() => {
        // Initialize local state, adding a temporary pricing object to each item
        setLocalItems(items.map(item => ({ 
            ...item, 
            _pricing: { 
                percentage: null, 
                ruleId: null, 
                includesVat: true, 
                newPrice: item.salePrice || 0 
            } 
        })));
        setLocalRules(pricingRules);
    }, [items, pricingRules]);

    const handleFileUpload = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const ws = workbook.Sheets[workbook.SheetNames[0]];
            const parsedData = XLSX.utils.sheet_to_json(ws);

            const importedItems = parsedData.map(row => {
                const discount = parseFloat(row['UnitDisc %']) || 0;
                const costPrice = (parseFloat(row['Unitpri']) || 0); // Cost before discount
                const netCost = costPrice * (1 - discount / 100); // Cost after discount
                return {
                    id: row['Itemcode']?.toString().trim(),
                    description: row['Description']?.toString().trim(),
                    group: row['Group Desc']?.toString().trim(),
                    subGroup: row['Sub Group Desc']?.toString().trim(),
                    brand: row['Brand Desc']?.toString().trim(),
                    supplierDescription: row['Kind Desc']?.toString().trim(),
                    costPrice: netCost, // Use the net cost for calculations
                    discount: discount,
                    salePrice: parseFloat(row['Saleprice']) || 0, // This is the "old" price
                    _pricing: { percentage: null, ruleId: null, includesVat: true, newPrice: parseFloat(row['Saleprice']) || 0 },
                };
            }).filter(item => item.id);
            
            setLocalItems(importedItems);
            setImportMessage(`Successfully imported ${importedItems.length} items for pricing.`);
            setTimeout(() => setImportMessage(''), 5000);
        };
        reader.readAsBinaryString(file);
    };

    const handleSaveAll = () => {
        const itemsToSave = localItems.map(item => {
            const { _pricing, ...rest } = item;
            const hasChanged = _pricing.newPrice !== (item.salePrice || 0);
            if (hasChanged) {
                const newHistoryEntry = { 
                    date: new Date().toISOString(), 
                    newPrice: _pricing.newPrice,
                    ruleApplied: _pricing.ruleId || `Manual: ${_pricing.percentage}%`,
                    includesVat: _pricing.includesVat 
                };
                return { 
                    ...rest, 
                    salePrice: _pricing.newPrice, 
                    pricingHistory: [newHistoryEntry, ...(item.pricingHistory || [])] 
                };
            }
            return rest; // Return item without _pricing temp state
        });
        savePricingChanges(itemsToSave, localRules);
        setSaveMessage('Pricing changes saved successfully!');
        setTimeout(() => setSaveMessage(''), 4000);
    };

    const handleGlobalVatChange = (isVatIncluded) => {
        const updatedItems = localItems.map(item => {
            const percentage = item._pricing.percentage; // Use manual % if it exists, otherwise rule % will be recalculated
            const newPrice = calculatePrice(item.costPrice, percentage, isVatIncluded);
            return { ...item, _pricing: { ...item._pricing, includesVat: isVatIncluded, newPrice } };
        });
        setLocalItems(updatedItems);
    };

    return (
        <div className="page-container">
            <div className="container-header">
                <h1 className="page-title">Pricing Strategy</h1>
                <div className="container-actions">
                    <label htmlFor="pricing-import" className="button-secondary"><UploadCloud size={16} /> Import</label>
                    <input id="pricing-import" type="file" className="file-input" accept=".xlsx, .csv" onChange={(e) => handleFileUpload(e.target.files[0])} />
                    <button className="button-primary" onClick={handleSaveAll}><Save size={16} /> Save All Changes</button>
                </div>
            </div>
            {saveMessage && <div className="save-confirmation" style={{marginBottom: '1rem'}}><CheckCircle size={18} /><span>{saveMessage}</span></div>}
            {importMessage && <div className="status-message" style={{marginBottom: '1rem'}}><p>{importMessage}</p></div>}
            
            <div className="pricing-grid">
                <RuleEditor items={localItems} localRules={localRules} setLocalRules={setLocalRules} />
                <PricingGrid localItems={localItems} setLocalItems={setLocalItems} localRules={localRules} onGlobalVatChange={handleGlobalVatChange} />
            </div>
        </div>
    );
};

// --- Rule Editor Sub-component ---
const RuleEditor = ({ items, localRules, setLocalRules }) => {
    const [newRule, setNewRule] = useState({ supplier: '', category: '', subCategory: '', brand: '', percentage: '' });
    
    const uniqueValues = useMemo(() => ({
        supplier: [...new Set(items.map(i => i.supplierDescription).filter(Boolean))],
        category: [...new Set(items.map(i => i.group).filter(Boolean))],
        subCategory: [...new Set(items.map(i => i.subGroup).filter(Boolean))],
        brand: [...new Set(items.map(i => i.brand).filter(Boolean))],
    }), [items]);
    
    const handleAddRule = () => {
        if (newRule.percentage) { // A percentage is the only required field
            setLocalRules([...localRules, { id: uuidv4(), ...newRule }]);
            setNewRule({ supplier: '', category: '', subCategory: '', brand: '', percentage: '' });
        }
    };
    
    const handleDeleteRule = (ruleId) => setLocalRules(localRules.filter(rule => rule.id !== ruleId));

    return (
        <div className="rule-editor">
            <h2 className="container-title">Pricing Rules</h2>
            <div className="rule-form">
                {Object.keys(uniqueValues).map(type => (
                    <div className="form-group" key={type}>
                        <label>{type.charAt(0).toUpperCase() + type.slice(1)}</label>
                        <select value={newRule[type]} onChange={e => setNewRule({ ...newRule, [type]: e.target.value })}>
                            <option value="">Any</option>
                            {uniqueValues[type].sort().map(val => <option key={val} value={val}>{val}</option>)}
                        </select>
                    </div>
                ))}
                <div className="form-group">
                    <label>Percentage (%)</label>
                    <input type="number" placeholder="e.g., 20" value={newRule.percentage} onChange={e => setNewRule({...newRule, percentage: e.target.value})} />
                </div>
                <div className="form-group">
                    <label>&nbsp;</label>
                    <button className="button-primary" onClick={handleAddRule} style={{width: '100%'}}><Plus size={16}/> Add Rule</button>
                </div>
            </div>
            <div className="rule-list">
                {localRules.map(rule => (
                    <div key={rule.id} className="rule-list-item">
                        <span>{`${rule.supplier || '*'}/${rule.category || '*'}/${rule.subCategory || '*'}/${rule.brand || '*'} @ ${rule.percentage}%`}</span>
                        <button className="rule-delete-btn" onClick={() => handleDeleteRule(rule.id)}><Trash2 size={14}/></button>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Pricing Grid Sub-component ---
const PricingGrid = ({ localItems, setLocalItems, localRules, onGlobalVatChange }) => {
    const [globalVat, setGlobalVat] = useState(true);

    useEffect(() => onGlobalVatChange(globalVat), [globalVat]);

    useEffect(() => {
        setLocalItems(prevItems => prevItems.map(item => {
            if (item._pricing.percentage !== null) return item; // Manual % overrides rules
            const appliedRule = localRules.find(r => 
                (!r.brand || r.brand === item.brand) &&
                (!r.subCategory || r.subCategory === item.subGroup) &&
                (!r.category || r.category === item.group) &&
                (!r.supplier || r.supplier === item.supplierDescription)
            );
            const newPrice = calculatePrice(item.costPrice, appliedRule?.percentage, item._pricing.includesVat);
            return { ...item, _pricing: { ...item._pricing, newPrice, ruleId: appliedRule ? appliedRule.id : null }};
        }));
    }, [localRules, localItems.length]); // Re-run when rules change
    
    const handleManualPercentageChange = (itemId, percentage) => {
        setLocalItems(prevItems => prevItems.map(item => {
            if (item.id === itemId) {
                const newPrice = calculatePrice(item.costPrice, percentage, item._pricing.includesVat);
                return { ...item, _pricing: { ...item._pricing, percentage, newPrice, ruleId: null } };
            }
            return item;
        }));
    };

    const handleItemVatChange = (itemId, isVatIncluded) => {
        setLocalItems(prevItems => prevItems.map(item => {
            if (item.id === itemId) {
                const appliedRule = localRules.find(r => r.id === item._pricing.ruleId);
                const percentage = item._pricing.percentage ?? appliedRule?.percentage;
                const newPrice = calculatePrice(item.costPrice, percentage, isVatIncluded);
                return { ...item, _pricing: { ...item._pricing, includesVat: isVatIncluded, newPrice } };
            }
            return item;
        }));
    };

    return (
        <div className="settings-section">
            <div className="pricing-table-controls">
                <h2 className="container-title">Pricing Grid</h2>
                <div className="vat-toggle">
                    <input type="checkbox" id="vat-toggle" checked={globalVat} onChange={e => setGlobalVat(e.target.checked)} />
                    <label htmlFor="vat-toggle">Apply 11% VAT to all</label>
                </div>
            </div>
            <div className="table-container" style={{maxHeight: '60vh'}}>
                <table className="records-table pricing-table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>Cost</th>
                            <th>Discount</th>
                            <th>Old Price</th>
                            <th>Manual %</th>
                            <th>VAT</th>
                            <th>New Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        {localItems.map(item => {
                            const marginStatus = getMarginStatus(item.costPrice, item._pricing.newPrice, item._pricing.includesVat);
                            return (
                                <tr key={item.id}>
                                    <td>
                                        <div className="pricing-item-details">
                                            <span>{item.description}</span>
                                            <small>{item.supplierDescription}</small>
                                            <small className="pricing-item-path">{item.group} &gt; {item.subGroup} &gt; {item.brand}</small>
                                        </div>
                                    </td>
                                    <td>${(item.costPrice || 0).toFixed(2)}</td>
                                    <td>{item.discount || 0}%</td>
                                    <td>${(item.salePrice || 0).toFixed(2)}</td>
                                    <td>
                                        <div className="percent-input">
                                            <Percent size={14} />
                                            <input type="number" placeholder="--" value={item._pricing.percentage === null ? '' : item._pricing.percentage} onChange={e => handleManualPercentageChange(item.id, e.target.value === '' ? null : parseFloat(e.target.value))}/>
                                        </div>
                                    </td>
                                    <td><input type="checkbox" className="checkbox-input" checked={item._pricing.includesVat} onChange={e => handleItemVatChange(item.id, e.target.checked)} /></td>
                                    <td className={`new-price-cell ${marginStatus}`}>
                                        ${(item._pricing.newPrice || 0).toFixed(2)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PricingPage;

