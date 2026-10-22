# Graph Report - src  (2026-10-22)

## Corpus Check
- Corpus is ~332 words - fits in a single context window. You may not need a graph.

## Summary
- 34 nodes · 44 edges · 6 communities (3 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Application initialization
- Application state types
- Unresolved module dependencies
- Event bus callbacks
- Application interface
- Timer mode declarations

## God Nodes (most connected - your core abstractions)
1. `App` - 9 edges
2. `EventBus` - 8 edges
3. `IApp` - 7 edges
4. `TimerType` - 5 edges
5. `AppState` - 3 edges
6. `INTERVAL` - 1 edges
7. `FOR_TIME` - 1 edges
8. `AMRAP` - 1 edges
9. `CLOCK` - 1 edges
10. `UserSettings` - 1 edges

## Surprising Connections (you probably didn't know these)
- `App` --references--> `EventBus`  [EXTRACTED]
  app/App.ts → services/EventBus.ts
- `App` --implements--> `IApp`  [EXTRACTED]
  app/App.ts → types/app.types.ts

## Import Cycles
- None detected.

## Communities (6 total, 3 thin omitted)

### Community 1 - "Application state types"
Cohesion: 0.29
Nodes (5): AppState, AudioSettings, ControlSettings, DisplaySettings, UserSettings

### Community 2 - "Unresolved module dependencies"
Cohesion: 0.40
Nodes (3): ref_services_statemanager, ref_timers_timerengine, ref_types_services_types

### Community 5 - "Timer mode declarations"
Cohesion: 0.40
Nodes (5): TimerType, AMRAP, CLOCK, FOR_TIME, INTERVAL

## Knowledge Gaps
- **8 isolated node(s):** `INTERVAL`, `FOR_TIME`, `AMRAP`, `CLOCK`, `UserSettings` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 20 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `App` connect `Application initialization` to `Application state types`, `Unresolved module dependencies`, `Event bus callbacks`, `Application interface`?**
  _High betweenness centrality (0.279) - this node is a cross-community bridge._
- **Why does `IApp` connect `Application interface` to `Application initialization`, `Application state types`, `Unresolved module dependencies`?**
  _High betweenness centrality (0.275) - this node is a cross-community bridge._
- **Why does `EventBus` connect `Event bus callbacks` to `Application initialization`, `Unresolved module dependencies`?**
  _High betweenness centrality (0.248) - this node is a cross-community bridge._
- **What connects `INTERVAL`, `FOR_TIME`, `AMRAP` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._

## Audit caveat

Code-only structural extraction of src (4 TypeScript files; 332 words). This graph is not evidence of implemented timer features. Diagnostic reported 1 dangling endpoint and 3 external references; confirm missing modules in the source audit. CSS and HTML were reviewed separately. LLM extraction token cost: 0; conversation/agent usage is not measured here.
