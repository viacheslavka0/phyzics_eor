/**
 * ElementCreatorVisual — визуальный конструктор элементов схемы для учителей
 * Без кода! Только клики и ползунки.
 */
import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Circle, Rect, Line, Arrow, Text, Group } from 'react-konva';

// =============================================================================
// ТИПЫ ЭЛЕМЕНТОВ
// =============================================================================

const ELEMENT_TYPES = [
  { id: 'point', name: 'Точка', icon: '●', description: 'Точка или положение тела' },
  { id: 'vector', name: 'Вектор', icon: '→', description: 'Стрелка для скорости, силы и т.д.' },
  { id: 'line', name: 'Линия', icon: '—', description: 'Прямая или пунктирная линия' },
  { id: 'body', name: 'Тело', icon: '▢', description: 'Объект (круг или прямоугольник)' },
  { id: 'axis', name: 'Ось', icon: '⊥', description: 'Ось координат X или Y' },
  { id: 'label', name: 'Подпись', icon: 'T', description: 'Текст или обозначение величины' },
];

const PRESET_COLORS = [
  { name: 'Красный', value: '#ef4444' },
  { name: 'Синий', value: '#3b82f6' },
  { name: 'Зелёный', value: '#22c55e' },
  { name: 'Фиолетовый', value: '#8b5cf6' },
  { name: 'Оранжевый', value: '#f59e0b' },
  { name: 'Чёрный', value: '#1a1a2e' },
  { name: 'Серый', value: '#6b7280' },
];

// =============================================================================
// ГЕНЕРАЦИЯ SVG
// =============================================================================

const generateSVG = (type, props) => {
  const { color, strokeWidth, length, radius, width, height, hasArrow, dashed, label, bodyShape } = props;
  
  switch (type) {
    case 'point':
      return {
        icon: `<circle cx="12" cy="12" r="${Math.min(radius, 8)}" fill="${color}"/>`,
        template: `<circle cx="0" cy="0" r="{radius}" fill="{color}"/>`,
      };
    
    case 'vector':
      return {
        icon: `<path d="M4 12 H18 M18 12 L14 8 M18 12 L14 16" stroke="${color}" stroke-width="2" fill="none"/>`,
        template: `<line x1="0" y1="0" x2="{length}" y2="0" stroke="{color}" stroke-width="{strokeWidth}"/><polygon points="{length},0 {length-10},-5 {length-10},5" fill="{color}"/>`,
      };
    
    case 'line':
      const dashAttr = dashed ? ' stroke-dasharray="4 2"' : '';
      return {
        icon: `<line x1="4" y1="12" x2="20" y2="12" stroke="${color}" stroke-width="2"${dashAttr}/>`,
        template: `<line x1="0" y1="0" x2="{length}" y2="0" stroke="{color}" stroke-width="{strokeWidth}"${dashed ? ' stroke-dasharray="8 4"' : ''}/>`,
      };
    
    case 'body':
      if (bodyShape === 'circle') {
        return {
          icon: `<circle cx="12" cy="12" r="8" fill="${color}" stroke="${color}" stroke-width="2"/>`,
          template: `<circle cx="0" cy="0" r="{radius}" fill="{color}" stroke="{strokeColor}" stroke-width="2"/>`,
        };
      } else {
        return {
          icon: `<rect x="4" y="6" width="16" height="12" fill="${color}" stroke="${color}" stroke-width="2"/>`,
          template: `<rect x="{-width/2}" y="{-height/2}" width="{width}" height="{height}" fill="{color}" stroke="{strokeColor}" stroke-width="2"/>`,
        };
      }
    
    case 'axis':
      return {
        icon: `<path d="M2 12 H20 M20 12 L16 9 M20 12 L16 15" stroke="${color}" stroke-width="2" fill="none"/>`,
        template: `<line x1="0" y1="0" x2="{length}" y2="0" stroke="{color}" stroke-width="2"/><polygon points="{length},0 {length-8},-4 {length-8},4" fill="{color}"/><text x="{length+5}" y="4" font-size="14" fill="{color}">{label}</text>`,
      };
    
    case 'label':
      return {
        icon: `<text x="6" y="16" font-size="14" font-weight="bold" fill="${color}">T</text>`,
        template: `<text x="0" y="0" font-size="{fontSize}" fill="{color}" font-family="serif" font-style="italic">{text}</text>`,
      };
    
    default:
      return { icon: '', template: '' };
  }
};

// =============================================================================
// ПРЕДПРОСМОТР ЭЛЕМЕНТА (Konva)
// =============================================================================

