export type CanvasObjectType = 'dot' | 'highlight';

export interface Point2D {
  x: number;
  y: number;
}

export interface CanvasObjectItem {
  id: string;
  captionId: string;
  type: CanvasObjectType;
  visible: boolean;
  color: string;
  // Cho Dot:
  x?: number;
  y?: number;
  radius?: number; // Bán kính vòng biên tròn (mặc định ~35px)
  // Cho Highlight:
  paths?: Point2D[][]; // Danh sách các nét vẽ (hỗ trợ cắt tỉa thành nhiều đoạn khi gôm)
  strokeWidth?: number;
}

export interface LayerCaption {
  id: string;
  name: string;
  visible: boolean;
  groupId?: string | null;
  color?: string; // Màu đồng bộ cho các dots trong caption này
}

export interface LayerGroup {
  id: string;
  name: string;
  visible: boolean;
  parentId?: string | null;
}

export interface ImageAnnotationData {
  groups: LayerGroup[];
  captions: LayerCaption[];
  objects: CanvasObjectItem[];
}

export interface WorkspaceFile {
  workspaceId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  images: Record<string, ImageAnnotationData>;
}

export interface LoadedWorkspace {
  handle: FileSystemDirectoryHandle | null;
  workspaceId: string;
  name: string;
  color: string;
  visible: boolean;
  data: WorkspaceFile;
  imageFiles: Map<string, File>;
  isDirty: boolean;
}

export type WorkspaceMode = 'edit' | 'review';

export type ActiveTool = 'select' | 'dot' | 'highlight' | 'eraser';

export type ReviewDisplayMode = 'markers_only' | 'show_numbers' | 'show_captions';

export interface SelectedLayerItem {
  type: 'group' | 'caption' | 'object';
  id: string;
}
