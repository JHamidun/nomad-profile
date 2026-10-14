"""Child processes of the Nomad layer: every one gets ``HERMES_HOME`` of the ACTIVE profile.

Зачем (задача M-090, issue #18594 апстрима). Профиль в шлюзе часто задан не переменной окружения,
а контекстным переопределением ``hermes_constants.set_hermes_home_override`` — так работают
профильная область хода (``gateway/run.py:_profile_runtime_scope``), загрузчик плагинов и диспетчер
Kanban. ``os.environ`` оно намеренно не меняет: окружение общее для всех потоков процесса. Поэтому
ребёнок, запущенный голым ``subprocess``, профиля не видит — без ``HERMES_HOME`` он берёт домашний
каталог по умолчанию, то есть профиль ``default``, и пишет туда: чужая база, чужой ``.env``. Ядро
предупреждает об этом одной строкой «[HERMES_HOME fallback] … will land in the wrong profile» — и
только когда на машине активен не-default профиль.

Правило слоя: подпроцесс запускается только через :func:`run` / :func:`popen` этого модуля (или с
окружением из :func:`child_env`). Дом берётся через адаптер ядра (``core_adapter.get_hermes_home``,
M-157) в момент вызова, в контексте вызывающего: из потока дирижёра это профиль, под которым цикл
был запущен (``conductor.Conductor.start`` копирует контекст).

``HERMES_HOME`` родительского окружения намеренно НЕ доверяется: в шлюзе там дом корневого профиля,
а ход идёт под переопределением другого. Нужен другой профиль — передать ``hermes_home=`` явно.
"""

from __future__ import annotations

import os
import subprocess
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any, Optional, Union

from . import core_adapter

ENV_NAME = "HERMES_HOME"

PathLike = Union[str, "os.PathLike[str]"]


def child_env(env: Optional[Mapping[str, str]] = None, *,
              hermes_home: Optional[PathLike] = None) -> dict[str, str]:
    """A new environment for a child: *env* (default ``os.environ``) plus the profile's HERMES_HOME.

    Ни *env*, ни ``os.environ`` не меняются — возвращается копия. Путь делается абсолютным: ребёнок
    с другим ``cwd=`` не должен искать профиль относительно своего каталога.
    """
    home = Path(hermes_home) if hermes_home is not None else core_adapter.get_hermes_home()
    result = dict(os.environ if env is None else env)
    if sys.platform == "win32":
        # Имена переменных в Windows без учёта регистра: два написания в одном блоке окружения —
        # и какое из них увидит ребёнок, не определено.
        for key in [k for k in result if k.upper() == ENV_NAME]:
            del result[key]
    result[ENV_NAME] = str(home.expanduser().absolute())
    return result


def run(args: Union[Sequence[PathLike], PathLike], *, env: Optional[Mapping[str, str]] = None,
        hermes_home: Optional[PathLike] = None, **kwargs: Any) -> subprocess.CompletedProcess:
    """``subprocess.run`` with :func:`child_env`; *env* keeps its meaning (the child's environment)."""
    return subprocess.run(args, env=child_env(env, hermes_home=hermes_home), **kwargs)


def popen(args: Union[Sequence[PathLike], PathLike], *, env: Optional[Mapping[str, str]] = None,
          hermes_home: Optional[PathLike] = None, **kwargs: Any) -> subprocess.Popen:
    """``subprocess.Popen`` with :func:`child_env`; *env* keeps its meaning (the child's environment)."""
    return subprocess.Popen(args, env=child_env(env, hermes_home=hermes_home), **kwargs)
