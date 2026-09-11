# Nexus decisions

## Repository-first compatibility

The existing Map is valuable and remains available while Nexus is introduced.
Nexus reuses its bounded evidence and dossier behavior instead of replacing it
with a second implementation.

## 2D before 3D

2D clustering, focus, expand/collapse, filtering, and evidence explanations
solve the first comprehension problem. 3D adds interaction and accessibility
cost without improving the initial system model.

## Evidence before inference

The graph must distinguish facts from analysis. Exact repository references and
GitHub fork metadata are useful baseline edges; repository-name similarity is
not evidence.

## One repository is not one service

Service grouping is a later analyzer with explicit confidence and review state.
The schema allows many services per repository and a service spanning multiple
repositories.

## Normalized graph for AI

Future AI explanations query normalized nodes, edges, and evidence summaries.
They do not scan raw repositories repeatedly for each question.
