import default_profile from "./default_profile.sh";
import profile_1 from "./profile_1.sh";
import empty_profile from "./empty_profile.sh";

export const profile = {
  default_profile,
  profile_1,
  empty_profile,
};

/**
 * @typedef {keyof typeof profile} ProfileKey
 */
