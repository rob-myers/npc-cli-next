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
selected="rob"

ptags always && click meta.npcKey |
  selectNpcOnClick npcKeyPath:selected &

ptags always && click meta.floor |
  moveNpcOnClick npcKeyPath:selected &

click meta.door | toggleOnDoor &

preventMenuOnActOrFloor

click --long |
  map game_1 lookActOnLong npcKeyPath:selected &

w decor.showLabels true

# 🚧
changeAngleOnKeyDown # WASD camera azimuthal angle

setupContextMenu
ptags always && events | handleContextMenu &

ptags always && events | handleLoggerLinks & 

look at:rob
zoom distance:12
