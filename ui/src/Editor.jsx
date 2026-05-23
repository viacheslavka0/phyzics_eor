import React, { useEffect, useRef, useState } from "react";

const getCSRFCookie = () => {
  const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
};

export default function Editor({ ksId, onClose, asPage = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState([]);     // [{id?, x,y,width,height}]
  const [mapping, setMapping] = useState({}); // question_id -> Set(zoneId)

  // рисование
  const imgRef = useRef(null);
  const wrapRef = useRef(null);
  const [draw, setDraw] = useState(null);     // {x0,y0,x,y}

  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await fetch(`/api/ks/${ksId}/`);
      const j = await r.json();
      setData(j);
      setZones(j.zones || []);
      const m = {};
      (j.questions || []).forEach(q => {
        m[q.id] = new Set(q.correct_zone_ids || []);
      });
      setMapping(m);
      setLoading(false);
    })();
  }, [ksId]);

  const startDraw = (e) => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    setDraw({ x0: x, y0: y, x, y });
  };
  const moveDraw = (e) => {
    if (!draw || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    setDraw({ ...draw, x, y });
  };
  const endDraw = () => {
    if (!draw) return;
    const x = Math.min(draw.x0, draw.x);
    const y = Math.min(draw.y0, draw.y);
    const w = Math.abs(draw.x - draw.x0);
    const h = Math.abs(draw.y - draw.y0);
    if (w > 3 && h > 3) {
      setZones(z => [...z, { x, y, width: w, height: h }]);
    }
    setDraw(null);
  };

  const removeZone = (idx) => {
    const toRemove = zones[idx].id;
    setZones(z => z.filter((_, i) => i !== idx));
    if (toRemove) {
      setMapping(prev => {
        const next = {};
        Object.entries(prev).forEach(([qid, set]) => {
          const copy = new Set([...set]);
          copy.delete(toRemove);
          next[qid] = copy;
        });
        return next;
      });
    }
  };

  const toggleMap = (qid, zoneId) => {
    setMapping(prev => {
      const cur = new Set([...(prev[qid] || [])]);
      if (cur.has(zoneId)) cur.delete(zoneId);
      else cur.add(zoneId);
      return { ...prev, [qid]: cur };
    });
  };

  const saveZones = async () => {
    const payload = { zones: zones.map(z => ({ x: z.x, y: z.y, width: z.width, height: z.height })) };
    const r = await fetch(`/api/ks/${ksId}/zones/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCSRFCookie() },
      credentials: "include",
      body: JSON.stringify(payload)
    });
    if (!r.ok) { alert("Не удалось сохранить зоны"); return; }
    await r.json();
    const r2 = await fetch(`/api/ks/${ksId}/`);
    const j2 = await r2.json();
    setData(j2);
    setZones(j2.zones || []);
    alert("Зоны сохранены");
  };

  const saveBindings = async () => {
    const arr = Object.entries(mapping).map(([qid, set]) => ({
      question_id: Number(qid),
      zone_ids: [...set].map(Number),
    }));
    const r = await fetch(`/api/ks/${ksId}/bind_zones/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCSRFCookie() },
      credentials: "include",
      body: JSON.stringify(arr)
    });
    if (!r.ok) { alert("Не удалось сохранить связи"); return; }
    alert("Связи вопрос↔зоны сохранены");
  };

  if (loading || !data) {
    return asPage ? (
      <div className="bg-white rounded-xl p-6 shadow">Загрузка редактора…</div>
    ) : (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6">Загрузка редактора…</div>
      </div>
    );
  }

  const content = (
    <div className="w-full h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Редактор зон: {data.title}</div>
        <div className="space-x-2">
          <button className="px-3 py-2 rounded-md border" onClick={saveZones}>Сохранить зоны</button>
          <button className="px-3 py-2 rounded-md border" onClick={saveBindings}>Сохранить связи</button>
          <button
            className="px-3 py-2 rounded-md bg-gray-900 text-white"
            onClick={() => (onClose ? onClose() : (window.location.hash = ""))}
          >
            Закрыть
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4" style={{ height: "calc(100% - 48px)" }}>
        {/* Канва */}
        <div className="col-span-8 overflow-auto" onMouseUp={endDraw}>
          <div
            ref={wrapRef}
            className="relative inline-block border rounded-lg"
            onMouseDown={startDraw}
            onMouseMove={moveDraw}
            style={{ userSelect: "none" }}
          >
            <img ref={imgRef} src={data.image_url} alt="ks" className="block select-none" draggable={false} />
            {zones.map((z, i) => (
              <div
                key={i}
                style={{ left: z.x, top: z.y, width: z.width, height: z.height }}
                className="absolute border-2 border-red-500/80 rounded-md bg-red-500/10"
                title={z.id ? `Zone #${z.id}` : "Новая зона"}
                onDoubleClick={() => removeZone(i)}
              />
            ))}
            {draw && (
              <div
                style={{
                  left: Math.min(draw.x0, draw.x),
                  top: Math.min(draw.y0, draw.y),
                  width: Math.abs(draw.x - draw.x0),
                  height: Math.abs(draw.y - draw.y0),
                }}
                className="absolute border-2 border-blue-600 rounded-md bg-blue-500/10 pointer-events-none"
              />
            )}
          </div>
          <div className="text-sm text-gray-500 mt-2">
            Подсказки: нажми и потяни для создания зоны. Двойной клик по зоне — удалить. Сначала «Сохранить зоны», затем «Сохранить связи».
          </div>
        </div>

        {/* Панель вопросов/привязок */}
        <div className="col-span-4 overflow-auto">
          <div className="font-medium mb-2">Связать зоны с вопросами</div>
          <div className="space-y-3">
            {(data.questions || []).map(q => (
              <div key={q.id} className="border rounded-lg p-3">
                <div className="mb-2">{q.text}</div>
                <div className="flex flex-wrap gap-2">
                  {zones.map(z => (
                    <button
                      key={z.id || `new-${z.x}-${z.y}-${z.width}-${z.height}`}
                      className={`px-2 py-1 rounded border text-sm ${
                        (mapping[q.id] || new Set()).has(z.id)
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white"
                      }`}
                      disabled={!z.id}
                      onClick={() => toggleMap(q.id, z.id)}
                      title={z.id ? `Zone #${z.id}` : "Сначала сохраните зоны"}
                    >
                      {z.id ? `Зона ${z.id}` : "новая…"}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-gray-500 mt-1">Активируй зоны после сохранения — появятся их ID.</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (asPage) {
    // как обычная страница
    return <div className="bg-white rounded-2xl shadow p-4 min-h-[70vh]">{content}</div>;
  }

  // как модалка (старый режим)
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onMouseUp={endDraw}>
      <div className="bg-white rounded-2xl shadow-xl w-[95vw] h-[90vh] p-4 overflow-hidden relative">
        {content}
      </div>
    </div>
  );
}
