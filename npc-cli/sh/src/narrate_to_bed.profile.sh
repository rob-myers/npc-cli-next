source /etc/{util,core}.sh
source /etc/{util,core,dev}.js.sh
import demoClickToMove demoNarrateToBed from demo

awaitWorld

w decor.showLabels true

spawn npc:rob at:'{x:2.5, y:3*1.5+0.2}' as:soldier-0 granted:. angle:Math.PI
look at:rob
w e.followNpc rob '{ fixAngle: false, smoothTime: 1, maxDistance: 7.5, fromBehind: false }'

permitMove=true
click '({ meta }, ct) => meta.floor && ct.home.permitMove' |
  demoClickToMove npc:rob &

demoNarrateToBed npc:rob &
