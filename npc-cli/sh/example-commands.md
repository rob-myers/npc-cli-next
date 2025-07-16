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
```

# Npcs

```sh
# spawn rob at a random point on the nav mesh
spawn npcKey:rob at:$( w crowd.navMeshQuery.findRandomPoint | map randomPoint )

c=0
while true; do
  spawn npcKey:rob_$c at:$( w crowd.navMeshQuery.findRandomPoint | map randomPoint )
  c+=1
done

# move two points, pause, move two more points
tour npcKey:rob to:$( [] $( click 2 ) $( click 2 ) )
```

