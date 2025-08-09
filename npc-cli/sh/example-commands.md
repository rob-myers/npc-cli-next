# Example Commands

## World

### Stories

```sh
narrate the man went to his bedroom

# 🚧
```

### Random navigable points

```sh
# get random navigable point
w crowd.navMeshQuery.findRandomPoint | map randomPoint
# get 5 random navigable points
seq 5 | map '(_, { w }) => w.crowd.navMeshQuery.findRandomPoint().randomPoint'
# store 100 random navigable points at /home/pts
seq 100 | map '(_, { w }) => w.crowd.navMeshQuery.findRandomPoint().randomPoint' &>> ~/pts
```

### Spawning

```sh
# spawn rob at click
spawn npc:rob at:$( click 1 )
# spawn rob randomly
getRandomNavigable() { w crowd.navMeshQuery.findRandomPoint | map randomPoint; }
spawn npc:rob at:$( getRandomNavigable )

# spawn 5 npcs by clicking
for x in {1..5}; do
  spawn npc:rob_$x at:$( click 1 ) skin:suit-0
done

# spawn 100 npcs randomly
seq 100 | map '(_, { w }) => w.crowd.navMeshQuery.findRandomPoint().randomPoint' &>> pts
w npc.spawnMany "{ points: $( pts ) }"
# remove them
remove npc_{0..99}
```

# Moving

```sh
move npc:rob to:$( click 1 )
```

# Doing

```sh
make npc:rob do:$( click 1 )
```

### Debug Toggles

```sh
# debug toggles
w debug.showNavMesh
w debug.showOrigNavPoly
w debug.showStaticColliders
```

### Post processing

```sh
w view.showEffects
w view.showEffects { darkness:1 }
w view.showEffects $( jsArg darkness:3 )
```


## Abstract

### Assign variable

```sh
# deep thought textually
echo 42 >answer
answer=$( echo 42 )

# deep thought numerically
expr 42 >answer
answer=$( expr 42 )
answer=$( call '() => 42')
echo 42 | map Number >answer
```

### Loops

Each command loop iteration is forced to take a minimum of 300ms.
Use JavaScript loops to avoid this restriction.
This avoids unstoppable infinite loops at the level of commands.
It also aligns command loops with human reaction speeds.

```sh
for x in $( range 5 ); do
  x
done

for x in $( seq 5 ); do
  x
done

for x in {1..5}; do
  x
done

for x in {a..h..2} {5..1}; do
  x
done


c=5; while test $c; do
  c
  c+=-1
done

localLoop() {
  local c=$1
  while test $c; do
    echo $c; c+=-1
  done
}
localLoop 10

while true; do
  echo Ctrl-C to stop...
done
```


### Process Management

```sh
ps
ps -s
ps -a
ps -a | filter --ansi /^0/
```

```sh
kill 4 --STOP
kill 4 --CONT
kill --all
```

```sh
# set process tags for next non-interactive spawn
ptags always foo=42
# view pending process tags
ptags

sleep # iteractive: ptags not applied
sleep 10 & # non-interactive: ptags applied and reset
ps -s # can see ptags
```

🚧

## Old

```sh
# inline example
ptags always
click meta.floor | map --forever '(input, { w, home }) => {
  const npc = w.n[home.selectedNpcKey];
  if (!npc) return;
  npc.s.run = input.keys?.includes("shift") ?? false;
  npc.api.move({ to: input, close: 0.5 }).catch(() => {}); // can override
}' &
```

```sh
spawn npc:rada angle:Math.PI skin:'{
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

```sh
ptags always && click meta.npcKey | map --forever '({ meta, keys }, { home, w }) => {
  w.n[home.selectedNpcKey]?.api.showSelector(false);
  w.n[meta.npcKey].api.showSelector(true);
  home.selectedNpcKey = meta.npcKey;
}' &

# click navmesh to move selectedNpcKey
ptags always && click meta.floor | map --forever '(input, { w, home }) => {
  const npc = w.n[home.selectedNpcKey];
  if (!npc) return;
  npc.s.run = input.keys?.includes("shift") ?? false;
  npc.api.move({ to: input, close: 0.5 }).catch(() => {}); // can override
}' &

click meta.door | map '({meta}, {w}) => w.e.toggleDoor(meta.gdKey)' &
```
