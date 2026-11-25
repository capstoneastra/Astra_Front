export interface ProfileChanges { name: string; phone: string }
export function profileErrors(profile: ProfileChanges) {
  const errors: Partial<Record<keyof ProfileChanges, string>> = {};
  if (!profile.name.trim() || profile.name.trim().length > 100)
    errors.name = "이름을 1~100자로 입력해주세요.";
  if (profile.phone.trim() && (!/^[+\d ()-]+$/.test(profile.phone.trim()) || !/^\d{8,15}$/.test(profile.phone.replace(/\D/g, ""))))
    errors.phone = "연락처를 8~15자리 숫자로 입력해주세요. +, 공백, 괄호, -를 사용할 수 있습니다.";
  return errors;
}