const ElementPreview = ({ type, props }) => {
  const { color, strokeWidth, length, radius, width, height, hasArrow, dashed, label, bodyShape, fontSize } = props;
  
  const centerX = 150;
  const centerY = 75;

  const renderElement = () => {
    switch (type) {
      case 'point':
        return (
          <Circle
            x={centerX}
            y={centerY}
            radius={radius}
            fill={color}
          />
        );
      
      case 'vector':
        return (
          <Arrow
            points={[centerX - length/2, centerY, centerX + length/2, centerY]}
            stroke={color}
            strokeWidth={strokeWidth}
            fill={color}
            pointerLength={10}
            pointerWidth={8}
          />
        );
      
      case 'line':
        return (
          <Line
            points={[centerX - length/2, centerY, centerX + length/2, centerY]}
            stroke={color}
            strokeWidth={strokeWidth}
            dash={dashed ? [8, 4] : undefined}
          />
        );
      
      case 'body':
        if (bodyShape === 'circle') {
          return (
            <Circle
              x={centerX}
              y={centerY}
              radius={radius}
              fill={color}
              stroke={color}
              strokeWidth={2}
            />
          );
        } else {
          return (
            <Rect
              x={centerX - width/2}
              y={centerY - height/2}
              width={width}
              height={height}
              fill={color}
              stroke={color}
              strokeWidth={2}
            />
          );
        }
      
      case 'axis':
        return (
          <Group>
            <Arrow
              points={[centerX - length/2, centerY, centerX + length/2, centerY]}
              stroke={color}
              strokeWidth={2}
              fill={color}
              pointerLength={8}
              pointerWidth={6}
            />
            <Text
              x={centerX + length/2 + 5}
              y={centerY - 8}
              text={label || 'x'}
              fontSize={14}
              fill={color}
            />
          </Group>
        );
      
      case 'label':
        return (
          <Text
            x={centerX - 20}
            y={centerY - fontSize/2}
            text={label || 'v₁'}
            fontSize={fontSize}
            fill={color}
            fontFamily="serif"
            fontStyle="italic"
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <Stage width={300} height={150}>
      <Layer>
        {/* Сетка */}
        {Array.from({ length: 7 }).map((_, i) => (
          <Line
            key={`v${i}`}
            points={[i * 50, 0, i * 50, 150]}
            stroke="#f1f5f9"
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: 4 }).map((_, i) => (
          <Line
            key={`h${i}`}
            points={[0, i * 50, 300, i * 50]}
            stroke="#f1f5f9"
            strokeWidth={1}
          />
        ))}
        {renderElement()}
      </Layer>
    </Stage>
  );
};

// =============================================================================
// ГЛАВНЫЙ КОМПОНЕНТ
// =============================================================================

const ElementCreatorVisual = ({ categories, onSave, onCancel }) => {
  // Режим: constructor | upload
  const [mode, setMode] = useState('constructor');
  
  // Выбранный тип элемента
  const [selectedType, setSelectedType] = useState('vector');
  
  // Свойства элемента
  const [props, setProps] = useState({
    color: '#ef4444',
    strokeWidth: 2,
    length: 80,
    radius: 8,
    width: 40,
    height: 25,
    hasArrow: true,
    dashed: false,
    label: 'v',
    bodyShape: 'circle',
    fontSize: 18,
  });
  
  // Метаданные
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState('');
  
  // Загрузка SVG
  const [uploadedSVG, setUploadedSVG] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);
  
  // Состояние сохранения
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Обновление свойства
  const updateProp = (key, value) => {
    setProps(prev => ({ ...prev, [key]: value }));
  };

  // Обработка загрузки файла
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.svg')) {
      setUploadError('Пожалуйста, загрузите файл в формате SVG');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const svgContent = event.target.result;
      // Извлекаем содержимое SVG (убираем теги <svg>)
      const match = svgContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
      if (match) {
        setUploadedSVG({
          full: svgContent,
          inner: match[1].trim(),
          fileName: file.name
        });
        setUploadError('');
      } else {
        setUploadError('Не удалось прочитать SVG файл');
      }
    };
    reader.readAsText(file);
  };

  // Сохранение
  const handleSave = async () => {
    if (!name.trim()) {
      setError('Введите название элемента');
      return;
    }
    if (!categoryId) {
      setError('Выберите категорию');
      return;
    }

    setSaving(true);
    setError('');

    try {
      let svgIcon, svgTemplate, defaultProps, editableProps;
      
      if (mode === 'upload' && uploadedSVG) {
        // Используем загруженный SVG
        svgIcon = uploadedSVG.inner;
        svgTemplate = uploadedSVG.inner;
        defaultProps = { color: '#1a1a2e' };
        editableProps = ['color'];
      } else {
        // Генерируем SVG из конструктора
        const generated = generateSVG(selectedType, props);
        svgIcon = generated.icon;
        svgTemplate = generated.template;
        
        // Определяем свойства в зависимости от типа
        switch (selectedType) {
          case 'point':
            defaultProps = { color: props.color, radius: props.radius };
            editableProps = ['color', 'radius', 'label'];
            break;
          case 'vector':
            defaultProps = { color: props.color, strokeWidth: props.strokeWidth, length: props.length, label: props.label };
            editableProps = ['color', 'length', 'label', 'strokeWidth'];
            break;
          case 'line':
            defaultProps = { color: props.color, strokeWidth: props.strokeWidth, length: props.length };
            editableProps = ['color', 'length', 'strokeWidth'];
            break;
          case 'body':
            defaultProps = { color: props.color, strokeColor: props.color, radius: props.radius, width: props.width, height: props.height };
            editableProps = ['color', 'radius', 'width', 'height', 'label'];
            break;
          case 'axis':
            defaultProps = { color: props.color, length: props.length, label: props.label };
            editableProps = ['color', 'length', 'label'];
            break;
          case 'label':
            defaultProps = { color: props.color, fontSize: props.fontSize, text: props.label };
            editableProps = ['color', 'fontSize', 'text'];
            break;
          default:
            defaultProps = { color: props.color };
            editableProps = ['color'];
        }
      }

      const response = await fetch('/api/schema-elements/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          category: categoryId,
          tags: tags.trim(),
          svg_icon: svgIcon,
          svg_template: svgTemplate,
          default_props: defaultProps,
          editable_props: editableProps,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Ошибка сохранения');
      }

      const newElement = await response.json();
      onSave(newElement);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Автозаполнение названия
  useEffect(() => {
    if (mode === 'constructor' && !name) {
      const typeInfo = ELEMENT_TYPES.find(t => t.id === selectedType);
      if (typeInfo && props.label) {
        // setName(`${typeInfo.name} ${props.label}`);
      }
    }
  }, [selectedType, props.label, mode]);

  return (
    <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
      {/* Заголовок */}
      <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between z-10">
        <h2 className="text-lg font-semibold text-slate-800">
          Создать новый элемент
        </h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Переключатель режима */}
      <div className="px-6 pt-4">
        <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setMode('constructor')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              mode === 'constructor' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            🎨 Конструктор
          </button>
          <button
            onClick={() => setMode('upload')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              mode === 'upload' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            📤 Загрузить SVG
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* ============ РЕЖИМ: КОНСТРУКТОР ============ */}
        {mode === 'constructor' && (
          <>
            {/* Шаг 1: Выбор типа */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Шаг 1: Выберите тип элемента
              </label>
              <div className="grid grid-cols-3 gap-2">
                {ELEMENT_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      selectedType === type.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{type.icon}</span>
                      <span className="font-medium text-slate-800">{type.name}</span>
                    </div>
                    <p className="text-xs text-slate-500">{type.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Шаг 2: Настройки */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Шаг 2: Настройте внешний вид
              </label>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Цвет */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">Цвет</label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c.value}
                        onClick={() => updateProp('color', c.value)}
                        className={`w-8 h-8 rounded-lg border-2 transition-all ${
                          props.color === c.value ? 'border-slate-800 scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Подпись/Метка */}
                {['vector', 'axis', 'label'].includes(selectedType) && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">
                      {selectedType === 'label' ? 'Текст' : 'Подпись'}
                    </label>
                    <input
                      type="text"
                      value={props.label}
                      onChange={(e) => updateProp('label', e.target.value)}
                      placeholder={selectedType === 'axis' ? 'x' : 'v₁'}
                      className="w-full px-3 py-2 text-lg border border-slate-300 rounded-lg"
                    />
                  </div>
                )}

                {/* Толщина линии */}
                {['vector', 'line'].includes(selectedType) && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">
                      Толщина линии: {props.strokeWidth}px
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="6"
                      value={props.strokeWidth}
                      onChange={(e) => updateProp('strokeWidth', parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                )}

                {/* Длина */}
                {['vector', 'line', 'axis'].includes(selectedType) && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">
                      Длина: {props.length}px
                    </label>
                    <input
                      type="range"
                      min="30"
                      max="150"
                      value={props.length}
                      onChange={(e) => updateProp('length', parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                )}

                {/* Радиус */}
                {['point', 'body'].includes(selectedType) && props.bodyShape === 'circle' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">
                      Радиус: {props.radius}px
                    </label>
                    <input
                      type="range"
                      min="3"
                      max="25"
                      value={props.radius}
                      onChange={(e) => updateProp('radius', parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                )}

                {/* Форма тела */}
                {selectedType === 'body' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">Форма</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateProp('bodyShape', 'circle')}
                        className={`flex-1 py-2 px-3 rounded-lg border-2 ${
                          props.bodyShape === 'circle' ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                        }`}
                      >
                        ● Круг
                      </button>
                      <button
                        onClick={() => updateProp('bodyShape', 'rect')}
                        className={`flex-1 py-2 px-3 rounded-lg border-2 ${
                          props.bodyShape === 'rect' ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                        }`}
                      >
                        ▢ Прямоугольник
                      </button>
                    </div>
                  </div>
                )}

                {/* Размеры прямоугольника */}
                {selectedType === 'body' && props.bodyShape === 'rect' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-2">
                        Ширина: {props.width}px
                      </label>
                      <input
                        type="range"
                        min="20"
                        max="80"
                        value={props.width}
                        onChange={(e) => updateProp('width', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-2">
                        Высота: {props.height}px
                      </label>
                      <input
                        type="range"
                        min="15"
                        max="60"
                        value={props.height}
                        onChange={(e) => updateProp('height', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </>
                )}

                {/* Размер шрифта */}
                {selectedType === 'label' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">
                      Размер шрифта: {props.fontSize}px
                    </label>
                    <input
                      type="range"
                      min="12"
                      max="32"
                      value={props.fontSize}
                      onChange={(e) => updateProp('fontSize', parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                )}

                {/* Пунктир */}
                {selectedType === 'line' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="dashed"
                      checked={props.dashed}
                      onChange={(e) => updateProp('dashed', e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="dashed" className="text-sm text-slate-600">
                      Пунктирная линия
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Шаг 3: Предпросмотр */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Шаг 3: Предпросмотр
              </label>
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <ElementPreview type={selectedType} props={props} />
              </div>
            </div>
          </>
        )}

        {/* ============ РЕЖИМ: ЗАГРУЗКА SVG ============ */}
        {mode === 'upload' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Загрузите SVG файл
            </label>
            
            <div 
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                uploadedSVG ? 'border-green-300 bg-green-50' : 'border-slate-300 hover:border-blue-400'
              }`}
              onClick={() => fileInputRef.current?.click()}
              style={{ cursor: 'pointer' }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".svg"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              {uploadedSVG ? (
                <div>
                  <div className="text-4xl mb-2">✅</div>
                  <p className="font-medium text-green-700">{uploadedSVG.fileName}</p>
                  <p className="text-sm text-slate-500 mt-1">Файл загружен. Нажмите, чтобы заменить.</p>
                  
                  {/* Предпросмотр загруженного SVG */}
                  <div className="mt-4 flex justify-center">
                    <div 
                      className="w-24 h-24 border border-slate-200 rounded-lg flex items-center justify-center bg-white"
                      dangerouslySetInnerHTML={{ 
                        __html: `<svg viewBox="0 0 24 24" width="48" height="48">${uploadedSVG.inner}</svg>` 
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-4xl mb-2">📤</div>
                  <p className="font-medium text-slate-700">Нажмите или перетащите файл</p>
                  <p className="text-sm text-slate-500 mt-1">Поддерживается формат SVG</p>
                </div>
              )}
            </div>
            
            {uploadError && (
              <p className="mt-2 text-sm text-red-600">{uploadError}</p>
            )}
            
            <p className="mt-3 text-xs text-slate-500">
              💡 Совет: SVG файлы можно создать в Figma, Illustrator или 
              <a href="https://vectr.com" target="_blank" rel="noopener" className="text-blue-600 hover:underline ml-1">
                Vectr (бесплатно онлайн)
              </a>
            </p>
          </div>
        )}

        {/* ============ МЕТАДАННЫЕ (для обоих режимов) ============ */}
        <div className="border-t border-slate-200 pt-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">
            {mode === 'constructor' ? 'Шаг 4: ' : ''}Заполните информацию
          </label>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Название элемента *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Вектор импульса"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Категория *
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Выберите...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Описание (для подсказки ученику)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Вектор импульса тела (p = mv)"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Теги для поиска (через запятую)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="импульс, вектор, механика"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Кнопки */}
      <div className="sticky bottom-0 bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          Отмена
        </button>
        <button
          onClick={handleSave}
          disabled={saving || (mode === 'upload' && !uploadedSVG)}
          className="px-6 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Сохранение...' : '✓ Создать элемент'}
        </button>
      </div>
    </div>
  );
};

export default ElementCreatorVisual;


