import type { MockRoute } from "../engine";
import { DEMO_WARNING } from "../database";
import { ok, pageOf, reject } from "../http";

export function simulatePreset(model, preset, input) {
  for (const field of model.required_input_fields) {
    const value = input[field],
      isText = /Name$/.test(field);
    if (
      isText
        ? typeof value !== "string" || !value.trim()
        : !Number.isFinite(value)
    )
      reject(400, "VALIDATION_FAILED", `${field} 입력을 확인해주세요.`);
    if (!isText && !/TempC$/.test(field) && value < 0)
      reject(
        400,
        "VALIDATION_FAILED",
        `${field}에는 음수를 입력할 수 없습니다.`,
      );
    if (/Pct$/.test(field) && value > 100)
      reject(400, "VALIDATION_FAILED", `${field}는 0~100이어야 합니다.`);
  }
  const chart = (xLabel, yLabel, series, summary = {}) => ({
    chart: { xLabel, yLabel, series },
    summary,
  });
  const line = (end, fn) =>
    Array.from({ length: 41 }, (_, i) => {
      const x = (end * i) / 40;
      return [x, fn(x)];
    });
  const spec = (key) => preset.specs_snapshot.find((s) => s.key === key);
  const check = (key, value) => {
    const s = spec(key);
    return {
      key,
      input: value,
      result: !s
        ? "UNKNOWN"
        : s.value != null
          ? value <= s.value
            ? "MET"
            : "NOT_MET"
          : s.min != null && s.max != null
            ? value >= s.min && value <= s.max
              ? "MET"
              : "NOT_MET"
            : "UNKNOWN",
      sourceType: s?.sourceType ?? null,
    };
  };
  const p = input;
  switch (model.model_type) {
    case "SDOF_BASE_EXCITATION": {
      if (
        p.massKg <= 0 ||
        p.stiffnessNPerM <= 0 ||
        p.dampingRatio <= 0 ||
        p.dampingRatio > 1 ||
        p.frequencyMinHz <= 0 ||
        p.frequencyMaxHz <= p.frequencyMinHz
      )
        reject(
          400,
          "VALIDATION_FAILED",
          "질량·강성·감쇠비·주파수 범위를 확인해주세요.",
        );
      const natural =
        Math.sqrt(p.stiffnessNPerM / (p.massKg + p.fixtureMassKg)) /
        (2 * Math.PI);
      const points = Array.from({ length: 61 }, (_, i) => {
        const f =
            p.frequencyMinHz *
            (p.frequencyMaxHz / p.frequencyMinHz) ** (i / 60),
          r = f / natural,
          z = 2 * p.dampingRatio * r;
        return [f, Math.sqrt((1 + z * z) / ((1 - r * r) ** 2 + z * z))];
      });
      return chart("Hz", "Transmissibility", points, {
        naturalFrequencyHz: Math.round(natural * 10) / 10,
      });
    }
    case "CHAMBER_SETPOINT_PROFILE":
      return chart(
        "min",
        "설정 온도 (°C)",
        [
          [0, p.startTempC],
          [p.rampMin, p.targetTempC],
          [p.rampMin + p.holdMin, p.targetTempC],
        ],
        { targetHumidityPct: p.targetHumidityPct },
      );
    case "LINEAR_FORCE_DISPLACEMENT":
      return chart(
        "mm",
        "가상 힘 (N)",
        line(p.maxDisplacementMm, (x) => p.specimenStiffnessNPerMm * x),
      );
    case "IMPACT_ENERGY_BUDGET":
      return chart(
        "높이 (m)",
        "위치 에너지 (J)",
        line(p.dropHeightM, (x) => p.massKg * 9.80665 * x),
        { energyJ: p.massKg * 9.80665 * p.dropHeightM },
      );
    case "BATTERY_IDEAL_CC": {
      if (p.currentA <= 0 || p.capacityAh <= 0)
        reject(400, "VALIDATION_FAILED", "용량과 전류는 0보다 커야 합니다.");
      const hours =
        (p.capacityAh * Math.abs(p.finalSocPct - p.initialSocPct)) /
        100 /
        p.currentA;
      return chart(
        "hours",
        "가상 SOC (%)",
        [
          [0, p.initialSocPct],
          [hours, p.finalSocPct],
        ],
        { hours },
      );
    }
    case "PRESS_LOAD_PROFILE":
      return chart("seconds", "설정 하중 (kN)", [
        [0, 0],
        [p.rampSeconds, p.targetForceKN],
        [p.rampSeconds + p.holdSeconds, p.targetForceKN],
      ]);
    case "XRAY_ATTENUATION_TOY":
      return chart(
        "두께 (mm)",
        "가상 I/I₀",
        line(p.thicknessMm, (x) =>
          Math.exp(-p.attenuationCoefficientPerMm * x),
        ),
      );
    case "SOUND_LEVEL_DECIBEL_VIEW": {
      if (p.amplitudeRatio <= 0)
        reject(400, "VALIDATION_FAILED", "음압비는 0보다 커야 합니다.");
      return chart(
        "음압비",
        "가상 dB",
        [
          [1, 0],
          [p.amplitudeRatio, 20 * Math.log10(p.amplitudeRatio)],
        ],
        { decibels: 20 * Math.log10(p.amplitudeRatio) },
      );
    }
    case "IDEAL_DC_POWER":
      return chart(
        "전류 (A)",
        "가상 전력 (W)",
        line(p.currentA, (x) => p.voltageV * x),
        { powerW: p.voltageV * p.currentA },
      );
    case "WORK_ENVELOPE_FIT":
      return {
        checks: [
          check("work_envelope_x", p.partWidthMm),
          check("work_envelope_y", p.partDepthMm),
        ],
      };
    case "ROBOT_REACH_CHECK":
      return { checks: [check("reach", p.targetDistanceMm)] };
    case "MEASUREMENT_VOLUME_FIT":
      return {
        checks: [
          check("measurement_range_x", p.partXmm),
          check("measurement_range_y", p.partYmm),
          check("measurement_range_z", p.partZmm),
        ],
      };
    case "RF_FREQUENCY_COVERAGE":
      return { checks: [check("frequency", p.targetFrequencyGHz)] };
    case "MAGNIFICATION_VIEW":
      return {
        concept: {
          label: "가상 확대 배율",
          value: p.virtualMagnification,
          unit: "x",
        },
        steps: ["가상 배율 입력", "개념 확대 보기", "실제 관측 영상 아님"],
      };
    case "MEASUREMENT_RESOLUTION_VIEW":
      return {
        concept: {
          label: "입력 공칭 치수",
          value: p.nominalDimensionMm,
          unit: "mm",
        },
        steps: [
          "공칭 치수 확인",
          "분해능·측정 오차 개념 검토",
          "실제 정밀도·불확도 인증 아님",
        ],
      };
    case "ANALYSIS_THROUGHPUT_VIEW":
      return {
        concept: { label: "입력 시료 수", value: p.sampleCount, unit: "개" },
        steps: [
          "시료 접수",
          "전처리",
          "가상 분석 순서 확인",
          "실제 분석 결과 생성하지 않음",
        ],
      };
    default:
      return {
        steps:
          model.model_type === "AUTOCLAVE_CYCLE_WORKFLOW"
            ? [
                "가상 승온",
                `목표 ${p.targetTempC}°C · ${p.holdMinutes}분 유지`,
                "가상 냉각",
              ]
            : model.model_type === "CAD_CAM_WORKFLOW"
              ? ["시료 확인", "설계", "공구경로 검토", "가상 검증"]
              : ["시료 준비", "입력 조건 확인", "가상 작업 단계", "결과 검토"],
        inputParameters: p,
      };
  }
}
export const simulationRoutes: MockRoute[] = [
  [
    "GET",
    "/simulation/models",
    (ctx) =>
      ok(
        ctx.state.models.map((m) => ({
          modelType: m.model_type,
          description: m.description,
          requiredInputFields: m.required_input_fields,
          limitation: m.limitation,
          capability: m.capability,
          modelVersion: m.model_version,
        })),
      ),
  ],
  [
    "GET",
    "/equipment/:id/simulation-presets",
    (ctx) => {
      ctx.equipment(ctx.params.id);
      return ok(
        ctx.state.presets
          .filter((p) => p.equipment_id === Number(ctx.params.id))
          .map((p) => ({
            presetId: p.preset_id,
            equipmentId: p.equipment_id,
            modelType: p.model_type,
            inputParameters: p.input_parameters,
            specsSnapshot: p.specs_snapshot,
            assumptions: p.assumptions,
            isMock: true,
          })),
      );
    },
  ],
  [
    "POST",
    "/simulation/runs",
    (ctx) => {
      const preset =
        ctx.state.presets.find((p) => p.preset_id === ctx.body.presetId) ??
        reject(404, "NOT_FOUND", "시뮬레이션 프리셋이 없습니다.");
      ctx.equipment(preset.equipment_id);
      if (ctx.body.requirementId)
        ctx.owner(
          ctx.state.requirements.find(
            (r) => r.id === Number(ctx.body.requirementId),
          ),
        );
      const model = ctx.state.models.find(
          (m) => m.model_type === preset.model_type,
        ),
        input = ctx.body.inputParameters;
      if (!input || typeof input !== "object")
        reject(400, "VALIDATION_FAILED", "시뮬레이션 입력을 확인해주세요.");
      const output = simulatePreset(model, preset, input);
      if (
        "chart" in output && output.chart?.series.some((point) =>
          point.some((v) => !Number.isFinite(v)),
        )
      )
        reject(
          400,
          "VALIDATION_FAILED",
          "계산 가능한 입력 범위를 확인해주세요.",
        );
      const run = {
        id: ctx.nextId(),
        ownerId: ctx.user.id,
        equipmentId: preset.equipment_id,
        presetId: preset.preset_id,
        status: "SUCCEEDED",
        modelType: model.model_type,
        modelVersion: model.model_version,
        capability: model.capability,
        isMock: true,
        inputParameters: structuredClone(input),
        output,
        warning: DEMO_WARNING,
        limitation: model.limitation,
        createdAt: ctx.now,
      };
      ctx.state.simulations.push(run);
      const { ownerId: _owner, ...view } = run;
      return ok(view, 201);
    },
  ],
  [
    "GET",
    "/simulation/runs/:id",
    (ctx) => {
      const { ownerId: _owner, ...run } = ctx.owner(
        ctx.state.simulations.find((r) => r.id === Number(ctx.params.id)),
      );
      return ok(run);
    },
  ],
  [
    "GET",
    "/simulation/runs",
    (ctx) =>
      ok(
        pageOf(
          ctx.state.simulations
            .filter(
              (r) =>
                (ctx.user.role === "ADMIN" || r.ownerId === ctx.user.id) &&
                (!ctx.url.searchParams.get("equipmentId") ||
                  r.equipmentId ===
                    Number(ctx.url.searchParams.get("equipmentId"))),
            )
            .map(({ ownerId: _owner, ...r }) => r),
          ctx.url,
        ),
      ),
  ],
];
