import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import DashboardPage from '@/pages/DashboardPage';
import UploadPage from '@/pages/UploadPage';
import BatchesPage from '@/pages/BatchesPage';
import InventoryPage from '@/pages/InventoryPage';
import ErrorsPage from '@/pages/ErrorsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="batches" element={<BatchesPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="errors" element={<ErrorsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
