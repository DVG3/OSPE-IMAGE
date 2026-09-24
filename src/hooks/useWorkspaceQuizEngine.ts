import { useState, useEffect, useCallback } from 'react';
import type { CanvasObjectItem, LayerCaption, LoadedWorkspace, Point2D } from '../types/workspace';
import { distance, getObjectCenter } from '../utils/geometry';

export type WorkspaceQuestionKind = 'classify' | 'identify';
export type WorkspaceAnswerType = 'mcq' | 'input';

export interface WorkspaceQuestion {
  id: string;
  kind: WorkspaceQuestionKind;
  imageFile: File;
  imageRelPath: string;
  workspaceName: string;

  // Target caption info
  targetCaptionId: string;
  targetCaptionName: string;

  // All annotations on this image
  allObjects: CanvasObjectItem[];
  allCaptions: LayerCaption[];

  // For 'classify':
  targetObject?: CanvasObjectItem;
  arrowAngleRad?: number;
  arrowTip?: Point2D;
  arrowStart?: Point2D;
  arrowColor?: string;
  arrowBorderColor?: string;
  mcqOptions?: string[]; // 4 choices for MCQ
}

export interface WorkspaceQuizConfig {
  classifyMode: boolean;
  identifyMode: boolean;
  answerType: WorkspaceAnswerType;
  timeLimit: number;
  limit: number | null;
}

export interface WorkspaceWrongAnswer {
  question: WorkspaceQuestion;
  given: string | null; // null = timeout
}

export interface WorkspaceFeedbackInfo {
  correct: boolean;
  timeout: boolean;
  message?: string;
}

type QuizPhase = 'idle' | 'running' | 'finished';
export type StationMark = 'correct' | 'wrong';



function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Builds questions from loaded workspaces based on enabled modes.
 */
export function buildWorkspaceQuestions(
  workspaces: LoadedWorkspace[],
  config: WorkspaceQuizConfig
): WorkspaceQuestion[] {
  const pool: WorkspaceQuestion[] = [];
  const allKnownCaptions = new Set<string>();

  // First pass: collect all caption names across all workspaces for MCQ distractors
  workspaces.forEach((ws) => {
    Object.values(ws.data.images).forEach((imgData) => {
      imgData.captions?.forEach((c) => {
        if (c.name.trim()) allKnownCaptions.add(c.name.trim());
      });
    });
  });
  const allCaptionsList = Array.from(allKnownCaptions);

  // Second pass: generate candidate questions
  workspaces.forEach((ws) => {
    ws.imageFiles.forEach((file, relPath) => {
      const imgData = ws.data.images[relPath];
      if (!imgData || !imgData.objects || imgData.objects.length === 0) return;

      const captionMap = new Map<string, LayerCaption>();
      imgData.captions?.forEach((c) => captionMap.set(c.id, c));

      // Filter objects that have valid, named captions
      const validObjects = imgData.objects.filter((obj) => {
        const cap = captionMap.get(obj.captionId);
        return cap && cap.name.trim().length > 0;
      });

      if (validObjects.length === 0) return;

      // Group valid objects by captionId
      const captionToObjects = new Map<string, CanvasObjectItem[]>();
      validObjects.forEach((obj) => {
        const list = captionToObjects.get(obj.captionId) || [];
        list.push(obj);
        captionToObjects.set(obj.captionId, list);
      });

      // 1. Generate 'classify' question if enabled
      if (config.classifyMode) {
        validObjects.forEach((obj) => {
          const cap = captionMap.get(obj.captionId)!;
          const targetName = cap.name.trim();

          // Calculate center and arrow tip & start
          const center = getObjectCenter(obj);
          const baseRadius = obj.type === 'dot' ? (obj.radius ?? 25) : ((obj.strokeWidth ?? 20) / 2 + 10);

          // Random angle
          const angle = Math.random() * Math.PI * 2;
          // Arrow tip stops at 25% from outer radius edge (i.e. distance = baseRadius * 0.75 from center)
          const tipDistance = baseRadius * 0.75;
          const tipX = center.x + Math.cos(angle) * tipDistance;
          const tipY = center.y + Math.sin(angle) * tipDistance;

          // Arrow shaft length ~85px (longer and clearer)
          const shaftLen = 85;
          const startX = tipX + Math.cos(angle) * shaftLen;
          const startY = tipY + Math.sin(angle) * shaftLen;

          // Default brightest red with high-contrast black border
          const arrowColor = '#ff0033';
          const arrowBorderColor = '#000000';

          // Distractor options for MCQ
          const wrongAnswers = shuffle(allCaptionsList.filter((a) => a.toLowerCase() !== targetName.toLowerCase())).slice(0, 3);
          const mcqOptions = shuffle([...wrongAnswers, targetName]);

          pool.push({
            id: `classify_${ws.workspaceId}_${relPath}_${obj.id}_${Math.random().toString(36).substring(2, 6)}`,
            kind: 'classify',
            imageFile: file,
            imageRelPath: relPath,
            workspaceName: ws.name,
            targetCaptionId: obj.captionId,
            targetCaptionName: targetName,
            allObjects: imgData.objects,
            allCaptions: imgData.captions || [],
            targetObject: obj,
            arrowAngleRad: angle,
            arrowTip: { x: tipX, y: tipY },
            arrowStart: { x: startX, y: startY },
            arrowColor,
            arrowBorderColor,
            mcqOptions,
          });
        });
      }

      // 2. Generate 'identify' question if enabled
      if (config.identifyMode) {
        captionToObjects.forEach((_objs, capId) => {
          const cap = captionMap.get(capId)!;
          const targetName = cap.name.trim();

          pool.push({
            id: `identify_${ws.workspaceId}_${relPath}_${capId}_${Math.random().toString(36).substring(2, 6)}`,
            kind: 'identify',
            imageFile: file,
            imageRelPath: relPath,
            workspaceName: ws.name,
            targetCaptionId: capId,
            targetCaptionName: targetName,
            allObjects: imgData.objects,
            allCaptions: imgData.captions || [],
          });
        });
      }
    });
  });

  return shuffle(pool);
}

