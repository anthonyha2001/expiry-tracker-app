import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';

const API_BASE_URL = 'https://expiry-tracker-app.onrender.com/api';
export const InventoryContext = createContext();

export const InventoryProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState({ reminderDays: 30, recipientEmails: [] });
  const [notifications, setNotifications] = useState([]);
  const [pricingRules, setPricingRules] = useState([]); // New state for pricing rules
  const [loading, setLoading] = useState(true);

  // Fetches all data from the server on initial load
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/data`);
      const data = await response.json();
      setItems(data.items || []);
      setSettings(data.settings || { reminderDays: 30, recipientEmails: [] });
      setNotifications(data.notifications || []);
      setPricingRules(data.pricingRules || []); // Fetch pricing rules
    } catch (error) { 
      console.error("Failed to fetch data from server:", error);
    } finally { 
      setLoading(false); 
    }
  }, []);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  // Marks a notification as read
  const markNotificationAsRead = async (notificationId) => {
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
    // ... API call to update server
  };

  // Central function to save only the items array
  const saveItems = async (newItemsState) => {
    setItems(newItemsState);
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
  
  // New central function to save both items and pricing rules together
  const savePricingChanges = async (updatedItems, updatedRules) => {
    // Optimistic UI update
    setItems(updatedItems);
    setPricingRules(updatedRules);
    try {
        await fetch(`${API_BASE_URL}/pricing/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: updatedItems, pricingRules: updatedRules }),
        });
    } catch (error) {
        console.error("Failed to save pricing changes", error);
    }
  };

  // Handles uploading the master list file
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
  
  // Handles uploading the stock balance file
  const uploadStockBalanceFile = async (file) => {
    // ... logic remains the same
  };

  // Adds new expiry dates and clears the pending state for ONLY the saved items
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
  
  // Clears the pending flags for all items
  const clearPendingUpdates = () => {
    const clearedItems = items.map(item => ({ 
      ...item, 
      isUpdate: false, 
      pendingStockQty: 0 
    }));
    saveItems(clearedItems);
  };

  // Handles saving settings
  const updateSettings = async (newSettings) => {
    setSettings(newSettings);
    await fetch(`${API_BASE_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: newSettings }),
    });
  };
  
  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    items, 
    pendingItems: items.filter(item => item.isUpdate === true),
    groups: [...new Set(items.map(item => item.group).filter(Boolean))],
    loading, 
    settings,
    notifications,
    pricingRules,
    markNotificationAsRead,
    saveItems, 
    savePricingChanges,
    addMultipleExpiries, 
    clearPendingUpdates, 
    updateSettings, 
    uploadMasterFile, 
    uploadStockBalanceFile
  }), [items, loading, settings, notifications, pricingRules]);

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
};

