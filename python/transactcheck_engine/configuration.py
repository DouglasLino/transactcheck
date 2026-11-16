from __future__ import annotations

import json
from pathlib import Path
from typing import Any


CONFIG_FILES = (
    "field_aliases.json",
    "status_mappings.json",
    "currency_aliases.json",
    "date_formats.json",
    "detection_rules.json",
)


def load_configuration(config_dir: str | Path) -> dict[str, Any]:
    base = Path(config_dir)
    configuration: dict[str, Any] = {}
    for filename in CONFIG_FILES:
        with (base / filename).open(encoding="utf-8") as handle:
            configuration[filename.removesuffix(".json")] = json.load(handle)
    return configuration

