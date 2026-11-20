import { FormField } from "../ui/index";
export default function ConditionEditor({
  rules,
  conditions,
  onChange,
  disabled = false,
  idPrefix = "",
}) {
  const update = (rule, patch) => {
    const previous = conditions.find((c) => c.key === rule.conditionKey) ?? {
      key: rule.conditionKey,
      label: rule.label,
      unit: rule.unit,
      status: "MISSING",
    };
    const next = { ...previous, ...patch, source: "USER" };
    if (!Object.hasOwn(patch, "status")) {
      const complete =
        rule.valueType === "RANGE"
          ? next.min != null && next.max != null
          : rule.valueType === "TEXT"
            ? Boolean(next.valueText?.trim())
            : next.value != null;
      next.status = complete ? "CONFIRMED" : "MISSING";
    }
    onChange([...conditions.filter((c) => c.key !== rule.conditionKey), next]);
  };
  const number = (value) => (value === "" ? null : Number(value));
  return (
    <div className="form-grid">
      {rules.map((rule) => {
        const c = conditions.find((c) => c.key === rule.conditionKey) ?? {
            status: "MISSING",
          },
          id = `${idPrefix}condition-${rule.conditionKey}`;
        return (
          <div className="form-field form-field--full" key={rule.conditionKey}>
            <div className="form-section-heading">
              <div>
                <h3>
                  {rule.label}
                  {rule.isRequired ? " *" : ""}
                </h3>
                <p>
                  {rule.unit ?? "텍스트"} ·{" "}
                  {rule.comparator === "NONE"
                    ? "기관 확인 항목"
                    : "규칙 비교 대상"}
                </p>
              </div>
            </div>
            <div className="form-grid">
              {rule.valueType === "RANGE" ? (
                <>
                  <FormField id={`${id}-min`} label="최솟값">
                    <input
                      id={`${id}-min`}
                      type="number"
                      step="any"
                      value={c.min ?? ""}
                      disabled={disabled}
                      onChange={(e) =>
                        update(rule, { min: number(e.target.value) })
                      }
                    />
                  </FormField>
                  <FormField id={`${id}-max`} label="최댓값">
                    <input
                      id={`${id}-max`}
                      type="number"
                      step="any"
                      value={c.max ?? ""}
                      disabled={disabled}
                      onChange={(e) =>
                        update(rule, { max: number(e.target.value) })
                      }
                    />
                  </FormField>
                </>
              ) : (
                <FormField id={id} label="요구 조건">
                  <input
                    id={id}
                    type={rule.valueType === "TEXT" ? "text" : "number"}
                    step="any"
                    value={
                      rule.valueType === "TEXT"
                        ? (c.valueText ?? "")
                        : (c.value ?? "")
                    }
                    disabled={disabled}
                    onChange={(e) =>
                      update(
                        rule,
                        rule.valueType === "TEXT"
                          ? { valueText: e.target.value }
                          : { value: number(e.target.value) },
                      )
                    }
                  />
                </FormField>
              )}
              <FormField id={`${id}-status`} label="확인 상태">
                <select
                  id={`${id}-status`}
                  value={c.status ?? "MISSING"}
                  disabled={disabled}
                  onChange={(e) => update(rule, { status: e.target.value })}
                >
                  <option value="MISSING">미입력</option>
                  <option value="UNCONFIRMED">미확인</option>
                  <option value="CONFIRMED">사용자 확인</option>
                </select>
              </FormField>
            </div>
          </div>
        );
      })}
    </div>
  );
}
