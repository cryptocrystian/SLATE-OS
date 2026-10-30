"""Stack, canon and project profiles (docs/83 §4; docs/81 §8).

Profiles are data, versioned with the worker. They replace everything the factory
hard-coded for Arxus: gate commands, protected paths, canon file names and the
`Touches:` binding syntax. A malformed profile fails at load — never mid-run.
"""
from __future__ import annotations

import re
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

PROFILES_DIR = Path(__file__).resolve().parents[2] / "profiles"
_KEY = re.compile(r"^[a-z][a-z0-9.-]{1,39}$")


class ProfileError(ValueError):
    pass


@dataclass(frozen=True)
class Gate:
    name: str
    command: str


def _gates(raw, where: str) -> tuple[Gate, ...]:
    out = []
    for g in raw or []:
        if not isinstance(g, dict) or not g.get("name") or not g.get("command"):
            raise ProfileError(f"{where}: each gate needs a name and a command")
        out.append(Gate(str(g["name"]), str(g["command"])))
    names = [g.name for g in out]
    if len(set(names)) != len(names):
        raise ProfileError(f"{where}: duplicate gate names {names}")
    return tuple(out)


@dataclass(frozen=True)
class StackProfile:
    key: str
    install_command: str
    l0_gates: tuple[Gate, ...]
    test_command: str
    protected_paths: tuple[str, ...]
    migration_gate: str | None
    sandbox_image: str


@dataclass(frozen=True)
class CanonProfile:
    key: str
    journeys: str
    acceptance: str
    decisions: str
    ontology: str
    journey_heading: str          # regex template with {id}
    acceptance_heading: str       # regex template with {id}
    touches: str                  # regex; group 1 = the Touches line
    binding_separator: str        # entities precede the first separator
    binding_token: str            # regex; group 1 = one entity name


@dataclass(frozen=True)
class ProjectOverlay:
    project_key: str
    extra_l0_gates: tuple[Gate, ...] = field(default_factory=tuple)
    source: str = "none"


def _load(kind: str, key: str, base: Path) -> dict:
    if not _KEY.match(key):
        raise ProfileError(f"invalid {kind} profile key {key!r}")
    p = base / kind / f"{key}.toml"
    if not p.is_file():
        raise ProfileError(f"unknown {kind} profile {key!r} (no {p.name})")
    data = tomllib.loads(p.read_text())
    if data.get("key") != key:
        raise ProfileError(f"{p.name}: key field {data.get('key')!r} does not match file name")
    return data


def load_stack(key: str, base: Path = PROFILES_DIR) -> StackProfile:
    d = _load("stack", key, base)
    gates = _gates(d.get("l0_gates"), f"stack/{key}")
    if not gates:
        raise ProfileError(f"stack/{key}: at least one L0 gate is required")
    for k in ("install_command", "test_command", "sandbox_image"):
        if not d.get(k):
            raise ProfileError(f"stack/{key}: {k} is required")
    protected = tuple(d.get("protected_paths") or ())
    if ".git/**" not in protected:
        raise ProfileError(f"stack/{key}: .git/** must be protected (I12)")
    return StackProfile(key, d["install_command"], gates, d["test_command"], protected,
                        d.get("migration_gate") or None, d["sandbox_image"])


def load_canon(key: str, base: Path = PROFILES_DIR) -> CanonProfile:
    d = _load("canon", key, base)
    files, pats = d.get("files") or {}, d.get("patterns") or {}
    try:
        prof = CanonProfile(
            key=key, journeys=files["journeys"], acceptance=files["acceptance"], decisions=files["decisions"],
            ontology=files["ontology"], journey_heading=pats["journey_heading"],
            acceptance_heading=pats["acceptance_heading"], touches=pats["touches"],
            binding_separator=pats["binding_separator"], binding_token=pats["binding_token"],
        )
    except KeyError as e:
        raise ProfileError(f"canon/{key}: missing {e.args[0]}") from None
    for name in ("journey_heading", "acceptance_heading"):
        if "{id}" not in getattr(prof, name):
            raise ProfileError(f"canon/{key}: {name} must contain {{id}}")
    for name in ("touches", "binding_token"):
        try:
            if re.compile(getattr(prof, name)).groups < 1:
                raise ProfileError(f"canon/{key}: {name} needs a capture group")
        except re.error as e:
            raise ProfileError(f"canon/{key}: {name} is not a valid regex ({e})") from None
    return prof


def load_overlay(project_key: str, repo: Path | None = None, base: Path = PROFILES_DIR) -> ProjectOverlay:
    """Repo-owned `buildos.toml` wins; the worker-side fallback covers projects that do not carry one yet."""
    if repo is not None and (repo / "buildos.toml").is_file():
        d = tomllib.loads((repo / "buildos.toml").read_text())
        return ProjectOverlay(project_key, _gates((d.get("gates") or {}).get("extra_l0"), "buildos.toml"), "repo")
    p = base / "project" / f"{project_key}.toml"
    if p.is_file():
        d = tomllib.loads(p.read_text())
        return ProjectOverlay(project_key, _gates((d.get("gates") or {}).get("extra_l0"), p.name), "worker")
    return ProjectOverlay(project_key)


def effective_l0(stack: StackProfile, overlay: ProjectOverlay) -> tuple[Gate, ...]:
    """Project gates run FIRST (the factory ran the gate fixtures `test:gates` before trusting any
    gate's reading), then the stack's. A project gate may not shadow a stack gate's name."""
    clash = {g.name for g in overlay.extra_l0_gates} & {g.name for g in stack.l0_gates}
    if clash:
        raise ProfileError(f"project overlay redefines stack gates {sorted(clash)}")
    return overlay.extra_l0_gates + stack.l0_gates
