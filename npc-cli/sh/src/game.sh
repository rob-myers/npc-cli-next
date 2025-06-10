# never-ending overriding click
click! () {
  click --block
}

# Usage: gm [gmId] [selector]
# e.g. gm 0 key
# e.g. gm 0 rooms | split | map meta
gm() {
  local gmId="${1:-0}" selector="${2:-x=>x}"
  shift 2
  call '({ w }) => w.gms['$gmId']' | map "$selector" "$@"
}

# spawn() {
#   # jsArg "$@" | w npc.spawn - >/dev/null
#   # echo "$( jsArg $@ )" # 👈 does not work?
#   local jsArg=$( jsArg "$@" )
#   w npc.spawn "$jsArg" >/dev/null
# }
