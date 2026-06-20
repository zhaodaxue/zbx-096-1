import React from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import FamilyPage from './pages/FamilyPage.jsx';
import NursePage from './pages/NursePage.jsx';
import ResidentList from './pages/ResidentList.jsx';
import ResidentForm from './pages/ResidentForm.jsx';

function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>乡镇临终关怀站 - 疼痛日记系统</h1>
        <nav className="nav">
          <Link to="/family" className="nav-link">家属端</Link>
          <Link to="/nurse" className="nav-link">护士端</Link>
          <Link to="/residents" className="nav-link">住民管理</Link>
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<ResidentList />} />
          <Route path="/family" element={<FamilyPage />} />
          <Route path="/nurse" element={<NursePage />} />
          <Route path="/residents" element={<ResidentList />} />
          <Route path="/residents/new" element={<ResidentForm />} />
          <Route path="/residents/:id/edit" element={<ResidentForm />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
