# G203 — L-Valley Boundary Contract v0.1

**Research domain:** `ew/ux/l-valley-v0.1` · **Status:** Candidate, 2026-11-10. Does not revise official Authority contracts.

## Plan / surface partition

The two equal-pitch strips lie at right angles. X is the main roof ridge, Z the wing roof ridge, and Y is up. The common half-span is `s`; arms extend from `-s` to a given length L. Their plan footprint is the union of a main strip `x∈[-s,Lx], z∈[-s,s]` and a wing strip `z∈[-s,Lz], x∈[-s,s]`.

Inside the shared corner square `[-s,s]×[-s,s]`, cut each roof **before** geometry generation at the diagonal `x=z`. The main roof owns `x≥z`, the wing owns `z≥x`. A shared edge—not coincident roof triangles—is the only overlap. The exact same analytical surface height `roofY(d)` evaluated with main `d=z` and wing `d=x` yields equal positions all along `x=z`. The diagonal is a *convex hip* for `-s≤x=z≤0`, and a *concave drainage valley* for `0≤x=z≤s`. Two untrimmed crossing rectangular roofs are forbidden.

## Slate tile trimming / ridges

Repeated barrel tiles are sampled on one deterministic world/ridge-axis station rhythm. Actual triangles (not only a shader mask) are clipped to a 0.17 m signed planar separation from the diagonal. A 0.148 m half-width V-shaped metal flashing overlays the NE valley. The SW segment uses a separate raised slate hip roll. Two ridge rolls meet at the single high junction. Flashing and edge trims deliberately cover the exposed cut ends; they are not assumed to seal or support the underlying building in a formal physics sense.

## Geometric drainage

- `valley(0) = [0, roofY(0), 0]` at the ridge junction; `valley(s) = [s, roofY(s), s]` at the inner courtyard.
- `roofY(0)-roofY(s) = 0.968 m` under current parameters; descent is strictly monotonic at sampled stations.
- Plan run is `sqrt(2)*s` and the nominal fall ratio is approximately 0.442.
- A decorative spout proceeds beyond `x>s, z>s` and below the roof valley tip. No hydraulic flow, ponding simulation, obstruction or code-compliance assertion.

## Negative checks / acceptance gates

The automated test suite verifies: shared vertex coordinates, two disjoint core domains, tile trim clearance for both arms, monotonic valley descent and outlet beyond the inner corner, SHA-256 mesh repeatability, finite vertex normals, bounded triangle counts and invalid configuration rejection. Tampered valley paths must fail.

**Still required for acceptance:** real WebGL / Safari visual inspection of the inner valley, geometry seam under orbit, any tile-edge light leaks, true miter and material quality, final house scale and actual GPU cost. Real R2.3 input and T/U/stepped roofs are separate work items.
