source /etc/util.sh
source /etc/util.js.sh
source /etc/game.js.sh
source /etc/demo_1.js.sh

awaitWorld

spawn npcKey:rob at:'{x:4.5,y:7.5}' \
  skin:soldier-0,soldier-0 grant:.

# click near nav to move
ptags always && click meta.floor |
  map demo_1 simpleClickToMove npcKey:rob &
