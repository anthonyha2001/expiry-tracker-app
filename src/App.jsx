import React from 'react';
// 1. Import HashRouter instead of BrowserRouter
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { InventoryProvider } from './context/InventoryContext.jsx';

import Layout from './components/Layout.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import RecordsPage from './pages/RecordsPage.jsx';
import OperationsPage from './pages/OperationsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

function App() {
  return (
    <InventoryProvider>
      {/* 2. Use the HashRouter component here */}
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="records" element={<RecordsPage />} />
            <Route path="operations" element={<OperationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Router>
    </InventoryProvider>
  );
}

export default App;