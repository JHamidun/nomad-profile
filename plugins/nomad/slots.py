"""Slot directories with account identity verification and deduplication (M-164 / N7).

Управляет каталогами слотов роя (по умолчанию ``cc-1..cc-7`` для Claude Code и ``codex-1`` для
Codex CLI под ``<hermes_home>/nomad/pool/``).

Два главных инварианта:

1. **Проверка личности (анти-дубликат аккаунта)**: перед включением слота в активный пул
   проверяется его личность (``email`` и ``orgId`` / ``org_id`` из ``claude auth status --json``
   с ``CLAUDE_CONFIG_DIR`` слота или из ``CODEX_HOME/auth.json``). Если ``email`` или ``orgId``
   совпадает с уже принятым живым слотом — второй слот отклоняется: два каталога на один и тот же
   аккаунт не дают второго лимитного окна.
2. **Привратник ``pool_mode``**: любое обращение к пуловым слотам проходит через
   ``pool_mode.require_pool_access``. В режиме ``pool_mode=shipped`` ни один пуловый слот не
   выбирается (``0`` выбранных пуловых слотов), а запись учётных данных слота или создание
   каталогов пула выбрасывает ``PoolModeRefused``.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Optional

from . import capabilities, db, pool_mode

DEFAULT_CC_SLOT_COUNT = 7
DEFAULT_CODEX_SLOT_COUNT = 1
DEFAULT_CC_SLOTS: tuple[str, ...] = tuple(f"cc-{i}" for i in range(1, DEFAULT_CC_SLOT_COUNT + 1))
DEFAULT_CODEX_SLOTS: tuple[str, ...] = tuple(
    f"codex-{i}" for i in range(1, DEFAULT_CODEX_SLOT_COUNT + 1)
)
DEFAULT_OWNER_SLOTS: tuple[str, ...] = DEFAULT_CC_SLOTS + DEFAULT_CODEX_SLOTS

_POOLED_NAME_RE = re.compile(r"^(?:cc|claude|codex)-\d+$", re.IGNORECASE)

REASON_DUPLICATE_IDENTITY = "duplicate_identity"
REASON_POOL_MODE_SHIPPED = "pool_mode_shipped"
REASON_NOT_ALIVE = "not_alive"


class DuplicateSlotIdentityError(ValueError, RuntimeError):
    """Raised when a second slot shares ``email`` or ``orgId`` with an already registered slot."""

    def __init__(
        self,
        slot: str,
        conflict_slot: str,
        field_name: str,
        value: str,
    ) -> None:
        self.slot = str(slot)
        self.conflict_slot = str(conflict_slot)
        self.field = str(field_name)
        self.value = str(value)
        self.reason = REASON_DUPLICATE_IDENTITY
        super().__init__(
            f"slot {self.slot!r} rejected: duplicate {self.field}={self.value!r} "
            f"already claimed by slot {self.conflict_slot!r}"
        )


def normalize_email(raw: Any) -> Optional[str]:
    """Normalize an email string for case-insensitive identity comparison."""
    if not isinstance(raw, str):
        return None
    cleaned = raw.strip().lower()
    return cleaned or None


def normalize_org_id(raw: Any) -> Optional[str]:
    """Normalize an organization id (``orgId`` / ``org_id``) for identity comparison."""
    if not isinstance(raw, str):
        return None
    cleaned = raw.strip()
    return cleaned or None


def extract_identity(source: Any) -> dict[str, Optional[str]]:
    """Extract ``email``, ``orgId`` (and alias ``org_id``), ``account_id``, ``auth_method`` from a
    slot dict, identity dict, or object."""
    if source is None:
        return {"email": None, "orgId": None, "org_id": None, "account_id": None, "auth_method": None}

    if isinstance(source, Mapping):
        nested = source.get("identity")
        base: Mapping[str, Any] = nested if isinstance(nested, Mapping) else source
        email = normalize_email(base.get("email") or source.get("email"))
        org_raw = (
            base.get("orgId")
            or base.get("org_id")
            or base.get("organization_id")
            or source.get("orgId")
            or source.get("org_id")
            or source.get("organization_id")
        )
        org_id = normalize_org_id(org_raw)
        acc_raw = (
            base.get("account_id")
            or base.get("accountId")
            or source.get("account_id")
            or source.get("accountId")
        )
        account_id = normalize_org_id(acc_raw)
        auth_raw = base.get("auth_method") or base.get("authMethod") or source.get("auth_method")
        auth_method = str(auth_raw).strip() if isinstance(auth_raw, str) and auth_raw.strip() else None
        return {
            "email": email,
            "orgId": org_id,
            "org_id": org_id,
            "account_id": account_id,
            "auth_method": auth_method,
        }

    email = normalize_email(getattr(source, "email", None))
    org_id = normalize_org_id(
        getattr(source, "orgId", None) or getattr(source, "org_id", None)
    )
    account_id = normalize_org_id(getattr(source, "account_id", None))
    auth_raw = getattr(source, "auth_method", None)
    auth_method = str(auth_raw).strip() if isinstance(auth_raw, str) and auth_raw.strip() else None
    return {
        "email": email,
        "orgId": org_id,
        "org_id": org_id,
        "account_id": account_id,
        "auth_method": auth_method,
    }


def is_pooled_slot(slot_or_lane: Any) -> bool:
    """Return ``True`` if ``slot_or_lane`` represents a multi-account pooled slot."""
    if isinstance(slot_or_lane, SlotRecord):
        return bool(slot_or_lane.pooled)
    if isinstance(slot_or_lane, Mapping):
        if "pooled" in slot_or_lane:
            return bool(slot_or_lane["pooled"])
        if slot_or_lane.get("config_dir") or slot_or_lane.get("codex_home") or slot_or_lane.get("slot_dir"):
            return True
        name = str(slot_or_lane.get("slot") or slot_or_lane.get("lane") or "").strip()
        return bool(_POOLED_NAME_RE.match(name))
    if isinstance(slot_or_lane, str):
        return bool(_POOLED_NAME_RE.match(slot_or_lane.strip()))
    return bool(getattr(slot_or_lane, "pooled", False))


def infer_slot_vendor(slot_name: str, explicit_vendor: Optional[str] = None) -> str:
    """Infer vendor family (``anthropic`` or ``openai``) from slot name when not explicitly given."""
    if explicit_vendor and str(explicit_vendor).strip():
        v = str(explicit_vendor).strip().lower()
        if v in ("claude", "claude-code", "cc", "anthropic"):
            return "anthropic"
        if v in ("codex", "openai", "openai-codex"):
            return "openai"
        return v
    lowered = str(slot_name or "").strip().lower()
    if lowered.startswith(("cc", "claude")):
        return "anthropic"
    if lowered.startswith(("codex", "openai")):
        return "openai"
    return "unknown"


def infer_slot_track(slot_name: str, explicit_track: Optional[str] = None) -> str:
    """Infer router track (``claude-code`` or ``codex``) for a slot."""
    if explicit_track and str(explicit_track).strip():
        t = str(explicit_track).strip().lower()
        if t in ("cc", "claude", "claude-code"):
            return "claude-code"
        if t in ("codex", "openai-codex"):
            return "codex"
        return t
    vendor = infer_slot_vendor(slot_name)
    if vendor == "anthropic":
        return "claude-code"
    if vendor == "openai":
        return "codex"
    return str(slot_name or "").strip()


@dataclass
class SlotRecord:
    """One slot directory and its verified identity status."""

    slot: str
    track: str = "claude-code"
    vendor: str = "anthropic"
    billing: str = capabilities.SUBSCRIPTION
    slot_dir: Optional[Path] = None
    email: Optional[str] = None
    org_id: Optional[str] = None
    account_id: Optional[str] = None
    auth_method: Optional[str] = None
    alive: bool = True
    accepted: bool = True
    pooled: bool = True
    window_left: Any = 100.0
    reason: Optional[str] = None
    conflict_with: Optional[str] = None
    conflict_field: Optional[str] = None
    extra: dict[str, Any] = field(default_factory=dict)

    @property
    def lane(self) -> str:
        return self.slot

    @property
    def orgId(self) -> Optional[str]:  # noqa: N802 - matches Claude CLI JSON field name
        return self.org_id

    @property
    def identity(self) -> dict[str, Optional[str]]:
        return {
            "email": self.email,
            "orgId": self.org_id,
            "org_id": self.org_id,
            "account_id": self.account_id,
            "auth_method": self.auth_method,
        }

    def to_dict(self) -> dict[str, Any]:
        row: dict[str, Any] = {
            "slot": self.slot,
            "lane": self.slot,
            "track": self.track,
            "vendor": self.vendor,
            "billing": self.billing,
            "slot_dir": str(self.slot_dir) if self.slot_dir is not None else None,
            "config_dir": (
                str(self.slot_dir)
                if self.slot_dir is not None and self.vendor == "anthropic"
                else None
            ),
            "codex_home": (
                str(self.slot_dir)
                if self.slot_dir is not None and self.vendor == "openai"
                else None
            ),
            "identity": self.identity,
            "email": self.email,
            "orgId": self.org_id,
            "org_id": self.org_id,
            "account_id": self.account_id,
            "alive": bool(self.alive and self.accepted),
            "accepted": bool(self.accepted),
            "pooled": bool(self.pooled),
            "window_left": self.window_left,
            "allowed_by_whitelist": True,
            "reason": self.reason,
            "conflict_with": self.conflict_with,
            "conflict_field": self.conflict_field,
        }
        if self.extra:
            for k, v in self.extra.items():
                row.setdefault(k, v)
        return row


def default_pool_root() -> Path:
    """Return configured ``nomad.pool_root`` or ``<hermes_home>/nomad/pool``."""
    data = capabilities._load_config() or {}
    section = data.get(capabilities.CONFIG_SECTION)
    raw = section.get(capabilities.POOL_ROOT_KEY) if isinstance(section, dict) else None
    if isinstance(raw, str) and raw.strip():
        return Path(raw).expanduser()
    return capabilities.core_adapter.get_hermes_home() / "nomad" / "pool"


def ensure_default_slot_dirs(
    root: Optional[Path] = None,
    *,
    cc_count: int = DEFAULT_CC_SLOT_COUNT,
    codex_count: int = DEFAULT_CODEX_SLOT_COUNT,
) -> list[Path]:
    """Create default owner slot directories (``cc-1..cc-7``, ``codex-1``) under ``pool_root``.

    Guarded by ``pool_mode.require_pool_access``: raises ``PoolModeRefused`` in ``shipped`` mode.
    """
    base = Path(root) if root is not None else default_pool_root()
    pool_mode.require_pool_access(pool_mode.ACTION_POOLED_LANE, str(base))
    created: list[Path] = []
    for idx in range(1, max(0, int(cc_count)) + 1):
        slot_path = base / "cc" / f"cc-{idx}"
        slot_path.mkdir(parents=True, exist_ok=True)
        created.append(slot_path)
    for idx in range(1, max(0, int(codex_count)) + 1):
        slot_path = base / "codex" / f"codex-{idx}"
        slot_path.mkdir(parents=True, exist_ok=True)
        created.append(slot_path)
    return created


def write_slot_credentials(
    slot_dir: Path,
    payload: Mapping[str, Any],
    *,
    filename: str = ".identity.json",
) -> Path:
    """Write slot identity/credential metadata into ``slot_dir`` via ``pool_mode.write_credential_file``.

    Guarded by ``pool_mode.require_pool_access(ACTION_CREDENTIAL_WRITE)``: refused in ``shipped``
    mode so buyer builds never write multi-account pool credentials.
    """
    target_dir = Path(slot_dir)
    target_file = target_dir / filename
    serialized = json.dumps(dict(payload), ensure_ascii=False, indent=2) + "\n"
    return pool_mode.write_credential_file(target_file, serialized)


def read_slot_identity_from_dir(slot_dir: Path) -> dict[str, Optional[str]]:
    """Read cached identity metadata from ``slot_dir`` (``.identity.json`` or ``auth.json``) without
    spawning an external process."""
    directory = Path(slot_dir)
    for candidate in (directory / ".identity.json", directory / ".claude.json", directory / "auth.json"):
        if not candidate.is_file():
            continue
        try:
            data = json.loads(candidate.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if isinstance(data, Mapping):
            # Support Codex auth.json structure (tokens.account_id) as well as direct email/orgId
            tokens = data.get("tokens")
            if isinstance(tokens, Mapping) and not data.get("orgId") and not data.get("org_id"):
                merged = dict(data)
                merged.setdefault("account_id", tokens.get("account_id"))
                data = merged
            ident = extract_identity(data)
            if ident.get("email") or ident.get("orgId") or ident.get("account_id"):
                return ident
    return {"email": None, "orgId": None, "org_id": None, "account_id": None, "auth_method": None}


def _journal_rejected_slot(
    slot: str,
    conflict_slot: str,
    field_name: str,
    value: str,
    *,
    conn: Optional[Any] = None,
) -> None:
    """Record a rejected duplicate slot identity in ``data.db`` events when available."""
    detail = {
        "slot": slot,
        "conflict_with": conflict_slot,
        "field": field_name,
        "value": value,
        "reason": REASON_DUPLICATE_IDENTITY,
    }
    if conn is not None:
        try:
            db.add_event(conn, db.EVENT_SLOT_IDENTITY_REJECTED, detail)
        except Exception:
            pass
        return
    try:
        own_conn = db.connect()
        try:
            db.add_event(own_conn, db.EVENT_SLOT_IDENTITY_REJECTED, detail)
        finally:
            own_conn.close()
    except Exception:
        pass


class SlotRegistry:
    """Registry of slot directories that enforces unique ``email`` and ``orgId`` across active slots
    and gates pooled slot selection through ``pool_mode``."""

    def __init__(self, *, conn: Optional[Any] = None) -> None:
        self._conn = conn
        self._slots: list[SlotRecord] = []
        self._by_name: dict[str, SlotRecord] = {}
        self._email_owners: dict[str, str] = {}
        self._org_owners: dict[str, str] = {}

    @property
    def slots(self) -> list[SlotRecord]:
        return list(self._slots)

    def accepted_slots(self) -> list[SlotRecord]:
        return [s for s in self._slots if s.accepted and s.alive]

    def rejected_slots(self) -> list[SlotRecord]:
        return [s for s in self._slots if not s.accepted]

    def get(self, slot_name: str) -> Optional[SlotRecord]:
        return self._by_name.get(str(slot_name).strip())

    def register(
        self,
        slot: Any,
        *,
        email: Optional[str] = None,
        org_id: Optional[str] = None,
        orgId: Optional[str] = None,  # noqa: N803 - matches Claude CLI JSON key
        account_id: Optional[str] = None,
        identity: Optional[Mapping[str, Any]] = None,
        track: Optional[str] = None,
        vendor: Optional[str] = None,
        billing: str = capabilities.SUBSCRIPTION,
        slot_dir: Optional[Path] = None,
        alive: bool = True,
        pooled: Optional[bool] = None,
        window_left: Any = 100.0,
        strict: bool = False,
    ) -> SlotRecord:
        """Verify a slot's identity and register it.

        If ``email`` or ``orgId`` (``org_id``) matches an already accepted alive slot:
        - marks the new slot ``accepted=False, alive=False`` with ``conflict_with`` and
          ``conflict_field``;
        - journals ``slot_identity_rejected`` in ``data.db``;
        - raises :class:`DuplicateSlotIdentityError` when ``strict=True``.
        """
        if isinstance(slot, SlotRecord):
            record = slot
        elif isinstance(slot, Mapping):
            slot_name = str(slot.get("slot") or slot.get("lane") or slot.get("name") or "").strip()
            if not slot_name:
                raise ValueError("slot mapping must contain 'slot' or 'lane'")
            ident = extract_identity(identity if identity is not None else slot)
            dir_raw = slot_dir or slot.get("slot_dir") or slot.get("config_dir") or slot.get("codex_home")
            dir_path = Path(dir_raw) if dir_raw else None
            if dir_path is not None and not ident.get("email") and not ident.get("orgId"):
                file_ident = read_slot_identity_from_dir(dir_path)
                ident = {k: ident.get(k) or file_ident.get(k) for k in ident}
            resolved_email = normalize_email(email) or ident.get("email")
            resolved_org = normalize_org_id(org_id or orgId) or ident.get("orgId")
            resolved_acc = normalize_org_id(account_id) or ident.get("account_id")
            resolved_vendor = infer_slot_vendor(slot_name, vendor or slot.get("vendor"))
            resolved_track = infer_slot_track(slot_name, track or slot.get("track"))
            resolved_pooled = is_pooled_slot(slot) if pooled is None else bool(pooled)
            record = SlotRecord(
                slot=slot_name,
                track=resolved_track,
                vendor=resolved_vendor,
                billing=str(slot.get("billing") or billing),
                slot_dir=dir_path,
                email=resolved_email,
                org_id=resolved_org,
                account_id=resolved_acc,
                auth_method=ident.get("auth_method"),
                alive=bool(slot.get("alive", alive)),
                accepted=True,
                pooled=resolved_pooled,
                window_left=slot.get("window_left", window_left),
                reason=slot.get("reason"),
            )
        else:
            slot_name = str(slot or "").strip()
            if not slot_name:
                raise ValueError("slot name must be non-empty")
            ident = extract_identity(identity)
            dir_path = Path(slot_dir) if slot_dir is not None else None
            if dir_path is not None and not ident.get("email") and not ident.get("orgId"):
                file_ident = read_slot_identity_from_dir(dir_path)
                ident = {k: ident.get(k) or file_ident.get(k) for k in ident}
            resolved_email = normalize_email(email) or ident.get("email")
            resolved_org = normalize_org_id(org_id or orgId) or ident.get("orgId")
            resolved_acc = normalize_org_id(account_id) or ident.get("account_id")
            resolved_vendor = infer_slot_vendor(slot_name, vendor)
            resolved_track = infer_slot_track(slot_name, track)
            resolved_pooled = (
                (is_pooled_slot(slot_name) or dir_path is not None)
                if pooled is None
                else bool(pooled)
            )
            record = SlotRecord(
                slot=slot_name,
                track=resolved_track,
                vendor=resolved_vendor,
                billing=billing,
                slot_dir=dir_path,
                email=resolved_email,
                org_id=resolved_org,
                account_id=resolved_acc,
                auth_method=ident.get("auth_method"),
                alive=bool(alive),
                accepted=True,
                pooled=resolved_pooled,
                window_left=window_left,
            )

        if not record.alive:
            record.accepted = False
            record.reason = record.reason or REASON_NOT_ALIVE
            self._store(record)
            return record

        # Check email collision first, then orgId collision.
        norm_email = normalize_email(record.email)
        norm_org = normalize_org_id(record.org_id)
        norm_org_key = norm_org.lower() if norm_org else None

        if norm_email and norm_email in self._email_owners:
            owner = self._email_owners[norm_email]
            if owner != record.slot:
                return self._reject_duplicate(
                    record,
                    conflict_slot=owner,
                    field_name="email",
                    value=norm_email,
                    strict=strict,
                )

        if norm_org_key and norm_org_key in self._org_owners:
            owner = self._org_owners[norm_org_key]
            if owner != record.slot:
                return self._reject_duplicate(
                    record,
                    conflict_slot=owner,
                    field_name="orgId",
                    value=norm_org or norm_org_key,
                    strict=strict,
                )

        if norm_email:
            self._email_owners[norm_email] = record.slot
        if norm_org_key:
            self._org_owners[norm_org_key] = record.slot

        self._store(record)
        return record

    def _reject_duplicate(
        self,
        record: SlotRecord,
        *,
        conflict_slot: str,
        field_name: str,
        value: str,
        strict: bool,
    ) -> SlotRecord:
        record.accepted = False
        record.alive = False
        record.conflict_with = conflict_slot
        record.conflict_field = field_name
        record.reason = f"{REASON_DUPLICATE_IDENTITY}:{field_name}:{conflict_slot}"
        self._store(record)
        _journal_rejected_slot(
            record.slot,
            conflict_slot,
            field_name,
            value,
            conn=self._conn,
        )
        if strict:
            raise DuplicateSlotIdentityError(
                record.slot,
                conflict_slot,
                field_name,
                value,
            )
        return record

    def _store(self, record: SlotRecord) -> None:
        if record.slot in self._by_name:
            idx = next(i for i, s in enumerate(self._slots) if s.slot == record.slot)
            self._slots[idx] = record
        else:
            self._slots.append(record)
        self._by_name[record.slot] = record

    def available_slots(
        self,
        *,
        track: Optional[str] = None,
        vendor: Optional[str] = None,
        include_non_pooled: bool = True,
    ) -> list[SlotRecord]:
        """Return alive, accepted slots eligible under the active ``pool_mode``.

        For every pooled slot:
        - calls ``pool_mode.require_pool_access(ACTION_POOLED_LANE, detail=slot.slot)``;
        - in ``pool_mode=shipped``, ``require_pool_access`` raises ``PoolModeRefused`` and the
          pooled slot is excluded (``0`` pooled slots returned);
        - in ``pool_mode=owner_machine``, ``require_pool_access`` succeeds and allows the slot.
        """
        result: list[SlotRecord] = []
        norm_track = infer_slot_track(track, track) if track else None
        norm_vendor = infer_slot_vendor(vendor, vendor) if vendor else None

        for slot in self._slots:
            if not (slot.accepted and slot.alive):
                continue
            if norm_track and slot.track != norm_track and slot.slot != track:
                continue
            if norm_vendor and slot.vendor != norm_vendor:
                continue
            if slot.pooled:
                try:
                    pool_mode.require_pool_access(
                        pool_mode.ACTION_POOLED_LANE,
                        slot.slot,
                    )
                except pool_mode.PoolModeRefused:
                    continue
            elif not include_non_pooled:
                continue
            result.append(slot)
        return result

    def select_slot(
        self,
        *,
        track: Optional[str] = None,
        vendor: Optional[str] = None,
        include_non_pooled: bool = True,
    ) -> Optional[SlotRecord]:
        """Select the best available slot (highest known ``window_left`` first), or ``None``.

        Under ``pool_mode=shipped``, returns ``None`` when only pooled slots exist.
        """
        candidates = self.available_slots(
            track=track,
            vendor=vendor,
            include_non_pooled=include_non_pooled,
        )
        if not candidates:
            return None

        def _sort_key(item: SlotRecord) -> tuple[int, float]:
            wl = item.window_left
            if isinstance(wl, (int, float)) and not isinstance(wl, bool):
                return (0, -float(wl))
            return (1, 0.0)

        candidates.sort(key=_sort_key)
        return candidates[0]


def verify_and_deduplicate_slots(
    slots: Iterable[Any],
    *,
    strict: bool = False,
    conn: Optional[Any] = None,
) -> list[dict[str, Any]]:
    """Verify a sequence of slot dicts/records, rejecting any second slot with a duplicate ``email``
    or ``orgId``."""
    registry = SlotRegistry(conn=conn)
    for item in slots:
        registry.register(item, strict=strict)
    return [s.to_dict() for s in registry.slots]


def select_pooled_slots(
    slots: Iterable[Any],
    *,
    track: Optional[str] = None,
    vendor: Optional[str] = None,
    strict_identity: bool = False,
) -> list[dict[str, Any]]:
    """Filter ``slots`` to accepted, alive pooled slots permitted by ``pool_mode``.

    Under ``pool_mode=shipped``, returns ``[]`` (0 pooled slots selected).
    Under ``pool_mode=owner_machine``, validates each pooled slot via
    ``pool_mode.require_pool_access`` and deduplicates by ``email`` / ``orgId``.
    """
    registry = SlotRegistry()
    for item in slots:
        registry.register(item, strict=strict_identity)
    chosen = registry.available_slots(track=track, vendor=vendor, include_non_pooled=False)
    return [s.to_dict() for s in chosen]


def discover_pool_slots(
    root: Optional[Path] = None,
    *,
    strict_identity: bool = False,
    conn: Optional[Any] = None,
) -> list[dict[str, Any]]:
    """Discover and verify pooled slots under ``root`` (default ``default_pool_root()``).

    Under ``pool_mode=shipped``, ``pool_mode.require_pool_access`` refuses pool access and ``[]`` is
    returned without probing any pooled directory.
    """
    base = Path(root) if root is not None else default_pool_root()
    try:
        pool_mode.require_pool_access(pool_mode.ACTION_POOLED_LANE, str(base))
    except pool_mode.PoolModeRefused:
        return []

    registry = SlotRegistry(conn=conn)
    for sub, cli_name, vendor_name, track_name in (
        ("cc", "claude", "anthropic", "claude-code"),
        ("codex", "codex", "openai", "codex"),
    ):
        group_dir = base / sub
        if not group_dir.is_dir():
            continue
        for slot_dir in sorted(p for p in group_dir.iterdir() if p.is_dir()):
            file_ident = read_slot_identity_from_dir(slot_dir)
            if file_ident.get("email") or file_ident.get("orgId") or file_ident.get("account_id"):
                registry.register(
                    slot_dir.name,
                    identity=file_ident,
                    track=track_name,
                    vendor=vendor_name,
                    slot_dir=slot_dir,
                    alive=True,
                    pooled=True,
                    strict=strict_identity,
                )
            else:
                exe = capabilities.resolve_cli(cli_name)
                journal: list[dict] = []
                state, fresh = capabilities._probe_slot(
                    capabilities.Slot(slot_dir.name, cli_name, slot_dir),
                    exe,
                    journal,
                )
                registry.register(
                    slot_dir.name,
                    identity=state.identity,
                    track=track_name,
                    vendor=vendor_name,
                    billing=state.billing,
                    slot_dir=slot_dir,
                    alive=state.alive,
                    pooled=True,
                    window_left=(fresh or {}).get("window_left", capabilities.UNKNOWN),
                    strict=strict_identity,
                )

    return [s.to_dict() for s in registry.available_slots(include_non_pooled=False)]
