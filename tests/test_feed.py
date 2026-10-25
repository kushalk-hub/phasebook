"""PHB-001 regression coverage: feed visibility and page size."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from phasebook.errors import ValidationError
from phasebook.feed import build_feed, resolve_limit
from phasebook.models import Post


def _post(post_id: str, minutes: int, *, deleted: bool = False) -> Post:
    return Post(
        id=post_id,
        author_id="u-member",
        content=f"post {post_id}",
        created_at=datetime(2026, 10, 25, 12, 0, tzinfo=UTC) + timedelta(minutes=minutes),
        deleted=deleted,
    )


def test_deleted_posts_are_hidden_from_the_feed() -> None:
    posts = [_post("p1", 0), _post("p2", 1, deleted=True), _post("p3", 2)]

    page = build_feed(posts, limit=10)

    assert [post.id for post in page] == ["p3", "p1"]


def test_feed_never_exceeds_the_requested_page_size() -> None:
    posts = [_post(f"p{index}", index) for index in range(5)]

    page = build_feed(posts, limit=2)

    assert [post.id for post in page] == ["p4", "p3"]


def test_feed_orders_newest_first_and_paginates() -> None:
    posts = [_post(f"p{index}", index) for index in range(5)]

    page = build_feed(posts, limit=2, offset=1)

    assert [post.id for post in page] == ["p3", "p2"]


def test_page_size_is_capped() -> None:
    assert resolve_limit(10_000, settings=type("S", (), {"feed_max_page_size": 50})()) == 50


@pytest.mark.parametrize("limit", [0, -1])
def test_non_positive_limit_is_rejected(limit: int) -> None:
    with pytest.raises(ValidationError):
        build_feed([], limit=limit)


def test_negative_offset_is_rejected() -> None:
    with pytest.raises(ValidationError):
        build_feed([], offset=-1)
