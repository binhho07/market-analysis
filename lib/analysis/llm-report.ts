import type { EvidencePack, Finding } from "./evidence";

export interface GroundedClaim {
  id: string;
  text: string;
  findingId: string;
}

export interface GroundedReport {
  summary: string;
  claims: GroundedClaim[];
  model: string | null;
  mode: "llm" | "deterministic";
  grounded: true;
}

function findingById(pack: EvidencePack, id: string): Finding | undefined {
  return pack.findings.find((finding) => finding.id === id);
}

function deterministicReport(pack: EvidencePack): GroundedReport {
  const claims = pack.findings.map((finding) => {
    const metricText = Object.entries(finding.metrics)
      .slice(0, 4)
      .map(([key, value]) => `${key}=${value}`)
      .join(", ");
    return {
      id: `C-${finding.id}`,
      findingId: finding.id,
      text: `${finding.title}. ${metricText}. Confidence ${finding.confidence}.`,
    };
  });

  return {
    summary: `This briefing uses ${pack.sampleSize} observed competitors only. No claim below comes from outside the evidence pack.`,
    claims,
    model: null,
    mode: "deterministic",
    grounded: true,
  };
}

function sanitizeReport(pack: EvidencePack, raw: Partial<GroundedReport>, model: string): GroundedReport {
  const allowed = new Set(pack.findings.map((finding) => finding.id));
  const claims = (raw.claims || [])
    .filter((claim) => claim?.text && allowed.has(claim.findingId))
    .map((claim, index) => ({
      id: claim.id || `C${index + 1}`,
      findingId: claim.findingId,
      text: String(claim.text).slice(0, 400),
    }));

  return {
    summary: String(raw.summary || "").slice(0, 800) || deterministicReport(pack).summary,
    claims: claims.length ? claims : deterministicReport(pack).claims,
    model,
    mode: "llm",
    grounded: true,
  };
}

export async function writeGroundedReport(pack: EvidencePack): Promise<GroundedReport> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return deterministicReport(pack);
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const endpoint = `${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You write a local salon market briefing.",
            "Use ONLY the Evidence JSON. Do not invent studies, conversion rates, TAM, or outcomes.",
            "If a number is not in the JSON, omit it.",
            "If confidence is below 0.6, say the sample is thin.",
            "Each claim must cite one findingId from the pack.",
            'Return JSON: {"summary": string, "claims": [{"id": "C1", "findingId": "F2", "text": string}]}',
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify(pack),
        },
      ],
    }),
  });

  if (!response.ok) {
    console.warn("LLM report failed:", await response.text());
    return deterministicReport(pack);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  try {
    return sanitizeReport(pack, JSON.parse(content), model);
  } catch {
    return deterministicReport(pack);
  }
}

export function getFinding(pack: EvidencePack | undefined, findingId: string) {
  if (!pack) return undefined;
  return findingById(pack, findingId);
}
