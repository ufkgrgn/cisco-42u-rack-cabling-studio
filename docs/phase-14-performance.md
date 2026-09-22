# Phase 14: browser trace and containment regressions

The benchmark can now capture Chromium timeline events only during its pan
gesture, excluding topology import and subsequent mutation/hover probes:

```powershell
$env:BENCH_TRACE = '1'
$env:BENCH_VISIBLE_ALL = '1'
npm run test:performance
Remove-Item Env:BENCH_TRACE, Env:BENCH_VISIBLE_ALL
```

`panTrace.events` reports counts, total duration, and maximum duration by event
name. These are inclusive CPU durations: nested events overlap and threads can
run concurrently. Do not add the rows together or interpret `GPUTask` as measured
GPU execution time. Tracing adds overhead; compare equivalent traced runs and
use the ordinary benchmark separately for frame cadence. The trace completion
wait has a 15-second timeout.

## Findings

Headless Edge, 1600x1000 window, 10 racks / 2,000 cables, fit-all camera:

| Experiment | Pan rAF p95 | Layerize total / count |
| --- | ---: | ---: |
| Phase 13 baseline | 25.0 ms | 2415 ms / 180 |
| Promote each rack with will-change | 25.0 ms | 2619 ms / 180 |
| Remove backdrop blur from viewport controls | 25.0 ms | 2558 ms / 180 |

Neither experiment demonstrated an improvement, so neither ships. Layerization
dominates the recorded browser work; this does not establish its underlying
cause or certify hardware GPU behavior. Fit-all also keeps all cabinets visible,
so offscreen suppression cannot improve that particular workload.

## Corrections shipped

- Paint containment now allows 76px overflow so the header, positioned 66px
  above the chassis, remains painted and hit-testable. The interaction suite
  checks the actual hit target using `elementFromPoint`, not only its rectangle.
- The rack culling signature now includes the vertical boundary for every
  distinct rack height. Previously a short cabinet could remain visible or
  hidden while a taller cabinet kept the shared vertical flag unchanged.
  Sorted height thresholds are cached at structural rebuild; pan uses a binary
  search without remeasuring the DOM. The regression probe pans a 12U cabinet
  out of view and back while a taller cabinet remains visible.

Next investigation: correlate Layerize events with the compositor layer tree
and paint chunks in a headed hardware run, including fit-all and zoomed views.
Avoid claiming an FPS gain from sub-millisecond JavaScript timings alone.
