import React, { useState, useEffect } from 'react';
import { useInventory } from '../hooks/useInventory.js';
import { Settings, CheckCircle, Mail, Trash2 } from 'lucide-react';

const SettingsPage = () => {
  const { settings, updateSettings } = useInventory();
  const [localDays, setLocalDays] = useState(30);
  const [emails, setEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (settings) {
      setLocalDays(settings.reminderDays || 30);
      setEmails(settings.recipientEmails || []);
    }
  }, [settings]);
  
  const handleSaveSettings = () => {
    const days = parseInt(localDays, 10);
    if (!isNaN(days) && days > 0) {
      updateSettings({ reminderDays: days, recipientEmails: emails });
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const addEmail = () => {
    if (newEmail && /\S+@\S+\.\S+/.test(newEmail) && !emails.includes(newEmail)) {
      setEmails([...emails, newEmail]);
      setNewEmail('');
    }
  };
  
  const removeEmail = (emailToRemove) => {
    setEmails(emails.filter(email => email !== emailToRemove));
  };
  
  return (
    <div className="page-container" style={{ maxWidth: '800px', margin: '2rem auto' }}>
      <div className="settings-header">
          <Settings size={28} />
          <h1 className="page-title">System Settings</h1>
      </div>
      
      <div className="settings-section">
        <h2 className="container-title">Email Reminders</h2>
        <div className="setting-item">
          <label htmlFor="reminderDays" className="setting-label">Expiry Reminder Threshold (Days)</label>
          <input id="reminderDays" type="number" className="setting-input" value={localDays} onChange={(e) => setLocalDays(e.target.value)} min="1"/>
        </div>
        <div className="setting-item">
            <label className="setting-label">Recipient Emails</label>
            <div className="email-list">
                {emails.map(email => (
                    <div key={email} className="email-tag">
                        <span>{email}</span>
                        <button onClick={() => removeEmail(email)} title={`Remove ${email}`}><Trash2 size={14} /></button>
                    </div>
                ))}
            </div>
        </div>
         <div className="setting-item">
            <label htmlFor="newEmail" className="setting-label">Add New Recipient</label>
            <div className="email-input-group">
                <Mail size={18} className="email-input-icon" />
                <input id="newEmail" type="email" className="setting-input" placeholder="name@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                <button className="button-primary" onClick={addEmail} style={{marginLeft: '0.5rem'}}>Add</button>
            </div>
        </div>
        <div className="setting-actions">
            <button className="button-primary" onClick={handleSaveSettings}>Save All Settings</button>
            {saveMessage && (
                <div className="save-confirmation">
                    <CheckCircle size={18} />
                    <span>{saveMessage}</span>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

