# Basic Behaviour List

- Walk back and forth (two points).

```sh
# store two navigable points in a fresh array
click | filter meta.nav | take 2 &>> points

# spawn an npc at a navigable point (not a "do point")
spawn npcKey:rob at:$( click 1 )
w e.grantAccess . rob # all doors permitted

while true; do
  move npcKey:rob arriveAnim:none to:$( points/0 ) &&
  move npcKey:rob arriveAnim:none to:$( points/1 )
done
```

- Walk in a loop (n points).

```sh
# 🚧 click supports filter?
# 🚧 can send output to stderr

rm -f points
ptags=always; click | filter meta.nav | take 5 | while take 1 >> points; do 
  echo added point
done


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