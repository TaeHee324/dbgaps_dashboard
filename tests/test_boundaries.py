"""Static boundary checks via AST — no real imports executed."""

import ast
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
WEB = ROOT / "web"


def _imports_pykrx(path: Path) -> bool:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            if any(alias.name.startswith("pykrx") for alias in node.names):
                return True
        elif isinstance(node, ast.ImportFrom):
            if node.module and node.module.startswith("pykrx"):
                return True
    return False


def _imports_src(path: Path) -> list[str]:
    """Return list of src import strings found in the file."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    found = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            if node.module and (node.module == "src" or node.module.startswith("src.")):
                found.append(node.module)
        elif isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name == "src" or alias.name.startswith("src."):
                    found.append(alias.name)
    return found


def test_pykrx_only_in_update_prices():
    candidates = [p for p in SRC.glob("*.py") if p.name != "update_prices.py"]
    for path in candidates:
        assert not _imports_pykrx(path), f"{path.name} must not import pykrx"


def test_web_does_not_import_src():
    if not WEB.exists():
        pytest.skip("web/ directory not present")
    for py_file in WEB.rglob("*.py"):
        violations = _imports_src(py_file)
        assert not violations, f"{py_file.name} imports from src: {violations}"
