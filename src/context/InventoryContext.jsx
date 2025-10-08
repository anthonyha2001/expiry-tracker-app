import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';

const API_BASE_URL = 'https://expiry-tracker-app.onrender.com/api';
export const InventoryContext = createContext();

export const InventoryProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState({ reminderDays: 30, recipientEmails: [] });
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/data`);
      const data = await response.json();
      setItems(data.items || []);
      setSettings(data.settings || { reminderDays: 30, recipientEmails: [] });
      setNotifications(data.notifications || []);
    } catch (error) { 
      console.error("Failed to fetch data from server:", error);
    } finally { 
      setLoading(false); 
    }
  }, []);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  const markNotificationAsRead = async (notificationId) => {
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
    try {
        await fetch(`${API_BASE_URL}/notifications/mark-read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: notificationId }),
        });
    } catch (error) {
        console.error("Failed to mark notification as read on server", error);
    }
  };

  const saveItems = async (newItemsState) => {
    setItems(newItemsState); // Optimistic UI update for immediate feedback
    try {
      await fetch(`${API_BASE_URL}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: newItemsState }),
      });
    } catch (error) {
      console.error("Failed to save items to server:", error);
    }
  };

  const uploadMasterFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/import/master-list`, { method: 'POST', body: formData });
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.message || 'Failed to upload master file.');
    }
    setItems(result.updatedItems);
    return { newCount: result.newCount, updatedCount: result.updatedCount };
  };
  
  const uploadStockBalanceFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/stock-update`, { method: 'POST', body: formData });
    const result = await response.json();
     if (!response.ok) {
        throw new Error(result.message || 'Failed to upload stock balance file.');
    }
    setItems(result.updatedItems);
    return { message: result.message };
  };

  const addMultipleExpiries = (newEntries) => {
    const entriesMap = new Map();
    newEntries.forEach(entry => {
      if (!entriesMap.has(entry.itemId)) entriesMap.set(entry.itemId, []);
      entriesMap.get(entry.itemId).push({ 
        date: entry.date, 
        quantity: parseInt(entry.quantity, 10), 
        addedAt: new Date().toISOString() 
      });
    });
    const newItemsState = items.map(item => {
      if (entriesMap.has(item.id)) {
        return { 
          ...item, 
          expiryEntries: [...item.expiryEntries, ...entriesMap.get(item.id)], 
          pendingStockQty: 0, 
          isUpdate: false 
        };
      }
      return item;
    });
    saveItems(newItemsState);
  };
  
  const clearPendingUpdates = () => {
    const clearedItems = items.map(item => ({ 
      ...item, 
      isUpdate: false, 
      pendingStockQty: 0 
    }));
    saveItems(clearedItems);
  };

  const updateSettings = async (newSettings) => {
    setSettings(newSettings);
    await fetch(`${API_BASE_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: newSettings }),
    });
  };
  
  const value = useMemo(() => ({
    items, 
    pendingItems: items.filter(item => item.isUpdate === true),
    groups: [...new Set(items.map(item => item.group).filter(Boolean))],
    loading, 
    settings,
    notifications,
    markNotificationAsRead,
    saveItems, 
    addMultipleExpiries, 
    clearPendingUpdates, 
    updateSettings, 
    uploadMasterFile, 
    uploadStockBalanceFile
  }), [items, loading, settings, notifications]);

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
};