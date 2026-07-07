/**
 * Vercel serverless function: generate a weekly "reality check" report with
 * Claude. The frontend posts the already-computed data_summary; if this
 * endpoint is unavailable (no ANTHROPIC_API_KEY, network down), the app falls
 * back to its local template and labels the report accordingly.
 *
 * Requires the ANTHROPIC_API_KEY env var in the Vercel project settings.
 */
import Anthropic from "@anthropic-ai/sdk";

// The in-app renderer supports ONLY: "# ", "## ", "### ", "- " lines and
// **bold** — the prompt constrains output to that subset.
const SYSTEM_PROMPT = `You are the weekly report generator for RealityCheck, a terminal-styled personal time tracker whose motto is "brutal honesty about how you actually spend your time."

You receive one week of the user's time data as JSON:
- total_productive_hours: time lived "on purpose" (work AND intentional life time)
- total_scheduled_hours: committed time (sleep, lectures, recurring obligations)
- total_break_hours: drifted/untracked time
- days: per-day breakdown (productive_hours, break_hours, scheduled_hours, date, day_name)

Write the weekly reality check. Voice: direct, unsentimental, second person, like a no-nonsense coach reading the numbers back. Never cruel, never fluffy, no praise the data doesn't earn. Every claim must come from the actual numbers — quote them (use **bold** for figures). Call out the single worst pattern you can see (zero-tracked days, drift outweighing purpose, weekend collapse, one strong day propping up the average) and acknowledge what genuinely worked.

Format rules (strict — the renderer only supports this subset of markdown):
- Sections, in order: "## Reality Check" (2-3 sentence verdict), "## The Numbers" (bulleted figures), "## Pattern" (the main insight), "## Next Moves" (2-3 concrete, small actions tied to the data).
- Only these constructs: lines starting with "## ", lines starting with "- ", plain paragraphs, and **bold**. No tables, no links, no nested lists, no code blocks, no headings deeper than "###".
- 150-300 words total. No preamble before the first heading.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ detail: "Method not allowed" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ detail: "AI reports not configured (missing ANTHROPIC_API_KEY)" });
  }
  const summary = req.body?.data_summary;
  if (!summary || typeof summary !== "object") {
    return res.status(400).json({ detail: "data_summary is required" });
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here is my week of time-tracking data:\n${JSON.stringify(summary)}`,
        },
      ],
    });
    if (response.stop_reason === "refusal") {
      return res.status(502).json({ detail: "Model declined the request" });
    }
    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!text) {
      return res.status(502).json({ detail: "Empty model response" });
    }
    return res.status(200).json({ content: text, model: response.model });
  } catch (err) {
    console.error("generate-report failed:", err?.status, err?.message);
    return res.status(err?.status === 429 ? 429 : 502).json({ detail: "AI generation failed" });
  }
}
