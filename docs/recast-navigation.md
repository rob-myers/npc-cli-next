# Recast Navigation

### OffMeshConnection strategy

🚧

### Misc

```cpp
const float* pos = &ag->cornerVerts[(ag->ncorners-1)*3];
// find nearest poly
float nearest[3];
dtPolyRef ref = 0;
m_navquery->findNearestPoly(pos, m_agentPlacementHalfExtents, &m_filters[ag->params.queryFilterType], &ref, nearest);

// set target
dtVcopy(ag->targetPos, pos);
ag->targetRef = ref;
ag->targetReplan = false;
ag->targetState = DT_CROWDAGENT_TARGET_REQUESTING;
```
