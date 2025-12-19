import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Workers from './pages/Workers';
import Dashboard from './pages/Dashboard';
import WorkerDetails from './pages/WorkerDetails';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Workers />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/worker/:id" element={<WorkerDetails />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;