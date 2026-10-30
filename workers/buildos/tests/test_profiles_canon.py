"""Profiles load and validate; arxus-v2 reproduces the factory's canon bindings (docs/83 §9.3)."""
import importlib.util
import sys
from pathlib import Path

import pytest

from buildos_worker.canon import Canon
from buildos_worker.profiles import (
    Gate, ProfileError, StackProfile, effective_l0, load_canon, load_overlay, load_stack,
)

HOME = Path.home()
ARXUS = HOME / "projects" / "arxus"
FACTORY_CANON = HOME / "factory" / "control-plane" / "canon.py"


def test_stack_and_overlay_reproduce_factory_l0_order():
    stack = load_stack("next-supabase")
    overlay = load_overlay("arxus")
    assert overlay.source == "worker"
    # factory lanes/feature.py:520-523: test:gates, check:tokens, check:composition, typecheck
    assert [g.name for g in effective_l0(stack, overlay)] == ["test:gates", "check:tokens", "check:composition", "typecheck"]
    assert ".git/**" in stack.protected_paths and "supabase/migrations/**" in stack.protected_paths


def test_repo_overlay_wins(tmp_path):
    (tmp_path / "buildos.toml").write_text('[gates]\nextra_l0 = [{ name = "lint", command = "npm run lint" }]\n')
    ov = load_overlay("arxus", repo=tmp_path)
    assert ov.source == "repo" and ov.extra_l0_gates == (Gate("lint", "npm run lint"),)


def test_overlay_may_not_shadow_stack_gates():
    stack = load_stack("next-supabase")
    from buildos_worker.profiles import ProjectOverlay
    with pytest.raises(ProfileError, match="redefines"):
        effective_l0(stack, ProjectOverlay("x", (Gate("typecheck", "true"),)))


def test_bad_profiles_fail_at_load(tmp_path):
    with pytest.raises(ProfileError, match="unknown stack profile"):
        load_stack("no-such-stack")
    with pytest.raises(ProfileError, match="invalid"):
        load_canon("../etc")
    (tmp_path / "stack").mkdir()
    (tmp_path / "stack" / "bad.toml").write_text('key = "bad"\ninstall_command="x"\ntest_command="y"\nsandbox_image="z"\nprotected_paths=[]\n[[l0_gates]]\nname="a"\ncommand="b"\n')
    with pytest.raises(ProfileError, match=r"\.git"):
        load_stack("bad", base=tmp_path)


@pytest.mark.skipif(not (ARXUS / "canon").is_dir() or not FACTORY_CANON.is_file(),
                    reason="needs the Arxus repo and the factory checkout")
def test_arxus_canon_parity_with_factory():
    spec = importlib.util.spec_from_file_location("factory_canon", FACTORY_CANON)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod  # its dataclasses resolve their module by name
    spec.loader.exec_module(mod)
    factory = mod.CanonResolver(ARXUS)
    ours = Canon(ARXUS, load_canon("arxus-v2"))
    ids = ours.journey_ids()
    assert len(ids) >= 20  # Arxus canon v2 carries 22 journeys
    for jid in ids:
        assert ours.bindings(jid) == factory.bindings(jid), jid
        assert ours.acceptance(jid) == factory.acceptance(jid), jid
