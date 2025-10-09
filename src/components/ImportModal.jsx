import React, { useState } from 'react';
import { useInventory } from '../hooks/useInventory.js';
import { X, UploadCloud, CheckCircle, AlertTriangle, Undo2 } from 'lucide-react';

const ImportModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('master');

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Data Imports</h2>
          <button className="modal-close-button" onClick={onClose}><X size={24} /></button>
        </div>
        <div className="modal-tabs">
          <button 
            className={`modal-tab ${activeTab === 'master' ? 'active' : ''}`} 
            onClick={() => setActiveTab('master')}
          >
            Master List / Add Stock
          </button>
          <button 
            className={`modal-tab ${activeTab === 'balance' ? 'active' : ''}`}
            onClick={() => setActiveTab('balance')}
          >
            Stock Balance Update
          </button>
        </div>
        <div className="modal-body">
          {activeTab === 'master' && <MasterListImporter />}
          {activeTab === 'balance' && <StockUpdateImporter />}
        </div>
      </div>
    </div>
  );
};

const MasterListImporter = () => {
    const { uploadMasterFile } = useInventory();
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleFileSelect = async (file) => {
        if (!file) return;
        setMessage('Processing...');
        setError('');
        try {
            const { newCount, updatedCount } = await uploadMasterFile(file);
            setMessage(`Success! Added: ${newCount}, Updated: ${updatedCount}.`);
        } catch (err) {
            setError(err.message);
            setMessage('');
        }
    };

    return (
        <div>
            <p className="import-description">
                Use this to add new items or update existing ones. The file must contain columns: `Itemcode`, `Description`, `Group Desc`, `Saleprice`, `Totqty`.
            </p>
            <FileUploader onFileSelect={handleFileSelect} id="modal-master-upload" />
            {message && <div className="status-message"><p>{message}</p></div>}
            {error && <div className="error-message"><AlertTriangle size={18} /><p>{error}</p></div>}
        </div>
    );
};

const StockUpdateImporter = () => {
    const { uploadStockBalanceFile, undoLastStockUpdate } = useInventory();
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [showUndo, setShowUndo] = useState(false);

    const handleFileSelect = async (file) => {
        if (!file) return;
        setMessage('Processing...');
        setError('');
        setShowUndo(false);
        try {
            const result = await uploadStockBalanceFile(file);
            setMessage(result.message);
            if (result.undo) {
                setShowUndo(true);
                setTimeout(() => setShowUndo(false), 15000); // Undo button disappears after 15 seconds
            }
        } catch (err) {
            setError(err.message);
            setMessage('');
        }
    };

    const handleUndo = async () => {
        try {
            const resultMessage = await undoLastStockUpdate();
            setMessage(resultMessage);
            setShowUndo(false);
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div>
            <p className="import-description">
                Update stock quantities using FIFO logic. The file must contain columns: `Itemcode`, `balance`.
            </p>
            <FileUploader onFileSelect={handleFileSelect} id="modal-balance-upload" />
            
            <div className="import-status-container">
                {message && <div className="status-message"><p>{message}</p></div>}
                {error && <div className="error-message"><AlertTriangle size={18} /><p>{error}</p></div>}
                {showUndo && (
                    <div className="undo-container">
                        <button className="button-secondary undo-button" onClick={handleUndo}>
                            <Undo2 size={16} /> Undo Last Update
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const FileUploader = ({ onFileSelect, id }) => {
    const [fileName, setFileName] = useState('');
    
    const handleOnChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFileName(file.name);
            onFileSelect(file);
        }
        e.target.value = null;
    };

    return (
        <div className="import-modal-uploader">
            <label htmlFor={id} className="button-primary"><UploadCloud size={16}/> Select File</label>
            <input id={id} type="file" className="file-input" accept=".csv, .xlsx" onChange={handleOnChange} />
            {fileName && <p style={{marginTop: '0.5rem', fontSize: '0.875rem'}}>{fileName}</p>}
        </div>
    );
};

export default ImportModal;

