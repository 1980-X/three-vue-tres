import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { VenuePage } from './pages/VenuePage';

export function App() {
  return (
    <BrowserRouter basename="/v">
      <Routes>
        <Route path="/:publicId" element={<VenuePage />} />
      </Routes>
    </BrowserRouter>
  );
}
