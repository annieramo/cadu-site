// Serverless function (Vercel) — lê uma lista de exercícios com a API do Claude.
// A chave fica em process.env.ANTHROPIC_API_KEY (servidor), nunca no navegador.
module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "method" }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(200).json({ error: "no_key", questions: [] }); return; }

  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body || "{}");
    body = body || {};

    const instr =
      "You extract exercises from a study list (in Portuguese or English). " +
      "Return ONLY valid JSON, no prose, no markdown fences, in the form " +
      '{"questions":[{"text":"...","answer":"..."}]}. ' +
      "Rules: (1) Keep a multi-part question together as ONE entry — if a question has items a), b), c), put every item inside that entry's \"text\". " +
      "(2) Do not split a single question into several. (3) If the document has an answer key, attach each question's answer to \"answer\"; if there is no answer, use an empty string. " +
      "(4) Ignore page numbers, headers, footers and general instructions. (5) Preserve math and symbols as readable plain text. (6) Keep each question's original wording.";

    let content;
    if (body.mode === "pdf" && body.pdfBase64) {
      content = [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: body.pdfBase64 } },
        { type: "text", text: instr },
      ];
    } else {
      content = [{ type: "text", text: instr + "\n\n--- LIST ---\n\n" + (body.text || "") }];
    }

    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-opus-4-8", max_tokens: 8000, messages: [{ role: "user", content }] }),
    });
    const data = await apiRes.json();
    if (!apiRes.ok) { res.status(200).json({ error: "api", detail: data && data.error, questions: [] }); return; }

    const txt = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const m = txt.match(/\{[\s\S]*\}/);
    let parsed = { questions: [] };
    try { parsed = m ? JSON.parse(m[0]) : { questions: [] }; } catch (_) { parsed = { questions: [] }; }
    res.status(200).json({ questions: Array.isArray(parsed.questions) ? parsed.questions : [] });
  } catch (e) {
    res.status(200).json({ error: "exception", message: String(e && e.message || e), questions: [] });
  }
};
