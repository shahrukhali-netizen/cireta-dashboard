import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CiretaDashboard from './CiretaDashboard';
import BlogCMSPage from './BlogCMSPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/blog-cms" element={<BlogCMSPage />} />
        <Route path="/*" element={<CiretaDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
