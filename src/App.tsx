import { Route, Routes } from 'react-router-dom';
import QuizPage from './pages/QuizPage';
import LamDePage from './pages/LamDePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<QuizPage />} />
      <Route path="/lamde" element={<LamDePage />} />
    </Routes>
  );
}
