import default_profile from "./default_profile.sh";
import profile_1 from "./profile_1.sh";

export const profile = {
  default_profile,
  profile_1,
};

/**
 * @typedef {keyof typeof profile} ProfileKey
 */
