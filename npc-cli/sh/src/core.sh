# never-ending overriding click
click! () {
  click --block
}

# Select static geomorph data
# Usage: gm [gmId] [selector]
# Examples: `gm` `gm 0 key` `gm 0 rooms | split | map meta`
gm() {
  local gmId="${1:-0}" selector="${2:-x=>x}"
  shift 2
  w gms.$gmId | map "$selector" "$@"
}

# Select/invoke npc api
# Usage: npc {npcKey} [selector]
# Examples: `npc rob`, `npc rob api.showSelector true`
npc() {
  local npcKey="${1}" selector="${2:-x=>x}"
  shift 2
  w n.$npcKey | map "$selector" "$@"
  w update # sometimes needed
}

# remove npc(s)
remove() {
  w npc.remove "$@"
}
