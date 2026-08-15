import pytest

from tests import helpers


@pytest.fixture(scope="module")
def c():
    return helpers.client()
