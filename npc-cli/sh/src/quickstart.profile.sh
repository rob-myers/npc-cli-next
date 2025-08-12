source /etc/{util,core}.sh
source /etc/{util,core}.js.sh
import demoClickToMove from demo

awaitWorld

spawn npc:rob at:'{x:4.5,y:7.5}' \
  skin:soldier-0, grant:.

ptags always; click meta.floor |
  demoClickToMove npc:rob &
