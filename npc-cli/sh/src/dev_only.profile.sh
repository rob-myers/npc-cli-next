source /etc/util.js.sh
source /etc/util.sh
source /etc/game.js.sh
source /etc/game_1.js.sh

awaitWorld

spawn npcKey:rob skin:soldier-0 at:'{ x: 2.5 * 1.5, y: 5 * 1.5 + 0.2 }' grant:.
spawn npcKey:will skin:scientist-0 at:'{ x: 2.5, y: 3 * 1.5 + 0.2 }' grant:.
spawn npcKey:kate skin:medic-0 at:'{ x: 4.5 * 1.5, y: 7 * 1.5 }' grant:.
spawn npcKey:suit skin:suit-0 at:'{ x: 0.5 * 1.5, y: 5 * 1.5 }' grant:.

spawn npcKey:rada angle:Math.PI skin:robot-1 at:'{ x: 1.5 * 1.5, y: 5 * 1.5 }' grant:.

w n.rob.api.showSelector true
selectedNpcKey="rob"


# 🚧 game_1 function using api.get to get chosen "selectedNpcKey" variable
# select selectedNpcKey on click npc
ptags always && click meta.npcKey | map --forever '({ meta, keys }, { home, w }) => {
  w.n[home.selectedNpcKey]?.api.showSelector(false);
  w.n[meta.npcKey].api.showSelector(true);
  home.selectedNpcKey = meta.npcKey;
}' &

# click navmesh to move selectedNpcKey
ptags always && click meta.floor | map --forever '(input, { w, home }) => {
  const npc = w.n[home.selectedNpcKey];
  if (!npc) return;
  npc.s.run = input.keys?.includes("shift") ?? false;
  npc.api.move({ to: input, close: 0.5 }).catch(() => {}); // can override
}' &

# open door on click
click meta.door | map '({meta}, {w}) => w.e.toggleDoor(meta.gdKey)' &

w | map '(w, { home }) => w.e.pressMenuFilters.push(
  (meta) => home.selectedNpcKey in w.n && (meta.act === true || meta.floor === true)
)'

click --long | map --forever 'async (input, {home, w}) => {
  const npc = w.n[home.selectedNpcKey];
  if (!npc) return;
  if (input.meta.floor === true && !npc.s.actMeta) npc.api.look(input);
  else await npc.api.act({ at: input });
}' &

w update 'w => w.decor.showLabels = true'

changeAngleOnKeyDown # WASD camera azimuthal angle
setupContextMenu
ptags always && events | handleContextMenu &
ptags always && events | handleLoggerLinks & 

look at:rob
zoom distance:12
