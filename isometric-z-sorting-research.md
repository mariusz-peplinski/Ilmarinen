# Isometric Z-Sorting Research

Date: 2026-03-27

## Status Note

This document is still useful background, but it describes the sorting problem from the older isometric sprite-sorting perspective.

The current active runtime in this repo uses Three.js with real 3D terrain cubes and billboard actors, so we are no longer relying on a pure PixiJS-style global sprite sorting solution. The main remaining relevance of this note is:

- actor-vs-actor ordering ideas
- local occlusion reasoning around billboards and tall scenery
- future cases involving larger props, overhangs, bridges, or more complex multi-actor overlap

In other words: treat this file as historical research and design context, not as a description of the current renderer architecture.

This note summarizes research into how isometric tile-based games tend to handle draw order for terrain, player characters, NPCs, and larger props. The original goal was to understand practical approaches used in games similar in feel to tactics-style isometric games such as *Final Fantasy Tactics Advance*, especially around multiple actors sharing the same map and occasionally overlapping tall or multi-tile scenery.

## Short version

The most common pattern is not "one perfect z-sort formula for everything."

Instead, most implementations combine:

- a fixed render order for terrain and static map tiles
- a simple actor sort key based on the actor's base or feet position
- special handling for large multi-tile or tall objects
- sometimes a more advanced dependency graph or topological sort for ambiguous overlap cases

For characters alone, sorting by the tile they occupy, or by their projected foot/base position, is usually enough.

For large props, walls, bridges, overhangs, or objects spanning multiple tiles, simple `x + y` style sorting stops being reliable.

## Research process

I attempted to use the built-in web search tool first, but it failed during this session. The tool eventually returned:

`503 Service Unavailable`

Because of that, I switched to direct fetches of primary or at least technically detailed sources using browser and `curl` fallbacks. Most of the useful material came from:

- GameDev Stack Exchange discussions
- Unity documentation
- a technical writeup from Mazebert
- an Envato Tuts+ tutorial focused on isometric depth sorting
- the Godot isometric demo README

## Main findings

## 1. Characters are usually sorted by their base, feet, or occupied tile

The most common practical rule for actors is:

- do not sort by the sprite rectangle
- do not sort by the top of the sprite
- sort by the actor's contact point with the ground

In isometric coordinates, that usually means some variant of:

- `x + y` for flat movement
- `x + y + z` if height matters
- projected foot `screenY`

This is the same family of rule commonly described as "sort by the feet."

Why this works:

- the actor's sprite may be tall, but its gameplay footprint is small
- a character usually occupies one cell, even if the art extends upward
- the feet/base point represents where the actor touches the world, which is what determines whether they are in front of or behind another actor on the ground plane

This matches the common look of tactics and RPG units: the sprite art is tall, but the sort anchor is effectively at the feet.

Source:

- https://gamedev.stackexchange.com/questions/8151/how-do-i-sort-isometric-sprites-into-the-correct-order
- https://stackprinter.appspot.com/export?question=8151&service=gamedev.stackexchange&language=en&width=700&hideAnswers=false&showAll=true&format=TEXT

Useful idea from that thread:

- treating the game as fundamentally 3D internally and then projecting to 2D simplifies the mental model
- simple `x + y + z` style nearness keys work for many actor-sized objects

## 2. Static terrain is often rendered in fixed map order

For terrain and floor tiles, engines often rely on a predetermined order rather than dynamic pairwise comparisons.

Typical approaches:

- render rows back-to-front
- render diagonals back-to-front
- render by tile layer and row/column order
- use an engine-provided transparency sort axis for isometric tilemaps

This works because:

- the tile grid structure already encodes a usable ordering
- static ground tiles are regular and predictable
- terrain does not usually need per-frame overlap reasoning

Unity's official docs reflect this kind of approach for isometric tilemaps. In particular, Unity recommends a custom transparency sort axis for "Isometric Z as Y" tilemaps.

Source:

- https://docs.unity3d.com/6000.0/Documentation/Manual/tilemaps/work-with-tilemaps/isometric-tilemaps/renderer/sort-sprites-custom-sorting-axis.html

Relevant Unity guidance:

- set tilemap renderer mode to `Individual`
- use `Transparency Sort Mode = Custom Axis`
- use a custom sort axis instead of relying on default 2D sort behavior

This is a strong sign that even mainstream engine workflows treat isometric sorting as "sort along a chosen world axis," not "sort every sprite rectangle naively."

## 3. Multi-tile and tall props are the real problem

The difficult cases are not usually actor-vs-actor.

The difficult cases are:

- walls
- beds
- diagonal structures
- wide props occupying multiple tiles
- bridges, stairs, overhangs
- tall scenery that can partially cover units depending on position

Once an object spans multiple tiles, a single scalar depth key often becomes insufficient.

Example problem:

