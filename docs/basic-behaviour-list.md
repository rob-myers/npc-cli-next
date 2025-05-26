# Basic Behaviour List

- Walk back and forth (two points).

```sh
# store two navigable points in a fresh array
click | filter meta.nav | take 2 &>> points
# equivalently:
click 2 meta.nav &>> points

# spawn npc on navmesh
spawn npcKey:rob at:$( click 1 )
w e.grantAccess . rob # all doors permitted

# note: not much time to turn
while true; do
  move npcKey:rob arriveAnim:none to:$( points/0 ) &&
  move npcKey:rob arriveAnim:none to:$( points/1 )
done
```

- Take a tour i.e. walk to n points.

```sh
# 🚧

# ptags=always; click 5 meta.nav | while take 1; do 
#   points/at'(-1)' >&2 
# done &>> points

# # 1st attempt
# c=0; while c+=1; do
#   test $( expr "$c >= 5" ) && c=0
#   move npcKey:rob arriveAnim:none to:"$( points/$c )"
# done

# (a) js
# 🚧

# (b) sh
tour npcKey:rob to:"$( click 4 )" 
```

- Go to bedroom, get into bed, say "good night", breath for a bit, start snoring.

- Many NPCs suddenly look at the same point.

- Music related e.g. move whilst music plays, stop when it stops.

- Wake up, get out of bed, drink tea, shit, shower and shave.

- Ill in bed (moaning), escorted to medical area, lies down, nurse comes to see them, starts diagnosis.


# Scratchpad

```sh
# variants on move command
move npcKey:rob to:$( click 1 )
# these do not handle suspend/resume:
w n.rob.move "{ to: $( click 1 ), arriveAnim: 'none' }"
click 1 | map 'to => ({ to, arriveAnim: "none" })' | w n.rob.move -
```