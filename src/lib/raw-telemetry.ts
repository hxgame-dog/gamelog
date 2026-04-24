export type RawTelemetryCell = string | number | boolean | null;

export type RawTelemetryUpload = {
  rows: Array<Record<string, RawTelemetryCell>>;
  headers: string[];
  notice: string;
};

const rawTelemetrySupplementalKeys = [
  "step_name",
  "level_type",
  "activity_id",
  "activity_type",
  "reward_id",
  "item_name",
  "gain_source",
  "gain_amount",
  "resource_type",
  "current_slots",
  "screw_color",
  "trigger_scene",
  "country_code",
  "platform",
  "app_version",
  "event_time"
] as const;

function looksLikeRawTelemetryCsv(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectRawTelemetryDelimiter(firstLine);
  return Boolean(delimiter) && firstLine.includes('"event_name"') && firstLine.includes('"event_value"');
}

function detectRawTelemetryDelimiter(firstLine: string) {
  const semicolonCount = firstLine.split(";").length;
  const commaCount = firstLine.split(",").length;
  const candidateCount = Math.max(semicolonCount, commaCount);
  if (candidateCount <= 40) {
    return null;
  }
  return semicolonCount >= commaCount ? ";" : ",";
}

function parseDelimitedText(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && character === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += character;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

function parseJsonObject(raw: string) {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === "string" && parsed.trim().startsWith("{")) {
      return JSON.parse(parsed) as Record<string, unknown>;
    }
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function pickFirstString(...values: Array<unknown>) {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }
    const stringValue = String(value).trim();
    if (stringValue) {
      return stringValue;
    }
  }
  return "";
}

function parseNumericCandidate(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value).trim().replace(/^(-?\d+),(\d+)$/, "$1.$2");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function pickFirstNumber(...values: Array<unknown>) {
  for (const value of values) {
    const numeric = parseNumericCandidate(value);
    if (numeric !== null) {
      return numeric;
    }
  }
  return null;
}

function deriveResult(eventName: string, payload: Record<string, unknown>) {
  const explicit = pickFirstString(payload.result, payload.status, payload.outcome);
  if (explicit) {
    return explicit.toLowerCase();
  }
  if (/fail|error/i.test(eventName)) {
    return "fail";
  }
  if (/complete|success|purchase|reward_claim|achieved/i.test(eventName)) {
    return "success";
  }
  if (/click/i.test(eventName)) {
    return "click";
  }
  if (/view|impression/i.test(eventName)) {
    return "view";
  }
  return "";
}

export function detectAndParseRawTelemetryCsv(text: string): RawTelemetryUpload | null {
  if (!looksLikeRawTelemetryCsv(text)) {
    return null;
  }

  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectRawTelemetryDelimiter(firstLine);
  if (!delimiter) {
    return null;
  }
  const matrix = parseDelimitedText(text, delimiter);
  const [headerRow = [], ...dataRows] = matrix;
  const headers = headerRow.map((cell) => cell.trim());

  const rows = dataRows
    .map((cells) => {
      const rawRow = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])) as Record<string, string>;
      const eventPayload = parseJsonObject(rawRow.event_value ?? "");
      const customPayload = parseJsonObject(rawRow.custom_data ?? "");
      const payload = {
        ...(customPayload ?? {}),
        ...(eventPayload ?? {})
      } as Record<string, unknown>;

      const eventName = pickFirstString(rawRow.event_name);
      return {
        event_name: eventName,
        event_time: pickFirstString(rawRow.event_time, rawRow.LogTime),
        user_id: pickFirstString(rawRow.customer_user_id, rawRow.appsflyer_id, rawRow.android_id),
        platform: pickFirstString(rawRow.platform, rawRow.device_type),
        app_version: pickFirstString(rawRow.app_version),
        country_code: pickFirstString(rawRow.country_code),
        level_id: pickFirstString(payload.level_id, payload.tutoriallevel_id, payload.af_level_achieved),
        level_type: pickFirstString(payload.level_type),
        step_id: pickFirstString(payload.step_id),
        step_name: pickFirstString(payload.step_name, payload.tutorial_name),
        result: deriveResult(eventName, payload),
        fail_reason: pickFirstString(payload.fail_reason, payload.reason),
        duration_sec: pickFirstNumber(payload.duration_seconds, payload.time_spent, payload.rotate_time),
        placement: pickFirstString(payload.ad_placement),
        price: pickFirstNumber(rawRow.event_revenue, payload.af_revenue, payload.price, payload.amount),
        reward_type: pickFirstString(payload.reward_id, payload.item_name, payload.resource_type),
        activity_id: pickFirstString(payload.activity_id),
        activity_type: pickFirstString(payload.activity_type),
        reward_id: pickFirstString(payload.reward_id),
        item_name: pickFirstString(payload.item_name),
        gain_source: pickFirstString(payload.gain_source),
        gain_amount: pickFirstNumber(payload.gain_amount),
        resource_type: pickFirstString(payload.resource_type),
        current_slots: pickFirstNumber(payload.current_slots),
        screw_color: pickFirstString(payload.screw_color),
        trigger_scene: pickFirstString(payload.trigger_scene)
      };
    })
    .filter((row) => String(row.event_name ?? "").trim());

  const cleanedHeaders = [
    "event_name",
    "event_time",
    "user_id",
    "platform",
    "app_version",
    "country_code",
    "level_id",
    "level_type",
    "step_id",
    "step_name",
    "result",
    "fail_reason",
    "duration_sec",
    "placement",
    "price",
    "reward_type",
    ...rawTelemetrySupplementalKeys.filter((header) => header in (rows[0] ?? {}))
  ];

  return {
    rows,
    headers: cleanedHeaders.filter((header, index, collection) => collection.indexOf(header) === index),
    notice: `已识别为${delimiter === ";" ? "分号" : "逗号"}分隔的原始日志导出，并自动展开 event_value/custom_data。当前映射的是清洗后的业务字段。`
  };
}
