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

