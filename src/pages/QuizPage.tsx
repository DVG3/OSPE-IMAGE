import { useEffect, useMemo, useState } from 'react';
import NavBar from '../components/NavBar';
import { useImageFolders } from '../hooks/useImageFolders';
import { useQuizEngine } from '../hooks/useQuizEngine';
import type { QuizMode } from '../hooks/useQuizEngine';
import { useWorkspaceLoader } from '../hooks/useWorkspaceLoader';
import { useWorkspaceQuizEngine } from '../hooks/useWorkspaceQuizEngine';
import type { WorkspaceAnswerType } from '../hooks/useWorkspaceQuizEngine';
import SetupScreen from '../components/quiz/SetupScreen';
import type { QuizSourceType } from '../components/quiz/SetupScreen';
import QuizScreen from '../components/quiz/QuizScreen';
import WorkspaceQuizScreen from '../components/quiz/WorkspaceQuizScreen';
import ResultScreen from '../components/quiz/ResultScreen';

interface SavedSettings {
  sourceType?: QuizSourceType;
  mode?: QuizMode;
  workspaceAnswerType?: WorkspaceAnswerType;
  classifyMode?: boolean;
  identifyMode?: boolean;
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
  // Flash card state & engine
  const { folders, addFolder, removeFolder, totalCount, allImages } = useImageFolders();
  const fcEngine = useQuizEngine(allImages);

  // Workspace state & engine
  const wsLoader = useWorkspaceLoader();
  const wsEngine = useWorkspaceQuizEngine(wsLoader.workspaces);

  const [saved] = useState(loadSettings);

  // Settings
  const [sourceType, setSourceType] = useState<QuizSourceType>(saved.sourceType ?? 'flashcard');
  const [mode, setMode] = useState<QuizMode>(saved.mode ?? 'input');
  const [classifyMode, setClassifyMode] = useState(saved.classifyMode ?? true);
  const [identifyMode, setIdentifyMode] = useState(saved.identifyMode ?? true);
  const [workspaceAnswerType, setWorkspaceAnswerType] = useState<WorkspaceAnswerType>(
    saved.workspaceAnswerType ?? 'input'
  );
  const [timeText, setTimeText] = useState(saved.time ?? '30');
  const [limitText, setLimitText] = useState(saved.limit ?? '');

  // Persist settings
  useEffect(() => {
    try {
      localStorage.setItem(
        'ospe-settings',
        JSON.stringify({
          sourceType,
          mode,
          classifyMode,
          identifyMode,
          workspaceAnswerType,
          time: timeText,
          limit: limitText,
        })
      );
    } catch {
      // LocalStorage unavailable
    }
  }, [sourceType, mode, classifyMode, identifyMode, workspaceAnswerType, timeText, limitText]);

  // Flash card stats
  const uniqueAnswers = useMemo(() => new Set(allImages.map((q) => q.answer)).size, [allImages]);

  // Workspace questions available
  const workspaceQuestionCount = useMemo(() => {
    return wsEngine.countAvailable({
      classifyMode,
      identifyMode,
      answerType: workspaceAnswerType,
      timeLimit: 30,
      limit: null,
    });
  }, [wsEngine, classifyMode, identifyMode, workspaceAnswerType]);

  const handleStart = () => {
    const timeLimit = Math.max(5, parseInt(timeText, 10) || 30);
    const parsedLimit = parseInt(limitText, 10);
    const limit = Number.isNaN(parsedLimit) ? null : parsedLimit;

    if (sourceType === 'flashcard') {
      fcEngine.start({
        mode,
        timeLimit,
        limit,
      });
    } else {
      wsEngine.start({
        classifyMode,
        identifyMode,
        answerType: workspaceAnswerType,
        timeLimit,
        limit,
      });
    }
  };

  const handleReset = () => {
    fcEngine.reset();
    wsEngine.reset();
  };

  // Determine active phase based on current source
  const currentPhase = sourceType === 'flashcard' ? fcEngine.phase : wsEngine.phase;

