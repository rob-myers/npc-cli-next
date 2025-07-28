
import { FontAwesomeIcon, faCirclePlay } from './Icon';

import {
  faLaptop,
  faMobileAndroidAlt
} from "@fortawesome/free-solid-svg-icons";


export const LaptopIcon = () => <FontAwesomeIcon icon={faLaptop} style={{ marginRight: '4px' }}/>

export const MobileIcon = () => <FontAwesomeIcon icon={faMobileAndroidAlt} style={{ marginRight: '4px' }} />

export const PlayIcon = () => <FontAwesomeIcon icon={faCirclePlay} style={{ marginRight: '4px' }} />
