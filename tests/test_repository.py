"""PHB-005/PHB-006 regression coverage: reactions and comment invariants."""

from __future__ import annotations

import pytest

from phasebook.config import Settings
from phasebook.errors import ValidationError
from phasebook.repository import InMemoryRepository


def _repository(clock, *, max_comment_length: int = 1000) -> InMemoryRepository:
    return InMemoryRepository(
        settings=Settings(max_comment_length=max_comment_length),
        clock=clock.now,
    )


# -- PHB-005: like toggle --------------------------------------------------


def test_liking_twice_removes_the_like(clock) -> None:
    repo = _repository(clock)
    post = repo.create_post(author_id="u-member", content="hello")

    repo.toggle_like(post_id=post.id, user_id="u-member-2")
    repo.toggle_like(post_id=post.id, user_id="u-member-2")

    assert post.likes == 0
    assert post.liked_by == set()


def test_repeated_likes_from_one_user_count_once(clock) -> None:
    repo = _repository(clock)
    post = repo.create_post(author_id="u-member", content="hello")

    for _ in range(5):
        repo.toggle_like(post_id=post.id, user_id="u-member-2")

    assert post.likes == 1
    assert post.liked_by == {"u-member-2"}


def test_two_users_can_like_the_same_post(clock) -> None:
    repo = _repository(clock)
    post = repo.create_post(author_id="u-member", content="hello")

    repo.toggle_like(post_id=post.id, user_id="u-member-2")
    repo.toggle_like(post_id=post.id, user_id="u-operator")

    assert post.likes == 2
    assert post.liked_by == {"u-member-2", "u-operator"}


def test_unlike_never_makes_the_count_negative(clock) -> None:
    repo = _repository(clock)
    post = repo.create_post(author_id="u-member", content="hello")

    repo.toggle_like(post_id=post.id, user_id="u-member-2")
    repo.toggle_like(post_id=post.id, user_id="u-member-2")
    repo.toggle_like(post_id=post.id, user_id="u-member-2")
    repo.toggle_like(post_id=post.id, user_id="u-member-2")

    assert post.likes >= 0
    assert post.likes == 0


# -- PHB-006: comment invariants -------------------------------------------


def test_blank_comment_is_rejected(clock) -> None:
    repo = _repository(clock)
    post = repo.create_post(author_id="u-member", content="hello")

    with pytest.raises(ValidationError):
        repo.add_comment(post_id=post.id, author_id="u-member-2", text="   ")


def test_comment_text_is_trimmed(clock) -> None:
    repo = _repository(clock)
    post = repo.create_post(author_id="u-member", content="hello")

    comment = repo.add_comment(
        post_id=post.id,
        author_id="u-member-2",
        text="  nice post  ",
    )

    assert comment.text == "nice post"


def test_oversized_comment_is_rejected(clock) -> None:
    repo = _repository(clock, max_comment_length=10)
    post = repo.create_post(author_id="u-member", content="hello")

    with pytest.raises(ValidationError):
        repo.add_comment(
            post_id=post.id,
            author_id="u-member-2",
            text="x" * 11,
        )


def test_comment_at_the_limit_is_accepted(clock) -> None:
    repo = _repository(clock, max_comment_length=10)
    post = repo.create_post(author_id="u-member", content="hello")

    comment = repo.add_comment(
        post_id=post.id,
        author_id="u-member-2",
        text="x" * 10,
    )

    assert comment.text == "x" * 10
