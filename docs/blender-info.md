# Blender Experiences

## Gotchas

- 🔔 Our model has two layers e.g. head, overlay head.
  Ensure you're selecting the correct bit!

- 🔔 Selecting a face under another face.
  Use wireframe mode (shift-z)

## Edit Mode

If we duplicate quad it inherits UVs.
Fix by selecting new face(s), press U (UV options), and Reset.

## Scaling a model

- Object Mode
- Select both Mesh and Armature
- Use numerical panel (N) and drag down to for all 3 axes, enter numerical scale
- UI Object menu > Apply > Scale
  - ℹ️ assuming Mesh and Armature still both selected

## Removing unused data

FILE menu > Clean Up > Purge unused data.

## Add Face to existing UV map

*Maybe* just add the Face, turn off Sync mode, move the face in UV mode.

## Shortcuts

Can right-click on menu item and assign shortcut.

For example, Shift+E for export GLTF.
First time export you select the folder and hit Return.
Subsequent times can just Shift+E then Return.
