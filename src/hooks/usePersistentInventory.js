import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'http://localhost:3001/api';

export const usePersistentInventory = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Function to fetch initial data from the server
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/items`);
      if (!response.ok) {
        throw new Error('Failed to fetch data from the server.');
      }
      const data = await response.json();
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Function to save the entire inventory state to the server
  const saveItems = useCallback(async (currentItems) => {
    try {
      // Optimistic update: update the local state immediately for a responsive UI
      setItems(currentItems); 
      const response = await fetch(`${API_BASE_URL}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: currentItems }),
      });
      if (!response.ok) {
        throw new Error('Failed to save data to the server.');
      }
      // If save is successful, we don't need to do anything,
      // as the state is already updated.
    } catch (err) {
      setError(err.message);
      console.error(err);
      // Optional: Here you could implement logic to revert the optimistic update on failure.
    }
  }, []);

  // Fetch data when the hook is first used
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return { items, setItems: saveItems, loading, error };
};