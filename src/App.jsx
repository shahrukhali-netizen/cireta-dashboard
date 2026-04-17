import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CiretaDashboard from './CiretaDashboard';
import BlogCMS from './BlogCMS';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/blog-cms" element={<BlogCMS />} />
        <Route path="/*" element={<CiretaDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
