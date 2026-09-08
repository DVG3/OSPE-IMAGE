import React, { useState, useRef, useEffect, useMemo } from 'react';
import type {
  ImageAnnotationData,
  LayerCaption,
  LayerGroup,
  ReviewDisplayMode,
  SelectedLayerItem,
  WorkspaceMode,
} from '../../types/workspace';
import { generateId, getRandomColor } from '../../utils/geometry';

interface WorkspaceLayersProps {
  annotationData: ImageAnnotationData;
  onUpdateAnnotation: (data: ImageAnnotationData) => void;
  selectedItems: SelectedLayerItem[];
  onSelectItems: (items: SelectedLayerItem[]) => void;
  allWorkspaceCaptions: string[];
  mode: WorkspaceMode;
  reviewDisplayMode: ReviewDisplayMode;
  quickCaptionOpen: boolean;
  onCloseQuickCaption: () => void;
  initialQuickCaptionChar?: string;
}

interface FlattenedItem {
  type: 'group' | 'caption' | 'object';
  id: string;
  depth: number;
}

export default function WorkspaceLayers({
  annotationData,
  onUpdateAnnotation,
  selectedItems,
  onSelectItems,
  allWorkspaceCaptions,
  mode,
  reviewDisplayMode,
  quickCaptionOpen,
  onCloseQuickCaption,
  initialQuickCaptionChar,
}: WorkspaceLayersProps) {
  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetType: 'group' | 'caption' | 'object';
    targetId: string;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Quick Caption popup state
  const [captionInputText, setCaptionInputText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const captionInputRef = useRef<HTMLInputElement>(null);

  // Focus rename input
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Focus quick caption input
  useEffect(() => {
    if (quickCaptionOpen && captionInputRef.current) {
      const initText = initialQuickCaptionChar || '';
      setCaptionInputText(initText);
      setShowSuggestions(true);
      captionInputRef.current.focus();
      if (initText) {
        setTimeout(() => {
          captionInputRef.current?.setSelectionRange(initText.length, initText.length);
        }, 10);
      }
    }
  }, [quickCaptionOpen, initialQuickCaptionChar]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Map captions to their sequential numbers in review mode
  const captionNumberMap = useMemo(() => {
    const map: Record<string, number> = {};
    annotationData.captions.forEach((cap, idx) => {
      map[cap.id] = idx + 1;
    });
    return map;
  }, [annotationData.captions]);

  // Flatten the layer tree for Shift+Click range selection
  const flattenedItems = useMemo(() => {
    const list: FlattenedItem[] = [];

    // Helper to add a caption and its objects
    const addCaption = (cap: LayerCaption, depth: number) => {
      list.push({ type: 'caption', id: cap.id, depth });
      const objs = annotationData.objects.filter((o) => o.captionId === cap.id);
      objs.forEach((o) => {
        list.push({ type: 'object', id: o.id, depth: depth + 1 });
      });
    };

    // Helper to add a group and its subgroups/captions
    const addGroup = (grp: LayerGroup, depth: number) => {
      list.push({ type: 'group', id: grp.id, depth });
      // Child groups
      const subGroups = annotationData.groups.filter((g) => g.parentId === grp.id);
      subGroups.forEach((sg) => addGroup(sg, depth + 1));
      // Captions in this group
      const groupCaptions = annotationData.captions.filter((c) => c.groupId === grp.id);
      groupCaptions.forEach((c) => addCaption(c, depth + 1));
    };

    // Root groups
    const rootGroups = annotationData.groups.filter((g) => !g.parentId);
    rootGroups.forEach((g) => addGroup(g, 0));

    // Root captions (not inside any group)
    const rootCaptions = annotationData.captions.filter((c) => !c.groupId);
    rootCaptions.forEach((c) => addCaption(c, 0));

    return list;
  }, [annotationData]);

  // Selection handlers
  const handleItemClick = (
    e: React.MouseEvent,
    type: 'group' | 'caption' | 'object',
    id: string
  ) => {
    e.stopPropagation();

    // In Review Mode: allow selection to highlight objects
    if (e.ctrlKey || e.metaKey) {
      // Toggle selection with Ctrl
      const isSelected = selectedItems.some((s) => s.id === id);
      if (isSelected) {
        onSelectItems(selectedItems.filter((s) => s.id !== id));
      } else {
        // Multi-select rules:
        // If selecting Object, only Objects can be selected
        if (type === 'object') {
          const onlyObjects = selectedItems.filter((s) => s.type === 'object');
          onSelectItems([...onlyObjects, { type, id }]);
        } else {
          // Can mix Groups and Captions, but not Objects
          const noObjects = selectedItems.filter((s) => s.type !== 'object');
          onSelectItems([...noObjects, { type, id }]);
        }
      }
    } else if (e.shiftKey && selectedItems.length > 0) {
      // Range selection with Shift
      const lastSelected = selectedItems[selectedItems.length - 1];
      const idx1 = flattenedItems.findIndex((f) => f.id === lastSelected.id);
      const idx2 = flattenedItems.findIndex((f) => f.id === id);

      if (idx1 !== -1 && idx2 !== -1) {
        const start = Math.min(idx1, idx2);
        const end = Math.max(idx1, idx2);
        const range = flattenedItems.slice(start, end + 1);

        if (type === 'object') {
          const objectRange = range
            .filter((item) => item.type === 'object')
            .map((item) => ({ type: item.type, id: item.id }));
          onSelectItems(objectRange);
        } else {
          const groupAndCapRange = range
            .filter((item) => item.type !== 'object')
            .map((item) => ({ type: item.type, id: item.id }));
          onSelectItems(groupAndCapRange);
        }
      }
    } else {
      // Single selection
      onSelectItems([{ type, id }]);
    }
  };

  // Context Menu
  const handleContextMenu = (
    e: React.MouseEvent,
    type: 'group' | 'caption' | 'object',
    id: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!selectedItems.some((s) => s.id === id)) {
      onSelectItems([{ type, id }]);
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetType: type,
      targetId: id,
    });
  };

  // Visibility toggle
  const toggleVisibility = (
    e: React.MouseEvent,
    type: 'group' | 'caption' | 'object',
    id: string
  ) => {
    e.stopPropagation();
    if (type === 'group') {
      onUpdateAnnotation({
        ...annotationData,
        groups: annotationData.groups.map((g) =>
          g.id === id ? { ...g, visible: !g.visible } : g
        ),
      });
    } else if (type === 'caption') {
      onUpdateAnnotation({
        ...annotationData,
        captions: annotationData.captions.map((c) =>
          c.id === id ? { ...c, visible: !c.visible } : c
        ),
      });
    } else if (type === 'object') {
      onUpdateAnnotation({
        ...annotationData,
        objects: annotationData.objects.map((o) =>
          o.id === id ? { ...o, visible: !o.visible } : o
        ),
      });
    }
  };

  // Add new group
  const handleAddNewGroup = () => {
    const newGroup: LayerGroup = {
      id: generateId('grp'),
      name: `Nhóm ${annotationData.groups.length + 1}`,
      visible: true,
      parentId: null,
    };
    onUpdateAnnotation({
      ...annotationData,
      groups: [...annotationData.groups, newGroup],
    });
    onSelectItems([{ type: 'group', id: newGroup.id }]);
    setRenamingId(newGroup.id);
    setRenameText(newGroup.name);
  };

  // Save rename
  const commitRename = (type: 'group' | 'caption', id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }

    if (type === 'group') {
      onUpdateAnnotation({
        ...annotationData,
        groups: annotationData.groups.map((g) => (g.id === id ? { ...g, name: trimmed } : g)),
      });
    } else if (type === 'caption') {
      // Auto-merge if another caption already has this exact name
      const existingCap = annotationData.captions.find(
        (c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase()
      );

      if (existingCap) {
        const targetColor = existingCap.color || getRandomColor();
        // Move all objects from `id` to `existingCap.id` and synchronize color
        const updatedObjects = annotationData.objects.map((obj) =>
          obj.captionId === id
            ? { ...obj, captionId: existingCap.id, color: targetColor }
            : obj
        );
        // Remove old caption and ensure existingCap has color
        const remainingCaptions = annotationData.captions
          .filter((c) => c.id !== id)
          .map((c) => (c.id === existingCap.id ? { ...c, color: targetColor } : c));

        onUpdateAnnotation({
          ...annotationData,
          captions: remainingCaptions,
          objects: updatedObjects,
        });
      } else {
        onUpdateAnnotation({
          ...annotationData,
          captions: annotationData.captions.map((c) => (c.id === id ? { ...c, name: trimmed } : c)),
        });
      }
    }
    setRenamingId(null);
  };

  // Quick Caption submission (Hotkey C)
  const submitQuickCaption = (captionName: string) => {
    const trimmed = captionName.trim();
    if (!trimmed) {
      onCloseQuickCaption();
      return;
    }

    // Find selected objects
    const selectedObjIds = selectedItems
      .filter((s) => s.type === 'object')
      .map((s) => s.id);

    if (selectedObjIds.length === 0) {
      onCloseQuickCaption();
      return;
    }

    // Check if caption with this name already exists
    const existingCap = annotationData.captions.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );

    let targetCaptionId: string;
    let targetColor: string;
    let newCaptions = [...annotationData.captions];

    if (existingCap) {
      targetCaptionId = existingCap.id;
      targetColor = existingCap.color || getRandomColor();
      newCaptions = newCaptions.map((c) =>
        c.id === targetCaptionId ? { ...c, color: targetColor } : c
      );
    } else {
      targetCaptionId = generateId('cap');
      targetColor = getRandomColor();
      newCaptions.push({
        id: targetCaptionId,
        name: trimmed,
        visible: true,
        groupId: null,
        color: targetColor,
      });
    }

    // Move selected objects to targetCaptionId and synchronize color
    const updatedObjects = annotationData.objects.map((obj) =>
      selectedObjIds.includes(obj.id)
        ? { ...obj, captionId: targetCaptionId, color: targetColor }
        : obj
    );

    // Clean up empty captions that lost all their objects
    const activeCaptionIds = new Set(updatedObjects.map((o) => o.captionId));
    newCaptions = newCaptions.filter((c) => activeCaptionIds.has(c.id));

    onUpdateAnnotation({
      ...annotationData,
      captions: newCaptions,
      objects: updatedObjects,
    });

    onCloseQuickCaption();
  };

  // Context Menu Actions
  const handleMergeToFirstCaption = () => {
    const selectedObjIds = selectedItems
      .filter((s) => s.type === 'object')
      .map((s) => s.id);

    if (selectedObjIds.length < 2) {
      setContextMenu(null);
      return;
    }

    const firstObj = annotationData.objects.find((o) => o.id === selectedObjIds[0]);
    if (!firstObj) return;

    const firstCap = annotationData.captions.find((c) => c.id === firstObj.captionId);
    const targetCaptionId = firstObj.captionId;
    const targetColor = firstCap?.color || firstObj.color || getRandomColor();

    // Check if any other object has a non-empty caption
    const otherHasCaption = selectedObjIds.slice(1).some((oid) => {
      const obj = annotationData.objects.find((o) => o.id === oid);
      if (!obj) return false;
      const cap = annotationData.captions.find((c) => c.id === obj.captionId);
      return cap && cap.name.trim().length > 0 && cap.id !== targetCaptionId;
    });

    if (otherHasCaption) {
      const confirmMerge = window.confirm(
        `Một số đối tượng đã có Caption khác. Bạn có chắc muốn gộp tất cả về Caption "${firstCap?.name || 'Đầu tiên'}" không?`
      );
      if (!confirmMerge) {
        setContextMenu(null);
        return;
      }
    }

    // Move objects to targetCaptionId and synchronize their color
    const updatedObjects = annotationData.objects.map((obj) =>
      selectedObjIds.includes(obj.id)
        ? { ...obj, captionId: targetCaptionId, color: targetColor }
        : obj
    );

    // Clean up empty captions and ensure targetCaption has color
    const activeCaptionIds = new Set(updatedObjects.map((o) => o.captionId));
    const remainingCaptions = annotationData.captions
      .filter((c) => activeCaptionIds.has(c.id))
      .map((c) => (c.id === targetCaptionId ? { ...c, color: targetColor } : c));

    onUpdateAnnotation({
      ...annotationData,
      captions: remainingCaptions,
      objects: updatedObjects,
    });

    setContextMenu(null);
  };

  const handleToggleSelectedVisibility = (visible: boolean) => {
    const groupIds = new Set(selectedItems.filter((s) => s.type === 'group').map((s) => s.id));
    const captionIds = new Set(selectedItems.filter((s) => s.type === 'caption').map((s) => s.id));
    const objectIds = new Set(selectedItems.filter((s) => s.type === 'object').map((s) => s.id));

    onUpdateAnnotation({
      ...annotationData,
      groups: annotationData.groups.map((g) => (groupIds.has(g.id) ? { ...g, visible } : g)),
      captions: annotationData.captions.map((c) => (captionIds.has(c.id) ? { ...c, visible } : c)),
      objects: annotationData.objects.map((o) => (objectIds.has(o.id) ? { ...o, visible } : o)),
    });
    setContextMenu(null);
  };

  const handleDeleteSelected = () => {
    const groupIds = new Set(selectedItems.filter((s) => s.type === 'group').map((s) => s.id));
    const captionIds = new Set(selectedItems.filter((s) => s.type === 'caption').map((s) => s.id));
    const objectIds = new Set(selectedItems.filter((s) => s.type === 'object').map((s) => s.id));

    // Captions in deleted groups also get marked for deletion
    const allDeletedCaptionIds = new Set(captionIds);
    annotationData.captions.forEach((c) => {
      if (c.groupId && groupIds.has(c.groupId)) {
        allDeletedCaptionIds.add(c.id);
      }
    });

    // Objects in deleted captions also get deleted
    const allDeletedObjectIds = new Set(objectIds);
    annotationData.objects.forEach((o) => {
      if (allDeletedCaptionIds.has(o.captionId)) {
        allDeletedObjectIds.add(o.id);
      }
    });

    const remainingGroups = annotationData.groups.filter((g) => !groupIds.has(g.id));
    const remainingCaptions = annotationData.captions.filter((c) => !allDeletedCaptionIds.has(c.id));
    const remainingObjects = annotationData.objects.filter((o) => !allDeletedObjectIds.has(o.id));

    onUpdateAnnotation({
      ...annotationData,
      groups: remainingGroups,
      captions: remainingCaptions,
      objects: remainingObjects,
    });

    onSelectItems([]);
    setContextMenu(null);
  };

  // Filter autocomplete suggestions for caption input
  const filteredSuggestions = useMemo(() => {
    if (!captionInputText.trim()) return allWorkspaceCaptions.slice(0, 8);
    return allWorkspaceCaptions
      .filter((c) => c.toLowerCase().includes(captionInputText.toLowerCase()))
      .slice(0, 8);
  }, [allWorkspaceCaptions, captionInputText]);

  return (
    <div className="flex flex-col h-full bg-white select-none relative overflow-hidden">
      {/* Layers Header */}
      <div className="px-3 py-1.5 bg-gray-100 border-b border-black flex items-center justify-between flex-shrink-0">
        <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
          <span>📑 Layers</span>
          <span className="px-1.5 py-0.2 bg-black text-white rounded-full text-[10px]">
            {annotationData.objects.length}
          </span>
        </span>
        {mode === 'edit' && (
          <button
            type="button"
            onClick={handleAddNewGroup}
            className="nb-btn px-2 py-0.5 text-[11px] rounded bg-white hover:bg-nb-yellow"
            title="Thêm nhóm mới"
          >
            + Nhóm mới
          </button>
        )}
      </div>

      {/* Layers Tree Content */}
      <div
        className="flex-1 overflow-y-auto p-1 space-y-0.5 min-h-0 text-xs"
        onClick={() => onSelectItems([])}
      >
        {flattenedItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-4 text-center text-gray-400 text-xs italic">
            Chưa có layer nào. Hãy dùng công cụ Dot hoặc Highlight để vẽ lên ảnh!
          </div>
        ) : (
          flattenedItems.map((item) => {
            const isSelected = selectedItems.some((s) => s.id === item.id);

            if (item.type === 'group') {
              const group = annotationData.groups.find((g) => g.id === item.id);
              if (!group) return null;

              return (
                <div
                  key={group.id}
                  onClick={(e) => handleItemClick(e, 'group', group.id)}
                  onContextMenu={(e) => handleContextMenu(e, 'group', group.id)}
                  className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors border ${
                    isSelected
                      ? 'bg-nb-yellow/40 border-black font-semibold'
                      : 'border-transparent hover:bg-gray-100 text-gray-800'
                  }`}
                  style={{ paddingLeft: `${item.depth * 14 + 8}px` }}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span>📁</span>
                    {renamingId === group.id ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        onBlur={() => commitRename('group', group.id, renameText)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename('group', group.id, renameText);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        className="nb-input py-0 px-1 text-xs w-full"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className="truncate"
                        onDoubleClick={() => {
                          if (mode === 'edit') {
                            setRenamingId(group.id);
                            setRenameText(group.name);
                          }
                        }}
                      >
                        {group.name}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => toggleVisibility(e, 'group', group.id)}
                    className="p-0.5 hover:bg-gray-200 rounded text-gray-500"
                    title={group.visible ? 'Ẩn nhóm' : 'Hiện nhóm'}
                  >
                    {group.visible ? '👁️' : '🕶️'}
                  </button>
                </div>
              );
            }

            if (item.type === 'caption') {
              const caption = annotationData.captions.find((c) => c.id === item.id);
              if (!caption) return null;
              const capNumber = captionNumberMap[caption.id];

              return (
                <div
                  key={caption.id}
                  onClick={(e) => handleItemClick(e, 'caption', caption.id)}
                  onContextMenu={(e) => handleContextMenu(e, 'caption', caption.id)}
                  className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors border ${
                    isSelected
                      ? 'bg-nb-cyan/30 border-black font-semibold'
                      : 'border-transparent hover:bg-gray-100 text-gray-800'
                  }`}
                  style={{ paddingLeft: `${item.depth * 14 + 8}px` }}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {mode === 'review' && reviewDisplayMode === 'show_numbers' ? (
                      <span className="w-4 h-4 rounded-full bg-black text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0">
                        {capNumber}
                      </span>
                    ) : (
                      <span>🏷️</span>
                    )}

                    {renamingId === caption.id ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        onBlur={() => commitRename('caption', caption.id, renameText)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename('caption', caption.id, renameText);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        className="nb-input py-0 px-1 text-xs w-full"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className="truncate text-gray-900"
                        onDoubleClick={() => {
                          if (mode === 'edit') {
                            setRenamingId(caption.id);
                            setRenameText(caption.name);
                          }
                        }}
                      >
                        {caption.name || '(Chưa đặt caption)'}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => toggleVisibility(e, 'caption', caption.id)}
                    className="p-0.5 hover:bg-gray-200 rounded text-gray-500"
                    title={caption.visible ? 'Ẩn caption' : 'Hiện caption'}
                  >
                    {caption.visible ? '👁️' : '🕶️'}
                  </button>
                </div>
              );
            }

            if (item.type === 'object') {
              const obj = annotationData.objects.find((o) => o.id === item.id);
              if (!obj) return null;
              const cap = annotationData.captions.find((c) => c.id === obj.captionId);
              const objColor = cap?.color || obj.color;

              return (
                <div
                  key={obj.id}
                  onClick={(e) => handleItemClick(e, 'object', obj.id)}
                  onContextMenu={(e) => handleContextMenu(e, 'object', obj.id)}
                  className={`flex items-center justify-between px-2 py-0.5 rounded cursor-pointer transition-colors border ${
                    isSelected
                      ? 'bg-nb-yellow border-black font-semibold shadow-[1px_1px_0_#000]'
                      : 'border-transparent hover:bg-gray-100 text-gray-600'
                  }`}
                  style={{ paddingLeft: `${item.depth * 14 + 10}px` }}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black flex-shrink-0"
                      style={{ backgroundColor: objColor }}
                    />
                    <span className="truncate text-[11px]">
                      {obj.type === 'dot' ? 'Dot' : 'Highlight'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => toggleVisibility(e, 'object', obj.id)}
                    className="p-0.5 hover:bg-gray-200 rounded text-gray-500"
                    title={obj.visible ? 'Ẩn đối tượng' : 'Hiện đối tượng'}
                  >
                    {obj.visible ? '👁️' : '🕶️'}
                  </button>
                </div>
              );
            }

            return null;
          })
        )}
      </div>

      {/* Quick Caption Input Popover (Hotkey C) */}
      {quickCaptionOpen && (
        <div className="absolute bottom-2 left-2 right-2 bg-white border-2 border-black rounded-lg p-2 shadow-[4px_4px_0_#000] z-30 flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-xs font-bold">
            <span>🏷️ Đặt Caption nhanh (Phím C)</span>
            <button
              type="button"
              onClick={onCloseQuickCaption}
              className="text-gray-400 hover:text-black font-bold text-sm"
            >
              ✕
            </button>
          </div>
          <div className="relative">
            <input
              ref={captionInputRef}
              type="text"
              value={captionInputText}
              onChange={(e) => {
                setCaptionInputText(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitQuickCaption(captionInputText);
                if (e.key === 'Escape') onCloseQuickCaption();
              }}
              placeholder="Nhập tên caption..."
              className="nb-input py-1 px-2 text-xs w-full"
            />

            {/* Suggestions dropdown */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 bottom-full mb-1 bg-white border-2 border-black rounded-lg shadow-[3px_3px_0_#000] max-h-40 overflow-y-auto z-40">
                <div className="px-2 py-1 text-[10px] text-gray-500 font-semibold bg-gray-50 border-b">
                  Gợi ý từ Workspace:
                </div>
                {filteredSuggestions.map((sug) => (
                  <button
                    type="button"
                    key={sug}
                    onClick={() => {
                      setCaptionInputText(sug);
                      submitQuickCaption(sug);
                    }}
                    className="w-full text-left px-2 py-1 text-xs hover:bg-nb-yellow flex items-center gap-1 truncate"
                  >
                    <span>🏷️</span>
                    <span className="truncate">{sug}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={onCloseQuickCaption}
              className="nb-btn px-2 py-0.5 text-xs rounded"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => submitQuickCaption(captionInputText)}
              className="nb-btn px-2.5 py-0.5 text-xs rounded bg-nb-yellow"
            >
              Xác nhận (Enter)
            </button>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed bg-white border-2 border-black rounded-lg shadow-[4px_4px_0_#000] py-1 z-50 text-xs min-w-44 font-medium"
        >
          {/* Merge to first caption (only if objects selected) */}
          {selectedItems.some((s) => s.type === 'object') && (
            <button
              type="button"
              onClick={handleMergeToFirstCaption}
              className="w-full text-left px-3 py-1.5 hover:bg-nb-yellow flex items-center gap-2"
            >
              <span>🔗 Gộp vào Caption đầu</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleToggleSelectedVisibility(true)}
            className="w-full text-left px-3 py-1.5 hover:bg-nb-yellow flex items-center gap-2"
          >
            <span>👁️ Hiện các mục đã chọn</span>
          </button>

          <button
            type="button"
            onClick={() => handleToggleSelectedVisibility(false)}
            className="w-full text-left px-3 py-1.5 hover:bg-nb-yellow flex items-center gap-2"
          >
            <span>🕶️ Ẩn các mục đã chọn</span>
          </button>

          <hr className="my-1 border-black/20" />

          <button
            type="button"
            onClick={handleDeleteSelected}
            className="w-full text-left px-3 py-1.5 hover:bg-red-100 text-red-600 flex items-center gap-2"
          >
            <span>🗑️ Xóa các mục đã chọn</span>
          </button>
        </div>
      )}
    </div>
  );
}
