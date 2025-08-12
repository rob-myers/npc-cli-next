# source /etc/{util,game}.sh
# source /etc/{util,game}.js.sh
# source /etc/demo_1.js.sh
import awaitWorld spawn click from game
import map from util
import demoClickToMove from demo

awaitWorld

spawn npc:rob at:'{x:4.5,y:7.5}' \
  skin:soldier-0, grant:.

ptags always; click meta.floor |
  demoClickToMove npc:rob &
