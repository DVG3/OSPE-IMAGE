import { useEffect, useState } from 'react';
import type { WrongAnswer } from '../../hooks/useQuizEngine';

interface Props {
  correct: number;
  total: number;
  wrongAnswers: WrongAnswer[];
  onReset: () => void;
}

function ReviewThumb({ file }: { file: File }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      className="w-14 h-14 object-contain border-2 border-black bg-white flex-shrink-0"
    />
  );
}

export default function ResultScreen({ correct, total, wrongAnswers, onReset }: Props) {
  const wrong = total - correct;
  const finalScore = total > 0 ? ((correct / total) * 10).toFixed(1) : '0';

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 gap-6 overflow-y-auto">
      <h2 className="font-display text-2xl sm:text-3xl uppercase tracking-wide">Kết quả bài thi</h2>
      <div className="grid grid-cols-2 gap-4 sm:gap-6 w-full max-w-md">
        <div className="bg-nb-lime border-[3px] border-black rounded-lg p-4 sm:p-6 text-center shadow-[6px_6px_0_#000]">
          <p className="font-display text-4xl sm:text-5xl">{correct}</p>
          <p className="text-xs font-bold uppercase tracking-widest mt-2">Đúng</p>
        </div>
        <div className="bg-nb-pink border-[3px] border-black rounded-lg p-4 sm:p-6 text-center shadow-[6px_6px_0_#000]">
          <p className="font-display text-4xl sm:text-5xl">{wrong}</p>
          <p className="text-xs font-bold uppercase tracking-widest mt-2">Sai</p>
        </div>
      </div>
      <div className="bg-nb-yellow border-[3px] border-black rounded-lg px-8 py-3 shadow-[5px_5px_0_#000] font-bold text-xl flex items-center gap-3">
        Điểm số:
        <span className="font-display text-4xl">{finalScore}</span>
        <span className="font-display text-xl">/10</span>
      </div>

      {wrongAnswers.length > 0 && (
        <div className="w-full max-w-xl space-y-2">
          <h3 className="font-display text-lg uppercase tracking-wide">Xem lại câu sai</h3>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {wrongAnswers.map((w, i) => (
              <div key={i} className="nb-card rounded-lg p-2 flex items-center gap-3">
                <ReviewThumb file={w.image.file} />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase bg-nb-lime border-2 border-black px-1.5 rounded">
                      Đúng
                    </span>
                    <span className="text-sm font-bold truncate">{w.image.answer}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold uppercase border-2 border-black px-1.5 rounded ${
                        w.given === null ? 'bg-nb-yellow' : 'bg-nb-red text-white'
                      }`}
                    >
                      {w.given === null ? 'Hết giờ' : 'Bạn đã chọn'}
                    </span>
                    <span className="text-sm truncate line-through decoration-nb-red decoration-2">
                      {w.given === null ? '—' : w.given}
                    </span>
                  </div>
                </div>
                <QuestionNumber n={i + 1} />
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={onReset} className="nb-btn bg-nb-blue text-white py-3.5 px-8 rounded-lg uppercase tracking-wider">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.007 7.007 0 01-11.601-2.566 1 1 0 01.61-1.276z"
            clipRule="evenodd"
          />
        </svg>
        Làm đề khác
      </button>
    </div>
  );
}

function QuestionNumber({ n }: { n: number }) {
  return (
    <span className="text-xs font-bold text-gray-400 self-start">#{n}</span>
  );
}
