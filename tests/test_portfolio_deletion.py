"""Portfolio deletion harness: DB cleanup, artifact removal, orphan filtering.

테스트 전략: FastAPI TestClient(Windows asyncio 호환성 이슈) 대신
라우터 함수를 직접 호출하여 검증한다.
"""
from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
from fastapi import HTTPException
from fastapi.responses import Response


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_summary(names: list[str]) -> pd.DataFrame:
    return pd.DataFrame([
        {"portfolio_name": n, "cagr": 0.1, "mdd": -0.05, "sharpe": 1.0, "calmar": 2.0}
        for n in names
    ])


def _make_nav(rows: int = 3) -> pd.DataFrame:
    return pd.DataFrame({
        "date": [f"2024-01-0{i+1}" for i in range(rows)],
        "portfolio_value": [1_000_000 * (1 + 0.01 * i) for i in range(rows)],
        "daily_return": [0.01] * rows,
        "cumulative_return": [0.01 * i for i in range(rows)],
        "drawdown": [0.0] * rows,
    })


# ---------------------------------------------------------------------------
# 1. _delete_comparison_outputs — unit tests
# ---------------------------------------------------------------------------

def test_delete_outputs_removes_nav_file(tmp_path: Path) -> None:
    """nav CSV is deleted after _delete_comparison_outputs."""
    nav = tmp_path / "PortA_nav.csv"
    _make_nav().to_csv(nav, index=False)

    from api.routers.portfolios import _delete_comparison_outputs
    with patch("api.routers.portfolios.COMPARISON_OUTPUT", tmp_path):
        _delete_comparison_outputs("PortA")

    assert not nav.exists()


def test_delete_outputs_removes_summary_row(tmp_path: Path) -> None:
    """Deleted portfolio row is removed; other rows are preserved."""
    summary_path = tmp_path / "summary.csv"
    _make_summary(["PortA", "PortB", "PortC"]).to_csv(summary_path, index=False)

    from api.routers.portfolios import _delete_comparison_outputs
    with patch("api.routers.portfolios.COMPARISON_OUTPUT", tmp_path):
        _delete_comparison_outputs("PortB")

    result = pd.read_csv(summary_path)
    assert "PortB" not in result["portfolio_name"].values
    assert set(result["portfolio_name"]) == {"PortA", "PortC"}


def test_delete_outputs_noop_when_files_missing(tmp_path: Path) -> None:
    """No exception if the directory or files don't exist."""
    from api.routers.portfolios import _delete_comparison_outputs
    with patch("api.routers.portfolios.COMPARISON_OUTPUT", tmp_path / "nonexistent"):
        _delete_comparison_outputs("PortA")  # must not raise


def test_delete_outputs_no_change_when_name_absent_from_summary(tmp_path: Path) -> None:
    """summary.csv is left unchanged when the deleted name isn't in it."""
    summary_path = tmp_path / "summary.csv"
    _make_summary(["PortA", "PortB"]).to_csv(summary_path, index=False)
    original_mtime = summary_path.stat().st_mtime

    from api.routers.portfolios import _delete_comparison_outputs
    with patch("api.routers.portfolios.COMPARISON_OUTPUT", tmp_path):
        _delete_comparison_outputs("PortC")

    assert summary_path.stat().st_mtime == original_mtime  # file untouched


def test_delete_outputs_path_traversal_safe(tmp_path: Path) -> None:
    """Portfolio name containing path separators cannot escape comparison dir."""
    nav_outside = tmp_path.parent / "evil_nav.csv"
    nav_outside.write_text("x")  # sentinel file

    from api.routers.portfolios import _delete_comparison_outputs
    with patch("api.routers.portfolios.COMPARISON_OUTPUT", tmp_path):
        _delete_comparison_outputs("../../evil")

    # File outside comparison dir must NOT be deleted
    assert nav_outside.exists(), "Path traversal deleted a file outside comparison dir"
    nav_outside.unlink()  # cleanup


# ---------------------------------------------------------------------------
# 2. delete_portfolio route — direct function calls (no HTTP layer)
# ---------------------------------------------------------------------------

def test_delete_route_raises_404_for_unknown_portfolio() -> None:
    mock_db = MagicMock()
    mock_db.init_db.return_value = None
    mock_db.get_portfolio.return_value = None

    with patch("api.routers.portfolios.db", mock_db):
        from api.routers.portfolios import delete_portfolio
        with pytest.raises(HTTPException) as exc_info:
            delete_portfolio("NoSuchPortfolio")
        assert exc_info.value.status_code == 404


