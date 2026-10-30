"""Canon reading driven by a canon profile (docs/83 §4). Port of factory control-plane/canon.py.

The factory hard-coded Arxus's file names and syntax; here the profile supplies them,
and `arxus-v2` must reproduce the factory's bindings exactly (canon parity, docs/83 §9).
"""
from __future__ import annotations

import re
from pathlib import Path

from .profiles import CanonProfile

_STOP = (r"\n### ", r"\n## ", r"\n---")


def _block(text: str, start_pat: str, stop_pats=_STOP) -> str:
    m = re.search(start_pat, text)
    if not m:
        return ""
    rest = text[m.end():]
    ends = [e.start() for p in stop_pats if (e := re.search(p, rest))]
    end = min(ends) if ends else len(rest)
    return text[m.start():m.end() + end].strip()


class Canon:
    def __init__(self, repo: Path, profile: CanonProfile):
        self.repo, self.profile = Path(repo), profile
        self._journeys = self._read(profile.journeys)
        self._ac = self._read(profile.acceptance)

    def _read(self, rel: str) -> str:
        p = self.repo / rel
        return p.read_text() if p.is_file() else ""

    def _heading(self, template: str, jid: str) -> str:
        return template.replace("{id}", re.escape(jid))

    def journey_ids(self) -> list[str]:
        # The heading template's id slot, matched against every heading line.
        pat = self.profile.journey_heading.replace("{id}", r"([A-Z]+-[A-Z0-9]+)")
        return re.findall(pat, self._journeys)

    def journey(self, jid: str) -> str:
        return _block(self._journeys, self._heading(self.profile.journey_heading, jid))

    def acceptance(self, jid: str) -> str:
        return _block(self._ac, self._heading(self.profile.acceptance_heading, jid), stop_pats=(r"\n## ",))

    def bindings(self, jid: str) -> set[str]:
        """Entities the journey's binding line declares, before the first separator. Empty set =
        unknown scope; the scheduler must then treat the item as touching everything."""
        block = self.journey(jid)
        if not block:
            return set()
        m = re.search(self.profile.touches, block)
        if not m:
            return set()
        head = m.group(1).split(self.profile.binding_separator)[0]
        return set(re.findall(self.profile.binding_token, head))
