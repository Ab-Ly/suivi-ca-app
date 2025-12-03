import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

import Dashboard from './components/Dashboard';

import StockStatus from './components/StockStatus';

import Reports from './components/Reports';

import Sales from './components/Sales';

// Placeholder components
// const Sales = () => <div><h2 className="text-2xl font-bold mb-4">Ventes</h2><p>Sales entry and history.</p></div>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="sales" element={<Sales />} />
          <Route path="stock" element={<StockStatus />} />
          <Route path="reports" element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
