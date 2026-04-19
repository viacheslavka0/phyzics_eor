from __future__ import annotations

from typing import Iterable


UNIT_GROUPS = [
    {
        "key": "length",
        "label": "Длина",
        "units": [
            {"code": "см", "label": "см", "to_base": 0.01},
            {"code": "м", "label": "м", "to_base": 1.0},
            {"code": "км", "label": "км", "to_base": 1000.0},
        ],
    },
    {
        "key": "time",
        "label": "Время",
        "units": [
            {"code": "с", "label": "с", "to_base": 1.0},
            {"code": "мин", "label": "мин", "to_base": 60.0},
            {"code": "ч", "label": "ч", "to_base": 3600.0},
            {"code": "сут", "label": "сут", "to_base": 86400.0},
            {"code": "лет", "label": "лет", "to_base": 31536000.0},
        ],
    },
    {
        "key": "speed",
        "label": "Скорость",
        "units": [
            {"code": "м/с", "label": "м/с", "to_base": 1.0},
            {"code": "км/ч", "label": "км/ч", "to_base": 1000.0 / 3600.0},
            {"code": "км/с", "label": "км/с", "to_base": 1000.0},
        ],
    },
]

UNIT_MAP = {}
for group in UNIT_GROUPS:
    for unit in group["units"]:
        UNIT_MAP[unit["code"]] = {
            "code": unit["code"],
            "label": unit["label"],
            "dimension": group["key"],
            "group_label": group["label"],
            "to_base": unit["to_base"],
        }

UNIT_ALIASES = {
    "сек": "с",
    "сек.": "с",
    "секунд": "с",
    "м/c": "м/с",
    "км/час": "км/ч",
    "год": "лет",
    "года": "лет",
    "лет.": "лет",
}


def normalize_unit_code(value: str | None) -> str:
    code = (value or "").strip()
    if not code:
        return ""
    return UNIT_ALIASES.get(code, code)


def get_unit_meta(code: str | None):
    normalized = normalize_unit_code(code)
    if not normalized:
        return None
    return UNIT_MAP.get(normalized)


def get_default_allowed_units(base_unit: str | None) -> list[str]:
    normalized = normalize_unit_code(base_unit)
    if not normalized:
        return []
    meta = get_unit_meta(normalized)
    if not meta:
        return [normalized]
    return [unit["code"] for unit in UNIT_GROUPS_BY_KEY[meta["dimension"]]["units"]]


UNIT_GROUPS_BY_KEY = {group["key"]: group for group in UNIT_GROUPS}


def sanitize_allowed_units(base_unit: str | None, allowed_units: Iterable[str] | None) -> list[str]:
    normalized_base = normalize_unit_code(base_unit)
    normalized_items = [normalize_unit_code(v) for v in (allowed_units or [])]
    normalized_items = [v for v in normalized_items if v]

    if normalized_base and normalized_base not in normalized_items:
        normalized_items.insert(0, normalized_base)

    base_meta = get_unit_meta(normalized_base)
    if base_meta:
        compatible = []
        for unit in normalized_items:
            meta = get_unit_meta(unit)
            if meta and meta["dimension"] == base_meta["dimension"] and unit not in compatible:
                compatible.append(unit)
        normalized_items = compatible

    if not normalized_items and normalized_base:
        return [normalized_base]

    # Preserve order while removing duplicates.
    result = []
    seen = set()
    for unit in normalized_items:
        if unit not in seen:
            seen.add(unit)
            result.append(unit)
    return result


def convert_unit_value(value: float, from_unit: str | None, to_unit: str | None) -> float:
    normalized_from = normalize_unit_code(from_unit)
    normalized_to = normalize_unit_code(to_unit)
    if not normalized_from or not normalized_to or normalized_from == normalized_to:
        return float(value)

    from_meta = get_unit_meta(normalized_from)
    to_meta = get_unit_meta(normalized_to)
    if not from_meta or not to_meta:
        raise ValueError("Неизвестная единица измерения")
    if from_meta["dimension"] != to_meta["dimension"]:
        raise ValueError("Нельзя сравнивать ответы в разных размерностях")

    base_value = float(value) * from_meta["to_base"]
    return base_value / to_meta["to_base"]
