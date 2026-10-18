"""Локальный предполётный гардрейл 152-ФЗ (ПДн РФ, секреты, инъекции) для Совета моделей и мультиагентных маршрутов.

Объединяет детерминированный математический анализатор `local_decision_head` (СНИЛС Mod 101,
ИНН Mod 11, карты Luhn, паспорта, телефоны, ФИО, медданные ст. 10 152-ФЗ) и корпоративный
DLP-фильтр `ui_safety.redact_dlp_text`. Работает на 100% локально на CPU (< 1–3 мс) до любого
сетевого обращения.
"""

from __future__ import annotations

import re
from typing import Any

from . import local_decision_head, ui_safety

SOVEREIGN_152FZ_MODELS: tuple[str, ...] = (
    "GigaChat-2-Max",
    "YandexGPT 5 Pro",
    "Cotype Pro 3",
)

_EXTRA_PII_MARKER_RE = re.compile(
    r"(?:"
    r"\bпаспорт(?:\s+рф|\s+серия|\s+№)?\s*\d{2}\s?\d{2}\s*(?:№|номер)?\s*\d{6}\b|"
    r"\bснилс\s*[:№]?\s*\d{3}[-\s]?\d{3}[-\s]?\d{3}[-\s]\d{2}\b|"
    r"\bинн\s*[:№]?\s*(?:\d{10}|\d{12})\b|"
    r"\b(?:40702|40802|40817|30101)\d{15}\b|"
    r"\bполис\s+омс\b|"
    r"\bперсональн\w+\s+данн\w+\s+по\s+152-фз\b"
    r")",
    re.IGNORECASE,
)


class GuardrailResult(dict):
    """Словарь с поддержкой доступа к полям через атрибуты (`res.pii_detected` и `res['pii_detected']`)."""

    def __getattr__(self, name: str) -> Any:
        try:
            return self[name]
        except KeyError as exc:
            raise AttributeError(name) from exc


def evaluate_pre_request(
    prompt: str | list[dict[str, Any]],
    *,
    policy: str = "reroute_ru",
    raise_on_block: bool = False,
) -> GuardrailResult:
    """Проверить пользовательский запрос или список сообщений на ПДн РФ (152-ФЗ) и секреты.

    Возвращает `GuardrailResult` (словарь + атрибуты):
      - `pii_detected` (`bool`): обнаружены ли ПДн РФ / реквизиты / секреты;
      - `ru_152fz_triggered` (`bool`): требуется ли принудительный перевод в суверенный контур РФ;
      - `pii_categories` (`list[str]`): категории сработавших правил;
      - `findings` (`list[dict]`): подробности DLP-сканера;
      - `redacted_text` (`str`): обезличенный текст;
      - `recommended_pool` (`str`): `"sovereign_152fz"` при обнаружении ПДн, иначе `"frontier_global"`;
      - `recommended_models` (`list[str]`): список рекомендуемых моделей.
    """
    if isinstance(prompt, list):
        messages = [m for m in prompt if isinstance(m, dict)]
        raw_text = "\n".join(str(m.get("content") or "") for m in messages)
    else:
        raw_text = str(prompt or "")
        messages = [{"role": "user", "content": raw_text}]

    head_decision = local_decision_head.evaluate_pre_request_local_head(
        messages,
        policy=policy,
        raise_on_block=raise_on_block,
    )
    dlp_res = ui_safety.redact_dlp_text(raw_text)

    categories: list[str] = list(head_decision.pii_categories)
    for finding in dlp_res.get("findings") or []:
        cat_label = str(finding.get("category") or "").strip()
        if cat_label and cat_label not in categories:
            categories.append(cat_label)

    if _EXTRA_PII_MARKER_RE.search(raw_text) and "marker_152fz" not in categories:
        categories.append("marker_152fz")

    pii_detected = bool(
        head_decision.pii_detected
        or int(dlp_res.get("findings_count") or 0) > 0
        or len(categories) > 0
    )
    ru_triggered = bool(pii_detected and policy != "off")

    return GuardrailResult(
        ok=True,
        allowed=bool(head_decision.allowed and not dlp_res.get("blocked", False)),
        policy=head_decision.policy,
        action="reroute_ru" if ru_triggered else head_decision.action,
        pii_detected=pii_detected,
        ru_152fz_triggered=ru_triggered,
        pii_categories=categories,
        injection_detected=head_decision.injection_detected,
        domain=head_decision.domain,
        difficulty_tau=head_decision.difficulty_tau,
        recommended_ru_model=head_decision.recommended_ru_model or ("GigaChat-2-Max" if ru_triggered else None),
        recommended_pool="sovereign_152fz" if ru_triggered else "frontier_global",
        recommended_models=list(SOVEREIGN_152FZ_MODELS) if ru_triggered else [],
        bypass_western_jev=bool(head_decision.bypass_western_jev or ru_triggered),
        latency_ms=head_decision.latency_ms,
        outbound_headers=dict(head_decision.outbound_headers),
        redacted_text=str(dlp_res.get("redacted_text") or raw_text),
        findings=list(dlp_res.get("findings") or []),
        verdict=str(dlp_res.get("verdict") or ""),
    )
