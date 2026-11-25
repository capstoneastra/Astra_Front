import { validateUser } from "./authService";
import type { User } from "./authService";
import { mutate } from "./http";
import { contractError } from "../api/errors";
import { profileErrors } from "../domain/profile";
import type { ProfileChanges } from "../domain/profile";

export const profileService = {
  async update(profile: ProfileChanges, current: User, signal?: AbortSignal) {
    if (Object.keys(profileErrors(profile)).length) throw contractError("이름과 연락처를 확인해주세요.");
    // The specification allows only these two fields; never forward account/role fields.
    const user = validateUser(await mutate<User>("PATCH", "/users/me", { name: profile.name.trim(), phone: profile.phone.trim() }, signal));
    if (user.id !== current.id || user.role !== current.role || user.organization?.id !== current.organization?.id)
      throw contractError("프로필 수정 응답의 계정·권한·소속이 기존 계정과 다릅니다.");
    return user;
  },
};
