from __future__ import annotations

import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "python"))

from transactcheck_engine import SessionEngine  # noqa: E402


@pytest.fixture
def engine() -> SessionEngine:
    return SessionEngine(ROOT / "config")

