awaitWorld

spawn '{ npcKey: "rob" }' '{ x: 2.5 * 1.5, y: 5 * 1.5 + 0.2 }'

spawn '{ npcKey: "will", skin: {
  "head-{front,back,left,right,top,bottom}": { prefix: "scientist-0" },
  "head-overlay-{front,back,left,right,top,bottom}": { prefix: "scientist-0" },
  "body-overlay-{front,back,left,right,top,bottom}": { prefix: "scientist-0" },
  // "body-overlay-{front,back,left,right,top,bottom}": { prefix: "empty", otherPart: "body-front" },
  "body-{front,back,left,right,top,bottom}": { prefix: "top-skin-only" },
}}' '{ x: 2.5, y: 3 * 1.5 + 0.2 }'

spawn '{ npcKey: "kate", angle: Math.PI, skin: {
  "head-{front,back,left,right,top,bottom}": { prefix: "medic-0" },
  "head-overlay-{front,back,left,right,top,bottom}": { prefix: "medic-0" },
  "body-overlay-{front,back,left,right,top,bottom}": { prefix: "medic-0" },
  "body-{front,back,left,right,top,bottom}": { prefix: "top-skin-only" },
}}' '{ x: 4.5 * 1.5, y: 7 * 1.5 }'

spawn '{ npcKey: "suit-guy", angle: Math.PI, skin: {
  "head-{front,back,left,right,top,bottom}": { prefix: "suit-0" },
  // "head-overlay-front": { prefix: "empty", otherPart: "body-front" },
  "head-overlay-{front,back,left,right,top,bottom}": { prefix: "suit-0" },
}}' '{ x: 0.5 * 1.5, y: 5 * 1.5 }'

w n.rob.showSelector true
selectedNpcKey="rob"

# re-skin rob
# w n.rob.skin | assign '{ "head-overlay-front": { prefix: "confused" } }'
# w n.rob.skin | assign '{ "head-overlay-front": { prefix: "empty", otherPart: "body-front" } }'
w n.rob.skin | assign '{
  "head-{front,back,left,right,top,bottom}": { prefix: "soldier-0" },
  // "body-{front,back,left,right,top,bottom}": { prefix: "top-skin-only" },
  "head-overlay-{front,back,left,right,top,bottom}": { prefix: "soldier-0" },
  "body-overlay-{front,back,left,right,top,bottom}": { prefix: "soldier-0" },
}' > /dev/null
w n.rob.applySkin

w n.rob.tint | assign '{ "body-{front,back,left,right,top,bottom}": [0.25, 0.25, 0.25, 1] }'
w n.rob.applyTint
# w n.rob.tint | assign '{ "head-overlay-{front,back,left,right,top,bottom}": [1, 0, 0, 1] }'
# w n.rob.resetTint

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

# transition to fixed camera angle
w update 'async w => {
  w.view.enableControls(false);
  await w.view.tween({ azimuthal: Math.PI/4, polar: Math.PI/4 });
  w.view.enableControls(true);
  await w.view.tween({ distance: 20 });
}'

# fix camera angle and reduce maxDistance
w update 'w => {
  w.view.ctrlOpts.minAzimuthAngle = 0;
  w.view.ctrlOpts.maxAzimuthAngle = Math.PI/4;
  w.view.ctrlOpts.maxPolarAngle = Math.PI/4;
  w.view.ctrlOpts.maxDistance = 30;
}'

w e.lookAt rob
