source /etc/{util,core}.sh
source /etc/{util,core,dev}.js.sh

awaitWorld

spawn npc:rob at:'{x:6.7, y:7.5}' as:soldier-0 granted:. angle:Math.PI/2
spawn npc:will at:'{ x: 2.5, y: 3 * 1.5 + 0.2 }' as:scientist-0 granted:. angle:Math.PI
spawn npc:kate at:'{ x: 4.5 * 1.5, y: 7 * 1.5 }' as:medic-0 granted:. angle:Math.PI
spawn npc:suit at:'{ x: 0.5 * 1.5, y: 5 * 1.5 }' as:suit-0 granted:. angle:Math.PI
spawn npc:rada at:'{ x: 1.5 * 1.5, y: 5 * 1.5 }' as:robot-1 granted:. angle:Math.PI

# provide base.npcKey
createFollowUi key:base &
ui key:base set:'{ selector: true, follow: true }'

ptags always; click meta.npcKey |
  selectNpcOnClick write:base.npcKey &

ptags always; click meta.floor |
  moveNpcOnClick read:base.npcKey &

click meta.door | toggleOnDoor &

preventMenuOnActOrFloor

click --long | lookOrDoOnClick read:base.npcKey &

w decor.showLabels true

setupContextMenu
ptags always; events | handleContextMenu &

ptags always; events | handleLoggerLinks & 
