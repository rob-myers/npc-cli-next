
import {
  FontAwesomeIcon,
  faCirclePlay
} from './Icon';

import {
  faEllipsis,
  faLaptop,
  faMobileAndroidAlt,
} from "@fortawesome/free-solid-svg-icons";

export const EllipsisIcon = () => <FontAwesomeIcon icon={faEllipsis} size="sm" />

export const LaptopIcon = () => <FontAwesomeIcon icon={faLaptop} style={{ marginRight: '4px' }}/>

export const MobileIcon = () => <FontAwesomeIcon icon={faMobileAndroidAlt} style={{ marginRight: '4px' }} />

export const PlayIcon = () => <FontAwesomeIcon icon={faCirclePlay} />