export function useWorkspaceQuizEngine(workspaces: LoadedWorkspace[]) {
  const [phase, setPhase] = useState<QuizPhase>('idle');
  const [questions, setQuestions] = useState<WorkspaceQuestion[]>([]);
  const [config, setConfig] = useState<WorkspaceQuizConfig>({
    classifyMode: true,
    identifyMode: true,
    answerType: 'input',
    timeLimit: 30,
    limit: null,
  });
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<WorkspaceFeedbackInfo | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [marks, setMarks] = useState<StationMark[]>([]);
  const [wrongAnswers, setWrongAnswers] = useState<WorkspaceWrongAnswer[]>([]);

  // Count available questions based on config
  const countAvailable = useCallback(
    (cfg: WorkspaceQuizConfig): number => {
      return buildWorkspaceQuestions(workspaces, cfg).length;
    },
    [workspaces]
  );

  const start = useCallback(
    (cfg: WorkspaceQuizConfig) => {
      const generated = buildWorkspaceQuestions(workspaces, cfg);
      const selected =
        cfg.limit && cfg.limit > 0 && cfg.limit <= generated.length
          ? generated.slice(0, cfg.limit)
          : generated;

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
    [workspaces]
  );

  // Answer for 'classify' (text input or MCQ)
  const answerClassify = useCallback(
    (textValue: string) => {
      if (feedback || questions.length === 0) return;
      const q = questions[index];
      if (!q || q.kind !== 'classify') return;

      const given = textValue.trim();
      const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
      const isCorrect = normalize(given) === normalize(q.targetCaptionName);

      if (isCorrect) {
        setScore((s) => s + 1);
        setFeedback({ correct: true, timeout: false, message: 'Chính xác!' });
      } else {
        setWrongAnswers((w) => [...w, { question: q, given: given || 'Không trả lời' }]);
        setFeedback({
          correct: false,
          timeout: false,
          message: `Sai rồi! Đáp án đúng là: ${q.targetCaptionName}`,
        });
      }
      setMarks((m) => [...m, isCorrect ? 'correct' : 'wrong']);
    },
    [feedback, questions, index]
  );

  // Click handler for 'identify' mode
  const clickIdentify = useCallback(
    (coords: Point2D, imgWidth: number, imgHeight: number): { hit: boolean } => {
      if (feedback || questions.length === 0) return { hit: false };
      const q = questions[index];
      if (!q || q.kind !== 'identify') return { hit: false };

      // Calculate extra detection radius bonus: 5% of max image dimension
      const maxDim = Math.max(imgWidth, imgHeight);
      const bonusRadius = 0.05 * maxDim;

      interface HitCandidate {
        object: CanvasObjectItem;
        dist: number;
      }
      const candidates: HitCandidate[] = [];

      q.allObjects.forEach((obj) => {
        if (!obj.visible) return;
        if (obj.type === 'dot') {
          const d = distance(coords, { x: obj.x ?? 0, y: obj.y ?? 0 });
          // Base dot radius ~10px + bonusRadius
          if (d <= 12 + bonusRadius) {
            candidates.push({ object: obj, dist: d });
          }
        } else if (obj.type === 'highlight' && obj.paths) {
          let minDist = Infinity;
          obj.paths.forEach((p) => {
            p.forEach((pt) => {
              const d = distance(coords, pt);
              if (d < minDist) minDist = d;
            });
          });
          const threshold = (obj.strokeWidth ?? 20) / 2 + bonusRadius;
          if (minDist <= threshold) {
            candidates.push({ object: obj, dist: minDist });
          }
        }
      });

      // If user clicked in empty space outside all objects, do nothing (allow re-clicking)
      if (candidates.length === 0) {
        return { hit: false };
      }

      // Pick nearest candidate
      candidates.sort((a, b) => a.dist - b.dist);
      const nearest = candidates[0].object;

      const isCorrect = nearest.captionId === q.targetCaptionId;
      if (isCorrect) {
        setScore((s) => s + 1);
        setFeedback({ correct: true, timeout: false, message: 'Chính xác!' });
      } else {
        const wrongCap = q.allCaptions.find((c) => c.id === nearest.captionId);
        const wrongName = wrongCap?.name.trim() || 'Cấu trúc khác';
        setWrongAnswers((w) => [...w, { question: q, given: wrongName }]);
        setFeedback({
          correct: false,
          timeout: false,
          message: `Sai rồi! Bạn đã chọn nhầm vào: ${wrongName}`,
        });
      }

      setMarks((m) => [...m, isCorrect ? 'correct' : 'wrong']);
      return { hit: true };
    },
    [feedback, questions, index]
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

  // Timeout handler
  useEffect(() => {
    if (phase === 'running' && !feedback && timeLeft <= 0 && questions.length > 0) {
      const q = questions[index];
      setFeedback({
        correct: false,
        timeout: true,
        message: `Hết giờ! Đáp án là: ${q.targetCaptionName}`,
      });
      setMarks((m) => [...m, 'wrong']);
      setWrongAnswers((w) => [...w, { question: q, given: null }]);
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
    countAvailable,
    start,
    answerClassify,
    clickIdentify,
    next,
    reset,
  };
}
