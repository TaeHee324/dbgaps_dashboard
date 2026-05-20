"""pytest 공통 픽스처."""

from pathlib import Path
import pytest
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
PORTFOLIOS = ROOT / "portfolios"


@pytest.fixture
def sample_prices():
    return pd.read_csv(DATA / "sample_prices_daily.csv", dtype={"code": str})


@pytest.fixture
def sample_etf_master():
    return pd.read_csv(DATA / "sample_etf_master.csv", dtype={"code": str})


@pytest.fixture
def sample_trades():
    return pd.read_csv(DATA / "trades.csv", dtype={"code": str})


@pytest.fixture
def base_weights_path():
    return PORTFOLIOS / "base.csv"
