/**
 * 장비 설명 글 → 등록 초안
 *
 * 기관 담당자가 장비 이름·모델·사양을 자유롭게 적거나 사양서 글을 붙여넣으면,
 * 등록 양식에 맞는 항목(이름, 모델, 제조사, 시험 종류, 사양)을 뽑아 미리 채웁니다.
 *
 * ※ 현재는 브라우저 안의 규칙 기반 추출입니다. 백엔드에 장비 초안 추출 AI API 가 생기면
 *   extractEquipmentDraft 를 그 호출로 바꾸면 됩니다 (반환 형태 동일).
 */
export interface DraftSpec { key: string; label: string; unit: string | null; value?: number | null; min?: number | null; max?: number | null; valueText?: string | null }
export interface EquipmentDraft {
  name: string;
  model: string;
  manufacturer: string;
  testTypes: string[];
  specs: DraftSpec[];
  description: string;
  /** 무엇을 찾아냈는지 — 화면에 '이렇게 읽었어요'로 보여줌 */
  found: string[];
}

const TYPE_WORDS: [string, RegExp][] = [
  ["THERMAL_VACUUM", /열\s*진공|thermal\s*vacuum|tvac/i],
  ["VIBRATION", /진동|가진|shaker|vibration/i],
  ["SHOCK", /충격|파이로|shock|srs/i],
  ["ACOUSTIC_NOISE", /음향|잔향|acoustic/i],
  ["EMI_EMC", /전자파|emc|emi|차폐/i],
  ["TEMPERATURE_HUMIDITY", /온습도|항온|습도/i],
];

const num = (s: string) => Number(s.replace(/,/g, ""));
const NUM = "([-+]?\\d[\\d,]*(?:\\.\\d+)?)";
const RANGE = `${NUM}\\s*(?:~|-|–|to|부터)\\s*${NUM}`;

