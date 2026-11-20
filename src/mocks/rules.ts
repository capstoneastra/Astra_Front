// Development-only, deterministic interpretation and rule comparison. No AI call.
const units = {
  Hz: ["frequency", 1],
  kHz: ["frequency", 1e3],
  MHz: ["frequency", 1e6],
  GHz: ["frequency", 1e9],
  kg: ["mass", 1],
  g: ["mass", 0.001],
  mm: ["length", 1],
  cm: ["length", 10],
  m: ["length", 1000],
  um: ["length", 0.001],
  µm: ["length", 0.001],
  N: ["force", 1],
  kN: ["force", 1000],
  kgf: ["force", 9.80665],
  V: ["voltage", 1],
  kV: ["voltage", 1000],
  mV: ["voltage", 0.001],
  A: ["current", 1],
  mA: ["current", 0.001],
};
export function convertUnit(value, from, to) {
  if (value == null || !Number.isFinite(value)) return null;
  if (from === to) return value;
  const a = units[from],
    b = units[to];
  return a && b && a[0] === b[0] ? (value * a[1]) / b[1] : null;
}
export const conditionText = (c) =>
  !c || c.status === "MISSING"
    ? "미확인"
    : `${c.value ?? (c.min != null && c.max != null ? `${c.min}~${c.max}` : (c.valueText ?? "미확인"))} ${c.unit ?? ""}`.trim();

export function interpretText(text, testTypes, rules, defaultType?: string) {
  const lower = text.toLowerCase();
  let types = testTypes.filter((type) =>
    [type.code, type.name_ko, ...type.keywords].some((word) =>
      lower.includes(word.toLowerCase()),
    ),
  );
  const explicit = types.filter(
    (t) =>
      lower.includes(t.code.toLowerCase()) ||
      lower.includes(t.name_ko.toLowerCase()) ||
      (t.code === "VIBRATION" && /진동|가진/.test(text)),
  );
  if (explicit.length) types = explicit;
  const type =
    types.find((t) => t.code === defaultType) ??
    types[0] ??
    testTypes.find((t) => t.code === defaultType);
  const selectedRules = rules.filter((r) => r.test_type_code === type?.code);
  const conditions = selectedRules.map((rule) => {
    const c = {
      key: rule.condition_key,
      label: rule.label,
      unit: rule.unit,
      status: "MISSING",
      source: "AI_EXTRACTED",
      confidence: null,
    };
    const number = "(-?\\d+(?:\\.\\d+)?)";
    let match;
    if (rule.condition_key === "fixture_mass")
      match = text.match(
        new RegExp(
          `(?:고정구|지그|fixture)[^\\d]{0,12}${number}\\s*(kg|g)`,
          "i",
        ),
      );
    else if (rule.condition_key === "sample_mass")
      match = text.match(
        new RegExp(
          `(?:시료|시편|부품|질량|무게|sample)[^\\d]{0,12}${number}\\s*(kg|g)`,
          "i",
        ),
      );
    if (match) {
      const value = convertUnit(
        Number(match[1]),
        match[2].toLowerCase(),
        rule.unit,
      );
      if (value != null && value >= 0)
        Object.assign(c, { value, status: "CONFIRMED", confidence: 0.9 });
      return c;
    }
    // An unlabelled kg value belongs to the sample only, never to a missing fixture.
    if (rule.condition_key === "fixture_mass") return c;
    if (rule.condition_key === "sample_mass") {
      const withoutFixture = text.replace(
        new RegExp(
          `(?:고정구|지그|fixture)[^\\d]{0,12}${number}\\s*(?:kg|g)`,
          "ig",
        ),
        "",
      );
      match = withoutFixture.match(new RegExp(`${number}\\s*(kg|g)`, "i"));
      if (match && Number(match[1]) >= 0)
        Object.assign(c, {
          value: convertUnit(
            Number(match[1]),
            match[2].toLowerCase(),
            rule.unit,
          ),
          status: "CONFIRMED",
          confidence: 0.85,
        });
    } else if (rule.value_type === "RANGE") {
      // Accept mixed frequency units, converting both ends before comparison.
      match = text.match(
        new RegExp(
          `${number}\\s*(GHz|MHz|kHz|Hz|mm|cm|m|V|A|℃|°C|%RH|dB)?\\s*(?:~|～|–|—|부터|-)\\s*${number}\\s*(GHz|MHz|kHz|Hz|mm|cm|m|V|A|℃|°C|%RH|dB)`,
          "i",
        ),
      );
      if (match) {
        const canonical = (unit) =>
          Object.keys(units).find(
            (key) => key.toLowerCase() === unit?.toLowerCase(),
          ) ?? unit;
        const to = rule.unit,
          from = canonical(match[2] || match[4]),
          end = canonical(match[4]);
        const min = convertUnit(Number(match[1]), from, to),
          max = convertUnit(Number(match[3]), end, to);
        if (min != null && max != null && min <= max)
          Object.assign(c, { min, max, status: "CONFIRMED", confidence: 0.9 });
      }
    } else if (rule.value_type === "TEXT") {
      if (rule.condition_key === "excitation_axis") {
        match = text.match(/\b([XYZ])\s*축/i);
        if (match)
          Object.assign(c, {
            valueText: match[1].toUpperCase(),
            status: "CONFIRMED",
            confidence: 0.85,
          });
      }
    } else if (rule.unit) {
      const escaped = rule.unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      match = text.match(new RegExp(`${number}\\s*${escaped}(?![a-z])`, "i"));
      if (match && Number.isFinite(Number(match[1])))
        Object.assign(c, {
          value: Number(match[1]),
          status: "CONFIRMED",
          confidence: 0.8,
        });
    }
    if (c.status === "MISSING" && !rule.is_required) c.status = "UNCONFIRMED";
    return c;
  });
  if (/대략|추정|정도|약\s*\d/.test(text))
    conditions.forEach((c) => {
      if (c.status === "CONFIRMED") {
        c.status = "UNCONFIRMED";
        c.confidence = 0.4;
      }
    });
  return {
    testTypeCode: type?.code ?? null,
    testTypes: types.map((t) => t.code),
    conditions,
    regions: ["대전", "진주", "경남", "광주", "원주"].filter((region) =>
      text.includes(region),
    ),
  };
}

