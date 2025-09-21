source /etc/{util,core}.sh
source /etc/{util,core}.js.sh
import demoClickToMove from demo

awaitWorld

spawn npc:rob at:'{x:4.5,y:7.5}' \
  as:soldier-0, granted:.

ptags always; click meta.floor |
  demoClickToMove npc:rob &
