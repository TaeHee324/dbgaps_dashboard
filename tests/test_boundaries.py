"""Static boundary checks via AST — no real imports executed."""

import ast
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
API = ROOT / "api"


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


def _manipulates_sys_path(path: Path) -> bool:
    """Detect sys.path.insert/append calls — proxy for indirect src import risk."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if (
            isinstance(func, ast.Attribute)
            and func.attr in ("insert", "append")
            and isinstance(func.value, ast.Attribute)
            and func.value.attr == "path"
            and isinstance(func.value.value, ast.Name)
            and func.value.value.id == "sys"
        ):
            return True
    return False


def test_pykrx_only_in_update_prices():
    src_candidates = [p for p in SRC.glob("*.py") if p.name != "update_prices.py"]
    api_candidates = list(API.rglob("*.py")) if API.exists() else []
    for path in src_candidates + api_candidates:
        assert not _imports_pykrx(path), f"{path.name} must not import pykrx"


def test_api_does_not_import_src():
    if not API.exists():
        pytest.skip("api/ directory not present")
    exception = API / "routers" / "portfolios.py"
    for py_file in API.rglob("*.py"):
        if py_file == exception:
            continue
        violations = _imports_src(py_file)
        assert not violations, f"{py_file.name} imports from src: {violations}"
        assert not _manipulates_sys_path(py_file), (
            f"{py_file.name} manipulates sys.path (indirect src import risk)"
        )
