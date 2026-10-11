# Project tooling

Not part of the website. These two scripts manage the Word pack the team uses
to write the site's content.

Both need `python-docx`:

```bash
python3 -m pip install --target ./pylibs python-docx
```

## `build-allocation-pack.py`

Regenerates `INF1781-work-allocation.docx` from `tasks.json`, which is extracted
from the orange placeholder boxes in the HTML. Run it again if the placeholders
change, so the pack and the site never drift apart.

```bash
PYTHONPATH=./pylibs python3 tools/build-allocation-pack.py
```

## `read-allocation-pack.py`

Reads a filled-in pack back and prints what each person typed, keyed by task ID
(`DM-01`, `EP-03`, …) so each answer maps to the placeholder it belongs in.

```bash
PYTHONPATH=./pylibs python3 tools/read-allocation-pack.py INF1781-work-allocation.docx -v
```

It also pulls the glossary definitions and the names table.

One caveat: each answer is found by the line that reads
`TYPE YOUR ANSWER FOR <ID> BELOW THIS LINE`. If somebody deletes or overwrites
that line, that answer will not be picked up. Type underneath it, not over it.
