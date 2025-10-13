source /etc/{util,core}.sh
source /etc/{util,core,dev}.js.sh
import demoClickToMove demoNarrateToBed from demo

awaitWorld

w decor.showLabels true

spawn npc:rob at:'{x:6.5, y:5}' as:soldier-0 granted:. angle:Math.PI
spawn npc:will at:'{ x: 2.5, y: 3 * 1.5 + 0.2 }' as:scientist-0 granted:. angle:Math.PI
spawn npc:kate at:'{ x: 4.5 * 1.5, y: 7 * 1.5 }' as:medic-0 granted:. angle:Math.PI
spawn npc:suit at:'{ x: 0.5 * 1.5, y: 5 * 1.5 }' as:suit-0 granted:. angle:Math.PI
spawn npc:rada at:'{ x: 1.5 * 1.5, y: 5 * 1.5 }' as:robot-1 granted:. angle:Math.PI

# w e.followNpc rob "{ fixedAngle: true, smoothTime: 1, maxDistance: undefined, fromBehind: false }"
w view.controls.setPolarAngle Math.PI/4

permitMove=true
click '({ meta }, ct) => meta.floor && ct.home.permitMove' |
  demoClickToMove npc:rob &

demoNarrateToBed npc:rob &