export function extractEquipmentDraft(text: string, knownTypes: string[] = []): EquipmentDraft {
  const t = text.replace(/\s+/g, " ").trim();
  const found: string[] = [];
  const specs: DraftSpec[] = [];
  const add = (spec: DraftSpec, note: string) => { if (!specs.some((s) => s.key === spec.key)) { specs.push(spec); found.push(note); } };

  // 시험 종류
  const testTypes = TYPE_WORDS.filter(([code, re]) => re.test(t) && (!knownTypes.length || knownTypes.includes(code))).map(([code]) => code);

  // 사양
  let m = new RegExp(`(?:가진력|힘|force)[^\\d-]{0,10}${NUM}\\s*kN`, "i").exec(t) ?? new RegExp(`${NUM}\\s*kN`, "i").exec(t);
  if (m) add({ key: "max_force", label: "최대 가진력", unit: "kN", value: num(m[1]) }, `가진력 ${m[1]} kN`);
  m = new RegExp(`${RANGE}\\s*(k?Hz)`, "i").exec(t);
  if (m) {
    // "100~10kHz" 처럼 단위가 끝에만 있으면 큰 값에만 k 를 적용
    const k = /k/i.test(m[3]) ? 1000 : 1;
    const max = num(m[2]) * k;
    const min = num(m[1]) * k <= max ? num(m[1]) * k : num(m[1]);
    add({ key: "frequency_range", label: "주파수 범위", unit: "Hz", min, max }, `주파수 ${min.toLocaleString()}~${max.toLocaleString()} Hz`);
  }
  m = new RegExp(`${RANGE}\\s*(?:°C|℃|도)`, "i").exec(t);
  if (m) add({ key: "temperature_range", label: "온도 범위", unit: "℃", min: Math.min(num(m[1]), num(m[2])), max: Math.max(num(m[1]), num(m[2])) }, `온도 ${m[1]}~${m[2]} ℃`);
  m = new RegExp(`(?:시편|하중|중량|payload|적재)[^\\d]{0,10}${NUM}\\s*kg`, "i").exec(t);
  if (m) add({ key: "max_payload", label: "최대 시편 중량", unit: "kg", value: num(m[1]) }, `최대 시편 ${m[1]} kg`);
  m = new RegExp(`(?:변위|stroke|displacement)[^\\d]{0,10}${NUM}\\s*mm`, "i").exec(t);
  if (m) add({ key: "max_displacement", label: "최대 변위", unit: "mm", value: num(m[1]) }, `변위 ${m[1]} mm`);
  m = new RegExp(`(?:진공|압력|vacuum)[^\\d]{0,12}(\\d(?:\\.\\d+)?\\s*[x×]\\s*10\\s*\\^?\\s*-?\\d+|\\d(?:\\.\\d+)?e-?\\d+)\\s*(torr|pa|mbar)`, "i").exec(t);
  if (m) add({ key: "vacuum_level", label: "진공도", unit: m[2], valueText: m[1].replace(/\s+/g, "") }, `진공도 ${m[1]} ${m[2]}`);
  m = new RegExp(`(?:SRS|충격)[^\\d]{0,10}${NUM}\\s*g\\b`, "i").exec(t);
  if (m) add({ key: "srs_peak", label: "최대 SRS", unit: "g", value: num(m[1]) }, `SRS ${m[1]} g`);
  m = new RegExp(`(?:음압|SPL)[^\\d]{0,10}${NUM}\\s*dB`, "i").exec(t);
  if (m) add({ key: "spl", label: "최대 음압", unit: "dB", value: num(m[1]) }, `음압 ${m[1]} dB`);
  m = /(?:챔버|내부|테이블|크기|치수)[^\dØø]{0,8}([ØøΦ]?\s?\d[\d.,]*\s*(?:m|mm)(?:\s*[x×]\s*\d[\d.,]*\s*(?:m|mm))*)/i.exec(t);
  if (m) add({ key: "chamber_size", label: "크기", unit: null, valueText: m[1].trim() }, `크기 ${m[1].trim()}`);

  // 모델·제조사
  const model = (/(?:모델(?:명)?|model)\s*[:：]?\s*([A-Za-z0-9][A-Za-z0-9\-_/.]{2,})/i.exec(t) ?? /\b([A-Z]{2,}[-_]?\d[\w\-/.]*)\b/.exec(t))?.[1] ?? "";
  if (model) found.push(`모델 ${model}`);
  const manufacturer = (/(?:제조사|제작사|maker|manufacturer)\s*[:：]?\s*((?:\(주\)|㈜)?\s?[가-힣A-Za-z]+(?:\s?(?:\(주\)|㈜))?)/i.exec(t)?.[1]
    ?? /((?:\(주\)|㈜)\s?[가-힣A-Za-z]+|[가-힣A-Za-z]+\s?(?:\(주\)|㈜))/.exec(t)?.[1] ?? "").trim();
  if (manufacturer) found.push(`제조사 ${manufacturer}`);

  // 장비명: '장비명:' 이 있으면 그 값, 없으면 첫 구절에서 숫자·단위를 뺀 앞부분
  let name = /(?:장비명|이름|name)\s*[:：]\s*([^,\n·]{2,40})/i.exec(t)?.[1]?.trim() ?? "";
  if (!name) {
    const head = t.split(/[,\n·/(]|모델|model|제조/i)[0] ?? "";
    name = head.replace(new RegExp(`${NUM}\\s*(kN|Hz|kHz|kg|mm|℃|°C|dB|g)\\b.*`, "i"), "")
      .replace(/\s*[ØøΦ]\s?\d.*$/, "").replace(/\s*(최대|가진력|SRS|진공도|주파수|온도|음압)(\s|$).*$/i, "")
      .replace(model, "").trim().slice(0, 40);
  }
  if (name) found.unshift(`장비명 ${name}`);
  if (testTypes.length) found.push(`시험 종류 ${testTypes.length}개`);

  return { name, model, manufacturer, testTypes, specs, description: t.length > 60 ? t.slice(0, 300) : "", found };
}

/** 이미 등록된 장비 중 비슷한 것 — 같은 이름/모델이거나, 같은 시험 종류에 이름이 많이 겹치면 */
export function similarEquipment<T extends { id: number; name: string; model?: string | null; testTypes: string[]; institution?: string; institutionId?: number | null }>(
  draft: Pick<EquipmentDraft, "name" | "model" | "testTypes">, list: T[], ownOrgId?: number | null,
) {
  const words = (s: string) => new Set(s.toLowerCase().replace(/[()（）\[\]·,]/g, " ").split(/\s+/).filter((w) => w.length > 1));
  const mine = words(draft.name);
  return list
    .map((e) => {
      const sameModel = Boolean(draft.model && e.model && e.model.toLowerCase() === draft.model.toLowerCase());
      const shared = [...words(e.name)].filter((w) => mine.has(w) || [...mine].some((m) => m.includes(w) || w.includes(m))).length;
      const sameType = draft.testTypes.some((t) => e.testTypes.includes(t));
      const score = (sameModel ? 3 : 0) + (sameType ? 1 : 0) + Math.min(shared, 3) * 0.8 + (e.institutionId === ownOrgId ? 0.5 : 0);
      return { item: e, score, sameModel, own: e.institutionId === ownOrgId };
    })
    .filter((x) => x.sameModel || (x.score >= 2.2 && (x.own || x.score >= 2.6)))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
