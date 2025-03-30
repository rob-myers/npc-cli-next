awaitWorld

spawn rob '{ x: 0.5 * 1.5, y: 5 * 1.5 + 0.2 }'
spawn will '{ x: 2.5, y: 3 * 1.5 + 0.2 }'
spawn '{ npcKey: "kate", angle: -Math.PI/2 }' '{ x: 4.5 * 1.5, y: 7 * 1.5 }'

w n.rob.showSelector true
selectedNpcKey="rob"

# re-skin rob
w n.rob.skin | assign '{ "head-overlay-front": { prefix: "confused" } }'
w n.rob.skin | assign '{
  "body-front": { prefix: "test-body" },
  "body-back": { prefix: "test-body" },
  "body-left": { prefix: "test-body" },
  "body-right": { prefix: "test-body" },
  "body-top": { prefix: "test-body" },
  "body-bottom": { prefix: "test-body" },
  // "body-overlay-front": { prefix: "test-body-overlay" },
  // "body-overlay-back": { prefix: "test-body-overlay" },
  // "body-overlay-left": { prefix: "test-body-overlay" },
  // "body-overlay-right": { prefix: "test-body-overlay" },
  // "body-overlay-top": { prefix: "test-body-overlay" },
  // "body-overlay-bottom": { prefix: "test-body-overlay" },
}'
w n.rob.applySkin

# tint rob
w n.rob.tint | assign '{ "head-overlay-front": [1, 0, 0, 1] }'
w n.rob.applyTint

w e.grantNpcAccess rob .
# temp debug doors:
w e.grantNpcAccess will .

# write selectedNpcKey on click npc
ptags=no-pause; click | filter meta.npcKey | map --forever '({ meta, keys }, { home, w }) => {
  w.n[home.selectedNpcKey]?.showSelector(false);
  w.n[meta.npcKey].showSelector(true);
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

setupContextMenu
ptags=no-pause; events | handleContextMenu &

ptags=no-pause; events | handleLoggerLinks & 

setupOnSlowNpc

# force zoom in via maxDistance
# rotate to fixed angle
w update 'w => {
  w.view.controlsOpts.maxDistance = w.smallViewport ? 24 : 16;
  w.view.controls.setAzimuthalAngle(0);
}'
sleep 1
# fix rotation, fov, maxDistance
w update 'w => {
  w.view.controlsOpts.minAzimuthAngle = 0;
  w.view.controlsOpts.maxAzimuthAngle = 0;
  w.view.targetFov = w.smallViewport ? 20 : 30;
  w.view.controlsOpts.maxDistance = w.smallViewport ? 24 : 24;
}'