def test_delete_route_calls_db_delete(tmp_path: Path) -> None:
    mock_db = MagicMock()
    mock_db.init_db.return_value = None
    mock_db.get_portfolio.return_value = [{"code": "069500", "weight": 1.0}]
    mock_db.delete_portfolio.return_value = None

    with (
        patch("api.routers.portfolios.db", mock_db),
        patch("api.routers.portfolios.COMPARISON_OUTPUT", tmp_path),
    ):
        from api.routers.portfolios import delete_portfolio
        result = delete_portfolio("PortA")

    mock_db.delete_portfolio.assert_called_once_with("PortA")
    assert isinstance(result, Response)
    assert result.status_code == 204


def test_delete_route_cleans_nav_artifact(tmp_path: Path) -> None:
    mock_db = MagicMock()
    mock_db.init_db.return_value = None
    mock_db.get_portfolio.return_value = [{"code": "069500", "weight": 1.0}]
    mock_db.delete_portfolio.return_value = None

    nav = tmp_path / "PortA_nav.csv"
    _make_nav().to_csv(nav, index=False)

    with (
        patch("api.routers.portfolios.db", mock_db),
        patch("api.routers.portfolios.COMPARISON_OUTPUT", tmp_path),
    ):
        from api.routers.portfolios import delete_portfolio
        delete_portfolio("PortA")

    assert not nav.exists()


def test_delete_route_cleans_summary_row(tmp_path: Path) -> None:
    mock_db = MagicMock()
    mock_db.init_db.return_value = None
    mock_db.get_portfolio.return_value = [{"code": "069500", "weight": 1.0}]
    mock_db.delete_portfolio.return_value = None

    summary_path = tmp_path / "summary.csv"
    _make_summary(["PortA", "PortB"]).to_csv(summary_path, index=False)

    with (
        patch("api.routers.portfolios.db", mock_db),
        patch("api.routers.portfolios.COMPARISON_OUTPUT", tmp_path),
    ):
        from api.routers.portfolios import delete_portfolio
        delete_portfolio("PortA")

    result = pd.read_csv(summary_path)
    assert "PortA" not in result["portfolio_name"].values
    assert "PortB" in result["portfolio_name"].values


# ---------------------------------------------------------------------------
# 3. Orphan filtering — comparison endpoints (direct function calls)
# ---------------------------------------------------------------------------

def test_comparison_summary_excludes_orphan(tmp_path: Path) -> None:
    """summary.csv rows for DB-absent portfolios are filtered out."""
    comparison_dir = tmp_path / "comparison"
    comparison_dir.mkdir()
    _make_summary(["PortA", "PortB", "PortC"]).to_csv(
        comparison_dir / "summary.csv", index=False
    )

    mock_db = MagicMock()
    mock_db.init_db.return_value = None
    mock_db.list_portfolios.return_value = [{"name": "PortA"}, {"name": "PortB"}]

    with (
        patch("api.routers.dashboard.db", mock_db),
        patch("api.routers.dashboard.OUTPUT_DIR", tmp_path),
    ):
        from api.routers.dashboard import comparison_summary
        result = comparison_summary()

    names = {item["portfolio_name"] for item in result}
    assert "PortC" not in names
    assert {"PortA", "PortB"} <= names


def test_comparison_nav_excludes_orphan(tmp_path: Path) -> None:
    """nav CSVs for DB-absent portfolios are not returned."""
    comparison_dir = tmp_path / "comparison"
    comparison_dir.mkdir()
    for name in ("PortA", "PortB", "PortC"):
        _make_nav().to_csv(comparison_dir / f"{name}_nav.csv", index=False)

    mock_db = MagicMock()
    mock_db.init_db.return_value = None
    mock_db.list_portfolios.return_value = [{"name": "PortA"}, {"name": "PortB"}]

    with (
        patch("api.routers.dashboard.db", mock_db),
        patch("api.routers.dashboard.OUTPUT_DIR", tmp_path),
    ):
        from api.routers.dashboard import comparison_nav
        result = comparison_nav()

    assert "PortC" not in result
    assert "PortA" in result
    assert "PortB" in result
