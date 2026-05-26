import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
// Стили для read-only рендера формул (convertLatexToMarkup). Vite сам подхватит
// woff2-шрифты из node_modules/mathlive/fonts и перепишет url() на /static/app/assets.
import "mathlive/static.css";

// MathLive грузим лениво и один раз: так тяжёлый пакет не попадает в основной бандл,
// а custom-element <math-field> регистрируется только когда реально нужен ввод формул.
let mathlivePromise = null;
function loadMathlive() {
  if (!mathlivePromise) {
    mathlivePromise = import("mathlive").then((ml) => {
      const El = ml.MathfieldElement;
      if (El) {
        // CSP в проде: font-src 'self' — шрифты обязаны лежать локально, не на CDN.
        El.fontsDirectory = `${import.meta.env.BASE_URL}mathlive-fonts`;
        El.soundsDirectory = null; // отключаем звуки клавиш — лишние запросы и CSP
        // Импорт не регистрирует <math-field> сам — иначе new MathfieldElement()
        // бросает "Illegal constructor". Регистрируем элемент один раз вручную.
        if (typeof customElements !== "undefined" && !customElements.get("math-field")) {
          customElements.define("math-field", El);
        }
      }
      // Упрощённая школьная клавиатура: только числовая раскладка
      // (без вкладок sin/ln/∫, ∞≠∈, αβγ — лишних для 7–9 класса).
      try {
        const vk = (typeof window !== "undefined" && window.mathVirtualKeyboard) || ml.mathVirtualKeyboard;
        if (vk) vk.layouts = ["numeric"];
      } catch {
        // не критично — останется раскладка по умолчанию
      }
      return ml;
    });
  }
  return mathlivePromise;
}

/**
 * Редактируемое поле ввода формулы на базе MathLive (<math-field>).
 * Работает как НЕуправляемый компонент: значение задаётся один раз при монтировании,
 * далее источник истины — сам math-field, наружу отдаём LaTeX через onChange.
 * Это исключает прыжки курсора при перерисовке родителя.
 *
 * Через ref доступен imperative-метод insert(latex) — вставка в позицию курсора.
 */
const FormulaField = forwardRef(function FormulaField(
  { value = "", onChange, onFocus, placeholder, className = "", minHeight = "52px", ariaLabel },
  ref
) {
  const hostRef = useRef(null);
  const mfRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onFocusRef = useRef(onFocus);
  const [ready, setReady] = useState(false);
  // Фолбэк-значение на случай, если MathLive не загрузился — показываем как plain text.
  const [failed, setFailed] = useState(false);

  onChangeRef.current = onChange;
  onFocusRef.current = onFocus;

  useImperativeHandle(ref, () => ({
    insert: (latex) => {
      const mf = mfRef.current;
      if (mf && typeof mf.insert === "function") {
        mf.insert(latex, { focus: true });
        onChangeRef.current?.(mf.value);
      }
    },
    focus: () => mfRef.current?.focus?.(),
    getValue: () => mfRef.current?.value ?? "",
  }));

  useEffect(() => {
    let cancelled = false;
    let mf = null;
    let inputHandler = null;
    let focusHandler = null;

    loadMathlive()
      .then((ml) => {
        if (cancelled || !hostRef.current) return;
        if (!ml.MathfieldElement || !customElements.get("math-field")) {
          throw new Error("MathfieldElement is not available");
        }
        mf = document.createElement("math-field");
        mf.value = value || "";
        // 'auto' — виртуальная матклавиатура всплывает на тач-устройствах (телефон/планшет),
        // на десктопе ученик печатает с физической клавиатуры (/ → дробь, ^ → степень).
        mf.mathVirtualKeyboardPolicy = "auto";
        if (placeholder) mf.setAttribute("placeholder", placeholder);
        if (ariaLabel) mf.setAttribute("aria-label", ariaLabel);
        mf.style.width = "100%";
        mf.style.minHeight = minHeight;
        mf.style.padding = "8px 12px";
        mf.style.fontSize = "1.05rem";
        mf.style.border = "1px solid rgb(203 213 225)";
        mf.style.borderRadius = "0.5rem";
        mf.style.background = "#fff";

        inputHandler = () => onChangeRef.current?.(mf.value);
        focusHandler = () => onFocusRef.current?.();
        mf.addEventListener("input", inputHandler);
        mf.addEventListener("focusin", focusHandler);

        hostRef.current.appendChild(mf);
        // menuItems можно задавать только после монтирования элемента в DOM.
        try {
          mf.menuItems = []; // прячем контекстное меню — лишнее для ученика
        } catch {
          // не критично, если версия MathLive не даёт переопределить меню
        }
        mfRef.current = mf;
        if (!cancelled) setReady(true);
      })
      .catch((err) => {
        console.error("FormulaField: MathLive failed to load", err);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (mf) {
        if (inputHandler) mf.removeEventListener("input", inputHandler);
        if (focusHandler) mf.removeEventListener("focusin", focusHandler);
        mf.remove();
      }
      mfRef.current = null;
    };
    // Монтируем один раз: значение НЕ в deps намеренно (неуправляемое поле).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) {
    // Деградация: обычное текстовое поле, если MathLive не подгрузился.
    return (
      <textarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-base focus:ring-2 focus:ring-indigo-400 ${className}`}
        style={{ minHeight }}
      />
    );
  }

  return (
    <div
      ref={hostRef}
      className={`formula-field ${className}`}
      style={!ready ? { minHeight } : undefined}
    >
      {!ready && (
        <div
          className="w-full rounded-lg border border-slate-200 bg-slate-50 animate-pulse"
          style={{ minHeight }}
        />
      )}
    </div>
  );
});

export default FormulaField;

/**
 * Read-only отображение формулы: рендерит LaTeX через MathLive convertLatexToMarkup.
 * Пока пакет грузится (или если строка не похожа на формулу) — показываем текст как есть.
 */
export function FormulaDisplay({ value, className = "" }) {
  const [markup, setMarkup] = useState(null);
  const raw = value == null ? "" : String(value);

  useEffect(() => {
    let cancelled = false;
    if (!raw.trim()) {
      setMarkup(null);
      return;
    }
    loadMathlive()
      .then((ml) => {
        if (cancelled) return;
        try {
          setMarkup(ml.convertLatexToMarkup(raw));
        } catch {
          setMarkup(null); // не удалось распарсить как LaTeX — оставим plain text
        }
      })
      .catch(() => {
        if (!cancelled) setMarkup(null);
      });
    return () => {
      cancelled = true;
    };
  }, [raw]);

  if (markup) {
    return (
      <span
        className={`formula-display ${className}`}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    );
  }
  return <span className={className}>{raw}</span>;
}