- a bed occupies `1x2` tiles as one image
- a character walks near one end of it
- depending on where the character stands, part of the bed should be in front and part behind
- a single sprite origin or single `zIndex` for the whole bed cannot always represent that correctly

That exact issue shows up in GameDev Stack Exchange discussions about multi-tile isometric draw order.

Source:

- https://gamedev.stackexchange.com/questions/103442/how-do-i-determine-the-draw-order-of-isometric-2d-objects-occupying-multiple-til
- https://stackprinter.appspot.com/export?question=103442&service=gamedev.stackexchange&language=en&width=700&hideAnswers=false&showAll=true&format=TEXT

The main takeaways from those discussions are:

- one-tile actors are easy
- multi-tile props break simple sort rules
- practical fixes are either:
  - splitting large art into smaller parts
  - using bounds-aware comparisons between objects

## 4. A robust solution uses object bounds and topological sorting

The most technically complete source I found was the Mazebert article.

Source:

- https://mazebert.com/forum/news/isometric-depth-sorting--id775/

That article starts with the straightforward method:

- project world coordinates to screen coordinates
- assign a simple depth like `isoX + isoY`
- sort objects by that depth

It notes that this works for static scenes and for objects that only "jump" tile-to-tile, but starts failing when moving objects overlap in more complex ways.

The article then presents the more robust method:

- give every sprite a 3D axis-aligned bounding box in isometric world space
- compare visible objects pairwise
- determine "A is behind B" relationships
- build a dependency graph
- run a topological sort to get a valid draw order

Why this matters:

- it handles objects with width, depth, and height
- it can preserve correct ordering with semi-transparent sprites
- it avoids relying on GPU depth buffering alone, which can be awkward with alpha-blended sprites

The tradeoff:

- naive graph construction is `O(n^2)`
- you need per-object bounds, not just position
- it is more expensive and more complex than simple feet sorting

This is the clearest answer to "what do you do when simple actor sorting stops being enough?"

Answer: at that point you stop pretending the world is just a list of points and start sorting object volumes.

## 5. Another common workaround is splitting big sprites into smaller sortable pieces

Several sources point to this as the most practical content-authoring solution.

Instead of one giant wall sprite:

- split it into tile-sized wall sections
- give each section its own sort anchor
- let the normal tile/feet sorting work on those smaller chunks

This is often easier than implementing full graph sorting, especially when:

- the world is mostly static
- level art is grid-aligned
- assets can be authored or re-authored with sorting in mind

This approach shows up in the GameDev discussions and is especially appealing for tactics-style maps because the environment is usually highly grid-structured already.

Source:

- https://stackprinter.appspot.com/export?question=103442&service=gamedev.stackexchange&language=en&width=700&hideAnswers=false&showAll=true&format=TEXT

This does not solve every case, but it reduces the number of cases that need special logic.

## 6. Some systems solve only the "local problem block"

Another useful intermediate technique came from the Envato Tuts+ article on moving platforms.

Source:

- https://code.tutsplus.com/isometric-depth-sorting-for-moving-platforms--cms-30226t

The article focuses on cases where a mostly static isometric scene contains a moving tile or moving platform. Instead of globally recomputing a complex sort for the entire scene, it identifies the local region whose order is broken by the moving element and changes sort strategy only inside that block.

Important idea:

- most of the map can remain in simple row-first or column-first order
- only the local ambiguous region needs special handling

This is a good design pattern if:

- most of your scene is static
- only a few entities move
- the number of problematic overlaps is small and structured

It is not as general as full topological sorting, but can be much cheaper and simpler.

## 7. Godot's official isometric demo also reinforces the "sort by base" idea

Source:

- https://raw.githubusercontent.com/godotengine/godot-demo-projects/master/2d/isometric/README.md

That demo describes a traditional isometric view in which:

- the player moves around the level
- the player collides using shapes placed at the base of walls, doors, and pillars
- the player is occluded correctly when standing in front of or behind objects

The interesting part is that collision and occlusion are both framed around the base of the objects rather than the full sprite rectangle.

That lines up with the broader pattern from other sources:

- gameplay footprint and sort footprint are usually anchored at the bottom/base
- tall art extending upward is mostly visual, not the primary sort primitive

## What this suggests for tactics-style games like Final Fantasy Tactics Advance

I did not find an authoritative technical postmortem or engine document describing the exact sorting implementation used in *Final Fantasy Tactics Advance*. Because of that, the following is inference, not a sourced claim about that game's actual engine.

Based on the observed look of tactics games and the sources above, the likely approach is:

### Terrain

- terrain is mostly pre-ordered by tile/layer
- height levels are discrete
- the world is highly grid-constrained

### Units

- units are effectively 1-tile actors
- they are sorted by occupied cell, foot point, or an equivalent depth key
- their tall sprite art does not define sort order directly

### Large scenery

- large scenery is either:
  - authored in smaller pieces
  - kept in places where overlap ambiguity is limited
  - or handled with special-case rules

### Why this works for tactics games

