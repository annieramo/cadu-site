// Valida a senha do trainer sem gastar crédito da API. Só libera a interface.
module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ ok: false }); return; }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch (_) { body = {}; } }
  body = body || {};
  const pass = process.env.TRAINER_PASSWORD;
  if (!pass) { res.status(200).json({ ok: true, note: "no_password_set" }); return; }
  if (body.password === pass) { res.status(200).json({ ok: true }); }
  else { res.status(401).json({ ok: false }); }
};
