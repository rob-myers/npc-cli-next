import profile1Sh from "./profile-1.sh";
import profileAwaitWorldSh from "./profile-awaitWorld.sh";
import profileEmptySh from "./profile-empty.sh";

// 🔔 prefer kebab-case
export const profile = {
  'profile-1-sh': profile1Sh,
  'profile-awaitWorld-sh': profileAwaitWorldSh,
  'profile-empty-sh': profileEmptySh,
};

/**
 * @typedef {keyof typeof profile} ProfileKey
 */

