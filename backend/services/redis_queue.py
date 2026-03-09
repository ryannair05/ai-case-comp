"""
Upstash Redis queue integration for async job processing.

RULE: ALL file processing must be async through this queue.
      Never do synchronous file processing in API routes.
      A 50-page PDF can take 20+ seconds to embed — that will time out.
"""
import json
import os
import uuid

from upstash_redis import Redis

_redis: Redis | None = None


def _get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis(
            url=os.environ["UPSTASH_REDIS_REST_URL"],
            token=os.environ["UPSTASH_REDIS_REST_TOKEN"],
        )
    return _redis

QUEUE_KEY = "draftly:ingest_queue"
CACHE_PREFIX = "draftly:cache:"
DEFAULT_CACHE_TTL = 72 * 3600  # 72-hour LLM response cache (AI dependency hedge)


async def enqueue_job(job_type: str, payload: dict) -> str:
    """
    Enqueue a background job. Returns a job_id for polling.

    job_type: "ingest_pricing" | "ingest_proposal" | "ingest_brand_voice"
    payload: job-specific dict (must include customer_id)
    """
    job_id = uuid.uuid4().hex
    job = {"id": job_id, "type": job_type, "payload": payload, "status": "queued"}
    r = _get_redis()
    r.lpush(QUEUE_KEY, json.dumps(job))
    # Also store job status for polling
    r.setex(f"draftly:job:{job_id}", 3600, json.dumps(job))
    return job_id


async def get_job_status(job_id: str) -> dict | None:
    """Poll job status by ID."""
    raw = _get_redis().get(f"draftly:job:{job_id}")
    if raw:
        return json.loads(raw)
    return None


async def update_job_status(job_id: str, status: str, result: dict | None = None) -> None:
    """Update a job's status record."""
    r = _get_redis()
    raw = r.get(f"draftly:job:{job_id}")
    if raw:
        job = json.loads(raw)
        job["status"] = status
        if result:
            job["result"] = result
        r.setex(f"draftly:job:{job_id}", 3600, json.dumps(job))


async def dequeue_job() -> dict | None:
    """Pop the next job from the queue (called by the background worker)."""
    raw = _get_redis().rpop(QUEUE_KEY)
    if raw:
        return json.loads(raw)
    return None


# ---------------------------------------------------------------------------
# LLM response cache (72hr AI dependency hedge)
# ---------------------------------------------------------------------------

async def get_cache(key: str) -> str | None:
    """Retrieve a cached LLM response."""
    val = _get_redis().get(f"{CACHE_PREFIX}{key}")
    return val if isinstance(val, str) else None


async def set_cache(key: str, value: str, ttl: int = DEFAULT_CACHE_TTL) -> None:
    """Cache an LLM response for ttl seconds (default 72hrs)."""
    _get_redis().setex(f"{CACHE_PREFIX}{key}", ttl, value)


# ---------------------------------------------------------------------------
# Rate limiting (per-customer, per-endpoint)
# ---------------------------------------------------------------------------

async def check_rate_limit(customer_id: str, action: str, limit: int = 20, window: int = 3600) -> bool:
    """
    Simple sliding-window rate limiter.
    Returns True if the action is allowed, False if rate limited.
    limit: max requests per window (default 20/hr)
    """
    r = _get_redis()
    key = f"draftly:rate:{customer_id}:{action}"
    count = r.incr(key)
    if count == 1:
        r.expire(key, window)
    return count <= limit
