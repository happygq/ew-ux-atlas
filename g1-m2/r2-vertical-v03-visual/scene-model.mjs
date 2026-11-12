export function compactScene(snapshot, knownCourts, lattice) {
  const volume = new Map(snapshot.volumeFragments.map(f => [f.id, f]));
  const currentCourts = new Map(snapshot.spaceIntents.map(intent => [intent.scopeId, intent]));
  for (const scope of currentCourts.values()) knownCourts.set(scope.scopeId, scope);
  return {
    units: snapshot.occupancy.map(({ unitId, x, z, level, buildingId, supportRole, color, generatedSupport }) =>
      ({ unitId, x, z, level, buildingId, supportRole, color, ...(generatedSupport ? { generatedSupport } : {}) })),
    courts: [...knownCourts.values()].map(({ scopeId, footprint, bottomLevel, topLevel }) => {
      const intent = currentCourts.get(scopeId);
      const plane = topLevel + 1;
      const roof = snapshot.boundaryPatches.filter(({ bounds: b }) => b.axis === 'y' && b.plane === plane &&
        footprint.some(({ x, z }) => b.u0 >= x * lattice && b.u1 <= (x + 1) * lattice &&
          b.v0 >= z * lattice && b.v1 <= (z + 1) * lattice));
      const air = snapshot.volumeFragments.filter(f =>
        f.kind.endsWith('_AIR') && footprint.some(({ x, z }) => f.gridKey === `${bottomLevel}:${x},${z}`));
      const region = snapshot.voidRegions.find(r => air.length && r.members.includes(air[0].id));
      return {
        scopeId, footprint, bottomLevel, topLevel, decisionId: intent?.decisionId ?? null,
        spaceIntent: intent?.spaceIntent ?? null, roofClosure: intent?.roofClosure ?? null,
        voidRegionId: region?.id ?? null, skyConnected: region?.airConnectedSky ?? false,
        tiles: roof.map(({ id, bounds, kind, airOpen }) => ({ id, bounds, kind, airOpen })),
      };
    }),
    supports: snapshot.support.nodes.filter(node => node.role === 'MIXED_ROOM').map(node => {
      const alternative = node.alternatives.find(a => a.id === node.selectedAlternativeId);
      return {
        unitId: node.unitId, alternativeId: alternative.id, orientation: alternative.orientation,
        patternId: alternative.patternId, sources: alternative.requiredSources,
      };
    }),
    supportChanges: snapshot.support.selectionChanges,
    openings: snapshot.openingIntents.map(intent => {
      const { kind, hostPatchId, endpoints } = intent.proposal.binding;
      return {
        intentId: intent.intentId, kind, hostPatchId, status: intent.status,
        abstractRouteAuthorized: intent.abstractRouteAuthorized, physicalPassable: intent.physicalPassable,
        endpoints: endpoints.map(endpoint => ({ ...endpoint, bounds: volume.get(endpoint.volumeId)?.bounds ?? null })),
      };
    }),
    passageIds: snapshot.passages.map(p => p.intentId),
  };
}
