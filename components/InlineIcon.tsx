import type { FontAwesomeIconProps } from "@fortawesome/react-fontawesome";
import { FontAwesomeIcon } from "@/npc-cli/components/Icon";

export default function InlineIcon(props: Pick<FontAwesomeIconProps, 'icon'>) {
  return (
     <FontAwesomeIcon
      icon={props.icon}
      style={{ backgroundColor: '#000', color: '#fff', padding: '2px 4px' }}
    />
  )
}
