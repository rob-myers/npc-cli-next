source /etc/util.js.sh
source /etc/util.sh
source /etc/game.js.sh
source /etc/game_1.js.sh

awaitWorld

spawn npcKey:rob skin:soldier-0 at:'{ x: 2.5 * 1.5, y: 5 * 1.5 + 0.2 }'

spawn npcKey:will skin:scientist-0 at:'{ x: 2.5, y: 3 * 1.5 + 0.2 }'

spawn npcKey:kate skin:medic-0 at:'{ x: 5 * 1.5, y: 7 * 1.5 }'

spawn npcKey:suit skin:suit-0 at:'{ x: 0.5 * 1.5, y: 5 * 1.5 }'

spawn npcKey:rada angle:Math.PI skin:'{
  "head-{front,back,left,right,top,bottom}": { prefix: "robot-1" },
  "head-overlay-{front,back,left,right,top,bottom}": { prefix: "robot-1" },
  "body-overlay-{front,back,left,right,top,bottom}": { prefix: "robot-1" },
  "body-{front,back,left,right,top,bottom}": { prefix: "robot-1" },
  //"body-{front,back,left,right,top,bottom}": { prefix: "plain-0" },
}' at:'{ x: 1.5 * 1.5, y: 5 * 1.5 }'

w n.rob.api.showSelector true
selectedNpcKey="rob"
# torch follows rob
w n.rob.position | w floor.setTorchTarget -

# re-skin rob
# w n.rob.skin | assign '{ "head-overlay-front": { prefix: "confused" } }'
# w n.rob.skin | assign '{ "head-overlay-front": { prefix: "empty", otherPart: "body-front" } }'
# w n.rob.skin | assign '{
#   "head-{front,back,left,right,top,bottom}": { prefix: "soldier-0" },
#   // "body-{front,back,left,right,top,bottom}": { prefix: "plain-0" },
#   "head-overlay-{front,back,left,right,top,bottom}": { prefix: "soldier-0" },
#   "body-overlay-{front,back,left,right,top,bottom}": { prefix: "soldier-0" },
# }' > /dev/null
# w n.rob.applySkin

# w n.rob.tint | assign '{ "body-{front,back,left,right,top,bottom}": [0.25, 0.25, 0.25, 1] }'
# w n.rob.applyTint
# w n.rob.tint | assign '{ "head-overlay-{front,back,left,right,top,bottom}": [1, 0, 0, 1] }'
# w n.rob.resetTint

w e.grantAccess . rob will kate suit rada

# select selectedNpcKey on click npc
ptags=always; click | filter meta.npcKey | map --forever '({ meta, keys }, { home, w }) => {
  w.n[home.selectedNpcKey]?.api.showSelector(false);
  w.n[meta.npcKey].api.showSelector(true);
  home.selectedNpcKey = meta.npcKey;
}' &

# open door on click
click | map '({meta}, {w}) => {
  meta.door && w.e.toggleDoor(meta.gdKey, {})
}' &

w | map '(w, { home }) => w.e.pressMenuFilters.push(
  (meta) => home.selectedNpcKey in w.n && (meta.do === true || meta.floor === true)
)'

click --long | map --forever 'async (input, {home, w}) => {
  const npc = w.n[home.selectedNpcKey];
  if (!npc) return;
  if (input.meta.floor === true && !npc.s.doMeta) npc.api.look(input);
  else await npc.api.do(input);
}' &

# click navmesh to move selectedNpcKey
ptags=always; click | filter meta.floor | map --forever '(input, { w, home }) => {
  const npc = w.n[home.selectedNpcKey];
  if (!npc) return;
  npc.s.run = input.keys?.includes("shift") ?? false;
  npc.api.move({ to: input }).catch(() => {}); // can override
}' &

w update 'w => w.decor.showLabels = true'

setupContextMenu
ptags=always; events | handleContextMenu &

ptags=always; events | handleLoggerLinks & 

changeAngleOnKeyDown # WASD camera azimuthal angle

initCamAndLights rob
