# overriding click that won't terminate anytime soon
click! () {
  click $( expr Number.MAX_SAFE_INTEGER )
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
#   # jsarg "$@" | w npc.spawn - >/dev/null
#   # echo "$( jsarg $@ )" # 👈 does not work?
#   local jsArg=$( jsarg "$@" )
#   w npc.spawn "$jsArg" >/dev/null
# }
