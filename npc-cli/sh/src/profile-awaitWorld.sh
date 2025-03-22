awaitWorld

# 🚧 remove everything below
# 🚧 temp while we migrate npc shaders
spawn '{ npcKey: "temp-npc", classKey: "human-0" }' '{ x: 0.5 * 1.5, y: 5 * 1.5 + 0.2 }'

w npc.updateLabels rob will kate # efficiency

spawn rob '{ x: 0.5 * 1.5, y: 5 * 1.5 + 0.2 }'
spawn will '{ x: 2.5, y: 3 * 1.5 + 0.2 }'
spawn '{ npcKey: "kate", angle: -Math.PI/2 }' '{ x: 4.5 * 1.5, y: 7 * 1.5 }'

# skin and tint
w n.temp-npc.skin | assign '{ "head-overlay-front": { prefix: "confused" } }'
w n.temp-npc.skin | assign '{
  "body-front": { prefix: "test-body" },
  "body-back": { prefix: "test-body" },
  "body-left": { prefix: "test-body" },
  "body-right": { prefix: "test-body" },
  "body-top": { prefix: "test-body" },
  "body-bottom": { prefix: "test-body" },
  "body-overlay-front": { prefix: "test-body-overlay" },
  "body-overlay-back": { prefix: "test-body-overlay" },
  "body-overlay-left": { prefix: "test-body-overlay" },
  "body-overlay-right": { prefix: "test-body-overlay" },
  "body-overlay-top": { prefix: "test-body-overlay" },
  "body-overlay-bottom": { prefix: "test-body-overlay" },
}'
w n.temp-npc.applySkin
w n.temp-npc.tint | assign '{ "head-overlay-front": [1, 0, 0, 1] }'
w n.temp-npc.applyTint

w n.temp-npc.showSelector true
selectedNpcKey="temp-npc"

w e.grantNpcAccess temp-npc .
w e.grantNpcAccess rob .
# temp debug doors:
w e.grantNpcAccess will .

# write selectedNpcKey on click npc
ptags=no-pause; click | filter meta.npcKey | map '({ meta, keys }, { home, w }) => {
  try { w.n[home.selectedNpcKey]?.showSelector(false); } catch {};
  w.n[meta.npcKey]?.showSelector(true);
  home.selectedNpcKey = meta.npcKey;
}' &

# open door on click
click | map '({meta}, {w}) => {
  meta.door && w.e.toggleDoor(meta.gdKey, {})
}' &

w | map 'w => w.e.pressMenuFilters.push(
  (meta) => meta.do === true || meta.floor === true
)'

click --long | map --forever 'async (input, {home, w}) => {
  const npc = w.n[home.selectedNpcKey];
  if (input.meta.floor === true && !npc.s.doMeta) npc.look(input);
  else await npc.do(input);
}' &

# click navmesh to move selectedNpcKey
ptags=no-pause; click | filter meta.floor | map --forever '(input, { w, home }) => {
  const npc = w.n[home.selectedNpcKey];
  npc.s.run = input.keys?.includes("shift") ?? false;
  npc.moveTo(input).catch(() => {}); // can override
}' &

w update 'w => w.decor.showLabels = true'
w update 'w => w.view.targetFov = w.smallViewport ? 20 : 20'

setupContextMenu
ptags=no-pause; events | handleContextMenu &

ptags=no-pause; events | handleLoggerLinks & 

setupOnSlowNpc