export function analyzeConditions(requirement, rules) {
  const selected = rules.filter(
    (r) => r.test_type_code === requirement.testTypeCode,
  );
  const missing = [],
    unconfirmed = [];
  for (const rule of selected) {
    const c = requirement.conditions.find(
      (item) => item.key === rule.condition_key,
    );
    const hasValue =
      c &&
      (c.value != null ||
        (c.min != null && c.max != null) ||
        Boolean(c.valueText?.trim()));
    if (rule.is_required && (!hasValue || c.status === "MISSING"))
      missing.push({
        key: rule.condition_key,
        label: rule.label,
        question: `${rule.label}을(를) 입력해주세요.`,
      });
    else if (c?.status !== "CONFIRMED")
      unconfirmed.push({
        key: rule.condition_key,
        label: rule.label,
        reason: "사용자 확인이 필요합니다.",
      });
  }
  return {
    requirementId: requirement.id,
    testTypeCode: requirement.testTypeCode,
    conditions: requirement.conditions,
    missing,
    unconfirmed,
    readyForMatching:
      missing.length === 0 &&
      !selected.some(
        (rule) =>
          rule.is_required &&
          requirement.conditions.find((c) => c.key === rule.condition_key)
            ?.status !== "CONFIRMED",
      ),
  };
}

export function evaluateEquipment(requirement, equipment, rules) {
  let usedMockData = false;
  const checks = [];
  for (const rule of rules.filter(
    (r) => r.test_type_code === requirement.testTypeCode,
  )) {
    const c = requirement.conditions.find((v) => v.key === rule.condition_key);
    if (
      !rule.is_required &&
      (!c ||
        c.status === "MISSING" ||
        (c.status === "UNCONFIRMED" && c.value == null && !c.valueText))
    )
      continue;
    const candidates = equipment.specs.filter((s) => s.key === rule.spec_key);
    const spec =
      candidates.find((s) => s.sourceType === "REAL") ?? candidates[0];
    if (spec && rule.comparator !== "NONE")
      usedMockData ||= spec.sourceType === "MOCK";
    let result = "UNKNOWN";
    const low = c ? convertUnit(c.value ?? c.min, c.unit, rule.unit) : null;
    const high = c ? convertUnit(c.value ?? c.max, c.unit, rule.unit) : null;
    if (
      rule.comparator !== "NONE" &&
      c?.status === "CONFIRMED" &&
      spec &&
      low != null &&
      high != null &&
      low <= high &&
      !(c.value != null && (c.min != null || c.max != null)) &&
      !(spec.value != null && (spec.min != null || spec.max != null))
    ) {
      const value = convertUnit(spec.value, spec.unit, rule.unit),
        min = convertUnit(spec.min, spec.unit, rule.unit),
        max = convertUnit(spec.max, spec.unit, rule.unit);
      const nonnegative = [
        "kg",
        "mm",
        "Hz",
        "GHz",
        "kN",
        "N",
        "kgf",
        "x",
        "samples/day",
        "%RH",
      ].includes(rule.unit);
      let met = null;
      if (!nonnegative || (low >= 0 && high >= 0)) {
        if (
          rule.comparator === "RANGE_WITHIN" &&
          min != null &&
          max != null &&
          min <= max &&
          (!nonnegative || min >= 0)
        )
          met = low >= min && high <= max;
        if (
          ["MAX_LIMIT", "MIN_LIMIT"].includes(rule.comparator) &&
          value != null &&
          (!nonnegative || value >= 0)
        )
          met = rule.comparator === "MAX_LIMIT" ? high <= value : value <= low;
      }
      if (met !== null) result = met ? "MET" : "NOT_MET";
    }
    checks.push({
      conditionKey: rule.condition_key,
      requiredText: conditionText(c),
      equipmentText: conditionText(spec),
      result,
      note:
        rule.comparator === "NONE"
          ? "기관 확인이 필요한 항목입니다."
          : `${rule.comparator} · ${spec?.sourceType ?? "사양 미확인"} · 최종 기관 확인 필요`,
    });
  }
  const met = checks.filter((c) => c.result === "MET").length;
  return {
    score: checks.length ? Math.round((met / checks.length) * 10000) / 100 : 0,
    verdict: !checks.length
      ? "UNKNOWN"
      : checks.some((c) => c.result === "NOT_MET")
        ? "UNSUITABLE"
        : met === checks.length
          ? "SUITABLE"
          : "PARTIAL",
    usedMockData,
    checks,
  };
}
