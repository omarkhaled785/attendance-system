import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Workers from './pages/Workers';
import Dashboard from './pages/Dashboard';
import WorkerDetails from './pages/WorkerDetails';
import Drivers from './pages/Drivers'; // Add this import

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Workers />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/worker/:id" element={<WorkerDetails />} />
        <Route path="/drivers" element={<Drivers />} /> {/* Add this route */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
}

export default App;