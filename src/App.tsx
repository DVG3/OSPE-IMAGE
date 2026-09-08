import { Route, Routes } from 'react-router-dom';
import QuizPage from './pages/QuizPage';
import LamDePage from './pages/LamDePage';
import WorkspacePage from './pages/WorkspacePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<QuizPage />} />
      <Route path="/lamde" element={<LamDePage />} />
      <Route path="/workspace" element={<WorkspacePage />} />
    </Routes>
  );
}
