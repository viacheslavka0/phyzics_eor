/**
 * SchemaEditor — улучшенный редактор схем для построения модели ситуации
 * Использует react-konva для canvas-редактирования
 * 
 * Функции:
 * - История действий (Ctrl+Z / Ctrl+Y)
 * - Контекстное меню по ПКМ
 * - Привязка к сетке и объектам
 * - Множественное выделение мышью
 * - Автоматическое расширение холста
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Circle, Rect, Line, Arrow, Text, Group, Transformer } from 'react-konva';

// =============================================================================
// КОНСТАНТЫ
// =============================================================================

const GRID_SIZE = 25;
const SNAP_THRESHOLD = 10;
const EDGE_THRESHOLD = 50; // Расстояние до края для расширения
const EXPAND_AMOUNT = 100; // На сколько расширяется холст

// =============================================================================
// ХУК ДЛЯ ИСТОРИИ (UNDO/REDO)
// =============================================================================

const useHistory = (initialState) => {
  const [history, setHistory] = useState([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentState = history[currentIndex];

  const pushState = useCallback((newState) => {
    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push(newState);
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  }, [history, currentIndex]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, history.length]);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  return { currentState, pushState, undo, redo, canUndo, canRedo };
};

// =============================================================================
// ФУНКЦИИ ПРИВЯЗКИ (SNAPPING)
// =============================================================================

const snapToGrid = (value, gridSize = GRID_SIZE) => {
  return Math.round(value / gridSize) * gridSize;
};

const getSnapLines = (elements, currentIds, canvasWidth, canvasHeight) => {
  const lines = {
    vertical: [GRID_SIZE * 10], // Вертикальная линия на 10 клеток от левого края
    horizontal: [canvasHeight / 2],
  };

  elements.forEach(el => {
    if (!currentIds.includes(el.id)) {
      lines.vertical.push(el.x);
      lines.horizontal.push(el.y);
    }
  });

  return lines;
};

const findClosestSnapLine = (value, lines, threshold = SNAP_THRESHOLD) => {
  let closest = null;
  let minDist = threshold;

  lines.forEach(line => {
    const dist = Math.abs(value - line);
    if (dist < minDist) {
      minDist = dist;
      closest = line;
    }
  });

  return closest;
};

// =============================================================================
// КОНТЕКСТНОЕ МЕНЮ
// =============================================================================

const ContextMenu = ({ x, y, onClose, onDelete, onDuplicate, onUndo, canUndo, onSnapToGrid, selectedCount }) => {
  useEffect(() => {
    const handleClick = () => onClose();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [onClose]);

  return (
    <div 
      className="fixed bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50 min-w-[180px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onDuplicate}
        className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-3"
      >
        <span className="w-5 text-center">📋</span>
        <span>Дублировать {selectedCount > 1 ? `(${selectedCount})` : ''}</span>
        <span className="ml-auto text-xs text-slate-400">Ctrl+D</span>
      </button>
      <button
        onClick={onSnapToGrid}
        className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-3"
      >
        <span className="w-5 text-center">📐</span>
        <span>Привязать к сетке</span>
      </button>
      <button
        onClick={onDelete}
        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
      >
        <span className="w-5 text-center">🗑️</span>
        <span>Удалить {selectedCount > 1 ? `(${selectedCount})` : ''}</span>
        <span className="ml-auto text-xs text-slate-400">Del</span>
      </button>
      <div className="border-t border-slate-200 my-1"></div>
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className="w-5 text-center">↩️</span>
        <span>Отменить</span>
        <span className="ml-auto text-xs text-slate-400">Ctrl+Z</span>
      </button>
    </div>
  );
};

// =============================================================================
// РАМКА ВЫДЕЛЕНИЯ
// =============================================================================

const SelectionBox = ({ box }) => {
  if (!box) return null;
  
  return (
    <Rect
      x={Math.min(box.startX, box.endX)}
      y={Math.min(box.startY, box.endY)}
      width={Math.abs(box.endX - box.startX)}
      height={Math.abs(box.endY - box.startY)}
      fill="rgba(59, 130, 246, 0.1)"
      stroke="#3b82f6"
      strokeWidth={1}
      dash={[4, 4]}
    />
  );
};

// =============================================================================
// ЛИНИИ ПРИВЯЗКИ
// =============================================================================

const SnapGuides = ({ guides, width, height }) => {
  return (
    <>
      {guides.vertical !== null && (
        <Line
          points={[guides.vertical, 0, guides.vertical, height]}
          stroke="#3b82f6"
          strokeWidth={1}
          dash={[4, 4]}
        />
      )}
      {guides.horizontal !== null && (
        <Line
          points={[0, guides.horizontal, width, guides.horizontal]}
          stroke="#3b82f6"
          strokeWidth={1}
          dash={[4, 4]}
        />
      )}
    </>
  );
};

// =============================================================================
// КОМПОНЕНТ ЭЛЕМЕНТА НА ХОЛСТЕ
// =============================================================================

const SchemaElementOnCanvas = ({ 
  element, 
  isSelected, 
  onSelect, 
  onChange, 
  onContextMenu,
  onDragMove,
  snapEnabled,
  isTeacher,
  readOnly = false
}) => {
  const shapeRef = useRef();
  const trRef = useRef();

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current && isTeacher) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected, isTeacher]);

  const handleDragMove = (e) => {
    if (onDragMove) {
      onDragMove(element.id, e.target.x(), e.target.y());
    }
  };

  const handleDragEnd = (e) => {
    let x = e.target.x();
    let y = e.target.y();

    if (snapEnabled) {
      x = snapToGrid(x);
      y = snapToGrid(y);
    }

    onChange({
      ...element,
      x,
      y,
    });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;
    
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    // Сохраняем позицию и размеры до сброса трансформации
    const newX = node.x();
    const newY = node.y();
    const newRotation = node.rotation();
    
    // Для Line элементов в Konva, width() может не работать правильно, используем scaleX
    // Но попробуем использовать width() если он изменяется
    const nodeWidth = node.width();
    const nodeHeight = node.height();
    
    // Сбрасываем трансформацию
    node.scaleX(1);
    node.scaleY(1);
    
    if (['vector', 'line', 'axis-x', 'axis-y'].includes(element.type)) {
      // Для линий и векторов вычисляем новую длину
      const currentLength = element.length || (element.type === 'line' ? 100 : 60);
      // В Konva для Line с points, при трансформации через Transformer,
      // scaleX изменяется, а width() может не изменяться правильно
      // Поэтому используем scaleX * исходная длина
      const newLength = Math.max(20, Math.abs(currentLength * scaleX));
      
      onChange({
        ...element,
        x: newX,
        y: newY,
        length: newLength,
        rotation: newRotation,
      });
    } else if (element.type === 'point' || element.type === 'body-circle') {
      // Для окружностей изменяем радиус на основе scale
      const currentRadius = element.radius || (element.type === 'point' ? 6 : 15);
      // Используем среднее scaleX и scaleY для окружностей
      const avgScale = (Math.abs(scaleX) + Math.abs(scaleY)) / 2;
      const newRadius = Math.max(element.type === 'point' ? 3 : 5, currentRadius * avgScale);
      
      onChange({
        ...element,
        x: newX,
        y: newY,
        radius: newRadius,
        rotation: newRotation,
      });
    } else {
      onChange({
        ...element,
        x: newX,
        y: newY,
        width: Math.max(5, (element.width || 40) * Math.abs(scaleX)),
        height: Math.max(5, (element.height || 20) * Math.abs(scaleY)),
        rotation: newRotation,
      });
    }
  };

  const handleRightClick = (e) => {
    e.evt.preventDefault();
    onContextMenu(element.id, e.evt.clientX, e.evt.clientY);
  };

  const commonProps = {
    ref: shapeRef,
    x: element.x,
    y: element.y,
    draggable: !readOnly,
    onClick: (e) => !readOnly && onSelect(element.id, e.evt.ctrlKey || e.evt.shiftKey),
    onTap: (e) => !readOnly && onSelect(element.id, false),
    onDragMove: readOnly ? undefined : handleDragMove,
    onDragEnd: readOnly ? undefined : handleDragEnd,
    onTransformEnd: readOnly ? undefined : handleTransformEnd,
    onContextMenu: readOnly ? undefined : handleRightClick,
    onMouseEnter: (e) => {
      if (!readOnly) {
        const container = e.target.getStage().container();
        container.style.cursor = 'move';
      }
    },
    onMouseLeave: (e) => {
      const container = e.target.getStage().container();
      container.style.cursor = 'default';
    },
  };

  const renderShape = () => {
    switch (element.type) {
      case 'point':
        return (
          <Circle
            {...commonProps}
            radius={element.radius || 6}
            fill={element.color || '#1a1a2e'}
            stroke={isSelected ? '#3b82f6' : undefined}
            strokeWidth={isSelected ? 2 : 0}
          />
        );
      
      case 'body-circle':
        return (
          <Circle
            {...commonProps}
            radius={element.radius || 15}
            fill={element.color || '#3b82f6'}
            stroke={isSelected ? '#1d4ed8' : (element.strokeColor || '#1d4ed8')}
            strokeWidth={isSelected ? 3 : 2}
          />
        );
      
      case 'body-rect':
        return (
          <Rect
            {...commonProps}
            width={element.width || 40}
            height={element.height || 20}
            fill={element.color || '#f59e0b'}
            stroke={isSelected ? '#1d4ed8' : (element.strokeColor || '#d97706')}
            strokeWidth={isSelected ? 3 : 2}
            offsetX={(element.width || 40) / 2}
            offsetY={(element.height || 20) / 2}
            rotation={element.rotation || 0}
          />
        );
      
      case 'vector':
        const len = element.length || 60;
        return (
          <Arrow
            {...commonProps}
            points={[0, 0, len, 0]}
            stroke={element.color || '#ef4444'}
            strokeWidth={isSelected ? (element.strokeWidth || 2) + 1 : (element.strokeWidth || 2)}
            fill={element.color || '#ef4444'}
            pointerLength={10}
            pointerWidth={8}
            rotation={element.rotation || 0}
          />
        );
      
      case 'line':
        return (
          <Line
            {...commonProps}
            points={[0, 0, element.length || 100, 0]}
            stroke={element.color || '#1a1a2e'}
            strokeWidth={isSelected ? (element.strokeWidth || 2) + 1 : (element.strokeWidth || 2)}
            dash={element.dashed ? [8, 4] : undefined}
            rotation={element.rotation || 0}
          />
        );
      
      case 'axis-x':
        return (
          <Group {...commonProps}>
            <Arrow
              points={[0, 0, element.length || 150, 0]}
              stroke={element.color || '#1a1a2e'}
              strokeWidth={isSelected ? 3 : 2}
              fill={element.color || '#1a1a2e'}
              pointerLength={8}
              pointerWidth={6}
            />
            <Text
              x={(element.length || 150) + 5}
              y={-8}
              text={element.label || 'x'}
              fontSize={14}
              fill={element.color || '#1a1a2e'}
            />
          </Group>
        );
      
      case 'axis-y':
        return (
          <Group {...commonProps}>
            <Arrow
              points={[0, 0, 0, -(element.length || 150)]}
              stroke={element.color || '#1a1a2e'}
              strokeWidth={isSelected ? 3 : 2}
              fill={element.color || '#1a1a2e'}
              pointerLength={8}
              pointerWidth={6}
            />
            <Text
              x={5}
              y={-(element.length || 150)}
              text={element.label || 'y'}
              fontSize={14}
              fill={element.color || '#1a1a2e'}
            />
          </Group>
        );
      
      case 'text':
        return (
          <Text
            {...commonProps}
            text={element.text || 'Текст'}
            fontSize={element.fontSize || 16}
            fill={isSelected ? '#3b82f6' : (element.color || '#1a1a2e')}
            fontFamily="serif"
          />
        );
      
      case 'label':
        return (
          <Text
            {...commonProps}
            text={`${element.symbol || 'v'}${element.subscript ? '₁₂₃₄₅₆₇₈₉₀'[parseInt(element.subscript) - 1] || element.subscript : ''}`}
            fontSize={element.fontSize || 18}
            fill={isSelected ? '#3b82f6' : (element.color || '#1a1a2e')}
            fontFamily="serif"
            fontStyle="italic"
          />
        );
      
      default:
        return (
          <Circle
            {...commonProps}
            radius={10}
            fill="#ccc"
          />
        );
    }
  };

  const getTransformerConfig = () => {
    if (['vector', 'line', 'axis-x', 'axis-y'].includes(element.type)) {
      return {
        enabledAnchors: ['middle-left', 'middle-right'],
        rotateEnabled: element.type !== 'axis-x' && element.type !== 'axis-y',
        keepRatio: false,
        boundBoxFunc: (oldBox, newBox) => {
          if (Math.abs(newBox.width) < 20) return oldBox;
          return { ...newBox, height: oldBox.height };
        },
      };
    }
    if (element.type === 'point' || element.type === 'body-circle') {
      // Для окружностей разрешаем изменение размера (радиуса) через все углы
      return {
        enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
        rotateEnabled: false,
        keepRatio: true, // Для окружностей сохраняем пропорции
        boundBoxFunc: (oldBox, newBox) => {
          const minSize = element.type === 'point' ? 3 : 5;
          if (newBox.width < minSize || newBox.height < minSize) return oldBox;
          // Для окружностей делаем квадратную привязку (width = height)
          const size = Math.min(newBox.width, newBox.height);
          return { ...newBox, width: size, height: size };
        },
      };
    }
    if (element.type === 'text' || element.type === 'label') {
      return {
        enabledAnchors: [],
        rotateEnabled: false,
      };
    }
    return {
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      rotateEnabled: true,
      boundBoxFunc: (oldBox, newBox) => {
        if (newBox.width < 5 || newBox.height < 5) return oldBox;
        return newBox;
      },
    };
  };

  return (
    <>
      {renderShape()}
      {isSelected && isTeacher && (
        <Transformer
          ref={trRef}
          {...getTransformerConfig()}
        />
      )}
    </>
  );
};


// =============================================================================
// QUICK TOOLBAR — быстрый доступ к основным элементам
// =============================================================================

const QUICK_ITEMS = [
  {
    type: 'point',
    label: 'Точка',
    hint: 'Отметьте положение тела или начало координат',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <circle cx="12" cy="12" r="5" fill="currentColor"/>
      </svg>
    ),
    defaults: { radius: 6, color: '#1a1a2e' },
  },
  {
    type: 'body-circle',
    label: 'Тело',
    hint: 'Обозначьте движущийся объект (машину, мяч, человека)',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <circle cx="12" cy="12" r="8" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="2"/>
      </svg>
    ),
    defaults: { radius: 15, color: '#3b82f6' },
  },
  {
    type: 'line',
    label: 'Линия',
    hint: 'Проведите отрезок пути или расстояние',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
    defaults: { length: 100, color: '#1a1a2e', strokeWidth: 2 },
  },
  {
    type: 'vector',
    label: 'Вектор',
    hint: 'Покажите направление скорости или перемещения',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <line x1="4" y1="12" x2="17" y2="12" stroke="#ef4444" strokeWidth="2.5"/>
        <polygon points="20,12 15,8 15,16" fill="#ef4444"/>
      </svg>
    ),
    defaults: { length: 60, color: '#ef4444', strokeWidth: 2 },
  },
  {
    type: 'text',
    label: 'Текст',
    hint: 'Добавьте надпись или пояснение',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 4h14M12 4v16M9 20h6"/>
      </svg>
    ),
    defaults: { text: 'Текст', fontSize: 16, color: '#1a1a2e' },
  },
  {
    type: 'label',
    label: 'Символ',
    hint: 'Подпишите величину (v, S, t) с индексом',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <text x="5" y="18" fontSize="16" fontStyle="italic" fill="currentColor" fontFamily="serif">v₁</text>
      </svg>
    ),
    defaults: { symbol: 'v', subscript: '1', fontSize: 18, color: '#1a1a2e' },
  },
  {
    type: 'axis-x',
    label: 'Ось X',
    hint: 'Горизонтальная ось координат',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <line x1="2" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2"/>
        <polygon points="22,12 18,9 18,15" fill="currentColor"/>
        <text x="18" y="22" fontSize="9" fill="currentColor">x</text>
      </svg>
    ),
    defaults: { length: 150, color: '#1a1a2e', label: 'x' },
  },
  {
    type: 'axis-y',
    label: 'Ось Y',
    hint: 'Вертикальная ось координат',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <line x1="12" y1="22" x2="12" y2="5" stroke="currentColor" strokeWidth="2"/>
        <polygon points="12,2 9,6 15,6" fill="currentColor"/>
        <text x="16" y="8" fontSize="9" fill="currentColor">y</text>
      </svg>
    ),
    defaults: { length: 150, color: '#1a1a2e', label: 'y' },
  },
];

const QuickToolbar = ({ onAddQuick, showPaletteToggle, paletteOpen, onTogglePalette }) => (
  <div className="flex items-center gap-1 px-3 py-2 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 overflow-x-auto">
    {QUICK_ITEMS.map((item) => (
      <button
        key={item.type}
        onClick={() => onAddQuick(item)}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50 hover:shadow-sm transition-all whitespace-nowrap cursor-pointer active:scale-95"
        title={item.hint}
      >
        <span className="text-slate-500">{item.icon}</span>
        <span>{item.label}</span>
      </button>
    ))}

    {showPaletteToggle && (
      <>
        <div className="w-px h-6 bg-slate-200 mx-1 flex-shrink-0" />
        <button
          onClick={onTogglePalette}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
            paletteOpen
              ? 'text-blue-700 bg-blue-50 border border-blue-300'
              : 'text-slate-500 bg-white border border-slate-200 hover:border-slate-300 hover:text-slate-700'
          }`}
          title="Показать все элементы из каталога"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          <span>Каталог</span>
        </button>
      </>
    )}
  </div>
);


// =============================================================================
// FLOATING MINI-PANEL — компактная панель свойств для ученика
// =============================================================================

const FloatingMiniPanel = ({ selectedElements, elements, onUpdate, onDelete }) => {
  if (selectedElements.length === 0) return null;

  const selectedElement = selectedElements.length === 1
    ? elements.find(el => el.id === selectedElements[0])
    : null;

  const handleChange = (prop, value) => {
    if (!selectedElement) return;
    onUpdate({ ...selectedElement, [prop]: value });
  };

  const typeNames = {
    'point': 'Точка', 'body-circle': 'Тело', 'body-rect': 'Прямоугольник',
    'vector': 'Вектор', 'line': 'Линия', 'axis-x': 'Ось X', 'axis-y': 'Ось Y',
    'text': 'Текст', 'label': 'Символ',
  };

  if (selectedElements.length > 1) {
    return (
      <div className="absolute top-2 right-2 z-20 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 p-3 w-48">
        <p className="text-xs text-slate-500 mb-2">Выбрано: <strong>{selectedElements.length}</strong></p>
        <button
          onClick={() => onDelete(selectedElements)}
          className="w-full py-1.5 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
        >
          Удалить все
        </button>
      </div>
    );
  }

  if (!selectedElement) return null;

  const showRotation = ['vector', 'line', 'body-rect'].includes(selectedElement.type);
  const showText = selectedElement.type === 'text';
  const showLabel = selectedElement.type === 'label';
  const showLength = ['vector', 'line'].includes(selectedElement.type);

  return (
    <div className="absolute top-2 right-2 z-20 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 p-3 w-52 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{typeNames[selectedElement.type] || 'Элемент'}</span>
        <button
          onClick={() => onDelete([selectedElement.id])}
          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
          title="Удалить"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>

      {showText && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Текст</label>
          <input
            type="text"
            value={selectedElement.text || ''}
            onChange={(e) => handleChange('text', e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {showLabel && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Символ</label>
            <input
              type="text"
              value={selectedElement.symbol || 'v'}
              onChange={(e) => handleChange('symbol', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Индекс</label>
            <input
              type="text"
              value={selectedElement.subscript || ''}
              onChange={(e) => handleChange('subscript', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="1, 2..."
            />
          </div>
        </div>
      )}

      {showRotation && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Поворот: {selectedElement.rotation || 0}°</label>
          <input
            type="range" min="0" max="360"
            value={selectedElement.rotation || 0}
            onChange={(e) => handleChange('rotation', parseInt(e.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between mt-0.5">
            {[0, 45, 90, 180, 270].map(a => (
              <button key={a} onClick={() => handleChange('rotation', a)}
                className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
              >{a}°</button>
            ))}
          </div>
        </div>
      )}

      {showLength && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Длина: {selectedElement.length || 60}px</label>
          <input
            type="range" min="20" max="250"
            value={selectedElement.length || 60}
            onChange={(e) => handleChange('length', parseInt(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>
      )}

      {(selectedElement.type === 'axis-x' || selectedElement.type === 'axis-y') && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Подпись</label>
          <input
            type="text"
            value={selectedElement.label || ''}
            onChange={(e) => handleChange('label', e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
};


// =============================================================================
// ПАЛИТРА ЭЛЕМЕНТОВ (полная — для каталога)
// =============================================================================

const ElementPalette = ({ categories, onAddElement, searchQuery, setSearchQuery, onCreateNew, isTeacher }) => {
  const [expandedCategory, setExpandedCategory] = useState(null);

  const filteredCategories = categories.map(cat => ({
    ...cat,
    elements: cat.elements.filter(el =>
      el.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (el.tags && el.tags.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  })).filter(cat => cat.elements.length > 0);

  return (
    <div className="w-56 bg-slate-50 border-r border-slate-200 flex flex-col h-full">
      <div className="p-3 border-b border-slate-200 flex-shrink-0">
        <input
          type="text"
          placeholder="Поиск..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filteredCategories.map(category => (
          <div key={category.slug} className="mb-1">
            <button
              onClick={() => setExpandedCategory(
                expandedCategory === category.slug ? null : category.slug
              )}
              className="w-full flex items-center justify-between p-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              <span className="flex items-center gap-2">
                <span>{category.icon}</span>
                <span className="truncate">{category.name}</span>
                <span className="text-xs text-slate-400">({category.elements.length})</span>
              </span>
              <svg
                className={`w-4 h-4 flex-shrink-0 transition-transform ${expandedCategory === category.slug ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {expandedCategory === category.slug && (
              <div className="mt-1 ml-2 space-y-0.5 max-h-48 overflow-y-auto">
                {category.elements.map(element => (
                  <button
                    key={element.id}
                    onClick={() => onAddElement(element)}
                    className="w-full flex items-center gap-2 p-2 text-sm text-slate-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors cursor-pointer"
                    title={element.description}
                  >
                    <span 
                      className="w-5 h-5 flex items-center justify-center flex-shrink-0"
                      dangerouslySetInnerHTML={{ __html: element.svg_icon }}
                    />
                    <span className="truncate text-left text-xs">{element.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {onCreateNew && isTeacher && (
        <div className="p-2 border-t border-slate-200 flex-shrink-0">
          <button
            onClick={onCreateNew}
            className="w-full flex items-center justify-center gap-2 p-2 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Создать элемент
          </button>
        </div>
      )}
    </div>
  );
};


// =============================================================================
// ПАНЕЛЬ СВОЙСТВ (ТОЛЬКО ДЛЯ УЧИТЕЛЯ)
// =============================================================================

const PropertiesPanel = ({ selectedElements, elements, onUpdate, onDelete, snapEnabled, setSnapEnabled }) => {
  const selectedElement = selectedElements.length === 1 
    ? elements.find(el => el.id === selectedElements[0]) 
    : null;

  if (selectedElements.length === 0) {
    return (
      <div className="w-72 bg-slate-50 border-l border-slate-200 p-4 flex flex-col">
        <h3 className="font-medium text-slate-800 mb-4">Свойства</h3>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-400 text-center px-4">
            Выберите элемент на холсте
          </p>
        </div>
        
        <div className="pt-4 border-t border-slate-200">
          <h4 className="text-xs font-medium text-slate-600 mb-2 uppercase tracking-wide">Настройки</h4>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={snapEnabled}
              onChange={(e) => setSnapEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">Привязка к сетке</span>
          </label>
        </div>
      </div>
    );
  }

  if (selectedElements.length > 1) {
    return (
      <div className="w-72 bg-slate-50 border-l border-slate-200 p-4 flex flex-col">
        <h3 className="font-medium text-slate-800 mb-4">Множественный выбор</h3>
        <p className="text-sm text-slate-600 mb-4">
          Выбрано элементов: <strong>{selectedElements.length}</strong>
        </p>
        <button
          onClick={() => onDelete(selectedElements)}
          className="w-full py-2 text-sm text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <span>🗑️</span>
          <span>Удалить все ({selectedElements.length})</span>
        </button>
      </div>
    );
  }

  if (!selectedElement) return null;

  const handleChange = (prop, value) => {
    onUpdate({
      ...selectedElement,
      [prop]: value
    });
  };

  const getTypeName = (type) => {
    const names = {
      'point': 'Точка',
      'body-circle': 'Тело (круг)',
      'body-rect': 'Тело (прямоугольник)',
      'vector': 'Вектор',
      'line': 'Линия',
      'axis-x': 'Ось X',
      'axis-y': 'Ось Y',
      'text': 'Текст',
      'label': 'Подпись',
    };
    return names[type] || type;
  };

  return (
    <div className="w-72 bg-slate-50 border-l border-slate-200 flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 flex-shrink-0">
        <h3 className="font-medium text-slate-800">Свойства</h3>
        <p className="text-xs text-slate-500 mt-1">{getTypeName(selectedElement.type)}</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* Позиция */}
          <div>
            <h4 className="text-xs font-medium text-slate-600 mb-2 uppercase tracking-wide">Позиция</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">X</label>
                <input
                  type="number"
                  value={Math.round(selectedElement.x)}
                  onChange={(e) => handleChange('x', parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Y</label>
                <input
                  type="number"
                  value={Math.round(selectedElement.y)}
                  onChange={(e) => handleChange('y', parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Цвет */}
          <div>
            <h4 className="text-xs font-medium text-slate-600 mb-2 uppercase tracking-wide">Цвет</h4>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={selectedElement.color || '#1a1a2e'}
                onChange={(e) => handleChange('color', e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-slate-300"
              />
              <input
                type="text"
                value={selectedElement.color || '#1a1a2e'}
                onChange={(e) => handleChange('color', e.target.value)}
                className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Текст */}
          {(selectedElement.type === 'text' || selectedElement.type === 'label') && (
            <div>
              <h4 className="text-xs font-medium text-slate-600 mb-2 uppercase tracking-wide">
                {selectedElement.type === 'label' ? 'Символ' : 'Текст'}
              </h4>
              <input
                type="text"
                value={selectedElement.type === 'label' ? (selectedElement.symbol || 'v') : (selectedElement.text || '')}
                onChange={(e) => handleChange(selectedElement.type === 'label' ? 'symbol' : 'text', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Индекс */}
          {selectedElement.type === 'label' && (
            <div>
              <h4 className="text-xs font-medium text-slate-600 mb-2 uppercase tracking-wide">Индекс</h4>
              <input
                type="text"
                value={selectedElement.subscript || ''}
                onChange={(e) => handleChange('subscript', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="1, 2, 0..."
              />
            </div>
          )}

          {/* Подпись для осей */}
          {(selectedElement.type === 'axis-x' || selectedElement.type === 'axis-y') && (
            <div>
              <h4 className="text-xs font-medium text-slate-600 mb-2 uppercase tracking-wide">Подпись</h4>
              <input
                type="text"
                value={selectedElement.label || ''}
                onChange={(e) => handleChange('label', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Размер шрифта */}
          {(selectedElement.type === 'text' || selectedElement.type === 'label') && (
            <div>
              <h4 className="text-xs font-medium text-slate-600 mb-2 uppercase tracking-wide">
                Размер: {selectedElement.fontSize || 16}px
              </h4>
              <input
                type="range"
                min="10"
                max="32"
                value={selectedElement.fontSize || 16}
                onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
          )}

          {/* Длина */}
          {['vector', 'line', 'axis-x', 'axis-y'].includes(selectedElement.type) && (
            <div>
              <h4 className="text-xs font-medium text-slate-600 mb-2 uppercase tracking-wide">
                Длина: {selectedElement.length || 60}px
              </h4>
              <input
                type="range"
                min="20"
                max="250"
                value={selectedElement.length || 60}
                onChange={(e) => handleChange('length', parseInt(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
          )}

          {/* Толщина линии */}
          {['vector', 'line'].includes(selectedElement.type) && (
            <div>
              <h4 className="text-xs font-medium text-slate-600 mb-2 uppercase tracking-wide">
                Толщина: {selectedElement.strokeWidth || 2}px
              </h4>
              <input
                type="range"
                min="1"
                max="8"
                value={selectedElement.strokeWidth || 2}
                onChange={(e) => handleChange('strokeWidth', parseInt(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
          )}

          {/* Радиус */}
          {['point', 'body-circle'].includes(selectedElement.type) && (
            <div>
              <h4 className="text-xs font-medium text-slate-600 mb-2 uppercase tracking-wide">
                Радиус: {selectedElement.radius || 6}px
              </h4>
              <input
                type="range"
                min="3"
                max="40"
                value={selectedElement.radius || 6}
                onChange={(e) => handleChange('radius', parseInt(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
          )}

          {/* Размеры прямоугольника */}
          {selectedElement.type === 'body-rect' && (
            <div>
              <h4 className="text-xs font-medium text-slate-600 mb-2 uppercase tracking-wide">Размеры</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Ширина</label>
                  <input
                    type="number"
                    value={selectedElement.width || 40}
                    onChange={(e) => handleChange('width', parseInt(e.target.value) || 10)}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Высота</label>
                  <input
                    type="number"
                    value={selectedElement.height || 20}
                    onChange={(e) => handleChange('height', parseInt(e.target.value) || 10)}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Поворот */}
          {['vector', 'line', 'body-rect'].includes(selectedElement.type) && (
            <div>
              <h4 className="text-xs font-medium text-slate-600 mb-2 uppercase tracking-wide">
                Угол: {selectedElement.rotation || 0}°
              </h4>
              <input
                type="range"
                min="0"
                max="360"
                value={selectedElement.rotation || 0}
                onChange={(e) => handleChange('rotation', parseInt(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between mt-1">
                {[0, 45, 90, 180, 270].map(angle => (
                  <button
                    key={angle}
                    onClick={() => handleChange('rotation', angle)}
                    className="px-2 py-0.5 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                  >
                    {angle}°
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Пунктир */}
          {selectedElement.type === 'line' && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedElement.dashed || false}
                  onChange={(e) => handleChange('dashed', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Пунктирная линия</span>
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 flex-shrink-0">
        <button
          onClick={() => onDelete([selectedElement.id])}
          className="w-full py-2 text-sm text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <span>🗑️</span>
          <span>Удалить элемент</span>
        </button>
      </div>
    </div>
  );
};


// =============================================================================
// ГЛАВНЫЙ КОМПОНЕНТ РЕДАКТОРА
// =============================================================================

const SchemaEditor = ({ 
  initialData = null, 
  onSave, 
  readOnly = false,
  showReference = false,
  referenceData = null,
  width: initialWidth = 800,
  height = 500,
  isTeacher = false,
  compact = false  // Компактный режим без тулбара
}) => {
  // Динамическая ширина холста
  const [canvasWidth, setCanvasWidth] = useState(initialWidth);
  
  // История для undo/redo
  const { 
    currentState: elements, 
    pushState: pushElements, 
    undo, 
    redo, 
    canUndo, 
    canRedo 
  } = useHistory(initialData?.elements || []);
  
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showElementCreator, setShowElementCreator] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showFullPalette, setShowFullPalette] = useState(false);
  const [guides, setGuides] = useState({ vertical: null, horizontal: null });
  const [selectionBox, setSelectionBox] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const stageRef = useRef();

  // Для компактного readOnly-режима (просмотр в модалке) — центрируем и масштабируем схему
  const [viewElements, setViewElements] = useState(elements);
  const [viewScale, setViewScale] = useState(1);

  useEffect(() => {
    if (readOnly && compact && elements && elements.length > 0) {
      const filtered = elements.filter(
        (el) => el.type !== "axis-x" && el.type !== "axis-y"
      );
      if (filtered.length === 0) { setViewElements(elements); setViewScale(1); return; }

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const expand = (x1, y1, x2, y2) => {
        if (x1 < minX) minX = x1;
        if (y1 < minY) minY = y1;
        if (x2 > maxX) maxX = x2;
        if (y2 > maxY) maxY = y2;
      };

      filtered.forEach((el) => {
        const ex = el.x ?? 0;
        const ey = el.y ?? 0;
        const r = el.radius || 0;
        const w = el.width || 0;
        const h = el.height || 0;
        const len = el.length || 0;
        const rot = ((el.rotation || 0) * Math.PI) / 180;

        if (el.type === "point" || el.type === "body-circle") {
          const rad = r || (el.type === "point" ? 6 : 15);
          expand(ex - rad, ey - rad, ex + rad, ey + rad);
        } else if (el.type === "body-rect") {
          const rw = (w || 40) / 2 + 5;
          const rh = (h || 20) / 2 + 5;
          expand(ex - rw, ey - rh, ex + rw, ey + rh);
        } else if (["vector", "line"].includes(el.type)) {
          const endX = ex + (len || 100) * Math.cos(rot);
          const endY = ey + (len || 100) * Math.sin(rot);
          expand(Math.min(ex, endX) - 5, Math.min(ey, endY) - 5, Math.max(ex, endX) + 15, Math.max(ey, endY) + 15);
        } else if (el.type === "label" || el.type === "text") {
          const tw = Math.max(60, (el.text || el.label || "").length * 8);
          expand(ex - 2, ey - 2, ex + tw, ey + 20);
        } else {
          expand(ex - 20, ey - 20, ex + 20, ey + 20);
        }
      });

      if (!isFinite(minX)) { setViewElements(elements); setViewScale(1); return; }

      const pad = 30;
      const contentW = Math.max(1, maxX - minX + pad * 2);
      const contentH = Math.max(1, maxY - minY + pad * 2);
      const scale = Math.min(1, canvasWidth / contentW, height / contentH);

      const scaledW = contentW * scale;
      const scaledH = contentH * scale;
      const offsetX = (canvasWidth - scaledW) / 2 + pad * scale - minX * scale;
      const offsetY = (height - scaledH) / 2 + pad * scale - minY * scale;

      setViewScale(scale);
      setViewElements(
        elements.map((el) => ({
          ...el,
          x: (el.x ?? 0) * scale + offsetX,
          y: (el.y ?? 0) * scale + offsetY,
          radius: el.radius ? el.radius * scale : el.radius,
          width: el.width ? el.width * scale : el.width,
          height: el.height ? el.height * scale : el.height,
          length: el.length ? el.length * scale : el.length,
          strokeWidth: el.strokeWidth ? Math.max(1, el.strokeWidth * scale) : el.strokeWidth,
          fontSize: el.fontSize ? Math.max(8, el.fontSize * scale) : el.fontSize,
        }))
      );
    } else {
      setViewElements(elements);
      setViewScale(1);
    }
  }, [elements, readOnly, compact, canvasWidth, height]);

  // Загрузка категорий
  const fetchElements = async () => {
    try {
      const response = await fetch('/api/schema-elements/grouped/', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Error loading schema elements:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchElements();
  }, []);

  // Проверка расширения холста
  const checkCanvasExpansion = useCallback((x) => {
    // Расширение вправо
    if (x > canvasWidth - EDGE_THRESHOLD) {
      setCanvasWidth(prev => prev + EXPAND_AMOUNT);
    }
    // Расширение влево (сдвигаем все элементы)
    if (x < EDGE_THRESHOLD) {
      const shiftAmount = EXPAND_AMOUNT;
      setCanvasWidth(prev => prev + shiftAmount);
      // Сдвигаем все элементы вправо
      const shiftedElements = elements.map(el => ({
        ...el,
        x: el.x + shiftAmount
      }));
      pushElements(shiftedElements);
    }
  }, [canvasWidth, elements, pushElements]);

  // Добавление элемента
  const handleAddElement = useCallback((elementTemplate) => {
    const elementType = getElementType(elementTemplate);
    
    // Позиция на 10 клеток от левого края
    let x = snapEnabled ? GRID_SIZE * 10 : GRID_SIZE * 10;
    let y = snapEnabled ? snapToGrid(height / 2) : height / 2;
    
    if (elementType === 'axis-x') {
      x = GRID_SIZE * 10 - 75;
      y = height / 2;
    } else if (elementType === 'axis-y') {
      x = GRID_SIZE * 10;
      y = height / 2 + 75;
    }
    
    const newElement = {
      id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: elementType,
      x,
      y,
      ...elementTemplate.default_props,
    };
    
    pushElements([...elements, newElement]);
    setSelectedIds([newElement.id]);
  }, [height, elements, pushElements, snapEnabled]);

  const handleAddQuick = useCallback((quickItem) => {
    let x = GRID_SIZE * 10;
    let y = snapEnabled ? snapToGrid(height / 2) : height / 2;

    if (quickItem.type === 'axis-x') {
      x = GRID_SIZE * 10 - 75;
      y = height / 2;
    } else if (quickItem.type === 'axis-y') {
      x = GRID_SIZE * 10;
      y = height / 2 + 75;
    }

    const newElement = {
      id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: quickItem.type,
      x,
      y,
      ...quickItem.defaults,
    };

    pushElements([...elements, newElement]);
    setSelectedIds([newElement.id]);
  }, [height, elements, pushElements, snapEnabled]);

  const getElementType = (template) => {
    const name = template.name.toLowerCase();
    if (name.includes('вектор скорости') || name.includes('вектор перемещения') || name.includes('вектор ускорения') || name.includes('вектор силы')) return 'vector';
    if (name.includes('тело (круг)') || name.includes('начальное положение') || name.includes('конечное положение')) return 'body-circle';
    if (name.includes('тело (прямоугольник)')) return 'body-rect';
    if (name.includes('точка')) return 'point';
    if (name.includes('пунктирная')) return 'line';
    if (name.includes('линия') || name.includes('размерная')) return 'line';
    if (name.includes('ось x')) return 'axis-x';
    if (name.includes('ось y')) return 'axis-y';
    if (name.includes('начало координат')) return 'point';
    if (name.includes('индекс')) return 'label';
    if (name.includes('текст')) return 'text';
    return 'point';
  };

  // Обработка перемещения
  const handleDragMove = useCallback((elementId, x, y) => {
    // Проверка расширения холста
    checkCanvasExpansion(x);

    if (!snapEnabled) {
      setGuides({ vertical: null, horizontal: null });
      return;
    }

    const snapLines = getSnapLines(elements, selectedIds, canvasWidth, height);
    const snapX = findClosestSnapLine(x, snapLines.vertical);
    const snapY = findClosestSnapLine(y, snapLines.horizontal);

    setGuides({
      vertical: snapX,
      horizontal: snapY,
    });
  }, [elements, canvasWidth, height, snapEnabled, selectedIds, checkCanvasExpansion]);

  // Обновление элемента
  const handleUpdateElement = useCallback((updatedElement) => {
    setGuides({ vertical: null, horizontal: null });
    const newElements = elements.map(el => 
      el.id === updatedElement.id ? updatedElement : el
    );
    pushElements(newElements);
  }, [elements, pushElements]);

  // Удаление элементов
  const handleDeleteElements = useCallback((ids) => {
    pushElements(elements.filter(el => !ids.includes(el.id)));
    setSelectedIds([]);
    setContextMenu(null);
  }, [elements, pushElements]);

  // Дублирование элементов
  const handleDuplicateElements = useCallback((ids) => {
    const offset = snapEnabled ? GRID_SIZE : 20;
    const newElements = [];
    
    ids.forEach(id => {
      const element = elements.find(el => el.id === id);
      if (element) {
        newElements.push({
          ...element,
          id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          x: element.x + offset,
          y: element.y + offset,
        });
      }
    });
    
    pushElements([...elements, ...newElements]);
    setSelectedIds(newElements.map(el => el.id));
    setContextMenu(null);
  }, [elements, pushElements, snapEnabled]);

  // Привязка к сетке
  const handleSnapToGrid = useCallback((ids) => {
    const newElements = elements.map(el => 
      ids.includes(el.id) ? { ...el, x: snapToGrid(el.x), y: snapToGrid(el.y) } : el
    );
    pushElements(newElements);
    setContextMenu(null);
  }, [elements, pushElements]);

  // Выбор элемента
  const handleSelectElement = useCallback((id, addToSelection) => {
    if (addToSelection) {
      setSelectedIds(prev => 
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
    } else {
      setSelectedIds([id]);
    }
  }, []);

  // Контекстное меню
  const handleContextMenu = useCallback((elementId, x, y) => {
    if (!selectedIds.includes(elementId)) {
      setSelectedIds([elementId]);
    }
    setContextMenu({ x, y });
  }, [selectedIds]);

  // Обработка выделения мышью
  const handleMouseDown = (e) => {
    if (e.target === e.target.getStage()) {
      const pos = e.target.getStage().getPointerPosition();
      setIsSelecting(true);
      setSelectionBox({
        startX: pos.x,
        startY: pos.y,
        endX: pos.x,
        endY: pos.y,
      });
      if (!e.evt.ctrlKey && !e.evt.shiftKey) {
        setSelectedIds([]);
      }
    }
  };

  const handleMouseMove = (e) => {
    if (!isSelecting || !selectionBox) return;
    
    const pos = e.target.getStage().getPointerPosition();
    setSelectionBox(prev => ({
      ...prev,
      endX: pos.x,
      endY: pos.y,
    }));
  };

  const handleMouseUp = () => {
    if (isSelecting && selectionBox) {
      // Находим элементы внутри рамки
      const minX = Math.min(selectionBox.startX, selectionBox.endX);
      const maxX = Math.max(selectionBox.startX, selectionBox.endX);
      const minY = Math.min(selectionBox.startY, selectionBox.endY);
      const maxY = Math.max(selectionBox.startY, selectionBox.endY);

      const selectedInBox = elements.filter(el => 
        el.x >= minX && el.x <= maxX && el.y >= minY && el.y <= maxY
      ).map(el => el.id);

      if (selectedInBox.length > 0) {
        setSelectedIds(prev => [...new Set([...prev, ...selectedInBox])]);
      }
    }
    
    setIsSelecting(false);
    setSelectionBox(null);
  };

  // Клик на пустое место
  const handleStageClick = (e) => {
    if (e.target === e.target.getStage() && !isSelecting) {
      setSelectedIds([]);
    }
  };

  // Сохранение
  const handleSave = () => {
    if (onSave) {
      onSave({ width: canvasWidth, height, elements });
    }
  };

  // Экспорт
  const handleExport = () => {
    if (stageRef.current) {
      const uri = stageRef.current.toDataURL();
      const link = document.createElement('a');
      link.download = 'schema.png';
      link.href = uri;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' && selectedIds.length > 0) {
        handleDeleteElements(selectedIds);
      }
      if (e.key === 'Escape') {
        setSelectedIds([]);
        setContextMenu(null);
      }
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        redo();
      }
      if (e.ctrlKey && e.key === 'd' && selectedIds.length > 0) {
        e.preventDefault();
        handleDuplicateElements(selectedIds);
      }
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(elements.map(el => el.id));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, handleDeleteElements, handleDuplicateElements, undo, redo, elements]);

  const handleElementCreated = () => {
    setShowElementCreator(false);
    fetchElements();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const showPaletteForStudent = !isTeacher && showFullPalette;
  const showPaletteSidebar = isTeacher || showPaletteForStudent;

  return (
    <div className="flex flex-col bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Тулбар */}
      {!compact && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700">
              {isTeacher ? 'Редактор схемы (учитель)' : 'Модель ситуации'}
            </span>
            {elements.length > 0 && (
              <span className="text-xs text-slate-400">
                ({elements.length})
              </span>
            )}
            {selectedIds.length > 1 && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                Выбрано: {selectedIds.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isTeacher && (
              <button
                onClick={handleExport}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                title="Скачать как PNG"
              >
                Экспорт
              </button>
            )}
            {onSave && !readOnly && (
              <button
                onClick={handleSave}
                className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Сохранить
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick Toolbar — панель быстрого доступа */}
      {!readOnly && !compact && (
        <QuickToolbar
          onAddQuick={handleAddQuick}
          showPaletteToggle={!isTeacher}
          paletteOpen={showFullPalette}
          onTogglePalette={() => setShowFullPalette(p => !p)}
        />
      )}

      {/* Основная область */}
      <div className="flex flex-1" style={{ height: height + 20 }}>
        {/* Палитра (для учителя — всегда, для ученика — по кнопке) */}
        {!readOnly && showPaletteSidebar && (
          <ElementPalette
            categories={categories}
            onAddElement={handleAddElement}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            isTeacher={isTeacher}
            onCreateNew={isTeacher ? () => setShowElementCreator(true) : null}
          />
        )}

        {/* Холст */}
        <div className="flex-1 bg-white relative overflow-auto">
          {/* Кнопки Undo/Redo */}
          {!readOnly && (
            <div className="absolute top-2 left-2 z-10 flex gap-1">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="w-8 h-8 flex items-center justify-center bg-white/90 hover:bg-white border border-slate-200 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Отменить (Ctrl+Z)"
              >
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="w-8 h-8 flex items-center justify-center bg-white/90 hover:bg-white border border-slate-200 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Вернуть (Ctrl+Y)"
              >
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                </svg>
              </button>
            </div>
          )}

          {/* Floating mini-panel для ученика */}
          {!readOnly && !isTeacher && (
            <FloatingMiniPanel
              selectedElements={selectedIds}
              elements={elements}
              onUpdate={handleUpdateElement}
              onDelete={handleDeleteElements}
            />
          )}

          <Stage
            ref={stageRef}
            width={canvasWidth}
            height={height}
            onClick={handleStageClick}
            onTap={handleStageClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{ border: '1px solid #e2e8f0', cursor: isSelecting ? 'crosshair' : 'default' }}
          >
            <Layer>
              {/* Сетка */}
              {!compact && (
                <>
                  {Array.from({ length: Math.ceil(canvasWidth / GRID_SIZE) + 1 }).map((_, i) => (
                    <Line
                      key={`v${i}`}
                      points={[i * GRID_SIZE, 0, i * GRID_SIZE, height]}
                      stroke={i === 10 ? '#94a3b8' : '#f1f5f9'}
                      strokeWidth={1}
                    />
                  ))}
                  {Array.from({ length: Math.ceil(height / GRID_SIZE) + 1 }).map((_, i) => (
                    <Line
                      key={`h${i}`}
                      points={[0, i * GRID_SIZE, canvasWidth, i * GRID_SIZE]}
                      stroke={i * GRID_SIZE === height / 2 ? '#94a3b8' : '#f1f5f9'}
                      strokeWidth={1}
                    />
                  ))}
                </>
              )}

              <SnapGuides guides={guides} width={canvasWidth} height={height} />

              {viewElements
                .filter(element => !compact || (element.type !== 'axis-x' && element.type !== 'axis-y'))
                .map(element => (
                <SchemaElementOnCanvas
                  key={element.id}
                  element={element}
                  isSelected={selectedIds.includes(element.id)}
                  onSelect={handleSelectElement}
                  onChange={handleUpdateElement}
                  onContextMenu={handleContextMenu}
                  onDragMove={readOnly ? null : handleDragMove}
                  snapEnabled={snapEnabled}
                  isTeacher={isTeacher}
                  readOnly={readOnly}
                />
              ))}

              <SelectionBox box={selectionBox} />
            </Layer>
          </Stage>

          {/* Onboarding-подсказка на пустом холсте */}
          {elements.length === 0 && !readOnly && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center px-8 py-6 bg-blue-50/80 backdrop-blur-sm rounded-2xl border border-blue-200 max-w-sm">
                <div className="text-3xl mb-3">
                  <svg className="w-10 h-10 mx-auto text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-blue-800 mb-1">
                  Начните строить модель
                </p>
                <p className="text-xs text-blue-600 leading-relaxed">
                  Нажмите на любой элемент на панели сверху, чтобы добавить его на холст. Перетаскивайте элементы, чтобы расположить их.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Панель свойств — полная (только для учителя) */}
        {!readOnly && isTeacher && (
          <PropertiesPanel
            selectedElements={selectedIds}
            elements={elements}
            onUpdate={handleUpdateElement}
            onDelete={handleDeleteElements}
            snapEnabled={snapEnabled}
            setSnapEnabled={setSnapEnabled}
          />
        )}
      </div>

      {/* Подсказки — только для учителя */}
      {!readOnly && isTeacher && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span>Выделение мышью — множественный выбор</span>
            <span>Ctrl+клик — добавить к выбору</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Ctrl+Z — отмена</span>
            <span>Ctrl+A — выбрать всё</span>
            <span>Del — удалить</span>
          </div>
        </div>
      )}

      {/* Контекстное меню */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onDelete={() => handleDeleteElements(selectedIds)}
          onDuplicate={() => handleDuplicateElements(selectedIds)}
          onSnapToGrid={() => handleSnapToGrid(selectedIds)}
          onUndo={undo}
          canUndo={canUndo}
          selectedCount={selectedIds.length}
        />
      )}

      {/* Модальное окно создания элемента */}
      {showElementCreator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <ElementCreatorModal
            categories={categories}
            onSave={handleElementCreated}
            onCancel={() => setShowElementCreator(false)}
          />
        </div>
      )}
    </div>
  );
};

// Обёртка для lazy-загрузки
const ElementCreatorModal = ({ categories, onSave, onCancel }) => {
  const [ElementCreatorVisual, setElementCreatorVisual] = useState(null);

  useEffect(() => {
    import('./ElementCreatorVisual').then(module => {
      setElementCreatorVisual(() => module.default);
    });
  }, []);

  if (!ElementCreatorVisual) {
    return (
      <div className="bg-white rounded-xl p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <ElementCreatorVisual
      categories={categories}
      onSave={onSave}
      onCancel={onCancel}
    />
  );
};

export default SchemaEditor;
