# Basic Behaviour List

- Walk back and forth (two points).

```sh
# store two navigable points in a fresh array
click | filter meta.nav | take 2 &>> points

# spawn an npc at a navigable point, or a "do point"
spawn npcKey:rob at:$( click 1 )
w e.grantAccess . rob # all doors permitted

# 🚧 how to fix "potential ongoing computation" ?
while true; do
  w n.rob.move "{ to: $( points/0 ), arriveAnim: 'none' }" &&
  w n.rob.move "{ to: $( points/1 ), arriveAnim: 'none' }"
  # points/0 | map 'to => ({ to, arriveAnim: "none" })' | w n.rob.move - &&
  # points/1 | map 'to => ({ to, arriveAnim: "none" })' | w n.rob.move -
done
```

- Walk in a loop (n points).

- Go to bedroom, get into bed, say "good night", breath for a bit, start snoring.

- Many NPCs suddenly look at the same point.

- Music related e.g. move whilst music plays, stop when it stops.

- Wake up, get out of bed, drink tea, shit, shower and shave.

- Ill in bed (moaning), escorted to medical area, lies down, nurse comes to see them, starts diagnosis.
