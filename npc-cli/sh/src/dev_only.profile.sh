source /etc/{util,core}.sh
source /etc/{util,core,game}.js.sh
import demoCameraWASD from demo

awaitWorld

spawn npc:rob as:soldier-0 at:'{x:6.5, y:5}' granted:. angle:Math.PI
spawn npc:will as:scientist-0 at:'{ x: 2.5, y: 3 * 1.5 + 0.2 }' granted:. angle:Math.PI
spawn npc:kate as:medic-0 at:'{ x: 4.5 * 1.5, y: 7 * 1.5 }' granted:. angle:Math.PI
spawn npc:suit as:suit-0 at:'{ x: 0.5 * 1.5, y: 5 * 1.5 }' granted:. angle:Math.PI
spawn npc:rada as:robot-1 at:'{ x: 1.5 * 1.5, y: 5 * 1.5 }' granted:. angle:Math.PI

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

w view.tween '{ polar: Math.PI/4, azimuthal: Math.PI/4, distance: 20 }'
look at:rob
# zoom distance:10
