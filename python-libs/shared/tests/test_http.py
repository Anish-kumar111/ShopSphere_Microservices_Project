from fastapi import APIRouter, HTTPException
from fastapi.testclient import TestClient
from shopsphere_shared import Health, HttpServiceSettings, create_app

settings = HttpServiceSettings(service_name="test", port=1, app_env="test")
router = APIRouter()


@router.get("/boom")
async def boom() -> None:
    raise HTTPException(409, "Conflict")


def client(health: Health | None = None) -> TestClient:
    return TestClient(create_app(settings, health=health or Health(), routers=[router]))


def test_liveness_and_readiness() -> None:
    with client() as c:
        assert c.get("/health/live").json() == {"status": "ok"}
        assert c.get("/health/ready").status_code == 200


def test_not_ready_while_shutting_down() -> None:
    health = Health()
    health.shutting_down = True
    assert client(health).get("/health/ready").status_code == 503


async def failing_check() -> None:
    raise ConnectionError("postgres down")


def test_failed_dependency_is_not_ready() -> None:
    res = client(Health([("postgres", failing_check)])).get("/health/ready")
    assert res.status_code == 503
    assert res.json()["checks"] == {"postgres": "postgres down"}


def test_problem_details_and_request_id() -> None:
    res = client().get("/boom", headers={"x-request-id": "req-1"})
    assert res.status_code == 409
    assert res.headers["content-type"] == "application/problem+json"
    assert res.headers["x-request-id"] == "req-1"
    assert res.json()["requestId"] == "req-1"
