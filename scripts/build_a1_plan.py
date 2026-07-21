"""Generate the clean German A1 plan (units 9-70) for Planner OS bulk import.

Intelligence layer: unit names come from the Duolingo CSV; the grammar focus for
each unit is a researched A1 progression (Goethe A1 / Netzwerk-style syllabus)
paired to that unit's communicative topic. Rules layer: 2 units/day, every day
(no days off), 30 min each at 12:00 and 17:00, starting 2026-07-21.

Output: scripts/a1_plan.json  -> feed directly to Planner OS add_dated_tasks.
"""
from __future__ import annotations

import csv
import json
import os
from datetime import date, timedelta
from pathlib import Path

# Path to the scraped Duolingo unit list (columns: cefr, global_unit, name).
# Set DUOLINGO_UNITS_CSV to point at your own copy.
CSV_PATH = Path(os.environ.get("DUOLINGO_UNITS_CSV", "data/duolingo_units.csv")).expanduser()
OUT_PATH = Path(__file__).resolve().parent / "a1_plan.json"

START = date(2026, 7, 21)
FIRST_UNIT, LAST_UNIT = 9, 70
UNITS_PER_DAY = 2
SLOTS = [("12:00", "12:30"), ("17:00", "17:30")]

# Researched A1 grammar progression, paired to each unit's communicative topic.
GRAMMAR: dict[int, str] = {
    9: "Numbers, prices & kosten",
    10: "schmecken/gefallen + dative (mir schmeckt...)",
    11: "W-questions & yes/no questions (V2 word order)",
    12: "Possessive articles (mein, dein) - nominative",
    13: "Two-way prepositions + dative for location (wo?)",
    14: "Modal verbs koennen/muessen + Mir tut ... weh",
    15: "Separable verbs (ankommen, abfliegen, einsteigen)",
    16: "Polite requests: moechte + Sie-form",
    17: "Comparative adjectives (billiger/teurer als)",
    18: "Modal verbs duerfen & sollen",
    19: "Accusative case & articles (den/einen)",
    20: "Present-for-future + time expressions (am Wochenende)",
    21: "gern / lieber / am liebsten",
    22: "Stem-changing verbs (fahren->faehrt, lesen->liest)",
    23: "Imperative (du-form)",
    24: "Dative pronouns (mir, dir) + adjectives with sein",
    25: "Prepositions of movement: nach, zu, mit + dative",
    26: "Polite Konjunktiv II: haette/wuerde gern",
    27: "Two-way prepositions with accusative (wohin?)",
    28: "Dative verbs (helfen, danken + dative)",
    29: "Perfekt with haben - regular participles (gemacht)",
    30: "Perfekt - irregular participles (gesprochen)",
    31: "Quantities: etwas/viel/wenig + accusative",
    32: "Subordinate clause with dass (verb to the end)",
    33: "Accusative prepositions (durch, um, fuer, ohne)",
    34: "Separable + reflexive verbs (aufstehen, sich anziehen)",
    35: "Possessives all persons (unser/euer/ihr) + Annas Buch",
    36: "Adjective endings after definite article (nominative)",
    37: "Directions & Sie-imperative (gehen Sie, biegen Sie ab)",
    38: "Impersonal es (es regnet, es ist kalt)",
    39: "Dative for the recipient (Ich schenke meiner Mutter...)",
    40: "es gibt + accusative; the pronoun man",
    41: "muessen + separable verbs; zuerst/dann/danach",
    42: "Ordinal numbers & dates (am dritten Mai)",
    43: "Dative + accusative together (jemandem etwas geben)",
    44: "Modal verb sollen & reported requests",
    45: "Dative prepositions with places (zu, nach, aus, bei)",
    46: "Subordinate clause with weil (causal)",
    47: "Adjective endings after indefinite article (accusative)",
    48: "Recipe imperative & sequence connectors",
    49: "Comparative with als/wie; describing people",
    50: "Reflexive verbs (sich fuehlen, sich bewegen)",
    51: "Perfekt with sein (gegangen, gefahren)",
    52: "Time prepositions (am, um, von...bis) + TeKaMoLo",
    53: "Praeteritum of sein & haben (war, hatte)",
    54: "Perfekt practice + connectors (und, dann)",
    55: "Reflexive verbs in the accusative (sich vorbereiten)",
    56: "muessen/duerfen at the doctor + dative pronouns",
    57: "weil / dass clauses for feelings",
    58: "deshalb & deswegen (word order) vs weil",
    59: "Adjective endings review (der/ein + accusative)",
    60: "Frequency adverbs & word order (oft, manchmal, nie)",
    61: "Future with werden + infinitive",
    62: "Perfekt vs Praeteritum - when to use which",
    63: "Sie-imperative for emergencies + urgency with muessen",
    64: "Reflexive with dative (sich die Haende waschen)",
    65: "Dative recipients + mehr/weniger",
    66: "Subordinate clause review (weil, dass, wenn)",
    67: "wo vs wohin review + adjective endings",
    68: "Prepositions of place + Perfekt (habe ... verloren)",
    69: "Connectors: deshalb, trotzdem + word order",
    70: "A1 wrap-up: modal particles (denn, mal, doch) & review",
}


def load_names() -> dict[int, str]:
    if not CSV_PATH.exists():
        raise SystemExit(f"Unit CSV not found at {CSV_PATH}. Set DUOLINGO_UNITS_CSV to your copy.")
    names: dict[int, str] = {}
    with CSV_PATH.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if row["cefr"] == "A1":
                names[int(row["global_unit"])] = row["name"]
    return names


def build() -> list[dict]:
    names = load_names()
    missing = [u for u in range(FIRST_UNIT, LAST_UNIT + 1) if u not in names or u not in GRAMMAR]
    if missing:
        raise SystemExit(f"Missing name/grammar for units: {missing}")

    tasks: list[dict] = []
    for index, unit in enumerate(range(FIRST_UNIT, LAST_UNIT + 1)):
        day_offset, slot_index = divmod(index, UNITS_PER_DAY)
        day = START + timedelta(days=day_offset)
        start, end = SLOTS[slot_index]
        topic, grammar = names[unit], GRAMMAR[unit]
        tasks.append({
            "date": day.isoformat(),
            "title": f"German A1 — Unit {unit}: {topic} + {grammar}",
            "estimated_minutes": 30,
            "start_time": start,
            "end_time": end,
            "hard_time": True,
            "category": "german",
            "notes": (
                f"Duolingo A1 Unit {unit} — {topic}. "
                f"Grammar focus: {grammar}. "
                "Complete the Duolingo unit, then write 3 sentences of your own using the grammar point."
            ),
        })
    return tasks


if __name__ == "__main__":
    tasks = build()
    OUT_PATH.write_text(json.dumps(tasks, ensure_ascii=False, indent=2), encoding="utf-8")
    last = tasks[-1]
    print(f"units {FIRST_UNIT}-{LAST_UNIT} -> {len(tasks)} tasks")
    print(f"first: {tasks[0]['date']} {tasks[0]['title'][:60]}")
    print(f"last:  {last['date']} {last['title'][:60]}")
    print(f"written: {OUT_PATH}")
