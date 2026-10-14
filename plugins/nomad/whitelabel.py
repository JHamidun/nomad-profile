"""Ребрендинг (White-Labeling) ответов модели и исходящих заголовков (P3 / M-120).

Модуль устраняет утечки упоминаний апстрима («Hermes», «Hermes Agent»,
«Nous Research», «NousResearch», ``*.nousresearch.com``) из пользовательских
ответов модели через хук ``transform_llm_output``, сохраняя в неприкосновенности:
- fenced code blocks (```` ```...``` ```` и ``~~~...~~~``);
- inline code spans (`` `...` ``);
- технические идентификаторы, переменные окружения и пути к файлам
  (``HERMES_HOME``, ``hermes_cli``, ``hermes_constants``, ``/hermes/`` и т.д.).

Также предоставляет санитайзер исходящих HTTP-заголовков атрибуции
(``HTTP-Referer``, ``X-Title``).
"""

from __future__ import annotations

import gc
import re
import types
from typing import Any, Dict, List, Optional, Tuple

NOMAD_BRAND = "Nomad"
NOMAD_REFERER = "https://hamidun.com"
DEFAULT_NOMAD_HEADERS: Dict[str, str] = {
    "HTTP-Referer": NOMAD_REFERER,
    "X-Title": NOMAD_BRAND,
}

# Разбиение markdown-текста на защищённые сегменты (fenced blocks, inline code) и обычный текст.
_CODE_SEGMENT_RE = re.compile(
    r"(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`)",
    re.MULTILINE,
)

# Прямые URL на домены nousresearch.com заменяются до маскировки файловых путей.
_NOUS_URL_RE = re.compile(
    r"https?://(?:[a-zA-Z0-9-]+\.)*nousresearch\.com(?:/[^\s\"'<>)]*)?",
    re.IGNORECASE,
)

# Защита технических токенов внутри обычного текста (env-переменные, snake_case модули, локальные пути).
_TECH_TOKEN_RE = re.compile(
    r"""(?x)
    (?:
        \bHERMES_[A-Z0-9_]+\b
      | \bhermes_[a-z0-9_]+\b
      | \b[a-zA-Z]:[\\/][^\s"'<>()]+
      | (?<![a-zA-Z0-9_:])(?:\.{0,2}/)+[a-zA-Z0-9_./-]*hermes[a-zA-Z0-9_./-]*
      | (?<!/)\b[a-zA-Z0-9_.-]+/[a-zA-Z0-9_./-]*hermes[a-zA-Z0-9_./-]*
      | \bhermes\.(?:db|yaml|yml|json|py|cmd|sh|exe|log|lock)\b
    )
    """
)

# Правила замены брендинга в обычном тексте (применяются последовательно).
_PROSE_REPLACEMENTS: List[Tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"\b(?:[a-zA-Z0-9-]+\.)*nousresearch\.com\b", re.IGNORECASE),
        "hamidun.com",
    ),
    (
        re.compile(r"\bNous\s+Research(?:'s)?\s+Hermes(?:\s+Agent)?\b", re.IGNORECASE),
        NOMAD_BRAND,
    ),
    (
        re.compile(r"\bHermes\s+Agent\s+by\s+Nous(?:\s+Research)?\b", re.IGNORECASE),
        NOMAD_BRAND,
    ),
    (
        re.compile(r"\bHermes\s+Agent\b", re.IGNORECASE),
        NOMAD_BRAND,
    ),
    (
        re.compile(r"\bNous\s+Research\b", re.IGNORECASE),
        NOMAD_BRAND,
    ),
    (
        re.compile(r"\bNousResearch\b", re.IGNORECASE),
        NOMAD_BRAND,
    ),
    (
        re.compile(r"\bNous\s+Portal\b", re.IGNORECASE),
        f"{NOMAD_BRAND} Portal",
    ),
    (
        re.compile(r"\b(?<![_./\\-])Hermes(?![_./\\-])\b"),
        NOMAD_BRAND,
    ),
    (
        re.compile(r"\b(?<![_./\\-])Nous(?![_./\\-])\b"),
        NOMAD_BRAND,
    ),
]


def _replace_nous_url(match: re.Match[str]) -> str:
    raw = match.group(0)
    trailing = ""
    while raw and raw[-1] in ".,;:!?":
        trailing = raw[-1] + trailing
        raw = raw[:-1]
    return f"{NOMAD_REFERER}{trailing}"


