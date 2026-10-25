"""In-memory persistence used by the sample (SQL is out of scope)."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from itertools import count

from phasebook.auth import can_moderate
from phasebook.config import DEFAULT_SETTINGS, Settings
from phasebook.errors import NotFound, PermissionDenied, ValidationError
from phasebook.metrics import apply_metrics
from phasebook.models import (
    Comment,
    Deployment,
    DeploymentStatus,
    MetricPoint,
    Post,
    Role,
    ServiceName,
    ServiceState,
    User,
    utcnow,
)


class InMemoryRepository:
    """Tiny repository that keeps the sample deterministic and importable."""

    def __init__(
        self,
        *,
        settings: Settings = DEFAULT_SETTINGS,
        clock: Callable[[], datetime] = utcnow,
    ) -> None:
        self._settings = settings
        self._clock = clock
        self._users: dict[str, User] = {}
        self._posts: dict[str, Post] = {}
        self._post_seq = count(1)
        self._comment_seq = count(1)
        self._deployment_seq = count(1)
        self.services: dict[ServiceName, ServiceState] = {
            name: ServiceState(name=name) for name in ServiceName
        }
        self.deployments: list[Deployment] = []
        self.seed()

    # -- users -------------------------------------------------------------

    def seed(self) -> None:
        """Create the three demo principals used by the web app."""

        if self._users:
            return
        self.add_user("Ada Admin", role=Role.ADMIN, user_id="u-admin", verified=True)
        self.add_user("SRE Operator", role=Role.OPERATOR, user_id="u-operator", verified=True)
        self.add_user("Mia Member", role=Role.MEMBER, user_id="u-member")
        self.add_user("Noah Member", role=Role.MEMBER, user_id="u-member-2")

    def add_user(
        self,
        name: str,
        *,
        role: Role = Role.MEMBER,
        user_id: str | None = None,
        verified: bool = False,
    ) -> User:
        if not name.strip():
            raise ValidationError("User name is required")
        identifier = user_id or f"u{len(self._users) + 1}"
        if identifier in self._users:
            raise ValidationError(f"User already exists: {identifier}")
        user = User(id=identifier, name=name.strip(), role=role, verified=verified)
        self._users[user.id] = user
        return user

    def get_user(self, user_id: str) -> User:
        try:
            return self._users[user_id]
        except KeyError as exc:
            raise NotFound(f"User not found: {user_id}") from exc

    def list_users(self) -> list[User]:
        return list(self._users.values())

    # -- posts -------------------------------------------------------------

    def create_post(
        self,
        *,
        author_id: str,
        content: str,
        image: str | None = None,
        now: datetime | None = None,
    ) -> Post:
        self.get_user(author_id)
        text = content.strip()
        if not text:
            raise ValidationError("Post content is required")
        if len(text) > self._settings.max_post_length:
            raise ValidationError(
                f"Post content exceeds {self._settings.max_post_length} characters"
            )
        post = Post(
            id=f"p{next(self._post_seq)}",
            author_id=author_id,
            content=text,
            created_at=now or self._clock(),
            image=image,
        )
        self._posts[post.id] = post
        return post

    def get_post(self, post_id: str) -> Post:
        try:
            post = self._posts[post_id]
        except KeyError as exc:
            raise NotFound(f"Post not found: {post_id}") from exc
        if post.deleted:
            raise NotFound(f"Post not found: {post_id}")
        return post

    def list_posts(self) -> list[Post]:
        return list(self._posts.values())

    def add_comment(
        self,
        *,
        post_id: str,
        author_id: str,
        text: str,
        now: datetime | None = None,
    ) -> Comment:
        post = self.get_post(post_id)
        self.get_user(author_id)
        comment = Comment(
            id=f"c{next(self._comment_seq)}",
            post_id=post.id,
            author_id=author_id,
            text=text,
            created_at=now or self._clock(),
        )
        post.comments.append(comment)
        return comment

    def toggle_like(self, *, post_id: str, user_id: str) -> Post:
        post = self.get_post(post_id)
        self.get_user(user_id)
        post.liked_by.add(user_id)
        post.likes += 1
        return post

    def soft_delete_post(self, *, post_id: str, actor_id: str) -> Post:
        # ``get_post`` hides deleted rows; resolve straight from the store so
        # a repeated delete is idempotent.
        try:
            post = self._posts[post_id]
        except KeyError as exc:
            raise NotFound(f"Post not found: {post_id}") from exc
        actor = self.get_user(actor_id)
        if actor.id != post.author_id and not can_moderate(actor):
            raise PermissionDenied("Only the author or an operator can delete this post")
        post.deleted = True
        return post

    # -- platform state ----------------------------------------------------

    def get_service(self, name: ServiceName) -> ServiceState:
        try:
            return self.services[name]
        except KeyError as exc:
            raise NotFound(f"Service not found: {name.value}") from exc

    def update_service(
        self,
        name: ServiceName,
        *,
        metrics: MetricPoint | None = None,
        version: str | None = None,
        replicas: int | None = None,
        restart: bool = False,
        now: datetime | None = None,
    ) -> ServiceState:
        service = self.get_service(name)
        if metrics is not None:
            apply_metrics(service, metrics, self._settings)
        if version is not None:
            service.version = version
        if replicas is not None:
            if replicas < 0:
                raise ValidationError("replicas cannot be negative")
            service.replicas = replicas
        if restart:
            service.last_restart = now or self._clock()
        return service

    def record_deployment(
        self,
        *,
        version: str,
        commit_sha: str,
        deployed_at: datetime | None = None,
        status: DeploymentStatus = DeploymentStatus.ACTIVE,
    ) -> Deployment:
        for existing in self.deployments:
            if existing.status is DeploymentStatus.ACTIVE:
                existing.status = DeploymentStatus.SUPERSEDED
        deployment = Deployment(
            id=f"dep-{next(self._deployment_seq):03d}",
            version=version,
            commit_sha=commit_sha,
            deployed_at=deployed_at or self._clock(),
            status=status,
        )
        self.deployments.append(deployment)
        return deployment

    def previous_deployment(self) -> Deployment | None:
        candidates = [
            item
            for item in self.deployments
            if item.status is not DeploymentStatus.ACTIVE
        ]
        return candidates[-1] if candidates else None

    def reset_platform(self) -> None:
        """Restore every service to the healthy baseline (test/demo helper)."""

        for name in ServiceName:
            self.services[name] = ServiceState(name=name)
        self.deployments.clear()
