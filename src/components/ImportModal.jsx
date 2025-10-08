import React, { useState } from 'react';
import { useInventory } from '../hooks/useInventory.js';
import { UploadCloud, CheckCircle, AlertTriangle, X } from 'lucide-react';

// Reusable File Uploader Component
const FileUploader = ({ onFileSelect, id, message, error }) => (
    <div className="import-modal-uploader">
        <label htmlFor={id} className="button-secondary"><UploadCloud size={16}/> Select File</label>
        <input 
            id={id} 
            type="file" 
            className="file-input" 
            accept=".csv, .xlsx" 
            onChange={(e) => { 
                onFileSelect(e.target.files[0]); 
                e.target.value = null; 
            }} 
        />
        {message && <div className="status-message"><CheckCircle size={16}/><p>{message}</p></div>}
        {error && <div className="error-message"><AlertTriangle size={16}/><p>{error}</p></div>}
    </div>
);

const ImportModal = ({ isOpen, onClose }) => {
    const { uploadMasterFile, uploadStockBalanceFile } = useInventory();
    const [activeTab, setActiveTab] = useState('master');

    const [masterMessage, setMasterMessage] = useState('');
    const [masterError, setMasterError] = useState('');
    const [stockMessage, setStockMessage] = useState('');
    const [stockError, setStockError] = useState('');

    const handleMasterFile = async (file) => {
        if (!file) return;
        setMasterMessage('Processing...');
        setMasterError('');
        try {
            const { newCount, updatedCount } = await uploadMasterFile(file);
            setMasterMessage(`Success! Added: ${newCount}, Updated: ${updatedCount}.`);
        } catch (err) {
            setMasterError(err.message);
            setMasterMessage('');
        }
    };
    
    const handleStockFile = async (file) => {
        if (!file) return;
        setStockMessage('Processing...');
        setStockError('');
        try {
            const result = await uploadStockBalanceFile(file);
            setStockMessage(result.message);
        } catch (err) {
            setStockError(err.message);
            setStockMessage('');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Data Imports</h2>
                    <button onClick={onClose} className="modal-close-button"><X size={20}/></button>
                </div>
                <div className="modal-tabs">
                    <button 
                        className={`modal-tab ${activeTab === 'master' ? 'active' : ''}`}
                        onClick={() => setActiveTab('master')}>
                        Master List / Add Stock
                    </button>
                    <button 
                        className={`modal-tab ${activeTab === 'stock' ? 'active' : ''}`}
                        onClick={() => setActiveTab('stock')}>
                        Update Stock Balance
                    </button>
                </div>
                <div className="modal-body">
                    {activeTab === 'master' && (
                        <div>
                            <p className="import-description">Import a master list of all products. This will add new items and flag existing ones for stock updates using the 'Totqty' column.</p>
                            <FileUploader onFileSelect={handleMasterFile} id="modal-master-upload" message={masterMessage} error={masterError} />
                        </div>
                    )}
                    {activeTab === 'stock' && (
                        <div>
                            <p className="import-description">Update current stock levels. The system will use FIFO logic to reduce quantities based on the 'balance' column for each 'Itemcode'.</p>
                            <FileUploader onFileSelect={handleStockFile} id="modal-stock-upload" message={stockMessage} error={stockError} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportModal;