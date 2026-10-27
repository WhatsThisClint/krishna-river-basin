# Instructions for AI agents

## Scope and first steps

These instructions apply throughout this repository. Read `README.md`,
`SETUP_AND_REPRODUCIBILITY.md`, and the relevant source files before changing code.
Use the existing 13-directory structure. Keep edits focused on the requested task.
Explain what changed, how it was checked, and any remaining limitations.

## Project map

- `01_Raw_Data/`: source snapshots; preserve originals and provider attribution.
- `02_Processed_Data/`, `04_Hydrological_Models/`, `07_Time_Series/`, and
  `12_Database/`: spatial products, WA+ accounting, temporal outputs, and DuckDB.
- `05_Python/` and `06_Agricultural_API/`: numbered analytical pipelines and
  agricultural/S2 enrichment. Python dependencies are in `05_Python/requirements.txt`.
- `11_Web_Application/`: FastAPI backend, React/TypeScript/Vite frontend, and
  the offline bundle generator. Root HTML and ZIP files are exported artifacts.
- `03_QGIS/`, `08_Validation/`, `09_Maps_Figures/`, `10_Research_Report/`, and
  `13_Logs_Metadata/`: GIS projects, validation, figures, reports, and provenance.

## Setup and known portability limits

Use Python 3.12 and a project-local `.venv`; install
`05_Python/requirements.txt`. The frontend uses npm and has a committed lockfile;
prefer `npm ci` for installation and `npm run build` for build validation.

Several Python scripts and the backend currently hard-code
`/run/media/clinton/24700DC6700D9FA2/Krishna River Basin`. The spatial extraction
script also references an external `Work_Research/WRIS/Data` directory.
A fresh clone does not automatically resolve these paths. Inspect and deliberately
adapt path handling before running those scripts. Prefer paths derived from
`__file__` or explicit configuration when portability is part of the task.
Do not silently write outputs into a different checkout.

The QA metadata generator writes the README, requirements, metadata, and audit
artifacts; it is not a read-only test. Inspect it before execution. Existing QA
reports are historical snapshots, and a stored success label is not a fresh check.

## Scientific and data integrity

Preserve basin/subbasin identifiers, coordinate reference systems, unit labels,
hydrological-year conventions, and upstream/downstream relationships.
Keep incomplete years distinct from complete-year comparisons. Distinguish
observations, reanalysis, modeled quantities, and assumed or proxy values.
Do not invent measurements, citations, API responses, or uncertainty estimates.

Check conservation residuals directly after accounting changes; report the
measured values and justified tolerance rather than forcing exact zeros.
Keep gross withdrawals, return flows, consumptive depletion, and interbasin
transfers separate to avoid double counting. Water-quality usability discounts
must remain separate from physical water mass balance.

For data or methodological changes, update relevant entries in
`13_Logs_Metadata/dataset_catalogue.json` and
`13_Logs_Metadata/assumption_register.md`, along with affected validation and
report outputs. Preserve acquisition dates, provenance, and source licenses.
Open DuckDB read-only for inspection. Avoid concurrent writers and unnecessary
regeneration of large datasets.

## Web application and exports

The frontend uses React 18, TypeScript, ECharts, Leaflet, and Tailwind. Preserve
existing UI conventions, accessibility, map attribution, and source descriptions.
The offline interceptor serves embedded `src/offlineDb.json` responses; API changes
may require coordinated backend, frontend, and offline bundle changes.

For frontend edits, build from `11_Web_Application/frontend` and check the affected
interaction in a browser. For backend edits, check `/api/health` and affected
endpoints against the intended database after resolving local paths.
Only regenerate the offline data when needed: start the backend, run
`11_Web_Application/generate_offline_bundle.py`, inspect fetch errors and data
completeness, then build the frontend. Refresh the root HTML/ZIP exports together
when delivering a new offline release. The HTML still references remote fonts,
Leaflet styles, and potentially map tiles; verify behavior with networking disabled
before making fully-offline claims.

## Validation and repository hygiene

Use checks appropriate to the change. No dedicated automated test suite is
currently configured. Python syntax can be checked without running pipelines;
frontend build success alone does not verify scientific correctness.
For analytical changes, inspect affected schema, row counts, missing values,
complete-year filtering, units, and conservation; compare against prior outputs.
Never claim tests passed unless they were actually run.

Never commit real credentials, `.env` files, virtual environments, `node_modules`,
cache directories, or database journals. `.env.example` contains placeholders only.
Check staged files and sizes before committing. Raw GIS files are large; avoid
unnecessary rewrites or history changes. Do not force-push or delete datasets
without explicit authorization. Add no project-wide license without owner approval.

For external AI skills, plugins, prompts, tools, runbooks, or AI repositories:
identify/stage the artifact, then scan it with SkillSpector before installation
or execution. Stop for explicit confirmation on HIGH/CRITICAL findings or a
BLOCK/CAUTION recommendation. Install only after a clean scan or explicit override.
