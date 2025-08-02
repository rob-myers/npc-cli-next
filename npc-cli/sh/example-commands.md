# Generic

```sh
# deep thought's answer textually
echo 42 >answer
answer=$( echo 42 )

# deep thought's answer numerically
expr 42 >answer
answer=$( expr 42 )
answer=$( call '() => 42')
echo 42 | map Number >answer
```

# World

```sh
# find a random point on the nav mesh
w crowd.navMeshQuery.findRandomPoint | map randomPoint
# find 5 random points on nav mesh
seq 5 | map '(_, { w }) => w.crowd.navMeshQuery.findRandomPoint().randomPoint'
# store 100 random points on nav mesh
seq 100 | map '(_, { w }) => w.crowd.navMeshQuery.findRandomPoint().randomPoint' &>> pts
```

```sh
# debug toggles
w debug.showNavMesh
w debug.showOrigNavPoly
w debug.showStaticColliders
```

```sh
w view.showEffects
w view.showEffects { darkness:1 }
w view.showEffects $( jsArg darkness:3 )
```

# Npcs

```sh
# spawn rob at a random point on the nav mesh
spawn npcKey:rob at:$( w crowd.navMeshQuery.findRandomPoint | map randomPoint )

# 🚧 make interactive
c=0
while true; do
  spawn npcKey:rob_$c at:$( w crowd.navMeshQuery.findRandomPoint | map randomPoint )
  c+=1
done

# spawn many
seq 100 | map '(_, { w }) => w.crowd.navMeshQuery.findRandomPoint().randomPoint' &>> pts
w npc.spawnMany "{ points: $( pts ) }"
# remove them
w npc.remove npc_{0..99}

# move two points, pause, move two more points
tour npcKey:rob to:$( [] $( click 2 ) $( click 2 ) )
```

```sh
act npcKey:rob at:$( click 1 )
```

```sh
# inline example
ptags+=always; click meta.floor | map --forever '(input, { w, home }) => {
  const npc = w.n[home.selectedNpcKey];
  if (!npc) return;
  npc.s.run = input.keys?.includes("shift") ?? false;
  npc.api.move({ to: input, close: 0.5 }).catch(() => {}); // can override
}' &
```

```sh
spawn npcKey:rada angle:Math.PI skin:'{
  "head-{front,back,left,right,top,bottom}": { prefix: "robot-1" },
  "head-overlay-{front,back,left,right,top,bottom}": { prefix: "robot-1" },
  "body-overlay-{front,back,left,right,top,bottom}": { prefix: "robot-1" },
  "body-{front,back,left,right,top,bottom}": { prefix: "robot-1" },
  //"body-{front,back,left,right,top,bottom}": { prefix: "plain-0" },
}' at:'{ x: 1.5 * 1.5, y: 5 * 1.5 }'

# re-skin rob
# w n.rob.skin | assign '{ "head-overlay-front": { prefix: "confused" } }'
# w n.rob.skin | assign '{ "head-overlay-front": { prefix: "empty", otherPart: "body-front" } }'
# w n.rob.skin | assign '{
#   "head-{front,back,left,right,top,bottom}": { prefix: "soldier-0" },
#   // "body-{front,back,left,right,top,bottom}": { prefix: "plain-0" },
#   "head-overlay-{front,back,left,right,top,bottom}": { prefix: "soldier-0" },
#   "body-overlay-{front,back,left,right,top,bottom}": { prefix: "soldier-0" },
# }' > /dev/null
# w n.rob.applySkin

# w n.rob.tint | assign '{ "body-{front,back,left,right,top,bottom}": [0.25, 0.25, 0.25, 1] }'
# w n.rob.applyTint
# w n.rob.tint | assign '{ "head-overlay-{front,back,left,right,top,bottom}": [1, 0, 0, 1] }'
# w n.rob.resetTint
```

```sh
w e.grantAccess . rob will kate suit rada

# only allow rob to access door whilst locked
w e.doorToAccess | assign '{ g0d11: new Set(["foo"]) }'
w e.npcToAccess.rob | map 'x => x.add("foo")'
```
