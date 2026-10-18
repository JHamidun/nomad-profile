---
name: mts-link
description: "Integrate with MTS Link (Webinar.ru / Ktalk) Russian corporate video conferencing platform: schedule webinars and meetings, export recordings, transcribe Russian speech, extract action items, and sync meeting minutes to Bitrix24, Yandex Tracker, or Kaiten."
tags:
  - russian-business
  - mts-link
  - webinar
  - ktalk
  - meetings
---

# МТС Линк (Webinar.ru / Ktalk) — ВКС и Протоколы Совещаний РФ

## Назначение
Коннектор и операционный регламент для работы с российской платформой унифицированных коммуникаций **МТС Линк** (`userapi.mts-link.ru`, `ktalk.ru`):
- Выгрузка расписания встреч, вебинаров и онлайн-курсов (`GET /v3/organization/events`);
- Получение записей совещаний, чатов и списков участников с контролем присутствия;
- Автоматическая русскоязычная транскрибация и формирование протокола совещания (резюме, принятые решения, таблица поручений с ответственными и дедлайнами);
- Синхронизация поручений в **Битрикс24**, **Яндекс Трекер**, **Kaiten** или **1С:Документооборот**.

## Переменные окружения и настройка
- `MTS_LINK_API_TOKEN` — токен доступа организации МТС Линк (заголовок `x-auth-token`).
- `MTS_LINK_DOMAIN` — корпоративный домен (по умолчанию `userapi.mts-link.ru` или `<company>.ktalk.ru`).

## Безопасность и 152-ФЗ
- Разрешены только российские домены `userapi.mts-link.ru` и `*.ktalk.ru` (проверка Anti-SSRF, запрет символов подстановки `*`).
- Поддерживается маршрутизация через корпоративный VPN-туннель (`via_vpn: true`) для закрытых On-Premise инсталляций МТС Линк.
