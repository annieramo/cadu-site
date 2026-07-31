// Serverless (Vercel) — lê listas de exercícios com o Claude (Haiku) para o LIMIAR.
// Fragmenta itens, preserva LaTeX, casa o gabarito. Chave e senha em process.env (servidor).
module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "method" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch (_) { body = {}; } }
  body = body || {};

  const pass = process.env.TRAINER_PASSWORD;
  if (pass && body.password !== pass) { res.status(401).json({ error: "auth", questions: [] }); return; }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(200).json({ error: "no_key", questions: [] }); return; }

  try {
    const instr =
      "You extract exercises from a university Calculus exercise list (usually Portuguese, academic, with mathematical notation). " +
      'Return ONLY valid JSON, no prose, no markdown fences: {"questions":[{"id":"...","text":"...","answer":"..."}]}. ' +
      "CRITICAL RULES:\n" +
      "(1) FRAGMENT multi-item questions. If a question like '7) Calcule a derivada de: (a) ... (b) ... (c) ...' has sub-items, output EACH sub-item as a SEPARATE question. Never group several items in one entry.\n" +
      "(2) id format: 'Q<number>-<letter>' (e.g. 'Q7-a'); if the question has no sub-items, use 'Q<number>' (e.g. 'Q7').\n" +
      "(3) Each entry's text must stand ALONE: repeat the shared instruction/stem in every item (e.g. 'Calcule a derivada: $f(x)=x^2\\\\sin x$').\n" +
      "(4) Preserve ALL mathematics as LaTeX wrapped in single dollar signs $...$ so it can be rendered by KaTeX.\n" +
      "(5) The answer key is usually a final section titled 'RESPOSTAS' (or 'GABARITO'). Match each answer to its item by number/letter and put it in 'answer' as LaTeX in $...$. Use an empty string if there is no answer for that item.\n" +
      "(6) SKIP purely conceptual or open-ended prompts ('explique', 'defina', 'discuta', 'o que significa', 'demonstre', 'prove') — do not include them; the tool measures short computational answers.\n" +
      "(7) Ignore page numbers, headers, footers, and general instructions that are not exercises.";

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
      body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 16000, messages: [{ role: "user", content }] }),
    });
    const data = await apiRes.json();
    if (!apiRes.ok) { res.status(200).json({ error: "api", detail: data && data.error, questions: [] }); return; }

    const txt = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const m = txt.match(/\{[\s\S]*\}/);
    let parsed = { questions: [] };
    try { parsed = m ? JSON.parse(m[0]) : { questions: [] }; } catch (_) { parsed = { questions: [] }; }
    const qs = Array.isArray(parsed.questions) ? parsed.questions : [];
    res.status(200).json({ questions: qs });
  } catch (e) {
    res.status(200).json({ error: "exception", message: String((e && e.message) || e), questions: [] });
  }
};
