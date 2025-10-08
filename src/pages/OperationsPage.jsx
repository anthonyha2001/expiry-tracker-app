import React, { useState, useMemo } from 'react';
import { useInventory } from '../hooks/useInventory.js';
import { Save, History, Database, Filter, UploadCloud } from 'lucide-react';
import MultiSelectDropdown from '../components/MultiSelectDropdown.jsx';
import ImportModal from '../components/ImportModal.jsx';

const OperationsPage = () => {
    // Use `pendingItems` from the context instead of the full `items` list
    const { pendingItems, groups, addMultipleExpiries, clearPendingUpdates } = useInventory();
    const [inputs, setInputs] = useState({});
    const [message, setMessage] = useState('');
    const [selectedGroups, setSelectedGroups] = useState([]);
    const [filterActive, setFilterActive] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const filteredItems = useMemo(() => {
        // The list is now pre-filtered, so we only need to apply the group filter
        return pendingItems.filter(item => selectedGroups.length === 0 || selectedGroups.includes(item.group));
    }, [pendingItems, selectedGroups]);

    const handleClear = () => {
        setInputs({});
        clearPendingUpdates(); // This now clears the entire inventory
        setMessage('Cleared all inventory data.');
        setTimeout(() => setMessage(''), 3000);
    };

    const handleSaveAll = () => {
        const newEntries = filteredItems.map(item => {
            const userInput = inputs[item.id] || {};
            const date = userInput.date;
            const quantity = userInput.quantity || item.pendingStockQty;
            if (date && quantity && parseInt(quantity, 10) > 0) {
                return { itemId: item.id, date, quantity };
            }
            return null;
        }).filter(Boolean);

        if (newEntries.length > 0) {
            addMultipleExpiries(newEntries);
            setMessage(`${newEntries.length} new entries saved.`);
            setInputs({});
        } else {
            setMessage('No valid entries to save.');
        }
        setTimeout(() => setMessage(''), 3000);
    };
    
    const handleInputChange = (itemId, field, value) => {
        setInputs(prev => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
    };

    const handleKeyDown = (event, itemId, fieldType) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const currentIdx = filteredItems.findIndex(i => i.id === itemId);
        if (fieldType === 'date') {
            document.getElementById(`${itemId}-quantity`)?.focus();
        } else if (fieldType === 'quantity' && currentIdx < filteredItems.length - 1) {
            document.getElementById(`${filteredItems[currentIdx + 1].id}-date`)?.focus();
        } else {
            document.getElementById('save-all-button')?.focus();
        }
    };

    return (
        <div className="page-container">
            <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
            
            <div className={`distraction-free-filter ${filterActive ? 'active' : ''}`}>
                <div className="filter-content">
                    <h3>Filter by Group</h3>
                    <MultiSelectDropdown options={groups} selectedOptions={selectedGroups} onChange={setSelectedGroups} />
                    <button className="button-primary" onClick={() => setFilterActive(false)}>Apply Filter</button>
                </div>
            </div>
            
            <div className="container-header">
                <h1 className="page-title">Batch Expiry Editor</h1>
                <div className="container-actions">
                    <button className="button-secondary" onClick={() => setIsImportModalOpen(true)}>
                        <UploadCloud size={16}/> Import
                    </button>
                    <button className="button-secondary" onClick={() => setFilterActive(true)}>
                        <Filter size={16}/> {selectedGroups.length > 0 ? `${selectedGroups.length} Groups Filtered` : 'Filter'}
                    </button>
                    <button className="button-secondary" onClick={handleClear} title="Deletes all items from the inventory">
                        <History size={16}/> Clear All Data
                    </button>
                    <button id="save-all-button" className="button-primary" onClick={handleSaveAll}><Save size={16} /> Save Entries</button>
                </div>
            </div>
            <div className="batch-editor-table">
                {/* Check `pendingItems` instead of `items` to decide what to show */}
                {pendingItems.length > 0 ? (
                    filteredItems.length > 0 ? filteredItems.map(item => (
                        <div key={item.id} className={item.isUpdate ? "batch-editor-row updated" : "batch-editor-row"}>
                            <div className="batch-item-info">
                                <div className="batch-item-desc-wrapper">
                                    {item.expiryEntries?.length > 0 && <Database size={14} className="record-exists-flag" title="This item has existing expiry records" />}
                                    <span className="batch-item-desc">{item.description}</span>
                                </div>
                                <span className="batch-item-id">{item.id}</span>
                            </div>
                            <div className="batch-item-inputs">
                                <input id={`${item.id}-date`} type="date" className="batch-input" value={inputs[item.id]?.date || ''} onChange={e => handleInputChange(item.id, 'date', e.target.value)} onKeyDown={e => handleKeyDown(e, item.id, 'date')} />
                                <input id={`${item.id}-quantity`} type="number" placeholder={item.pendingStockQty > 0 ? `Default: ${item.pendingStockQty}` : 'Qty'} className="batch-input quantity-input" value={inputs[item.id]?.quantity || ''} onChange={e => handleInputChange(item.id, 'quantity', e.target.value)} onKeyDown={e => handleKeyDown(e, item.id, 'quantity')} min="1" />
                            </div>
                        </div>
                    )) : <p className="placeholder-text">No pending items match your filter.</p>
                ) : (
                    <p className="placeholder-text">No items are currently pending an update. Use the Import button to begin.</p>
                )}
            </div>
        </div>
    );
};

export default OperationsPage;

