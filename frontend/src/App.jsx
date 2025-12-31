import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Workers from './pages/Workers';
import Dashboard from './pages/Dashboard';
import WorkerDetails from './pages/WorkerDetails';
import Drivers from './pages/Drivers';
import FocusFix from './utils/FocusFix';

function App() {
  return (
    <FocusFix> {}
      <HashRouter>
        <Routes>
          <Route path="/" element={<Workers />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/worker/:id" element={<WorkerDetails />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </HashRouter>
    </FocusFix>
  );
}

export default App;