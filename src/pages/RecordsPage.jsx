import React, { useState, useMemo } from 'react';
import { useInventory } from '../hooks/useInventory.js';
import { Search, Check, X, Trash2, Edit2 } from 'lucide-react';
import { getExpiryStatus } from '../utils/dateUtils.js';
import { format, parseISO } from 'date-fns';
import MultiSelectDropdown from '../components/MultiSelectDropdown.jsx';

// A reusable component for inline table cell editing (Description, Group, etc.)
const EditableCell = ({ value, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);

    const handleSave = () => {
        if (currentValue !== value) {
            onSave(currentValue);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter') handleSave();
        else if (event.key === 'Escape') {
            setCurrentValue(value);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return <input type="text" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} onBlur={handleSave} onKeyDown={handleKeyDown} autoFocus className="inline-edit-input"/>;
    }
    return <span onClick={() => setIsEditing(true)} className="editable-cell-text">{value || '...'}</span>;
};

// A new component specifically for editing expiry date quantities
const EditableExpiryTag = ({ item, entry, onUpdate, onDelete }) => {
    const [isEditingQty, setIsEditingQty] = useState(false);
    const [quantity, setQuantity] = useState(entry.quantity);

    const handleSaveQuantity = () => {
        const newQty = parseInt(quantity, 10);
        if (!isNaN(newQty) && newQty > 0) {
            onUpdate(item.id, entry.addedAt, newQty);
        }
        setIsEditingQty(false);
    };
    
    const status = getExpiryStatus(entry.date);

    return (
        <div className={`expiry-tag ${status}`}>
            <span className="expiry-date-text">{format(parseISO(entry.date), 'dd MMM yyyy')} - Qty: </span>
            {isEditingQty ? (
                <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    onBlur={handleSaveQuantity}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveQuantity()}
                    className="quantity-edit-input"
                    autoFocus
                />
            ) : (
                <span className="expiry-quantity-text">{entry.quantity}</span>
            )}
            <div className="expiry-tag-actions">
                <button onClick={() => setIsEditingQty(!isEditingQty)} title="Edit quantity">
                    {isEditingQty ? <Check size={14} /> : <Edit2 size={12} />}
                </button>
                <button onClick={() => onDelete(item.id, entry.addedAt)} title="Delete entry">
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    );
};


const RecordsPage = () => {
  const { items, groups, saveItems } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroups, setSelectedGroups] = useState([]);

  const filteredItems = useMemo(() => {
    return items.filter(item => 
        (selectedGroups.length === 0 || selectedGroups.includes(item.group)) &&
        (item.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
         item.id.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [items, searchTerm, selectedGroups]);
  
  const handleUpdateItem = (itemId, field, newValue) => {
    const newItemsState = items.map(item => item.id === itemId ? { ...item, [field]: newValue } : item);
    saveItems(newItemsState);
  };

  const handleDeleteExpiry = (itemId, entryAddedAt) => {
      const newItemsState = items.map(item => {
          if (item.id === itemId) {
              const updatedEntries = item.expiryEntries.filter(e => e.addedAt !== entryAddedAt);
              return { ...item, expiryEntries: updatedEntries };
          }
          return item;
      });
      saveItems(newItemsState);
  };
  
  const handleUpdateExpiryQuantity = (itemId, entryAddedAt, newQuantity) => {
      const newItemsState = items.map(item => {
          if (item.id === itemId) {
              const updatedEntries = item.expiryEntries.map(e => e.addedAt === entryAddedAt ? { ...e, quantity: newQuantity } : e);
              return { ...item, expiryEntries: updatedEntries };
          }
          return item;
      });
      saveItems(newItemsState);
  };

  return (
    <div className="page-container">
      <h1 className="page-title">Inventory Records</h1>
      <p className="page-subtitle">Manage inventory: click on Description/Group/Notes to edit text. Use icons on expiry tags to edit quantity or delete.</p>
      
      <div className="records-controls">
        <div className="search-input-wrapper">
          <Search size={20} className="search-icon" />
          <input type="text" placeholder="Search..." className="search-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
        </div>
        <MultiSelectDropdown options={groups} selectedOptions={selectedGroups} onChange={setSelectedGroups}/>
      </div>

      <div className="table-container">
        <table className="records-table">
          <thead>
            <tr>
              <th>Item Code</th>
              <th>Description</th>
              <th>Group</th>
              <th>Sale Price</th>
              <th>Expiry Dates (FIFO)</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map(item => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td><EditableCell value={item.description} onSave={(newValue) => handleUpdateItem(item.id, 'description', newValue)} /></td>
                <td><EditableCell value={item.group} onSave={(newValue) => handleUpdateItem(item.id, 'group', newValue)} /></td>
                <td>${(item.salePrice || 0).toFixed(2)}</td>
                <td>
                  {item.expiryEntries?.length > 0 ? (
                    <div className="expiry-list">
                      {[...item.expiryEntries].sort((a,b) => new Date(a.date) - new Date(b.date)).map(entry => (
                        <EditableExpiryTag 
                            key={entry.addedAt}
                            item={item}
                            entry={entry}
                            onUpdate={handleUpdateExpiryQuantity}
                            onDelete={handleDeleteExpiry}
                        />
                      ))}
                    </div>
                  ) : <span className="no-records-text">-</span>}
                </td>
                <td><EditableCell value={item.notes} onSave={(newValue) => handleUpdateItem(item.id, 'notes', newValue)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecordsPage;

