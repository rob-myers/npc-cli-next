awaitWorld

spawn '{ npcKey: "rob" }' '{ x: 5 * 1.5, y: 6 * 1.5 + 0.2 }'

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
  "body-overlay-{front,back,left,right,top,bottom}": { prefix: "suit-0" },
  "body-{front,back,left,right,top,bottom}": { prefix: "top-skin-only" },
}}' '{ x: 0.5 * 1.5, y: 5 * 1.5 }'

spawn '{ npcKey: "bad-lt", angle: Math.PI, skin: {
  "head-{front,back,left,right,top,bottom}": { prefix: "police-0" },
  "head-overlay-{front,back,left,right,top,bottom}": { prefix: "police-0" },
  "body-overlay-{front,back,left,right,top,bottom}": { prefix: "police-0" },
  "body-{front,back,left,right,top,bottom}": { prefix: "top-skin-only" },
}}' '{ x: 1.5 * 1.5, y: 5 * 1.5 }'

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

w e.grantAccess . rob will kate suit-guy bad-lt

# write/toggle selectedNpcKey on click npc
ptags=no-pause; click | filter meta.npcKey | map --forever '({ meta, keys }, { home, w }) => {
  w.n[home.selectedNpcKey]?.showSelector(false);

  if (meta.npcKey !== home.selectedNpcKey) {
    w.n[meta.npcKey].showSelector(true);
    home.selectedNpcKey = meta.npcKey;
  } else {
    home.selectedNpcKey = undefined;
  }
}' &

# open door on click
click | map '({meta}, {w}) => {
  meta.door && w.e.toggleDoor(meta.gdKey, {})
}' &

w | map '(w, { home }) => w.e.pressMenuFilters.push(
  (meta) => meta.do === true || (home.selectedNpcKey in w.n && meta.floor === true)
)'

click --long | map --forever 'async (input, {home, w}) => {
  const npc = w.n[home.selectedNpcKey];
  if (!npc) return;
  if (input.meta.floor === true && !npc.s.doMeta) npc.look(input);
  else await npc.do(input);
}' &

# click navmesh to move selectedNpcKey
ptags=no-pause; click | filter meta.floor | map --forever '(input, { w, home }) => {
  const npc = w.n[home.selectedNpcKey];
  if (!npc) return;
  npc.s.run = input.keys?.includes("shift") ?? false;
  npc.moveTo(input).catch(() => {}); // can override
}' &

w update 'w => w.decor.showLabels = true'

setupContextMenu
ptags=no-pause; events | handleContextMenu &

ptags=no-pause; events | handleLoggerLinks & 

setupOnSlowNpc

initCamAndLights rob