def _scrub_prose_chunk(chunk: str) -> str:
    if not chunk:
        return chunk

    # Сначала очищаем URL-ссылки на *.nousresearch.com, чтобы они не маскировались как локальные пути.
    chunk = _NOUS_URL_RE.sub(_replace_nous_url, chunk)

    placeholders: List[str] = []

    def _stash_tech(match: re.Match[str]) -> str:
        idx = len(placeholders)
        placeholders.append(match.group(0))
        return f"\x00NOMAD_TECH_{idx}\x00"

    protected = _TECH_TOKEN_RE.sub(_stash_tech, chunk)
    for pattern, replacement in _PROSE_REPLACEMENTS:
        protected = pattern.sub(replacement, protected)

    for idx, original in enumerate(placeholders):
        protected = protected.replace(f"\x00NOMAD_TECH_{idx}\x00", original)
    return protected


def scrub_text(text: str) -> str:
    """Заменяет упоминания Hermes / Nous Research на Nomad вне блоков кода и технических путей."""
    if not isinstance(text, str) or not text:
        return ""

    parts = _CODE_SEGMENT_RE.split(text)
    out: List[str] = []
    for idx, part in enumerate(parts):
        # Нечётные индексы — совпадения _CODE_SEGMENT_RE (fenced / inline code).
        if idx % 2 == 1:
            out.append(part)
        else:
            out.append(_scrub_prose_chunk(part))
    return "".join(out)


def sanitize_outbound_headers(headers: Optional[Dict[str, Any]]) -> Dict[str, str]:
    """Очищает HTTP-заголовки от атрибуции Hermes / Nous Research и проставляет Nomad."""
    cleaned: Dict[str, str] = {}
    if isinstance(headers, dict):
        for k, v in headers.items():
            key_str = str(k)
            val_str = "" if v is None else str(v)
            lower_k = key_str.lower()
            if lower_k == "http-referer":
                if "nousresearch" in val_str.lower() or "hermes" in val_str.lower() or not val_str.strip():
                    cleaned[key_str] = NOMAD_REFERER
                else:
                    cleaned[key_str] = val_str
            elif lower_k == "x-title":
                if "nous" in val_str.lower() or "hermes" in val_str.lower() or not val_str.strip():
                    cleaned[key_str] = NOMAD_BRAND
                else:
                    cleaned[key_str] = val_str
            else:
                cleaned[key_str] = val_str

    if not any(k.lower() == "http-referer" for k in cleaned):
        cleaned["HTTP-Referer"] = NOMAD_REFERER
    if not any(k.lower() == "x-title" for k in cleaned):
        cleaned["X-Title"] = NOMAD_BRAND
    return cleaned


_HEADER_TARGET_MODULES = frozenset({
    "agent.auxiliary_client",
    "agent.anthropic_adapter",
    "hermes_cli.runtime_provider",
})


def patch_loaded_attribution_headers() -> int:
    """Обновляет словари заголовков атрибуции в уже загруженных модулях (без обращения к sys.modules)."""
    patched = 0
    for obj in list(gc.get_objects()):
        if not isinstance(obj, types.ModuleType):
            continue
        if getattr(obj, "__name__", "") not in _HEADER_TARGET_MODULES:
            continue
        for attr in ("OPENROUTER_HEADERS", "DEFAULT_HEADERS", "_DEFAULT_HEADERS", "ANTHROPIC_HEADERS"):
            val = getattr(obj, attr, None)
            if isinstance(val, dict):
                setattr(obj, attr, sanitize_outbound_headers(val))
                patched += 1
    return patched


def on_transform_llm_output(
    response_text: str = "",
    session_id: str = "",
    model: str = "",
    platform: str = "",
    turn_id: str = "",
    **kwargs: Any,
) -> Optional[str]:
    """Хук ``transform_llm_output``: очищает ответ от брендинга Hermes/Nous (и координируется с верификатором)."""
    if not isinstance(response_text, str) or not response_text:
        return None

    current = scrub_text(response_text)

    if kwargs.get("chain_verification", True):
        from . import verification

        verified = verification.on_transform_llm_output(
            response_text=current,
            session_id=session_id,
            model=model,
            platform=platform,
            turn_id=turn_id,
        )
        if isinstance(verified, str) and verified:
            current = scrub_text(verified)

    if current != response_text:
        return current
    return None
