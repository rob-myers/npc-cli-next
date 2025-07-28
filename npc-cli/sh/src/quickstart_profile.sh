source /etc/util.sh
source /etc/util.js.sh
source /etc/game.js.sh
source /etc/game_demo_1.js.sh

awaitWorld

# spawn rob with skeleton key
spawn npcKey:rob at:'{x:4.5,y:7.5}' grant:.

# click near nav to move
ptags+=always; click meta.floor | map game_demo_1 demoClickToMove npcKey:rob &
