import { useCallback, useEffect, useState } from 'react';

export type QuizMode = 'input' | 'mcq';

export interface QuestionImage {
  file: File;
  answer: string;
}

export interface QuizConfig {
  mode: QuizMode;
  timeLimit: number;
  limit: number | null;
}

export interface FeedbackInfo {
  correct: boolean;
  timeout: boolean;
}

export interface WrongAnswer {
  image: QuestionImage;
  given: string | null; // null = timed out without answering
}

type Phase = 'idle' | 'running' | 'finished';
export type ResultMark = 'correct' | 'wrong';

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildMcqOptions(pool: readonly QuestionImage[], correct: string): string[] {
  const uniqueAnswers = [...new Set(pool.map((q) => q.answer))];
  const wrongAnswers = shuffle(uniqueAnswers.filter((a) => a !== correct)).slice(0, 3);
  return shuffle([...wrongAnswers, correct]);
}

export function useQuizEngine(pool: QuestionImage[]) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [questions, setQuestions] = useState<QuestionImage[]>([]);
  const [config, setConfig] = useState<QuizConfig>({ mode: 'input', timeLimit: 30, limit: null });
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackInfo | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [marks, setMarks] = useState<ResultMark[]>([]);
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);

  const start = useCallback(
    (cfg: QuizConfig) => {
      const shuffled = shuffle(pool);
      const selected =
        cfg.limit && cfg.limit > 0 && cfg.limit <= shuffled.length
          ? shuffled.slice(0, cfg.limit)
          : shuffled;
      setConfig(cfg);
      setQuestions(selected);
      setIndex(0);
      setScore(0);
      setFeedback(null);
      setTimeLeft(cfg.timeLimit);
      setMarks([]);
      setWrongAnswers([]);
      setPhase('running');
    },
    [pool],
  );

  const answer = useCallback(
    (value: string) => {
      if (feedback || questions.length === 0) return;
      const q = questions[index];
      const given = value.trim();
      const isCorrect = given === q.answer;
      if (isCorrect) setScore((s) => s + 1);
      else {
        setWrongAnswers((w) => [...w, { image: q, given }]);
      }
      setMarks((m) => [...m, isCorrect ? 'correct' : 'wrong']);
      setFeedback({ correct: isCorrect, timeout: false });
    },
    [feedback, questions, index],
  );

  const next = useCallback(() => {
    if (index + 1 >= questions.length) {
      setPhase('finished');
      return;
    }
    setIndex((i) => i + 1);
    setFeedback(null);
    setTimeLeft(config.timeLimit);
  }, [index, questions.length, config.timeLimit]);

  const reset = useCallback(() => {
    setPhase('idle');
    setQuestions([]);
    setIndex(0);
    setScore(0);
    setFeedback(null);
    setTimeLeft(0);
    setMarks([]);
    setWrongAnswers([]);
  }, []);

  // Per-question countdown; stops while feedback is shown
  useEffect(() => {
    if (phase !== 'running' || feedback) return;
    const t = setInterval(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearInterval(t);
  }, [phase, feedback, index]);

  useEffect(() => {
    if (phase === 'running' && !feedback && timeLeft <= 0 && questions.length > 0) {
      setFeedback({ correct: false, timeout: true });
      setMarks((m) => [...m, 'wrong']);
      setWrongAnswers((w) => [...w, { image: questions[index], given: null }]);
    }
  }, [phase, feedback, timeLeft, questions, index]);

  return {
    phase,
    questions,
    config,
    index,
    score,
    feedback,
    timeLeft,
    marks,
    wrongAnswers,
    start,
    answer,
    next,
    reset,
  };
}
