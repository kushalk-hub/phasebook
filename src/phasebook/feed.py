"""Feed construction and pagination. PHB-001 lives here.

The sample baseline returns one post too many and does not hide soft-deleted
posts. Both symptoms are covered by ``tests/test_feed.py``.
"""

from __future__ import annotations

import re
from collections.abc import Iterable

from phasebook.config import DEFAULT_SETTINGS, Settings
from phasebook.errors import ValidationError
from phasebook.models import Post

_TRAILING_NUMBER = re.compile(r"(\d+)$")


def resolve_limit(limit: int, settings: Settings = DEFAULT_SETTINGS) -> int:
    """Clamp a caller-supplied page size to the configured bounds."""

    if limit <= 0:
        raise ValidationError("limit must be greater than zero")
    return min(limit, settings.feed_max_page_size)


def _sequence(post_id: str) -> int:
    """Stable tie-breaker for posts created in the same clock tick."""

    match = _TRAILING_NUMBER.search(post_id)
    return int(match.group(1)) if match else 0


def build_feed(
    posts: Iterable[Post],
    *,
    viewer_id: str | None = None,
    limit: int = DEFAULT_SETTINGS.feed_page_size,
    offset: int = 0,
    include_deleted: bool = False,
    settings: Settings = DEFAULT_SETTINGS,
) -> list[Post]:
    """Return one feed page, newest first.

    PHB-001 baseline behaviour:
      * soft-deleted posts remain visible;
      * the slice is inclusive of one extra row (``limit + 1``).
    """

    if offset < 0:
        raise ValidationError("offset must be zero or greater")
    resolved = resolve_limit(limit, settings)
    ordered = sorted(
        posts,
        key=lambda post: (post.created_at, _sequence(post.id)),
        reverse=True,
    )
    # Deliberate baseline defect: deleted posts are not filtered and the page
    # is one row too large.
    return ordered[offset : offset + resolved + 1]


def build_viewer_page(
    posts: Iterable[Post],
    *,
    viewer_id: str | None = None,
    limit: int = DEFAULT_SETTINGS.feed_page_size,
    offset: int = 0,
    settings: Settings = DEFAULT_SETTINGS,
) -> list[Post]:
    """Feed page with the viewer's like state applied.

    The function is intentionally a thin wrapper so the API layer has one
    entry point; the bug in :func:`build_feed` is still exercised.
    """

    page = build_feed(
        posts,
        viewer_id=viewer_id,
        limit=limit,
        offset=offset,
        settings=settings,
    )
    if viewer_id is None:
        return page
    return [
        Post(
            id=post.id,
            author_id=post.author_id,
            content=post.content,
            created_at=post.created_at,
            image=post.image,
            likes=post.likes,
            liked_by=set(post.liked_by),
            comments=list(post.comments),
            shares=post.shares,
            tips_cents=post.tips_cents,
            deleted=post.deleted,
            sponsored=post.sponsored,
        )
        for post in page
    ]
