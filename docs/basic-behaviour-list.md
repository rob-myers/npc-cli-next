# Basic Behaviour List

- Walk back and forth (two points).

```sh
# store two navigable points in a fresh array
click | filter meta.nav | take 2 &>> points
# equivalently:
click 2 meta.nav &>> points

# spawn npc granting full access
spawn npcKey:rob at:$( click 1 ) grant:.

# note: not much time to turn
while true; do
  move npcKey:rob arriveAnim:none to:$( points/0 ) &&
  move npcKey:rob arriveAnim:none to:$( points/1 )
done
```

- Take a tour i.e. walk to n points.

```sh
# choose 4 nav points
click 4 meta.nav &>> points
# spawn npc with full access
spawn npcKey:rob at:$( click 1 ) grant:.
# take a tour
tour npcKey:rob to:"$( points )" 
```

```js
export async function* tour(ct, opts = ct.api.parseArgsAsJs(ct.args, { to: 'array' })) {
  for (const to of opts.to) {
    yield* ct.lib.move(ct, { npcKey: opts.npcKey, to });
    await ct.api.sleep(opts.pauseMs ?? 0.8);
  }
}
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