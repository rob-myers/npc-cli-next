source /etc/{util,core}.sh
source /etc/{util,core,dev}.js.sh
import demoCameraWASD from demo

awaitWorld

spawn npc:rob at:'{x:6.5, y:5}' as:soldier-0 granted:. angle:Math.PI
spawn npc:will at:'{ x: 2.5, y: 3 * 1.5 + 0.2 }' as:scientist-0 granted:. angle:Math.PI
spawn npc:kate at:'{ x: 4.5 * 1.5, y: 7 * 1.5 }' as:medic-0 granted:. angle:Math.PI
spawn npc:suit at:'{ x: 0.5 * 1.5, y: 5 * 1.5 }' as:suit-0 granted:. angle:Math.PI
spawn npc:rada at:'{ x: 1.5 * 1.5, y: 5 * 1.5 }' as:robot-1 granted:. angle:Math.PI

npc rob showSelector true
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

w view.tween '{ polar: Math.PI/4 }'
look at:rob
