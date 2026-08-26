import { useCallback, useMemo, useRef, useState } from 'react';
import type { QuestionImage } from './useQuizEngine';

export interface FolderData {
  id: number;
  name: string;
  files: QuestionImage[];
}

export function useImageFolders() {
  const [folders, setFolders] = useState<FolderData[]>([]);
  const idRef = useRef(0);

  const addFolder = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    const folderName =
      files[0].webkitRelativePath.split('/')[0] || `Thư mục ${idRef.current + 1}`;
    const questions: QuestionImage[] = files.map((file) => ({
      file,
      answer: file.name.substring(0, file.name.lastIndexOf('.')).split('_')[0],
    }));

    const id = idRef.current++;
    setFolders((prev) => [...prev, { id, name: folderName, files: questions }]);
  }, []);

  const removeFolder = useCallback((id: number) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const totalCount = useMemo(() => folders.reduce((n, f) => n + f.files.length, 0), [folders]);
  const allImages = useMemo(() => folders.flatMap((f) => f.files), [folders]);

  return { folders, addFolder, removeFolder, totalCount, allImages };
}
