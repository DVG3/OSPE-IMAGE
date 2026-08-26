import { useEffect, useMemo, useRef, useState } from 'react';
import { buildMcqOptions } from '../../hooks/useQuizEngine';
import type { FeedbackInfo, QuestionImage, QuizMode, ResultMark } from '../../hooks/useQuizEngine';
import ZoomableImage from './ZoomableImage';

interface Props {
  question: QuestionImage;
  index: number;
  total: number;
  pool: QuestionImage[];
  mode: QuizMode;
  timeLimit: number;
  timeLeft: number;
  feedback: FeedbackInfo | null;
  marks: ResultMark[];
  onAnswer: (value: string) => void;
  onNext: () => void;
}

const MCQ_KEYS = ['1', '2', '3', '4'];

export default function QuizScreen({
  question,
  index,
  total,
  pool,
  mode,
  timeLimit,
  timeLeft,
  feedback,
  marks,
  onAnswer,
  onNext,
}: Props) {
  const [inputValue, setInputValue] = useState('');
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');

  const mcqOptions = useMemo(
    () => buildMcqOptions(pool, question.answer),
    [pool, question],
  );

  useEffect(() => {
    setInputValue('');
    setSelectedOpt(null);
  }, [question]);

  useEffect(() => {
    const url = URL.createObjectURL(question.file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [question]);

  const answeredAtRef = useRef(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (feedback) {
        if (e.key !== 'Enter') return;
        // Ignore Enter arriving right after answering (fast double-tap / same physical press)
        if (Date.now() - answeredAtRef.current < 350) return;
        onNext();
        return;
      }
      if (mode === 'input' && e.key === 'Enter') {
        answeredAtRef.current = Date.now();
        onAnswer(inputValue);
      } else if (mode === 'mcq' && MCQ_KEYS.includes(e.key)) {
        const opt = mcqOptions[parseInt(e.key, 10) - 1];
        if (opt !== undefined) {
          answeredAtRef.current = Date.now();
          setSelectedOpt(opt);
          onAnswer(opt);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const answerMcq = (opt: string) => {
    if (feedback) return;
    answeredAtRef.current = Date.now();
    setSelectedOpt(opt);
    onAnswer(opt);
  };

  const pct = Math.max(0, (timeLeft / timeLimit) * 100);
  const showShake = feedback !== null && !feedback.correct;

  const mcqClass = (opt: string) => {
    if (feedback !== null && selectedOpt === opt) {
      return feedback.correct
        ? 'bg-nb-lime shadow-[inset_3px_3px_0_rgba(0,0,0,0.25)]'
        : 'bg-nb-red text-white shadow-[inset_3px_3px_0_rgba(0,0,0,0.25)]';
    }
    return 'bg-white shadow-[3px_3px_0_#000] hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#000]';
  };

  return (
    <div className={`flex-1 flex flex-col bg-cream h-full ${showShake ? 'animate-shake' : ''}`}>
      <div className="w-full bg-white border-b-2 border-black h-4 flex-shrink-0">
        <div
          className={`h-full ${timeLeft < 3 ? 'bg-nb-red' : 'bg-nb-lime'}`}
          style={{ width: `${pct}%`, transition: 'width 1s linear' }}
        />
      </div>

      {/* Station progress */}
      <div className="bg-white border-b-2 border-black px-2 py-1.5 flex justify-center overflow-x-auto flex-shrink-0">
        <div className="flex gap-1">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              title={`Câu ${i + 1}`}
              className={`w-2.5 h-2.5 sm:w-3 sm:h-3 border border-black flex-shrink-0 ${
                i < marks.length
                  ? marks[i] === 'correct'
                    ? 'bg-nb-lime'
                    : 'bg-nb-red'
                  : i === marks.length
                    ? 'bg-nb-yellow'
                    : 'bg-white'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 bg-[#171717] relative overflow-hidden min-h-[220px] sm:min-h-[300px] p-4">
        {imageUrl && <ZoomableImage src={imageUrl} />}
        <div className="absolute top-3 right-3 bg-nb-yellow border-2 border-black px-3 py-1 font-bold text-sm shadow-[3px_3px_0_#000] z-10">
          Câu: <span>{index + 1}</span>/<span>{total}</span>
        </div>
      </div>

      <div className="p-4 sm:p-6 bg-white border-t-[3px] border-black z-20 flex-shrink-0 min-h-[160px] sm:min-h-[200px] flex flex-col justify-center">
        {!feedback && mode === 'input' && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              Nhập đáp án (Chính xác từng chữ):
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={inputValue}
                autoFocus
                autoComplete="off"
                placeholder="Gõ tên..."
                onChange={(e) => setInputValue(e.target.value)}
                className="nb-input flex-1 font-mono py-3 text-lg"
              />
              <button onClick={() => onAnswer(inputValue)} className="nb-btn bg-nb-blue text-white py-3 px-8 rounded-lg uppercase tracking-wider">
                Trả lời
              </button>
            </div>
          </div>
        )}

        {!feedback && mode === 'mcq' && (
          <>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              Chọn đáp án (phím 1–{Math.min(mcqOptions.length, 4)}):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              {mcqOptions.map((opt, i) => (
                <button
                  key={opt}
                  onClick={() => answerMcq(opt)}
                  disabled={!!feedback}
                  className={`border-2 border-black rounded-lg font-bold py-3 px-4 text-left truncate transition-all duration-100 ${mcqClass(opt)}`}
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 mr-2 text-xs bg-nb-yellow border-2 border-black align-middle">
                    {i + 1}
                  </span>
                  {opt}
                </button>
              ))}
            </div>
          </>
        )}

        {feedback && (
          <div className="flex flex-col items-center gap-4 py-1">
            <div
              className={`w-full sm:w-auto border-[3px] border-black px-6 py-3 shadow-[4px_4px_0_#000] ${
                feedback.correct ? 'bg-nb-lime' : 'bg-nb-red text-white'
              }`}
            >
              <div className="font-display text-xl sm:text-2xl tracking-tight text-center uppercase">
                {feedback.correct ? 'Chính xác!' : feedback.timeout ? 'Hết giờ!' : 'Sai rồi!'}
              </div>
              <div className={`text-sm font-bold mt-1 ${feedback.correct ? 'text-gray-800' : 'text-white/90'}`}>
                Đáp án đúng:{' '}
                <span className="underline decoration-2 underline-offset-2 select-all">{question.answer}</span>
              </div>
            </div>
            <button
              onClick={onNext}
              className="nb-btn bg-nb-yellow rounded-full py-3 px-12 uppercase tracking-wider"
            >
              <span>Câu tiếp theo</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
