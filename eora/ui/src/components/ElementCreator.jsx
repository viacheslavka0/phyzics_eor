/**
 * ElementCreator — форма для создания новых элементов схемы учителем
 */
import { useState } from 'react';

const DEFAULT_SVGS = {
  point: `<circle cx="12" cy="12" r="6" fill="currentColor"/>`,
  vector: `<path d="M4 12 H18 M18 12 L14 8 M18 12 L14 16" stroke="currentColor" stroke-width="2" fill="none"/>`,
  line: `<line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2"/>`,
  rect: `<rect x="4" y="6" width="16" height="12" fill="currentColor" stroke="currentColor" stroke-width="2"/>`,
  text: `<text x="6" y="16" font-size="14" font-weight="bold">T</text>`,
};

const ElementCreator = ({ categories, onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState('');
  const [svgIcon, setSvgIcon] = useState(DEFAULT_SVGS.point);
  const [svgTemplate, setSvgTemplate] = useState('<circle cx="0" cy="0" r="{radius}" fill="{color}"/>');
  const [defaultProps, setDefaultProps] = useState({ color: '#3b82f6', radius: 10 });
  const [editableProps, setEditableProps] = useState(['color', 'radius']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

  const applyTemplate = (type) => {
    setSvgIcon(DEFAULT_SVGS[type] || DEFAULT_SVGS.point);
    
    switch (type) {
      case 'point':
        setSvgTemplate('<circle cx="0" cy="0" r="{radius}" fill="{color}"/>');
        setDefaultProps({ color: '#3b82f6', radius: 6 });
        setEditableProps(['color', 'radius', 'label']);
        break;
      case 'vector':
        setSvgTemplate('<line x1="0" y1="0" x2="{length}" y2="0" stroke="{color}" stroke-width="{strokeWidth}"/><polygon points="{length},0 {length-10},-5 {length-10},5" fill="{color}"/>');
        setDefaultProps({ color: '#ef4444', strokeWidth: 2, length: 60, label: 'v' });
        setEditableProps(['color', 'length', 'label', 'strokeWidth']);
        break;
      case 'line':
        setSvgTemplate('<line x1="0" y1="0" x2="{length}" y2="0" stroke="{color}" stroke-width="{strokeWidth}"/>');
        setDefaultProps({ color: '#1a1a2e', strokeWidth: 2, length: 100 });
        setEditableProps(['color', 'length', 'strokeWidth']);
        break;
      case 'rect':
        setSvgTemplate('<rect x="{-width/2}" y="{-height/2}" width="{width}" height="{height}" fill="{color}" stroke="{strokeColor}" stroke-width="2"/>');
        setDefaultProps({ color: '#f59e0b', strokeColor: '#d97706', width: 40, height: 20 });
        setEditableProps(['color', 'width', 'height', 'label']);
        break;
      case 'text':
        setSvgTemplate('<text x="0" y="0" font-size="{fontSize}" fill="{color}" font-family="serif">{text}</text>');
        setDefaultProps({ color: '#1a1a2e', fontSize: 16, text: 'Текст' });
        setEditableProps(['color', 'fontSize', 'text']);
        break;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      {/* Заголовок */}
      <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">
          Создать новый элемент
        </h2>
        <button
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* Основные поля */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Название *
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
            <label className="block text-sm font-medium text-slate-700 mb-1">
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
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Описание
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Описание элемента для подсказки ученику..."
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Теги (через запятую)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="импульс, вектор, механика"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Шаблоны */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Начать с шаблона
          </label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(DEFAULT_SVGS).map(([type, svg]) => (
              <button
                key={type}
                onClick={() => applyTemplate(type)}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <svg 
                  className="w-5 h-5" 
                  viewBox="0 0 24 24"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
                <span className="capitalize">{type}</span>
              </button>
            ))}
          </div>
        </div>

        {/* SVG превью и редактирование */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              SVG иконка (24x24)
            </label>
            <textarea
              value={svgIcon}
              onChange={(e) => setSvgIcon(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 font-mono text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-2 flex items-center justify-center p-4 bg-slate-100 rounded-lg">
              <svg 
                className="w-12 h-12" 
                viewBox="0 0 24 24"
                dangerouslySetInnerHTML={{ __html: svgIcon }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              SVG шаблон (для холста)
            </label>
            <textarea
              value={svgTemplate}
              onChange={(e) => setSvgTemplate(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 font-mono text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Используйте {'{color}'}, {'{radius}'}, {'{length}'} и т.д.
            </p>
          </div>
        </div>

        {/* Свойства по умолчанию */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Свойства по умолчанию (JSON)
          </label>
          <textarea
            value={JSON.stringify(defaultProps, null, 2)}
            onChange={(e) => {
              try {
                setDefaultProps(JSON.parse(e.target.value));
              } catch {}
            }}
            rows={3}
            className="w-full px-3 py-2 font-mono text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Редактируемые свойства */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Редактируемые свойства
          </label>
          <div className="flex flex-wrap gap-2">
            {['color', 'radius', 'length', 'strokeWidth', 'fontSize', 'label', 'text', 'width', 'height'].map(prop => (
              <label key={prop} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={editableProps.includes(prop)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setEditableProps([...editableProps, prop]);
                    } else {
                      setEditableProps(editableProps.filter(p => p !== prop));
                    }
                  }}
                  className="rounded"
                />
                <span className="text-sm text-slate-600">{prop}</span>
              </label>
            ))}
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
          disabled={saving}
          className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Сохранение...' : 'Создать элемент'}
        </button>
      </div>
    </div>
  );
};

export default ElementCreator;