- movement is tile-based, not freeform continuous wandering everywhere
- unit footprints are small and discrete
- camera and map geometry are constrained
- level authors can avoid pathological overlap situations

That means tactics games can usually get away with much simpler actor sorting than a free-roaming isometric action game with bridges, moving platforms, projectiles, and huge composite props.

## Practical taxonomy of sorting strategies

From simplest to most robust:

### Strategy A: sort everything by one scalar key

Examples:

- `screenY`
- `tileX + tileY`
- `tileX + tileY + z`

Good for:

- small actors
- basic tile maps
- prototypes

Weakness:

- breaks on multi-tile props and complicated overlaps

### Strategy B: sort actors by feet/base, render terrain statically

Good for:

- tactics games
- RPGs with mostly small actors
- many classic isometric scenes

Weakness:

- still weak for large scenery and overhangs

### Strategy C: split large objects into sortable parts

Good for:

- grid-authored environments
- walls and long props
- projects where asset authoring can adapt to the engine

Weakness:

- increases content complexity
- still not fully general

### Strategy D: use bounds-aware comparisons and topological sort

Good for:

- robust overlap correctness
- scenes with complex object sizes
- semi-transparent sprites where z-buffer tricks are awkward

Weakness:

- complexity
- performance cost
- implementation overhead

### Strategy E: hybrid approaches

Good for:

- real games

Typical hybrid:

- static terrain order
- feet sorting for actors
- split large props where convenient
- topological sort only for ambiguous visible objects

This hybrid model is the pattern that seems most realistic in production.

## Recommendations for an isometric PixiJS game prototype

If the game has:

- player character
- multiple NPCs
- tile-based movement
- mostly regular walls and props

then the best next step is probably:

1. Sort actors by their feet/base position, not by sprite top.
2. Keep terrain in fixed tile render order.
3. Anchor every actor to a clear ground-contact point.
4. Treat tall sprite art as visual extension above the sort anchor.
5. Split problematic multi-tile props into smaller render pieces when possible.
6. Only consider topological sorting if you start seeing persistent overlap failures that cannot be solved by asset partitioning or local rules.

If the game later adds:

- bridges
- overhangs
- moving platforms
- tall objects with semi-transparent edges
- lots of large mobile objects

then it becomes worth considering per-object bounds and dependency sorting.

## Most useful source notes

### GameDev Stack Exchange: general isometric sorting

https://gamedev.stackexchange.com/questions/8151/how-do-i-sort-isometric-sprites-into-the-correct-order

Why it mattered:

- clearly distinguishes simple point-based sorting from harder overlap cases
- includes the common `x + y + z` style reasoning
- comments and answers point toward the limits of naive sorting

### Mazebert: Isometric depth sorting

https://mazebert.com/forum/news/isometric-depth-sorting--id775/

Why it mattered:

- strongest technical explanation of where simple sorting fails
- directly discusses moving units and overlap glitches
- presents AABB + dependency graph + topological sort as a robust solution

### Unity docs: custom sorting axis

https://docs.unity3d.com/6000.0/Documentation/Manual/tilemaps/work-with-tilemaps/isometric-tilemaps/renderer/sort-sprites-custom-sorting-axis.html

Why it mattered:

- shows that a mainstream engine treats isometric sorting as axis-driven and configuration-sensitive
- reinforces that sorting is tied to world orientation, not just literal 2D sprite bounds

### GameDev Stack Exchange: multi-tile objects

https://gamedev.stackexchange.com/questions/103442/how-do-i-determine-the-draw-order-of-isometric-2d-objects-occupying-multiple-til

Why it mattered:

- directly addresses the "bed/wall spanning multiple tiles" problem
- gives practical alternatives: rectangular reasoning, splitting, different anchors

### Envato Tuts+: moving platforms

https://code.tutsplus.com/isometric-depth-sorting-for-moving-platforms--cms-30226t

Why it mattered:

- useful middle ground between naive sorting and full graph sorting
- focuses on fixing local ambiguity instead of globally overcomplicating the scene

### Godot isometric demo README

https://raw.githubusercontent.com/godotengine/godot-demo-projects/master/2d/isometric/README.md

Why it mattered:

- confirms the practical "base collider / base occlusion" pattern in an official demo

## Final conclusion

For multiple NPCs and a player in an isometric tile game, the mainstream practical answer is:

- sort characters by their feet or occupied cell
- render tiles in a fixed map order
- avoid using the full sprite rectangle as the sort primitive

For big props and scenery, the mainstream practical answer is:

- either split them into smaller sortable chunks
- or use bounding-volume dependency sorting when correctness really matters

So if the goal is to emulate the feel of tactics-era isometric games, the likely sweet spot is not a full scene-wide topological sort from day one. It is a hybrid:

- simple actor feet sorting
- static terrain ordering
- careful asset authoring for tall/multi-tile objects
- advanced sorting only when the simple model demonstrably fails
