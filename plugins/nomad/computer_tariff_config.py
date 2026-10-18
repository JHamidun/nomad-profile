"""Тарифная сетка облачной песочницы / Виртуального ПК Nomad (Manus-style).

Три уровня аренды изолированного виртуального компьютера в российском контуре (152-ФЗ):
  - `basic` («Базовый · 990 ₽/мес»): 2 vCPU, 4 ГБ RAM, 20 ГБ NVMe SSD, 60 ч/мес;
  - `standard` («Стандарт · 2 990 ₽/мес»): 4 vCPU, 8 ГБ RAM, 50 ГБ NVMe SSD, 200 ч/мес;
  - `advanced` («Про · 4 990 ₽/мес»): 8 vCPU, 16 ГБ RAM, 120 ГБ NVMe SSD, 720 ч/мес (24/7).
"""

from __future__ import annotations

from enum import Enum
from typing import Any


class ComputerTier(str, Enum):
    BASIC = "basic"
    STANDARD = "standard"
    ADVANCED = "advanced"


COMPUTER_TARIFFS: dict[str, dict[str, Any]] = {
    ComputerTier.BASIC.value: {
        "id": "basic",
        "tier": "basic",
        "name": "Базовый",
        "title": "Базовый · 990 ₽/мес",
        "label": "Базовый · 990 ₽/мес",
        "price_rub": 990,
        "price_monthly_rub": 990,
        "price_formatted": "990 ₽/мес",
        "currency": "RUB",
        "vcpu": 2,
        "ram_gb": 4,
        "ram_mb": 4096,
        "ssd_gb": 20,
        "disk_gb": 20,
        "hours_per_month": 60,
        "included_hours": 60,
        "region": "ru-msk-1 (Москва · ЦОД Tier III · 152-ФЗ)",
        "description": (
            "Изолированный виртуальный ПК в облаке для безопасного запуска скриптов, "
            "парсинга, работы с документами и веб-браузером без нагрузки на ваш компьютер."
        ),
        "features": [
            "2 vCPU · 4 ГБ RAM · 20 ГБ NVMe SSD",
            "60 часов активной работы в месяц",
            "Изолированный браузер Chromium + Python 3.12 + Node.js 22",
            "Размещение в аттестованном ЦОД РФ (Москва, 152-ФЗ)",
        ],
    },
    ComputerTier.STANDARD.value: {
        "id": "standard",
        "tier": "standard",
        "name": "Стандарт",
        "title": "Стандарт · 2 990 ₽/мес",
        "label": "Стандарт · 2 990 ₽/мес",
        "price_rub": 2990,
        "price_monthly_rub": 2990,
        "price_formatted": "2 990 ₽/мес",
        "currency": "RUB",
        "vcpu": 4,
        "ram_gb": 8,
        "ram_mb": 8192,
        "ssd_gb": 50,
        "disk_gb": 50,
        "hours_per_month": 200,
        "included_hours": 200,
        "region": "ru-msk-1 (Москва · ЦОД Tier III · 152-ФЗ)",
        "description": (
            "Оптимальная рабочая станция Manus-класса для автономных агентных волн, "
            "сборки кода в песочницах Git Worktree и круглосуточных фоновых задач."
        ),
        "features": [
            "4 vCPU · 8 ГБ RAM · 50 ГБ NVMe SSD",
            "200 часов активной работы в месяц",
            "Полное GUI-окружение, фоновые демоны и Git Worktree песочницы",
            "Снапшоты состояния и размещение в ЦОД РФ (152-ФЗ)",
        ],
    },
    ComputerTier.ADVANCED.value: {
        "id": "advanced",
        "tier": "advanced",
        "name": "Про",
        "title": "Про · 4 990 ₽/мес",
        "label": "Про · 4 990 ₽/мес",
        "price_rub": 4990,
        "price_monthly_rub": 4990,
        "price_formatted": "4 990 ₽/мес",
        "currency": "RUB",
        "vcpu": 8,
        "ram_gb": 16,
        "ram_mb": 16384,
        "ssd_gb": 120,
        "disk_gb": 120,
        "hours_per_month": 720,
        "included_hours": 720,
        "region": "ru-msk-1 (Москва · ЦОД Tier III · 152-ФЗ)",
        "description": (
            "Выделенный высокопроизводительный виртуальный ПК 24/7 для параллельных роёв "
            "субагентов, тяжёлой аналитики данных, компиляции и корпоративного контура."
        ),
        "features": [
            "8 vCPU · 16 ГБ RAM · 120 ГБ NVMe SSD",
            "Безлимитная работа 24/7 (720 часов в месяц)",
            "Приоритетный канал, мгновенные снапшоты и корпоративный VPN-контур",
            "Выделенная изоляция уровня КИИ / 152-ФЗ (Москва)",
        ],
    },
}


def get_tariff(tier: str | ComputerTier) -> dict[str, Any]:
    """Вернуть копию описания тарифа по идентификатору (`basic`, `standard`, `advanced`)."""
    key = tier.value if isinstance(tier, ComputerTier) else str(tier or "").strip().lower()
    if key not in COMPUTER_TARIFFS:
        raise ValueError(f"Неизвестный тариф виртуального ПК: {tier!r}. Доступны: {', '.join(COMPUTER_TARIFFS)}")
    return dict(COMPUTER_TARIFFS[key])


def list_tariffs(active_tier: str | None = None) -> list[dict[str, Any]]:
    """Вернуть список всех тарифов с проставленным флагом `active`."""
    norm_active = str(active_tier or "").strip().lower()
    result: list[dict[str, Any]] = []
    for key in (ComputerTier.BASIC.value, ComputerTier.STANDARD.value, ComputerTier.ADVANCED.value):
        item = dict(COMPUTER_TARIFFS[key])
        item["active"] = bool(norm_active and norm_active == key)
        result.append(item)
    return result
