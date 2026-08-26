import { useEffect, useMemo, useState } from 'react';
import NavBar from '../components/NavBar';
import { useImageFolders } from '../hooks/useImageFolders';
import { useQuizEngine } from '../hooks/useQuizEngine';
import type { QuizMode } from '../hooks/useQuizEngine';
import SetupScreen from '../components/quiz/SetupScreen';
import QuizScreen from '../components/quiz/QuizScreen';
import ResultScreen from '../components/quiz/ResultScreen';

interface SavedSettings {
  mode?: QuizMode;
  time?: string;
  limit?: string;
}

function loadSettings(): SavedSettings {
  try {
    return JSON.parse(localStorage.getItem('ospe-settings') ?? '{}') as SavedSettings;
  } catch {
    return {};
  }
}

export default function QuizPage() {
  const { folders, addFolder, removeFolder, totalCount, allImages } = useImageFolders();
  const engine = useQuizEngine(allImages);

  const [saved] = useState(loadSettings);
  const [mode, setMode] = useState<QuizMode>(saved.mode ?? 'input');
  const [timeText, setTimeText] = useState(saved.time ?? '30');
  const [limitText, setLimitText] = useState(saved.limit ?? '');

  useEffect(() => {
    try {
      localStorage.setItem(
        'ospe-settings',
        JSON.stringify({ mode, time: timeText, limit: limitText }),
      );
    } catch {
      // localStorage unavailable (private mode etc.)
    }
  }, [mode, timeText, limitText]);

  const uniqueAnswers = useMemo(() => new Set(allImages.map((q) => q.answer)).size, [allImages]);

  const handleStart = () => {
    const timeLimit = Math.max(5, parseInt(timeText, 10) || 30);
    const parsedLimit = parseInt(limitText, 10);
    engine.start({
      mode,
      timeLimit,
      limit: Number.isNaN(parsedLimit) ? null : parsedLimit,
    });
  };

  return (
    <div className="min-h-screen bg-cream text-slate-900 font-sans flex flex-col">
      <NavBar />
      <main className="flex-1 flex items-start sm:items-center justify-center p-2 sm:p-4">
        <div className="bg-white border-[3px] border-black shadow-[8px_8px_0_#000] w-full max-w-5xl overflow-hidden min-h-[560px] sm:min-h-[700px] flex flex-col relative">
          <header className="bg-nb-yellow border-b-[3px] border-black px-4 py-2.5 flex justify-between items-center gap-3">
            <div className="w-20" />
            <h1 className="font-display text-lg sm:text-xl uppercase tracking-wide text-center">
              Hệ Thống Luyện Tập Chạy Trạm
            </h1>
            <button
              onClick={engine.reset}
              className="nb-btn px-3 py-1.5 text-xs uppercase tracking-wider"
              title="Reset toàn bộ"
            >
              Reset
            </button>
          </header>

          {engine.phase === 'idle' && (
            <SetupScreen
              folders={folders}
              onAddFolder={addFolder}
              onRemoveFolder={removeFolder}
              totalCount={totalCount}
              uniqueAnswers={uniqueAnswers}
              mode={mode}
              onModeChange={setMode}
              timeText={timeText}
              onTimeTextChange={setTimeText}
              limitText={limitText}
              onLimitTextChange={setLimitText}
              onStart={handleStart}
            />
          )}

          {engine.phase === 'running' && engine.questions[engine.index] && (
            <QuizScreen
              question={engine.questions[engine.index]}
              index={engine.index}
              total={engine.questions.length}
              pool={engine.questions}
              mode={engine.config.mode}
              timeLimit={engine.config.timeLimit}
              timeLeft={engine.timeLeft}
              feedback={engine.feedback}
              marks={engine.marks}
              onAnswer={engine.answer}
              onNext={engine.next}
            />
          )}

          {engine.phase === 'finished' && (
            <ResultScreen
              correct={engine.score}
              total={engine.questions.length}
              wrongAnswers={engine.wrongAnswers}
              onReset={engine.reset}
            />
          )}
        </div>
      </main>
    </div>
  );
}