  return (
    <div className="min-h-screen bg-cream text-slate-900 font-sans flex flex-col">
      <NavBar />
      <main className="flex-1 flex items-start sm:items-center justify-center p-2 sm:p-4">
        <div className="bg-white border-[3px] border-black shadow-[8px_8px_0_#000] w-full max-w-5xl overflow-hidden min-h-[560px] sm:min-h-[700px] flex flex-col relative">
          {/* Header */}
          <header className="bg-nb-yellow border-b-[3px] border-black px-4 py-2.5 flex justify-between items-center gap-3">
            <div className="w-20" />
            <h1 className="font-display text-lg sm:text-xl uppercase tracking-wide text-center">
              Hệ Thống Luyện Tập Chạy Trạm
            </h1>
            <button
              onClick={handleReset}
              className="nb-btn px-3 py-1.5 text-xs uppercase tracking-wider"
              title="Reset toàn bộ"
            >
              Reset
            </button>
          </header>

          {/* SETUP SCREEN */}
          {currentPhase === 'idle' && (
            <SetupScreen
              sourceType={sourceType}
              onSourceTypeChange={setSourceType}
              folders={folders}
              onAddFolder={addFolder}
              onRemoveFolder={removeFolder}
              totalCount={totalCount}
              uniqueAnswers={uniqueAnswers}
              mode={mode}
              onModeChange={setMode}
              workspaces={wsLoader.workspaces}
              onAddWorkspace={wsLoader.addWorkspace}
              onAddWorkspaceFallback={wsLoader.addWorkspaceFallback}
              onRemoveWorkspace={wsLoader.removeWorkspace}
              workspaceQuestionCount={workspaceQuestionCount}
              classifyMode={classifyMode}
              onClassifyModeChange={setClassifyMode}
              identifyMode={identifyMode}
              onIdentifyModeChange={setIdentifyMode}
              workspaceAnswerType={workspaceAnswerType}
              onWorkspaceAnswerTypeChange={setWorkspaceAnswerType}
              timeText={timeText}
              onTimeTextChange={setTimeText}
              limitText={limitText}
              onLimitTextChange={setLimitText}
              onStart={handleStart}
            />
          )}

          {/* FLASH CARD RUNNING SCREEN */}
          {sourceType === 'flashcard' && currentPhase === 'running' && fcEngine.questions[fcEngine.index] && (
            <QuizScreen
              question={fcEngine.questions[fcEngine.index]}
              index={fcEngine.index}
              total={fcEngine.questions.length}
              pool={fcEngine.questions}
              mode={fcEngine.config.mode}
              timeLimit={fcEngine.config.timeLimit}
              timeLeft={fcEngine.timeLeft}
              feedback={fcEngine.feedback}
              marks={fcEngine.marks}
              onAnswer={fcEngine.answer}
              onNext={fcEngine.next}
            />
          )}

          {/* WORKSPACE RUNNING SCREEN */}
          {sourceType === 'workspace' && currentPhase === 'running' && wsEngine.questions[wsEngine.index] && (
            <WorkspaceQuizScreen
              question={wsEngine.questions[wsEngine.index]}
              index={wsEngine.index}
              total={wsEngine.questions.length}
              answerType={wsEngine.config.answerType}
              timeLimit={wsEngine.config.timeLimit}
              timeLeft={wsEngine.timeLeft}
              feedback={wsEngine.feedback}
              marks={wsEngine.marks}
              onAnswerClassify={wsEngine.answerClassify}
              onClickIdentify={wsEngine.clickIdentify}
              onNext={wsEngine.next}
            />
          )}

          {/* RESULT SCREEN */}
          {sourceType === 'flashcard' && currentPhase === 'finished' && (
            <ResultScreen
              correct={fcEngine.score}
              total={fcEngine.questions.length}
              wrongAnswers={fcEngine.wrongAnswers}
              onReset={fcEngine.reset}
            />
          )}

          {sourceType === 'workspace' && currentPhase === 'finished' && (
            <ResultScreen
              correct={wsEngine.score}
              total={wsEngine.questions.length}
              workspaceWrongAnswers={wsEngine.wrongAnswers}
              onReset={wsEngine.reset}
            />
          )}
        </div>
      </main>
    </div>
  );
}
