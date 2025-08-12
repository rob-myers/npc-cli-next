source /etc/{util,game}.sh
source /etc/{util,game}.js.sh
source /etc/{game_1,demo}.js.sh

awaitWorld

spawn npc:rob skin:soldier-0 at:'{ x: 2.5 * 1.5, y: 5 * 1.5 + 0.2 }' grant:.
spawn npc:will skin:scientist-0 at:'{ x: 2.5, y: 3 * 1.5 + 0.2 }' grant:.
spawn npc:kate skin:medic-0 at:'{ x: 4.5 * 1.5, y: 7 * 1.5 }' grant:.
spawn npc:suit skin:suit-0 at:'{ x: 0.5 * 1.5, y: 5 * 1.5 }' grant:.
spawn npc:rada angle:Math.PI skin:robot-1 at:'{ x: 1.5 * 1.5, y: 5 * 1.5 }' grant:.

npc rob api.showSelector true
selected="rob"

ptags always; click meta.npcKey |
  selectNpcOnClick path:selected &

ptags always; click meta.floor |
  moveNpcOnClick path:selected &

click meta.door | toggleOnDoor &

preventMenuOnActOrFloor

click --long | lookActOnLong path:selected &

w decor.showLabels true

demoCameraWASD

setupContextMenu
ptags always; events | handleContextMenu &

ptags always; events | handleLoggerLinks & 

look at:rob
zoom distance:12
