import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';

import Dashboard from './components/Dashboard';
import StockStatus from './components/StockStatus';
import Sales from './components/Sales';
import Statistics from './components/Statistics';
import Reports from './components/Reports';
import Profile from './components/Profile';

import DailyCashTracking from './components/DailyCashTracking';
import FuelDeliveryTracking from './components/FuelDeliveryTracking';


import Planning from './components/Planning';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="daily-cash" element={<DailyCashTracking />} />
          <Route path="sales" element={<Sales />} />
          <Route path="deliveries" element={<FuelDeliveryTracking />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="stock" element={<StockStatus />} />
          <Route path="planning" element={<Planning />} />
          <Route path="reports" element={<Reports />} />

          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
