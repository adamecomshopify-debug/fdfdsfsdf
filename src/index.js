import { connect } from "cloudflare:sockets";
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// adamecom-worker-index.js
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var __defProp22 = Object.defineProperty;
var __name22 = /* @__PURE__ */ __name2((target, value) => __defProp22(target, "name", { value, configurable: true }), "__name");
var log = /* @__PURE__ */ __name22((...a) => console.log("\xB7", ...a), "log");
async function dejaTraite(db, domaine, identifiant) {
  const r = await db.prepare("SELECT 1 FROM traites WHERE domaine = ? AND identifiant = ?").bind(domaine, identifiant).first();
  return Boolean(r);
}
__name(dejaTraite, "dejaTraite");
__name2(dejaTraite, "dejaTraite");
__name22(dejaTraite, "dejaTraite");
var marquerTraite = /* @__PURE__ */ __name22((db, domaine, identifiant) => db.prepare("INSERT OR IGNORE INTO traites (domaine, identifiant, traite_le) VALUES (?, ?, ?)").bind(domaine, identifiant, (/* @__PURE__ */ new Date()).toISOString()).run(), "marquerTraite");
async function reserver(db, domaine, identifiant) {
  const r = await db.prepare("INSERT OR IGNORE INTO traites (domaine, identifiant, traite_le) VALUES (?, ?, ?)").bind(domaine, identifiant, (/* @__PURE__ */ new Date()).toISOString()).run();
  return r.meta.changes > 0;
}
__name(reserver, "reserver");
__name2(reserver, "reserver");
__name22(reserver, "reserver");
async function amorcageFait(db, domaine) {
  const r = await db.prepare("SELECT 1 FROM amorcage WHERE domaine = ?").bind(domaine).first();
  return Boolean(r);
}
__name(amorcageFait, "amorcageFait");
__name2(amorcageFait, "amorcageFait");
__name22(amorcageFait, "amorcageFait");
var marquerAmorcage = /* @__PURE__ */ __name22((db, domaine) => db.prepare("INSERT OR IGNORE INTO amorcage (domaine, fait_le) VALUES (?, ?)").bind(domaine, (/* @__PURE__ */ new Date()).toISOString()).run(), "marquerAmorcage");
function smtpB64(texte) {
  const octets = typeof texte === "string" ? new TextEncoder().encode(texte) : texte;
  let bin = "";
  for (let i = 0; i < octets.length; i += 32768) bin += String.fromCharCode(...octets.subarray(i, i + 32768));
  return btoa(bin);
}
function smtpLignes76(b64) {
  return b64.replace(/.{1,76}/g, "$&\r\n");
}
function smtpEntete(texte) {
  return /^[\x20-\x7e]*$/.test(texte) ? texte : `=?UTF-8?B?${smtpB64(texte)}?=`;
}
function smtpAdresse(a) {
  return a?.name ? `${smtpEntete(a.name)} <${a.email}>` : `<${a.email}>`;
}
async function envoyerSmtp(env, m) {
  const ports = env.SMTP_PORT ? [Number(env.SMTP_PORT)] : [465, 587];
  const erreurs = [];
  for (const port of ports) {
    try {
      return await envoyerSmtpPort(env, m, port);
    } catch (e) {
      erreurs.push(`port ${port} : ${String(e?.message || e)}`);
      if (/AUTH|RCPT|MAIL FROM|DATA \(message\)/.test(String(e?.message))) break;
    }
  }
  throw new Error("SMTP " + erreurs.join(" \u2014 "));
}
async function envoyerSmtpPort(env, m, port) {
  const hote = env.SMTP_HOST || "smtp.hostinger.com";
  const utilisateur = env.SMTP_USER || env.SENDER_EMAIL;
  const de = m.sender?.email || env.SENDER_EMAIL;
  const destinataires = [...m.to || [], ...m.cc || [], ...m.bcc || []].map((x) => x.email).filter(Boolean);
  if (!destinataires.length) throw new Error("SMTP : aucun destinataire.");
  const domaine = String(de).split("@")[1] || "localhost";
  const frontiere = "adamecom-" + crypto.randomUUID();
  const html = m.htmlContent || "";
  const entetes = [
    `From: ${smtpAdresse({ email: de, name: m.sender?.name })}`,
    `To: ${(m.to || []).map(smtpAdresse).join(", ")}`,
    ...m.cc?.length ? [`Cc: ${m.cc.map(smtpAdresse).join(", ")}`] : [],
    ...m.replyTo?.email ? [`Reply-To: ${smtpAdresse(m.replyTo)}`] : [],
    `Subject: ${smtpEntete(m.subject || "")}`,
    `Date: ${(/* @__PURE__ */ new Date()).toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${crypto.randomUUID()}@${domaine}>`,
    "MIME-Version: 1.0"
  ];
  const texteBrut = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, "\n\n").trim();
  const alternative = [
    `--${frontiere}-alt`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    smtpLignes76(smtpB64(texteBrut)),
    `--${frontiere}-alt`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    smtpLignes76(smtpB64(html)),
    `--${frontiere}-alt--`,
    ""
  ].join("\r\n");
  let corps;
  if (m.attachment?.length) {
    corps = [
      ...entetes,
      `Content-Type: multipart/mixed; boundary="${frontiere}"`,
      "",
      `--${frontiere}`,
      `Content-Type: multipart/alternative; boundary="${frontiere}-alt"`,
      "",
      alternative,
      ...m.attachment.flatMap((pj) => [
        `--${frontiere}`,
        `Content-Type: ${/\.ics$/i.test(pj.name) ? "text/calendar; method=REQUEST; charset=UTF-8" : "application/octet-stream"}; name="${pj.name}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${pj.name}"`,
        "",
        smtpLignes76(pj.content)
      ]),
      `--${frontiere}--`,
      ""
    ].join("\r\n");
  } else {
    corps = [...entetes, `Content-Type: multipart/alternative; boundary="${frontiere}-alt"`, "", alternative].join("\r\n");
  }
  const socket = connect({ hostname: hote, port }, { secureTransport: port === 465 ? "on" : "starttls", allowHalfOpen: false });
  let flux = socket;
  let lecteur = flux.readable.getReader();
  let ecrivain = flux.writable.getWriter();
  const dec = new TextDecoder();
  let tampon = "";
  const lire = /* @__PURE__ */ __name2(async () => {
    const lignes = [];
    for (;;) {
      const fin = tampon.indexOf("\r\n");
      if (fin >= 0) {
        const ligne = tampon.slice(0, fin);
        tampon = tampon.slice(fin + 2);
        lignes.push(ligne);
        if (/^\d{3} /.test(ligne) || /^\d{3}$/.test(ligne)) return { code: Number(ligne.slice(0, 3)), texte: lignes.join(" | ") };
        continue;
      }
      const { value, done } = await lecteur.read();
      if (done) throw new Error("SMTP : connexion ferm\xE9e par le serveur (" + (lignes.join(" | ") || "sans r\xE9ponse") + ")");
      tampon += dec.decode(value, { stream: true });
    }
  }, "lire");
  let etape = "connexion";
  const commande = /* @__PURE__ */ __name2(async (ligne, attendu, masque) => {
    etape = masque || (ligne === null ? "accueil du serveur" : ligne.split(" ")[0]);
    if (ligne !== null) await ecrivain.write(new TextEncoder().encode(ligne + "\r\n"));
    const r = await lire();
    if (!attendu.includes(r.code)) throw new Error(`SMTP ${hote} : ${masque || ligne || "connexion"} \u2192 ${r.texte}`.slice(0, 400));
    return r;
  }, "commande");
  const delai = setTimeout(() => socket.close().catch(() => {}), 3e4);
  try {
    await socket.opened;
    await commande(null, [220]);
    await commande(`EHLO ${domaine}`, [250]);
    if (port !== 465) {
      await commande("STARTTLS", [220]);
      lecteur.releaseLock();
      ecrivain.releaseLock();
      flux = socket.startTls();
      lecteur = flux.readable.getReader();
      ecrivain = flux.writable.getWriter();
      await commande(`EHLO ${domaine}`, [250]);
    }
    await commande(`AUTH PLAIN ${smtpB64("\0" + utilisateur + "\0" + env.SMTP_PASSWORD)}`, [235], "AUTH (identifiant ou mot de passe)");
    await commande(`MAIL FROM:<${de}>`, [250]);
    for (const d of destinataires) await commande(`RCPT TO:<${d}>`, [250, 251]);
    await commande("DATA", [354]);
    await commande(corps.replace(/\r\n\./g, "\r\n..") + "\r\n.", [250], "DATA (message)");
    try {
      await commande("QUIT", [221]);
    } catch {
    }
  } catch (e) {
    const msg = String(e?.message || e);
    throw new Error(/^SMTP /.test(msg) ? msg : `${hote}:${port} \xE9tape ${etape} : ${msg}`);
  } finally {
    clearTimeout(delai);
    try {
      await socket.close();
    } catch {
    }
  }
  return { messageId: "smtp" };
}
async function envoyerResend(env, m) {
  const adresse = (a) => a?.name ? `${a.name.replace(/[<>"]/g, "")} <${a.email}>` : a.email;
  const emails = (liste) => (liste || []).map((x) => x.email).filter(Boolean);
  const corps = {
    from: adresse(m.sender?.email ? m.sender : { name: "AdamEcom", email: env.SENDER_EMAIL }),
    to: emails(m.to),
    subject: m.subject || "",
    ...m.htmlContent ? { html: m.htmlContent } : {},
    ...m.textContent ? { text: m.textContent } : {},
    ...m.cc?.length ? { cc: emails(m.cc) } : {},
    ...m.bcc?.length ? { bcc: emails(m.bcc) } : {},
    ...m.replyTo?.email ? { reply_to: adresse(m.replyTo) } : {},
    ...m.attachment?.length ? { attachments: m.attachment.map((pj) => ({ filename: pj.name, content: pj.content })) } : {}
  };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(corps)
  });
  const texte = await res.text();
  if (!res.ok) {
    const e = new Error(`Resend \u2192 ${res.status} ${texte}`);
    e.statut = res.status;
    throw e;
  }
  const r = texte ? JSON.parse(texte) : {};
  return { messageId: r.id || "resend" };
}
async function brevo(env, chemin, options = {}) {
  if (chemin === "/smtp/email" && env.RESEND_API_KEY) {
    try {
      return await envoyerResend(env, JSON.parse(options.body || "{}"));
    } catch (e) {
      if (!(e?.statut === 403 || e?.statut >= 500 || !e?.statut) || !env.BREVO_API_KEY) throw e;
      console.error("Resend indisponible, envoi via Brevo :", e.message);
    }
  }
  if (chemin === "/smtp/email" && env.SMTP_PASSWORD && !env.RESEND_API_KEY) {
    try {
      return await envoyerSmtp(env, JSON.parse(options.body || "{}"));
    } catch (e) {
      if (!/\xE9tape connexion/.test(String(e?.message)) || !env.BREVO_API_KEY) throw e;
      console.error("SMTP injoignable, envoi via Brevo :", e.message);
    }
  }
  const res = await fetch(`https://api.brevo.com/v3${chemin}`, {
    ...options,
    headers: {
      "api-key": env.BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
      ...options.headers
    }
  });
  const corps = await res.text();
  if (!res.ok) throw new Error(`Brevo ${options.method || "GET"} ${chemin} \u2192 ${res.status} ${corps}`);
  return corps ? JSON.parse(corps) : {};
}
__name(brevo, "brevo");
__name2(brevo, "brevo");
__name22(brevo, "brevo");
async function envoyerEmail(env, { de, deNom, a, aNom, objet, html, repondreA }) {
  await brevo(env, "/smtp/email", {
    method: "POST",
    body: JSON.stringify({
      sender: { name: deNom, email: de },
      to: [{ email: a, ...aNom ? { name: aNom } : {} }],
      ...repondreA ? { replyTo: repondreA } : {},
      subject: objet,
      htmlContent: html
    })
  });
}
__name(envoyerEmail, "envoyerEmail");
__name2(envoyerEmail, "envoyerEmail");
__name22(envoyerEmail, "envoyerEmail");
var octets = (s) => typeof s === "string" ? new TextEncoder().encode(s) : s;
var hexa = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function sha256Hexa(donnees) {
  return hexa(await crypto.subtle.digest("SHA-256", octets(donnees)));
}
async function hmacOctets(cle, donnees) {
  const k = await crypto.subtle.importKey("raw", octets(cle), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, octets(donnees)));
}
function sesActif(env) {
  return !!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
}
// Signature AWS Signature Version 4 (requête JSON, sans paramètres de requête).
async function awsEnTetes(env, { service, region, hote, chemin, methode = "POST", corps = "", quand = /* @__PURE__ */ new Date() }) {
  const amzDate = quand.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const jour = amzDate.slice(0, 8);
  const empreinte = await sha256Hexa(corps);
  const signes = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonique = [
    methode,
    chemin,
    "",
    `content-type:application/json
host:${hote}
x-amz-content-sha256:${empreinte}
x-amz-date:${amzDate}
`,
    signes,
    empreinte
  ].join("\n");
  const portee = `${jour}/${region}/${service}/aws4_request`;
  const aSigner = ["AWS4-HMAC-SHA256", amzDate, portee, await sha256Hexa(canonique)].join("\n");
  let k = await hmacOctets("AWS4" + env.AWS_SECRET_ACCESS_KEY, jour);
  for (const p of [region, service, "aws4_request"]) k = await hmacOctets(k, p);
  const signature = hexa(await hmacOctets(k, aSigner));
  return {
    "content-type": "application/json",
    "x-amz-content-sha256": empreinte,
    "x-amz-date": amzDate,
    authorization: `AWS4-HMAC-SHA256 Credential=${env.AWS_ACCESS_KEY_ID}/${portee}, SignedHeaders=${signes}, Signature=${signature}`
  };
}
// Envoi d'un email par Amazon SES (API v2). Lève une erreur avec .statut si SES refuse.
async function envoyerSes(env, { de, deNom, a, objet, html, entetes = [] }) {
  const region = (env.AWS_REGION || "eu-west-3").trim();
  const hote = `email.${region}.amazonaws.com`;
  const chemin = "/v2/email/outbound-emails";
  const nom = String(deNom || "").replace(/[<>"]/g, "");
  const corps = JSON.stringify({
    FromEmailAddress: nom ? `${nom} <${de}>` : de,
    Destination: { ToAddresses: [a] },
    Content: { Simple: {
      Subject: { Data: objet, Charset: "UTF-8" },
      Body: { Html: { Data: html, Charset: "UTF-8" } },
      ...entetes.length ? { Headers: entetes } : {}
    } }
  });
  const res = await fetch(`https://${hote}${chemin}`, {
    method: "POST",
    headers: await awsEnTetes(env, { service: "ses", region, hote, chemin, corps }),
    body: corps,
    signal: AbortSignal.timeout(2e4)
  });
  const texte = await res.text();
  if (!res.ok) {
    let msg = texte;
    try {
      msg = JSON.parse(texte).message || texte;
    } catch {
    }
    const e = new Error(`Amazon SES → ${res.status} ${String(msg).slice(0, 300)}`);
    e.statut = res.status;
    throw e;
  }
  return JSON.parse(texte || "{}").MessageId || "ses";
}
async function jetonDesabo(env, email) {
  return hexa(await hmacOctets(`desabo:${env.CLE_TEST || "adamecom"}`, String(email).trim().toLowerCase())).slice(0, 32);
}
async function lienDesabo(env, email) {
  const origine = (env.APP_ORIGINE || "https://app.adam-ecom.online").replace(/\/$/, "");
  return `${origine}/desabo?e=${encodeURIComponent(email)}&s=${await jetonDesabo(env, email)}`;
}
async function assurerDesaboSchema(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS newsletter_desabo (email TEXT PRIMARY KEY, quand TEXT NOT NULL)").run();
}
// Page publique de désinscription. GET : bouton de confirmation (les antivirus qui
// ouvrent les liens ne désinscrivent personne). POST : désinscription en un clic
// (en-tête List-Unsubscribe-Post de Gmail) ou bouton.
async function pageDesabo(env, request, url) {
  const email = String(url.searchParams.get("e") || "").trim().toLowerCase();
  const valide = email && url.searchParams.get("s") === await jetonDesabo(env, email);
  const page = (texte, bouton) => new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>D\xE9sinscription \xB7 AdamEcom</title></head>
<body style="margin:0;background:#F4F1EA;font:16px/1.6 Helvetica,Arial,sans-serif;color:#1F1E1B;">
<div style="max-width:480px;margin:60px auto;padding:32px 24px;background:#fff;border:1px solid #E5E0D4;border-radius:12px;text-align:center;">
<h1 style="font-size:22px;margin:0 0 12px;">Newsletter AdamEcom</h1><p style="margin:0 0 20px;">${texte}</p>${bouton ? `<form method="post">
<button style="background:#F5C518;border:0;border-radius:6px;padding:14px 26px;font:700 15px Helvetica,Arial,sans-serif;cursor:pointer;">Confirmer la d\xE9sinscription</button></form>` : ""}
</div></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  if (!valide) return page("Ce lien de d\xE9sinscription n'est pas valide.", false);
  if (request.method !== "POST") return page(`Ne plus recevoir les nouveaux articles \xE0 l'adresse <b>${echapper(email)}</b> ?`, true);
  await assurerDesaboSchema(env.DB);
  await env.DB.prepare("INSERT OR IGNORE INTO newsletter_desabo (email, quand) VALUES (?, ?)").bind(email, (/* @__PURE__ */ new Date()).toISOString()).run();
  if (env.BREVO_API_KEY) {
    await brevo(env, `/contacts/${encodeURIComponent(email)}`, { method: "PUT", body: JSON.stringify({ emailBlacklisted: true }) }).catch((e) => console.error("Brevo d\xE9sabo :", e.message));
  }
  return page("C'est fait. Vous ne recevrez plus la newsletter.", false);
}
var SES_PAR_MINUTE = 15;
// Envoi progressif d'un article par Amazon SES : 15 contacts de la liste Brevo par minute.
async function newsletterSesEtape(env) {
  if (!sesActif(env)) return;
  const db = env.DB;
  const maintenant = (/* @__PURE__ */ new Date()).toISOString();
  const ligne = await db.prepare("SELECT * FROM newsletter_envois WHERE statut='ses_envoi' ORDER BY maj_le LIMIT 1").first().catch(() => null);
  if (!ligne) return;
  const prise = await db.prepare(`UPDATE newsletter_envois SET verrou_jusqua=?, maj_le=?
    WHERE guid=? AND statut='ses_envoi' AND (verrou_jusqua IS NULL OR verrou_jusqua < ?)`).bind(new Date(Date.now() + 3 * 60 * 1e3).toISOString(), maintenant, ligne.guid, maintenant).run();
  if (!prise.meta.changes) return;
  let offset = ligne.ses_offset || 0, envoyes = ligne.ses_envoyes || 0, erreurs = ligne.ses_erreurs || 0;
  // attente : minutes avant le prochain essai (problème de configuration, pause).
  const finir = (statut, erreur, attente = 0) => db.prepare(`UPDATE newsletter_envois SET ses_offset=?, ses_envoyes=?, ses_erreurs=?, statut=?, erreur=?,
    maj_le=?, verrou_jusqua=?${statut === "envoyee" ? ", envoyee_le=COALESCE(envoyee_le, ?)" : ""} WHERE guid=?`).bind(
    offset, envoyes, erreurs, statut, erreur, (/* @__PURE__ */ new Date()).toISOString(),
    attente ? new Date(Date.now() + attente * 60 * 1e3).toISOString() : null,
    ...statut === "envoyee" ? [(/* @__PURE__ */ new Date()).toISOString()] : [],
    ligne.guid
  ).run();
  try {
    if (!ligne.ses_manuel && !await emailAutorise(env, "blog_newsletter")) {
      await finir("ses_envoi", "Mod\xE8le \xAB Newsletter d'un nouvel article \xBB en pause : envoi suspendu.", 30);
      return;
    }
    const listeId = ligne.ses_liste || (await listeDestinataires(env)).id;
    const { contacts = [] } = await brevo(env, `/contacts/lists/${listeId}/contacts?limit=${SES_PAR_MINUTE}&offset=${offset}&sort=asc`);
    await assurerDesaboSchema(db);
    const emails = contacts.map((c) => String(c.email || "").trim().toLowerCase()).filter(Boolean);
    const desabo = new Set(emails.length ? (await tous2(db, `SELECT email FROM newsletter_desabo WHERE email IN (${emails.map(() => "?").join(",")})`, ...emails)).map((r) => r.email) : []);
    const article = { titre: ligne.titre, lien: ligne.lien, extrait: ligne.extrait || "", image: ligne.image || null, date: ligne.date_article || null };
    for (const c of contacts) {
      const email = String(c.email || "").trim().toLowerCase();
      if (email && !c.emailBlacklisted && !desabo.has(email)) {
        const lien = await lienDesabo(env, email);
        try {
          await envoyerSes(env, {
            de: env.SENDER_EMAIL,
            deNom: env.SENDER_NAME || "AdamEcom",
            a: email,
            objet: String(ligne.titre).slice(0, 200),
            html: construireEmail(env, article).replace("{{ unsubscribe }}", echapper(lien)),
            entetes: [
              { Name: "List-Unsubscribe", Value: `<${lien}>` },
              { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" }
            ]
          });
          envoyes++;
        } catch (e) {
          // Compte non validé, domaine non vérifié, quota atteint : on s'arrête sans
          // avancer, pour reprendre au même contact une fois le problème réglé.
          if (e.statut === 429 || e.statut >= 500 || /not verified|not authorized|suspended|Sending paused|security token|signature/i.test(e.message)) {
            await finir("ses_envoi", e.message, e.statut === 429 || e.statut >= 500 ? 2 : 30);
            await noterIncident(db, "newsletter", ligne.titre, e.message);
            return;
          }
          erreurs++;
          await noterIncident(db, "newsletter", `${ligne.titre} → ${email}`, e.message);
        }
      }
      offset++;
    }
    if (contacts.length < SES_PAR_MINUTE) {
      await finir("envoyee", null);
      await marquerTraite(db, DOMAINE2, ligne.guid);
      await noterEnvoi(env, "blog_newsletter", `${envoyes} contact(s) via Amazon SES`, ligne.titre, "envoy\xE9", erreurs ? `${erreurs} erreur(s)` : null);
    } else {
      await finir("ses_envoi", null);
    }
  } catch (e) {
    await finir("ses_envoi", String(e.message).slice(0, 500), 5);
    await noterIncident(db, "newsletter", ligne.titre, e.message);
  }
}
__name(newsletterSesEtape, "newsletterSesEtape");
// Décision manuelle sur des articles en attente : envoyer (Amazon SES) ou retirer de la file.
async function newsletterDecision(env, envoyer, guids) {
  const db = env.DB;
  await assurerNewsletterSchema(db);
  if (!guids.length) return { n: 0 };
  const maintenant = (/* @__PURE__ */ new Date()).toISOString();
  const marques = guids.map(() => "?").join(",");
  if (!envoyer) {
    const r = await db.prepare(`UPDATE newsletter_envois SET statut='ignoree', verrou_jusqua=NULL, maj_le=? WHERE guid IN (${marques}) AND statut NOT IN ('envoyee','ses_envoi')`).bind(maintenant, ...guids).run();
    for (const g of guids) await marquerTraite(db, DOMAINE2, g);
    return { n: r.meta.changes };
  }
  if (!sesActif(env)) return { erreur: "L'envoi manuel passe par Amazon SES, qui n'est pas configur\xE9." };
  const guid = guids[0];
  const ligne = await db.prepare("SELECT * FROM newsletter_envois WHERE guid=?").bind(guid).first();
  if (!ligne || ["envoyee", "ses_envoi"].includes(ligne.statut)) return { erreur: "Cet article est d\xE9j\xE0 envoy\xE9 ou en cours d'envoi." };
  let extrait = ligne.extrait, image = ligne.image, date = ligne.date_article;
  if (!extrait && env.FEED_URL) {
    try {
      const res = await fetch(env.FEED_URL, { headers: { "user-agent": "AdamEcom-newsletter/3.0" }, signal: AbortSignal.timeout(15e3) });
      const a = lireFlux(await res.text()).find((x) => x.guid === guid);
      if (a) ({ extrait, image, date } = { extrait: a.extrait, image: a.image, date: a.date });
    } catch {
    }
  }
  const liste = await listeDestinataires(env);
  await db.prepare(`UPDATE newsletter_envois SET statut='ses_envoi', campagne_id='ses', ses_manuel=1, ses_liste=?, ses_offset=0, ses_envoyes=0, ses_erreurs=0,
    extrait=?, image=?, date_article=?, destinataires=?, erreur=NULL, verrou_jusqua=NULL, maj_le=? WHERE guid=?`).bind(liste.id, extrait || "", image || null, date || null, liste.contacts, maintenant, guid).run();
  return { n: 1 };
}
__name(newsletterDecision, "newsletterDecision");
var jetonEnCache = null;
var oublierJetonShopify = /* @__PURE__ */ __name22(() => {
  jetonEnCache = null;
}, "oublierJetonShopify");
async function jetonShopify(env) {
  if (jetonEnCache && jetonEnCache.client === env.SHOPIFY_CLIENT_ID && jetonEnCache.expire > Date.now()) {
    return jetonEnCache.valeur;
  }
  const res = await fetch(`https://${env.SHOPIFY_STORE}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: env.SHOPIFY_CLIENT_ID,
      client_secret: env.SHOPIFY_CLIENT_SECRET,
      grant_type: "client_credentials"
    })
  });
  const corps = await res.text();
  if (!res.ok) throw new Error(`Jeton Shopify \u2192 ${res.status} ${corps}`);
  const d = JSON.parse(corps);
  if (!d.access_token) throw new Error(`R\xE9ponse sans access_token : ${corps}`);
  const duree = Number(d.expires_in) > 0 ? Number(d.expires_in) * 800 : 20 * 36e5;
  jetonEnCache = {
    client: env.SHOPIFY_CLIENT_ID,
    valeur: d.access_token,
    expire: Date.now() + duree
  };
  return d.access_token;
}
__name(jetonShopify, "jetonShopify");
__name2(jetonShopify, "jetonShopify");
__name22(jetonShopify, "jetonShopify");
async function shopify(env, jeton, query, variables) {
  const res = await fetch(`https://${env.SHOPIFY_STORE}/admin/api/2026-07/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": jeton, "content-type": "application/json" },
    body: JSON.stringify({ query, variables })
  });
  const corps = await res.json();
  if (corps.errors) {
    if (res.status === 401 || res.status === 403) oublierJetonShopify();
    throw new Error(`Shopify \u2192 ${JSON.stringify(corps.errors)}`);
  }
  return corps.data;
}
__name(shopify, "shopify");
__name2(shopify, "shopify");
__name22(shopify, "shopify");
var sansCasse = /* @__PURE__ */ __name22(async (fn) => {
  try {
    return await fn();
  } catch (e) {
    console.error("journal:", e.message);
  }
}, "sansCasse");
var noterExecution = /* @__PURE__ */ __name22((db, domaine, duree, statut, message) => sansCasse(() => db.prepare("INSERT INTO executions (domaine, quand, duree_ms, statut, message) VALUES (?, ?, ?, ?, ?)").bind(domaine, (/* @__PURE__ */ new Date()).toISOString(), duree, statut, message || null).run()), "noterExecution");
var noterIncident = /* @__PURE__ */ __name22((db, domaine, sujet, message) => sansCasse(() => db.prepare("INSERT INTO incidents (quand, domaine, sujet, message) VALUES (?, ?, ?, ?)").bind((/* @__PURE__ */ new Date()).toISOString(), domaine, sujet || null, String(message).slice(0, 500)).run()), "noterIncident");
var noterReservation = /* @__PURE__ */ __name22((db, r) => sansCasse(() => db.prepare(`INSERT INTO reservations
      (uri, nom, email, telephone, titre, debut, fuseau, reponses,
       commande, commande_id, consent_email, consent_sms, email_qualif, cree_le)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(uri) DO UPDATE SET
        nom=excluded.nom,email=excluded.email,telephone=excluded.telephone,titre=excluded.titre,
        debut=excluded.debut,fuseau=excluded.fuseau,reponses=excluded.reponses,
        commande=COALESCE(excluded.commande,reservations.commande),
        commande_id=COALESCE(excluded.commande_id,reservations.commande_id),
        consent_email=COALESCE(excluded.consent_email,reservations.consent_email),
        consent_sms=COALESCE(excluded.consent_sms,reservations.consent_sms),
        email_qualif=COALESCE(excluded.email_qualif,reservations.email_qualif)`).bind(
  r.uri,
  r.nom,
  r.email,
  r.telephone || null,
  r.titre,
  r.debut,
  r.fuseau || null,
  JSON.stringify(r.reponses || []),
  r.commande || null,
  r.commandeId || null,
  r.consentEmail || null,
  r.consentSms || null,
  r.emailQualif || null,
  r.creeLe || (/* @__PURE__ */ new Date()).toISOString()
).run()), "noterReservation");
var majReservation = /* @__PURE__ */ __name22((db, uri, champ, valeur) => sansCasse(() => db.prepare(`UPDATE reservations SET ${champ} = ? WHERE uri = ?`).bind(valeur, uri).run()), "majReservation");
var noterCampagne = /* @__PURE__ */ __name22((db, c) => sansCasse(() => db.prepare("INSERT OR REPLACE INTO campagnes (id, titre, lien, destinataires, envoyee_le) VALUES (?, ?, ?, ?, ?)").bind(String(c.id), c.titre, c.lien || null, c.destinataires ?? null, (/* @__PURE__ */ new Date()).toISOString()).run()), "noterCampagne");
var echapper = /* @__PURE__ */ __name22((s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"), "echapper");
var MARQUE = { jaune: "#FFDC3F", encre: "#1B1B1B", gris: "#6B6B6B", fond: "#F5F3EE" };
var DOMAINE = "calendly";
async function calendly(env, chemin) {
  const res = await fetch(`https://api.calendly.com${chemin}`, {
    headers: { authorization: `Bearer ${env.CALENDLY_TOKEN}`, accept: "application/json" }
  });
  const corps = await res.text();
  if (!res.ok) throw new Error(`Calendly GET ${chemin} \u2192 ${res.status} ${corps}`);
  return JSON.parse(corps);
}
__name(calendly, "calendly");
__name2(calendly, "calendly");
__name22(calendly, "calendly");
async function evenements(env) {
  const { resource: moi } = await calendly(env, "/users/me");
  const params = new URLSearchParams({
    user: moi.uri,
    status: "active",
    count: "100",
    min_start_time: (/* @__PURE__ */ new Date()).toISOString(),
    sort: "start_time:asc"
  });
  const { collection } = await calendly(env, `/scheduled_events?${params}`);
  return { moi, liste: collection };
}
__name(evenements, "evenements");
__name2(evenements, "evenements");
__name22(evenements, "evenements");
async function detail(env, ev) {
  const { collection } = await calendly(env, `/scheduled_events/${ev.uri.split("/").pop()}/invitees`);
  const inv = collection[0];
  if (!inv) return null;
  return {
    uri: ev.uri,
    titre: ev.name,
    debut: ev.start_time,
    fuseau: inv.timezone,
    nom: inv.name,
    email: inv.email,
    reponses: (inv.questions_and_answers || []).filter((q) => q.answer),
    annulation: inv.cancel_url,
    creeA: inv.created_at || (/* @__PURE__ */ new Date()).toISOString(),
    // Le type de rendez-vous est « outbound_call » : Calendly exige alors le
    // numéro de l'invité et le range dans le lieu, sous forme « +33 6 07 … ».
    // Shopify veut du E.164 sans espaces.
    telephone: (ev.location?.location || "").replace(/[^\d+]/g, "") || null
  };
}
__name(detail, "detail");
__name2(detail, "detail");
__name22(detail, "detail");
var MUTATION = `mutation ($input: DraftOrderInput!) {
  draftOrderCreate(input: $input) {
    draftOrder {
      id name
      customer {
        id phone
        emailMarketingConsent { marketingState }
        smsMarketingConsent { marketingState }
      }
    }
    userErrors { field message }
  }
}`;
function note(r) {
  const quand = new Date(r.debut).toLocaleString("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: r.fuseau || "Europe/Paris"
  });
  const l = [
    "Appel r\xE9serv\xE9 via Calendly",
    `Quand : ${quand}${r.fuseau ? ` (${r.fuseau})` : ""}`,
    `Type : ${r.titre}`,
    `Nom : ${r.nom}`,
    ...r.telephone ? [`T\xE9l\xE9phone : ${r.telephone}`] : []
  ];
  for (const qa of r.reponses) l.push(`${qa.question} : ${qa.answer}`);
  if (r.annulation) l.push(`Annuler / replanifier : ${r.annulation}`);
  return l.join("\n");
}
__name(note, "note");
__name2(note, "note");
__name22(note, "note");
async function creerCommande(env, jeton, r) {
  const input = {
    email: r.email,
    ...r.telephone ? { phone: r.telephone } : {},
    note: note(r),
    tags: ["calendly", "appel-decouverte"],
    visibleToCustomer: false,
    lineItems: [{
      title: `${r.titre} \u2014 ${new Date(r.debut).toLocaleDateString("fr-FR")}`,
      quantity: 1,
      requiresShipping: false,
      taxable: false,
      originalUnitPriceWithCurrency: { amount: env.LIGNE_PRIX || "0.00", currencyCode: "EUR" }
    }]
  };
  const d = await shopify(env, jeton, MUTATION, { input });
  const err = d.draftOrderCreate.userErrors;
  if (err.length) throw new Error(err.map((e) => e.message).join(" \xB7 "));
  return d.draftOrderCreate.draftOrder;
}
__name(creerCommande, "creerCommande");
__name2(creerCommande, "creerCommande");
__name22(creerCommande, "creerCommande");
var MAJ_CONSENTEMENT = `mutation ($input: CustomerEmailMarketingConsentUpdateInput!) {
  customerEmailMarketingConsentUpdate(input: $input) {
    customer { id emailMarketingConsent { marketingState consentUpdatedAt } }
    userErrors { field message }
  }
}`;
var MAJ_SMS = `mutation ($input: CustomerSmsMarketingConsentUpdateInput!) {
  customerSmsMarketingConsentUpdate(input: $input) {
    customer { id smsMarketingConsent { marketingState consentUpdatedAt } }
    userErrors { field message }
  }
}`;
var MAJ_TELEPHONE = `mutation ($input: CustomerInput!) {
  customerUpdate(input: $input) {
    customer { id phone }
    userErrors { field message }
  }
}`;
async function abonner(env, jeton, client, email, telephone) {
  const bilan = { email: "\xE9chec", sms: "\xE9chec", telephone: telephone || null };
  if (!client) {
    log(`Aucune fiche client rattach\xE9e \xE0 ${email} \u2014 consentement non pos\xE9.`);
    bilan.email = bilan.sms = "aucune fiche client";
    return bilan;
  }
  const maintenant = (/* @__PURE__ */ new Date()).toISOString();
  if (client.emailMarketingConsent?.marketingState !== "SUBSCRIBED") {
    const r2 = await shopify(env, jeton, MAJ_CONSENTEMENT, {
      input: {
        customerId: client.id,
        emailMarketingConsent: {
          marketingState: "SUBSCRIBED",
          marketingOptInLevel: "SINGLE_OPT_IN",
          consentUpdatedAt: maintenant
        }
      }
    });
    const e2 = r2.customerEmailMarketingConsentUpdate.userErrors;
    if (e2.length) {
      log(`Consentement email refus\xE9 : ${e2.map((x) => x.message).join(" \xB7 ")}`);
      bilan.email = e2[0].message;
    } else {
      log(`${email} abonn\xE9 au marketing email.`);
      bilan.email = "abonn\xE9";
    }
  } else {
    log(`${email} \xE9tait d\xE9j\xE0 abonn\xE9 \xE0 l'email.`);
    bilan.email = "d\xE9j\xE0 abonn\xE9";
  }
  if (!telephone) {
    log("Aucun num\xE9ro sur la r\xE9servation \u2014 consentement SMS ignor\xE9.");
    bilan.sms = "aucun num\xE9ro";
    return bilan;
  }
  if (!client.phone) {
    const r2 = await shopify(env, jeton, MAJ_TELEPHONE, {
      input: { id: client.id, phone: telephone }
    });
    const e2 = r2.customerUpdate.userErrors;
    if (e2.length) {
      log(`Num\xE9ro refus\xE9 (${telephone}) : ${e2.map((x) => x.message).join(" \xB7 ")}`);
      bilan.sms = `num\xE9ro refus\xE9 : ${e2[0].message}`;
      return bilan;
    }
    log(`Num\xE9ro ${telephone} enregistr\xE9.`);
  }
  if (client.smsMarketingConsent?.marketingState === "SUBSCRIBED") {
    log("D\xE9j\xE0 abonn\xE9 au SMS.");
    bilan.sms = "d\xE9j\xE0 abonn\xE9";
    return bilan;
  }
  const r = await shopify(env, jeton, MAJ_SMS, {
    input: {
      customerId: client.id,
      smsMarketingConsent: {
        marketingState: "SUBSCRIBED",
        marketingOptInLevel: "SINGLE_OPT_IN",
        consentUpdatedAt: maintenant
      }
    }
  });
  const e = r.customerSmsMarketingConsentUpdate.userErrors;
  if (e.length) {
    log(`Consentement SMS refus\xE9 : ${e.map((x) => x.message).join(" \xB7 ")}`);
    bilan.sms = e[0].message;
  } else {
    log(`${email} abonn\xE9 au marketing SMS.`);
    bilan.sms = "abonn\xE9";
  }
  return bilan;
}
__name(abonner, "abonner");
__name2(abonner, "abonner");
__name22(abonner, "abonner");
async function prevenir(env, r, commande, bilan) {
  const num = commande.id.split("/").pop();
  const lien = `https://admin.shopify.com/store/${env.SHOPIFY_STORE.split(".")[0]}/draft_orders/${num}`;
  const quand = new Date(r.debut).toLocaleString("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: r.fuseau || "Europe/Paris"
  });
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;color:${MARQUE.encre}">
  <div style="height:4px;background:${MARQUE.jaune};border-radius:2px;margin-bottom:22px"></div>
  <p style="margin:0 0 6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:${MARQUE.gris}">Nouvel appel r\xE9serv\xE9</p>
  <h1 style="margin:0 0 18px;font-size:21px">${echapper(r.nom)} \u2014 ${echapper(r.titre)}</h1>
  <table style="border-collapse:collapse;font-size:15px;width:100%">
    <tr><td style="padding:6px 0;color:${MARQUE.gris};width:110px">Quand</td><td style="padding:6px 0"><b>${echapper(quand)}</b></td></tr>
    <tr><td style="padding:6px 0;color:${MARQUE.gris}">Fuseau</td><td style="padding:6px 0">${echapper(r.fuseau || "non pr\xE9cis\xE9")}</td></tr>
    <tr><td style="padding:6px 0;color:${MARQUE.gris}">Email</td><td style="padding:6px 0"><a href="mailto:${echapper(r.email)}">${echapper(r.email)}</a></td></tr>
    <tr><td style="padding:6px 0;color:${MARQUE.gris}">T\xE9l\xE9phone</td><td style="padding:6px 0">${echapper(r.telephone || "non communiqu\xE9")}</td></tr>
    <tr><td style="padding:6px 0;color:${MARQUE.gris}">Commande</td><td style="padding:6px 0">${echapper(commande.name)}</td></tr>
    ${bilan ? `<tr><td style="padding:6px 0;color:${MARQUE.gris}">Consentements</td><td style="padding:6px 0">
      email : <b>${echapper(bilan.email)}</b> \xB7 SMS : <b>${echapper(bilan.sms)}</b></td></tr>` : ""}
  </table>
  ${r.reponses.length ? `<div style="margin-top:18px;padding:14px 16px;background:${MARQUE.fond};border-radius:8px;font-size:14px">
    ${r.reponses.map((q) => `<p style="margin:0 0 8px"><b>${echapper(q.question)}</b><br>${echapper(q.answer)}</p>`).join("")}</div>` : ""}
  <p style="margin:26px 0 0">
    <a href="${lien}" style="display:inline-block;background:${MARQUE.jaune};color:${MARQUE.encre};font-weight:700;
       padding:13px 26px;border-radius:6px;text-decoration:none">Ouvrir la commande \u2192</a></p>
  <p style="margin:22px 0 0;font-size:13px;color:${MARQUE.gris}">
    Apr\xE8s l'appel : Modifier \u2192 Ajouter un article personnalis\xE9 au vrai prix \u2192 Collecter le paiement.</p>
</div>`;
  if (await emailAutorise(env, "calendly_notif")) {
    const objetN = await objetEmail(
      env,
      "calendly_notif",
      `Appel r\xE9serv\xE9 \u2014 ${r.nom} \u2014 ${quand}`,
      { nom: r.nom, email: r.email, quand }
    );
    await envoyerEmail(env, {
      de: env.SENDER_EMAIL,
      deNom: "R\xE9servations AdamEcom",
      a: env.NOTIF_EMAIL,
      aNom: "AdamEcom",
      objet: objetN,
      html,
      repondreA: { email: r.email, name: r.nom }
    });
    await noterEnvoi(env, "calendly_notif", env.NOTIF_EMAIL, objetN, "envoy\xE9", null);
  } else {
    await noterEnvoi(env, "calendly_notif", env.NOTIF_EMAIL, null, "bloqu\xE9", "mod\xE8le en pause");
  }
}
__name(prevenir, "prevenir");
__name2(prevenir, "prevenir");
__name22(prevenir, "prevenir");
async function emailQualification(env, p) {
  const prenom = (p.nom || "").trim().split(/\s+/)[0] || "";
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:${MARQUE.encre};max-width:580px">
  <p>Bonjour ${echapper(prenom)},</p>
  <p>Nous avons bien re\xE7u votre demande de r\xE9servation d'un appel avec AdamEcom.</p>
  <p>Avant de confirmer d\xE9finitivement votre rendez-vous, nous devons d'abord \xE9tudier votre boutique,
     votre situation actuelle et vos objectifs afin de v\xE9rifier si votre profil correspond \xE0 nos accompagnements.</p>
  <p>Merci de compl\xE9ter ce court questionnaire de qualification :</p>
  <p style="margin:22px 0">
    <a href="${env.FORMULAIRE_URL}" style="display:inline-block;background:${MARQUE.jaune};color:${MARQUE.encre};
       font-weight:700;padding:14px 28px;border-radius:6px;text-decoration:none">Remplir le questionnaire \u2192</a></p>
  <p>Cela nous permettra notamment d'analyser votre boutique, votre trafic, vos performances actuelles,
     vos objectifs et votre besoin r\xE9el.</p>
  <p style="padding:14px 16px;background:#FFF6D6;border-left:4px solid ${MARQUE.jaune};border-radius:0 6px 6px 0">
    <b>Important :</b> votre rendez-vous n'est pas encore d\xE9finitivement valid\xE9.</p>
  <p>Une fois le formulaire re\xE7u, nous examinerons votre demande. Si votre boutique est \xE9ligible \xE0 un
     accompagnement AdamEcom, vous recevrez ensuite un email de confirmation avec toutes les informations
     n\xE9cessaires pour rejoindre l'appel.</p>
  <p>Si nous estimons que notre intervention n'est pas adapt\xE9e \xE0 votre situation actuelle, nous vous en
     informerons \xE9galement par email afin d'\xE9viter de vous faire perdre du temps inutilement.</p>
  <p>Merci de remplir le formulaire avec des informations aussi pr\xE9cises que possible.</p>
  <p style="margin-top:26px">\xC0 bient\xF4t,<br><b>Adam</b><br>
    <span style="color:${MARQUE.gris}">Consultant Shopify &amp; CRO<br>AdamEcom<br>
    <a href="https://adam-ecom.com" style="color:${MARQUE.gris}">adam-ecom.com</a></span></p>
</div>`;
  if (await emailAutorise(env, "calendly_qualif")) {
    const objetQ = await objetEmail(
      env,
      "calendly_qualif",
      "Votre demande d'appel AdamEcom \u2014 \xE9tape obligatoire avant validation",
      { nom: p.nom }
    );
    await envoyerEmail(env, {
      de: env.SENDER_EMAIL,
      deNom: "AdamEcom",
      a: p.email,
      aNom: p.nom,
      objet: objetQ,
      html,
      repondreA: null
    });
    await noterEnvoi(env, "calendly_qualif", p.email, objetQ, "envoy\xE9", null);
  } else {
    await noterEnvoi(env, "calendly_qualif", p.email, null, "bloqu\xE9", "mod\xE8le en pause");
  }
}
__name(emailQualification, "emailQualification");
__name2(emailQualification, "emailQualification");
__name22(emailQualification, "emailQualification");
async function viderFile(env) {
  const db = env.DB;
  const { results = [] } = await db.prepare("SELECT uri, email, nom, essais FROM file_emails WHERE envoyer_a <= ? LIMIT 20").bind((/* @__PURE__ */ new Date()).toISOString()).all();
  for (const p of results) {
    try {
      await emailQualification(env, p);
      await db.prepare("DELETE FROM file_emails WHERE uri = ?").bind(p.uri).run();
      await majReservation(db, p.uri, "email_qualif", "envoy\xE9");
      log(`Email de qualification envoy\xE9 \xE0 ${p.email}`);
    } catch (e) {
      const essais = (p.essais || 0) + 1;
      if (essais >= 5) {
        await db.prepare("DELETE FROM file_emails WHERE uri = ?").bind(p.uri).run();
        await majReservation(db, p.uri, "email_qualif", "\xE9chec");
        await noterIncident(db, "calendly", p.email, `Email de qualification abandonn\xE9 : ${e.message}`);
        log(`Email de qualification abandonn\xE9 pour ${p.email} apr\xE8s 5 essais : ${e.message}`);
      } else {
        await db.prepare("UPDATE file_emails SET essais = ? WHERE uri = ?").bind(essais, p.uri).run();
        log(`Email de qualification en \xE9chec (essai ${essais}) : ${e.message}`);
      }
    }
  }
}
__name(viderFile, "viderFile");
__name2(viderFile, "viderFile");
__name22(viderFile, "viderFile");
async function executer(env) {
  const db = env.DB;
  const { moi, liste } = await evenements(env);
  log(`Calendly : ${moi.name} \u2014 ${liste.length} rendez-vous \xE0 venir`);
  if (!await amorcageFait(db, DOMAINE)) {
    for (const ev of liste) await marquerTraite(db, DOMAINE, ev.uri);
    await marquerAmorcage(db, DOMAINE);
    log(`Amor\xE7age : ${liste.length} rendez-vous marqu\xE9s comme connus. Aucune commande.`);
    return;
  }
  const inconnus = [];
  for (const ev of liste) if (!await dejaTraite(db, DOMAINE, ev.uri)) inconnus.push(ev);
  if (inconnus.length) {
    log(`${inconnus.length} nouvelle(s) r\xE9servation(s)`);
    const jeton = await jetonShopify(env);
    for (const ev of inconnus) {
      if (!await reserver(db, DOMAINE, ev.uri)) {
        log("D\xE9j\xE0 pris en charge par une autre ex\xE9cution.");
        continue;
      }
      const r = await detail(env, ev);
      if (!r) {
        log(`Aucun invit\xE9 sur ${ev.uri} \u2014 ignor\xE9.`);
        continue;
      }
      const commande = await creerCommande(env, jeton, r);
      log(`Commande ${commande.name} cr\xE9\xE9e pour ${r.nom} <${r.email}>`);
      let bilan = null;
      try {
        bilan = await abonner(env, jeton, commande.customer, r.email, r.telephone);
      } catch (e) {
        log(`Consentement non pos\xE9 pour ${r.email} : ${e.message}`);
        await noterIncident(db, "calendly", r.email, `Consentement : ${e.message}`);
        bilan = { email: e.message, sms: e.message };
      }
      try {
        await prevenir(env, r, commande, bilan);
        log(`Notification envoy\xE9e \xE0 ${env.NOTIF_EMAIL}`);
      } catch (e) {
        log(`Notification \xE9chou\xE9e : ${e.message}`);
        await noterIncident(db, "calendly", r.email, `Notification : ${e.message}`);
      }
      const envoyerA = new Date(
        new Date(r.creeA).getTime() + Number(env.DELAI_MINUTES || 5) * 6e4
      ).toISOString();
      await db.prepare("INSERT OR IGNORE INTO file_emails (uri, email, nom, envoyer_a) VALUES (?, ?, ?, ?)").bind(r.uri, r.email, r.nom, envoyerA).run();
      log(`Email de qualification programm\xE9 pour ${envoyerA}`);
      await noterReservation(db, {
        ...r,
        commande: commande.name,
        commandeId: commande.id.split("/").pop(),
        consentEmail: bilan?.email || null,
        consentSms: bilan?.sms || null,
        emailQualif: "programm\xE9",
        creeLe: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  }
  await viderFile(env);
}
__name(executer, "executer");
__name2(executer, "executer");
__name22(executer, "executer");
var DOMAINE2 = "blog";
async function assurerNewsletterSchema(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS newsletter_envois (
    guid TEXT PRIMARY KEY,
    titre TEXT NOT NULL,
    lien TEXT,
    campagne_id TEXT,
    destinataires INTEGER,
    statut TEXT NOT NULL DEFAULT 'preparation',
    essais INTEGER NOT NULL DEFAULT 0,
    erreur TEXT,
    cree_le TEXT NOT NULL,
    maj_le TEXT NOT NULL,
    envoyee_le TEXT,
    verrou_jusqua TEXT
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_newsletter_envois_statut ON newsletter_envois(statut, maj_le)").run();
  for (const col of ["ses_liste INTEGER", "ses_offset INTEGER", "ses_envoyes INTEGER", "ses_erreurs INTEGER", "extrait TEXT", "image TEXT", "date_article TEXT", "ses_manuel INTEGER"]) {
    await db.prepare(`ALTER TABLE newsletter_envois ADD COLUMN ${col}`).run().catch(() => {
    });
  }
}
__name(assurerNewsletterSchema, "assurerNewsletterSchema");
__name2(assurerNewsletterSchema, "assurerNewsletterSchema");
__name22(assurerNewsletterSchema, "assurerNewsletterSchema");
var decoder = /* @__PURE__ */ __name22((s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").trim(), "decoder");
var balise = /* @__PURE__ */ __name22((xml, nom) => {
  const m = xml.match(new RegExp(`<${nom}[^>]*>([\\s\\S]*?)</${nom}>`));
  return m ? decoder(m[1]) : "";
}, "balise");
function lireFlux(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, bloc]) => {
    const enclos = bloc.match(/<enclosure[^>]*url="([^"]+)"/);
    return {
      titre: balise(bloc, "title"),
      lien: balise(bloc, "link"),
      guid: balise(bloc, "guid") || balise(bloc, "link"),
      date: balise(bloc, "pubDate"),
      extrait: balise(bloc, "description"),
      image: enclos ? decoder(enclos[1]) : null
    };
  });
}
__name(lireFlux, "lireFlux");
__name2(lireFlux, "lireFlux");
__name22(lireFlux, "lireFlux");
function construireEmail(env, a) {
  const date = a.date ? new Date(a.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";
  const logo = "https://cdn.shopify.com/s/files/1/0599/3873/4126/files/logo-adam-ecom.webp?v=1778514762&width=480&format=png";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${echapper(a.titre)}</title></head>
<body style="margin:0;padding:0;background:${MARQUE.fond};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${echapper(a.extrait.slice(0, 140))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${MARQUE.fond};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="max-width:600px;background:#FFFFFF;border:1px solid #E5E0D4;border-radius:12px;overflow:hidden;">
    <tr><td align="center" style="padding:28px 32px 20px;">
      <img src="${logo}" alt="AdamEcom" width="170" style="display:block;border:0;width:170px;max-width:60%;height:auto;">
    </td></tr>
    <tr><td style="padding:0 32px;"><div style="height:4px;background:${MARQUE.jaune};border-radius:2px;"></div></td></tr>
    ${a.image ? `<tr><td style="padding:24px 32px 0;">
      <a href="${echapper(a.lien)}" style="text-decoration:none;">
        <img src="${echapper(a.image)}" alt="${echapper(a.titre)}" width="536"
             style="display:block;border:0;width:100%;height:auto;border-radius:8px;"></a></td></tr>` : ""}
    <tr><td style="padding:24px 32px 0;">
      ${date ? `<p style="margin:0 0 10px;font:600 12px/1.4 Helvetica,Arial,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:${MARQUE.gris};">Nouvel article \xB7 ${echapper(date)}</p>` : ""}
      <h1 style="margin:0;font:800 25px/1.25 Helvetica,Arial,sans-serif;color:${MARQUE.encre};letter-spacing:-.02em;">
        <a href="${echapper(a.lien)}" style="color:${MARQUE.encre};text-decoration:none;">${echapper(a.titre)}</a></h1>
    </td></tr>
    <tr><td style="padding:14px 32px 0;">
      <p style="margin:0;font:400 16px/1.65 Helvetica,Arial,sans-serif;color:#44423C;">${echapper(a.extrait)}</p>
    </td></tr>
    <tr><td style="padding:26px 32px 34px;">
      <a href="${echapper(a.lien)}" style="display:inline-block;background:${MARQUE.jaune};color:${MARQUE.encre};
         font:700 15px/1 Helvetica,Arial,sans-serif;padding:15px 30px;border-radius:6px;text-decoration:none;">Lire l'article \u2192</a>
    </td></tr>
    <tr><td style="padding:20px 32px 26px;border-top:1px solid #E5E0D4;background:#FAF9F5;">
      <p style="margin:0 0 6px;font:400 12px/1.6 Helvetica,Arial,sans-serif;color:${MARQUE.gris};">
        Vous recevez cet email car vous \xEAtes abonn\xE9 aux actualit\xE9s d'<a href="https://adam-ecom.com" style="color:${MARQUE.gris};">AdamEcom</a>.</p>
      <p style="margin:0;font:400 12px/1.6 Helvetica,Arial,sans-serif;color:${MARQUE.gris};">
        <a href="{{ unsubscribe }}" style="color:${MARQUE.gris};">Se d\xE9sinscrire</a></p>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}
__name(construireEmail, "construireEmail");
__name2(construireEmail, "construireEmail");
__name22(construireEmail, "construireEmail");
async function listeDestinataires(env) {
  const { lists = [] } = await brevo(env, "/contacts/lists?limit=50");
  const voulue = (env.BREVO_LIST || "shopify-customers").trim().toLowerCase();
  const liste = lists.find((l) => l.name.trim().toLowerCase() === voulue);
  if (!liste) {
    throw new Error(`Liste "${env.BREVO_LIST}" absente. Pr\xE9sentes : ${lists.map((l) => l.name).join(", ") || "aucune"}`);
  }
  const { count } = await brevo(env, `/contacts/lists/${liste.id}/contacts?limit=1`);
  if (!count) throw new Error(`La liste "${liste.name}" ne contient aucun contact \u2014 envoi annul\xE9.`);
  return { id: liste.id, nom: liste.name, contacts: count };
}
__name(listeDestinataires, "listeDestinataires");
__name2(listeDestinataires, "listeDestinataires");
__name22(listeDestinataires, "listeDestinataires");
async function etatCampagneBrevo(env, id) {
  const campagne = await brevo(env, `/emailCampaigns/${id}`);
  return String(campagne.status || "inconnu").toLowerCase();
}
__name(etatCampagneBrevo, "etatCampagneBrevo");
__name2(etatCampagneBrevo, "etatCampagneBrevo");
__name22(etatCampagneBrevo, "etatCampagneBrevo");
async function finaliserNewsletter(db, ligne, article, liste) {
  const maintenant = (/* @__PURE__ */ new Date()).toISOString();
  await marquerTraite(db, DOMAINE2, article.guid);
  await noterCampagne(db, {
    id: ligne.campagne_id,
    titre: article.titre,
    lien: article.lien,
    destinataires: ligne.destinataires ?? liste.contacts
  });
  await db.prepare(`UPDATE newsletter_envois
    SET statut='envoyee', erreur=NULL, envoyee_le=COALESCE(envoyee_le, ?), maj_le=?, verrou_jusqua=NULL
    WHERE guid=?`).bind(maintenant, maintenant, article.guid).run();
}
__name(finaliserNewsletter, "finaliserNewsletter");
__name2(finaliserNewsletter, "finaliserNewsletter");
__name22(finaliserNewsletter, "finaliserNewsletter");
async function diagnosticNewsletter(env) {
  const db = env.DB;
  await assurerNewsletterSchema(db);
  const [execution] = await tous2(db, "SELECT quand,statut,message,duree_ms FROM executions WHERE domaine='newsletter' ORDER BY quand DESC LIMIT 1");
  const [dernierEnvoi] = await tous2(db, "SELECT guid,titre,lien,campagne_id,destinataires,statut,essais,erreur,maj_le,envoyee_le FROM newsletter_envois ORDER BY maj_le DESC LIMIT 1");
  const [{ n: enAttente = 0 } = {}] = await tous2(db, "SELECT COUNT(*) AS n FROM newsletter_envois WHERE statut!='envoyee'");
  let flux = { ok: false, article: null, erreur: null };
  try {
    const res = await fetch(env.FEED_URL, {
      headers: { "user-agent": "AdamEcom-newsletter/3.0" },
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) throw new Error(`Le flux r\xE9pond ${res.status}`);
    const articles = lireFlux(await res.text());
    if (!articles.length) throw new Error("Aucun article trouv\xE9 dans le flux Shopify.");
    flux = {
      ok: true,
      article: {
        titre: articles[0].titre,
        lien: articles[0].lien,
        guid: articles[0].guid,
        connu: await dejaTraite(db, DOMAINE2, articles[0].guid)
      },
      erreur: null
    };
  } catch (e) {
    flux.erreur = e.message;
  }
  let brevoEtat = { ok: false, liste: null, contacts: 0, expediteur_actif: false, campagnes_accessibles: false, erreur: null };
  try {
    const liste = await listeDestinataires(env);
    const { senders = [] } = await brevo(env, "/senders");
    const emailExpediteur = String(env.SENDER_EMAIL || "").trim().toLowerCase();
    const expediteur = senders.find((s) => String(s.email || "").trim().toLowerCase() === emailExpediteur);
    if (!expediteur) throw new Error("L'adresse d'exp\xE9dition configur\xE9e n'existe pas dans Brevo.");
    if (expediteur.active === false) throw new Error("L'adresse d'exp\xE9dition configur\xE9e n'est pas active dans Brevo.");
    await brevo(env, "/emailCampaigns?limit=1&sort=desc");
    brevoEtat = {
      ok: true,
      liste: liste.nom,
      contacts: liste.contacts,
      expediteur_actif: true,
      campagnes_accessibles: true,
      erreur: null
    };
  } catch (e) {
    brevoEtat.erreur = e.message;
  }
  return {
    actif_cloudflare: true,
    frequence_minutes: 15,
    execution: execution || null,
    flux,
    brevo: brevoEtat,
    en_attente: Number(enAttente || 0),
    dernier_envoi: dernierEnvoi || null
  };
}
__name(diagnosticNewsletter, "diagnosticNewsletter");
__name2(diagnosticNewsletter, "diagnosticNewsletter");
__name22(diagnosticNewsletter, "diagnosticNewsletter");
async function executer2(env) {
  const db = env.DB;
  await assurerNewsletterSchema(db);
  const res = await fetch(env.FEED_URL, {
    headers: { "user-agent": "AdamEcom-newsletter/3.0" },
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) throw new Error(`Le flux r\xE9pond ${res.status}`);
  const articles = lireFlux(await res.text());
  if (!articles.length) throw new Error("Aucun <item> dans le flux \u2014 le template du th\xE8me a-t-il chang\xE9 ?");
  log(`${articles.length} articles dans le flux`);
  if (!await amorcageFait(db, DOMAINE2)) {
    for (const a of articles) await marquerTraite(db, DOMAINE2, a.guid);
    await marquerAmorcage(db, DOMAINE2);
    log(`Amor\xE7age : ${articles.length} articles marqu\xE9s comme connus. Aucun envoi.`);
    return;
  }
  const nouveaux = [];
  for (const a of articles) if (!await dejaTraite(db, DOMAINE2, a.guid)) nouveaux.push(a);
  if (!nouveaux.length) {
    log("Rien de neuf.");
    return;
  }
  nouveaux.reverse();
  log(`${nouveaux.length} nouvel(s) article(s)`);
  if (!await emailAutorise(env, "blog_newsletter")) {
    // Envoi automatique en pause : les articles attendent dans « Articles en attente »,
    // où vous choisissez de les envoyer ou non.
    const maintenant = (/* @__PURE__ */ new Date()).toISOString();
    for (const a of nouveaux) {
      await db.prepare(`INSERT OR IGNORE INTO newsletter_envois (guid,titre,lien,statut,essais,cree_le,maj_le,extrait,image,date_article)
        VALUES (?,?,?,'preparation',0,?,?,?,?,?)`).bind(a.guid, a.titre, a.lien || null, maintenant, maintenant, a.extrait || "", a.image || null, a.date || null).run();
      await db.prepare("UPDATE newsletter_envois SET extrait=COALESCE(extrait, ?), image=COALESCE(image, ?), date_article=COALESCE(date_article, ?) WHERE guid=?").bind(a.extrait || "", a.image || null, a.date || null, a.guid).run();
    }
    log("Envoi automatique en pause : articles en attente de votre d\xE9cision.");
    return;
  }
  let liste;
  try {
    liste = await listeDestinataires(env);
  } catch (e) {
    await noterIncident(db, "blog", nouveaux[0]?.titre, e.message);
    throw e;
  }
  log(`Liste \xAB ${liste.nom} \xBB \u2014 ${liste.contacts} contacts`);
  for (const a of nouveaux) {
    const maintenant = (/* @__PURE__ */ new Date()).toISOString();
    await db.prepare(`INSERT OR IGNORE INTO newsletter_envois
      (guid,titre,lien,destinataires,statut,essais,cree_le,maj_le)
      VALUES (?,?,?,?,'preparation',0,?,?)`).bind(
      a.guid,
      a.titre,
      a.lien || null,
      liste.contacts,
      maintenant,
      maintenant
    ).run();
    // Pas parti le jour où il a été détecté : il passe dans « À envoyer », envoi manuel uniquement.
    await db.prepare(`UPDATE newsletter_envois SET statut='a_envoyer', verrou_jusqua=NULL
      WHERE guid=? AND statut NOT IN ('envoyee','ses_envoi','ignoree','a_envoyer') AND substr(cree_le,1,10) < ?`).bind(a.guid, maintenant.slice(0, 10)).run();
    if ((await db.prepare("SELECT statut FROM newsletter_envois WHERE guid=?").bind(a.guid).first())?.statut === "a_envoyer") {
      log(`\xC0 envoyer manuellement (pas parti le jour m\xEAme) : ${a.titre}`);
      continue;
    }
    const verrou = new Date(Date.now() + 10 * 60 * 1e3).toISOString();
    const prise = await db.prepare(`UPDATE newsletter_envois
      SET verrou_jusqua=?, essais=essais+1, maj_le=?
      WHERE guid=? AND statut NOT IN ('envoyee','ses_envoi') AND (verrou_jusqua IS NULL OR verrou_jusqua < ?)`).bind(verrou, maintenant, a.guid, maintenant).run();
    if (!prise.meta.changes) {
      log(`D\xE9j\xE0 pris en charge par une autre ex\xE9cution : ${a.titre}`);
      continue;
    }
    try {
      let ligne = await db.prepare("SELECT * FROM newsletter_envois WHERE guid=?").bind(a.guid).first();
      if (ligne.campagne_id && ligne.campagne_id !== "ses") {
        const etat = await etatCampagneBrevo(env, ligne.campagne_id);
        if (etat === "sent") {
          await finaliserNewsletter(db, ligne, a, liste);
          log(`Envoi confirm\xE9 chez Brevo \u2014 campagne ${ligne.campagne_id}`);
          continue;
        }
        if (["queued", "sending", "scheduled", "processed"].includes(etat)) {
          await db.prepare(`UPDATE newsletter_envois
            SET statut='envoi_demande', erreur=NULL, maj_le=?, verrou_jusqua=NULL WHERE guid=?`).bind((/* @__PURE__ */ new Date()).toISOString(), a.guid).run();
          log(`Campagne ${ligne.campagne_id} toujours en cours chez Brevo (${etat}).`);
          continue;
        }
      }
      if (sesActif(env)) {
        if (!await emailAutorise(env, "blog_newsletter")) {
          await noterEnvoi(env, "blog_newsletter", "Amazon SES", a.titre, "bloqu\xE9", "mod\xE8le en pause");
          await db.prepare("UPDATE newsletter_envois SET verrou_jusqua=NULL WHERE guid=?").bind(a.guid).run();
          continue;
        }
        await db.prepare(`UPDATE newsletter_envois
          SET statut='ses_envoi', campagne_id='ses', ses_liste=?, ses_offset=COALESCE(ses_offset,0), ses_envoyes=COALESCE(ses_envoyes,0),
            ses_erreurs=COALESCE(ses_erreurs,0), extrait=?, image=?, date_article=?, destinataires=?, erreur=NULL, maj_le=?, verrou_jusqua=NULL
          WHERE guid=?`).bind(liste.id, a.extrait || "", a.image || null, a.date || null, liste.contacts, (/* @__PURE__ */ new Date()).toISOString(), a.guid).run();
        log(`Envoi par Amazon SES programm\xE9 \u2014 \xAB ${a.titre} \xBB \u2014 ${liste.contacts} contacts, ${SES_PAR_MINUTE} par minute`);
        continue;
      }
      if (!ligne.campagne_id) {
        const { id } = await brevo(env, "/emailCampaigns", {
          method: "POST",
          body: JSON.stringify({
            name: `Blog \xB7 ${a.titre}`.slice(0, 120),
            subject: a.titre.slice(0, 120),
            sender: { name: env.SENDER_NAME, email: env.SENDER_EMAIL },
            htmlContent: construireEmail(env, a),
            recipients: { listIds: [liste.id] },
            inlineImageActivation: false
          })
        });
        await db.prepare(`UPDATE newsletter_envois
          SET campagne_id=?, destinataires=?, statut='campagne_creee', erreur=NULL, maj_le=? WHERE guid=?`).bind(String(id), liste.contacts, (/* @__PURE__ */ new Date()).toISOString(), a.guid).run();
        ligne = await db.prepare("SELECT * FROM newsletter_envois WHERE guid=?").bind(a.guid).first();
      }
      if (!await emailAutorise(env, "blog_newsletter")) {
        await noterEnvoi(env, "blog_newsletter", "liste Brevo", a.titre, "bloqu\xE9", "mod\xE8le en pause");
        continue;
      }
      await brevo(env, `/emailCampaigns/${ligne.campagne_id}/sendNow`, { method: "POST" });
      await noterEnvoi(env, "blog_newsletter", "liste Brevo", a.titre, "envoy\xE9", null);
      await db.prepare(`UPDATE newsletter_envois
        SET statut='envoi_demande', erreur=NULL, maj_le=?, verrou_jusqua=NULL WHERE guid=?`).bind((/* @__PURE__ */ new Date()).toISOString(), a.guid).run();
      const etatApres = await etatCampagneBrevo(env, ligne.campagne_id);
      if (etatApres === "sent") {
        await finaliserNewsletter(db, ligne, a, liste);
        log(`Envoy\xE9 et confirm\xE9 \u2014 campagne ${ligne.campagne_id} \u2014 \xAB ${a.titre} \xBB`);
      } else {
        log(`Envoi demand\xE9 \u2014 campagne ${ligne.campagne_id} \u2014 statut Brevo ${etatApres}`);
      }
    } catch (e) {
      await db.prepare(`UPDATE newsletter_envois
        SET statut='erreur', erreur=?, maj_le=?, verrou_jusqua=NULL WHERE guid=?`).bind(String(e.message).slice(0, 500), (/* @__PURE__ */ new Date()).toISOString(), a.guid).run();
      await noterIncident(db, "newsletter", a.titre, e.message);
      throw e;
    }
  }
}
__name(executer2, "executer2");
__name2(executer2, "executer2");
__name22(executer2, "executer");
var LOGO = "https://cdn.shopify.com/s/files/1/0599/3873/4126/files/logo-adam-ecom.webp?v=1778514762&width=560&format=png";
var euros = /* @__PURE__ */ __name22((n) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0)) + " \u20AC", "euros");
var dateFr = /* @__PURE__ */ __name22((iso) => {
  try {
    const d = new Date(iso);
    return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
  } catch {
    return iso;
  }
}, "dateFr");
var nouveauJeton = /* @__PURE__ */ __name22(() => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join(""), "nouveauJeton");
var banqueDe = /* @__PURE__ */ __name22((env) => {
  const p = env._profil || {};
  return {
    titulaire: p.banque_titulaire || env.BANQUE_TITULAIRE || "Mohamed Chaoui",
    nom: p.banque_nom || env.BANQUE_NOM || "Clear Junction Limited",
    iban: p.banque_iban || env.BANQUE_IBAN || "GB22CLJU04130741179696",
    bic: p.banque_bic || env.BANQUE_BIC || "CLJUGB21XXX",
    compte: p.banque_compte || env.BANQUE_COMPTE || "41179696",
    guichet: p.banque_guichet || env.BANQUE_GUICHET || "041307",
    adresse: p.banque_adresse || env.BANQUE_ADRESSE || "4th Floor Imperial House, 15 Kingsway, London, United Kingdom, WC2B 6UN"
  };
}, "banqueDe");
var JAUNE = "#FFDC3F";
var NOIR = "#1B1B1B";
var GRIS = "#6E6A5F";
var TRAIT = "#E6E1D5";
function gabaritFacture(f, env) {
  const b = banqueDe(env);
  const eq = /* @__PURE__ */ __name22((c) => `position:absolute;width:46px;height:46px;border:6px solid ${JAUNE};${c}`, "eq");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Facture n\xB0 ${f.numero} \u2014 AdamEcom</title>
<style>
  @page{size:A4;margin:14mm}
  *{box-sizing:border-box}
  body{margin:0;background:#E9E7E1;color:${NOIR};
    font-family:"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif;
    font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased}
  .feuille{position:relative;max-width:860px;margin:28px auto;background:#fff;
    padding:56px 62px 46px;box-shadow:0 2px 26px rgba(0,0,0,.09)}
  .eq1{${eq("top:20px;left:20px;border-right:0;border-bottom:0")}}
  .eq2{${eq("top:20px;right:20px;border-left:0;border-bottom:0")}}
  .eq3{${eq("bottom:20px;left:20px;border-right:0;border-top:0")}}
  .eq4{${eq("bottom:20px;right:20px;border-left:0;border-top:0")}}

  .logo{text-align:center;margin-bottom:38px}
  .logo img{width:310px;max-width:70%;height:auto;display:inline-block}

  .badge{display:inline-block;background:${NOIR};color:#fff;font-weight:800;
    font-size:14px;letter-spacing:.05em;padding:9px 20px}
  .parties{display:flex;gap:28px;margin-bottom:8px}
  .partie{flex:1;min-width:0}
  .partie.droite{text-align:right}
  .corps{font-size:14.5px;line-height:1.85;margin-top:14px}
  .corps .eti{color:${GRIS}}
  .nom{font-weight:800;font-size:16px}

  .bande{background:${JAUNE};text-align:center;font-weight:800;font-size:12.5px;
    letter-spacing:.18em;padding:12px;margin:38px 0 0}
  .presta{font-weight:800;font-size:17px;margin:26px 0 12px;letter-spacing:-.01em}
  .desc{font-size:15px;line-height:1.7;white-space:pre-wrap}

  .totaux{margin:38px 0 0;display:flex;justify-content:flex-end}
  .totaux table{border-collapse:collapse;min-width:290px}
  .totaux td{padding:9px 0;font-size:15px}
  .totaux td.l{color:${GRIS};padding-right:26px}
  .totaux td.v{text-align:right;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
  .totaux tr.ttc td{border-top:2px solid ${NOIR};padding-top:13px;font-size:19px;font-weight:800}

  .regler{margin:30px 0 26px;padding:15px 20px;background:${JAUNE};font-weight:800;font-size:16px}
  .banque{border:1px solid ${TRAIT};border-radius:9px;padding:20px 22px}
  .banque h3{margin:0 0 12px;font-size:12.5px;font-weight:800;letter-spacing:.14em;color:${GRIS}}
  .banque dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:7px 22px;font-size:14px}
  .banque dt{color:${GRIS};white-space:nowrap}
  .banque dd{margin:0;font-weight:600;word-break:break-word}
  .banque dd.fort{font-weight:800;letter-spacing:.02em}

  .pied{margin-top:42px;padding-top:20px;border-top:1px solid ${TRAIT};
    text-align:center;font-weight:800;font-size:14px}
  .mentions{margin-top:9px;text-align:center;font-size:11.5px;color:${GRIS};line-height:1.6}

  .barre{position:fixed;top:14px;right:14px;display:flex;gap:8px}
  .barre button{background:${JAUNE};color:${NOIR};font:700 14px/1 inherit;border:0;
    padding:12px 20px;border-radius:8px;cursor:pointer}

  @media(max-width:760px){
    body{font-size:14px}
    .feuille{margin:0;padding:34px 20px 30px;box-shadow:none}
    .eq1,.eq2,.eq3,.eq4{width:28px;height:28px;border-width:5px;top:12px;bottom:12px;left:12px;right:12px}
    .eq1,.eq2{bottom:auto}.eq3,.eq4{top:auto}.eq1,.eq3{right:auto}.eq2,.eq4{left:auto}
    .logo{margin-bottom:26px}.logo img{width:230px;max-width:66%}
    .parties{flex-direction:column;gap:22px}
    .partie.droite{text-align:left}
    .badge{display:block;text-align:center;font-size:13px;padding:9px 12px}
    .bande{letter-spacing:.1em;font-size:11.5px}
    .totaux{justify-content:stretch}.totaux table{width:100%;min-width:0}
    .banque dl{grid-template-columns:1fr;gap:2px 0}
    .banque dt{margin-top:9px;font-size:12px}
    .barre{position:static;padding:14px 20px 0}
    .barre button{width:100%}
  }
  @media print{
    body{background:#fff}
    .feuille{margin:0;padding:0;box-shadow:none;max-width:none}
    .barre{display:none}
    .eq1,.eq2,.eq3,.eq4{display:none}
    .banque,.totaux,.regler{break-inside:avoid}
  }
</style></head><body>
<div class="barre"><button onclick="window.print()">Imprimer / enregistrer en PDF</button></div>
<div class="feuille">
  <div class="eq1"></div><div class="eq2"></div><div class="eq3"></div><div class="eq4"></div>

  <div class="logo"><img src="${echapper(env._profil && env._profil.profil_logo || LOGO)}" alt="AdamEcom"></div>

  <div class="parties">
    <div class="partie">
      <span class="badge">FACTURE N\xB0 ${f.numero}</span>
      <div class="corps">
        <span class="eti">Date d'\xE9mission</span> \xB7 <b>${dateFr(f.date_facture)}</b><br>
        <span class="nom">AdamEcom</span><br>
        Consultant Shopify &amp; CRO<br>
        <span class="eti">Email</span> info@adam-ecom.com<br>
        <span class="eti">Site</span> adam-ecom.com
      </div>
    </div>
    <div class="partie droite">
      <span class="badge">FACTUR\xC9 \xC0</span>
      <div class="corps">
        <span class="nom">${echapper(f.client_nom)}</span><br>
        ${f.client_societe ? `${echapper(f.client_societe)}<br>` : ""}
        <span class="eti">Email</span> ${echapper(f.client_email)}
      </div>
    </div>
  </div>

  <div class="bande">DESCRIPTION DE LA PRESTATION</div>
  <div class="presta">${echapper(f.prestation)}</div>
  <div class="desc">${echapper(f.description)}</div>

  <div class="totaux"><table>
    <tr><td class="l">Sous-total</td><td class="v">${euros(f.montant)}</td></tr>
    <tr><td class="l">TVA</td><td class="v">non applicable</td></tr>
    <tr class="ttc"><td class="l">TOTAL TTC</td><td class="v">${euros(f.montant)}</td></tr>
  </table></div>

  <p class="regler">Montant total \xE0 r\xE9gler : ${euros(f.montant)}</p>

  <div class="banque">
    <h3>COORDONN\xC9ES BANCAIRES</h3>
    <dl>
      <dt>Titulaire</dt><dd class="fort">${echapper(b.titulaire)}</dd>
      <dt>Banque</dt><dd>${echapper(b.nom)}</dd>
      <dt>IBAN</dt><dd class="fort">${echapper(b.iban)}</dd>
      <dt>SWIFT / BIC</dt><dd>${echapper(b.bic)}</dd>
      <dt>N\xB0 de compte</dt><dd>${echapper(b.compte)}</dd>
      <dt>Sort code</dt><dd>${echapper(b.guichet)}</dd>
      <dt>Adresse</dt><dd>${echapper(b.adresse)}</dd>
    </dl>
  </div>

  <div class="pied">Adam Ecom vous remercie pour votre confiance.</div>
  <div class="mentions">
    Facture n\xB0 ${f.numero} \xB7 AdamEcom \xB7 adam-ecom.com<br>
    TVA non applicable \u2014 article 293 B du CGI. Paiement par virement bancaire.
  </div>
</div></body></html>`;
}
__name(gabaritFacture, "gabaritFacture");
__name2(gabaritFacture, "gabaritFacture");
__name22(gabaritFacture, "gabaritFacture");
function factureEmail(f, env, lien) {
  const b = banqueDe(env);
  const cell = `font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:${NOIR}`;
  const eti = `${cell};color:${GRIS};padding:3px 16px 3px 0;white-space:nowrap;vertical-align:top`;
  const val = `${cell};padding:3px 0;font-weight:600;word-break:break-word`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background:#EFEDE7;padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
    style="width:100%;max-width:600px;background:#fff;border:1px solid ${TRAIT};border-radius:10px">

    <tr><td align="center" style="padding:30px 28px 22px">
      <img src="${echapper(env._profil && env._profil.profil_logo || LOGO)}" alt="AdamEcom" width="230"
        style="display:block;border:0;width:230px;max-width:64%;height:auto"></td></tr>

    <tr><td style="padding:0 28px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="${cell};background:${NOIR};color:#fff;font-weight:800;padding:9px 16px">
          FACTURE N\xB0 ${f.numero}</td>
      </tr></table></td></tr>

    <tr><td style="padding:18px 28px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="${eti}">Date</td><td style="${val}">${dateFr(f.date_facture)}</td></tr>
        <tr><td style="${eti}">\xC9metteur</td><td style="${val}">AdamEcom \u2014 Consultant Shopify &amp; CRO</td></tr>
        <tr><td style="${eti}">Factur\xE9 \xE0</td><td style="${val}">${echapper(f.client_nom)}${f.client_societe ? ` \u2014 ${echapper(f.client_societe)}` : ""}<br>
          <span style="font-weight:400;color:${GRIS}">${echapper(f.client_email)}</span></td></tr>
      </table></td></tr>

    <tr><td style="padding:24px 28px 0">
      <div style="${cell};background:${JAUNE};text-align:center;font-weight:800;font-size:11.5px;
        letter-spacing:.14em;padding:11px">DESCRIPTION DE LA PRESTATION</div></td></tr>

    <tr><td style="padding:20px 28px 0">
      <div style="${cell};font-weight:800;font-size:16px;margin-bottom:9px">${echapper(f.prestation)}</div>
      <div style="${cell};white-space:pre-wrap">${echapper(f.description)}</div></td></tr>

    <tr><td style="padding:24px 28px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="${cell};border-top:2px solid ${NOIR};padding-top:12px;font-weight:800;font-size:17px">
          TOTAL TTC</td>
        <td align="right" style="${cell};border-top:2px solid ${NOIR};padding-top:12px;
          font-weight:800;font-size:17px;white-space:nowrap">${euros(f.montant)}</td></tr>
      </table></td></tr>

    <tr><td style="padding:20px 28px 0">
      <div style="${cell};background:${JAUNE};font-weight:800;font-size:15px;padding:13px 16px">
        Montant total \xE0 r\xE9gler : ${euros(f.montant)}</div></td></tr>

    ${lien ? `<tr><td align="center" style="padding:24px 28px 0">
      <a href="${lien}" style="${cell};display:inline-block;background:${NOIR};color:#fff;font-weight:700;
        padding:14px 28px;border-radius:7px;text-decoration:none">Voir et t\xE9l\xE9charger la facture \u2192</a></td></tr>` : ""}

    <tr><td style="padding:24px 28px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="border:1px solid ${TRAIT};border-radius:9px">
        <tr><td style="padding:16px 18px">
          <div style="${cell};color:${GRIS};font-weight:800;font-size:11.5px;letter-spacing:.12em;
            margin-bottom:10px">COORDONN\xC9ES BANCAIRES</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="${eti}">Titulaire</td><td style="${val}">${echapper(b.titulaire)}</td></tr>
            <tr><td style="${eti}">Banque</td><td style="${val}">${echapper(b.nom)}</td></tr>
            <tr><td style="${eti}">IBAN</td><td style="${val}">${echapper(b.iban)}</td></tr>
            <tr><td style="${eti}">SWIFT / BIC</td><td style="${val}">${echapper(b.bic)}</td></tr>
            <tr><td style="${eti}">N\xB0 de compte</td><td style="${val}">${echapper(b.compte)}</td></tr>
            <tr><td style="${eti}">Sort code</td><td style="${val}">${echapper(b.guichet)}</td></tr>
            <tr><td style="${eti}">Adresse</td><td style="${val}">${echapper(b.adresse)}</td></tr>
          </table></td></tr></table></td></tr>

    <tr><td align="center" style="padding:26px 28px 30px">
      <div style="${cell};font-weight:800">Adam Ecom vous remercie pour votre confiance.</div>
      <div style="${cell};font-size:11.5px;color:${GRIS};margin-top:8px">
        TVA non applicable \u2014 article 293 B du CGI. Paiement par virement bancaire.</div></td></tr>

  </table></td></tr></table>`;
}
__name(factureEmail, "factureEmail");
__name2(factureEmail, "factureEmail");
__name22(factureEmail, "factureEmail");
var listeFactures = /* @__PURE__ */ __name22(async (db, limite = 50) => {
  try {
    const { results = [] } = await db.prepare(`SELECT numero, date_facture, client_nom, client_societe, client_email,
                       prestation, montant, statut, envoyee_le, jeton,
                       payee_le, commande_shopify, commande_shopify_id, annulee_le
                FROM factures ORDER BY numero DESC LIMIT ?`).bind(limite).all();
    return results;
  } catch {
    return [];
  }
}, "listeFactures");
var lireFacture = /* @__PURE__ */ __name22((db, numero) => db.prepare("SELECT * FROM factures WHERE numero = ?").bind(numero).first(), "lireFacture");
var lireFactureParJeton = /* @__PURE__ */ __name22((db, jeton) => db.prepare("SELECT * FROM factures WHERE jeton = ?").bind(jeton).first(), "lireFactureParJeton");
async function clientsShopify(env) {
  try {
    const jeton = await jetonShopify(env);
    const d = await shopify(env, jeton, `query {
      customers(first: 100, sortKey: CREATED_AT, reverse: true) {
        nodes { id displayName firstName lastName email }
      }
    }`, {});
    return d.customers.nodes.filter((c) => c.email);
  } catch {
    return [];
  }
}
__name(clientsShopify, "clientsShopify");
__name2(clientsShopify, "clientsShopify");
__name22(clientsShopify, "clientsShopify");
async function creerFacture(env, form) {
  const nom = (form.get("client_nom") || "").trim();
  const email = (form.get("client_email") || "").trim();
  const description = (form.get("description") || "").trim();
  const prestation = (form.get("prestation") || "").trim();
  const montant = Number(String(form.get("montant") || "").replace(",", "."));
  const erreurs = [];
  if (!nom) erreurs.push("le nom du client");
  if (!email.includes("@")) erreurs.push("un email valide");
  if (!prestation) erreurs.push("le nom de la prestation");
  if (!description) erreurs.push("la description");
  if (!Number.isFinite(montant) || montant <= 0) erreurs.push("un montant sup\xE9rieur \xE0 z\xE9ro");
  if (erreurs.length) return { erreur: `Il manque ${erreurs.join(", ")}.` };
  const maintenant = (/* @__PURE__ */ new Date()).toISOString();
  const r = await env.DB.prepare(
    `INSERT INTO factures (date_facture, client_nom, client_societe, client_email,
                           prestation, description, montant, statut, jeton, cree_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'brouillon', ?, ?)`
  ).bind(
    form.get("date_facture") || maintenant.slice(0, 10),
    nom,
    (form.get("client_societe") || "").trim() || null,
    email,
    prestation,
    description,
    montant,
    nouveauJeton(),
    maintenant
  ).run();
  return { numero: r.meta.last_row_id };
}
__name(creerFacture, "creerFacture");
__name2(creerFacture, "creerFacture");
__name22(creerFacture, "creerFacture");
async function envoyerFacture(env, numero, origine) {
  const f = await lireFacture(env.DB, numero);
  if (!f) return { erreur: "Facture introuvable." };
  const lien = `${origine}/f/${f.jeton}`;
  const intro = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;
    color:#1B1B1B;max-width:600px;margin:0 auto;padding:0 12px">
    <p>Bonjour ${echapper(f.client_nom)},</p>
    <p>Veuillez trouver ci-dessous la facture <b>n\xB0 ${f.numero}</b> correspondant \xE0 la prestation
       \xAB ${echapper(f.prestation)} \xBB, d'un montant de <b>${euros(f.montant)}</b>.</p></div>`;
  const fin = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;
    color:#1B1B1B;max-width:600px;margin:0 auto;padding:18px 12px 0">
    <p>Bien \xE0 vous,<br><b>Adam</b><br>
      <span style="color:#6B6B6B">Consultant Shopify &amp; CRO \u2014 AdamEcom</span></p></div>`;
  const corps = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#EFEDE7">
    ${intro}${factureEmail(f, env, lien)}${fin}</body></html>`;
  if (!await emailAutorise(env, "facture_envoi")) {
    await noterEnvoi(env, "facture_envoi", f.client_email, null, "bloqu\xE9", "mod\xE8le en pause");
    return { erreur: "L'envoi des factures est en pause. R\xE9activez-le dans Emails automatiques." };
  }
  const objetF = await objetEmail(
    env,
    "facture_envoi",
    `Facture n\xB0 ${f.numero} \u2014 AdamEcom`,
    { numero: f.numero, client: f.client_nom, montant: euros(f.montant), prestation: f.prestation }
  );
  try {
    await brevo(env, "/smtp/email", {
      method: "POST",
      body: JSON.stringify({
        sender: { name: "AdamEcom", email: env.SENDER_EMAIL },
        to: [{ email: f.client_email, name: f.client_nom }],
        replyTo: { email: env.SENDER_EMAIL, name: "AdamEcom" },
        subject: objetF,
        htmlContent: corps
      })
    });
    await noterEnvoi(env, "facture_envoi", f.client_email, objetF, "envoy\xE9", null);
  } catch (e) {
    await noterEnvoi(env, "facture_envoi", f.client_email, objetF, "\xE9chec", e.message);
    return { erreur: `Envoi refus\xE9 : ${e.message}` };
  }
  await env.DB.prepare("UPDATE factures SET statut='envoy\xE9e', envoyee_le=? WHERE numero=?").bind((/* @__PURE__ */ new Date()).toISOString(), numero).run();
  return { ok: true, email: f.client_email };
}
__name(envoyerFacture, "envoyerFacture");
__name2(envoyerFacture, "envoyerFacture");
__name22(envoyerFacture, "envoyerFacture");
var CREER_COMMANDE = `mutation ($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
  orderCreate(order: $order, options: $options) {
    order { id name }
    userErrors { field message }
  }
}`;
async function marquerPayee(env, numero) {
  const f = await lireFacture(env.DB, numero);
  if (!f) return { erreur: "Facture introuvable." };
  if (f.commande_shopify_id) return { erreur: `D\xE9j\xE0 encaiss\xE9e \u2014 commande ${f.commande_shopify}.` };
  const order = {
    email: f.client_email,
    note: [
      `Facture n\xB0 ${f.numero}`,
      `Prestation : ${f.prestation}`,
      f.client_societe ? `Soci\xE9t\xE9 : ${f.client_societe}` : null,
      "",
      f.description
    ].filter((l) => l !== null).join("\n").replace(/^([\s\S]{4900})[\s\S]+$/, `$1\u2026\n(description compl\xE8te sur la facture n\xB0 ${f.numero})`),
    tags: ["facture", "prestation"],
    financialStatus: "PAID",
    sourceName: "Facture AdamEcom",
    processedAt: (/* @__PURE__ */ new Date()).toISOString(),
    lineItems: [{
      title: `${f.prestation} \u2014 facture n\xB0 ${f.numero}`,
      quantity: 1,
      requiresShipping: false,
      taxable: false,
      priceSet: { shopMoney: { amount: String(f.montant), currencyCode: "EUR" } }
    }]
  };
  const options = { sendReceipt: false, sendFulfillmentReceipt: false, inventoryBehaviour: "BYPASS" };
  let commande;
  try {
    const jeton = await jetonShopify(env);
    const d = await shopify(env, jeton, CREER_COMMANDE, { order, options });
    const err = d.orderCreate.userErrors;
    if (err.length) return { erreur: err.map((e) => e.message).join(" \xB7 ") };
    commande = d.orderCreate.order;
  } catch (e) {
    return { erreur: `Shopify a refus\xE9 : ${e.message}` };
  }
  await env.DB.prepare(
    `UPDATE factures SET statut='pay\xE9e', payee_le=?, commande_shopify=?, commande_shopify_id=?
     WHERE numero=?`
  ).bind((/* @__PURE__ */ new Date()).toISOString(), commande.name, commande.id.split("/").pop(), numero).run();
  return { ok: true, commande: commande.name, id: commande.id.split("/").pop() };
}
__name(marquerPayee, "marquerPayee");
// Email « Paiement bien reçu » envoyé au client après « Marquer comme payée ».
async function envoyerConfirmationPaiement(env, numero, origine) {
  const f = await lireFacture(env.DB, numero);
  if (!f?.client_email) return { erreur: "pas d'email client sur la facture" };
  if (!await emailAutorise(env, "facture_payee")) {
    await noterEnvoi(env, "facture_payee", f.client_email, null, "bloqu\xE9", "mod\xE8le en pause");
    return { pause: true };
  }
  const valeurs = { numero: f.numero, client: f.client_nom, montant: euros(f.montant), prestation: f.prestation };
  const def = EMAILS.find((m) => m.id === "facture_payee");
  const perso = await env.DB.prepare("SELECT intro FROM emails_modeles WHERE id = ?").bind("facture_payee").first().catch(() => null);
  const intro = remplirGabarit(perso?.intro || def.intro, valeurs);
  const objet = await objetEmail(env, "facture_payee", remplirGabarit(def.objet, valeurs), valeurs);
  const lien = `${origine}/f/${f.jeton}`;
  const corps = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:24px 0;background:#EFEDE7">
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#1B1B1B;max-width:600px;margin:0 auto;padding:24px;background:#fff;border-radius:10px">
      <p>Bonjour ${echapper(f.client_nom || "")},</p>
      <p>${echapper(intro).replace(/\n/g, "<br>")}</p>
      <p style="margin:24px 0"><a href="${echapper(lien)}" style="display:inline-block;background:#3F7A34;color:#fff;font-weight:700;padding:13px 24px;border-radius:6px;text-decoration:none">Voir ma facture</a></p>
      <p>Bien \xE0 vous,<br><b>Adam</b><br><span style="color:#6B6B6B">Consultant Shopify &amp; CRO \u2014 AdamEcom</span></p>
    </div></body></html>`;
  try {
    await brevo(env, "/smtp/email", {
      method: "POST",
      body: JSON.stringify({
        sender: { name: "AdamEcom", email: env.SENDER_EMAIL },
        to: [{ email: f.client_email, name: f.client_nom }],
        replyTo: { email: env.SENDER_EMAIL, name: "AdamEcom" },
        subject: objet,
        htmlContent: corps
      })
    });
    await noterEnvoi(env, "facture_payee", f.client_email, objet, "envoy\xE9", null);
    return { ok: true, email: f.client_email };
  } catch (e) {
    await noterEnvoi(env, "facture_payee", f.client_email, objet, "\xE9chec", e.message);
    return { erreur: e.message };
  }
}
__name(envoyerConfirmationPaiement, "envoyerConfirmationPaiement");
__name2(marquerPayee, "marquerPayee");
__name22(marquerPayee, "marquerPayee");
async function modifierFacture(env, numero, form) {
  const f = await lireFacture(env.DB, numero);
  if (!f) return { erreur: "Facture introuvable." };
  if (f.statut !== "brouillon") {
    return { erreur: "Seul un brouillon peut \xEAtre modifi\xE9. Annulez cette facture et cr\xE9ez-en une nouvelle." };
  }
  const nom = (form.get("client_nom") || "").trim();
  const email = (form.get("client_email") || "").trim();
  const prestation = (form.get("prestation") || "").trim();
  const description = (form.get("description") || "").trim();
  const montant = Number(String(form.get("montant") || "").replace(",", "."));
  const erreurs = [];
  if (!nom) erreurs.push("le nom du client");
  if (!email.includes("@")) erreurs.push("un email valide");
  if (!prestation) erreurs.push("le nom de la prestation");
  if (!description) erreurs.push("la description");
  if (!Number.isFinite(montant) || montant <= 0) erreurs.push("un montant sup\xE9rieur \xE0 z\xE9ro");
  if (erreurs.length) return { erreur: `Il manque ${erreurs.join(", ")}.` };
  await env.DB.prepare(
    `UPDATE factures SET date_facture=?, client_nom=?, client_societe=?, client_email=?,
                         prestation=?, description=?, montant=? WHERE numero=?`
  ).bind(
    form.get("date_facture") || f.date_facture,
    nom,
    (form.get("client_societe") || "").trim() || null,
    email,
    prestation,
    description,
    montant,
    numero
  ).run();
  return { ok: true };
}
__name(modifierFacture, "modifierFacture");
__name2(modifierFacture, "modifierFacture");
__name22(modifierFacture, "modifierFacture");
async function annulerFacture(env, numero, motif, prevenirClient) {
  const f = await lireFacture(env.DB, numero);
  if (!f) return { erreur: "Facture introuvable." };
  if (f.statut === "annul\xE9e") return { erreur: "Cette facture est d\xE9j\xE0 annul\xE9e." };
  if (f.commande_shopify_id) {
    return {
      erreur: `Facture d\xE9j\xE0 encaiss\xE9e \u2014 commande ${f.commande_shopify}. Annulez ou remboursez d'abord la commande dans Shopify : je ne touche pas \xE0 un encaissement enregistr\xE9.`
    };
  }
  await env.DB.prepare(
    "UPDATE factures SET statut='annul\xE9e', annulee_le=?, motif_annulation=? WHERE numero=?"
  ).bind((/* @__PURE__ */ new Date()).toISOString(), (motif || "").trim() || null, numero).run();
  if (prevenirClient && f.statut === "envoy\xE9e") {
    try {
      await brevo(env, "/smtp/email", {
        method: "POST",
        body: JSON.stringify({
          sender: { name: "AdamEcom", email: env.SENDER_EMAIL },
          to: [{ email: f.client_email, name: f.client_nom }],
          subject: await objetEmail(
            env,
            "facture_annulation",
            `Annulation de la facture n\xB0 ${f.numero} \u2014 AdamEcom`,
            { numero: f.numero, client: f.client_nom, montant: euros(f.montant) }
          ),
          htmlContent: `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;
            line-height:1.65;color:#1B1B1B;max-width:560px">
            <p>Bonjour ${echapper(f.client_nom)},</p>
            <p>La facture <b>n\xB0 ${f.numero}</b> d'un montant de <b>${euros(f.montant)}</b>
               est <b>annul\xE9e</b> et ne doit pas \xEAtre r\xE9gl\xE9e.</p>
            ${motif ? `<p style="padding:12px 15px;background:#FFF6D6;border-left:4px solid #FFDC3F">
              ${echapper(motif)}</p>` : ""}
            <p>Une facture corrig\xE9e vous parviendra si n\xE9cessaire. Toutes nos excuses pour la g\xEAne.</p>
            <p style="margin-top:24px">Bien \xE0 vous,<br><b>Adam</b><br>
              <span style="color:#6B6B6B">AdamEcom</span></p></div>`
        })
      });
    } catch (e) {
      return { ok: true, avertissement: `Facture annul\xE9e, mais l'email au client a \xE9chou\xE9 : ${e.message}` };
    }
    return { ok: true, prevenu: true };
  }
  return { ok: true };
}
__name(annulerFacture, "annulerFacture");
__name2(annulerFacture, "annulerFacture");
__name22(annulerFacture, "annulerFacture");
// ─── Devis ───────────────────────────────────────────────────────────────
// Même charte que la facture. Le contenu est collé en texte libre : les lignes
// commençant par « - », « • », « ✓ » ou « 1. » deviennent des puces, les lignes
// terminées par « : » ou en majuscules deviennent des intertitres, et un prix en
// fin de ligne (« … — 150 € ») est aligné à droite.
var devisSchemaOk = false;
async function assurerDevisSchema(db) {
  if (devisSchemaOk) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS devis (
    numero          INTEGER PRIMARY KEY AUTOINCREMENT,
    date_devis      TEXT NOT NULL,
    validite_jours  INTEGER NOT NULL DEFAULT 30,
    client_nom      TEXT NOT NULL,
    client_societe  TEXT,
    client_email    TEXT NOT NULL,
    client_telephone TEXT,
    client_adresse  TEXT,
    titre           TEXT NOT NULL,
    contenu         TEXT NOT NULL,
    montant         REAL NOT NULL,
    acompte_pct     INTEGER NOT NULL DEFAULT 50,
    delai_livraison TEXT NOT NULL,
    conditions      TEXT,
    statut          TEXT NOT NULL DEFAULT 'brouillon',
    envoye_le       TEXT,
    facture_numero  INTEGER,
    jeton           TEXT NOT NULL,
    cree_le         TEXT NOT NULL
  )`).run();
  for (const col of ["express_delai TEXT", "express_prix REAL"]) {
    await db.prepare(`ALTER TABLE devis ADD COLUMN ${col}`).run().catch(() => {
    });
  }
  devisSchemaOk = true;
}
__name22(assurerDevisSchema, "assurerDevisSchema");
var DEVIS_PREMIER_NUMERO = 8754;
var numeroDevis = /* @__PURE__ */ __name22((d) => String(d.numero), "numeroDevis");
var finValiditeDevis = /* @__PURE__ */ __name22((d) => {
  const t = new Date(String(d.date_devis).slice(0, 10) + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + Number(d.validite_jours || 30));
  return t.toISOString();
}, "finValiditeDevis");
var PUCE_DEVIS = /^\s*(?:[-–—•*·▪►✓✔✅☑→>]|\d{1,2}[.)])\s+/;
var PRIX_DEVIS = /\s*(?:[:=\-–—|]|\.{2,})\s*(\d[\d\s .,]*)\s*(?:€|euros?|eur)\s*(?:HT|TTC)?\s*$/i;
function formaterContenuDevis(texte) {
  const lignes = String(texte || "").replace(/\r/g, "").split("\n");
  const blocs = [];
  let liste = null;
  const fermer = /* @__PURE__ */ __name22(() => {
    if (liste) blocs.push(`<ul class="inclus">${liste.join("")}</ul>`);
    liste = null;
  }, "fermer");
  const ligneHtml = /* @__PURE__ */ __name22((t) => {
    let prix = "";
    const m = t.match(PRIX_DEVIS);
    if (m && m.index > 0) {
      prix = `<span class="prix">${echapper(m[1].trim())} \u20AC</span>`;
      t = t.slice(0, m.index);
    }
    const deux = t.match(/^([^:]{2,60}?)\s:\s*(.+)$/) || t.match(/^([^:]{2,60}?):\s+(.+)$/);
    const texteHtml = deux ? `<b>${echapper(deux[1].trim())}</b> : ${echapper(deux[2].trim())}` : echapper(t);
    return `<span class="ltxt">${texteHtml}</span>${prix}`;
  }, "ligneHtml");
  for (const brute of lignes) {
    const l = brute.trim();
    if (!l) {
      fermer();
      continue;
    }
    const lettres = l.replace(/[^A-Za-zÀ-ÿ]/g, "");
    const titre = /^#{1,4}\s+/.test(l) || l.length <= 50 && /:\s*$/.test(l) && !PUCE_DEVIS.test(l) || lettres.length >= 4 && l.length <= 70 && lettres === lettres.toUpperCase() && !PUCE_DEVIS.test(l);
    if (titre) {
      fermer();
      blocs.push(`<h4 class="intertitre">${echapper(l.replace(/^#{1,4}\s+/, "").replace(/\s*:\s*$/, ""))}</h4>`);
      continue;
    }
    if (PUCE_DEVIS.test(l)) {
      if (!liste) liste = [];
      liste.push(`<li>${ligneHtml(l.replace(PUCE_DEVIS, ""))}</li>`);
      continue;
    }
    fermer();
    blocs.push(`<p class="para">${ligneHtml(l)}</p>`);
  }
  fermer();
  return blocs.join("\n");
}
__name22(formaterContenuDevis, "formaterContenuDevis");
function gabaritDevis(d, env) {
  const p = env._profil || {};
  const num = numeroDevis(d);
  const acompte = Math.round(Number(d.montant) * Number(d.acompte_pct || 0)) / 100;
  const solde = Math.round((Number(d.montant) - acompte) * 100) / 100;
  const eq = /* @__PURE__ */ __name22((c) => `position:absolute;width:46px;height:46px;border:6px solid ${JAUNE};${c}`, "eq");
  const paiement = Number(d.acompte_pct) >= 100 ? "100 % \xE0 la signature du devis" : Number(d.acompte_pct) > 0 ? `${d.acompte_pct} % \xE0 la signature, solde \xE0 la livraison` : "100 % \xE0 la livraison";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Devis n\xB0 ${num} \u2014 ${echapper(p.profil_nom || "AdamEcom")}</title>
<style>
  @page{size:A4;margin:14mm}
  *{box-sizing:border-box}
  body{margin:0;background:#E9E7E1;color:${NOIR};
    font-family:"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif;
    font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased}
  .feuille{position:relative;max-width:860px;margin:28px auto;background:#fff;
    padding:56px 62px 46px;box-shadow:0 2px 26px rgba(0,0,0,.09)}
  .eq1{${eq("top:20px;left:20px;border-right:0;border-bottom:0")}}
  .eq2{${eq("top:20px;right:20px;border-left:0;border-bottom:0")}}
  .eq3{${eq("bottom:20px;left:20px;border-right:0;border-top:0")}}
  .eq4{${eq("bottom:20px;right:20px;border-left:0;border-top:0")}}
  .logo{text-align:center;margin-bottom:38px}
  .logo img{width:310px;max-width:70%;height:auto;display:inline-block}
  .badge{display:inline-block;background:${NOIR};color:#fff;font-weight:800;
    font-size:14px;letter-spacing:.05em;padding:9px 20px}
  .parties{display:flex;gap:28px;margin-bottom:8px}
  .partie{flex:1;min-width:0}
  .partie.droite{text-align:right}
  .corps{font-size:14.5px;line-height:1.85;margin-top:14px}
  .corps .eti{color:${GRIS}}
  .nom{font-weight:800;font-size:16px}
  .adresse{white-space:pre-line}

  .bande{background:${JAUNE};text-align:center;font-weight:800;font-size:12.5px;
    letter-spacing:.18em;padding:12px;margin:38px 0 0}
  .presta{font-weight:800;font-size:19px;margin:26px 0 14px;letter-spacing:-.01em}
  .intertitre{margin:22px 0 8px;font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
    padding-bottom:6px;border-bottom:1px solid ${TRAIT}}
  .para{margin:8px 0;font-size:15px;line-height:1.7}
  ul.inclus{list-style:none;margin:6px 0 10px;padding:0}
  ul.inclus li{position:relative;padding:7px 0 7px 30px;font-size:15px;line-height:1.6;
    border-bottom:1px dashed ${TRAIT};display:flex;gap:16px;align-items:baseline}
  ul.inclus li:last-child{border-bottom:0}
  ul.inclus li::before{content:"";position:absolute;left:2px;top:12px;width:14px;height:14px;
    background:${JAUNE};border-radius:3px}
  ul.inclus li::after{content:"";position:absolute;left:6px;top:14px;width:4px;height:7px;
    border:solid ${NOIR};border-width:0 2px 2px 0;transform:rotate(45deg)}
  .ltxt{flex:1}
  .prix{margin-left:auto;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}

  .infos{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:34px 0 0}
  .info{border:1px solid ${TRAIT};border-radius:9px;padding:14px 16px}
  .info .k{font-size:11.5px;font-weight:800;letter-spacing:.12em;color:${GRIS};text-transform:uppercase}
  .info .v{font-weight:800;font-size:15.5px;margin-top:4px}

  .express{display:flex;gap:16px;align-items:center;justify-content:space-between;margin:12px 0 0;
    border:2px solid ${JAUNE};background:#FFFBE6;border-radius:9px;padding:14px 18px}
  .express .k{font-size:11.5px;font-weight:800;letter-spacing:.12em;color:${GRIS};text-transform:uppercase}
  .express .v{font-weight:700;font-size:15px;margin-top:3px}
  .express .px{font-weight:800;font-size:18px;white-space:nowrap}
  .totaux{margin:34px 0 0;display:flex;justify-content:flex-end}
  .totaux table{border-collapse:collapse;min-width:320px}
  .totaux td{padding:9px 0;font-size:15px}
  .totaux td.l{color:${GRIS};padding-right:26px}
  .totaux td.v{text-align:right;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
  .totaux tr.ttc td{border-top:2px solid ${NOIR};padding-top:13px;font-size:19px;font-weight:800}
  .totaux tr.ac td{font-size:14px}

  .conditions{margin:30px 0 0;font-size:13.5px;line-height:1.7;color:#3D3A33;white-space:pre-line;
    background:#F7F5F0;border-radius:9px;padding:16px 20px}
  .conditions b{display:block;font-size:11.5px;letter-spacing:.12em;color:${GRIS};margin-bottom:4px}


  .pied{margin-top:42px;padding-top:20px;border-top:1px solid ${TRAIT};
    text-align:center;font-weight:800;font-size:14px}
  .mentions{margin-top:9px;text-align:center;font-size:11.5px;color:${GRIS};line-height:1.6}

  .barre{position:fixed;top:14px;right:14px;display:flex;gap:8px}
  .barre button{background:${JAUNE};color:${NOIR};font:700 14px/1 inherit;border:0;
    padding:12px 20px;border-radius:8px;cursor:pointer}
  .barre button.sec{background:#fff;border:1px solid ${TRAIT}}
  body.pdf{background:#fff}
  body.pdf .barre,body.pdf .eq1,body.pdf .eq2,body.pdf .eq3,body.pdf .eq4{display:none}
  body.pdf .feuille{margin:0 auto;box-shadow:none;width:794px;max-width:none;padding:0 56px}

  @media(max-width:760px){
    body{font-size:14px}
    .feuille{margin:0;padding:34px 20px 30px;box-shadow:none}
    .eq1,.eq2,.eq3,.eq4{width:28px;height:28px;border-width:5px;top:12px;bottom:12px;left:12px;right:12px}
    .eq1,.eq2{bottom:auto}.eq3,.eq4{top:auto}.eq1,.eq3{right:auto}.eq2,.eq4{left:auto}
    .logo{margin-bottom:26px}.logo img{width:230px;max-width:66%}
    .parties{flex-direction:column;gap:22px}
    .partie.droite{text-align:left}
    .badge{display:block;text-align:center;font-size:13px;padding:9px 12px}
    .bande{letter-spacing:.1em;font-size:11.5px}
    .infos{grid-template-columns:1fr}
    .totaux{justify-content:stretch}.totaux table{width:100%;min-width:0}
    .barre{position:static;padding:14px 20px 0}
    .barre button{width:100%}
  }
  @media print{
    body{background:#fff}
    .feuille{margin:0;padding:0;box-shadow:none;max-width:none}
    .barre{display:none}
    .eq1,.eq2,.eq3,.eq4{display:none}
    .infos,.totaux,.conditions,ul.inclus li{break-inside:avoid}
  }
</style></head><body>
<div class="barre"><button onclick="telechargerPdf()">T\xE9l\xE9charger le PDF</button><button class="sec" onclick="window.print()">Imprimer</button></div>
<div class="feuille">
  <div class="eq1"></div><div class="eq2"></div><div class="eq3"></div><div class="eq4"></div>

  <div class="logo"><img src="${echapper(/^https?:/.test(p.profil_logo || LOGO) ? "/logo-devis" : p.profil_logo)}" alt="${echapper(p.profil_nom || "AdamEcom")}"></div>

  <div class="parties">
    <div class="partie">
      <span class="badge">DEVIS N\xB0 ${num}</span>
      <div class="corps">
        <span class="eti">Date</span> \xB7 <b>${dateFr(d.date_devis)}</b><br>
        <span class="eti">Valable jusqu'au</span> \xB7 <b>${dateFr(finValiditeDevis(d))}</b><br>
        <span class="nom">${echapper(p.profil_nom || "AdamEcom")}</span><br>
        ${p.profil_activite ? `${echapper(p.profil_activite)}<br>` : ""}
        ${p.profil_email ? `<span class="eti">Email</span> ${echapper(p.profil_email)}<br>` : ""}
        ${p.profil_telephone ? `<span class="eti">T\xE9l.</span> ${echapper(p.profil_telephone)}<br>` : ""}
        ${p.profil_site ? `<span class="eti">Site</span> ${echapper(p.profil_site)}` : ""}
      </div>
    </div>
    <div class="partie droite">
      <span class="badge">ADRESS\xC9 \xC0</span>
      <div class="corps">
        <span class="nom">${echapper(d.client_nom)}</span><br>
        ${d.client_societe ? `${echapper(d.client_societe)}<br>` : ""}
        ${d.client_adresse ? `<span class="adresse">${echapper(d.client_adresse)}</span><br>` : ""}
        ${d.client_email ? `<span class="eti">Email</span> ${echapper(d.client_email)}` : ""}
        ${d.client_telephone ? `<br><span class="eti">T\xE9l.</span> ${echapper(d.client_telephone)}` : ""}
      </div>
    </div>
  </div>

  <div class="bande">CE QUI EST INCLUS</div>
  <div class="presta">${echapper(d.titre)}</div>
  ${formaterContenuDevis(d.contenu)}

  <div class="infos">
    <div class="info"><div class="k">D\xE9lai de livraison</div><div class="v">${echapper(d.delai_livraison)}</div></div>
    <div class="info"><div class="k">Paiement</div><div class="v">${paiement}</div></div>
    <div class="info"><div class="k">Validit\xE9 du devis</div><div class="v">${Number(d.validite_jours || 30)} jours</div></div>
  </div>
  ${d.express_prix ? `<div class="express"><div><div class="k">Option \xB7 Livraison express</div>
      <div class="v">Livraison en ${echapper(d.express_delai || "")} au lieu de ${echapper(d.delai_livraison)}</div></div>
    <div class="px">+ ${euros(d.express_prix)}</div></div>` : ""}

  <div class="totaux"><table>
    <tr><td class="l">Sous-total</td><td class="v">${euros(d.montant)}</td></tr>
    <tr><td class="l">TVA</td><td class="v">non applicable</td></tr>
    <tr class="ttc"><td class="l">TOTAL TTC</td><td class="v">${euros(d.montant)}</td></tr>
    ${Number(d.acompte_pct) > 0 && Number(d.acompte_pct) < 100 ? `
    <tr class="ac"><td class="l">Acompte \xE0 la signature (${d.acompte_pct} %)</td><td class="v">${euros(acompte)}</td></tr>
    <tr class="ac"><td class="l">Solde \xE0 la livraison</td><td class="v">${euros(solde)}</td></tr>` : ""}
    ${d.express_prix ? `<tr class="ac"><td class="l">Total avec livraison express</td><td class="v">${euros(Number(d.montant) + Number(d.express_prix))}</td></tr>` : ""}
  </table></div>

  ${d.conditions ? `<div class="conditions"><b>CONDITIONS PARTICULI\xC8RES</b>${echapper(d.conditions)}</div>` : ""}

  <div class="pied">${echapper(p.profil_remerciement || "Adam Ecom vous remercie pour votre confiance.")}</div>
  <div class="mentions">
    Devis n\xB0 ${num} \xB7 ${echapper(p.profil_nom || "AdamEcom")}${p.profil_site ? ` \xB7 ${echapper(p.profil_site)}` : ""}<br>
    ${echapper(p.profil_mentions || "TVA non applicable \u2014 article 293 B du CGI. Paiement par virement bancaire.")}
  </div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
<script>
function telechargerPdf(){
  if(!window.html2pdf){ window.print(); return; }
  document.body.classList.add('pdf'); window.scrollTo(0, 0);
  return html2pdf().set({
    margin:[12,0,12,0], filename:'Devis-${num}.pdf',
    image:{type:'jpeg',quality:0.97},
    html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff'},
    jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
    pagebreak:{mode:['css','legacy'],avoid:['.infos','.totaux','.conditions','li','.intertitre']}
  }).from(document.querySelector('.feuille')).save().then(function(){ document.body.classList.remove('pdf'); });
}
if(/[?&]telecharger=1/.test(location.search)){
  window.addEventListener('load', function(){ setTimeout(telechargerPdf, 300); });
}
<\/script></body></html>`;
}
__name22(gabaritDevis, "gabaritDevis");
var lireDevis = /* @__PURE__ */ __name22((db, numero) => db.prepare("SELECT * FROM devis WHERE numero = ?").bind(numero).first(), "lireDevis");
var lireDevisParJeton = /* @__PURE__ */ __name22((db, jeton) => db.prepare("SELECT * FROM devis WHERE jeton = ?").bind(jeton).first(), "lireDevisParJeton");
function champsDevis(form) {
  const v = /* @__PURE__ */ __name22((k) => String(form.get(k) || "").trim(), "v");
  const montant = Number(v("montant").replace(/[^\d,.]/g, "").replace(",", "."));
  const acompte = Math.min(100, Math.max(0, Number.parseInt(v("acompte_pct") || "50", 10) || 0));
  const validite = Math.min(365, Math.max(1, Number.parseInt(v("validite_jours") || "30", 10) || 30));
  const c = {
    date_devis: v("date_devis") || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    validite_jours: validite,
    client_nom: v("client_nom"),
    client_societe: v("client_societe") || null,
    client_email: v("client_email"),
    client_telephone: v("client_telephone") || null,
    client_adresse: v("client_adresse") || null,
    titre: v("titre"),
    contenu: v("contenu"),
    montant,
    acompte_pct: acompte,
    delai_livraison: v("delai_livraison"),
    conditions: v("conditions") || null,
    express_delai: form.get("express") === "1" ? v("express_delai") || null : null,
    express_prix: form.get("express") === "1" ? Number(v("express_prix").replace(/[^\d,.]/g, "").replace(",", ".")) || null : null
  };
  const erreurs = [];
  if (!c.client_nom) erreurs.push("le nom du client");
  if (c.client_email && !c.client_email.includes("@")) erreurs.push("un email valide (ou laissez le champ vide)");
  if (form.get("express") === "1" && (!c.express_delai || !c.express_prix)) erreurs.push("le d\xE9lai et le tarif de la livraison express");
  if (!c.titre) erreurs.push("le titre du projet");
  if (!c.contenu) erreurs.push("ce qui est inclus");
  if (!c.delai_livraison) erreurs.push("le d\xE9lai de livraison");
  if (!Number.isFinite(montant) || montant <= 0) erreurs.push("un prix sup\xE9rieur \xE0 z\xE9ro");
  return erreurs.length ? { erreur: `Il manque ${erreurs.join(", ")}.` } : { c };
}
__name22(champsDevis, "champsDevis");
var COLONNES_DEVIS = ["date_devis", "validite_jours", "client_nom", "client_societe", "client_email", "client_telephone", "client_adresse", "titre", "contenu", "montant", "acompte_pct", "delai_livraison", "conditions", "express_delai", "express_prix"];
async function creerDevis(env, form) {
  await assurerDevisSchema(env.DB);
  const { c, erreur } = champsDevis(form);
  if (erreur) return { erreur };
  const r = await env.DB.prepare(
    `INSERT INTO devis (numero, ${COLONNES_DEVIS.join(", ")}, statut, jeton, cree_le)
     SELECT MAX(?, COALESCE(MAX(numero), 0) + 1), ${COLONNES_DEVIS.map(() => "?").join(", ")}, 'brouillon', ?, ? FROM devis`
  ).bind(DEVIS_PREMIER_NUMERO, ...COLONNES_DEVIS.map((k) => c[k]), nouveauJeton(), (/* @__PURE__ */ new Date()).toISOString()).run();
  return { numero: r.meta.last_row_id };
}
__name22(creerDevis, "creerDevis");
async function modifierDevis(env, numero, form) {
  await assurerDevisSchema(env.DB);
  const d = await lireDevis(env.DB, numero);
  if (!d) return { erreur: "Devis introuvable." };
  const { c, erreur } = champsDevis(form);
  if (erreur) return { erreur };
  await env.DB.prepare(`UPDATE devis SET ${COLONNES_DEVIS.map((k) => `${k}=?`).join(", ")} WHERE numero=?`).bind(...COLONNES_DEVIS.map((k) => c[k]), numero).run();
  return { ok: true };
}
__name22(modifierDevis, "modifierDevis");
async function statutDevis(env, numero, statut) {
  await assurerDevisSchema(env.DB);
  if (!["accept\xE9", "refus\xE9", "envoy\xE9", "brouillon"].includes(statut)) return { erreur: "Statut inconnu." };
  const d = await lireDevis(env.DB, numero);
  if (!d) return { erreur: "Devis introuvable." };
  if (d.facture_numero) return { erreur: "Ce devis a d\xE9j\xE0 \xE9t\xE9 factur\xE9." };
  await env.DB.prepare("UPDATE devis SET statut=? WHERE numero=?").bind(statut, numero).run();
  return { ok: true };
}
__name22(statutDevis, "statutDevis");
async function supprimerDevis(env, numero) {
  await assurerDevisSchema(env.DB);
  const d = await lireDevis(env.DB, numero);
  if (!d) return { erreur: "Devis introuvable." };
  await env.DB.prepare("DELETE FROM devis WHERE numero=?").bind(numero).run();
  await assurerContratsSchema(env.DB);
  await env.DB.prepare("DELETE FROM contrats WHERE devis_numero=?").bind(numero).run();
  return { ok: true };
}
__name22(supprimerDevis, "supprimerDevis");
async function facturerDevis(env, numero) {
  await assurerDevisSchema(env.DB);
  const d = await lireDevis(env.DB, numero);
  if (!d) return { erreur: "Devis introuvable." };
  if (d.facture_numero) return { numero: d.facture_numero };
  const form = new FormData();
  form.set("client_nom", d.client_nom);
  form.set("client_societe", d.client_societe || "");
  form.set("client_email", d.client_email);
  form.set("prestation", d.titre);
  form.set("description", `${d.contenu}

D\xE9lai de livraison : ${d.delai_livraison}
Selon devis n\xB0 ${numeroDevis(d)} du ${dateFr(d.date_devis)}.`);
  form.set("montant", String(d.montant));
  if (!d.client_email) return { erreur: "Une facture a besoin de l'email du client : ajoutez-le au devis avec \xAB Modifier \xBB, puis recommencez." };
  const r = await creerFacture(env, form);
  if (r.erreur) return r;
  await env.DB.prepare("UPDATE devis SET statut='factur\xE9', facture_numero=? WHERE numero=?").bind(r.numero, numero).run();
  return { numero: r.numero };
}
__name22(facturerDevis, "facturerDevis");
async function envoyerDevis(env, numero, origine) {
  await assurerDevisSchema(env.DB);
  const d = await lireDevis(env.DB, numero);
  if (!d) return { erreur: "Devis introuvable." };
  const p = env._profil || {};
  const num = numeroDevis(d);
  const lien = `${origine}/d/${d.jeton}`;
  if (!d.client_email) return { erreur: "Ce devis n'a pas d'email client. Ajoutez-le avec \xAB Modifier \xBB, ou t\xE9l\xE9chargez le PDF pour l'envoyer vous-m\xEAme." };
  if (!await emailAutorise(env, "devis_envoi")) {
    await noterEnvoi(env, "devis_envoi", d.client_email, null, "bloqu\xE9", "mod\xE8le en pause");
    return { erreur: "L'envoi des devis est en pause. R\xE9activez-le dans Emails automatiques." };
  }
  const cell = `font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:${NOIR}`;
  const corps = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:24px 12px;background:#EFEDE7">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"
      style="width:100%;max-width:600px;background:#fff;border:1px solid ${TRAIT};border-radius:10px">
      <tr><td align="center" style="padding:30px 28px 18px">
        <img src="${echapper(p.profil_logo || LOGO)}" alt="${echapper(p.profil_nom || "AdamEcom")}" width="230"
          style="display:block;border:0;width:230px;max-width:64%;height:auto"></td></tr>
      <tr><td style="padding:0 28px;${cell}">
        <p>Bonjour ${echapper(d.client_nom)},</p>
        <p>Comme convenu, voici mon devis <b>n\xB0 ${num}</b> pour \xAB ${echapper(d.titre)} \xBB.</p></td></tr>
      <tr><td style="padding:6px 28px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="${cell};color:${GRIS};padding:4px 0">Montant</td>
            <td align="right" style="${cell};font-weight:800;padding:4px 0">${euros(d.montant)}</td></tr>
          <tr><td style="${cell};color:${GRIS};padding:4px 0">D\xE9lai de livraison</td>
            <td align="right" style="${cell};font-weight:700;padding:4px 0">${echapper(d.delai_livraison)}</td></tr>
          <tr><td style="${cell};color:${GRIS};padding:4px 0">Valable jusqu'au</td>
            <td align="right" style="${cell};font-weight:700;padding:4px 0">${dateFr(finValiditeDevis(d))}</td></tr>
        </table></td></tr>
      <tr><td align="center" style="padding:24px 28px 8px">
        <a href="${lien}" style="${cell};display:inline-block;background:${NOIR};color:#fff;font-weight:700;
          padding:14px 28px;border-radius:7px;text-decoration:none">Voir et t\xE9l\xE9charger le devis \u2192</a></td></tr>
      <tr><td style="padding:14px 28px 28px;${cell}">
        <p>Pour valider, il vous suffit de r\xE9pondre \xE0 cet email.</p>
        <p>Bien \xE0 vous,<br><b>Adam</b><br>
          <span style="color:${GRIS}">${echapper(p.profil_activite || "Consultant Shopify & CRO")} \u2014 ${echapper(p.profil_nom || "AdamEcom")}</span></p></td></tr>
    </table></body></html>`;
  const objet = await objetEmail(env, "devis_envoi", `Devis n\xB0 ${num} \u2014 ${d.titre}`, { numero: num, client: d.client_nom, montant: euros(d.montant), titre: d.titre });
  try {
    await brevo(env, "/smtp/email", {
      method: "POST",
      body: JSON.stringify({
        sender: { name: p.profil_nom || "AdamEcom", email: env.SENDER_EMAIL },
        to: [{ email: d.client_email, name: d.client_nom }],
        replyTo: { email: env.SENDER_EMAIL, name: p.profil_nom || "AdamEcom" },
        subject: objet,
        htmlContent: corps
      })
    });
    await noterEnvoi(env, "devis_envoi", d.client_email, objet, "envoy\xE9", null);
  } catch (e) {
    await noterEnvoi(env, "devis_envoi", d.client_email, objet, "\xE9chec", e.message);
    return { erreur: `Envoi refus\xE9 : ${e.message}` };
  }
  await env.DB.prepare("UPDATE devis SET statut=CASE WHEN statut='brouillon' THEN 'envoy\xE9' ELSE statut END, envoye_le=? WHERE numero=?").bind((/* @__PURE__ */ new Date()).toISOString(), numero).run();
  return { ok: true, email: d.client_email };
}
__name22(envoyerDevis, "envoyerDevis");
// ─── Contrats ────────────────────────────────────────────────────────────
// Un contrat par devis, qui porte le même numéro. Les clauses sont pré-remplies
// à partir du devis et restent modifiables tant que le client n'a pas signé.
// Chaque partie signe en dessinant sa signature (image PNG stockée en base).
var contratsSchemaOk = false;
async function assurerContratsSchema(db) {
  if (contratsSchemaOk) return;
  await assurerDevisSchema(db);
  await db.prepare(`CREATE TABLE IF NOT EXISTS contrats (
    devis_numero      INTEGER PRIMARY KEY,
    jeton             TEXT NOT NULL,
    clauses           TEXT NOT NULL,
    presta_nom        TEXT,
    presta_signature  TEXT,
    presta_signe_le   TEXT,
    client_signataire TEXT,
    client_signature  TEXT,
    client_signe_le   TEXT,
    client_ip         TEXT,
    envoye_le         TEXT,
    cree_le           TEXT NOT NULL
  )`).run();
  contratsSchemaOk = true;
}
__name22(assurerContratsSchema, "assurerContratsSchema");
var modalitesDevis = /* @__PURE__ */ __name22((d) => {
  const pct = Number(d.acompte_pct || 0);
  const acompte = Math.round(Number(d.montant) * pct) / 100;
  if (pct >= 100) return `La totalit\xE9 du prix est payable \xE0 la signature du pr\xE9sent contrat.`;
  if (pct <= 0) return `La totalit\xE9 du prix est payable \xE0 la livraison.`;
  return `Un acompte de ${pct} %, soit ${euros(acompte)}, est payable \xE0 la signature du pr\xE9sent contrat ; le solde de ${euros(Number(d.montant) - acompte)} est payable \xE0 la livraison.`;
}, "modalitesDevis");
function clausesParDefaut(d) {
  const articles = [
    ["OBJET", `Le pr\xE9sent contrat d\xE9finit les conditions dans lesquelles le Prestataire r\xE9alise pour le Client la prestation \xAB ${d.titre} \xBB, d\xE9crite ci-dessus et dans le devis n\xB0 ${numeroDevis(d)} du ${dateFr(d.date_devis)}, qui fait partie int\xE9grante du contrat.`],
    ["D\xC9LAI DE R\xC9ALISATION", `La prestation sera livr\xE9e dans un d\xE9lai de ${d.delai_livraison} \xE0 compter de la r\xE9ception de l'acompte et de l'ensemble des \xE9l\xE9ments n\xE9cessaires fournis par le Client (acc\xE8s, contenus, visuels). Tout retard dans la transmission de ces \xE9l\xE9ments d\xE9cale d'autant la date de livraison.`],
    ["PRIX ET MODALIT\xC9S DE PAIEMENT", `Le prix total de la prestation est de ${euros(d.montant)} TTC (TVA non applicable, article 293 B du CGI). ${modalitesDevis(d)} Les paiements s'effectuent par virement bancaire.`],
    ["OBLIGATIONS DU CLIENT", `Le Client s'engage \xE0 fournir au Prestataire les acc\xE8s, informations et contenus n\xE9cessaires, \xE0 r\xE9pondre dans des d\xE9lais raisonnables aux demandes de validation, et \xE0 r\xE9gler les sommes dues aux \xE9ch\xE9ances pr\xE9vues.`],
    ["OBLIGATIONS DU PRESTATAIRE", `Le Prestataire s'engage \xE0 r\xE9aliser la prestation avec soin et selon les r\xE8gles de l'art, et \xE0 tenir le Client inform\xE9 de son avancement. Il est tenu \xE0 une obligation de moyens.`],
    ["DEMANDES SUPPL\xC9MENTAIRES", `Toute demande ne figurant pas dans le devis fera l'objet d'un devis compl\xE9mentaire, soumis \xE0 l'accord du Client avant r\xE9alisation.`],
    ["PROPRI\xC9T\xC9 DES LIVRABLES", `Les livrables deviennent la propri\xE9t\xE9 du Client apr\xE8s paiement int\xE9gral du prix. Le Prestataire peut mentionner la r\xE9alisation dans ses r\xE9f\xE9rences commerciales, sauf refus \xE9crit du Client.`],
    ["CONFIDENTIALIT\xC9", `Chaque partie s'engage \xE0 garder confidentielles les informations de l'autre partie dont elle a connaissance \xE0 l'occasion du contrat.`],
    ["R\xC9SILIATION", `En cas de manquement grave de l'une des parties, non r\xE9par\xE9 dans les quinze jours suivant une mise en demeure, l'autre partie peut r\xE9silier le contrat. Les travaux r\xE9alis\xE9s jusqu'\xE0 la r\xE9siliation restent dus et l'acompte vers\xE9 reste acquis au Prestataire.`],
    ["DROIT APPLICABLE", `Le pr\xE9sent contrat est soumis au droit fran\xE7ais. En cas de litige, les parties rechercheront une solution amiable avant toute action judiciaire.`]
  ];
  if (d.conditions) articles.push(["CONDITIONS PARTICULI\xC8RES", d.conditions]);
  return articles.map(([t, c], i) => `ARTICLE ${i + 1} — ${t}
${c}`).join("\n\n");
}
__name22(clausesParDefaut, "clausesParDefaut");
var lireContrat = /* @__PURE__ */ __name22((db, numero) => db.prepare("SELECT * FROM contrats WHERE devis_numero = ?").bind(numero).first(), "lireContrat");
var lireContratParJeton = /* @__PURE__ */ __name22((db, jeton) => db.prepare("SELECT * FROM contrats WHERE jeton = ?").bind(jeton).first(), "lireContratParJeton");
var statutContrat = /* @__PURE__ */ __name22((c) => c.client_signature && c.presta_signature ? "sign\xE9" : c.client_signature ? "sign\xE9 par le client" : c.presta_signature ? "en attente du client" : c.envoye_le ? "envoy\xE9" : "brouillon", "statutContrat");
async function creerContrat(env, numero) {
  await assurerContratsSchema(env.DB);
  const d = await lireDevis(env.DB, numero);
  if (!d) return { erreur: "Devis introuvable." };
  if (await lireContrat(env.DB, numero)) return { ok: true };
  const p = env._profil || {};
  await env.DB.prepare(`INSERT INTO contrats (devis_numero, jeton, clauses, presta_nom, cree_le) VALUES (?, ?, ?, ?, ?)`).bind(numero, nouveauJeton(), clausesParDefaut(d), p.profil_nom || "AdamEcom", (/* @__PURE__ */ new Date()).toISOString()).run();
  return { ok: true };
}
__name22(creerContrat, "creerContrat");
async function modifierContrat(env, numero, form) {
  await assurerContratsSchema(env.DB);
  const c = await lireContrat(env.DB, numero);
  if (!c) return { erreur: "Contrat introuvable." };
  if (c.client_signature) return { erreur: "Le client a d\xE9j\xE0 sign\xE9 : le contrat ne peut plus \xEAtre modifi\xE9." };
  const clauses = String(form.get("clauses") || "").trim();
  const nom = String(form.get("presta_nom") || "").trim();
  if (!clauses) return { erreur: "Les clauses ne peuvent pas \xEAtre vides." };
  // Modifier le texte annule une signature d\xE9j\xE0 pos\xE9e : on signe ce qu'on a lu.
  await env.DB.prepare("UPDATE contrats SET clauses=?, presta_nom=?, presta_signature=CASE WHEN clauses=? THEN presta_signature ELSE NULL END, presta_signe_le=CASE WHEN clauses=? THEN presta_signe_le ELSE NULL END WHERE devis_numero=?").bind(clauses, nom || c.presta_nom, clauses, clauses, numero).run();
  return { ok: true };
}
__name22(modifierContrat, "modifierContrat");
var signatureValide = /* @__PURE__ */ __name22((s) => typeof s === "string" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s) && s.length > 200 && s.length < 3e5, "signatureValide");
async function signerContratPresta(env, numero, form) {
  await assurerContratsSchema(env.DB);
  const c = await lireContrat(env.DB, numero);
  if (!c) return { erreur: "Contrat introuvable." };
  const sig = String(form.get("signature") || "");
  if (!signatureValide(sig)) return { erreur: "Dessinez votre signature avant de valider." };
  await env.DB.prepare("UPDATE contrats SET presta_signature=?, presta_signe_le=? WHERE devis_numero=?").bind(sig, (/* @__PURE__ */ new Date()).toISOString(), numero).run();
  return { ok: true };
}
__name22(signerContratPresta, "signerContratPresta");
async function signerContratClient(env, jeton, form, ip) {
  await assurerContratsSchema(env.DB);
  const c = await lireContratParJeton(env.DB, jeton);
  if (!c) return { erreur: "Contrat introuvable." };
  if (c.client_signature) return { erreur: "Ce contrat est d\xE9j\xE0 sign\xE9." };
  const nom = String(form.get("nom") || "").trim().slice(0, 120);
  const sig = String(form.get("signature") || "");
  if (!nom) return { erreur: "Indiquez votre nom et pr\xE9nom." };
  if (form.get("accepte") !== "1") return { erreur: "Cochez la case \xAB Lu et approuv\xE9 \xBB." };
  if (!signatureValide(sig)) return { erreur: "Dessinez votre signature dans le cadre." };
  const maintenant = (/* @__PURE__ */ new Date()).toISOString();
  await env.DB.prepare("UPDATE contrats SET client_signataire=?, client_signature=?, client_signe_le=?, client_ip=? WHERE jeton=? AND client_signature IS NULL").bind(nom, sig, maintenant, ip || null, jeton).run();
  await env.DB.prepare("UPDATE devis SET statut='accept\xE9' WHERE numero=? AND statut IN ('brouillon','envoy\xE9','refus\xE9')").bind(c.devis_numero).run();
  const d = await lireDevis(env.DB, c.devis_numero);
  if (env.NOTIF_EMAIL && d) {
    await brevo(env, "/smtp/email", {
      method: "POST",
      body: JSON.stringify({
        sender: { name: "AdamEcom", email: env.SENDER_EMAIL },
        to: [{ email: env.NOTIF_EMAIL }],
        subject: `Contrat n\xB0 ${numeroDevis(d)} sign\xE9 par ${nom}`,
        htmlContent: `<p><b>${echapper(nom)}</b> vient de signer le contrat n\xB0 ${numeroDevis(d)} (\xAB ${echapper(d.titre)} \xBB, ${euros(d.montant)}).</p>`
      })
    }).catch(() => {
    });
  }
  return { ok: true };
}
__name22(signerContratClient, "signerContratClient");
async function envoyerContrat(env, numero, origine) {
  await assurerContratsSchema(env.DB);
  const c = await lireContrat(env.DB, numero);
  const d = c && await lireDevis(env.DB, numero);
  if (!c || !d) return { erreur: "Contrat introuvable." };
  const p = env._profil || {};
  const num = numeroDevis(d);
  const lien = `${origine}/c/${c.jeton}`;
  if (!d.client_email) return { erreur: "Ce devis n'a pas d'email client : copiez le lien de signature pour l'envoyer par WhatsApp." };
  if (!await emailAutorise(env, "contrat_envoi")) {
    await noterEnvoi(env, "contrat_envoi", d.client_email, null, "bloqu\xE9", "mod\xE8le en pause");
    return { erreur: "L'envoi des contrats est en pause. R\xE9activez-le dans Emails automatiques." };
  }
  const cell = `font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:${NOIR}`;
  const corps = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:24px 12px;background:#EFEDE7">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"
      style="width:100%;max-width:600px;background:#fff;border:1px solid ${TRAIT};border-radius:10px">
      <tr><td align="center" style="padding:30px 28px 18px">
        <img src="${echapper(p.profil_logo || LOGO)}" alt="${echapper(p.profil_nom || "AdamEcom")}" width="230"
          style="display:block;border:0;width:230px;max-width:64%;height:auto"></td></tr>
      <tr><td style="padding:0 28px;${cell}">
        <p>Bonjour ${echapper(d.client_nom)},</p>
        <p>Voici le contrat <b>n\xB0 ${num}</b> pour \xAB ${echapper(d.titre)} \xBB (${euros(d.montant)}).
          Vous pouvez le lire et le signer en ligne en deux minutes, depuis votre ordinateur ou votre t\xE9l\xE9phone.</p></td></tr>
      <tr><td align="center" style="padding:18px 28px 8px">
        <a href="${lien}" style="${cell};display:inline-block;background:${NOIR};color:#fff;font-weight:700;
          padding:14px 28px;border-radius:7px;text-decoration:none">Lire et signer le contrat →</a></td></tr>
      <tr><td style="padding:14px 28px 28px;${cell}">
        <p>Bien \xE0 vous,<br><b>Adam</b><br>
          <span style="color:${GRIS}">${echapper(p.profil_activite || "Consultant Shopify & CRO")} — ${echapper(p.profil_nom || "AdamEcom")}</span></p></td></tr>
    </table></body></html>`;
  const objet = await objetEmail(env, "contrat_envoi", `Contrat n\xB0 ${num} \xE0 signer — ${d.titre}`, { numero: num, client: d.client_nom, titre: d.titre });
  try {
    await brevo(env, "/smtp/email", {
      method: "POST",
      body: JSON.stringify({
        sender: { name: p.profil_nom || "AdamEcom", email: env.SENDER_EMAIL },
        to: [{ email: d.client_email, name: d.client_nom }],
        replyTo: { email: env.SENDER_EMAIL, name: p.profil_nom || "AdamEcom" },
        subject: objet,
        htmlContent: corps
      })
    });
    await noterEnvoi(env, "contrat_envoi", d.client_email, objet, "envoy\xE9", null);
  } catch (e) {
    await noterEnvoi(env, "contrat_envoi", d.client_email, objet, "\xE9chec", e.message);
    return { erreur: `Envoi refus\xE9 : ${e.message}` };
  }
  await env.DB.prepare("UPDATE contrats SET envoye_le=? WHERE devis_numero=?").bind((/* @__PURE__ */ new Date()).toISOString(), numero).run();
  return { ok: true, email: d.client_email };
}
__name22(envoyerContrat, "envoyerContrat");
// Cadre de signature \xE0 la souris ou au doigt ; remplit l'input cach\xE9 #sig en PNG.
var PAVE_SIGNATURE = `<div class="pave"><canvas id="pave" width="600" height="200"></canvas>
  <button type="button" class="effacer" onclick="effacerPave()">Effacer</button></div>
<input type="hidden" name="signature" id="sig">
<script>
(function(){
  var cv=document.getElementById('pave'),cx=cv.getContext('2d'),trace=false,vide=true,der=null;
  cx.lineWidth=2.4;cx.lineCap='round';cx.lineJoin='round';cx.strokeStyle='#14120E';
  function pos(e){var r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)*cv.width/r.width,y:(e.clientY-r.top)*cv.height/r.height};}
  cv.addEventListener('pointerdown',function(e){trace=true;der=pos(e);cv.setPointerCapture(e.pointerId);e.preventDefault();});
  cv.addEventListener('pointermove',function(e){if(!trace)return;var p=pos(e);cx.beginPath();cx.moveTo(der.x,der.y);cx.lineTo(p.x,p.y);cx.stroke();der=p;vide=false;e.preventDefault();});
  function fin(){if(!trace)return;trace=false;document.getElementById('sig').value=vide?'':cv.toDataURL('image/png');}
  cv.addEventListener('pointerup',fin);cv.addEventListener('pointercancel',fin);
  window.effacerPave=function(){cx.clearRect(0,0,cv.width,cv.height);vide=true;document.getElementById('sig').value='';};
})();
<\/script>`;
var STYLE_PAVE = `.pave{position:relative;border:1.5px dashed #BDB6A5;border-radius:9px;background:#fff;max-width:600px}
  .pave canvas{display:block;width:100%;height:auto;aspect-ratio:3/1;touch-action:none;cursor:crosshair}
  .pave .effacer{position:absolute;top:8px;right:8px;background:#F3F0E9;border:0;border-radius:6px;padding:6px 10px;font:600 12px/1 inherit;cursor:pointer;color:#14120E}`;
// Chaque article (titre + texte) reste group\xE9 pour ne pas \xEAtre coup\xE9 entre deux pages du PDF.
function articlesContrat(clauses) {
  const groupes = [];
  for (const bloc of String(clauses || "").replace(/\r/g, "").split(/\n\s*\n/)) {
    const premiere = bloc.trim().split("\n")[0] || "";
    const lettres = premiere.replace(/[^A-Za-z\xC0-\xFF]/g, "");
    const titre = /^ARTICLE\b/i.test(premiere) || lettres.length >= 4 && premiere.length <= 70 && lettres === lettres.toUpperCase();
    if (titre || !groupes.length) groupes.push([bloc]);
    else groupes[groupes.length - 1].push(bloc);
  }
  return groupes.map((g) => `<div class="article">${formaterContenuDevis(g.join("\n\n"))}</div>`).join("\n");
}
__name22(articlesContrat, "articlesContrat");
function gabaritContrat(c, d, env, opts = {}) {
  const p = env._profil || {};
  const num = numeroDevis(d);
  const eq = /* @__PURE__ */ __name22((x) => `position:absolute;width:46px;height:46px;border:6px solid ${JAUNE};${x}`, "eq");
  const logo = /^https?:/.test(p.profil_logo || LOGO) ? "/logo-devis" : p.profil_logo;
  const bloc = /* @__PURE__ */ __name22((titre, nom, sig, le, mention) => `<div class="case">
      <div class="k">${titre}</div>
      <div class="qui">${echapper(nom || "")}</div>
      ${sig ? `<img class="sigimg" src="${echapper(sig)}" alt="Signature">
        <div class="s">${mention ? "Lu et approuv\xE9 \xB7 " : ""}sign\xE9 \xE9lectroniquement le ${dateFr(le)}</div>` : `<div class="attente">En attente de signature</div>`}
    </div>`, "bloc");
  const formClient = !c.client_signature && opts.public ? `
  <div class="signer" id="signer">
    <h3>Signer le contrat</h3>
    ${opts.erreur ? `<div class="err">${echapper(opts.erreur)}</div>` : ""}
    <form method="POST" onsubmit="if(!document.getElementById('sig').value){alert('Dessinez votre signature dans le cadre.');return false;}">
      <label>Nom et pr\xE9nom<input name="nom" required value="${echapper(d.client_nom)}"></label>
      <label style="margin-top:14px">Votre signature <span class="aide">(\xE0 la souris ou au doigt)</span></label>
      ${PAVE_SIGNATURE}
      <label class="coche"><input type="checkbox" name="accepte" value="1" required>
        J'ai lu le contrat et je l'accepte (\xAB Lu et approuv\xE9 \xBB).</label>
      <button type="submit">Signer le contrat</button>
    </form>
  </div>` : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Contrat n\xB0 ${num} — ${echapper(p.profil_nom || "AdamEcom")}</title>
<style>
  @page{size:A4;margin:14mm}
  *{box-sizing:border-box}
  body{margin:0;background:#E9E7E1;color:${NOIR};
    font-family:"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif;
    font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased}
  .feuille{position:relative;max-width:860px;margin:28px auto;background:#fff;
    padding:56px 62px 46px;box-shadow:0 2px 26px rgba(0,0,0,.09)}
  .eq1{${eq("top:20px;left:20px;border-right:0;border-bottom:0")}}
  .eq2{${eq("top:20px;right:20px;border-left:0;border-bottom:0")}}
  .eq3{${eq("bottom:20px;left:20px;border-right:0;border-top:0")}}
  .eq4{${eq("bottom:20px;right:20px;border-left:0;border-top:0")}}
  .logo{text-align:center;margin-bottom:30px}
  .logo img{width:280px;max-width:66%;height:auto;display:inline-block}
  h1{text-align:center;font-size:22px;letter-spacing:.06em;margin:0 0 4px}
  .sous{text-align:center;color:${GRIS};font-size:13.5px;margin-bottom:34px}
  .badge{display:inline-block;background:${NOIR};color:#fff;font-weight:800;
    font-size:13px;letter-spacing:.05em;padding:8px 18px}
  .parties{display:flex;gap:28px}
  .partie{flex:1;min-width:0}
  .corps{font-size:14.5px;line-height:1.85;margin-top:12px}
  .corps .eti{color:${GRIS}}
  .nom{font-weight:800;font-size:16px}
  .adresse{white-space:pre-line}
  .bande{background:${JAUNE};text-align:center;font-weight:800;font-size:12.5px;
    letter-spacing:.18em;padding:12px;margin:36px 0 0}
  .presta{font-weight:800;font-size:18px;margin:24px 0 12px}
  .intertitre{margin:22px 0 8px;font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
    padding-bottom:6px;border-bottom:1px solid ${TRAIT}}
  .para{margin:8px 0;font-size:14.5px;line-height:1.7;text-align:justify}
  ul.inclus{list-style:none;margin:6px 0 10px;padding:0}
  ul.inclus li{position:relative;padding:6px 0 6px 30px;font-size:14.5px;line-height:1.6;
    border-bottom:1px dashed ${TRAIT};display:flex;gap:16px;align-items:baseline}
  ul.inclus li:last-child{border-bottom:0}
  ul.inclus li::before{content:"";position:absolute;left:2px;top:11px;width:14px;height:14px;background:${JAUNE};border-radius:3px}
  ul.inclus li::after{content:"";position:absolute;left:6px;top:13px;width:4px;height:7px;
    border:solid ${NOIR};border-width:0 2px 2px 0;transform:rotate(45deg)}
  .ltxt{flex:1}.prix{margin-left:auto;font-weight:700;white-space:nowrap}
  .infos{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:26px 0 0}
  .info{border:1px solid ${TRAIT};border-radius:9px;padding:14px 16px}
  .info .k{font-size:11.5px;font-weight:800;letter-spacing:.12em;color:${GRIS};text-transform:uppercase}
  .info .v{font-weight:800;font-size:15px;margin-top:4px}
  .fait{margin:34px 0 0;font-size:14.5px}
  .accord{margin:16px 0 0;display:flex;gap:22px}
  .accord .case{flex:1;border:1px solid ${TRAIT};border-radius:9px;padding:14px 18px;min-height:170px}
  .accord .k{font-size:11.5px;font-weight:800;letter-spacing:.12em;color:${GRIS}}
  .accord .qui{font-weight:800;margin-top:4px}
  .accord .s{font-size:12px;color:${GRIS};margin-top:2px}
  .accord .attente{margin-top:34px;color:#B3AC9C;font-size:13px;font-style:italic}
  .sigimg{display:block;max-width:100%;height:80px;object-fit:contain;object-position:left;margin-top:8px}
  .pied{margin-top:38px;padding-top:18px;border-top:1px solid ${TRAIT};text-align:center;font-size:11.5px;color:${GRIS}}
  .signer{max-width:860px;margin:0 auto 40px;background:#fff;padding:28px 62px 34px;box-shadow:0 2px 26px rgba(0,0,0,.09);
    border-top:6px solid ${JAUNE}}
  .signer h3{margin:0 0 14px;font-size:18px}
  .signer label{display:block;font-weight:700;font-size:14px}
  .signer .aide{font-weight:400;color:${GRIS}}
  .signer input[name=nom]{display:block;width:100%;max-width:420px;margin-top:6px;padding:11px 13px;font:15px inherit;
    border:1px solid ${TRAIT};border-radius:8px}
  .signer .pave{margin-top:8px}
  .signer .coche{display:flex;gap:10px;align-items:center;font-weight:400;margin:16px 0}
  .signer button[type=submit]{background:${NOIR};color:#fff;font:700 15px/1 inherit;border:0;padding:15px 28px;border-radius:8px;cursor:pointer}
  .signer .err{background:#FAEAE4;color:#9E3319;padding:10px 14px;border-radius:8px;margin-bottom:14px}
  .ok{max-width:860px;margin:0 auto 20px;background:#E8F1E4;color:#2F6B2A;padding:14px 20px;border-radius:9px;font-weight:700}
  ${STYLE_PAVE}
  .barre{position:fixed;top:14px;right:14px;display:flex;gap:8px;z-index:5}
  .barre button,.barre a{background:${JAUNE};color:${NOIR};font:700 14px/1 inherit;border:0;
    padding:12px 20px;border-radius:8px;cursor:pointer;text-decoration:none}
  .barre .sec{background:#fff;border:1px solid ${TRAIT}}
  body.pdf{background:#fff}
  body.pdf .barre,body.pdf .eq1,body.pdf .eq2,body.pdf .eq3,body.pdf .eq4,body.pdf .signer,body.pdf .ok{display:none}
  body.pdf .feuille{margin:0 auto;box-shadow:none;width:794px;max-width:none;padding:0 56px}
  @media(max-width:760px){
    body{font-size:14px}
    .feuille{margin:0;padding:34px 20px 30px;box-shadow:none}
    .eq1,.eq2,.eq3,.eq4{display:none}
    .parties,.accord{flex-direction:column;gap:20px}
    .infos{grid-template-columns:1fr}
    .signer{padding:24px 20px 30px;margin:0}
    .barre{position:static;padding:14px 20px 0}
    .barre button,.barre a{flex:1;text-align:center}
  }
  @media print{
    body{background:#fff}
    .feuille{margin:0;padding:0;box-shadow:none;max-width:none}
    .barre,.signer,.ok,.eq1,.eq2,.eq3,.eq4{display:none}
    .infos,.accord,.article,ul.inclus li{break-inside:avoid}
  }
</style></head><body>
<div class="barre"><button onclick="telechargerPdf()">T\xE9l\xE9charger le PDF</button>
  ${formClient ? `<a class="sec" href="#signer">Signer</a>` : `<button class="sec" onclick="window.print()">Imprimer</button>`}</div>
${opts.merci ? `<div class="ok" style="margin-top:28px">Merci, votre signature est enregistr\xE9e. Vous pouvez t\xE9l\xE9charger le contrat sign\xE9 en PDF.</div>` : ""}
<div class="feuille">
  <div class="eq1"></div><div class="eq2"></div><div class="eq3"></div><div class="eq4"></div>
  <div class="logo"><img src="${echapper(logo)}" alt="${echapper(p.profil_nom || "AdamEcom")}"></div>
  <h1>CONTRAT DE PRESTATION DE SERVICES</h1>
  <div class="sous">Contrat n\xB0 ${num} \xB7 \xE9tabli le ${dateFr(c.cree_le)} \xB7 sur la base du devis n\xB0 ${num}</div>

  <div class="parties">
    <div class="partie">
      <span class="badge">LE PRESTATAIRE</span>
      <div class="corps">
        <span class="nom">${echapper(p.profil_nom || "AdamEcom")}</span><br>
        ${p.profil_activite ? `${echapper(p.profil_activite)}<br>` : ""}
        ${c.presta_nom && c.presta_nom !== (p.profil_nom || "AdamEcom") ? `<span class="eti">Repr\xE9sent\xE9 par</span> ${echapper(c.presta_nom)}<br>` : ""}
        ${p.profil_email ? `<span class="eti">Email</span> ${echapper(p.profil_email)}<br>` : ""}
        ${p.profil_telephone ? `<span class="eti">T\xE9l.</span> ${echapper(p.profil_telephone)}<br>` : ""}
        ${p.profil_site ? `<span class="eti">Site</span> ${echapper(p.profil_site)}` : ""}
      </div>
    </div>
    <div class="partie">
      <span class="badge">LE CLIENT</span>
      <div class="corps">
        <span class="nom">${echapper(d.client_nom)}</span><br>
        ${d.client_societe ? `${echapper(d.client_societe)}<br>` : ""}
        ${d.client_adresse ? `<span class="adresse">${echapper(d.client_adresse)}</span><br>` : ""}
        ${d.client_email ? `<span class="eti">Email</span> ${echapper(d.client_email)}` : ""}
        ${d.client_telephone ? `<br><span class="eti">T\xE9l.</span> ${echapper(d.client_telephone)}` : ""}
      </div>
    </div>
  </div>

  <div class="bande">OBJET ET PRESTATIONS</div>
  <div class="presta">${echapper(d.titre)}</div>
  ${formaterContenuDevis(d.contenu)}
  <div class="infos">
    <div class="info"><div class="k">Prix total TTC</div><div class="v">${euros(d.montant)}</div></div>
    <div class="info"><div class="k">D\xE9lai de livraison</div><div class="v">${echapper(d.delai_livraison)}</div></div>
    <div class="info"><div class="k">Acompte \xE0 la signature</div><div class="v">${Number(d.acompte_pct || 0)} %</div></div>
  </div>

  <div class="bande">CONDITIONS DU CONTRAT</div>
  ${articlesContrat(c.clauses)}

  <div class="fait">Fait en deux exemplaires, sign\xE9s \xE9lectroniquement.</div>
  <div class="accord">
    ${bloc("LE PRESTATAIRE", c.presta_nom || p.profil_nom, c.presta_signature, c.presta_signe_le, false)}
    ${bloc("LE CLIENT", c.client_signataire || d.client_nom, c.client_signature, c.client_signe_le, true)}
  </div>
  <div class="pied">Contrat n\xB0 ${num} \xB7 ${echapper(p.profil_nom || "AdamEcom")}${p.profil_site ? ` \xB7 ${echapper(p.profil_site)}` : ""}</div>
</div>
${formClient}
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
<script>
function telechargerPdf(){
  if(!window.html2pdf){ window.print(); return; }
  document.body.classList.add('pdf'); window.scrollTo(0, 0);
  return html2pdf().set({
    margin:[12,0,12,0], filename:'Contrat-${num}.pdf',
    image:{type:'jpeg',quality:0.97},
    html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff'},
    jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
    pagebreak:{mode:['css','legacy'],avoid:['.infos','.accord','.article','li']}
  }).from(document.querySelector('.feuille')).save().then(function(){ document.body.classList.remove('pdf'); });
}
if(/[?&]telecharger=1/.test(location.search)){
  window.addEventListener('load', function(){ setTimeout(telechargerPdf, 300); });
}
<\/script></body></html>`;
}
__name22(gabaritContrat, "gabaritContrat");
var AUTORISATION = "https://accounts.google.com/o/oauth2/v2/auth";
var JETON = "https://oauth2.googleapis.com/token";
var AGENDA = "https://www.googleapis.com/calendar/v3";
var PORTEE = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly"
].join(" ");
async function lireReglage(db, cle) {
  try {
    const r = await db.prepare("SELECT valeur FROM reglages WHERE cle = ?").bind(cle).first();
    return r?.valeur || null;
  } catch {
    return null;
  }
}
__name(lireReglage, "lireReglage");
__name2(lireReglage, "lireReglage");
__name22(lireReglage, "lireReglage");
var ecrireReglage = /* @__PURE__ */ __name22((db, cle, valeur) => db.prepare("INSERT OR REPLACE INTO reglages (cle, valeur, maj_le) VALUES (?, ?, ?)").bind(cle, valeur, (/* @__PURE__ */ new Date()).toISOString()).run(), "ecrireReglage");
var supprimerReglage = /* @__PURE__ */ __name22((db, cle) => db.prepare("DELETE FROM reglages WHERE cle = ?").bind(cle).run(), "supprimerReglage");
var urlRetour = /* @__PURE__ */ __name22((origine) => `${origine}/google/retour`, "urlRetour");
async function etatGoogle(db) {
  const [id, secret, refresh, compte, depuis2, scopes] = await Promise.all([
    lireReglage(db, "google_client_id"),
    lireReglage(db, "google_client_secret"),
    lireReglage(db, "google_refresh_token"),
    lireReglage(db, "google_compte"),
    lireReglage(db, "google_connecte_le"),
    lireReglage(db, "google_scopes")
  ]);
  return {
    identifiants: Boolean(id && secret),
    connecte: Boolean(id && secret && refresh),
    clientId: id,
    clientSecret: secret,
    refresh,
    compte,
    depuis: depuis2,
    scopes: scopes || ""
  };
}
__name(etatGoogle, "etatGoogle");
__name2(etatGoogle, "etatGoogle");
__name22(etatGoogle, "etatGoogle");
async function debutAutorisation(env, origine) {
  const e = await etatGoogle(env.DB);
  if (!e.identifiants) return { erreur: "Renseignez d'abord l'ID client et le secret." };
  const p = new URLSearchParams({
    client_id: e.clientId,
    redirect_uri: urlRetour(origine),
    response_type: "code",
    scope: PORTEE,
    // Sans « offline » et « consent », Google ne délivre pas de jeton de
    // rafraîchissement, et l'accès expirerait au bout d'une heure.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true"
  });
  return { url: `${AUTORISATION}?${p}` };
}
__name(debutAutorisation, "debutAutorisation");
__name2(debutAutorisation, "debutAutorisation");
__name22(debutAutorisation, "debutAutorisation");
async function finAutorisation(env, code, origine) {
  const e = await etatGoogle(env.DB);
  if (!e.identifiants) return { erreur: "Identifiants Google absents." };
  const res = await fetch(JETON, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: e.clientId,
      client_secret: e.clientSecret,
      redirect_uri: urlRetour(origine),
      grant_type: "authorization_code"
    })
  });
  const d = await res.json();
  if (!res.ok || !d.refresh_token) {
    return { erreur: d.error_description || d.error || "Google n'a pas renvoy\xE9 de jeton de rafra\xEEchissement." };
  }
  await ecrireReglage(env.DB, "google_refresh_token", d.refresh_token);
  await ecrireReglage(env.DB, "google_connecte_le", (/* @__PURE__ */ new Date()).toISOString());
  if (d.scope) await ecrireReglage(env.DB, "google_scopes", d.scope);
  try {
    const info = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { authorization: `Bearer ${d.access_token}` }
    }).then((r) => r.json());
    if (info.email) await ecrireReglage(env.DB, "google_compte", info.email);
  } catch {
  }
  return { ok: true };
}
__name(finAutorisation, "finAutorisation");
__name2(finAutorisation, "finAutorisation");
__name22(finAutorisation, "finAutorisation");
async function jetonAcces(env) {
  const e = await etatGoogle(env.DB);
  if (!e.connecte) throw new Error("Agenda Google non connect\xE9.");
  const res = await fetch(JETON, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: e.clientId,
      client_secret: e.clientSecret,
      refresh_token: e.refresh,
      grant_type: "refresh_token"
    })
  });
  const d = await res.json();
  if (!res.ok || !d.access_token) {
    throw new Error(d.error_description || d.error || "Rafra\xEEchissement du jeton refus\xE9.");
  }
  return d.access_token;
}
__name(jetonAcces, "jetonAcces");
__name2(jetonAcces, "jetonAcces");
__name22(jetonAcces, "jetonAcces");
async function testerConnexion(env) {
  try {
    const acces = await jetonAcces(env);
    const res = await fetch(`${AGENDA}/calendars/primary`, {
      headers: { authorization: `Bearer ${acces}` }
    });
    const d = await res.json();
    if (!res.ok) return { erreur: d.error?.message || `Google \u2192 ${res.status}` };
    if (d.id) await ecrireReglage(env.DB, "google_compte", d.id);
    return { ok: true, agenda: d.summary || d.id, fuseau: d.timeZone };
  } catch (e) {
    return { erreur: e.message };
  }
}
__name(testerConnexion, "testerConnexion");
__name2(testerConnexion, "testerConnexion");
__name22(testerConnexion, "testerConnexion");
async function googleJson(url, acces, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      authorization: `Bearer ${acces}`,
      accept: "application/json",
      ...options.body ? { "content-type": "application/json" } : {},
      ...options.headers
    }
  });
  const texte2 = await res.text();
  let d = {};
  try {
    d = texte2 ? JSON.parse(texte2) : {};
  } catch {
    d = { message: texte2 };
  }
  if (!res.ok) throw new Error(d.error?.message || d.message || `Google \u2192 ${res.status}`);
  return d;
}
__name(googleJson, "googleJson");
__name2(googleJson, "googleJson");
__name22(googleJson, "googleJson");
var dateIsoJour = /* @__PURE__ */ __name22((decalageJours = 0) => {
  const d = /* @__PURE__ */ new Date();
  d.setUTCDate(d.getUTCDate() + decalageJours);
  return d.toISOString().slice(0, 10);
}, "dateIsoJour");
async function diagnosticSeoGoogle(env) {
  const etat = await etatGoogle(env.DB);
  const resultat = {
    connecte: etat.connecte,
    autorisationSeo: etat.scopes.includes("webmasters.readonly") && etat.scopes.includes("analytics.readonly"),
    sites: [],
    proprietes: [],
    site: null,
    propriete: null,
    searchConsole: null,
    analytics: null,
    erreurs: []
  };
  if (!etat.connecte) return resultat;
  let acces;
  try {
    acces = await jetonAcces(env);
  } catch (e) {
    resultat.erreurs.push(`Connexion Google : ${e.message}`);
    return resultat;
  }
  try {
    const d = await googleJson("https://www.googleapis.com/webmasters/v3/sites", acces);
    resultat.sites = (d.siteEntry || []).map((s) => ({ url: s.siteUrl, niveau: s.permissionLevel }));
  } catch (e) {
    resultat.erreurs.push(`Search Console : ${e.message}`);
  }
  try {
    const d = await googleJson("https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200", acces);
    resultat.proprietes = (d.accountSummaries || []).flatMap((a) => (a.propertySummaries || []).map((p) => ({
      id: p.property,
      nom: p.displayName,
      compte: a.displayName
    })));
  } catch (e) {
    resultat.erreurs.push(`Google Analytics : ${e.message}`);
  }
  const siteSauve = await lireReglage(env.DB, "google_search_console_site");
  const proprieteSauvee = await lireReglage(env.DB, "google_analytics_property");
  resultat.site = resultat.sites.find((s) => s.url === siteSauve) || resultat.sites.find((s) => /(^sc-domain:adam-ecom\.com$|https?:\/\/adam-ecom\.com\/?$)/i.test(s.url)) || resultat.sites[0] || null;
  resultat.propriete = resultat.proprietes.find((p) => p.id === proprieteSauvee) || (resultat.proprietes.length === 1 ? resultat.proprietes[0] : null);
  if (resultat.site) {
    try {
      const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(resultat.site.url)}/searchAnalytics/query`;
      const periode = { startDate: dateIsoJour(-28), endDate: dateIsoJour(-1) };
      const [total, principales] = await Promise.all([
        googleJson(url, acces, { method: "POST", body: JSON.stringify(periode) }),
        googleJson(url, acces, {
          method: "POST",
          body: JSON.stringify({ ...periode, dimensions: ["query"], rowLimit: 20 })
        })
      ]);
      const ligneTotal = total.rows?.[0] || {};
      const lignes = principales.rows || [];
      resultat.searchConsole = {
        clics: Number(ligneTotal.clicks || 0),
        impressions: Number(ligneTotal.impressions || 0),
        requetes: lignes.map((x) => ({
          requete: x.keys?.[0] || "\u2014",
          clics: Number(x.clicks || 0),
          impressions: Number(x.impressions || 0),
          position: Number(x.position || 0)
        }))
      };
    } catch (e) {
      resultat.erreurs.push(`Donn\xE9es Search Console : ${e.message}`);
    }
  }
  if (resultat.propriete) {
    try {
      const d = await googleJson(
        `https://analyticsdata.googleapis.com/v1beta/${resultat.propriete.id}:runReport`,
        acces,
        {
          method: "POST",
          body: JSON.stringify({
            dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }],
            metrics: ["activeUsers", "sessions", "screenPageViews", "eventCount"].map((name) => ({ name }))
          })
        }
      );
      const valeurs = d.rows?.[0]?.metricValues || [];
      resultat.analytics = {
        utilisateurs: Number(valeurs[0]?.value || 0),
        sessions: Number(valeurs[1]?.value || 0),
        pagesVues: Number(valeurs[2]?.value || 0),
        evenements: Number(valeurs[3]?.value || 0)
      };
    } catch (e) {
      resultat.erreurs.push(`Donn\xE9es Analytics : ${e.message}`);
    }
  }
  return resultat;
}
__name(diagnosticSeoGoogle, "diagnosticSeoGoogle");
__name2(diagnosticSeoGoogle, "diagnosticSeoGoogle");
__name22(diagnosticSeoGoogle, "diagnosticSeoGoogle");
async function creerEvenement(env, m) {
  const acces = await jetonAcces(env);
  const fin = new Date(new Date(m.debut).getTime() + m.duree_min * 6e4).toISOString();
  const corps = {
    summary: m.sujet,
    description: [m.note || "", "", "Organis\xE9 par AdamEcom \u2014 adam-ecom.com"].join("\n").trim(),
    start: { dateTime: new Date(m.debut).toISOString(), timeZone: m.fuseau },
    end: { dateTime: fin, timeZone: m.fuseau },
    attendees: [{ email: m.client_email, displayName: m.client_nom }],
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 15 }] },
    conferenceData: {
      createRequest: {
        requestId: `adamecom-${m.id}-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" }
      }
    }
  };
  const p = new URLSearchParams({
    conferenceDataVersion: "1",
    // Google envoie sa propre invitation d'agenda au client, en plus de la
    // nôtre : les deux se complètent et la sienne gère les réponses.
    sendUpdates: "all"
  });
  const res = await fetch(`${AGENDA}/calendars/primary/events?${p}`, {
    method: "POST",
    headers: { authorization: `Bearer ${acces}`, "content-type": "application/json" },
    body: JSON.stringify(corps)
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error?.message || `Google Calendar \u2192 ${res.status}`);
  const lien = d.hangoutLink || d.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri;
  if (!lien) throw new Error("\xC9v\xE9nement cr\xE9\xE9, mais Google n'a pas fourni de lien Meet.");
  return { id: d.id, lien, lienAgenda: d.htmlLink };
}
__name(creerEvenement, "creerEvenement");
__name2(creerEvenement, "creerEvenement");
__name22(creerEvenement, "creerEvenement");
async function majEvenement(env, idEvenement, m) {
  const acces = await jetonAcces(env);
  const fin = new Date(new Date(m.debut).getTime() + m.duree_min * 6e4).toISOString();
  const res = await fetch(
    `${AGENDA}/calendars/primary/events/${idEvenement}?sendUpdates=all`,
    {
      method: "PATCH",
      headers: { authorization: `Bearer ${acces}`, "content-type": "application/json" },
      body: JSON.stringify({
        summary: m.sujet,
        description: [m.note || "", "", "Organis\xE9 par AdamEcom \u2014 adam-ecom.com"].join("\n").trim(),
        start: { dateTime: new Date(m.debut).toISOString(), timeZone: m.fuseau },
        end: { dateTime: fin, timeZone: m.fuseau },
        attendees: [{ email: m.client_email, displayName: m.client_nom }]
      })
    }
  );
  const d = await res.json();
  if (!res.ok) throw new Error(d.error?.message || `Google Calendar \u2192 ${res.status}`);
  return { id: d.id, lien: d.hangoutLink || null };
}
__name(majEvenement, "majEvenement");
__name2(majEvenement, "majEvenement");
__name22(majEvenement, "majEvenement");
async function supprimerEvenement(env, idEvenement) {
  const acces = await jetonAcces(env);
  const res = await fetch(`${AGENDA}/calendars/primary/events/${idEvenement}?sendUpdates=all`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${acces}` }
  });
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    throw new Error(`Suppression refus\xE9e \u2192 ${res.status}`);
  }
}
__name(supprimerEvenement, "supprimerEvenement");
__name2(supprimerEvenement, "supprimerEvenement");
__name22(supprimerEvenement, "supprimerEvenement");
async function pageGoogle(env, url, message) {
  const cle = encodeURIComponent(env.CLE_TEST);
  const e = await etatGoogle(env.DB);
  const seo = await diagnosticSeoGoogle(env);
  const retour = urlRetour(url.origin);
  const etat = e.connecte ? `<div class="carte bon"><div class="k">Agenda Google</div>
        <div class="v txt">connect\xE9</div>
        <div class="s">${echapper(e.compte || "compte autoris\xE9")}${e.depuis ? ` \xB7 depuis le ${new Date(e.depuis).toLocaleDateString("fr-FR")}` : ""}</div></div>` : e.identifiants ? `<div class="carte moyen"><div class="k">Agenda Google</div>
          <div class="v txt">identifiants enregistr\xE9s</div>
          <div class="s">il reste \xE0 autoriser l'acc\xE8s</div></div>` : `<div class="carte mauvais"><div class="k">Agenda Google</div>
          <div class="v txt">non configur\xE9</div>
          <div class="s">les rendez-vous utilisent le lien coll\xE9 \xE0 la main</div></div>`;
  return `
    ${message || ""}
    <section><div class="grille">${etat}
      <div class="carte ${seo.searchConsole ? "bon" : "moyen"}"><div class="k">Search Console</div>
        <div class="v txt">${seo.searchConsole ? "connect\xE9e" : "\xE0 autoriser"}</div>
        <div class="s">${seo.site ? echapper(seo.site.url) : "aucune propri\xE9t\xE9 s\xE9lectionn\xE9e"}</div></div>
      <div class="carte ${seo.analytics ? "bon" : "moyen"}"><div class="k">Google Analytics</div>
        <div class="v txt">${seo.analytics ? "connect\xE9" : "\xE0 autoriser"}</div>
        <div class="s">${seo.propriete ? echapper(seo.propriete.nom) : "aucune propri\xE9t\xE9 s\xE9lectionn\xE9e"}</div></div>
    </div></section>
    ${e.connecte && !seo.autorisationSeo ? `<div class="alerte"><b>Une reconnexion Google est n\xE9cessaire.</b> Votre autorisation actuelle couvre uniquement l'agenda. Cliquez sur \xAB Reconnecter Google \xBB pour ajouter Search Console et Analytics en lecture seule.</div>` : ""}
    ${seo.erreurs.length ? `<div class="alerte">${seo.erreurs.map((x) => echapper(x)).join("<br>")}</div>` : ""}

    <section><h2>1. Cr\xE9er les identifiants chez Google</h2>
      <div class="note">
        <b>\xC0 faire une seule fois</b>, sur <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">console.cloud.google.com</a> :
        <ol style="margin:10px 0 0;padding-left:20px;line-height:1.9">
          <li>Cr\xE9ez un projet, n'importe quel nom.</li>
          <li>Menu <b>API et services \u2192 Biblioth\xE8que</b> \u2192 activez <b>Google Calendar API</b>, <b>Google Search Console API</b>, <b>Google Analytics Admin API</b> et <b>Google Analytics Data API</b>.</li>
          <li><b>API et services \u2192 \xC9cran de consentement OAuth</b> \u2192 type <b>Externe</b> \u2192 renseignez le nom de l'app et votre email \u2192 dans <b>Utilisateurs test</b>, ajoutez votre propre adresse Gmail.</li>
          <li><b>Identifiants \u2192 Cr\xE9er des identifiants \u2192 ID client OAuth</b> \u2192 type <b>Application Web</b>.</li>
          <li>Dans <b>URI de redirection autoris\xE9s</b>, collez exactement :<br>
            <code style="display:inline-block;margin-top:6px;padding:6px 10px;background:var(--surface2);border-radius:5px;word-break:break-all">${echapper(retour)}</code></li>
          <li>Copiez l'<b>ID client</b> et le <b>Code secret</b>, puis reportez-les ci-dessous.</li>
        </ol>
      </div>
    </section>

    <section><h2>2. Enregistrer les identifiants</h2>
      <form class="f" method="POST" action="?cle=${cle}&page=google&action=google_ids">
        <label class="large">ID client
          <input name="client_id" required placeholder="\u2026apps.googleusercontent.com"
            value="${echapper(e.clientId || "")}"></label>
        <label class="large">Code secret du client
          <input name="client_secret" type="password" required
            placeholder="${e.clientSecret ? "d\xE9j\xE0 enregistr\xE9 \u2014 ressaisissez pour le remplacer" : "GOCSPX-\u2026"}"></label>
        <button class="envoyer large" type="submit">Enregistrer</button>
      </form>
    </section>

    <section><h2>3. Autoriser Google Calendar, Search Console et Analytics</h2>
      ${e.identifiants ? `<div class="actions">
             <a class="bouton" style="padding:13px 26px;font-size:14px"
                href="?cle=${cle}&page=google&action=google_connexion">
                ${e.connecte ? "Reconnecter Google" : "Connecter Google"}</a>
             ${e.connecte ? `<form method="POST" action="?cle=${cle}&page=google&action=google_test" style="display:inline">
               <button class="envoyer" style="background:var(--surface2);color:var(--encre)" type="submit">Tester la connexion</button></form>` : ""}
             ${e.connecte ? `<form method="POST" action="?cle=${cle}&page=google&action=google_deconnexion" style="display:inline">
               <button class="envoyer" style="background:var(--surface2);color:var(--encre)" type="submit"
                 onclick="return confirm('D\xE9connecter l\\'agenda Google ?')">D\xE9connecter</button></form>` : ""}
           </div>
           <p class="sec" style="margin-top:10px">Google affichera un avertissement \xAB application non valid\xE9e \xBB :
             c'est normal pour une application priv\xE9e. Cliquez sur <b>Param\xE8tres avanc\xE9s</b>, puis sur le lien pour continuer.</p>` : `<div class="note">Enregistrez d'abord vos identifiants \xE0 l'\xE9tape 2.</div>`}
    </section>

    ${seo.sites.length || seo.proprietes.length ? `<section><h2>4. Choisir les propri\xE9t\xE9s SEO</h2>
      <form class="f" method="POST" action="?cle=${cle}&page=google&action=google_seo_selection">
        <label class="large">Site Search Console<select name="site_search_console">
          <option value="">Choisir un site</option>
          ${seo.sites.map((s) => `<option value="${echapper(s.url)}" ${seo.site?.url === s.url ? "selected" : ""}>${echapper(s.url)} \u2014 ${echapper(s.niveau)}</option>`).join("")}
        </select></label>
        <label class="large">Propri\xE9t\xE9 Google Analytics<select name="propriete_analytics">
          <option value="">Choisir une propri\xE9t\xE9</option>
          ${seo.proprietes.map((p) => `<option value="${echapper(p.id)}" ${seo.propriete?.id === p.id ? "selected" : ""}>${echapper(p.nom)} \u2014 ${echapper(p.compte)}</option>`).join("")}
        </select></label>
        <button class="envoyer large" type="submit">Enregistrer les propri\xE9t\xE9s</button>
      </form></section>` : ""}

    ${seo.searchConsole || seo.analytics ? `<section><h2>SEO et trafic \u2014 28 derniers jours</h2><div class="grille">
      <div class="carte neutre"><div class="k">Clics Google</div><div class="v">${seo.searchConsole?.clics ?? "\u2014"}</div></div>
      <div class="carte neutre"><div class="k">Impressions Google</div><div class="v">${seo.searchConsole?.impressions ?? "\u2014"}</div></div>
      <div class="carte neutre"><div class="k">Utilisateurs actifs</div><div class="v">${seo.analytics?.utilisateurs ?? "\u2014"}</div></div>
      <div class="carte neutre"><div class="k">Sessions</div><div class="v">${seo.analytics?.sessions ?? "\u2014"}</div></div>
      <div class="carte neutre"><div class="k">Pages vues</div><div class="v">${seo.analytics?.pagesVues ?? "\u2014"}</div></div>
      <div class="carte neutre"><div class="k">\xC9v\xE9nements</div><div class="v">${seo.analytics?.evenements ?? "\u2014"}</div></div>
    </div></section>` : ""}
    ${seo.searchConsole?.requetes?.length ? `<section><h2>Requ\xEAtes SEO principales</h2>${tableauHtml(
    [{ nom: "Requ\xEAte" }, { nom: "Clics", classe: "num" }, { nom: "Impressions", classe: "num" }, { nom: "Position", classe: "num" }],
    seo.searchConsole.requetes.map((q) => `<tr><td><b>${echapper(q.requete)}</b></td><td class="num">${q.clics}</td><td class="num">${q.impressions}</td><td class="num">${q.position.toFixed(1)}</td></tr>`),
    "Aucune requ\xEAte pour cette p\xE9riode."
  )}</section>` : ""}

    <section><h2>Ce que la connexion change</h2>
      <div class="tw"><table>
        <thead><tr><th>Sans connexion</th><th>Avec l'agenda connect\xE9</th></tr></thead>
        <tbody><tr>
          <td>Vous collez un lien de visio \xE0 la main</td>
          <td><b>Google g\xE9n\xE8re un lien Meet unique</b> par rendez-vous</td>
        </tr><tr>
          <td>Le rendez-vous n'appara\xEEt pas dans votre agenda</td>
          <td><b>L'\xE9v\xE9nement est cr\xE9\xE9 dans votre agenda</b>, avec rappel</td>
        </tr><tr>
          <td>Le client re\xE7oit votre invitation seule</td>
          <td>Il re\xE7oit aussi l'invitation Google et peut y r\xE9pondre</td>
        </tr><tr>
          <td>Les performances SEO restent s\xE9par\xE9es de votre application</td>
          <td><b>Les clics, impressions, requ\xEAtes et donn\xE9es Analytics sont regroup\xE9s ici</b></td>
        </tr></tbody></table></div>
    </section>`;
}
__name(pageGoogle, "pageGoogle");
__name2(pageGoogle, "pageGoogle");
__name22(pageGoogle, "pageGoogle");
var LOGO2 = "https://cdn.shopify.com/s/files/1/0599/3873/4126/files/logo-adam-ecom.webp?v=1778514762&width=560&format=png";
var JAUNE2 = "#FFDC3F";
var NOIR2 = "#1B1B1B";
var GRIS2 = "#6E6A5F";
var TRAIT2 = "#E6E1D5";
var jetonAleatoire = /* @__PURE__ */ __name22(() => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join(""), "jetonAleatoire");
var quandFr = /* @__PURE__ */ __name22((iso, fuseau) => new Date(iso).toLocaleString("fr-FR", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: fuseau || "Africa/Casablanca"
}), "quandFr");
var finDe = /* @__PURE__ */ __name22((debut, minutes) => new Date(new Date(debut).getTime() + minutes * 6e4).toISOString(), "finDe");
var horodatageIcs = /* @__PURE__ */ __name22((iso) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, ""), "horodatageIcs");
var plier = /* @__PURE__ */ __name22((ligne) => {
  const out = [];
  let reste = ligne;
  while (reste.length > 73) {
    out.push(reste.slice(0, 73));
    reste = " " + reste.slice(73);
  }
  out.push(reste);
  return out.join("\r\n");
}, "plier");
var echapperIcs = /* @__PURE__ */ __name22((s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"), "echapperIcs");
function fichierIcs(m, env) {
  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AdamEcom//Rendez-vous//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:meeting-${m.id}-${m.jeton}@adam-ecom.com`,
    `DTSTAMP:${horodatageIcs((/* @__PURE__ */ new Date()).toISOString())}`,
    `DTSTART:${horodatageIcs(new Date(m.debut).toISOString())}`,
    `DTEND:${horodatageIcs(finDe(m.debut, m.duree_min))}`,
    plier(`SUMMARY:${echapperIcs(m.sujet)}`),
    plier(`DESCRIPTION:${echapperIcs((m.note ? m.note + "\n\n" : "") + "Lien de connexion : " + m.lien_meet)}`),
    plier(`LOCATION:${echapperIcs(m.lien_meet)}`),
    plier(`ORGANIZER;CN=AdamEcom:mailto:${env.SENDER_EMAIL}`),
    plier(`ATTENDEE;CN=${echapperIcs(m.client_nom)};RSVP=TRUE:mailto:${m.client_email}`),
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Rappel",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ];
  return lignes.join("\r\n");
}
__name(fichierIcs, "fichierIcs");
__name2(fichierIcs, "fichierIcs");
__name22(fichierIcs, "fichierIcs");
var enBase64 = /* @__PURE__ */ __name22((texte) => {
  const octets = new TextEncoder().encode(texte);
  let bin = "";
  for (const o of octets) bin += String.fromCharCode(o);
  return btoa(bin);
}, "enBase64");
var listeMeetings = /* @__PURE__ */ __name22(async (db, limite = 50) => {
  try {
    const { results = [] } = await db.prepare(`SELECT id, client_nom, client_email, sujet, debut, duree_min, fuseau,
                       lien_meet, statut, envoye_le, jeton, annule_le, google_event_id
                FROM meetings ORDER BY debut DESC LIMIT ?`).bind(limite).all();
    return results;
  } catch {
    return [];
  }
}, "listeMeetings");
var lireMeeting = /* @__PURE__ */ __name22((db, id) => db.prepare("SELECT * FROM meetings WHERE id = ?").bind(id).first(), "lireMeeting");
async function creerMeeting(env, form) {
  const nom = (form.get("client_nom") || "").trim();
  const email = (form.get("client_email") || "").trim();
  const sujet = (form.get("sujet") || "").trim();
  const date = (form.get("date") || "").trim();
  const heure = (form.get("heure") || "").trim();
  const duree = Number(form.get("duree_min") || 30);
  const fuseau = (form.get("fuseau") || "Africa/Casablanca").trim();
  const lien = (form.get("lien_meet") || "").trim();
  const google = await etatGoogle(env.DB);
  const erreurs = [];
  if (!nom) erreurs.push("le nom du client");
  if (!email.includes("@")) erreurs.push("un email valide");
  if (!sujet) erreurs.push("un sujet");
  if (!date || !heure) erreurs.push("la date et l'heure");
  if (!google.connecte && !/^https?:\/\//.test(lien)) {
    erreurs.push("un lien de visioconf\xE9rence, ou connectez votre agenda Google");
  }
  if (erreurs.length) return { erreur: `Il manque ${erreurs.join(", ")}.` };
  const debut = versUtc(date, heure, fuseau);
  if (!debut) return { erreur: "Date ou heure invalide." };
  const note2 = (form.get("note") || "").trim() || null;
  const r = await env.DB.prepare(
    `INSERT INTO meetings (client_nom, client_email, sujet, note, debut, duree_min,
                           fuseau, lien_meet, statut, jeton, cree_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'brouillon', ?, ?)`
  ).bind(
    nom,
    email,
    sujet,
    note2,
    debut,
    duree,
    fuseau,
    lien || "",
    jetonAleatoire(),
    (/* @__PURE__ */ new Date()).toISOString()
  ).run();
  const id = r.meta.last_row_id;
  if (google.connecte) {
    try {
      const ev = await creerEvenement(env, {
        id,
        sujet,
        note: note2,
        debut,
        duree_min: duree,
        fuseau,
        client_nom: nom,
        client_email: email
      });
      await env.DB.prepare(
        "UPDATE meetings SET lien_meet=?, google_event_id=?, google_lien=? WHERE id=?"
      ).bind(ev.lien, ev.id, ev.lienAgenda, id).run();
      return { id, google: true };
    } catch (e) {
      return { id, avertissement: `Rendez-vous cr\xE9\xE9, mais Google a refus\xE9 : ${e.message}` };
    }
  }
  return { id };
}
__name(creerMeeting, "creerMeeting");
__name2(creerMeeting, "creerMeeting");
__name22(creerMeeting, "creerMeeting");
function versUtc(date, heure, fuseau) {
  try {
    const naif = /* @__PURE__ */ new Date(`${date}T${heure}:00Z`);
    if (Number.isNaN(naif.getTime())) return null;
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: fuseau,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    const p = Object.fromEntries(fmt.formatToParts(naif).map((x) => [x.type, x.value]));
    const vuLa = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    return new Date(naif.getTime() * 2 - vuLa).toISOString();
  } catch {
    return null;
  }
}
__name(versUtc, "versUtc");
__name2(versUtc, "versUtc");
__name22(versUtc, "versUtc");
function gabaritInvitation(m, env) {
  const cell = `font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:${NOIR2}`;
  const eti = `${cell};color:${GRIS2};padding:5px 18px 5px 0;white-space:nowrap;vertical-align:top;font-size:14px`;
  const val = `${cell};padding:5px 0;font-weight:700;font-size:14px`;
  const quand = quandFr(m.debut, m.fuseau);
  const immediat = new Date(m.debut).getTime() - Date.now() < 6 * 6e4;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background:#EFEDE7;padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
    style="width:100%;max-width:600px;background:#fff;border:1px solid ${TRAIT2};border-radius:10px">

    <tr><td align="center" style="padding:30px 28px 18px">
      <img src="${LOGO2}" alt="AdamEcom" width="210"
        style="display:block;border:0;width:210px;max-width:60%;height:auto"></td></tr>

    <tr><td style="padding:0 28px">
      <div style="${cell};background:${JAUNE2};text-align:center;font-weight:800;font-size:11.5px;
        letter-spacing:.14em;padding:11px">${immediat ? "VOTRE RENDEZ-VOUS COMMENCE MAINTENANT" : "INVITATION \xC0 UN RENDEZ-VOUS"}</div></td></tr>

    <tr><td style="padding:24px 28px 0">
      <div style="${cell};font-weight:800;font-size:19px;letter-spacing:-.02em">${echapper(m.sujet)}</div></td></tr>

    <tr><td style="padding:16px 28px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="${eti}">Quand</td><td style="${val}">${immediat ? "Maintenant" : echapper(quand)}</td></tr>
        <tr><td style="${eti}">Dur\xE9e</td><td style="${val}">${m.duree_min} minutes</td></tr>
        <tr><td style="${eti}">Fuseau</td><td style="${val}">${echapper(m.fuseau)}</td></tr>
        <tr><td style="${eti}">Avec</td><td style="${val}">Adam \u2014 AdamEcom</td></tr>
      </table></td></tr>

    ${m.note ? `<tr><td style="padding:18px 28px 0">
      <div style="${cell};background:#FAF9F5;border-left:4px solid ${JAUNE2};padding:13px 16px;
        white-space:pre-wrap;font-size:14px">${echapper(m.note)}</div></td></tr>` : ""}

    <tr><td align="center" style="padding:26px 28px 0">
      <a href="${echapper(m.lien_meet)}" style="${cell};display:inline-block;background:${NOIR2};color:#fff;
        font-weight:700;padding:15px 32px;border-radius:8px;text-decoration:none">${immediat ? "Rejoindre maintenant \u2192" : "Rejoindre la visioconf\xE9rence \u2192"}</a>
      <div style="${cell};font-size:12px;color:${GRIS2};margin-top:11px;word-break:break-all">${echapper(m.lien_meet)}</div>
    </td></tr>

    <tr><td style="padding:22px 28px 0">
      <div style="${cell};font-size:13.5px;color:${GRIS2};text-align:center">
        ${immediat ? "Cliquez sur le bouton ci-dessus pour me rejoindre tout de suite." : "Le fichier joint ajoute ce rendez-vous \xE0 votre agenda en un clic."}</div></td></tr>

    <tr><td align="center" style="padding:26px 28px 30px">
      <div style="${cell};font-size:13.5px">\xC0 tr\xE8s vite,<br><b>Adam</b><br>
        <span style="color:${GRIS2}">Consultant Shopify &amp; CRO \u2014 AdamEcom</span></div></td></tr>

  </table></td></tr></table>`;
}
__name(gabaritInvitation, "gabaritInvitation");
__name2(gabaritInvitation, "gabaritInvitation");
__name22(gabaritInvitation, "gabaritInvitation");
async function envoyerInvitation(env, id) {
  const m = await lireMeeting(env.DB, id);
  if (!m) return { erreur: "Rendez-vous introuvable." };
  const corps = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#EFEDE7">${gabaritInvitation(m, env)}</body></html>`;
  if (!await emailAutorise(env, "meeting_invitation")) {
    await noterEnvoi(env, "meeting_invitation", m.client_email, null, "bloqu\xE9", "mod\xE8le en pause");
    return { erreur: "L'envoi des invitations est en pause. R\xE9activez-le dans Emails automatiques." };
  }
  const objetI = await objetEmail(
    env,
    "meeting_invitation",
    `Rendez-vous \u2014 ${m.sujet} \u2014 ${quandFr(m.debut, m.fuseau)}`,
    { sujet: m.sujet, quand: quandFr(m.debut, m.fuseau), client: m.client_nom }
  );
  try {
    await brevo(env, "/smtp/email", {
      method: "POST",
      body: JSON.stringify({
        sender: { name: "AdamEcom", email: env.SENDER_EMAIL },
        to: [{ email: m.client_email, name: m.client_nom }],
        replyTo: { email: env.SENDER_EMAIL, name: "AdamEcom" },
        subject: objetI,
        htmlContent: corps,
        attachment: [{ name: "rendez-vous.ics", content: enBase64(fichierIcs(m, env)) }]
      })
    });
  } catch (e) {
    return { erreur: `Envoi refus\xE9 : ${e.message}` };
  }
  await env.DB.prepare("UPDATE meetings SET statut='envoy\xE9', envoye_le=? WHERE id=?").bind((/* @__PURE__ */ new Date()).toISOString(), id).run();
  return { ok: true, email: m.client_email };
}
__name(envoyerInvitation, "envoyerInvitation");
__name2(envoyerInvitation, "envoyerInvitation");
__name22(envoyerInvitation, "envoyerInvitation");
async function modifierMeeting(env, id, form) {
  const m = await lireMeeting(env.DB, id);
  if (!m) return { erreur: "Rendez-vous introuvable." };
  if (m.statut === "annul\xE9") return { erreur: "Ce rendez-vous est annul\xE9." };
  const nom = (form.get("client_nom") || "").trim();
  const email = (form.get("client_email") || "").trim();
  const sujet = (form.get("sujet") || "").trim();
  const date = (form.get("date") || "").trim();
  const heure = (form.get("heure") || "").trim();
  const duree = Number(form.get("duree_min") || m.duree_min);
  const fuseau = (form.get("fuseau") || m.fuseau).trim();
  const note2 = (form.get("note") || "").trim() || null;
  if (!nom || !email.includes("@") || !sujet || !date || !heure) {
    return { erreur: "Nom, email, sujet, date et heure sont n\xE9cessaires." };
  }
  const debut = versUtc(date, heure, fuseau);
  if (!debut) return { erreur: "Date ou heure invalide." };
  await env.DB.prepare(
    `UPDATE meetings SET client_nom=?, client_email=?, sujet=?, note=?,
                         debut=?, duree_min=?, fuseau=? WHERE id=?`
  ).bind(nom, email, sujet, note2, debut, duree, fuseau, id).run();
  if (m.google_event_id) {
    try {
      await majEvenement(
        env,
        m.google_event_id,
        { sujet, note: note2, debut, duree_min: duree, fuseau, client_nom: nom, client_email: email }
      );
      return { ok: true, google: true };
    } catch (e) {
      return { ok: true, avertissement: `Rendez-vous modifi\xE9, mais Google a refus\xE9 la mise \xE0 jour : ${e.message}` };
    }
  }
  return { ok: true };
}
__name(modifierMeeting, "modifierMeeting");
__name2(modifierMeeting, "modifierMeeting");
__name22(modifierMeeting, "modifierMeeting");
async function annulerMeeting(env, id, prevenirClient) {
  const m = await lireMeeting(env.DB, id);
  if (!m) return { erreur: "Rendez-vous introuvable." };
  if (m.statut === "annul\xE9") return { erreur: "D\xE9j\xE0 annul\xE9." };
  let avertissement = null;
  if (m.google_event_id) {
    try {
      await supprimerEvenement(env, m.google_event_id);
    } catch (e) {
      avertissement = `Annul\xE9, mais Google a refus\xE9 la suppression : ${e.message}`;
    }
  }
  await env.DB.prepare("UPDATE meetings SET statut='annul\xE9', annule_le=? WHERE id=?").bind((/* @__PURE__ */ new Date()).toISOString(), id).run();
  if (prevenirClient && m.statut === "envoy\xE9") {
    try {
      await brevo(env, "/smtp/email", {
        method: "POST",
        body: JSON.stringify({
          sender: { name: "AdamEcom", email: env.SENDER_EMAIL },
          to: [{ email: m.client_email, name: m.client_nom }],
          subject: await objetEmail(
            env,
            "meeting_annulation",
            `Annulation \u2014 ${m.sujet}`,
            { sujet: m.sujet, quand: quandFr(m.debut, m.fuseau) }
          ),
          htmlContent: `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;
            line-height:1.65;color:${NOIR2};max-width:560px">
            <p>Bonjour ${echapper(m.client_nom)},</p>
            <p>Le rendez-vous <b>${echapper(m.sujet)}</b> pr\xE9vu
               <b>${echapper(quandFr(m.debut, m.fuseau))}</b> est <b>annul\xE9</b>.</p>
            <p>Je reviens vers vous pour convenir d'un nouveau cr\xE9neau.</p>
            <p style="margin-top:24px">\xC0 bient\xF4t,<br><b>Adam</b><br>
              <span style="color:${GRIS2}">AdamEcom</span></p></div>`
        })
      });
    } catch (e) {
      avertissement = `Annul\xE9, mais l'email au client a \xE9chou\xE9 : ${e.message}`;
    }
  }
  return { ok: true, avertissement };
}
__name(annulerMeeting, "annulerMeeting");
__name2(annulerMeeting, "annulerMeeting");
__name22(annulerMeeting, "annulerMeeting");
async function supprimerMeeting(env, id) {
  const m = await lireMeeting(env.DB, id);
  if (!m) return { erreur: "Rendez-vous introuvable." };
  if (m.google_event_id && m.statut !== "annul\xE9") {
    try {
      await supprimerEvenement(env, m.google_event_id);
    } catch {
    }
  }
  await env.DB.prepare("DELETE FROM meetings WHERE id=?").bind(id).run();
  return { ok: true };
}
__name(supprimerMeeting, "supprimerMeeting");
__name2(supprimerMeeting, "supprimerMeeting");
__name22(supprimerMeeting, "supprimerMeeting");
async function meetingInstantane(env, form) {
  const nom = (form.get("client_nom") || "").trim();
  const email = (form.get("client_email") || "").trim();
  const sujet = (form.get("sujet") || "").trim() || "Appel AdamEcom";
  const duree = Number(form.get("duree_min") || 30);
  const lien = (form.get("lien_meet") || "").trim();
  const google = await etatGoogle(env.DB);
  if (!nom) return { erreur: "Il manque le nom du client." };
  if (!email.includes("@")) return { erreur: "Il manque un email valide." };
  if (!google.connecte && !/^https?:\/\//.test(lien)) {
    return { erreur: "Connectez votre agenda Google, ou fournissez un lien de visio." };
  }
  const debut = new Date(Date.now() + 6e4).toISOString();
  const fuseau = (form.get("fuseau") || "Africa/Casablanca").trim();
  const r = await env.DB.prepare(
    `INSERT INTO meetings (client_nom, client_email, sujet, note, debut, duree_min,
                           fuseau, lien_meet, statut, jeton, cree_le)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 'brouillon', ?, ?)`
  ).bind(
    nom,
    email,
    sujet,
    debut,
    duree,
    fuseau,
    lien || "",
    jetonAleatoire(),
    (/* @__PURE__ */ new Date()).toISOString()
  ).run();
  const id = r.meta.last_row_id;
  if (google.connecte) {
    try {
      const ev = await creerEvenement(env, {
        id,
        sujet,
        note: null,
        debut,
        duree_min: duree,
        fuseau,
        client_nom: nom,
        client_email: email
      });
      await env.DB.prepare(
        "UPDATE meetings SET lien_meet=?, google_event_id=?, google_lien=? WHERE id=?"
      ).bind(ev.lien, ev.id, ev.lienAgenda, id).run();
    } catch (e) {
      return { id, avertissement: `Rendez-vous cr\xE9\xE9, mais Google a refus\xE9 : ${e.message}` };
    }
  }
  const envoi = await envoyerInvitation(env, id);
  if (envoi.erreur) return { id, avertissement: `Rendez-vous cr\xE9\xE9, mais l'envoi a \xE9chou\xE9 : ${envoi.erreur}` };
  const m = await lireMeeting(env.DB, id);
  return { id, ok: true, lien: m.lien_meet };
}
__name(meetingInstantane, "meetingInstantane");
__name2(meetingInstantane, "meetingInstantane");
__name22(meetingInstantane, "meetingInstantane");
var euros2 = /* @__PURE__ */ __name22((n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n || 0)), "euros");
var eurosPrecis = /* @__PURE__ */ __name22((n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n || 0)), "eurosPrecis");
var PERIODES = [
  { id: "7", nom: "7 jours" },
  { id: "30", nom: "30 jours" },
  { id: "90", nom: "90 jours" },
  { id: "365", nom: "12 mois" }
];
var tous = /* @__PURE__ */ __name22(async (db, sql, ...args) => {
  try {
    const { results = [] } = await db.prepare(sql).bind(...args).all();
    return results;
  } catch {
    return [];
  }
}, "tous");
var REQ = `query ($q: String!, $apres: String) {
  orders(first: 250, after: $apres, query: $q, sortKey: CREATED_AT, reverse: true) {
    nodes {
      id name createdAt displayFinancialStatus sourceName
      totalPriceSet { shopMoney { amount } }
      customer { id displayName email }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;
async function commandesDepuis(env, jeton, jour, maxPages = 6) {
  const out = [];
  let apres = null;
  for (let i = 0; i < maxPages; i++) {
    const d = await shopify(env, jeton, REQ, { q: `created_at:>=${jour}`, apres });
    out.push(...d.orders.nodes);
    if (!d.orders.pageInfo.hasNextPage) return { commandes: out, tronque: false };
    apres = d.orders.pageInfo.endCursor;
  }
  return { commandes: out, tronque: true };
}
__name(commandesDepuis, "commandesDepuis");
__name2(commandesDepuis, "commandesDepuis");
__name22(commandesDepuis, "commandesDepuis");
function graphe(series, hauteur = 150) {
  if (!series.length) return `<div class="vide">Pas encore de donn\xE9es.</div>`;
  const max = Math.max(...series.map((s) => s.valeur), 1);
  const l = 100 / series.length;
  return `<div class="tw" style="padding:18px 16px 12px">
    <svg viewBox="0 0 100 ${hauteur}" preserveAspectRatio="none"
         style="width:100%;height:${hauteur}px;display:block" role="img"
         aria-label="Chiffre d'affaires par mois">
      ${series.map((s, i) => {
    const h = Math.max(s.valeur / max * (hauteur - 26), s.valeur > 0 ? 2 : 0);
    return `<rect x="${i * l + l * 0.18}" y="${hauteur - 22 - h}" width="${l * 0.64}" height="${h}"
          rx="0.6" fill="var(--jaune)"><title>${echapper(s.nom)} : ${eurosPrecis(s.valeur)}</title></rect>`;
  }).join("")}
    </svg>
    <div style="display:flex;margin-top:-6px">
      ${series.map((s) => `<div style="flex:1;text-align:center;font-size:10.5px;color:var(--gris);
        font-family:var(--mono)">${echapper(s.nom)}</div>`).join("")}
    </div>
    <div style="display:flex;margin-top:4px">
      ${series.map((s) => `<div style="flex:1;text-align:center;font-size:11px;font-weight:700;
        font-variant-numeric:tabular-nums">${s.valeur ? euros2(s.valeur) : "\u2014"}</div>`).join("")}
    </div>
  </div>`;
}
__name(graphe, "graphe");
__name2(graphe, "graphe");
__name22(graphe, "graphe");
async function pageAnalytics(env, url) {
  const cle = encodeURIComponent(env.CLE_TEST);
  const jours = PERIODES.some((p) => p.id === url.searchParams.get("p")) ? url.searchParams.get("p") : "30";
  const depuis2 = new Date(Date.now() - Number(jours) * 864e5);
  const depuisIso = depuis2.toISOString();
  const jourGraphe = new Date(Date.now() - 182 * 864e5).toISOString().slice(0, 10);
  const jourPeriode = depuisIso.slice(0, 10);
  const jourDepart = jourPeriode < jourGraphe ? jourPeriode : jourGraphe;
  let toutes = [], tronque = false, erreurShopify = null;
  try {
    const jeton = await jetonShopify(env);
    const r = await commandesDepuis(env, jeton, jourDepart);
    toutes = r.commandes;
    tronque = r.tronque;
  } catch (e) {
    erreurShopify = e.message;
  }
  const commandes = toutes.filter((o) => o.createdAt >= depuisIso);
  const payees = commandes.filter((o) => o.displayFinancialStatus === "PAID");
  const ventes = payees.filter((o) => Number(o.totalPriceSet.shopMoney.amount) > 0);
  const ca = ventes.reduce((s, o) => s + Number(o.totalPriceSet.shopMoney.amount), 0);
  const panier = ventes.length ? ca / ventes.length : 0;
  const [
    [{ n: nbResa = 0 } = {}],
    [{ n: nbMeet = 0 } = {}],
    factures,
    [{ n: nbCamp = 0 } = {}],
    [{ n: destinataires = 0 } = {}]
  ] = await Promise.all([
    tous(env.DB, "SELECT COUNT(*) AS n FROM reservations WHERE cree_le >= ?", depuisIso),
    tous(env.DB, "SELECT COUNT(*) AS n FROM meetings WHERE cree_le >= ? AND statut != 'annul\xE9'", depuisIso),
    tous(env.DB, "SELECT statut, montant, client_nom, numero, cree_le FROM factures WHERE cree_le >= ?", depuisIso),
    tous(env.DB, "SELECT COUNT(*) AS n FROM campagnes WHERE envoyee_le >= ?", depuisIso),
    tous(env.DB, "SELECT SUM(destinataires) AS n FROM campagnes WHERE envoyee_le >= ?", depuisIso)
  ]);
  const facturees = factures.filter((f) => f.statut !== "annul\xE9e");
  const encaissees = factures.filter((f) => f.statut === "pay\xE9e");
  const enAttente = factures.filter((f) => f.statut === "envoy\xE9e");
  const montantAttente = enAttente.reduce((s, f) => s + Number(f.montant), 0);
  const parMois = [];
  if (!erreurShopify) {
    const cumul = /* @__PURE__ */ new Map();
    for (const o of toutes) {
      if (o.displayFinancialStatus !== "PAID") continue;
      const v = Number(o.totalPriceSet.shopMoney.amount);
      if (v <= 0) continue;
      const k = o.createdAt.slice(0, 7);
      cumul.set(k, (cumul.get(k) || 0) + v);
    }
    for (let i = 5; i >= 0; i--) {
      const d2 = /* @__PURE__ */ new Date();
      d2.setUTCDate(1);
      d2.setUTCMonth(d2.getUTCMonth() - i);
      const k = d2.toISOString().slice(0, 7);
      parMois.push({
        nom: d2.toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" }),
        valeur: cumul.get(k) || 0
      });
    }
  }
  const parClient = /* @__PURE__ */ new Map();
  for (const o of ventes) {
    const k = o.customer?.email || "\u2014";
    const e = parClient.get(k) || { nom: o.customer?.displayName || k, total: 0, n: 0 };
    e.total += Number(o.totalPriceSet.shopMoney.amount);
    e.n += 1;
    parClient.set(k, e);
  }
  const meilleurs = [...parClient.values()].sort((a, b) => b.total - a.total).slice(0, 8);
  const carte = /* @__PURE__ */ __name22((k, v, s, classe = "neutre") => `<div class="carte ${classe}"><div class="k">${echapper(k)}</div>
      <div class="v">${v}</div>${s ? `<div class="s">${echapper(s)}</div>` : ""}</div>`, "carte");
  const taux = nbResa ? Math.round(encaissees.length / nbResa * 100) : null;
  return `
  <section><div class="actions">
    ${PERIODES.map((p) => `<a class="bouton gros${p.id === jours ? "" : " pale"}"
      href="?cle=${cle}&page=analytics&p=${p.id}">${p.nom}</a>`).join("")}
  </div></section>

  ${erreurShopify ? `<div class="alerte">Ventes indisponibles \u2014 Shopify a r\xE9pondu :
    <span class="sec">${echapper(erreurShopify)}</span></div>` : ""}

  ${tronque ? `<div class="note">Plus de 1 500 commandes sur la p\xE9riode : les plus anciennes
    ne sont pas compt\xE9es. Choisissez une p\xE9riode plus courte pour un chiffre exact.</div>` : ""}

  <section><h2>Ventes</h2><div class="grille">
    ${carte("Chiffre d'affaires", eurosPrecis(ca), `sur ${jours} jours`, ca > 0 ? "bon" : "neutre")}
    ${carte("Commandes pay\xE9es", ventes.length, "hors rendez-vous \xE0 0 \u20AC")}
    ${carte("Panier moyen", eurosPrecis(panier), "")}
    ${carte(
    "\xC0 encaisser",
    eurosPrecis(montantAttente),
    `${enAttente.length} facture(s) envoy\xE9e(s)`,
    montantAttente > 0 ? "moyen" : "neutre"
  )}
  </div></section>

  <section><h2>Chiffre d'affaires par mois</h2>${graphe(parMois)}</section>

  <section><h2>Activit\xE9 commerciale</h2><div class="grille">
    ${carte("Prospects", nbResa, "appels r\xE9serv\xE9s via Calendly")}
    ${carte("Rendez-vous", nbMeet, "visios programm\xE9es")}
    ${carte("Factures \xE9mises", facturees.length, `${encaissees.length} encaiss\xE9e(s)`)}
    ${carte(
    "Transformation",
    taux === null ? "\u2014" : `${taux} %`,
    "prospects devenus clients payants",
    taux !== null && taux >= 20 ? "bon" : "neutre"
  )}
  </div></section>

  <section><h2>Newsletter</h2><div class="grille">
    ${carte("Campagnes", nbCamp, `sur ${jours} jours`)}
    ${carte("Emails envoy\xE9s", destinataires || 0, "")}
  </div></section>

  <section><h2>Meilleurs clients</h2>
    <div class="tw">${meilleurs.length ? `<table>
      <thead><tr><th>Client</th><th class="num">Commandes</th><th class="num">Total</th></tr></thead>
      <tbody>${meilleurs.map((c) => `<tr>
        <td><b>${echapper(c.nom)}</b></td>
        <td class="num">${c.n}</td>
        <td class="num"><b>${eurosPrecis(c.total)}</b></td></tr>`).join("")}</tbody></table>` : `<div class="vide">Aucune vente sur la p\xE9riode.</div>`}</div>
  </section>

  <div class="note">Les ventes viennent de Shopify en direct. Les commandes \xE0 0 \u20AC cr\xE9\xE9es par les
    r\xE9servations Calendly sont exclues du chiffre d'affaires et du panier moyen \u2014 sinon vos
    indicateurs seraient fauss\xE9s par des prospects qui n'ont rien achet\xE9.</div>`;
}
__name(pageAnalytics, "pageAnalytics");
__name2(pageAnalytics, "pageAnalytics");
__name22(pageAnalytics, "pageAnalytics");
var TYPES = {
  openers: { nom: "ont ouvert", titre: "Qui a ouvert" },
  clickers: { nom: "ont cliqu\xE9", titre: "Qui a cliqu\xE9" }
};
async function statistiques(env, limite = 50) {
  const d = await brevo(env, `/emailCampaigns?statistics=globalStats&limit=${limite}&offset=0`);
  const par = /* @__PURE__ */ new Map();
  for (const c of d.campaigns || []) {
    const g = c.statistics?.globalStats || {};
    const livres = Number(g.delivered || 0);
    par.set(String(c.id), {
      envoyes: Number(g.sent || 0),
      livres,
      // « uniqueViews » et « uniqueClicks » comptent les personnes ;
      // « viewed » et « clickers » comptent les gestes. C'est le nombre de
      // personnes qui intéresse ici.
      ouvreurs: Number(g.uniqueViews || 0),
      ouvertures: Number(g.viewed || 0),
      cliqueurs: Number(g.uniqueClicks || 0),
      clics: Number(g.clickers || 0),
      desabonnements: Number(g.unsubscriptions || 0),
      rebonds: Number(g.softBounces || 0) + Number(g.hardBounces || 0),
      plaintes: Number(g.complaints || 0),
      mppApple: Number(g.appleMppOpens || 0),
      tauxOuverture: livres ? Number(g.uniqueViews || 0) / livres : null,
      tauxClic: livres ? Number(g.uniqueClicks || 0) / livres : null
    });
  }
  return par;
}
__name(statistiques, "statistiques");
__name2(statistiques, "statistiques");
__name22(statistiques, "statistiques");
async function liens(env, campagne) {
  const d = await brevo(env, `/emailCampaigns/${encodeURIComponent(campagne)}?statistics=linksStats`);
  const brut = d.statistics?.linksStats || {};
  return Object.entries(brut).map(([url, clics]) => ({ url, clics: Number(clics || 0) })).sort((a, b) => b.clics - a.clics);
}
__name(liens, "liens");
__name2(liens, "liens");
__name22(liens, "liens");
var lireExport = /* @__PURE__ */ __name22((db, campagne, type) => db.prepare("SELECT * FROM exports_campagne WHERE campagne = ? AND type = ?").bind(String(campagne), type).first().catch(() => null), "lireExport");
var lireExports = /* @__PURE__ */ __name22(async (db, campagne) => {
  try {
    const { results = [] } = await db.prepare("SELECT * FROM exports_campagne WHERE campagne = ?").bind(String(campagne)).all();
    return Object.fromEntries(results.map((r) => [r.type, r]));
  } catch {
    return {};
  }
}, "lireExports");
var ecrire = /* @__PURE__ */ __name22((db, campagne, type, champs2) => {
  const c = {
    process_id: null,
    statut: "demand\xE9",
    contacts: null,
    nb: null,
    message: null,
    fini_le: null,
    ...champs2
  };
  return db.prepare(
    `INSERT OR REPLACE INTO exports_campagne
     (campagne, type, process_id, statut, contacts, nb, message, demande_le, fini_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    String(campagne),
    type,
    c.process_id,
    c.statut,
    c.contacts,
    c.nb,
    c.message,
    (/* @__PURE__ */ new Date()).toISOString(),
    c.fini_le
  ).run();
}, "ecrire");
async function demanderExport(env, campagne, type) {
  if (!TYPES[type]) return { erreur: "Type de liste inconnu." };
  try {
    const d = await brevo(env, `/emailCampaigns/${encodeURIComponent(campagne)}/exportRecipients`, {
      method: "POST",
      body: JSON.stringify({ recipientsType: type })
    });
    if (!d.processId) return { erreur: "Brevo n'a pas renvoy\xE9 de num\xE9ro de t\xE2che." };
    await ecrire(env.DB, campagne, type, { process_id: String(d.processId), statut: "demand\xE9" });
    return { ok: true, processId: d.processId };
  } catch (e) {
    await ecrire(env.DB, campagne, type, { statut: "\xE9chec", message: e.message });
    return { erreur: e.message };
  }
}
__name(demanderExport, "demanderExport");
__name2(demanderExport, "demanderExport");
__name22(demanderExport, "demanderExport");
function adressesDuCsv(texte) {
  const lignes = String(texte).split(/\r?\n/).filter((l) => l.trim());
  const adresses = [];
  for (const ligne of lignes) {
    const champs2 = [];
    let courant = "", entreGuillemets = false;
    for (let i = 0; i < ligne.length; i++) {
      const c = ligne[i];
      if (c === '"') {
        if (entreGuillemets && ligne[i + 1] === '"') {
          courant += '"';
          i++;
        } else entreGuillemets = !entreGuillemets;
      } else if ((c === "," || c === ";") && !entreGuillemets) {
        champs2.push(courant);
        courant = "";
      } else courant += c;
    }
    champs2.push(courant);
    const mail = champs2.map((c) => c.trim()).find((c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c));
    if (mail) adresses.push(mail.toLowerCase());
  }
  return [...new Set(adresses)];
}
__name(adressesDuCsv, "adressesDuCsv");
__name2(adressesDuCsv, "adressesDuCsv");
__name22(adressesDuCsv, "adressesDuCsv");
async function avancerExport(env, campagne, type) {
  const ligne = await lireExport(env.DB, campagne, type);
  if (!ligne?.process_id) return { erreur: "Aucun export en cours." };
  if (ligne.statut === "pr\xEAt") return { ok: true, deja: true };
  let p;
  try {
    p = await brevo(env, `/processes/${encodeURIComponent(ligne.process_id)}`);
  } catch (e) {
    return { erreur: `Brevo : ${e.message}` };
  }
  if (p.status === "failed" || p.status === "cancelled") {
    await ecrire(
      env.DB,
      campagne,
      type,
      { process_id: ligne.process_id, statut: "\xE9chec", message: `Brevo a abandonn\xE9 l'export (${p.status}).` }
    );
    return { erreur: `Brevo a abandonn\xE9 l'export (${p.status}).` };
  }
  if (p.status !== "completed" || !p.export_url) {
    return { ok: true, enCours: true, statut: p.status };
  }
  let adresses;
  try {
    const res = await fetch(p.export_url);
    if (!res.ok) throw new Error(`t\xE9l\xE9chargement \u2192 ${res.status}`);
    adresses = adressesDuCsv(await res.text());
  } catch (e) {
    return { erreur: `Fichier illisible : ${e.message}` };
  }
  await ecrire(env.DB, campagne, type, {
    process_id: ligne.process_id,
    statut: "pr\xEAt",
    contacts: JSON.stringify(adresses),
    nb: adresses.length,
    fini_le: (/* @__PURE__ */ new Date()).toISOString()
  });
  return { ok: true, nb: adresses.length };
}
__name(avancerExport, "avancerExport");
__name2(avancerExport, "avancerExport");
__name22(avancerExport, "avancerExport");
var PRIORITES = ["haute", "normale", "basse"];
var STATUTS = ["\xE0 faire", "en cours", "faite"];
var aujourdhui = /* @__PURE__ */ __name22((tz = "Africa/Casablanca") => (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA", { timeZone: tz }), "aujourdhui");
var jourPlus = /* @__PURE__ */ __name22((n, tz = "Africa/Casablanca") => new Date(Date.now() + n * 864e5).toLocaleDateString("en-CA", { timeZone: tz }), "jourPlus");
function dateLivraison(validation, delai, type = "calendaires") {
  const n = Number(delai);
  if (!validation || delai === null || delai === "" || !Number.isFinite(n) || n <= 0) return null;
  const d = /* @__PURE__ */ new Date(`${validation}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (type === "ouvres") {
    let reste = Math.round(n);
    while (reste > 0) {
      d.setUTCDate(d.getUTCDate() + 1);
      const j = d.getUTCDay();
      if (j !== 0 && j !== 6) reste--;
    }
  } else {
    d.setUTCDate(d.getUTCDate() + Math.round(n));
  }
  return d.toISOString().slice(0, 10);
}
__name(dateLivraison, "dateLivraison");
__name2(dateLivraison, "dateLivraison");
__name22(dateLivraison, "dateLivraison");
var livraisonDe = /* @__PURE__ */ __name22((t) => dateLivraison(t.date_validation, t.delai_jours, t.delai_type || "calendaires"), "livraisonDe");
function joursRestants(date) {
  if (!date) return null;
  const a = Date.parse(`${aujourdhui()}T12:00:00Z`);
  const b = Date.parse(`${date}T12:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 864e5);
}
__name(joursRestants, "joursRestants");
__name2(joursRestants, "joursRestants");
__name22(joursRestants, "joursRestants");
var echeanceEffective = /* @__PURE__ */ __name22((t) => t.echeance || livraisonDe(t), "echeanceEffective");
var resteEnClair = /* @__PURE__ */ __name22((n) => n === null ? "" : n < 0 ? `${-n} jour${-n > 1 ? "s" : ""} de retard` : n === 0 ? "\xE0 livrer aujourd'hui" : `${n} jour${n > 1 ? "s" : ""} restant${n > 1 ? "s" : ""}`, "resteEnClair");
var listeTaches = /* @__PURE__ */ __name22(async (db, limite = 200) => {
  try {
    const { results = [] } = await db.prepare(
      `SELECT * FROM taches ORDER BY
         CASE statut WHEN 'faite' THEN 1 ELSE 0 END,
         echeance IS NULL, echeance,
         CASE priorite WHEN 'haute' THEN 0 WHEN 'normale' THEN 1 ELSE 2 END,
         id DESC
       LIMIT ?`
    ).bind(limite).all();
    return results;
  } catch {
    return [];
  }
}, "listeTaches");
var lireTache = /* @__PURE__ */ __name22((db, id) => db.prepare("SELECT * FROM taches WHERE id = ?").bind(id).first(), "lireTache");
async function resumeTaches(db) {
  const j = aujourdhui();
  try {
    const r = await db.prepare(
      `SELECT
         SUM(statut != 'faite' AND echeance IS NOT NULL AND echeance < ?) AS retard,
         SUM(statut != 'faite' AND echeance = ?)                          AS jour,
         SUM(statut != 'faite')                                           AS ouvertes
       FROM taches`
    ).bind(j, j).first();
    return { retard: r?.retard || 0, jour: r?.jour || 0, ouvertes: r?.ouvertes || 0 };
  } catch {
    return { retard: 0, jour: 0, ouvertes: 0 };
  }
}
__name(resumeTaches, "resumeTaches");
__name2(resumeTaches, "resumeTaches");
__name22(resumeTaches, "resumeTaches");
var champs = /* @__PURE__ */ __name22((form) => ({
  titre: (form.get("titre") || "").trim(),
  detail: (form.get("detail") || "").trim() || null,
  echeance: (form.get("echeance") || "").trim() || null,
  priorite: PRIORITES.includes(form.get("priorite")) ? form.get("priorite") : "normale",
  statut: STATUTS.includes(form.get("statut")) ? form.get("statut") : "\xE0 faire",
  clientEmail: (form.get("client_email") || "").trim() || null,
  clientNom: (form.get("client_nom") || "").trim() || null,
  notes: (form.get("notes_projet") || "").trim() || null,
  validation: (form.get("date_validation") || "").trim() || null,
  delai: (() => {
    const n = Number(String(form.get("delai_jours") || "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  })(),
  delaiType: form.get("delai_type") === "ouvres" ? "ouvres" : "calendaires"
}), "champs");
async function creerTache(env, form) {
  const c = champs(form);
  if (!c.titre) return { erreur: "Il manque l'intitul\xE9 de la t\xE2che." };
  const r = await env.DB.prepare(
    `INSERT INTO taches (titre, detail, echeance, priorite, statut, client_nom, client_email,
                         notes_projet, date_validation, delai_jours, delai_type, cree_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    c.titre,
    c.detail,
    c.echeance,
    c.priorite,
    c.statut,
    c.clientNom,
    c.clientEmail,
    c.notes,
    c.validation,
    c.delai,
    c.delaiType,
    (/* @__PURE__ */ new Date()).toISOString()
  ).run();
  return { id: r.meta.last_row_id };
}
__name(creerTache, "creerTache");
__name2(creerTache, "creerTache");
__name22(creerTache, "creerTache");
async function modifierTache(env, id, form) {
  const t = await lireTache(env.DB, id);
  if (!t) return { erreur: "T\xE2che introuvable." };
  const c = champs(form);
  if (!c.titre) return { erreur: "Il manque l'intitul\xE9 de la t\xE2che." };
  await env.DB.prepare(
    `UPDATE taches SET titre=?, detail=?, echeance=?, priorite=?, statut=?,
                       client_nom=?, client_email=?,
                       notes_projet=?, date_validation=?, delai_jours=?, delai_type=?, maj_le=?,
                       faite_le = CASE WHEN ?='faite' THEN COALESCE(faite_le, ?) ELSE NULL END
     WHERE id=?`
  ).bind(
    c.titre,
    c.detail,
    c.echeance,
    c.priorite,
    c.statut,
    c.clientNom,
    c.clientEmail,
    c.notes,
    c.validation,
    c.delai,
    c.delaiType,
    (/* @__PURE__ */ new Date()).toISOString(),
    c.statut,
    (/* @__PURE__ */ new Date()).toISOString(),
    id
  ).run();
  return { ok: true };
}
__name(modifierTache, "modifierTache");
__name2(modifierTache, "modifierTache");
__name22(modifierTache, "modifierTache");
async function basculerTache(env, id) {
  const t = await lireTache(env.DB, id);
  if (!t) return { erreur: "T\xE2che introuvable." };
  const fait = t.statut === "faite";
  await env.DB.prepare(
    "UPDATE taches SET statut=?, faite_le=?, maj_le=? WHERE id=?"
  ).bind(
    fait ? "\xE0 faire" : "faite",
    fait ? null : (/* @__PURE__ */ new Date()).toISOString(),
    (/* @__PURE__ */ new Date()).toISOString(),
    id
  ).run();
  return { ok: true, faite: !fait };
}
__name(basculerTache, "basculerTache");
__name2(basculerTache, "basculerTache");
__name22(basculerTache, "basculerTache");
async function supprimerTache(env, id) {
  const t = await lireTache(env.DB, id);
  if (!t) return { erreur: "T\xE2che introuvable." };
  await env.DB.prepare("DELETE FROM taches WHERE id=?").bind(id).run();
  return { ok: true };
}
__name(supprimerTache, "supprimerTache");
__name2(supprimerTache, "supprimerTache");
__name22(supprimerTache, "supprimerTache");
async function purgerTerminees(env) {
  const r = await env.DB.prepare("DELETE FROM taches WHERE statut='faite'").run();
  return { ok: true, nb: r.meta.changes || 0 };
}
__name(purgerTerminees, "purgerTerminees");
__name2(purgerTerminees, "purgerTerminees");
__name22(purgerTerminees, "purgerTerminees");
function grouper(taches) {
  const j = aujourdhui(), sem = jourPlus(7);
  const g = {
    retard: [],
    jour: [],
    semaine: [],
    plusTard: [],
    sansDate: [],
    faites: []
  };
  for (const t of taches) {
    if (t.statut === "faite") {
      g.faites.push(t);
      continue;
    }
    const e = echeanceEffective(t);
    if (!e) {
      g.sansDate.push(t);
      continue;
    }
    if (e < j) g.retard.push(t);
    else if (e === j) g.jour.push(t);
    else if (e <= sem) g.semaine.push(t);
    else g.plusTard.push(t);
  }
  return g;
}
__name(grouper, "grouper");
__name2(grouper, "grouper");
__name22(grouper, "grouper");
var dateCourte = /* @__PURE__ */ __name22((iso) => {
  if (!iso) return "";
  try {
    return (/* @__PURE__ */ new Date(`${iso}T12:00:00Z`)).toLocaleDateString(
      "fr-FR",
      { day: "numeric", month: "short", timeZone: "UTC" }
    );
  } catch {
    return iso;
  }
}, "dateCourte");
function voletTache(t, cle, clients, aides) {
  const { carteHtml: carteHtml2, dateFr: dateFr3 } = aides;
  const livraison = livraisonDe(t);
  const reste = joursRestants(livraison);
  const faite = t.statut === "faite";
  const opt = /* @__PURE__ */ __name22((v, sel, lib) => `<option value="${v}"${v === sel ? " selected" : ""}>${lib || v}</option>`, "opt");
  return `
      <div class="volet-tete">
        <h2 style="margin:0">T\xE2che</h2>
        <a class="fermer" href="?cle=${cle}&page=taches" aria-label="Fermer le volet" title="Fermer">\xD7</a>
      </div>

      <section>
        <div class="titre-campagne">${echapper(t.titre)}</div>
        ${t.client_nom || t.client_email ? `<div class="sec" style="margin:-2px 0 4px">
          pour <b style="font-family:var(--sans);font-size:13px">${echapper(t.client_nom || t.client_email)}</b>${t.client_nom && t.client_email ? ` \xB7 ${echapper(t.client_email)}` : ""}</div>` : ""}
        <div class="grille">
          ${carteHtml2(
    "Statut",
    t.statut,
    t.faite_le ? `termin\xE9e ${dateFr3(t.faite_le)}` : "",
    faite ? "bon" : t.statut === "en cours" ? "moyen" : "neutre"
  )}
          ${carteHtml2(
    "Valid\xE9 le",
    t.date_validation ? dateCourte(t.date_validation) : "\u2014",
    t.date_validation ? "point de d\xE9part du d\xE9lai" : "date de validation non saisie"
  )}
          ${carteHtml2(
    "Livraison",
    livraison ? dateCourte(livraison) : "\u2014",
    livraison ? `${t.delai_jours} jours ${t.delai_type === "ouvres" ? "ouvr\xE9s" : "calendaires"}` : "renseignez validation et d\xE9lai"
  )}
          ${livraison && !faite ? carteHtml2(
    "Il reste",
    reste < 0 ? `${-reste} j` : `${reste} j`,
    resteEnClair(reste),
    reste < 0 ? "mauvais" : reste <= 2 ? "moyen" : "bon"
  ) : carteHtml2("Client", t.client_nom || t.client_email || "\u2014", t.client_nom ? echapper(t.client_email || "") : "")}
        </div>
      </section>

      ${t.notes_projet ? `<section><h2>Le projet</h2>
        <div class="tw"><div style="padding:18px 20px;white-space:pre-wrap;line-height:1.65">${echapper(t.notes_projet)}</div></div>
      </section>` : ""}

      <section>
      <div class="actions">
        <form method="POST" action="?cle=${cle}&page=taches&id=${t.id}&action=basculer_tache&retour=fiche">
          <button class="envoyer${faite ? " discret" : ""}" type="submit">
            ${faite ? "Rouvrir la t\xE2che" : "Marquer comme faite"}</button></form>
      </div></section>

      <section><h2>Modifier</h2>
      <form class="f" method="POST" action="?cle=${cle}&page=taches&id=${t.id}&action=modifier_tache">
        <label class="large">Intitul\xE9<input name="titre" required value="${echapper(t.titre)}"></label>

        <label class="large">Informations sur le projet
          <textarea name="notes_projet" style="min-height:150px"
            placeholder="P\xE9rim\xE8tre, livrables attendus, points d'attention, acc\xE8s fournis\u2026">${echapper(t.notes_projet || "")}</textarea></label>

        <label>Date de validation
          <input name="date_validation" type="date" id="dv" value="${echapper(t.date_validation || "")}"></label>
        <label>D\xE9lai de livraison
          <input name="delai_jours" type="number" min="1" step="1" id="dj"
            value="${t.delai_jours ?? ""}" placeholder="14"></label>
        <label>Type de d\xE9lai
          <select name="delai_type" id="dt">
            ${opt("calendaires", t.delai_type || "calendaires", "jours calendaires")}
            ${opt("ouvres", t.delai_type || "calendaires", "jours ouvr\xE9s (hors week-end)")}
          </select></label>
        <div class="calcul" id="calc" aria-live="polite">\u2014</div>

        <label>\xC9ch\xE9ance <span style="font-weight:400">(sinon, la livraison fait foi)</span>
          <input name="echeance" type="date" value="${echapper(t.echeance || "")}"></label>
        <label>Priorit\xE9<select name="priorite">
          ${PRIORITES.map((x) => opt(x, t.priorite)).join("")}</select></label>
        <label>Statut<select name="statut">
          ${STATUTS.map((x) => opt(x, t.statut)).join("")}</select></label>
        <label>Client concern\xE9
          <select name="client_email" id="cliT" onchange="majNomT()">
            <option value="">\u2014 aucun \u2014</option>
            ${// La liste Shopify est plafonnée à 100 clients. Si celui de la tâche
  // n'y figure pas, on l'ajoute : sans ça, un simple enregistrement
  // effacerait le rattachement sans prévenir.
  t.client_email && !clients.some((c) => c.email === t.client_email) ? `<option value="${echapper(t.client_email)}" data-nom="${echapper(t.client_nom || "")}" selected>
                    ${echapper(t.client_nom || t.client_email)} (hors liste)</option>` : ""}
            ${clients.map((c) => `<option value="${echapper(c.email)}" data-nom="${echapper(c.displayName || "")}"${c.email === t.client_email ? " selected" : ""}>${echapper(c.displayName || c.email)}</option>`).join("")}
          </select></label>
        <input type="hidden" name="client_nom" id="cliNomT" value="${echapper(t.client_nom || "")}">

        <label class="large">Note interne
          <textarea name="detail" style="min-height:90px">${echapper(t.detail || "")}</textarea></label>
        <button class="envoyer large" type="submit">Enregistrer</button>
      </form>

      <details style="margin-top:6px"><summary>Supprimer cette t\xE2che</summary>
        <div class="dedans">
          <p style="margin:0">La suppression est d\xE9finitive et n'est pas conserv\xE9e dans le journal.</p>
          <form method="POST" action="?cle=${cle}&page=taches&id=${t.id}&action=supprimer_tache">
            <button class="envoyer" type="submit" style="background:var(--rouge);color:#fff"
              onclick="return confirm('Supprimer d\xE9finitivement cette t\xE2che ?')">Supprimer</button></form>
        </div></details>
      </section>

      <script>
        function majNomT(){const o=document.getElementById('cliT').selectedOptions[0];
          document.getElementById('cliNomT').value=o.dataset.nom||'';}
        // M\xEAme r\xE8gle de calcul que c\xF4t\xE9 serveur, pour que la date annonc\xE9e
        // pendant la saisie soit celle qui sera enregistr\xE9e.
        function livraison(dep, n, type){
          if(!dep || !(n > 0)) return null;
          var d = new Date(dep + 'T12:00:00Z');
          if(isNaN(d)) return null;
          if(type === 'ouvres'){ var r = Math.round(n);
            while(r > 0){ d.setUTCDate(d.getUTCDate()+1);
              var j = d.getUTCDay(); if(j !== 0 && j !== 6) r--; } }
          else d.setUTCDate(d.getUTCDate() + Math.round(n));
          return d;
        }
        function recalcul(){
          var d = livraison(document.getElementById('dv').value,
                            Number(document.getElementById('dj').value),
                            document.getElementById('dt').value);
          var el = document.getElementById('calc');
          if(!d){ el.textContent = 'Renseignez une date de validation et un d\xE9lai.';
                  el.className = 'calcul'; return; }
          var today = new Date(); today.setUTCHours(12,0,0,0);
          var reste = Math.round((d - today) / 86400000);
          el.innerHTML = '<b>Livraison le ' +
            d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}) +
            '</b><span>' + (reste < 0 ? (-reste) + ' jour(s) de retard'
              : reste === 0 ? "\xE0 livrer aujourd'hui" : 'dans ' + reste + ' jour(s)') + '</span>';
          el.className = 'calcul ' + (reste < 0 ? 'tard' : 'ok');
        }
        ['dv','dj','dt'].forEach(function(i){
          document.getElementById(i).addEventListener('input', recalcul);
          document.getElementById(i).addEventListener('change', recalcul);
        });
        recalcul();
      <\/script>`;
}
__name(voletTache, "voletTache");
__name2(voletTache, "voletTache");
__name22(voletTache, "voletTache");
async function pageTaches(env, url, message, clients, aides) {
  const { carteHtml: carteHtml2, dateFr: dateFr3 } = aides;
  const cle = encodeURIComponent(env.CLE_TEST);
  const id = url.searchParams.get("id");
  const taches = await listeTaches(env.DB);
  let volet = "";
  if (id) {
    const t = await lireTache(env.DB, Number(id));
    volet = t ? voletTache(t, cle, clients, aides) : `<div class="volet-tete"><h2 style="margin:0">T\xE2che</h2>
         <a class="fermer" href="?cle=${cle}&page=taches" title="Fermer">\xD7</a></div>
         <div class="alerte">T\xE2che introuvable.</div>`;
  }
  const g = grouper(taches);
  const j7 = new Date(Date.now() - 7 * 864e5).toISOString();
  const finies7 = g.faites.filter((t) => (t.faite_le || "") >= j7).length;
  const ligne = /* @__PURE__ */ __name22((t) => {
    const faite = t.statut === "faite";
    const ech = echeanceEffective(t);
    const enRetard = !faite && ech && ech < aujourdhui();
    const livraison = livraisonDe(t);
    const reste = faite ? null : joursRestants(livraison);
    const ouverte = String(t.id) === String(id);
    return `<div class="tache${faite ? " ok" : ""}${ouverte ? " sel" : ""}">
      <form method="POST" action="?cle=${cle}&page=taches&id=${t.id}&action=basculer_tache">
        <button class="coche${faite ? " on" : ""}" type="submit"
          aria-label="${faite ? "Rouvrir" : "Marquer comme faite"}" title="${faite ? "Rouvrir" : "Marquer comme faite"}"></button>
      </form>
      <div class="corps">
        <a class="t" href="?cle=${cle}&page=taches&id=${t.id}">${echapper(t.titre)}</a>
        ${t.detail ? `<div class="d">${echapper(t.detail)}</div>` : ""}
        <div class="meta">
          ${t.priorite !== "normale" ? `<span class="prio ${t.priorite}">${t.priorite}</span>` : ""}
          ${t.statut === "en cours" ? `<span class="prio encours">en cours</span>` : ""}
          ${ech ? `<span class="${enRetard ? "retard" : ""}">${enRetard ? "en retard \u2014 " : ""}${dateCourte(ech)}${!t.echeance && livraison ? " (livraison)" : ""}</span>` : ""}
          ${livraison && reste !== null && !enRetard ? `<span class="${reste <= 2 ? "bientot" : ""}">${resteEnClair(reste)}</span>` : ""}
          ${t.notes_projet ? `<span title="Fiche projet renseign\xE9e">\u25C6 projet</span>` : ""}
          ${t.client_nom || t.client_email ? `<span>${echapper(t.client_nom || t.client_email)}</span>` : ""}
          ${faite && t.faite_le ? `<span>faite ${dateFr3(t.faite_le)}</span>` : ""}
        </div>
      </div>
      <div class="outils">
        <a class="bouton pale" href="?cle=${cle}&page=taches&id=${t.id}">Ouvrir</a>
        <form method="POST" action="?cle=${cle}&page=taches&id=${t.id}&action=supprimer_tache">
          <button class="bouton pale" type="submit"
            onclick="return confirm('Supprimer cette t\xE2che ?')">Supprimer</button></form>
      </div>
    </div>`;
  }, "ligne");
  const groupe = /* @__PURE__ */ __name22((titre, liste2, vide) => !liste2.length && vide === false ? "" : `
    <section><h2>${echapper(titre)} <span class="sec" style="letter-spacing:0">${liste2.length}</span></h2>
      ${liste2.length ? `<div class="taches">${liste2.map(ligne).join("")}</div>` : `<div class="tw"><div class="vide">${echapper(vide || "Rien ici.")}</div></div>`}</section>`, "groupe");
  const liste = `
    <section><div class="grille">
      ${carteHtml2(
    "En retard",
    String(g.retard.length),
    "\xE9ch\xE9ance d\xE9pass\xE9e",
    g.retard.length ? "mauvais" : "neutre"
  )}
      ${carteHtml2(
    "Aujourd'hui",
    String(g.jour.length),
    "\xE0 faire dans la journ\xE9e",
    g.jour.length ? "moyen" : "neutre"
  )}
      ${carteHtml2("Cette semaine", String(g.semaine.length), "dans les 7 jours")}
      ${carteHtml2(
    "Termin\xE9es",
    String(finies7),
    "ces 7 derniers jours",
    finies7 ? "bon" : "neutre"
  )}
    </div></section>

    <section><h2>Ajouter une t\xE2che</h2>
      <form class="f rapide" method="POST" action="?cle=${cle}&page=taches&action=creer_tache">
        <label class="large">Intitul\xE9
          <input name="titre" required placeholder="Refonte de la page produit \u2014 T\xF6sty"></label>
        <label>\xC9ch\xE9ance<input name="echeance" type="date"></label>
        <label>Priorit\xE9<select name="priorite">
          <option value="normale" selected>normale</option>
          <option value="haute">haute</option>
          <option value="basse">basse</option></select></label>
        <label>Client concern\xE9
          <select name="client_email" id="cliN" onchange="majNom()">
            <option value="">\u2014 aucun \u2014</option>
            ${clients.map((c) => `<option value="${echapper(c.email)}" data-nom="${echapper(c.displayName || "")}">
              ${echapper(c.displayName || c.email)}</option>`).join("")}
          </select></label>
        <input type="hidden" name="client_nom" id="cliNom">
        <button class="envoyer" type="submit">Ajouter</button>
      </form>
      <script>
        function majNom(){const o=document.getElementById('cliN').selectedOptions[0];
          document.getElementById('cliNom').value=o.dataset.nom||'';}
      <\/script>
    </section>

    ${g.retard.length ? groupe("En retard", g.retard) : ""}
    ${groupe("Aujourd'hui", g.jour, "Rien de pr\xE9vu aujourd'hui.")}
    ${g.semaine.length ? groupe("Cette semaine", g.semaine) : ""}
    ${g.plusTard.length ? groupe("Plus tard", g.plusTard) : ""}
    ${g.sansDate.length ? groupe("Sans \xE9ch\xE9ance", g.sansDate) : ""}

    ${g.faites.length ? `<section><details><summary>T\xE2ches termin\xE9es
      <span class="sec" style="font-weight:400"> \u2014 ${g.faites.length}</span></summary>
      <div class="dedans">
        <div class="taches">${g.faites.slice(0, 50).map(ligne).join("")}</div>
        <form method="POST" action="?cle=${cle}&page=taches&action=purger_taches">
          <button class="envoyer discret" type="submit"
            onclick="return confirm('Supprimer d\xE9finitivement les ${g.faites.length} t\xE2ches termin\xE9es ?')">
            Vider les t\xE2ches termin\xE9es</button></form>
      </div></details></section>` : ""}`;
  return `${message || ""}
    ${volet ? `<div class="travail"><div class="colonne">${liste}</div>
          <aside class="volet">${volet}</aside></div>` : liste}`;
}
__name(pageTaches, "pageTaches");
__name2(pageTaches, "pageTaches");
__name22(pageTaches, "pageTaches");
var TZ = "Africa/Casablanca";
var dateFr2 = /* @__PURE__ */ __name22((iso, heure = true) => {
  if (!iso) return "\u2014";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      dateStyle: "short",
      ...heure ? { timeStyle: "short" } : {},
      timeZone: TZ
    });
  } catch {
    return iso;
  }
}, "dateFr");
function depuis(iso) {
  if (!iso) return "jamais";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1e3);
  if (s < 90) return `il y a ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 90) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}
__name(depuis, "depuis");
__name2(depuis, "depuis");
__name22(depuis, "depuis");
var euros3 = /* @__PURE__ */ __name22((n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n || 0)), "euros");
var tous2 = /* @__PURE__ */ __name22(async (db, sql, ...args) => {
  try {
    const { results = [] } = await db.prepare(sql).bind(...args).all();
    return results;
  } catch {
    return [];
  }
}, "tous");
var echapperJs = /* @__PURE__ */ __name22((s) => String(s || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, " "), "echapperJs");
var COULEURS = {
  "sign\xE9": "vert",
  "sign\xE9 par le client": "jaune",
  "en attente du client": "jaune",
  "accept\xE9": "vert",
  "factur\xE9": "vert",
  "refus\xE9": "gris",
  "pay\xE9e": "vert",
  "abonn\xE9": "vert",
  "d\xE9j\xE0 abonn\xE9": "vert",
  "subscribed": "vert",
  "ok": "vert",
  "paid": "vert",
  "envoy\xE9": "vert",
  "envoy\xE9e": "jaune",
  "programm\xE9": "jaune",
  "en attente": "jaune",
  "open": "jaune",
  "ouverte": "jaune",
  "pending": "jaune",
  "brouillon": "gris",
  "annul\xE9e": "gris",
  "annul\xE9": "gris",
  "voided": "gris",
  "non abonn\xE9": "rouge",
  "not_subscribed": "rouge",
  "\xE9chec": "rouge",
  "erreur": "rouge"
};
var carteHtml = /* @__PURE__ */ __name22((k, v, sous, classe = "neutre") => `<div class="carte ${classe}"><div class="k">${echapper(k)}</div>
    <div class="v">${v}</div>${sous ? `<div class="s">${echapper(sous)}</div>` : ""}</div>`, "carteHtml");
function pastille(v) {
  if (!v) return `<span class="p p-gris">\u2014</span>`;
  const couleur = COULEURS[String(v).toLowerCase()] || "rouge";
  return `<span class="p p-${couleur}">${echapper(v)}</span>`;
}
__name(pastille, "pastille");
__name2(pastille, "pastille");
__name22(pastille, "pastille");
var ICONES = {
  emails: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M3.5 7.5l7.4 5.2a2 2 0 0 0 2.2 0l7.4-5.2"/><path d="M17 17.5l2 2 3.5-3.5"/>',
  reglages: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l6.4-6.4"/>',
  apercu: '<path d="M4 4h6v6H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 14h6v6H4z"/>',
  analytics: '<path d="M4 20V10M9.5 20V4M15 20v-7M20.5 20v-4"/>',
  taches: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1.3 1.3L7.6 5"/><path d="M4 12l1.3 1.3L7.6 10"/><path d="M4 18l1.3 1.3L7.6 16"/>',
  prospects: '<path d="M12 21a9 9 0 1 1 9-9"/><path d="M12 7v5l3 2"/><path d="M16 19h6M19 16v6"/>',
  clients: '<path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20"/><circle cx="9.5" cy="7" r="3.5"/><path d="M17 4.2a3.5 3.5 0 0 1 0 6.6M21 20v-1.5a4 4 0 0 0-3-3.8"/>',
  facturation: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M14 8H9.8a2 2 0 0 0 0 4h2.4a2 2 0 0 1 0 4H9"/><path d="M11.5 6.5v11"/>',
  devis: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6M9 8h2"/>',
  contrats: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/><path d="M8.5 17c1.2-2 2-2 2.6-.8.5 1 1.1 1.2 2-.2.6-.9 1.3-.9 2.4.2"/><path d="M9 9h5M9 12h6"/>',
  meeting: '<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3v9l-6-3z"/>',
  blog: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  newsletter: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M3.5 7.5l7.4 5.2a2 2 0 0 0 2.2 0l7.4-5.2"/>',
  journal: '<path d="M3 12h4l2.5-6 4 13L16 12h5"/>',
  google: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  facture: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M14 8H9.8a2 2 0 0 0 0 4h2.4a2 2 0 0 1 0 4H9"/><path d="M11.5 6.5v11"/>'
};
var icone = /* @__PURE__ */ __name22((id, taille = 19) => `<svg class="ic" width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">${ICONES[id] || ""}</svg>`, "icone");
var ACTIONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  video: '<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3v9l-6-3z"/>',
  courbe: '<path d="M4 20V10M9.5 20V4M15 20v-7M20.5 20v-4"/>',
  envoi: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M3.5 7.5l7.4 5.2a2 2 0 0 0 2.2 0l7.4-5.2"/>',
  crayon: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M14.5 5.5l4 4"/>',
  valide: '<path d="M20 6L9 17l-5-5"/>',
  eclair: '<path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13z"/>'
};
var ic = /* @__PURE__ */ __name22((nom) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
    style="flex-shrink:0">${ACTIONS[nom]}</svg>`, "ic");
var PAGES = [
  {
    id: "apercu",
    nom: "Vue d'ensemble",
    groupe: "Pilotage",
    sous: "L'\xE9tat de vos automatisations et ce qui vous attend aujourd'hui."
  },
  {
    id: "taches",
    nom: "Mes t\xE2ches",
    groupe: "Pilotage",
    sous: "Vos projets et leurs d\xE9lais de livraison, class\xE9s par urgence."
  },
  {
    id: "analytics",
    nom: "Analytics",
    groupe: "Pilotage",
    sous: "Chiffre d'affaires, commandes et transformation, lus dans Shopify."
  },
  {
    id: "radar",
    nom: "Prospect Radar",
    groupe: "Pilotage",
    sous: "Les boutiques Shopify qui investissent en publicit\xE9 et dont le site convertit mal."
  },
  {
    id: "prospects",
    nom: "Prospects",
    groupe: "Clients",
    sous: "Les appels r\xE9serv\xE9s via Calendly, avec leurs r\xE9ponses au formulaire."
  },
  {
    id: "clients",
    nom: "Fiches clients",
    groupe: "Clients",
    sous: "Vos clients Shopify, leurs commandes et leurs consentements."
  },
  {
    id: "facturation",
    nom: "Factures",
    groupe: "Activit\xE9",
    sous: "Vos factures \xE9mises, ce qui reste \xE0 encaisser, et le suivi de la boutique."
  },
  {
    id: "devis",
    nom: "Devis",
    groupe: "Activit\xE9",
    sous: "Collez ce qui est inclus : le devis est mis en page avec votre logo, pr\xEAt \xE0 envoyer ou imprimer."
  },
  {
    id: "contrats",
    nom: "Contrats",
    groupe: "Activit\xE9",
    sous: "Un contrat g\xE9n\xE9r\xE9 \xE0 partir d'un devis, sign\xE9 en ligne par vous et par le client."
  },
  {
    id: "meeting",
    nom: "Rendez-vous",
    groupe: "Activit\xE9",
    sous: "Programmez une visio, ou lancez-en une imm\xE9diatement."
  },
  {
    id: "blog",
    nom: "Blog SEO",
    groupe: "Activit\xE9",
    sous: "Cr\xE9ation, contr\xF4le et validation des articles avant publication Shopify."
  },
  {
    id: "newsletter",
    nom: "Newsletter du blog",
    groupe: "Activit\xE9",
    sous: "Vos articles envoy\xE9s \xE0 vos clients, ceux qui attendent et leurs r\xE9sultats."
  },
  {
    id: "reglages",
    nom: "R\xE9glages",
    groupe: "R\xE9glages",
    sous: "Votre profil, votre logo, vos coordonn\xE9es bancaires et votre mot de passe."
  },
  {
    id: "emails",
    nom: "Emails automatiques",
    groupe: "R\xE9glages",
    sous: "Tous les messages que l'application envoie. Les modifier, les suspendre, voir ce qui est parti."
  },
  {
    id: "journal",
    nom: "Journal",
    groupe: "R\xE9glages",
    sous: "Incidents et ex\xE9cutions des automatisations."
  },
  {
    id: "google",
    nom: "Google & SEO",
    groupe: "R\xE9glages",
    sous: "Agenda, Search Console et Google Analytics pour les rendez-vous et le pilotage SEO."
  },
  // Accessible par lien, volontairement absente du menu.
  {
    id: "facture",
    nom: "Facture",
    parent: "facturation",
    sous: "Cr\xE9ez, envoyez et encaissez une facture."
  }
];
var GROUPES = ["Pilotage", "Clients", "Activit\xE9", "R\xE9glages"];
var AUTO = /* @__PURE__ */ new Set(["apercu", "journal"]);
var STYLE = `
:root{
 --fond:#FAF8F4;--surface:#FFF;--surface2:#F3F0E9;--surface3:#EDE9DF;
 --barre:#0C0B09;--barre-txt:#F6F3EA;
 --encre:#14120E;--doux:#46433C;--gris:#8A8478;--trait:#E4DFD3;--trait-fort:#D3CCBB;
 --jaune:#FFDC3F;--jaune-p:#FFF8D8;--jaune-f:#8A6D00;--jaunef:#FFF8D8;
 --vert:#2F6B2A;--vertf:#E8F1E4;--rouge:#9E3319;--rougef:#FAEAE4;
 --sans:Archivo,"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif;
 --mono:"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace;
 --ombre:0 1px 2px rgba(20,18,14,.04),0 8px 24px -12px rgba(20,18,14,.10);
 --r:10px}
@media(prefers-color-scheme:dark){:root{
 --fond:#100F0C;--surface:#191712;--surface2:#211F19;--surface3:#2A2721;
 --barre:#080706;--barre-txt:#F6F3EA;
 --encre:#F4F1E8;--doux:#C9C3B4;--gris:#928C7D;--trait:#2B2822;--trait-fort:#3A362D;
 --jaune-p:#2C2614;--jaune-f:#FFDC3F;--jaunef:#2C2614;
 --vert:#9DC28F;--vertf:#1A2217;--rouge:#E0A088;--rougef:#2A1712;
 --ombre:0 1px 2px rgba(0,0,0,.3),0 8px 24px -12px rgba(0,0,0,.6)}}

*{box-sizing:border-box}
body{margin:0;background:var(--fond);color:var(--encre);font-family:var(--sans);
 font-size:15px;line-height:1.55;font-feature-settings:"kern","liga";
 -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
a{color:inherit}
:focus-visible{outline:2px solid var(--jaune);outline-offset:2px;border-radius:4px}
.app{display:flex;min-height:100vh}

/* ---------- colonne de navigation ---------- */
.menu{width:236px;flex-shrink:0;background:var(--barre);color:var(--barre-txt);
 display:flex;flex-direction:column;padding:26px 0 20px;position:sticky;top:0;height:100vh}
.marque{padding:0 24px 24px;display:flex;align-items:center;gap:11px;text-decoration:none}
.marque .t{width:26px;height:26px;border-radius:7px;background:var(--jaune);flex-shrink:0;
 display:flex;align-items:center;justify-content:center;color:#0C0B09;
 font-weight:800;font-size:15px;letter-spacing:-.04em}
.marque b{font-size:16.5px;font-weight:700;letter-spacing:-.025em}
.nav{display:flex;flex-direction:column;gap:1px;padding:0 14px;overflow-y:auto}
.nav .grp{font-family:var(--mono);font-size:9px;font-weight:500;letter-spacing:.2em;
 text-transform:uppercase;color:rgba(246,243,234,.30);padding:18px 10px 7px}
.nav a{display:flex;align-items:center;gap:11px;padding:8px 10px;border-radius:7px;
 text-decoration:none;font-size:13.5px;font-weight:500;letter-spacing:-.005em;
 color:rgba(246,243,234,.62);transition:background .12s,color .12s}
.nav a .ic{flex-shrink:0;opacity:.7}
.nav a:hover{background:rgba(246,243,234,.06);color:var(--barre-txt)}
.nav a:hover .ic{opacity:1}
.nav a.on{background:var(--jaune);color:#0C0B09;font-weight:600}
.nav a.on .ic{opacity:1}
.pied{margin-top:auto;padding:20px 24px 0;font-family:var(--mono);font-size:9.5px;
 letter-spacing:.04em;color:rgba(246,243,234,.28);line-height:1.8;
 border-top:1px solid rgba(246,243,234,.08);margin-left:24px;margin-right:24px;padding-left:0;padding-right:0}

/* ---------- surface de travail ---------- */
/* Le contenu prend la largeur disponible jusqu'\xE0 une limite lisible. Au-del\xE0,
   la marge restante se partage des deux c\xF4t\xE9s : un vide centr\xE9 se lit comme
   une respiration, le m\xEAme vide enti\xE8rement \xE0 droite se lit comme un d\xE9faut. */
.vue{flex:1;min-width:0;padding:38px 46px 90px;display:flex;flex-direction:column;gap:34px;
 width:100%;max-width:2280px;margin:0 auto}
.tete{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;
 padding-bottom:20px;border-bottom:1px solid var(--trait)}
.tete .titres{display:flex;flex-direction:column;gap:5px;min-width:0}
h1{margin:0;font-size:30px;font-weight:700;letter-spacing:-.035em;line-height:1.1}
.sous{font-size:14px;color:var(--gris);line-height:1.45;max-width:62ch}
.maj{font-family:var(--mono);font-size:10.5px;letter-spacing:.03em;color:var(--gris)}
.titre-campagne{font-size:20px;font-weight:600;letter-spacing:-.025em;line-height:1.3;margin:-2px 0 4px}
section{display:flex;flex-direction:column;gap:13px}
/* \xC9tiquette de section : capitales fines prolong\xE9es d'un filet \u2014 le geste
   \xE9ditorial de la facture, transpos\xE9 \xE0 l'\xE9cran. */
h2{margin:0;font-family:var(--mono);font-size:10px;font-weight:500;letter-spacing:.19em;
 text-transform:uppercase;color:var(--gris);display:flex;align-items:center;gap:14px}
h2::after{content:"";flex:1;height:1px;background:var(--trait)}

/* ---------- indicateurs ---------- */
/* Cartes et tableaux se terminent sur la m\xEAme verticale : deux bords droits
   diff\xE9rents dans la m\xEAme page se lisent comme un d\xE9faut d'alignement. */
.grille{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
.carte{background:var(--surface);border:1px solid var(--trait);border-radius:var(--r);
 padding:18px 20px 20px;display:flex;flex-direction:column;gap:5px}
.carte .k{font-family:var(--mono);font-size:9.5px;font-weight:500;letter-spacing:.15em;
 text-transform:uppercase;color:var(--gris);display:flex;align-items:center;gap:7px}
/* L'\xE9tat passe par une pastille discr\xE8te, pas par une bordure color\xE9e :
   la couleur reste un signal, elle ne d\xE9core pas. */
.carte .k::before{content:"";width:5px;height:5px;border-radius:50%;flex-shrink:0;
 background:var(--trait-fort)}
.carte.bon .k::before{background:var(--vert)}
.carte.moyen .k::before{background:var(--jaune)}
.carte.mauvais .k::before{background:var(--rouge)}
.carte .v{font-weight:700;font-size:31px;letter-spacing:-.045em;line-height:1.12;
 font-variant-numeric:tabular-nums;margin-top:2px}
.carte .v.txt{font-size:17px;font-weight:600;letter-spacing:-.02em;line-height:1.35}
.carte .s{font-size:12.5px;color:var(--gris);line-height:1.45}
.carte .err{margin-top:6px;font-family:var(--mono);font-size:10.5px;line-height:1.5;
 color:var(--rouge);word-break:break-word}

/* ---------- tableaux ---------- */
.tw{overflow-x:auto;border:1px solid var(--trait);border-radius:var(--r);background:var(--surface)}
.tw.haut{max-height:min(72vh,780px);overflow-y:auto}
table{width:100%;min-width:660px;border-collapse:collapse;font-size:13.5px}
th,td{text-align:left;padding:13px 16px;border-bottom:1px solid var(--trait);vertical-align:top}
/* L'en-t\xEAte reste visible quand on descend dans une longue liste :
   sans lui, on ne sait plus quelle colonne on lit. */
thead th{position:sticky;top:0;z-index:1;background:var(--surface2);
 font-family:var(--mono);font-size:9.5px;font-weight:500;
 letter-spacing:.14em;text-transform:uppercase;color:var(--gris);white-space:nowrap;
 padding-top:11px;padding-bottom:11px;box-shadow:inset 0 -1px 0 var(--trait)}
tbody tr:last-child td{border-bottom:0}
tbody tr{transition:background .1s}
tbody tr:hover{background:var(--surface2)}
td.nowrap,th.nowrap{white-space:nowrap}
td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
th.num{text-align:right}
.vide{padding:38px 22px;color:var(--gris);font-size:13.5px;text-align:center;line-height:1.6}
.vide::before{content:"";display:block;width:26px;height:26px;margin:0 auto 12px;border-radius:50%;
 border:1.5px dashed var(--trait-fort)}
.carte{transition:border-color .14s,box-shadow .14s}
.carte:hover{border-color:var(--trait-fort);box-shadow:var(--ombre)}
::selection{background:var(--jaune);color:#0C0B09}
/* Barres de d\xE9filement discr\xE8tes, dans la palette de l'application. */
.menu .nav::-webkit-scrollbar,.volet::-webkit-scrollbar,.tw::-webkit-scrollbar{height:9px;width:9px}
.menu .nav::-webkit-scrollbar-thumb,.volet::-webkit-scrollbar-thumb,
.tw::-webkit-scrollbar-thumb{background:var(--trait-fort);border-radius:9px}
.tw::-webkit-scrollbar-track{background:var(--surface2)}
.volet,.tw{scrollbar-width:thin}
.sec{font-family:var(--mono);font-size:11px;letter-spacing:.01em;color:var(--gris)}
.chercher{display:flex;align-items:center;gap:13px}
.chercher input{font:inherit;font-size:13px;padding:9px 13px;border:1px solid var(--trait);
 border-radius:8px;background:var(--surface);color:var(--encre);width:290px;max-width:100%}
.chercher input::placeholder{color:var(--gris)}
.chercher .compte{font-family:var(--mono);font-size:10px;letter-spacing:.08em;
 text-transform:uppercase;color:var(--gris)}

/* ---------- \xE9tats ---------- */
.p{display:inline-flex;align-items:center;gap:5px;padding:3px 8px 3px 7px;border-radius:5px;
 font-family:var(--mono);font-size:10px;font-weight:500;letter-spacing:.06em;
 text-transform:uppercase;white-space:nowrap}
.p::before{content:"";width:4px;height:4px;border-radius:50%;background:currentColor;flex-shrink:0}
.p-vert{background:var(--vertf);color:var(--vert)}
.p-jaune{background:var(--jaune-p);color:var(--jaune-f)}
.p-rouge{background:var(--rougef);color:var(--rouge)}
.p-gris{background:var(--surface2);color:var(--gris)}

/* ---------- boutons ---------- */
.bouton{display:inline-flex;align-items:center;gap:7px;background:var(--jaune);color:#0C0B09;
 font-family:inherit;font-weight:600;font-size:12px;letter-spacing:-.005em;
 padding:7px 13px;border-radius:7px;text-decoration:none;white-space:nowrap;border:1px solid transparent;
 transition:filter .12s,background .12s}
.bouton:hover{filter:brightness(.94)}
.bouton.gros{font-size:13.5px;padding:11px 20px;border-radius:8px;font-weight:600}
.bouton.pale{background:var(--surface);color:var(--encre);border-color:var(--trait-fort)}
.bouton.pale:hover{background:var(--surface2);filter:none}

/* ---------- encarts ---------- */
.note,.alerte,.reussite{padding:14px 17px;border-radius:var(--r);font-size:13.5px;line-height:1.6;
 border:1px solid var(--trait)}
.note{background:var(--jaunef);border-color:transparent;
 box-shadow:inset 3px 0 0 var(--jaune)}
.alerte{background:var(--rougef);border-color:transparent;
 box-shadow:inset 3px 0 0 var(--rouge);color:var(--encre)}
.reussite{background:var(--vertf);border-color:transparent;
 box-shadow:inset 3px 0 0 var(--vert);color:var(--encre)}

/* ---------- formulaires ---------- */
form.f{background:var(--surface);border:1px solid var(--trait);border-radius:var(--r);
 padding:26px;display:grid;grid-template-columns:1fr 1fr;gap:19px;box-shadow:var(--ombre)}
form.f .large{grid-column:1/-1}
form.f label{display:flex;flex-direction:column;gap:7px;font-family:var(--mono);font-size:9.5px;
 font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--gris)}
form.f input,form.f select,form.f textarea{font-family:var(--sans);font-size:14.5px;
 font-weight:450;letter-spacing:-.005em;padding:11px 13px;text-transform:none;
 border:1px solid var(--trait-fort);border-radius:8px;background:var(--fond);
 color:var(--encre);width:100%;transition:border-color .12s,background .12s}
form.f input:focus,form.f select:focus,form.f textarea:focus{background:var(--surface);
 border-color:var(--encre);outline:none}
form.f input::placeholder,form.f textarea::placeholder{color:var(--gris);font-weight:400}
form.f textarea{min-height:180px;resize:vertical;line-height:1.65}
.calcul{display:flex;flex-direction:column;justify-content:center;gap:3px;
 padding:11px 15px;border-radius:8px;background:var(--surface2);
 border:1px dashed var(--trait-fort);font-size:13.5px;line-height:1.4;min-height:44px}
.calcul span{font-family:var(--mono);font-size:11px;color:var(--gris)}
.calcul.ok{background:var(--vertf);border-color:transparent;border-style:solid}
.calcul.tard{background:var(--rougef);border-color:transparent;border-style:solid}
form.f .envoyer,button.envoyer{background:var(--jaune);color:#0C0B09;border:0;font-family:inherit;
 font-weight:600;font-size:14px;letter-spacing:-.01em;text-transform:none;
 padding:13px 24px;border-radius:8px;cursor:pointer;justify-self:start;transition:filter .12s;
 display:inline-flex;align-items:center;gap:8px;line-height:1.2}
form.f .envoyer:hover,button.envoyer:hover{filter:brightness(.94)}
button.envoyer.discret{background:var(--surface);color:var(--encre);
 border:1px solid var(--trait-fort);font-size:12.5px;padding:9px 16px}
button.envoyer.discret:hover{background:var(--surface2);filter:none}

/* ---------- replis ---------- */
details>summary{cursor:pointer;font-weight:600;font-size:14px;letter-spacing:-.015em;
 padding:14px 17px;background:var(--surface);border:1px solid var(--trait);
 border-radius:var(--r);list-style:none;display:flex;align-items:center;gap:9px}
details>summary::-webkit-details-marker{display:none}
details>summary::before{content:"";width:7px;height:7px;border-right:1.6px solid var(--gris);
 border-bottom:1.6px solid var(--gris);transform:rotate(-45deg);margin-left:2px;
 transition:transform .15s}
details[open]>summary::before{transform:rotate(45deg)}
details[open]>summary{border-radius:var(--r) var(--r) 0 0;border-bottom:0}
details>.dedans{border:1px solid var(--trait);border-top:0;border-radius:0 0 var(--r) var(--r);
 padding:22px 20px;display:flex;flex-direction:column;gap:26px;background:var(--surface)}

/* ---------- t\xE2ches : liste \xE0 gauche, t\xE2che ouverte \xE0 droite ---------- */
/* Le volet profite de la largeur disponible sans jamais \xE9craser la liste. */
.travail{display:grid;grid-template-columns:minmax(0,1fr) clamp(400px,27vw,560px);
 gap:24px;align-items:start}
.colonne{display:flex;flex-direction:column;gap:26px;min-width:0}
/* La colonne est plus \xE9troite quand le volet est ouvert : sans ce r\xE9glage,
   la quatri\xE8me carte tombe seule sur une deuxi\xE8me ligne. */
.colonne .grille{grid-template-columns:repeat(auto-fit,minmax(172px,1fr));gap:10px}
/* Le volet reste \xE0 l'\xE9cran pendant qu'on fait d\xE9filer la liste. */
.volet{position:sticky;top:22px;max-height:calc(100vh - 44px);overflow-y:auto;
 background:var(--surface);border:1px solid var(--trait);border-radius:var(--r);
 box-shadow:var(--ombre);padding:20px;display:flex;flex-direction:column;gap:22px}
.volet-tete{display:flex;align-items:center;justify-content:space-between;gap:12px;
 padding-bottom:14px;border-bottom:1px solid var(--trait)}
.fermer{width:28px;height:28px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
 border-radius:7px;text-decoration:none;font-size:19px;line-height:1;color:var(--gris);
 border:1px solid var(--trait)}
.fermer:hover{background:var(--surface2);color:var(--encre)}
/* Dans une colonne de 430 px, un formulaire sur deux colonnes serait illisible. */
.volet form.f{grid-template-columns:1fr;padding:0;border:0;background:none;box-shadow:none;gap:15px}
.volet .grille{grid-template-columns:1fr 1fr;gap:9px}
.volet .carte{padding:13px 14px}
.volet .carte .v{font-size:21px}
.volet .titre-campagne{font-size:17px}
.volet section{gap:11px}
@media(max-width:1240px){
  .travail{grid-template-columns:1fr}
  .volet{position:static;max-height:none;order:-1}
}

/* ---------- t\xE2ches ---------- */
.taches{border:1px solid var(--trait);border-radius:var(--r);background:var(--surface);overflow:hidden}
dialog.fenetre{border:0;padding:0;border-radius:14px;background:var(--surface);color:var(--encre);
 width:min(880px,94vw);max-height:88vh;box-shadow:0 24px 80px -20px rgba(0,0,0,.45)}
dialog.fenetre::backdrop{background:rgba(12,11,9,.55);backdrop-filter:blur(2px)}
.fenetre-tete{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;
 padding:20px 22px 16px;border-bottom:1px solid var(--trait);position:sticky;top:0;
 background:var(--surface);border-radius:14px 14px 0 0;z-index:2}
.fenetre-tete .k{font-family:var(--mono);font-size:9.5px;letter-spacing:.15em;
 text-transform:uppercase;color:var(--gris);margin-bottom:5px}
.fenetre-tete b{font-size:17px;font-weight:600;letter-spacing:-.02em;line-height:1.35}
.fenetre-tete .fermer{background:none;cursor:pointer;font-family:inherit;border:1px solid var(--trait)}
.fenetre-corps{padding:20px 22px 26px;overflow-y:auto;max-height:calc(88vh - 86px)}
.fenetre-corps h2{margin-bottom:11px}
@media(max-width:600px){dialog.fenetre{width:100vw;max-width:100vw;max-height:100vh;border-radius:0}
 .fenetre-tete{border-radius:0}.fenetre-corps{max-height:calc(100vh - 86px)}}
.tache{display:flex;align-items:flex-start;gap:14px;padding:14px 16px;
 border-bottom:1px solid var(--trait)}
.tache:last-child{border-bottom:0}
.tache:hover{background:var(--surface2)}
.tache form{display:flex;margin:0}
/* La coche est la cible la plus cliqu\xE9e de la page : elle est large,
   ronde, et se remplit franchement une fois la t\xE2che faite. */
.coche{width:21px;height:21px;margin-top:1px;border:1.8px solid var(--trait-fort);
 border-radius:50%;background:none;cursor:pointer;flex-shrink:0;padding:0;
 transition:border-color .12s,background .12s}
.coche:hover{border-color:var(--encre)}
.coche.on{background:var(--vert);border-color:var(--vert);
 background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6L9 17l-5-5'/%3E%3C/svg%3E");
 background-size:13px;background-position:center;background-repeat:no-repeat}
.tache .corps{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.tache .t{font-size:14.5px;font-weight:500;letter-spacing:-.01em;line-height:1.4;
 text-decoration:none;display:inline-block}
.tache .t:hover{text-decoration:underline;text-underline-offset:3px}
.tache .d{font-size:13px;color:var(--doux);line-height:1.5;white-space:pre-wrap}
.tache .meta{display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:3px;
 font-family:var(--mono);font-size:10.5px;letter-spacing:.02em;color:var(--gris)}
.tache .meta .retard{color:var(--rouge);font-weight:500}
.tache .meta .bientot{color:var(--jaune-f);font-weight:500}
.tache .prio{padding:1px 7px;border-radius:4px;text-transform:uppercase;font-weight:500;font-size:9.5px}
.tache .prio.haute{background:var(--rougef);color:var(--rouge)}
.tache .prio.basse{background:var(--surface2);color:var(--gris)}
.tache .prio.encours{background:var(--jaune-p);color:var(--jaune-f)}
.tache .outils{display:flex;gap:7px;flex-shrink:0;align-items:center}
.tache .outils .bouton{font-size:11px;padding:5px 10px}
/* La t\xE2che ouverte se rep\xE8re d'un coup d'\u0153il dans la liste. */
.tache.sel{background:var(--jaune-p);box-shadow:inset 3px 0 0 var(--jaune)}
.tache.sel:hover{background:var(--jaune-p)}
.tache.ok{opacity:.55}
.tache.ok .t{text-decoration:line-through}
/* L'ajout rapide tient sur une ligne : la friction doit \xEAtre minimale. */
form.f.rapide{grid-template-columns:2.4fr 1fr 1fr 1.4fr auto;align-items:end;gap:14px;padding:20px}
form.f.rapide .large{grid-column:auto}
form.f.rapide .envoyer{padding:11px 22px}
@media(max-width:1100px){form.f.rapide{grid-template-columns:1fr 1fr}
  form.f.rapide .large{grid-column:1/-1}}

.apercu{border:1px solid var(--trait);border-radius:var(--r);overflow:hidden;background:#fff;
 box-shadow:var(--ombre)}
.apercu iframe{width:100%;height:900px;border:0;display:block;background:#fff}
.actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}

@media(min-width:1600px){.vue{padding:46px 60px 110px;gap:40px}h1{font-size:33px}}
@media(max-width:980px){.vue{padding:30px 26px 80px}}
@media(max-width:820px){
  .app{flex-direction:column}
  .menu{width:100%;height:auto;position:static;padding:18px 0 0}
  .marque{padding:0 18px 14px}
  .nav{flex-direction:row;overflow-x:auto;padding:0 12px 12px;gap:5px;
    scrollbar-width:none;-ms-overflow-style:none}
  .nav::-webkit-scrollbar{display:none}
  .nav a{white-space:nowrap;padding:9px 13px;font-size:13px}
  .nav .grp{display:none}
  .pied{display:none}
  .vue{padding:24px 17px 70px;gap:28px}
  h1{font-size:24px}
  .tete{padding-bottom:16px}
  form.f,form.f.rapide{grid-template-columns:1fr;padding:20px}
  .tache{flex-wrap:wrap}
  .tache .outils{width:100%;padding-left:35px}
  .grille{grid-template-columns:1fr}
  .carte .v{font-size:27px}
  .chercher input{width:100%}
  th,td{padding:12px 13px}
}`;
var FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23FFDC3F'/%3E%3Ctext x='16' y='23' text-anchor='middle' font-family='Helvetica,Arial' font-size='19' font-weight='bold' fill='%231B1B1B'%3EA%3C/text%3E%3C/svg%3E";
var SCRIPT = `
// Recherche dans un tableau, sur les lignes d\xE9j\xE0 affich\xE9es.
function filtrer(champ, id){
  var q = champ.value.trim().toLowerCase(), t = document.getElementById(id);
  if(!t) return;
  var n = 0;
  Array.prototype.forEach.call(t.querySelectorAll('tbody tr'), function(tr){
    var ok = !q || tr.textContent.toLowerCase().indexOf(q) !== -1;
    tr.hidden = !ok; if(ok) n++;
  });
  var c = document.getElementById(id + '-compte');
  if(c) c.textContent = n + (n > 1 ? ' lignes' : ' ligne');
}
// Rafra\xEEchissement automatique \u2014 suspendu d\xE8s que quelque chose est saisi,
// pour ne jamais effacer un texte en cours d'\xE9criture.
(function(){
  if(document.body.dataset.auto !== '1') return;
  var saisie = false;
  document.addEventListener('input', function(){ saisie = true; }, true);
  setInterval(function(){ if(!saisie) location.reload(); }, 120000);
})();`;
var navHtml = /* @__PURE__ */ __name22((env, active) => {
  const cle = encodeURIComponent(env.CLE_TEST);
  const courant = PAGES.find((p) => p.id === active);
  const surligne = courant?.parent || active;
  return GROUPES.map((g) => `<div class="grp">${echapper(g)}</div>${PAGES.filter((p) => p.groupe === g).map((p) => `<a class="${p.id === surligne ? "on" : ""}" href="?cle=${cle}&page=${p.id}"
        ${p.id === surligne ? 'aria-current="page"' : ""}>
        ${icone(p.id)}<span>${p.nom}</span></a>`).join("")}`).join("");
}, "navHtml");
var page = /* @__PURE__ */ __name22((env, active, titre, contenu) => `<!doctype html><html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="light dark">
<meta name="referrer" content="no-referrer">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;450;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<title>AdamEcom \xB7 ${echapper(titre)}</title>
<style>${STYLE}</style></head><body data-auto="${AUTO.has(active) ? "1" : "0"}"><div class="app">
<aside class="menu">
  <a class="marque" href="?cle=${encodeURIComponent(env.CLE_TEST)}&page=apercu">
    <div class="t">A</div><b>AdamEcom</b></a>
  <nav class="nav">${navHtml(env, active)}</nav>
  <div class="pied">${echapper(env.SHOPIFY_STORE.split(".")[0])}<br>Cloudflare Workers
    <br><a href="/connexion?cle=${encodeURIComponent(env.CLE_TEST)}" style="color:inherit;text-decoration:underline">Acc\xE8s et mot de passe</a>
    <br><a href="/deconnexion" style="color:inherit;text-decoration:underline">Se d\xE9connecter</a></div>
</aside>
<main class="vue">
  <div class="tete">
    <div class="titres"><h1>${echapper(titre)}</h1>
      ${PAGES.find((p) => p.id === active)?.sous ? `<p class="sous">${echapper(PAGES.find((p) => p.id === active).sous)}</p>` : ""}</div>
    <span class="maj">actualis\xE9 ${dateFr2((/* @__PURE__ */ new Date()).toISOString())}${AUTO.has(active) ? " \xB7 rafra\xEEchi tout seul" : ""}</span></div>
  ${contenu}
</main></div>
<script>${SCRIPT}<\/script>
</body></html>`, "page");
var tableauHtml = /* @__PURE__ */ __name22((entetes, lignes, vide, id) => `${id && lignes.length > 8 ? `<div class="chercher">
      <input type="search" placeholder="Rechercher\u2026" oninput="filtrer(this,'${id}')"
        aria-label="Rechercher dans le tableau">
      <span class="compte" id="${id}-compte">${lignes.length} ligne${lignes.length > 1 ? "s" : ""}</span>
    </div>` : ""}
  <div class="tw${lignes.length > 14 ? " haut" : ""}"${id ? ` id="${id}"` : ""}>${lignes.length ? `<table><thead><tr>${entetes.map((h) => `<th class="${h.classe || ""}">${echapper(h.nom)}</th>`).join("")}</tr></thead>
       <tbody>${lignes.join("")}</tbody></table>` : `<div class="vide">${echapper(vide)}</div>`}</div>`, "tableauHtml");
var REQ_CLIENTS = `query {
  customers(first: 50, sortKey: CREATED_AT, reverse: true) {
    nodes {
      id displayName firstName lastName email phone note createdAt numberOfOrders
      amountSpent { amount currencyCode }
      emailMarketingConsent { marketingState }
      smsMarketingConsent { marketingState }
      tags
    }
  }
}`;
var REQ_CLIENT = `query ($id: ID!) {
  customer(id: $id) {
    id displayName firstName lastName email phone note tags
    emailMarketingConsent { marketingState }
  }
}`;
var CREER_CLIENT = `mutation ($input: CustomerInput!) {
  customerCreate(input: $input) {
    customer { id displayName email phone }
    userErrors { field message }
  }
}`;
var MODIFIER_CLIENT = `mutation ($input: CustomerInput!) {
  customerUpdate(input: $input) {
    customer { id displayName email phone }
    userErrors { field message }
  }
}`;
async function enregistrerClient(env, form) {
  const id = String(form.get("customer_id") || "").trim();
  const prenom = String(form.get("prenom") || "").trim();
  const nom = String(form.get("nom") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const telephone = String(form.get("telephone") || "").trim();
  const note2 = String(form.get("note") || "").trim();
  const tags = String(form.get("tags") || "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 30);
  const abonnement = form.get("abonner_email") === "1";
  if (!prenom && !nom) return { erreur: "Indiquez au moins le pr\xE9nom ou le nom du client." };
  if (!email.includes("@")) return { erreur: "Indiquez une adresse email valide." };
  if (id && !/^gid:\/\/shopify\/Customer\/\d+$/.test(id)) return { erreur: "Identifiant client Shopify invalide." };
  const input = {
    ...id ? { id } : {},
    firstName: prenom || null,
    lastName: nom || null,
    email,
    ...telephone ? { phone: telephone } : {},
    note: note2 || null,
    tags
  };
  try {
    const jeton = await jetonShopify(env);
    const d = await shopify(env, jeton, id ? MODIFIER_CLIENT : CREER_CLIENT, { input });
    const resultat = id ? d.customerUpdate : d.customerCreate;
    if (resultat.userErrors?.length) return { erreur: resultat.userErrors.map((e) => e.message).join(" \xB7 ") };
    const client = resultat.customer;
    let brevoOk = false;
    if (abonnement) {
      const maintenant = (/* @__PURE__ */ new Date()).toISOString();
      const consent = await shopify(env, jeton, MAJ_CONSENTEMENT, {
        input: {
          customerId: client.id,
          emailMarketingConsent: {
            marketingState: "SUBSCRIBED",
            marketingOptInLevel: "SINGLE_OPT_IN",
            consentUpdatedAt: maintenant
          }
        }
      });
      const erreursConsentement = consent.customerEmailMarketingConsentUpdate.userErrors || [];
      if (erreursConsentement.length) return { erreur: erreursConsentement.map((e) => e.message).join(" \xB7 ") };
      const liste = await listeDestinataires(env);
      await brevo(env, "/contacts", {
        method: "POST",
        body: JSON.stringify({
          email,
          attributes: { FIRSTNAME: prenom, LASTNAME: nom },
          listIds: [liste.id],
          updateEnabled: true
        })
      });
      brevoOk = true;
    }
    return { ok: true, id: client.id, nom: client.displayName || email, brevo: brevoOk };
  } catch (e) {
    return { erreur: e.message };
  }
}
__name(enregistrerClient, "enregistrerClient");
__name2(enregistrerClient, "enregistrerClient");
__name22(enregistrerClient, "enregistrerClient");
var REQ_FACTURATION = `query {
  draftOrders(first: 30, reverse: true) {
    nodes {
      id name status createdAt
      totalPriceSet { shopMoney { amount } }
      customer { displayName email }
      tags
    }
  }
  orders(first: 30, reverse: true) {
    nodes {
      id name createdAt displayFinancialStatus
      totalPriceSet { shopMoney { amount } }
      customer { displayName email }
    }
  }
}`;
async function depuisShopify(env, requete) {
  try {
    const jeton = await jetonShopify(env);
    return { donnees: await shopify(env, jeton, requete, {}), erreur: null };
  } catch (e) {
    return { donnees: null, erreur: e.message };
  }
}
__name(depuisShopify, "depuisShopify");
__name2(depuisShopify, "depuisShopify");
__name22(depuisShopify, "depuisShopify");
async function pageApercu(env) {
  const db = env.DB;
  await assurerBlogSchema(db);
  const j7 = new Date(Date.now() - 7 * 864e5).toISOString();
  const [
    [cal],
    [newsletter],
    [seo],
    [{ n: resa = 0 } = {}],
    [{ n: camp = 0 } = {}],
    [{ n: inc = 0 } = {}],
    attente,
    recentes,
    taches
  ] = await Promise.all([
    tous2(db, "SELECT quand,statut,message,duree_ms FROM executions WHERE domaine='calendly' ORDER BY quand DESC LIMIT 1"),
    // L'automatisation s'enregistre sous « newsletter ». Chercher « blog »
    // ne renvoyait jamais rien : la carte annonçait « aucune exécution »
    // alors que l'envoi tournait. On accepte les deux noms, pour que les
    // lignes déjà écrites restent visibles.
    tous2(db, "SELECT quand,statut,message,duree_ms FROM executions WHERE domaine IN ('blog','newsletter') ORDER BY quand DESC LIMIT 1"),
    tous2(db, "SELECT id,titre,statut,maj_le,message FROM blog_dossiers ORDER BY maj_le DESC LIMIT 1"),
    tous2(db, "SELECT COUNT(*) AS n FROM reservations WHERE cree_le>=?", j7),
    tous2(db, "SELECT COUNT(*) AS n FROM campagnes WHERE envoyee_le>=?", j7),
    tous2(db, "SELECT COUNT(*) AS n FROM incidents WHERE quand>=?", j7),
    tous2(db, "SELECT COUNT(*) AS n FROM file_emails"),
    tous2(db, "SELECT nom,email,debut,commande,commande_id,email_qualif FROM reservations ORDER BY cree_le DESC LIMIT 6"),
    resumeTaches(db)
  ]);
  const sante = /* @__PURE__ */ __name22((nom, s, cadence) => {
    const ok = s?.statut === "ok";
    const muet = s && Date.now() - new Date(s.quand).getTime() > cadence * 3;
    return `<div class="carte ${!s || !ok ? "mauvais" : muet ? "moyen" : "bon"}">
      <div class="k">${echapper(nom)}</div>
      <div class="v txt">${!s ? "aucune ex\xE9cution" : !ok ? "en erreur" : muet ? "silencieuse" : "op\xE9rationnelle"}</div>
      <div class="s">${s ? `${depuis(s.quand)} \xB7 ${s.duree_ms ?? "?"} ms` : "\u2014"}</div>
      ${s?.message ? `<div class="err">${echapper(s.message).slice(0, 150)}</div>` : ""}</div>`;
  }, "sante");
  const cle = encodeURIComponent(env.CLE_TEST);
  return `
  <section><h2>Que voulez-vous faire ?</h2><div class="actions">
    <a class="bouton gros" href="?cle=${cle}&page=facture">${ic("plus")} Nouvelle facture</a>
    <a class="bouton gros pale" href="?cle=${cle}&page=meeting">${ic("video")} Rendez-vous</a>
    <a class="bouton gros pale" href="?cle=${cle}&page=analytics">${ic("courbe")} Mes chiffres</a>
    <a class="bouton gros pale" href="?cle=${cle}&page=blog">${icone("blog", 15)} Blog SEO</a>
  </div></section>

  <section><h2>Mes t\xE2ches</h2><div class="grille">
    ${carteHtml(
    "En retard",
    String(taches.retard),
    "\xE9ch\xE9ance d\xE9pass\xE9e",
    taches.retard ? "mauvais" : "neutre"
  )}
    ${carteHtml(
    "\xC0 faire aujourd'hui",
    String(taches.jour),
    "",
    taches.jour ? "moyen" : "neutre"
  )}
    ${carteHtml("Ouvertes", String(taches.ouvertes), "toutes \xE9ch\xE9ances confondues")}
  </div>
  <div class="actions"><a class="bouton pale" href="?cle=${cle}&page=taches">Ouvrir mes t\xE2ches \u2192</a></div>
  </section>

  <section><h2>\xC9tat des automatisations</h2><div class="grille">
    ${sante("R\xE9servations Calendly", cal, 6e4)}
    ${sante("Newsletter du blog", newsletter, 9e5)}
    <div class="carte ${!seo ? "moyen" : seo.statut === "erreur" ? "mauvais" : seo.statut === "publie" ? "bon" : "moyen"}">
      <div class="k">Blog SEO quotidien</div>
      <div class="v txt">${!seo ? "configuration active" : seo.statut === "pret_validation" ? "\xE0 valider dans l\u2019application" : seo.statut === "publie" ? "publi\xE9" : echapper(seo.statut)}</div>
      <div class="s">${seo ? `${echapper(seo.id)} \xB7 ${depuis(seo.maj_le)}` : "g\xE9n\xE9ration quotidienne"}</div>
      ${seo?.message ? `<div class="err">${echapper(seo.message).slice(0, 150)}</div>` : ""}</div>
  </div></section>
  <section><h2>Sept derniers jours</h2><div class="grille">
    <div class="carte neutre"><div class="k">R\xE9servations</div><div class="v">${resa}</div></div>
    <div class="carte neutre"><div class="k">Campagnes</div><div class="v">${camp}</div></div>
    <div class="carte neutre"><div class="k">Emails en attente</div><div class="v">${attente[0]?.n ?? 0}</div></div>
    <div class="carte ${inc ? "mauvais" : "neutre"}"><div class="k">Incidents</div><div class="v">${inc}</div></div>
  </div></section>
  <section><h2>Derni\xE8res r\xE9servations</h2>
  ${tableauHtml(
    [{ nom: "Prospect" }, { nom: "Rendez-vous", classe: "nowrap" }, { nom: "Commande" }, { nom: "Email qualif." }],
    recentes.map((r) => `<tr>
      <td><b>${echapper(r.nom || "\u2014")}</b><br><span class="sec">${echapper(r.email || "")}</span></td>
      <td class="nowrap">${dateFr2(r.debut)}</td>
      <td class="nowrap">${r.commande_id ? `<a href="https://admin.shopify.com/store/${env.SHOPIFY_STORE.split(".")[0]}/draft_orders/${echapper(r.commande_id)}" target="_blank" rel="noopener">${echapper(r.commande)}</a>` : "\u2014"}</td>
      <td>${pastille(r.email_qualif)}</td></tr>`),
    "Aucune r\xE9servation depuis la mise en service du journal."
  )}</section>`;
}
__name(pageApercu, "pageApercu");
__name2(pageApercu, "pageApercu");
__name22(pageApercu, "pageApercu");
var PROMPT_IMAGE_BLOG = `Cr\xE9e une image de couverture de blog simple, moderne et minimaliste, dans un style abstrait et premium, inspir\xE9 d\u2019un visuel \xE9ditorial propre et visuellement fort.

Le visuel doit \xEAtre :
- tr\xE8s simple
- sans texte
- sans logo
- sans interface complexe
- sans surcharge
- \xE9l\xE9gant, abstrait et professionnel
- adapt\xE9 \xE0 une image de couverture de blog

Sujet du blog :
[TITRE OU SUJET DU BLOG]

Interpr\xE8te ce sujet de mani\xE8re visuelle, conceptuelle et minimaliste, avec 1 \xE0 3 \xE9l\xE9ments graphiques maximum qui symbolisent clairement le th\xE8me de l\u2019article.

Style visuel souhait\xE9 :
- composition \xE9pur\xE9e
- rendu abstrait ou semi-abstrait
- formes simples
- \xE9l\xE9ments flottants ou symboliques
- effet doux, l\xE9g\xE8rement flou ou translucide
- lumi\xE8re subtile
- ambiance premium
- look moderne et \xE9ditorial
- sensation de clart\xE9, de performance et de sophistication

Direction artistique :
- image tr\xE8s a\xE9r\xE9e
- fond en d\xE9grad\xE9 lumineux ou fond propre et moderne
- design visuellement impactant mais tr\xE8s simple
- \xE9l\xE9ments graphiques \xE9l\xE9gants li\xE9s au sujet
- rendu coh\xE9rent avec une marque professionnelle orient\xE9e business, Shopify, CRO, e-commerce et performance

Important :
- ne pas ajouter de texte
- ne pas faire une affiche publicitaire
- ne pas surcharger l\u2019image
- garder un rendu simple, propre et premium
- l\u2019image doit \xE9voquer le sujet de l\u2019article de fa\xE7on symbolique et visuelle

Format :
- horizontal
- ratio 16:9`;
var LIEN_AFFILIATION_SHOPIFY = "https://shopify.pxf.io/xL9D43";
var LIEN_APPEL_QUALIFICATION = "https://adam-ecom.com/pages/reservez-votre-appel-gratuit";
var BLOCS_COMMERCIAUX_BLOG = `<hr>
<section data-adamecom-bloc="shopify-affiliation">
  <h2>Votre activit\xE9 commence avec Shopify</h2>
  <p>Commencez gratuitement, continuez pour 1 $US/mois. Et gagnez jusqu\u2019\xE0 10 000 $US en cr\xE9dits \xE0 mesure que vous vendez.</p>
  <p><a href="${LIEN_AFFILIATION_SHOPIFY}" target="_blank" rel="sponsored noopener">Profiter de l\u2019offre Shopify</a></p>
</section>
<hr>
<section data-adamecom-bloc="appel-qualification">
  <h2>Votre boutique a du trafic. Elle n\u2019a pas assez de ventes.</h2>
  <p>Identifions ensemble les freins qui limitent votre conversion et les actions prioritaires \xE0 mettre en place.</p>
  <p><a href="${LIEN_APPEL_QUALIFICATION}">R\xE9server mon appel de qualification</a></p>
</section>`;
function appliquerBlocsCommerciaux(html) {
  if (!html) return html;
  const nettoye = String(html).replace(/\s*<hr>\s*<section\s+data-adamecom-bloc="shopify-affiliation">[\s\S]*?<\/section>\s*<hr>\s*<section\s+data-adamecom-bloc="appel-qualification">[\s\S]*?<\/section>\s*$/i, "").trim();
  return `${nettoye}
${BLOCS_COMMERCIAUX_BLOG}`;
}
__name(appliquerBlocsCommerciaux, "appliquerBlocsCommerciaux");
__name2(appliquerBlocsCommerciaux, "appliquerBlocsCommerciaux");
__name22(appliquerBlocsCommerciaux, "appliquerBlocsCommerciaux");
async function assurerBlogSchema(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS blog_config (
    id INTEGER PRIMARY KEY CHECK (id=1),
    actif INTEGER NOT NULL DEFAULT 1,
    heure_generation TEXT NOT NULL,
    frequence_validation TEXT NOT NULL,
    canal_slack TEXT NOT NULL,
    canal_id TEXT NOT NULL,
    boutique TEXT NOT NULL,
    blog TEXT NOT NULL,
    handle_blog TEXT NOT NULL,
    auteur TEXT NOT NULL,
    validation_format TEXT NOT NULL,
    prompt_image TEXT NOT NULL,
    maj_le TEXT NOT NULL
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS blog_dossiers (
    id TEXT PRIMARY KEY,
    titre TEXT NOT NULL,
    handle TEXT,
    statut TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    slack_thread_ts TEXT,
    image_ok INTEGER NOT NULL DEFAULT 0,
    html_ok INTEGER NOT NULL DEFAULT 0,
    validation_texte TEXT,
    article_shopify_id TEXT,
    url_publique TEXT,
    message TEXT,
    seo_title TEXT,
    meta_description TEXT,
    resume TEXT,
    auteur TEXT,
    tags TEXT,
    alt_image TEXT,
    html TEXT,
    image_url TEXT,
    image_base64 TEXT,
    image_mime TEXT,
    image_nom TEXT,
    cree_le TEXT NOT NULL,
    maj_le TEXT NOT NULL
  )`).run();
  const colonnesBlog = new Set((await tous2(db, "PRAGMA table_info(blog_dossiers)")).map((c) => c.name));
  const ajoutsBlog = [
    ["seo_title", "TEXT"],
    ["meta_description", "TEXT"],
    ["resume", "TEXT"],
    ["auteur", "TEXT"],
    ["tags", "TEXT"],
    ["alt_image", "TEXT"],
    ["html", "TEXT"],
    ["image_url", "TEXT"],
    ["image_base64", "TEXT"],
    ["image_mime", "TEXT"],
    ["image_nom", "TEXT"]
  ];
  for (const [nom, type] of ajoutsBlog) {
    if (!colonnesBlog.has(nom)) await db.prepare(`ALTER TABLE blog_dossiers ADD COLUMN ${nom} ${type}`).run();
  }
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_blog_dossiers_maj ON blog_dossiers(maj_le DESC)").run();
  await db.prepare(`INSERT OR IGNORE INTO blog_config
    (id,actif,heure_generation,frequence_validation,canal_slack,canal_id,boutique,blog,handle_blog,auteur,validation_format,prompt_image,maj_le)
    VALUES (1,1,'08:00','5 minutes','Application AdamEcom','app','adam-ecom.com','Actualit\xE9s','actualites','Adam Ecom','BOUTON DE VALIDATION',?,?)`).bind(PROMPT_IMAGE_BLOG, (/* @__PURE__ */ new Date()).toISOString()).run();
  await db.prepare(`INSERT OR IGNORE INTO blog_dossiers
    (id,titre,handle,statut,revision,slack_thread_ts,image_ok,html_ok,validation_texte,article_shopify_id,url_publique,message,cree_le,maj_le)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    "ADAMSEO-20260831-01",
    "Vitesse Shopify : am\xE9liorer les Core Web Vitals sans sacrifier vos conversions",
    "vitesse-shopify-core-web-vitals",
    "pret_validation",
    1,
    "1788174561.039799",
    1,
    1,
    "VALID\xC9 ADAMSEO-20260831-01",
    null,
    null,
    "Dossier complet pr\xEAt. Publication bloqu\xE9e jusqu\u2019au clic de validation dans l\u2019application.",
    "2026-08-31T11:09:21.000Z",
    "2026-08-31T11:09:50.000Z"
  ).run();
  await db.prepare(`INSERT OR IGNORE INTO blog_dossiers
    (id,titre,handle,statut,revision,slack_thread_ts,image_ok,html_ok,validation_texte,article_shopify_id,url_publique,message,cree_le,maj_le)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    "ADAMSEO-20260830-02",
    "Checkout Shopify : 9 frictions qui font abandonner vos clients avant le paiement",
    "checkout-shopify-frictions-abandon-panier",
    "publie",
    1,
    "1788099892.708549",
    1,
    1,
    "VALID\xC9 ADAMSEO-20260830-02",
    "gid://shopify/Article/564596441134",
    "https://adam-ecom.com/blogs/actualites/checkout-shopify-frictions-abandon-panier",
    "Publi\xE9 et v\xE9rifi\xE9 sur Shopify.",
    "2026-08-30T14:24:52.000Z",
    "2026-08-30T14:24:52.000Z"
  ).run();
  const dossiersNonPublies = await tous2(db, "SELECT id,html FROM blog_dossiers WHERE html IS NOT NULL AND statut!='publie'");
  for (const dossier of dossiersNonPublies) {
    const htmlComplet = appliquerBlocsCommerciaux(dossier.html);
    if (htmlComplet !== dossier.html) {
      await db.prepare("UPDATE blog_dossiers SET html=? WHERE id=?").bind(htmlComplet, dossier.id).run();
    }
  }
}
__name(assurerBlogSchema, "assurerBlogSchema");
__name2(assurerBlogSchema, "assurerBlogSchema");
__name22(assurerBlogSchema, "assurerBlogSchema");
function reponseBlogJson(donnees, statut = 200) {
  return new Response(JSON.stringify(donnees), {
    status: statut,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
__name(reponseBlogJson, "reponseBlogJson");
__name2(reponseBlogJson, "reponseBlogJson");
__name22(reponseBlogJson, "reponseBlogJson");
async function apiBlog(env, request) {
  await assurerBlogSchema(env.DB);
  if (request.method === "GET") {
    const url = new URL(request.url);
    const idDemande = String(url.searchParams.get("id") || "").trim();
    if (idDemande) {
      if (!/^ADAMSEO-\d{8}-\d{2}$/.test(idDemande)) {
        return reponseBlogJson({ ok: false, erreur: "Identifiant de dossier invalide." }, 400);
      }
      const [dossier2] = await tous2(
        env.DB,
        "SELECT id,titre,handle,statut,revision,slack_thread_ts,image_ok,html_ok,validation_texte,article_shopify_id,url_publique,message,seo_title,meta_description,resume,auteur,tags,alt_image,html,image_url,image_base64,image_mime,image_nom,cree_le,maj_le FROM blog_dossiers WHERE id=?",
        idDemande
      );
      return dossier2 ? reponseBlogJson({ ok: true, dossier: dossier2 }) : reponseBlogJson({ ok: false, erreur: "Dossier introuvable." }, 404);
    }
    const dossiers = await tous2(
      env.DB,
      "SELECT id,titre,handle,statut,revision,slack_thread_ts,image_ok,html_ok,validation_texte,article_shopify_id,url_publique,message,seo_title,meta_description,resume,auteur,tags,alt_image,image_url,image_mime,image_nom,cree_le,maj_le FROM blog_dossiers ORDER BY maj_le DESC LIMIT 40"
    );
    return reponseBlogJson({ ok: true, dossiers });
  }
  if (request.method !== "POST") {
    return reponseBlogJson({ ok: false, erreur: "M\xE9thode non autoris\xE9e." }, 405);
  }
  let corps;
  try {
    corps = await request.json();
  } catch {
    return reponseBlogJson({ ok: false, erreur: "Corps JSON invalide." }, 400);
  }
  const id = String(corps?.id || "").trim();
  const titre = String(corps?.titre || "").trim();
  const statut = String(corps?.statut || "").trim();
  const statuts = ["preparation", "pret_validation", "valide", "publication", "publie", "erreur"];
  if (!/^ADAMSEO-\d{8}-\d{2}$/.test(id)) {
    return reponseBlogJson({ ok: false, erreur: "Identifiant de dossier invalide." }, 400);
  }
  if (!titre || titre.length > 240) {
    return reponseBlogJson({ ok: false, erreur: "Titre obligatoire ou trop long." }, 400);
  }
  if (!statuts.includes(statut)) {
    return reponseBlogJson({ ok: false, erreur: "Statut de dossier invalide." }, 400);
  }
  const texte = /* @__PURE__ */ __name22((valeur, maximum = 500) => {
    if (valeur === void 0 || valeur === null || valeur === "") return null;
    return String(valeur).trim().slice(0, maximum);
  }, "texteBlog");
  const htmlSource = typeof corps.html === "string" && corps.html.trim() ? corps.html.trim() : null;
  const html = appliquerBlocsCommerciaux(htmlSource);
  if (html && html.length > 5e5) {
    return reponseBlogJson({ ok: false, erreur: "Le contenu HTML d\xE9passe la taille autoris\xE9e." }, 400);
  }
  if (html && (/<style\b/i.test(html) || /\sstyle\s*=/i.test(html))) {
    return reponseBlogJson({ ok: false, erreur: "Le HTML du blog doit rester sans CSS." }, 400);
  }
  let imageBase64 = typeof corps.image_base64 === "string" ? corps.image_base64.trim() : null;
  let imageMime = texte(corps.image_mime, 40);
  const dataImage = imageBase64?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s);
  if (dataImage) {
    imageMime = dataImage[1];
    imageBase64 = dataImage[2];
  }
  if (imageBase64 && imageBase64.length > 12e6) {
    return reponseBlogJson({ ok: false, erreur: "L\u2019image d\xE9passe la taille autoris\xE9e." }, 400);
  }
  if (imageBase64 && !/^[A-Za-z0-9+/\r\n]+={0,2}$/.test(imageBase64)) {
    return reponseBlogJson({ ok: false, erreur: "Encodage de l\u2019image invalide." }, 400);
  }
  if (imageBase64 && !["image/png", "image/jpeg", "image/webp"].includes(imageMime || "")) {
    return reponseBlogJson({ ok: false, erreur: "Format d\u2019image non autoris\xE9." }, 400);
  }
  const maintenant = (/* @__PURE__ */ new Date()).toISOString();
  const revision = Math.max(1, Math.min(999, Number.parseInt(corps.revision, 10) || 1));
  const [existant] = await tous2(env.DB, "SELECT image_ok,html_ok FROM blog_dossiers WHERE id=?", id);
  const imageOk = corps.image_ok === void 0 ? Number(existant?.image_ok || 0) : corps.image_ok ? 1 : 0;
  const htmlOk = corps.html_ok === void 0 ? Number(existant?.html_ok || 0) : corps.html_ok ? 1 : 0;
  const creeLe = texte(corps.cree_le, 40) || maintenant;
  const majLe = texte(corps.maj_le, 40) || maintenant;
  await env.DB.prepare(`INSERT INTO blog_dossiers
    (id,titre,handle,statut,revision,slack_thread_ts,image_ok,html_ok,validation_texte,article_shopify_id,url_publique,message,
     seo_title,meta_description,resume,auteur,tags,alt_image,html,image_url,image_base64,image_mime,image_nom,cree_le,maj_le)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      titre=excluded.titre,
      handle=COALESCE(excluded.handle,blog_dossiers.handle),
      statut=excluded.statut,
      revision=excluded.revision,
      slack_thread_ts=COALESCE(excluded.slack_thread_ts,blog_dossiers.slack_thread_ts),
      image_ok=excluded.image_ok,
      html_ok=excluded.html_ok,
      validation_texte=excluded.validation_texte,
      article_shopify_id=COALESCE(excluded.article_shopify_id,blog_dossiers.article_shopify_id),
      url_publique=COALESCE(excluded.url_publique,blog_dossiers.url_publique),
      message=excluded.message,
      seo_title=COALESCE(excluded.seo_title,blog_dossiers.seo_title),
      meta_description=COALESCE(excluded.meta_description,blog_dossiers.meta_description),
      resume=COALESCE(excluded.resume,blog_dossiers.resume),
      auteur=COALESCE(excluded.auteur,blog_dossiers.auteur),
      tags=COALESCE(excluded.tags,blog_dossiers.tags),
      alt_image=COALESCE(excluded.alt_image,blog_dossiers.alt_image),
      html=COALESCE(excluded.html,blog_dossiers.html),
      image_url=COALESCE(excluded.image_url,blog_dossiers.image_url),
      image_base64=COALESCE(excluded.image_base64,blog_dossiers.image_base64),
      image_mime=COALESCE(excluded.image_mime,blog_dossiers.image_mime),
      image_nom=COALESCE(excluded.image_nom,blog_dossiers.image_nom),
      maj_le=excluded.maj_le`).bind(
    id,
    titre,
    texte(corps.handle, 180),
    statut,
    revision,
    texte(corps.slack_thread_ts, 40),
    imageOk,
    htmlOk,
    texte(corps.validation_texte, 80) || `VALID\xC9 ${id}`,
    texte(corps.article_shopify_id, 180),
    texte(corps.url_publique, 500),
    texte(corps.message, 1e3),
    texte(corps.seo_title, 180),
    texte(corps.meta_description, 400),
    texte(corps.resume, 2e3),
    texte(corps.auteur, 120) || "Adam Ecom",
    Array.isArray(corps.tags) ? corps.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 30).join(", ") : texte(corps.tags, 1e3),
    texte(corps.alt_image, 400),
    html,
    texte(corps.image_url, 1e3),
    imageBase64,
    imageMime,
    texte(corps.image_nom, 180),
    creeLe,
    majLe
  ).run();
  const [dossier] = await tous2(
    env.DB,
    "SELECT id,titre,handle,statut,revision,slack_thread_ts,image_ok,html_ok,validation_texte,article_shopify_id,url_publique,message,seo_title,meta_description,resume,auteur,tags,alt_image,image_url,image_mime,image_nom,cree_le,maj_le FROM blog_dossiers WHERE id=?",
    id
  );
  return reponseBlogJson({ ok: true, dossier });
}
__name(apiBlog, "apiBlog");
__name2(apiBlog, "apiBlog");
__name22(apiBlog, "apiBlog");
async function assurerGeminiSchema(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS gemini_recherches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sujet TEXT NOT NULL,
    modele TEXT NOT NULL,
    statut TEXT NOT NULL,
    resultat_json TEXT,
    erreur TEXT,
    cree_le TEXT NOT NULL,
    maj_le TEXT NOT NULL
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_gemini_recherches_maj ON gemini_recherches(maj_le DESC)").run();
}
__name(assurerGeminiSchema, "assurerGeminiSchema");
__name2(assurerGeminiSchema, "assurerGeminiSchema");
__name22(assurerGeminiSchema, "assurerGeminiSchema");
function texteInteractionGemini(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const etapes = Array.isArray(payload?.steps) ? payload.steps : [];
  for (const etape of etapes) {
    const contenus = Array.isArray(etape?.content) ? etape.content : [];
    for (const contenu of contenus) {
      if (contenu?.type === "text" && typeof contenu.text === "string") return contenu.text;
    }
  }
  return "";
}
__name(texteInteractionGemini, "texteInteractionGemini");
__name2(texteInteractionGemini, "texteInteractionGemini");
__name22(texteInteractionGemini, "texteInteractionGemini");
function erreurInteractionGemini(payload) {
  const racine = Array.isArray(payload) ? payload[0] : payload;
  return racine?.error?.message || racine?.message || "Gemini n'a pas renvoy\xE9 de r\xE9ponse exploitable.";
}
__name(erreurInteractionGemini, "erreurInteractionGemini");
__name2(erreurInteractionGemini, "erreurInteractionGemini");
__name22(erreurInteractionGemini, "erreurInteractionGemini");
async function lancerRechercheGemini(env, sujetBrut) {
  await assurerGeminiSchema(env.DB);
  const sujet = String(sujetBrut || "").trim().replace(/\s+/g, " ");
  if (!sujet || sujet.length < 5 || sujet.length > 240) {
    return { erreur: "Indiquez un sujet de recherche compris entre 5 et 240 caract\xE8res." };
  }
  if (!env.GEMINI_API_KEY) {
    return { erreur: "La connexion Gemini n'est pas configur\xE9e dans Cloudflare." };
  }
  const modele = "gemini-3.7-flash";
  const maintenant = (/* @__PURE__ */ new Date()).toISOString();
  const insertion = await env.DB.prepare(`INSERT INTO gemini_recherches
    (sujet,modele,statut,resultat_json,erreur,cree_le,maj_le)
    VALUES (?,?,'analyse',NULL,NULL,?,?)`).bind(sujet, modele, maintenant, maintenant).run();
  const id = Number(insertion.meta.last_row_id);
  const schema = {
    type: "object",
    properties: {
      sujet: { type: "string" },
      intention_recherche: { type: "string" },
      mot_cle_principal: { type: "string" },
      mots_cles_secondaires: { type: "array", items: { type: "string" } },
      questions_utilisateurs: { type: "array", items: { type: "string" } },
      angle_recommande: { type: "string" },
      titre_recommande: { type: "string" },
      plan_h2: { type: "array", items: { type: "string" } },
      points_differenciation: { type: "array", items: { type: "string" } },
      sources: {
        type: "array",
        items: {
          type: "object",
          properties: {
            titre: { type: "string" },
            url: { type: "string" },
            apport: { type: "string" }
          },
          required: ["titre", "url", "apport"]
        }
      },
      avertissements: { type: "array", items: { type: "string" } }
    },
    required: [
      "sujet",
      "intention_recherche",
      "mot_cle_principal",
      "mots_cles_secondaires",
      "questions_utilisateurs",
      "angle_recommande",
      "titre_recommande",
      "plan_h2",
      "points_differenciation",
      "sources",
      "avertissements"
    ]
  };
  const prompt = `Tu es l'analyste SEO public d'AdamEcom, une marque orient\xE9e Shopify, CRO, e-commerce et performance.

Sujet \xE0 analyser : ${sujet}

Utilise Google Search et le contexte public de https://adam-ecom.com/blogs/actualites pour :
1. comprendre l'intention de recherche en fran\xE7ais ;
2. identifier les angles et questions visibles dans les r\xE9sultats actuels ;
3. proposer un angle utile, non g\xE9n\xE9rique et coh\xE9rent avec AdamEcom ;
4. produire un plan d'article SEO exploitable ;
5. citer uniquement des sources r\xE9ellement consult\xE9es, avec leurs URL exactes.

N'invente aucune statistique, aucun r\xE9sultat ni aucune URL. Cette recherche sert uniquement de brief : elle ne doit publier, modifier ou envoyer aucune donn\xE9e. N'utilise que des informations publiques.`;
  try {
    const reponse = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        model: modele,
        input: prompt,
        tools: [{ type: "google_search" }, { type: "url_context" }],
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema
        }
      }),
      signal: AbortSignal.timeout(9e4)
    });
    const payload = await reponse.json().catch(() => null);
    if (!reponse.ok) throw new Error(erreurInteractionGemini(payload));
    const texte = texteInteractionGemini(payload);
    if (!texte) throw new Error("Gemini n'a pas renvoy\xE9 le brief attendu.");
    let resultat;
    try {
      resultat = JSON.parse(texte);
    } catch {
      throw new Error("Le brief Gemini n'est pas un JSON valide.");
    }
    const champsTableaux = ["mots_cles_secondaires", "questions_utilisateurs", "plan_h2", "points_differenciation", "sources", "avertissements"];
    for (const champ of champsTableaux) {
      if (!Array.isArray(resultat?.[champ])) throw new Error(`Le champ ${champ} manque dans le brief Gemini.`);
    }
    const fini = (/* @__PURE__ */ new Date()).toISOString();
    await env.DB.prepare("UPDATE gemini_recherches SET statut='terminee',resultat_json=?,erreur=NULL,maj_le=? WHERE id=?").bind(
      JSON.stringify(resultat),
      fini,
      id
    ).run();
    return { id, resultat };
  } catch (e) {
    const erreur = String(e?.message || e).slice(0, 1e3);
    await env.DB.prepare("UPDATE gemini_recherches SET statut='erreur',erreur=?,maj_le=? WHERE id=?").bind(
      erreur,
      (/* @__PURE__ */ new Date()).toISOString(),
      id
    ).run();
    return { id, erreur };
  }
}
__name(lancerRechercheGemini, "lancerRechercheGemini");
__name2(lancerRechercheGemini, "lancerRechercheGemini");
__name22(lancerRechercheGemini, "lancerRechercheGemini");
var BLOG_ESSAIS_MAX = 3;
var BLOG_IMAGE_MAX = 19e5;
function blogMaintenantParis() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(/* @__PURE__ */ new Date()).map((x) => [x.type, x.value]));
  return { jour: `${p.year}${p.month}${p.day}`, heure: `${p.hour}:${p.minute}` };
}
async function assurerBlogRedactionSchema(db) {
  const colonnes = new Set((await tous2(db, "PRAGMA table_info(blog_dossiers)")).map((c) => c.name));
  if (!colonnes.has("essais")) await db.prepare("ALTER TABLE blog_dossiers ADD COLUMN essais INTEGER NOT NULL DEFAULT 0").run();
  if (!colonnes.has("verrou")) await db.prepare("ALTER TABLE blog_dossiers ADD COLUMN verrou TEXT").run();
  if (!colonnes.has("origine")) await db.prepare("ALTER TABLE blog_dossiers ADD COLUMN origine TEXT").run();
  if (!colonnes.has("mot_cle")) await db.prepare("ALTER TABLE blog_dossiers ADD COLUMN mot_cle TEXT").run();
}
async function blogNouveauDossier(env, { manuel = false } = {}) {
  await assurerBlogSchema(env.DB);
  await assurerBlogRedactionSchema(env.DB);
  const { jour } = blogMaintenantParis();
  const existants = await tous2(env.DB, "SELECT id,statut FROM blog_dossiers WHERE id LIKE ?", `ADAMSEO-${jour}-%`);
  if (!manuel && existants.length) return { deja: true };
  if (existants.some((d) => d.statut === "preparation")) return { erreur: "Un article est d\xE9j\xE0 en cours de r\xE9daction. Il sera pr\xEAt dans quelques minutes." };
  const numeros = existants.map((d) => Number(d.id.slice(-2)) || 0);
  const n = Math.max(0, ...numeros) + 1;
  if (n > 99) return { erreur: "Trop d'articles cr\xE9\xE9s aujourd'hui." };
  const id = `ADAMSEO-${jour}-${String(n).padStart(2, "0")}`;
  const maintenant = (/* @__PURE__ */ new Date()).toISOString();
  await env.DB.prepare(`INSERT INTO blog_dossiers (id,titre,statut,revision,image_ok,html_ok,message,essais,origine,cree_le,maj_le)
    VALUES (?,?,'preparation',1,0,0,?,0,'app',?,?)`).bind(id, "Article en cours de r\xE9daction", "R\xE9daction du texte par Gemini…", maintenant, maintenant).run();
  return { id };
}
function blogHandle(texte) {
  return String(texte || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " et ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "");
}
async function blogGeminiTexte(env, input, schema) {
  const essais = [env.GEMINI_BLOG_MODEL, "gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.7-flash"].filter(Boolean);
  let derniereErreur = "";
  for (const [n, modele] of essais.entries()) {
    if (n > 0) await new Promise((r) => setTimeout(r, 1500));
    const reponse = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({ model: modele, input, response_format: { type: "text", mime_type: "application/json", schema } }),
      signal: AbortSignal.timeout(24e4)
    }).catch((e) => ({ ok: false, status: 0, json: async () => ({ message: String(e?.message || e) }) }));
    const corps = await reponse.json().catch(() => null);
    if (reponse.ok) {
      const texte = texteInteractionGemini(corps);
      try {
        return JSON.parse(texte);
      } catch {
        derniereErreur = "r\xE9ponse illisible";
        continue;
      }
    }
    derniereErreur = erreurInteractionGemini(corps);
    if (![0, 404, 429, 500, 503].includes(reponse.status) && !/demand|overload|unavailable|quota|not found|no longer available/i.test(derniereErreur)) break;
  }
  throw new Error(`Gemini (texte) : ${derniereErreur}`);
}
async function blogRedigerTexte(env, dossier) {
  const deja = await tous2(env.DB, "SELECT titre FROM blog_dossiers WHERE id!=? ORDER BY cree_le DESC LIMIT 60", dossier.id);
  const titresDeja = deja.map((d) => `- ${d.titre}`).join("\n") || "- (aucun)";
  const schema = {
    type: "object",
    properties: {
      titre: { type: "string" },
      mot_cle: { type: "string" },
      seo_title: { type: "string" },
      meta_description: { type: "string" },
      resume: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      alt_image: { type: "string" },
      html: { type: "string" }
    },
    required: ["titre", "mot_cle", "seo_title", "meta_description", "resume", "tags", "alt_image", "html"]
  };
  const input = `Tu es le r\xE9dacteur SEO d'AdamEcom (adam-ecom.com), expert Shopify, CRO (optimisation du taux de conversion) et e-commerce. Le blog s'adresse \xE0 des marchands Shopify francophones qui ont d\xE9j\xE0 du trafic et veulent vendre davantage.

Choisis toi-m\xEAme un sujet utile et recherch\xE9 sur Google en fran\xE7ais (Shopify, conversion, fiche produit, panier, checkout, confiance, mobile, vitesse, SEO e-commerce, publicit\xE9 Meta/Google pour Shopify, fid\xE9lisation, emailing…). Appuie-toi sur ce que les marchands cherchent r\xE9ellement sur Google et sur les fonctionnalit\xE9s Shopify que tu connais avec certitude.

Le sujet doit \xEAtre diff\xE9rent de ces articles d\xE9j\xE0 \xE9crits (ne reprends ni le m\xEAme sujet ni le m\xEAme angle) :
${titresDeja}

R\xE9dige un article complet en fran\xE7ais, de 1 800 \xE0 2 500 mots, concret, actionnable, sans remplissage.

R\xE8gles du HTML (champ html) :
- structure : <article><header><h1>Titre</h1><p>introduction</p></header> puis plusieurs <section><h2>…</h2>…</section>, avec <h3>, <p>, <ul>/<ol>/<li>, <strong>, <table> si utile, et une section FAQ (<h2>Questions fr\xE9quentes</h2> avec des <h3>) puis une conclusion ; fermer </article> ;
- aucun CSS : pas de balise <style>, pas d'attribut style, pas de class, pas de script, pas d'image ;
- n'invente aucune statistique, aucun chiffre, aucune \xE9tude, aucun client ni aucune URL ; n'avance un chiffre que s'il est public, connu et attribu\xE9 \xE0 sa source nomm\xE9e dans le texte, sinon n'en mets pas ; ne d\xE9cris pas de fonctionnalit\xE9 Shopify dont tu n'es pas s\xFBr ;
- ne promets pas de r\xE9sultats garantis ;
- n'ajoute pas d'appel \xE0 l'action commercial final : l'application ajoute elle-m\xEAme les blocs Shopify et prise d'appel.

Autres champs :
- titre : 50 \xE0 90 caract\xE8res, accrocheur, avec le mot-cl\xE9 principal ;
- mot_cle : le mot-cl\xE9 principal vis\xE9 ;
- seo_title : 60 caract\xE8res maximum ;
- meta_description : 140 \xE0 160 caract\xE8res ;
- resume : 1 \xE0 2 phrases (extrait affich\xE9 dans la liste du blog) ;
- tags : 5 \xE0 8 tags courts, dont \xAB Shopify \xBB ;
- alt_image : texte alternatif d\xE9crivant une image de couverture abstraite li\xE9e au sujet.

Retourne uniquement le JSON demand\xE9.`;
  const r = await blogGeminiTexte(env, input, schema);
  const titre = String(r?.titre || "").trim().slice(0, 240);
  let html = String(r?.html || "").trim().replace(/^```(?:html)?\s*|\s*```$/g, "");
  if (!titre) throw new Error("Gemini n'a pas donn\xE9 de titre.");
  if (html.length < 4e3) throw new Error("Article trop court, nouvel essai.");
  html = html.replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, "").replace(/\s(?:style|class)\s*=\s*("[^"]*"|'[^']*')/gi, "").replace(/<img\b[^>]*>/gi, "");
  if (!/^<article/i.test(html)) html = `<article>${html}</article>`;
  html = appliquerBlocsCommerciaux(html);
  let handle = blogHandle(titre);
  const [pris] = await tous2(env.DB, "SELECT id FROM blog_dossiers WHERE handle=? AND id!=?", handle, dossier.id);
  if (pris) handle = `${handle}-${dossier.id.slice(8, 16)}`.slice(0, 90);
  const cfg = await env.DB.prepare("SELECT auteur FROM blog_config WHERE id=1").first().catch(() => null);
  const tags = (Array.isArray(r.tags) ? r.tags : []).map((t) => String(t).replace(/,/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 10).join(", ");
  return {
    titre,
    handle,
    mot_cle: String(r.mot_cle || "").trim().slice(0, 120) || null,
    seo_title: String(r.seo_title || titre).trim().slice(0, 70),
    meta_description: String(r.meta_description || "").trim().slice(0, 320),
    resume: String(r.resume || "").trim().slice(0, 500),
    tags,
    alt_image: String(r.alt_image || titre).trim().slice(0, 240),
    auteur: cfg?.auteur || "Adam Ecom",
    html
  };
}
async function blogModelesImage(env) {
  const liste = [env.GEMINI_IMAGE_MODEL].filter(Boolean);
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", {
    headers: { "x-goog-api-key": env.GEMINI_API_KEY },
    signal: AbortSignal.timeout(2e4)
  }).catch(() => null);
  const corps = r?.ok ? await r.json().catch(() => null) : null;
  const trouves = (corps?.models || []).filter((m) => /gemini.*image/i.test(m.name || "") && (m.supportedGenerationMethods || []).includes("generateContent")).map((m) => String(m.name).replace(/^models\//, ""));
  const version = (nom) => Number((nom.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  trouves.sort((a, b) => version(b) - version(a) || /flash/.test(b) - /flash/.test(a) || /preview/.test(a) - /preview/.test(b));
  for (const nom of [...trouves, "gemini-2.5-flash-image"]) if (!liste.includes(nom)) liste.push(nom);
  return liste.slice(0, 4);
}
async function blogCreerImage(env, titre) {
  const cfg = await env.DB.prepare("SELECT prompt_image FROM blog_config WHERE id=1").first().catch(() => null);
  const prompt = String(cfg?.prompt_image || PROMPT_IMAGE_BLOG).replace("[TITRE OU SUJET DU BLOG]", titre);
  let derniereErreur = "aucun mod\xE8le d'image disponible";
  for (const modele of await blogModelesImage(env)) {
    const reponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modele)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" } }
      }),
      signal: AbortSignal.timeout(18e4)
    }).catch((e) => ({ ok: false, status: 0, json: async () => ({ message: String(e?.message || e) }) }));
    const corps = await reponse.json().catch(() => null);
    if (!reponse.ok) {
      derniereErreur = `${modele} : ${erreurInteractionGemini(corps)}`;
      continue;
    }
    const parts = corps?.candidates?.[0]?.content?.parts || [];
    const image = parts.map((p) => p.inlineData || p.inline_data).find((d) => d?.data);
    if (!image) {
      derniereErreur = `${modele} : aucune image renvoy\xE9e`;
      continue;
    }
    if (image.data.length > BLOG_IMAGE_MAX) {
      derniereErreur = `${modele} : image trop lourde (${Math.round(image.data.length * 3 / 4 / 1024)} Ko)`;
      continue;
    }
    return { base64: image.data, mime: image.mimeType || image.mime_type || "image/png" };
  }
  throw new Error(`Image : ${derniereErreur}`);
}
async function blogJetonImage(env, id) {
  return hexa(await hmacOctets(`blogimage:${env.CLE_TEST || "adamecom"}`, id)).slice(0, 24);
}
async function pageImageBlog(env, url) {
  const m = url.pathname.match(/^\/blog-image\/(ADAMSEO-\d{8}-\d{2})\.(png|jpg|webp)$/);
  if (!m || url.searchParams.get("s") !== await blogJetonImage(env, m[1])) return new Response("Introuvable", { status: 404 });
  const d = await env.DB.prepare("SELECT image_base64,image_mime FROM blog_dossiers WHERE id=?").bind(m[1]).first();
  if (!d?.image_base64) return new Response("Introuvable", { status: 404 });
  const b64 = d.image_base64.replace(/\s/g, "");
  let octetsImage;
  if (typeof Uint8Array.fromBase64 === "function") octetsImage = Uint8Array.fromBase64(b64);
  else {
    const binaire = atob(b64);
    octetsImage = new Uint8Array(binaire.length);
    for (let i = 0; i < binaire.length; i++) octetsImage[i] = binaire.charCodeAt(i);
  }
  return new Response(octetsImage, { headers: { "content-type": d.image_mime || "image/png", "cache-control": "public, max-age=86400" } });
}
async function blogPublierShopify(env, dossier) {
  const cfg = await env.DB.prepare("SELECT boutique,handle_blog,auteur FROM blog_config WHERE id=1").first().catch(() => null);
  const handleBlog = cfg?.handle_blog || "actualites";
  const jeton = await jetonShopify(env);
  const lecture = await shopify(env, jeton, `query BlogEtArticle($qb: String!, $qa: String!) {
    blogs(first: 5, query: $qb) { nodes { id handle } }
    articles(first: 5, query: $qa) { nodes { id handle blog { handle } } }
  }`, { qb: `handle:${handleBlog}`, qa: `handle:${dossier.handle}` });
  const blog = (lecture?.blogs?.nodes || []).find((b) => b.handle === handleBlog);
  if (!blog) throw new Error(`Blog Shopify \xAB ${handleBlog} \xBB introuvable.`);
  const boutique = String(cfg?.boutique || "adam-ecom.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const existant = (lecture?.articles?.nodes || []).find((a) => a.handle === dossier.handle && a.blog?.handle === handleBlog);
  if (existant) return { id: existant.id, url: `https://${boutique}/blogs/${handleBlog}/${existant.handle}`, deja: true };
  const origine = (env.APP_ORIGINE || "https://app.adam-ecom.online").replace(/\/$/, "");
  const ext = /jpe?g/.test(dossier.image_mime || "") ? "jpg" : /webp/.test(dossier.image_mime || "") ? "webp" : "png";
  const article = {
    blogId: blog.id,
    title: dossier.titre,
    handle: dossier.handle,
    body: dossier.html,
    summary: dossier.resume ? `<p>${echapper(dossier.resume)}</p>` : null,
    author: { name: dossier.auteur || cfg?.auteur || "Adam Ecom" },
    tags: String(dossier.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
    isPublished: true,
    metafields: [
      dossier.seo_title ? { namespace: "global", key: "title_tag", type: "single_line_text_field", value: dossier.seo_title } : null,
      dossier.meta_description ? { namespace: "global", key: "description_tag", type: "multi_line_text_field", value: dossier.meta_description } : null
    ].filter(Boolean)
  };
  if (dossier.has_image) article.image = { url: `${origine}/blog-image/${dossier.id}.${ext}?s=${await blogJetonImage(env, dossier.id)}`, altText: dossier.alt_image || dossier.titre };
  const r = await shopify(env, jeton, `mutation CreerArticle($article: ArticleCreateInput!) {
    articleCreate(article: $article) { article { id handle } userErrors { field message code } }
  }`, { article });
  const erreurs = r?.articleCreate?.userErrors || [];
  if (erreurs.length || !r?.articleCreate?.article) throw new Error(`Shopify : ${erreurs.map((e) => e.message).join(" ; ") || "article non cr\xE9\xE9"}`);
  const a = r.articleCreate.article;
  return { id: a.id, url: `https://${boutique}/blogs/${handleBlog}/${a.handle}` };
}
async function blogRedactionEtape(env) {
  if (!env.DB) return;
  const db = env.DB;
  try {
    const cfg = await db.prepare("SELECT actif,heure_generation FROM blog_config WHERE id=1").first().catch(() => null);
    if (!cfg) return;
    const maintenant = (/* @__PURE__ */ new Date()).toISOString();
    const expire = new Date(Date.now() - 10 * 6e4).toISOString();
    let dossier = await db.prepare(`SELECT id,titre,handle,statut,html_ok,image_ok,essais,verrou FROM blog_dossiers
      WHERE statut IN ('valide','publication','preparation') AND (verrou IS NULL OR verrou<?)
      ORDER BY CASE statut WHEN 'valide' THEN 0 WHEN 'publication' THEN 1 ELSE 2 END, cree_le LIMIT 1`).bind(expire).first().catch(async (e) => {
      if (/no such column/i.test(String(e?.message || e))) await assurerBlogRedactionSchema(db);
      return false;
    });
    if (dossier === false) return;
    if (!dossier) {
      if (!Number(cfg.actif)) return;
      const { jour, heure } = blogMaintenantParis();
      if (heure < String(cfg.heure_generation || "08:00")) return;
      const deja = await db.prepare("SELECT id FROM blog_dossiers WHERE id>=? AND id<? LIMIT 1").bind(`ADAMSEO-${jour}-`, `ADAMSEO-${jour}-~`).first();
      if (deja) return;
      const cree = await blogNouveauDossier(env);
      if (!cree.id) return;
      dossier = { id: cree.id, titre: "", statut: "preparation", html_ok: 0, image_ok: 0, essais: 0 };
    }
    const etape = dossier.statut === "valide" || dossier.statut === "publication" ? "publication" : Number(dossier.html_ok) ? "image" : "texte";
    if (Number(dossier.essais) >= BLOG_ESSAIS_MAX) {
      const libelle = etape === "publication" ? "La publication sur Shopify" : etape === "image" ? "La cr\xE9ation de l'image" : "La r\xE9daction du texte";
      await db.prepare("UPDATE blog_dossiers SET statut='erreur',verrou=NULL,message=?,maj_le=? WHERE id=?").bind(`${libelle} a \xE9chou\xE9 ${BLOG_ESSAIS_MAX} fois (d\xE9lai d\xE9pass\xE9). Utilisez \xAB Relancer \xBB.`, maintenant, dossier.id).run();
      return;
    }
    const pris = await db.prepare("UPDATE blog_dossiers SET verrou=?,essais=essais+1 WHERE id=? AND (verrou IS NULL OR verrou<?)").bind(maintenant, dossier.id, expire).run();
    if (!pris.meta.changes) return;
    const dernierEssai = Number(dossier.essais) + 1 >= BLOG_ESSAIS_MAX;
    try {
      if (!env.GEMINI_API_KEY && etape !== "publication") throw new Error("La connexion Gemini n'est pas configur\xE9e dans Cloudflare.");
      if (etape === "texte") {
        const t = await blogRedigerTexte(env, dossier);
        await db.prepare(`UPDATE blog_dossiers SET titre=?,handle=?,mot_cle=?,seo_title=?,meta_description=?,resume=?,tags=?,alt_image=?,auteur=?,html=?,html_ok=1,
          essais=0,verrou=NULL,message=?,maj_le=? WHERE id=?`).bind(t.titre, t.handle, t.mot_cle, t.seo_title, t.meta_description, t.resume, t.tags, t.alt_image, t.auteur, t.html, "Texte r\xE9dig\xE9. Cr\xE9ation de l'image de couverture…", (/* @__PURE__ */ new Date()).toISOString(), dossier.id).run();
      } else if (etape === "image") {
        const img = await blogCreerImage(env, dossier.titre);
        await db.prepare(`UPDATE blog_dossiers SET image_base64=?,image_mime=?,image_nom=?,image_ok=1,statut='pret_validation',essais=0,verrou=NULL,message=?,maj_le=? WHERE id=?`).bind(img.base64, img.mime, `${dossier.handle || dossier.id}.${/jpe?g/.test(img.mime) ? "jpg" : "png"}`, "Article r\xE9dig\xE9 par l'application. Relisez-le puis validez-le pour le publier sur Shopify.", (/* @__PURE__ */ new Date()).toISOString(), dossier.id).run();
      } else {
        await db.prepare("UPDATE blog_dossiers SET statut='publication',message=?,maj_le=? WHERE id=?").bind("Publication sur Shopify en cours…", maintenant, dossier.id).run();
        const complet = await db.prepare("SELECT id,titre,handle,html,resume,auteur,tags,seo_title,meta_description,alt_image,image_mime,image_base64 IS NOT NULL AS has_image FROM blog_dossiers WHERE id=?").bind(dossier.id).first();
        if (!complet?.html || !complet.handle) throw new Error("Le dossier n'a pas de texte ou d'adresse d'article.");
        const p = await blogPublierShopify(env, complet);
        await db.prepare("UPDATE blog_dossiers SET statut='publie',article_shopify_id=?,url_publique=?,essais=0,verrou=NULL,message=?,maj_le=? WHERE id=?").bind(p.id, p.url, p.deja ? "Cet article existait d\xE9j\xE0 sur Shopify : il a \xE9t\xE9 rattach\xE9 au dossier." : "Publi\xE9 sur Shopify.", (/* @__PURE__ */ new Date()).toISOString(), dossier.id).run();
      }
    } catch (e) {
      let msg = String(e?.message || e).slice(0, 600);
      if (etape === "publication" && /access|scope|denied|write_content/i.test(msg)) msg += " — l'application Shopify doit avoir l'autorisation \xAB write_content \xBB.";
      const fin = dernierEssai || etape === "publication" && !/429|5\d\d|timeout|throttl/i.test(msg);
      await db.prepare(`UPDATE blog_dossiers SET verrou=?,statut=?,message=?,maj_le=? WHERE id=?`).bind(
        fin ? null : new Date(Date.now() - 7 * 6e4).toISOString(),
        fin ? "erreur" : etape === "publication" ? "valide" : "preparation",
        fin ? msg : `Nouvel essai dans quelques minutes (${msg})`,
        (/* @__PURE__ */ new Date()).toISOString(),
        dossier.id
      ).run();
    }
  } catch (e) {
    console.error("blogRedactionEtape:", e?.message || e);
  }
}
async function blogRelancer(db, id) {
  await assurerBlogRedactionSchema(db);
  const d = await db.prepare("SELECT statut,html_ok,image_ok FROM blog_dossiers WHERE id=?").bind(id).first();
  if (!d || d.statut !== "erreur") return { erreur: "Ce dossier n'est pas en erreur." };
  const versPublication = Number(d.html_ok) && Number(d.image_ok);
  await db.prepare("UPDATE blog_dossiers SET statut=?,essais=0,verrou=NULL,message=?,maj_le=? WHERE id=?").bind(
    versPublication ? "pret_validation" : "preparation",
    versPublication ? "Dossier remis en attente de validation." : "Nouvel essai de r\xE9daction…",
    (/* @__PURE__ */ new Date()).toISOString(),
    id
  ).run();
  return { ok: true };
}
async function blogSupprimer(db, id) {
  const r = await db.prepare("DELETE FROM blog_dossiers WHERE id=? AND statut IN ('preparation','pret_validation','erreur') AND article_shopify_id IS NULL").bind(id).run();
  return r.meta.changes ? { ok: true } : { erreur: "Ce dossier ne peut pas \xEAtre supprim\xE9 (d\xE9j\xE0 valid\xE9 ou publi\xE9)." };
}
var SEO_VIDES = /* @__PURE__ */ new Set([
  "le",
  "la",
  "les",
  "de",
  "des",
  "du",
  "un",
  "une",
  "et",
  "ou",
  "a",
  "au",
  "aux",
  "pour",
  "sans",
  "avec",
  "dans",
  "sur",
  "par",
  "en",
  "que",
  "qui",
  "ce",
  "cette",
  "ces",
  "son",
  "sa",
  "ses",
  "vos",
  "votre",
  "nos",
  "notre",
  "est",
  "sont",
  "plus",
  "tout",
  "tous",
  "comment",
  "pourquoi"
]);
var sansBalises = /* @__PURE__ */ __name2((h) => String(h || "").replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim(), "sansBalises");
var sansAccents = /* @__PURE__ */ __name2((s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(), "sansAccents");
function seoTermes(motCle) {
  return sansAccents(motCle).split(/[^a-z0-9]+/).filter((m) => m.length > 2 && !SEO_VIDES.has(m));
}
__name(seoTermes, "seoTermes");
__name2(seoTermes, "seoTermes");
function seoCouverture(texte, termes) {
  if (!termes.length) return 0;
  const t = sansAccents(texte);
  return termes.filter((m) => t.includes(m)).length / termes.length;
}
__name(seoCouverture, "seoCouverture");
__name2(seoCouverture, "seoCouverture");
function seoPresence(texte, termes) {
  const c = seoCouverture(texte, termes);
  return c >= 0.66 ? 1 : c / 0.66;
}
__name(seoPresence, "seoPresence");
__name2(seoPresence, "seoPresence");
var seoDire = /* @__PURE__ */ __name2((n) => n >= 0.99 ? "pr\xE9sent" : n >= 0.5 ? "partiellement pr\xE9sent" : "absent", "seoDire");
var seoMots = /* @__PURE__ */ __name2((t) => sansBalises(t).split(/\s+/).filter(Boolean), "seoMots");
function seoPhrases(texte) {
  return texte.split(/(?<=[.!?…])\s+/).map((p) => p.trim()).filter((p) => p.split(/\s+/).length > 2);
}
__name(seoPhrases, "seoPhrases");
__name2(seoPhrases, "seoPhrases");
function seoControle(id, libelle, obtenu, max, constat, conseil) {
  const part = max ? obtenu / max : 0;
  return {
    id,
    libelle,
    points: Math.round(obtenu * 10) / 10,
    max,
    verdict: part >= 0.99 ? "bon" : part >= 0.5 ? "moyen" : "mauvais",
    constat,
    conseil: part >= 0.99 ? null : conseil
  };
}
__name(seoControle, "seoControle");
__name2(seoControle, "seoControle");
function analyserSeo(dossier, htmlLive) {
  const corps = dossier.html || "";
  const texte = sansBalises(corps);
  const mots = seoMots(corps);
  const nbMots = mots.length;
  const live = htmlLive || "";
  const motCle = (dossier.mot_cle || "").trim() || String(dossier.handle || "").replace(/-/g, " ");
  const termes = seoTermes(motCle);
  const titre = dossier.seo_title || dossier.titre || "";
  const meta = dossier.meta_description || "";
  const slug = dossier.handle || "";
  const F = [];
  const lt = titre.length;
  const cTitre = seoPresence(titre, termes);
  F.push({ nom: "Balises", controles: [
    seoControle(
      "titre_long",
      "Longueur du titre SEO",
      lt >= 30 && lt <= 60 ? 6 : lt >= 25 && lt <= 70 ? 3 : 0,
      6,
      `${lt} caract\xE8res`,
      lt < 30 ? "Trop court : visez 30 \xE0 60 caract\xE8res pour occuper toute la ligne de r\xE9sultat." : "Trop long : au-del\xE0 de 60 caract\xE8res, Google tronque la fin."
    ),
    seoControle(
      "titre_motcle",
      "Mot-cl\xE9 dans le titre",
      5 * cTitre,
      5,
      seoDire(cTitre),
      "Placez le mot-cl\xE9 dans le titre, si possible dans les premiers mots."
    ),
    seoControle(
      "meta_long",
      "Longueur de la m\xE9ta description",
      meta.length >= 120 && meta.length <= 158 ? 5 : meta.length >= 90 && meta.length <= 180 ? 2.5 : 0,
      5,
      `${meta.length} caract\xE8res`,
      meta.length < 120 ? "Trop courte : 120 \xE0 158 caract\xE8res exploitent tout l'espace affich\xE9." : "Trop longue : Google coupera au-del\xE0 de 158 caract\xE8res."
    ),
    seoControle(
      "meta_motcle",
      "Mot-cl\xE9 dans la m\xE9ta description",
      4 * seoPresence(meta, termes),
      4,
      seoDire(seoPresence(meta, termes)),
      "Reprenez le mot-cl\xE9 : Google le met en gras dans les r\xE9sultats."
    )
  ] });
  const h1Live = (live.match(/<h1[\s>]/gi) || []).length;
  const h1Corps = (corps.match(/<h1[\s>]/gi) || []).length;
  const h2 = (corps.match(/<h2[\s>]/gi) || []).length;
  const niveaux = [...corps.matchAll(/<h([1-6])[\s>]/gi)].map((m) => Number(m[1]));
  let saut = false;
  for (let i = 1; i < niveaux.length; i++) if (niveaux[i] - niveaux[i - 1] > 1) saut = true;
  const paras = [...corps.matchAll(/<p[\s>]([\s\S]*?)<\/p>/gi)].map((m) => seoMots(m[1]).length).filter((n) => n > 0);
  const paraMoy = paras.length ? paras.reduce((a2, b) => a2 + b, 0) / paras.length : 0;
  F.push({ nom: "Structure", controles: [
    seoControle(
      "h1_unique",
      "Un seul H1 sur la page",
      h1Live === 1 ? 5 : 0,
      5,
      live ? `${h1Live} balise(s) H1` : "page publi\xE9e non analys\xE9e",
      h1Live === 0 ? "Aucun H1 : le th\xE8me doit rendre le titre de l'article en H1." : "Plusieurs H1 : Google ne sait plus quel est le sujet principal."
    ),
    seoControle(
      "h1_corps",
      "Pas de H1 dans le corps",
      h1Corps === 0 ? 3 : 0,
      3,
      `${h1Corps} H1 dans l'article`,
      "Shopify rend d\xE9j\xE0 le titre en H1. R\xE9trogradez ceux du corps en H2."
    ),
    seoControle(
      "h2_nombre",
      "Nombre de sous-titres",
      h2 >= 3 ? 4 : h2 >= 1 ? 2 : 0,
      4,
      `${h2} H2`,
      "D\xE9coupez en au moins 3 sections : c'est ce qui nourrit les extraits enrichis."
    ),
    seoControle(
      "hierarchie",
      "Hi\xE9rarchie des titres",
      saut ? 0 : 3,
      3,
      saut ? "un niveau est saut\xE9" : "coh\xE9rente",
      "Ne sautez pas de niveau : un H3 doit suivre un H2, jamais un H1."
    ),
    seoControle(
      "paragraphes",
      "Longueur des paragraphes",
      paraMoy > 0 && paraMoy <= 120 ? 3 : paraMoy <= 160 ? 1.5 : 0,
      3,
      `${Math.round(paraMoy)} mots en moyenne`,
      "Paragraphes trop denses : visez moins de 120 mots, surtout sur mobile."
    )
  ] });
  const cent = mots.slice(0, 100).join(" ");
  const h2Textes = [...corps.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => sansBalises(m[1])).join(" ");
  const alts = [...corps.matchAll(/alt=["']([^"']*)["']/gi)].map((m) => m[1]).join(" ") + " " + (dossier.alt_image || "");
  const occurrences = termes.length ? sansAccents(texte).split(sansAccents(termes[0])).length - 1 : 0;
  const densite = nbMots ? occurrences / nbMots * 100 : 0;
  F.push({ nom: "Mot-cl\xE9", controles: [
    seoControle(
      "slug",
      "Mot-cl\xE9 dans l'URL",
      seoCouverture(slug.replace(/-/g, " "), termes) >= 0.6 ? 3 : 0,
      3,
      slug || "\u2014",
      "Reprenez le mot-cl\xE9 dans le slug, en minuscules et s\xE9par\xE9 par des tirets."
    ),
    seoControle(
      "intro",
      "Mot-cl\xE9 dans les 100 premiers mots",
      4 * seoPresence(cent, termes),
      4,
      seoDire(seoPresence(cent, termes)),
      "Annoncez le sujet d\xE8s l'introduction : Google y accorde plus de poids."
    ),
    seoControle(
      "h2_motcle",
      "Mot-cl\xE9 dans un sous-titre",
      4 * seoPresence(h2Textes, termes),
      4,
      seoDire(seoPresence(h2Textes, termes)),
      "Placez le mot-cl\xE9, ou une variante, dans au moins un H2."
    ),
    seoControle(
      "alt_motcle",
      "Mot-cl\xE9 dans un texte alternatif",
      3 * seoPresence(alts, termes),
      3,
      seoDire(seoPresence(alts, termes)),
      "D\xE9crivez au moins une image avec le mot-cl\xE9, sans le forcer."
    ),
    seoControle(
      "densite",
      "Densit\xE9 du mot-cl\xE9",
      densite >= 0.4 && densite <= 2.5 ? 4 : densite > 0 && densite <= 3.5 ? 2 : 0,
      4,
      `${densite.toFixed(2).replace(".", ",")} %`,
      densite < 0.4 ? "Trop rare : le sujet n'est pas assez affirm\xE9." : "Trop dense : la r\xE9p\xE9tition excessive est p\xE9nalis\xE9e."
    )
  ] });
  const phrases = seoPhrases(texte);
  const longueurs = phrases.map((p) => p.split(/\s+/).length);
  const phraseMoy = longueurs.length ? longueurs.reduce((a2, b) => a2 + b, 0) / longueurs.length : 0;
  const tresLongues = longueurs.filter((n) => n > 35).length;
  const partLongues = longueurs.length ? tresLongues / longueurs.length : 0;
  const listes = (corps.match(/<(ul|ol|table)[\s>]/gi) || []).length;
  F.push({ nom: "Contenu", controles: [
    seoControle(
      "volume",
      "Volume de contenu",
      nbMots >= 900 ? 6 : nbMots >= 600 ? 3.5 : nbMots >= 300 ? 1.5 : 0,
      6,
      `${nbMots} mots`,
      nbMots < 600 ? "Contenu mince : en dessous de 600 mots, la page se positionne mal." : "Visez 900 mots ou plus pour un sujet de fond."
    ),
    seoControle(
      "phrases",
      "Longueur moyenne des phrases",
      phraseMoy > 0 && phraseMoy <= 22 ? 5 : phraseMoy <= 28 ? 2.5 : 0,
      5,
      `${phraseMoy.toFixed(1).replace(".", ",")} mots`,
      "Phrases longues : au-del\xE0 de 22 mots en moyenne, la lecture d\xE9croche."
    ),
    seoControle(
      "listes",
      "Listes et tableaux",
      listes >= 1 ? 3 : 0,
      3,
      `${listes} bloc(s)`,
      "Ajoutez une liste ou un tableau : ce sont les formats repris en extrait enrichi."
    ),
    seoControle(
      "longues",
      "Part de phrases tr\xE8s longues",
      partLongues <= 0.1 ? 2 : partLongues <= 0.2 ? 1 : 0,
      2,
      `${Math.round(partLongues * 100)} % au-dessus de 35 mots`,
      "Coupez les phrases de plus de 35 mots."
    )
  ] });
  const hrefs = [...corps.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const internes = hrefs.filter(([, u]) => u.startsWith("/") || u.includes("adam-ecom.com"));
  const externes = hrefs.filter(([, u]) => /^https?:/i.test(u) && !u.includes("adam-ecom.com"));
  const ancresFaibles = hrefs.filter(([, , a2]) => /^(cliquez ici|ici|en savoir plus|lire la suite|ce lien)$/i.test(sansBalises(a2))).length;
  const imgs = [...corps.matchAll(/<img[^>]*>/gi)].map((m) => m[0]);
  let sansAlt = imgs.filter((i) => !/\salt=["'][^"']+["']/i.test(i)).length;
  if (dossier.image_url) {
    imgs.push("couverture");
    if (!String(dossier.alt_image || "").trim()) sansAlt++;
  }
  F.push({ nom: "Liens et images", controles: [
    seoControle(
      "internes",
      "Maillage interne",
      internes.length >= 3 ? 5 : internes.length >= 1 ? 2.5 : 0,
      5,
      `${internes.length} lien(s) interne(s)`,
      "Ajoutez au moins 3 liens vers vos autres pages : c'est ce qui fait circuler l'autorit\xE9."
    ),
    seoControle(
      "externes",
      "Liens sortants",
      externes.length >= 1 ? 3 : 0,
      3,
      `${externes.length} lien(s) externe(s)`,
      "Citez une source de r\xE9f\xE9rence : cela cr\xE9dibilise le contenu."
    ),
    seoControle(
      "ancres",
      "Qualit\xE9 des ancres",
      ancresFaibles === 0 ? 3 : 1,
      3,
      ancresFaibles ? `${ancresFaibles} ancre(s) non descriptive(s)` : "toutes descriptives",
      "Remplacez \xAB cliquez ici \xBB par un libell\xE9 qui d\xE9crit la destination."
    ),
    seoControle(
      "alt",
      "Textes alternatifs",
      imgs.length === 0 ? 2 : sansAlt === 0 ? 5 : 5 * (1 - sansAlt / imgs.length),
      5,
      imgs.length ? `${imgs.length - sansAlt}/${imgs.length} images d\xE9crites` : "aucune image",
      imgs.length === 0 ? "Ajoutez au moins une illustration." : "Chaque image doit avoir un attribut alt d\xE9crivant son contenu."
    )
  ] });
  const a = /* @__PURE__ */ __name2((re) => re.test(live), "a");
  F.push({ nom: "Technique", controles: [
    seoControle(
      "canonical",
      "URL canonique",
      a(/<link[^>]+rel=["']canonical/i) ? 3 : 0,
      3,
      live ? a(/<link[^>]+rel=["']canonical/i) ? "pr\xE9sente" : "absente" : "page non analys\xE9e",
      "Ajoutez une balise canonical pour \xE9viter le contenu dupliqu\xE9."
    ),
    seoControle(
      "og",
      "Partage sur les r\xE9seaux",
      (live.match(/property=["']og:(title|description|image)/gi) || []).length >= 3 ? 3 : 0,
      3,
      `${(live.match(/property=["']og:/gi) || []).length} balises Open Graph`,
      "Renseignez og:title, og:description et og:image."
    ),
    seoControle(
      "schema",
      "Donn\xE9es structur\xE9es",
      a(/"@type"\s*:\s*"(BlogPosting|Article|NewsArticle)"/) ? 3 : 0,
      3,
      a(/"@type"\s*:\s*"(BlogPosting|Article)"/) ? "sch\xE9ma Article pr\xE9sent" : "absent",
      "Ajoutez un JSON-LD de type Article : il ouvre l'acc\xE8s aux r\xE9sultats enrichis."
    ),
    seoControle(
      "indexable",
      "Indexation autoris\xE9e",
      a(/<meta[^>]+name=["']robots["'][^>]+noindex/i) ? 0 : 3,
      3,
      a(/noindex/i) ? "noindex d\xE9tect\xE9" : "indexable",
      "Une directive noindex emp\xEAche tout r\xE9f\xE9rencement de cette page."
    )
  ] });
  for (const f of F) {
    f.points = Math.round(f.controles.reduce((t, c) => t + c.points, 0) * 10) / 10;
    f.max = f.controles.reduce((t, c) => t + c.max, 0);
  }
  const score = Math.round(F.reduce((t, f) => t + f.points, 0));
  return {
    score,
    motCle,
    familles: F,
    aCorriger: F.flatMap((f) => f.controles).filter((c) => c.conseil).length
  };
}
__name(analyserSeo, "analyserSeo");
__name2(analyserSeo, "analyserSeo");
async function seoChargerPage(url) {
  if (!url) return "";
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "AdamEcom-SEO/1.0" },
      cf: { cacheTtl: 300 }
    });
    return res.ok ? await res.text() : "";
  } catch {
    return "";
  }
}
__name(seoChargerPage, "seoChargerPage");
__name2(seoChargerPage, "seoChargerPage");
async function seoAnalyserDossier(env, id) {
  const d = await env.DB.prepare("SELECT * FROM blog_dossiers WHERE id = ?").bind(id).first();
  if (!d) return { erreur: "Dossier introuvable." };
  const live = await seoChargerPage(d.url_publique);
  const r = analyserSeo(d, live);
  await env.DB.prepare(
    "UPDATE blog_dossiers SET score_seo=?, seo_detail=?, seo_analyse_le=? WHERE id=?"
  ).bind(r.score, JSON.stringify(r), (/* @__PURE__ */ new Date()).toISOString(), id).run();
  return { ok: true, ...r, pageAnalysee: Boolean(live) };
}
__name(seoAnalyserDossier, "seoAnalyserDossier");
__name2(seoAnalyserDossier, "seoAnalyserDossier");
var SEO_COULEUR = /* @__PURE__ */ __name2((n, max) => {
  const p = max ? n / max : 0;
  return p >= 0.9 ? "bon" : p >= 0.65 ? "moyen" : "mauvais";
}, "SEO_COULEUR");
function seoBloc(env, d, cle) {
  if (!d) return "";
  let r = null;
  try {
    r = d.seo_detail ? JSON.parse(d.seo_detail) : null;
  } catch {
    r = null;
  }
  const relancer = `<form method="POST" style="display:inline"
      action="?cle=${cle}&page=blog&action=seo_analyser&dossier=${encodeURIComponent(d.id)}">
      <button class="envoyer${r ? " discret" : ""}" type="submit">
        ${r ? "Relancer l'analyse" : "Analyser le r\xE9f\xE9rencement"}</button></form>`;
  if (!r) {
    return `<section><h2>Score SEO</h2>
      <div class="note">Cet article n'a pas encore \xE9t\xE9 analys\xE9.
        L'analyse lit le corps de l'article et, s'il est publi\xE9, la page en ligne.</div>
      <div class="actions">${relancer}</div></section>`;
  }
  const aCorriger = r.familles.flatMap((f) => f.controles).filter((c) => c.conseil);
  return `<section><h2>Score SEO</h2>
    <div class="grille">
      ${carteHtml(
    "Score global",
    r.score + "/100",
    r.score >= 90 ? "excellent" : r.score >= 75 ? "solide" : r.score >= 55 ? "\xE0 retravailler" : "insuffisant",
    r.score >= 90 ? "bon" : r.score >= 75 ? "bon" : r.score >= 55 ? "moyen" : "mauvais"
  )}
      ${carteHtml(
    "Points \xE0 corriger",
    String(aCorriger.length),
    aCorriger.length ? "d\xE9taill\xE9s ci-dessous" : "rien \xE0 signaler",
    aCorriger.length ? "moyen" : "bon"
  )}
      ${carteHtml(
    "Mot-cl\xE9 analys\xE9",
    echapper(r.motCle || "\u2014"),
    d.mot_cle ? "d\xE9fini par vous" : "d\xE9duit du slug"
  )}
      ${carteHtml("Derni\xE8re analyse", d.seo_analyse_le ? dateFr2(d.seo_analyse_le) : "\u2014", "")}
    </div>

    <div class="tw" style="margin-top:12px"><table>
      <thead><tr><th>Famille</th><th class="num">Points</th><th>D\xE9tail</th></tr></thead>
      <tbody>${r.familles.map((f) => `<tr>
        <td><b>${echapper(f.nom)}</b></td>
        <td class="num"><b>${f.points}</b>/${f.max}</td>
        <td>${pastille(SEO_COULEUR(f.points, f.max) === "bon" ? "conforme" : SEO_COULEUR(f.points, f.max) === "moyen" ? "\xE0 am\xE9liorer" : "insuffisant")}</td>
      </tr>`).join("")}</tbody>
    </table></div>

    ${aCorriger.length ? `<div style="margin-top:14px"><h2>Ce qu'il faut corriger</h2>
      <div class="taches">${aCorriger.sort((a, b) => b.max - b.points - (a.max - a.points)).map((c) => `<div class="tache">
          <div class="corps">
            <div class="t">${echapper(c.libelle)}
              <span class="sec" style="font-weight:400"> \u2014 ${echapper(String(c.constat))}</span></div>
            <div class="d">${echapper(c.conseil)}</div>
            <div class="meta">
              <span class="prio ${c.verdict === "moyen" ? "encours" : "haute"}">${c.verdict === "moyen" ? "\xE0 am\xE9liorer" : "\xE0 corriger"}</span>
              <span>${c.points} / ${c.max} points</span>
            </div>
          </div></div>`).join("")}</div></div>` : ""}

    <details style="margin-top:14px"><summary>Tous les contr\xF4les (${r.familles.reduce((t, f) => t + f.controles.length, 0)})</summary>
      <div class="dedans">${r.familles.map((f) => `
        <div><h2>${echapper(f.nom)}</h2>${tableauHtml(
    [{ nom: "Contr\xF4le" }, { nom: "Constat" }, { nom: "Points", classe: "num" }],
    f.controles.map((c) => `<tr>
            <td>${c.verdict === "bon" ? "\u2713" : c.verdict === "moyen" ? "~" : "\u2717"} ${echapper(c.libelle)}</td>
            <td><span class="sec">${echapper(String(c.constat))}</span></td>
            <td class="num">${c.points}/${c.max}</td></tr>`),
    "\u2014"
  )}</div>`).join("")}
      </div></details>

    <form class="f rapide" method="POST" style="margin-top:14px"
      action="?cle=${cle}&page=blog&action=seo_motcle&dossier=${encodeURIComponent(d.id)}">
      <label class="large">Mot-cl\xE9 principal
        <input name="mot_cle" value="${echapper(d.mot_cle || "")}"
          placeholder="${echapper(r.motCle || "")}"></label>
      <button class="envoyer" type="submit">D\xE9finir et r\xE9analyser</button>
    </form>
    <p class="sec" style="margin:6px 0 0">Sans mot-cl\xE9 d\xE9fini, il est d\xE9duit du slug \u2014
      ce qui donne une cible plus longue que ce qu'un titre peut contenir.</p>

    <div class="actions" style="margin-top:12px">${relancer}</div>
  </section>`;
}
__name(seoBloc, "seoBloc");
__name2(seoBloc, "seoBloc");
var SEO_BLOG_BASE = "https://adam-ecom.com/blogs/actualites";
async function seoDecouvrirArticles() {
  const out = [];
  try {
    const res = await fetch(SEO_BLOG_BASE, { headers: { "user-agent": "AdamEcom-SEO/1.0" } });
    if (!res.ok) return out;
    const h = await res.text();
    const vus = /* @__PURE__ */ new Set();
    for (const m of h.matchAll(/\/blogs\/actualites\/([a-z0-9][a-z0-9-]{4,})/gi)) {
      const handle = m[1].toLowerCase();
      if (!vus.has(handle)) {
        vus.add(handle);
        out.push(handle);
      }
    }
  } catch {
  }
  return out.sort();
}
__name(seoDecouvrirArticles, "seoDecouvrirArticles");
__name2(seoDecouvrirArticles, "seoDecouvrirArticles");
function seoCorpsArticle(html) {
  const ouvertures = [...html.matchAll(/<article[\s>]/gi)].map((m) => m.index);
  const fermetures = [...html.matchAll(/<\/article>/gi)].map((m) => m.index + m[0].length);
  let meilleur = "";
  for (const o of ouvertures) {
    const f = fermetures.find((x) => x > o) ?? html.length;
    const bloc = html.slice(o, f);
    if (bloc.length > meilleur.length) meilleur = bloc;
  }
  return meilleur || html;
}
__name(seoCorpsArticle, "seoCorpsArticle");
__name2(seoCorpsArticle, "seoCorpsArticle");
var seoAttribut = /* @__PURE__ */ __name2((html, re) => {
  const m = html.match(re);
  return m ? m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() : "";
}, "seoAttribut");
async function seoAnalyserArticle(env, handle) {
  const url = `${SEO_BLOG_BASE}/${handle}`;
  try {
    const res = await fetch(url, { headers: { "user-agent": "AdamEcom-SEO/1.0" } });
    if (!res.ok) throw new Error(`la page r\xE9pond ${res.status}`);
    const live = await res.text();
    const corps = seoCorpsArticle(live);
    const faux = {
      id: handle,
      handle,
      titre: seoAttribut(live, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i) || seoAttribut(live, /<title[^>]*>([\s\S]*?)<\/title>/i),
      seo_title: seoAttribut(live, /<title[^>]*>([\s\S]*?)<\/title>/i),
      meta_description: seoAttribut(live, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i),
      image_url: seoAttribut(live, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i),
      alt_image: seoAttribut(corps, /<img[^>]+alt=["']([^"']+)["']/i),
      html: corps,
      mot_cle: null
    };
    try {
      const d = await env.DB.prepare("SELECT mot_cle FROM blog_dossiers WHERE handle = ? AND mot_cle IS NOT NULL").bind(handle).first();
      if (d?.mot_cle) faux.mot_cle = d.mot_cle;
    } catch {
    }
    const r = analyserSeo(faux, live);
    const mots = sansBalises(corps).split(/\s+/).filter(Boolean).length;
    await env.DB.prepare(
      `INSERT OR REPLACE INTO blog_seo (handle, titre, url, score, a_corriger, mots, detail, erreur, analyse_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`
    ).bind(handle, faux.titre, url, r.score, r.aCorriger, mots, JSON.stringify(r), (/* @__PURE__ */ new Date()).toISOString()).run();
    return { ok: true, handle, score: r.score };
  } catch (e) {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO blog_seo (handle, titre, url, score, a_corriger, mots, detail, erreur, analyse_le)
       VALUES (?, COALESCE((SELECT titre FROM blog_seo WHERE handle=?), ?), ?, NULL, NULL, NULL, NULL, ?, ?)`
    ).bind(handle, handle, handle, url, String(e.message).slice(0, 200), (/* @__PURE__ */ new Date()).toISOString()).run();
    return { erreur: e.message, handle };
  }
}
__name(seoAnalyserArticle, "seoAnalyserArticle");
__name2(seoAnalyserArticle, "seoAnalyserArticle");
async function seoAnalyserBlog(env) {
  const handles = await seoDecouvrirArticles();
  if (!handles.length) return { erreur: "Aucun article trouv\xE9 sur le blog." };
  let ok = 0, ko = 0;
  for (const h of handles) {
    const r = await seoAnalyserArticle(env, h);
    if (r.ok) ok++;
    else ko++;
  }
  return { ok, ko, total: handles.length };
}
__name(seoAnalyserBlog, "seoAnalyserBlog");
__name2(seoAnalyserBlog, "seoAnalyserBlog");
var seoTeinte = /* @__PURE__ */ __name2((s) => s === null || s === void 0 ? "gris" : s >= 90 ? "vert" : s >= 75 ? "vert" : s >= 55 ? "jaune" : "rouge", "seoTeinte");
function seoFenetre(a) {
  let r = null;
  try {
    r = a.detail ? JSON.parse(a.detail) : null;
  } catch {
    r = null;
  }
  if (!r) return "";
  const aCorriger = r.familles.flatMap((f) => f.controles).filter((c) => c.conseil).sort((x, y) => y.max - y.points - (x.max - x.points));
  return `<dialog id="seo-${echapper(a.handle)}" class="fenetre">
    <div class="fenetre-tete">
      <div>
        <div class="k">Score SEO \xB7 ${a.score}/100</div>
        <b>${echapper(a.titre || a.handle)}</b>
      </div>
      <button class="fermer" onclick="this.closest('dialog').close()" aria-label="Fermer">\xD7</button>
    </div>
    <div class="fenetre-corps">
      <div class="grille">
        ${r.familles.map((f) => carteHtml(
    f.nom,
    f.points + "/" + f.max,
    "",
    f.points / f.max >= 0.9 ? "bon" : f.points / f.max >= 0.65 ? "moyen" : "mauvais"
  )).join("")}
      </div>

      ${aCorriger.length ? `<h2 style="margin-top:20px">\xC0 am\xE9liorer \u2014 ${aCorriger.length} point(s)</h2>
      <div class="taches">${aCorriger.map((c) => `<div class="tache">
        <div class="corps">
          <div class="t">${echapper(c.libelle)}
            <span class="sec" style="font-weight:400"> \u2014 ${echapper(String(c.constat))}</span></div>
          <div class="d">${echapper(c.conseil)}</div>
          <div class="meta">
            <span class="prio ${c.verdict === "moyen" ? "encours" : "haute"}">${c.verdict === "moyen" ? "\xE0 am\xE9liorer" : "\xE0 corriger"}</span>
            <span>${c.points} / ${c.max} points</span>
            <span>gain possible : +${Math.round((c.max - c.points) * 10) / 10}</span>
          </div>
        </div></div>`).join("")}</div>` : `<div class="reussite" style="margin-top:18px">Rien \xE0 corriger sur cet article.</div>`}

      <details style="margin-top:18px"><summary>Tous les contr\xF4les</summary>
        <div class="dedans">${r.familles.map((f) => `<div>
          <h2>${echapper(f.nom)} <span class="sec" style="letter-spacing:0">${f.points}/${f.max}</span></h2>
          <div class="tw"><table><tbody>${f.controles.map((c) => `<tr>
            <td>${c.verdict === "bon" ? "\u2713" : c.verdict === "moyen" ? "~" : "\u2717"} ${echapper(c.libelle)}</td>
            <td><span class="sec">${echapper(String(c.constat))}</span></td>
            <td class="num">${c.points}/${c.max}</td></tr>`).join("")}</tbody></table></div></div>`).join("")}
        </div></details>

      <div class="actions" style="margin-top:18px">
        <a class="bouton pale" href="${echapper(a.url)}" target="_blank" rel="noreferrer noopener">Ouvrir l'article</a>
        <span class="sec">mot-cl\xE9 analys\xE9 : ${echapper(r.motCle || "\u2014")} \xB7 ${a.mots ?? "?"} mots</span>
      </div>
    </div>
  </dialog>`;
}
__name(seoFenetre, "seoFenetre");
__name2(seoFenetre, "seoFenetre");
async function seoBlocBlog(env, cle) {
  const articles = await tous2(
    env.DB,
    "SELECT * FROM blog_seo ORDER BY score IS NULL, score ASC, handle"
  );
  const notes = articles.filter((a) => a.score !== null);
  const moyenne = notes.length ? Math.round(notes.reduce((t, a) => t + a.score, 0) / notes.length) : null;
  const faibles = notes.filter((a) => a.score < 75).length;
  const corriger = notes.reduce((t, a) => t + (a.a_corriger || 0), 0);
  const lancer2 = `<form method="POST" style="display:inline" action="?cle=${cle}&page=blog&action=seo_blog">
    <button class="envoyer${articles.length ? " discret" : ""}" type="submit">
      ${articles.length ? "R\xE9analyser tout le blog" : "Analyser tout le blog"}</button></form>`;
  if (!articles.length) {
    return `<section><h2>Score SEO de mes articles</h2>
      <div class="note">Aucun article analys\xE9 pour l'instant. L'analyse parcourt votre blog,
        lit chaque article publi\xE9 et le note sur 100.</div>
      <div class="actions">${lancer2}</div></section>`;
  }
  return `<section><h2>Score SEO de mes articles</h2>
    <div class="grille">
      ${carteHtml(
    "Articles analys\xE9s",
    String(articles.length),
    articles.length - notes.length ? `${articles.length - notes.length} en \xE9chec` : "tous lus"
  )}
      ${carteHtml(
    "Score moyen",
    moyenne === null ? "\u2014" : moyenne + "/100",
    "sur l'ensemble du blog",
    moyenne === null ? "neutre" : moyenne >= 80 ? "bon" : moyenne >= 65 ? "moyen" : "mauvais"
  )}
      ${carteHtml("Sous 75/100", String(faibles), "articles \xE0 retravailler", faibles ? "moyen" : "bon")}
      ${carteHtml("Corrections possibles", String(corriger), "tous articles confondus")}
    </div>

    <div class="actions" style="margin:12px 0">${lancer2}
      <span class="sec">class\xE9s du moins bon au meilleur</span></div>

    ${tableauHtml(
    [
      { nom: "Article" },
      { nom: "Mots", classe: "num" },
      { nom: "Score", classe: "num" },
      { nom: "\xC0 corriger", classe: "num" },
      { nom: "" }
    ],
    articles.map((a) => `<tr>
        <td><b>${echapper(a.titre || a.handle)}</b><br>
          <span class="sec">${echapper(a.handle)}</span></td>
        <td class="num">${a.mots ?? "\u2014"}</td>
        <td class="num">${a.erreur ? `<span class="p p-gris">\xE9chec</span>` : `<span class="p p-${seoTeinte(a.score)}">${a.score}/100</span>`}</td>
        <td class="num">${a.a_corriger ?? "\u2014"}</td>
        <td class="nowrap">${a.erreur ? `<span class="sec">${echapper(a.erreur).slice(0, 40)}</span>` : `<button class="bouton" onclick="document.getElementById('seo-${echapper(a.handle)}').showModal()">Voir</button>`}</td>
      </tr>`),
    "Aucun article.",
    "tab-seo-articles"
  )}
    ${articles.filter((a) => a.detail).map(seoFenetre).join("")}
  </section>`;
}
__name(seoBlocBlog, "seoBlocBlog");
__name2(seoBlocBlog, "seoBlocBlog");
async function pageBlog(env, url, message = "") {
  const db = env.DB;
  await assurerBlogSchema(db);
  await assurerGeminiSchema(db);
  await assurerBlogRedactionSchema(db);
  const [configuration] = await tous2(db, "SELECT * FROM blog_config WHERE id=1");
  const dossiers = await tous2(db, "SELECT id,titre,handle,statut,revision,slack_thread_ts,image_ok,html_ok,validation_texte,article_shopify_id,url_publique,message,seo_title,meta_description,resume,auteur,tags,alt_image,image_url,image_mime,image_nom,cree_le,maj_le FROM blog_dossiers ORDER BY maj_le DESC LIMIT 40");
  const recherchesGemini = await tous2(db, "SELECT id,sujet,modele,statut,resultat_json,erreur,cree_le,maj_le FROM gemini_recherches ORDER BY maj_le DESC LIMIT 10");
  const rechercheGemini = recherchesGemini[0] || null;
  let briefGemini = null;
  if (rechercheGemini?.resultat_json) {
    try {
      briefGemini = JSON.parse(rechercheGemini.resultat_json);
    } catch {
      briefGemini = null;
    }
  }
  const choisi = dossiers.find((d) => d.id === url.searchParams.get("dossier")) || dossiers[0];
  const [courant] = choisi ? await tous2(
    db,
    "SELECT id,titre,handle,statut,revision,slack_thread_ts,image_ok,html_ok,validation_texte,article_shopify_id,url_publique,message,seo_title,meta_description,resume,auteur,tags,alt_image,html,image_url,image_base64,image_mime,image_nom,cree_le,maj_le FROM blog_dossiers WHERE id=?",
    choisi.id
  ) : [];
  const enAttente = dossiers.filter((d) => ["preparation", "pret_validation", "valide", "publication", "erreur"].includes(d.statut));
  const cfg = configuration || {
    actif: 1,
    heure_generation: "08:00",
    frequence_validation: "5 minutes",
    canal_slack: "Application AdamEcom",
    boutique: "adam-ecom.com",
    blog: "Actualit\xE9s",
    handle_blog: "actualites",
    auteur: "Adam Ecom",
    validation_format: "BOUTON DE VALIDATION",
    prompt_image: PROMPT_IMAGE_BLOG
  };
  const etat = /* @__PURE__ */ __name22((statut) => {
    const libelles = {
      preparation: "en pr\xE9paration",
      pret_validation: "pr\xEAt pour validation",
      valide: "valid\xE9",
      publication: "publication en cours",
      publie: "publi\xE9",
      erreur: "erreur"
    };
    const classe = statut === "publie" ? "p-vert" : statut === "erreur" ? "p-rouge" : ["pret_validation", "valide", "publication"].includes(statut) ? "p-jaune" : "p-gris";
    return `<span class="p ${classe}">${echapper(libelles[statut] || statut || "inconnu")}</span>`;
  }, "etatBlog");
  const prompt = cfg.prompt_image || PROMPT_IMAGE_BLOG;
  const cle = encodeURIComponent(env.CLE_TEST);
  const peutValider = courant?.statut === "pret_validation" && Number(courant.html_ok) === 1 && Number(courant.image_ok) === 1;
  const validationDirecte = courant?.statut === "valide" || courant?.statut === "publication";
  const sourceImage = courant?.image_base64 ? `data:${courant.image_mime || "image/png"};base64,${courant.image_base64.replace(/\s/g, "")}` : courant?.image_url || null;
  const apercuArticle = courant?.html ? `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{font-family:Arial,sans-serif;line-height:1.65;color:#172030;max-width:820px;margin:0 auto;padding:28px}h1,h2,h3{line-height:1.2}img{max-width:100%}a{color:#166534}</style></head><body>${courant.html}</body></html>` : null;
  const liensSourcesGemini = Array.isArray(briefGemini?.sources) ? briefGemini.sources.map((source) => {
    const adresse = String(source?.url || "").trim();
    const lien = /^https:\/\//i.test(adresse) ? `<a href="${echapper(adresse)}" target="_blank" rel="noopener noreferrer">${echapper(source?.titre || adresse)}</a>` : echapper(source?.titre || adresse || "Source");
    return `<li>${lien}${source?.apport ? ` \u2014 ${echapper(source.apport)}` : ""}</li>`;
  }).join("") : "";
  return `
  ${message || ""}
  <section><div class="grille">
    <div class="carte ${Number(cfg.actif) ? "bon" : "mauvais"}"><div class="k">Cr\xE9ation SEO</div>
      <div class="v txt">${Number(cfg.actif) ? "active" : "arr\xEAt\xE9e"}</div><div class="s">un article r\xE9dig\xE9 par l'app chaque jour \xE0 ${echapper(cfg.heure_generation || "08:00")}</div></div>
    <div class="carte bon"><div class="k">Validation</div><div class="v txt">dans l\u2019application</div>
      <div class="s">bouton s\xE9curis\xE9 sur le dossier courant</div></div>
    <div class="carte moyen"><div class="k">Publication Shopify</div><div class="v txt">automatique</div>
      <div class="s">uniquement apr\xE8s votre clic de validation</div></div>
    <div class="carte ${courant?.statut === "publie" ? "bon" : courant?.statut === "erreur" ? "mauvais" : "moyen"}">
      <div class="k">Dossier actuel</div><div class="v txt">${courant ? etat(courant.statut) : "aucun dossier"}</div>
      <div class="s">${courant ? `${echapper(courant.id)} \xB7 ${depuis(courant.maj_le)}` : "\u2014"}</div></div>
  </div></section>

  <section><h2>Articles \xE0 relire</h2>
  <form method="POST" action="?cle=${cle}&page=blog&action=rediger_blog" style="margin-bottom:12px">
    <button class="envoyer" type="submit" onclick="this.disabled=true;this.textContent='R\xE9daction lanc\xE9e\u2026';this.form.submit()">R\xE9diger un article maintenant</button>
    <span class="sec" style="margin-left:8px">En plus de l'article automatique du jour.</span>
  </form>
  ${enAttente.length ? tableauHtml(
    [{ nom: "Article" }, { nom: "Statut" }, { nom: "Cr\xE9\xE9", classe: "nowrap" }, { nom: "" }],
    enAttente.map((d) => `<tr${courant?.id === d.id ? ' style="background:#f0fdf4"' : ""}><td>${echapper(d.titre)}<br><span class="sec">${echapper(d.message || "")}</span></td><td>${etat(d.statut)}</td>
      <td class="nowrap">${dateFr2(d.cree_le)}</td><td>${courant?.id === d.id ? '<span class="sec">affich\xE9 ci-dessous</span>' : `<a class="bouton" href="?cle=${cle}&page=blog&dossier=${encodeURIComponent(d.id)}">Ouvrir</a>`}</td></tr>`),
    ""
  ) : '<div class="note">Aucun article en attente. Le prochain sera r\xE9dig\xE9 automatiquement.</div>'}</section>

  <section><h2>Recherche Gemini SEO</h2><div class="grille">
    <div class="carte ${env.GEMINI_API_KEY ? "bon" : "mauvais"}"><div class="k">Connexion Gemini</div>
      <div class="v txt">${env.GEMINI_API_KEY ? "connect\xE9e" : "non configur\xE9e"}</div>
      <div class="s">secret chiffr\xE9 dans Cloudflare</div></div>
    <div class="carte ${rechercheGemini?.statut === "terminee" ? "bon" : rechercheGemini?.statut === "erreur" ? "mauvais" : "neutre"}"><div class="k">Derni\xE8re recherche</div>
      <div class="v txt">${rechercheGemini ? echapper(rechercheGemini.statut) : "aucune"}</div>
      <div class="s">${rechercheGemini ? `${echapper(rechercheGemini.modele)} \xB7 ${depuis(rechercheGemini.maj_le)}` : "lancez un premier brief"}</div></div>
  </div>
  <div class="note" style="margin:14px 0">Gemini analyse uniquement des informations publiques (Google et le blog AdamEcom). Les prospects, emails, factures, statistiques priv\xE9es et cl\xE9s d'acc\xE8s ne lui sont jamais transmis. Le brief n'autorise aucune publication Shopify.</div>
  <form method="POST" action="?cle=${cle}&page=blog&action=recherche_gemini" class="formulaire">
    <label class="large">Sujet \xE0 analyser
      <input name="sujet" required minlength="5" maxlength="240" placeholder="Ex. Optimiser une fiche produit Shopify pour convertir davantage"></label>
    <button class="envoyer large" type="submit">Lancer la recherche SEO avec Gemini</button>
  </form>
  ${rechercheGemini?.statut === "erreur" ? `<div class="alerte" style="margin-top:14px"><b>Recherche Gemini en erreur :</b> ${echapper(rechercheGemini.erreur || "Erreur inconnue")}</div>` : ""}
  ${briefGemini ? `<div style="margin-top:18px"><h3>${echapper(briefGemini.titre_recommande || rechercheGemini.sujet)}</h3><div class="tw"><table><tbody>
    <tr><th>Sujet</th><td>${echapper(briefGemini.sujet || rechercheGemini.sujet)}</td></tr>
    <tr><th>Intention</th><td>${echapper(briefGemini.intention_recherche || "\u2014")}</td></tr>
    <tr><th>Mot-cl\xE9 principal</th><td>${echapper(briefGemini.mot_cle_principal || "\u2014")}</td></tr>
    <tr><th>Mots-cl\xE9s secondaires</th><td>${echapper((briefGemini.mots_cles_secondaires || []).join(", ") || "\u2014")}</td></tr>
    <tr><th>Angle recommand\xE9</th><td>${echapper(briefGemini.angle_recommande || "\u2014")}</td></tr>
    <tr><th>Plan H2</th><td><ol>${(briefGemini.plan_h2 || []).map((titre) => `<li>${echapper(titre)}</li>`).join("")}</ol></td></tr>
    <tr><th>Questions des lecteurs</th><td><ul>${(briefGemini.questions_utilisateurs || []).map((question) => `<li>${echapper(question)}</li>`).join("")}</ul></td></tr>
    <tr><th>Sources consult\xE9es</th><td>${liensSourcesGemini ? `<ul>${liensSourcesGemini}</ul>` : "\u2014"}</td></tr>
  </tbody></table></div></div>` : ""}</section>

  ${courant ? `<section><h2>Dossier en cours</h2><div class="grille">
    <div class="carte neutre"><div class="k">Article</div><div class="v txt">${echapper(courant.titre)}</div>
      <div class="s">/${echapper(courant.handle || "\u2014")} \xB7 r\xE9vision ${courant.revision || 1}</div></div>
    <div class="carte ${courant.html_ok ? "bon" : "moyen"}"><div class="k">Dossier</div><div class="v txt">HTML ${courant.html_ok ? "pr\xEAt" : "\xE0 contr\xF4ler"}</div>
      <div class="s">image 16:9 ${courant.image_ok ? "contr\xF4l\xE9e" : "\xE0 contr\xF4ler"}</div></div>
    <div class="carte ${courant.statut === "publie" || validationDirecte ? "bon" : peutValider ? "moyen" : "neutre"}"><div class="k">Validation</div>
      <div class="v txt">${courant.statut === "publie" ? "article publi\xE9" : validationDirecte ? "validation enregistr\xE9e" : peutValider ? "votre accord est requis" : "dossier incomplet"}</div>
      <div class="s">${validationDirecte ? "la publication peut maintenant d\xE9marrer" : peutValider ? "utilisez le bouton ci-dessous" : courant.statut === "publie" ? "termin\xE9" : "HTML et image doivent \xEAtre contr\xF4l\xE9s"}</div></div>
    <div class="carte ${courant.url_publique ? "bon" : "neutre"}"><div class="k">Publication</div>
      <div class="v txt">${courant.url_publique ? "en ligne" : "non publi\xE9"}</div>
      <div class="s">${courant.url_publique ? `<a href="${echapper(courant.url_publique)}" target="_blank" rel="noopener">ouvrir l\u2019article</a>` : "attend la validation"}</div></div>
  </div>${courant.message ? `<div class="note" style="margin-top:12px">${echapper(courant.message)}</div>` : ""}
  ${peutValider ? `<form method="POST" action="?cle=${cle}&page=blog&action=valider_blog" style="margin-top:16px">
    <input type="hidden" name="id" value="${echapper(courant.id)}">
    <input type="hidden" name="revision" value="${Number(courant.revision) || 1}">
    <button class="envoyer" type="submit" onclick="return confirm('Valider cet article et autoriser sa publication sur Shopify ?')">
      Valider et publier sur Shopify</button>
  </form>` : ""}
  ${courant.statut === "erreur" ? `<form method="POST" action="?cle=${cle}&page=blog&action=relancer_blog" style="margin-top:12px;display:inline-block">
    <input type="hidden" name="id" value="${echapper(courant.id)}"><button class="envoyer" type="submit">Relancer</button></form>` : ""}
  ${["preparation", "pret_validation", "erreur"].includes(courant.statut) && !courant.article_shopify_id ? `<form method="POST" action="?cle=${cle}&page=blog&action=supprimer_blog" style="margin:12px 0 0 8px;display:inline-block">
    <input type="hidden" name="id" value="${echapper(courant.id)}"><button class="envoyer discret" type="submit" onclick="return confirm('Supprimer d\xE9finitivement ce dossier ? Il ne sera pas publi\xE9.')">Supprimer ce dossier</button></form>` : ""}</section>` : ""}

  ${courant && (courant.seo_title || courant.meta_description || courant.resume || courant.tags) ? `<section><h2>Dossier SEO</h2><div class="tw"><table><tbody>
    <tr><th>Titre SEO</th><td>${echapper(courant.seo_title || courant.titre)}</td></tr>
    <tr><th>M\xE9ta-description</th><td>${echapper(courant.meta_description || "\u2014")}</td></tr>
    <tr><th>R\xE9sum\xE9</th><td>${echapper(courant.resume || "\u2014")}</td></tr>
    <tr><th>Auteur</th><td>${echapper(courant.auteur || "Adam Ecom")}</td></tr>
    <tr><th>Tags</th><td>${echapper(courant.tags || "\u2014")}</td></tr>
  </tbody></table></div></section>` : ""}

  ${sourceImage ? `<section><h2>Couverture 16:9</h2><div class="apercu" style="padding:0;overflow:hidden">
    <img src="${echapper(sourceImage)}" alt="${echapper(courant.alt_image || courant.titre)}" style="display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover">
  </div></section>` : ""}

  ${apercuArticle ? `<section><h2>Aper\xE7u de l\u2019article</h2><div class="apercu" style="padding:0">
    <iframe sandbox style="height:760px" srcdoc="${echapper(apercuArticle)}" title="Aper\xE7u de l\u2019article ${echapper(courant.titre)}"></iframe>
  </div></section>` : ""}

  <section><h2>Configuration verrouill\xE9e</h2><div class="tw"><table><tbody>
    <tr><th>Boutique</th><td><b>${echapper(cfg.boutique || "adam-ecom.com")}</b></td></tr>
    <tr><th>Blog Shopify</th><td>${echapper(cfg.blog || "Actualit\xE9s")} <span class="sec">(${echapper(cfg.handle_blog || "actualites")})</span></td></tr>
    <tr><th>Auteur</th><td>${echapper(cfg.auteur || "Adam Ecom")}</td></tr>
    <tr><th>Lieu de validation</th><td><b>Application AdamEcom uniquement</b></td></tr>
    <tr><th>Action requise</th><td>Clic sur \xAB Valider et publier sur Shopify \xBB dans le dossier choisi.</td></tr>
    <tr><th>S\xE9curit\xE9</th><td>Aucun article n\u2019est publi\xE9 sans ce clic explicite, contr\xF4le anti-doublon et v\xE9rification de l\u2019URL publique.</td></tr>
  </tbody></table></div></section>

  ${await seoBlocBlog(env, cle)}

  ${seoBloc(env, courant, cle)}

  <section><h2>Historique des dossiers</h2>${tableauHtml(
    [{ nom: "Dossier" }, { nom: "Article" }, { nom: "Statut" }, { nom: "Mise \xE0 jour", classe: "nowrap" }, { nom: "Lien" }],
    dossiers.map((d) => `<tr><td class="nowrap"><b>${echapper(d.id)}</b><br><span class="sec">r\xE9vision ${d.revision || 1}</span></td>
      <td>${echapper(d.titre)}<br><span class="sec">${echapper(d.handle || "")}</span></td><td>${etat(d.statut)}</td>
      <td class="nowrap">${dateFr2(d.maj_le)}</td><td>${d.url_publique ? `<a class="bouton" href="${echapper(d.url_publique)}" target="_blank" rel="noopener">Voir en ligne</a>` : `<a class="bouton" href="?cle=${cle}&page=blog&dossier=${encodeURIComponent(d.id)}">Ouvrir</a>`}</td></tr>`),
    "Aucun dossier SEO enregistr\xE9."
  )}</section>

  <section><h2>Prompt image obligatoire</h2><div class="note" style="margin-bottom:12px">
    Ce prompt est conserv\xE9 \xE0 l\u2019identique. Seul le sujet plac\xE9 entre crochets est remplac\xE9 par le titre du blog.</div>
    <pre class="bloc-code">${echapper(prompt)}</pre></section>

  <section><h2>Appels \xE0 l'action obligatoires</h2><div class="tw"><table><tbody>
    <tr><th>Offre Shopify</th><td>Le bloc d'affiliation \xAB 1 $US/mois \xBB est ajout\xE9 automatiquement avec le lien sponsoris\xE9.</td></tr>
    <tr><th>Appel de qualification</th><td>Le bloc \xAB Votre boutique a du trafic. Elle n'a pas assez de ventes. \xBB renvoie automatiquement vers votre page de r\xE9servation.</td></tr>
    <tr><th>Format</th><td>HTML sans CSS, compatible avec le blog Shopify.</td></tr>
  </tbody></table></div></section>`;
}
__name(pageBlog, "pageBlog");
__name2(pageBlog, "pageBlog");
__name22(pageBlog, "pageBlog");
async function assurerProspectsSchema(db) {
  const colonnes = new Set((await tous2(db, "PRAGMA table_info(reservations)")).map((c) => c.name));
  const ajouts = [
    ["decision", "TEXT NOT NULL DEFAULT 'a_traiter'"],
    ["decision_le", "TEXT"],
    ["meeting_id", "INTEGER"],
    ["proposition_debut", "TEXT"],
    ["message_decision", "TEXT"]
  ];
  for (const [nom, type] of ajouts) {
    if (!colonnes.has(nom)) await db.prepare(`ALTER TABLE reservations ADD COLUMN ${nom} ${type}`).run();
  }
  await db.prepare("UPDATE reservations SET decision='a_traiter' WHERE decision IS NULL OR decision=''").run();
}
__name(assurerProspectsSchema, "assurerProspectsSchema");
__name2(assurerProspectsSchema, "assurerProspectsSchema");
__name22(assurerProspectsSchema, "assurerProspectsSchema");
async function lireProspect(db, uri) {
  await assurerProspectsSchema(db);
  return db.prepare("SELECT * FROM reservations WHERE uri=?").bind(uri).first();
}
__name(lireProspect, "lireProspect");
__name2(lireProspect, "lireProspect");
__name22(lireProspect, "lireProspect");
async function accepterProspect(env, uri) {
  const r = await lireProspect(env.DB, uri);
  if (!r) return { erreur: "Prospect introuvable." };
  if (!r.email?.includes("@")) return { erreur: "Ce prospect n'a pas d'adresse email valide." };
  if (new Date(r.debut).getTime() <= Date.now()) return { erreur: "Le cr\xE9neau r\xE9serv\xE9 est d\xE9j\xE0 pass\xE9. Proposez un autre cr\xE9neau." };
  if (r.decision === "accepte" && r.meeting_id) return { ok: true, id: r.meeting_id, deja: true };
  const google = await etatGoogle(env.DB);
  if (!google.connecte) return { erreur: "Connectez Google dans la page Google & SEO avant d'accepter ce prospect." };
  let meetingId = Number(r.meeting_id || 0);
  if (!meetingId) {
    const cree = await env.DB.prepare(`INSERT INTO meetings
      (client_nom,client_email,sujet,note,debut,duree_min,fuseau,lien_meet,statut,jeton,cree_le)
      VALUES (?,?,?,?,?,45,?,'','brouillon',?,?)`).bind(
      r.nom || r.email,
      r.email,
      `Appel de qualification \u2014 ${r.nom || "Prospect"}`,
      `Demande Calendly : ${r.titre || "Appel de qualification"}`,
      r.debut,
      r.fuseau || "Africa/Casablanca",
      jetonAleatoire(),
      (/* @__PURE__ */ new Date()).toISOString()
    ).run();
    meetingId = Number(cree.meta.last_row_id);
    await env.DB.prepare(`UPDATE reservations SET decision='acceptation_en_cours',meeting_id=?,decision_le=?,message_decision=NULL WHERE uri=?`).bind(meetingId, (/* @__PURE__ */ new Date()).toISOString(), uri).run();
  }
  const meeting = await lireMeeting(env.DB, meetingId);
  if (!meeting) return { erreur: "Le rendez-vous li\xE9 au prospect est introuvable." };
  if (!meeting.google_event_id) {
    try {
      const ev = await creerEvenement(env, meeting);
      await env.DB.prepare("UPDATE meetings SET lien_meet=?,google_event_id=?,google_lien=? WHERE id=?").bind(ev.lien, ev.id, ev.lienAgenda, meetingId).run();
    } catch (e) {
      await env.DB.prepare("UPDATE reservations SET decision='erreur',message_decision=? WHERE uri=?").bind(`Google : ${e.message}`.slice(0, 500), uri).run();
      return { erreur: `Google n'a pas pu g\xE9n\xE9rer le rendez-vous : ${e.message}` };
    }
  }
  const meetingFinal = await lireMeeting(env.DB, meetingId);
  if (meetingFinal.statut !== "envoy\xE9") {
    const envoi = await envoyerInvitation(env, meetingId);
    if (envoi.erreur) {
      await env.DB.prepare("UPDATE reservations SET decision='erreur',message_decision=? WHERE uri=?").bind(envoi.erreur.slice(0, 500), uri).run();
      return { erreur: envoi.erreur };
    }
  }
  await env.DB.prepare(`UPDATE reservations
    SET decision='accepte',decision_le=?,message_decision='Invitation Google Meet envoy\xE9e' WHERE uri=?`).bind((/* @__PURE__ */ new Date()).toISOString(), uri).run();
  return { ok: true, id: meetingId };
}
__name(accepterProspect, "accepterProspect");
__name2(accepterProspect, "accepterProspect");
__name22(accepterProspect, "accepterProspect");
async function refuserProspect(env, uri) {
  const r = await lireProspect(env.DB, uri);
  if (!r) return { erreur: "Prospect introuvable." };
  if (r.decision === "accepte") return { erreur: "Ce prospect a d\xE9j\xE0 re\xE7u son invitation. Annulez plut\xF4t le rendez-vous." };
  await env.DB.prepare(`UPDATE reservations
    SET decision='refuse',decision_le=?,message_decision='Refus enregistr\xE9 dans l\u2019application' WHERE uri=?`).bind((/* @__PURE__ */ new Date()).toISOString(), uri).run();
  return { ok: true };
}
__name(refuserProspect, "refuserProspect");
__name2(refuserProspect, "refuserProspect");
__name22(refuserProspect, "refuserProspect");
async function proposerCreneauProspect(env, uri, form) {
  const r = await lireProspect(env.DB, uri);
  if (!r) return { erreur: "Prospect introuvable." };
  const valeur = String(form.get("nouveau_creneau") || "").trim();
  const fuseau = String(form.get("fuseau") || r.fuseau || "Africa/Casablanca").trim();
  const m = valeur.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
  if (!m) return { erreur: "Choisissez une date et une heure valides." };
  const debut = versUtc(m[1], m[2], fuseau);
  if (!debut || new Date(debut).getTime() <= Date.now()) return { erreur: "Le nouveau cr\xE9neau doit \xEAtre dans le futur." };
  const quand = quandFr(debut, fuseau);
  try {
    await envoyerEmail(env, {
      de: env.SENDER_EMAIL,
      deNom: env.SENDER_NAME || "AdamEcom",
      a: r.email,
      aNom: r.nom,
      objet: await objetEmail(
        env,
        "creneau_proposition",
        "Proposition d'un nouveau cr\xE9neau \u2014 AdamEcom",
        { nom: r.nom }
      ),
      repondreA: { email: env.SENDER_EMAIL, name: env.SENDER_NAME || "AdamEcom" },
      html: `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#1B1B1B;max-width:580px">
        <p>Bonjour ${echapper(r.nom || "")},</p>
        <p>Merci pour votre demande d'appel. Je vous propose le cr\xE9neau suivant :</p>
        <p style="font-size:18px"><b>${echapper(quand)}</b></p>
        <p>Si ce cr\xE9neau vous convient, r\xE9pondez simplement \xE0 cet email. Sinon, vous pouvez choisir un autre horaire :</p>
        <p><a href="${LIEN_APPEL_QUALIFICATION}" style="display:inline-block;background:#1B1B1B;color:#fff;padding:13px 22px;border-radius:7px;text-decoration:none;font-weight:700">Choisir un autre cr\xE9neau</a></p>
        <p>\xC0 bient\xF4t,<br><b>Adam \u2014 AdamEcom</b></p></div>`
    });
  } catch (e) {
    return { erreur: `L'email n'a pas pu \xEAtre envoy\xE9 : ${e.message}` };
  }
  await env.DB.prepare(`UPDATE reservations
    SET decision='creneau_propose',proposition_debut=?,decision_le=?,message_decision=? WHERE uri=?`).bind(debut, (/* @__PURE__ */ new Date()).toISOString(), `Cr\xE9neau propos\xE9 : ${quand}`, uri).run();
  return { ok: true };
}
__name(proposerCreneauProspect, "proposerCreneauProspect");
__name2(proposerCreneauProspect, "proposerCreneauProspect");
__name22(proposerCreneauProspect, "proposerCreneauProspect");
async function pageProspects(env, message = "") {
  await assurerProspectsSchema(env.DB);
  const resas = await tous2(
    env.DB,
    `SELECT uri,nom,email,telephone,titre,debut,fuseau,commande,commande_id,
            consent_email,consent_sms,email_qualif,cree_le,reponses,decision,decision_le,
            meeting_id,proposition_debut,message_decision
     FROM reservations ORDER BY cree_le DESC LIMIT 100`
  );
  const boutique = env.SHOPIFY_STORE.split(".")[0];
  const cle = encodeURIComponent(env.CLE_TEST);
  const etatDecision = /* @__PURE__ */ __name22((r) => {
    const libelles = {
      a_traiter: "\xE0 traiter",
      acceptation_en_cours: "acceptation en cours",
      accepte: "accept\xE9",
      refuse: "refus\xE9",
      creneau_propose: "autre cr\xE9neau propos\xE9",
      erreur: "erreur"
    };
    const libelle = libelles[r.decision] || r.decision || "\xE0 traiter";
    const classe = r.decision === "accepte" ? "p-vert" : r.decision === "refuse" || r.decision === "erreur" ? "p-rouge" : "p-jaune";
    return `<span class="p ${classe}">${echapper(libelle)}</span>${r.message_decision ? `<br><span class="sec">${echapper(r.message_decision)}</span>` : ""}`;
  }, "etatDecision");
  return `${message || ""}<section>${tableauHtml(
    [
      { nom: "Prospect" },
      { nom: "R\xE9ponses au formulaire" },
      { nom: "Rendez-vous", classe: "nowrap" },
      { nom: "Commande" },
      { nom: "Email" },
      { nom: "SMS" },
      { nom: "Qualif." },
      { nom: "D\xE9cision" },
      { nom: "Actions" }
    ],
    resas.map((r) => {
      let qa = [];
      try {
        qa = JSON.parse(r.reponses || "[]");
      } catch {
      }
      return `<tr>
        <td><b>${echapper(r.nom || "\u2014")}</b><br>
          <span class="sec">${echapper(r.email || "")}</span>
          ${r.telephone ? `<br><span class="sec">${echapper(r.telephone)}</span>` : ""}</td>
        <td>${qa.length ? qa.map((q) => `<div class="sec"><b>${echapper(q.question)}</b> \u2014 ${echapper(q.answer)}</div>`).join("") : `<span class="sec">\u2014</span>`}</td>
        <td class="nowrap">${dateFr2(r.debut)}<br><span class="sec">${echapper(r.fuseau || "")}</span></td>
        <td class="nowrap">${r.commande_id ? `<a class="bouton" href="https://admin.shopify.com/store/${boutique}/draft_orders/${echapper(r.commande_id)}" target="_blank" rel="noopener">${echapper(r.commande)}</a>` : "\u2014"}</td>
        <td>${pastille(r.consent_email)}</td>
        <td>${pastille(r.consent_sms)}</td>
        <td>${pastille(r.email_qualif)}</td>
        <td>${etatDecision(r)}</td>
        <td><div class="actions" style="align-items:flex-start">
          ${r.decision === "accepte" && r.meeting_id ? `<a class="bouton" href="?cle=${cle}&page=meeting&id=${r.meeting_id}">Ouvrir le meeting</a>` : `<form method="POST" action="?cle=${cle}&page=prospects&action=accepter_prospect">
            <input type="hidden" name="uri" value="${echapper(r.uri)}">
            <button class="envoyer" type="submit" onclick="return confirm('Accepter ce prospect, cr\xE9er Google Meet et envoyer l'invitation ?')">Accepter</button></form>`}
          ${r.decision !== "accepte" ? `<form method="POST" action="?cle=${cle}&page=prospects&action=refuser_prospect">
            <input type="hidden" name="uri" value="${echapper(r.uri)}">
            <button class="envoyer" style="background:var(--rouge)" type="submit" onclick="return confirm('Marquer ce prospect comme refus\xE9 ?')">Refuser</button></form>` : ""}
          ${r.decision !== "accepte" ? `<details><summary class="bouton" style="cursor:pointer">Autre cr\xE9neau</summary>
            <form class="f" method="POST" action="?cle=${cle}&page=prospects&action=proposer_creneau" style="min-width:270px;margin-top:8px">
              <input type="hidden" name="uri" value="${echapper(r.uri)}">
              <label class="large">Nouveau cr\xE9neau<input type="datetime-local" name="nouveau_creneau" required></label>
              <input type="hidden" name="fuseau" value="${echapper(r.fuseau || "Africa/Casablanca")}">
              <button class="envoyer large" type="submit">Envoyer la proposition</button></form></details>` : ""}
        </div></td></tr>`;
    }),
    "Aucune r\xE9servation depuis la mise en service du journal. Les prochaines appara\xEEtront ici."
  )}</section>`;
}
__name(pageProspects, "pageProspects");
__name2(pageProspects, "pageProspects");
__name22(pageProspects, "pageProspects");
async function pageClients(env, url, message = "") {
  const { donnees, erreur } = await depuisShopify(env, REQ_CLIENTS);
  if (erreur) return `<div class="note"><b>Shopify n'a pas r\xE9pondu.</b><br><span class="sec">${echapper(erreur)}</span></div>`;
  const clients = donnees.customers.nodes;
  const boutique = env.SHOPIFY_STORE.split(".")[0];
  const cle = encodeURIComponent(env.CLE_TEST);
  const idDemande = String(url?.searchParams.get("id") || "").trim();
  const nouveau = url?.searchParams.get("nouveau") === "1";
  let edition = null;
  let erreurEdition = null;
  if (idDemande) {
    if (!/^gid:\/\/shopify\/Customer\/\d+$/.test(idDemande)) {
      erreurEdition = "Identifiant client invalide.";
    } else {
      try {
        const jeton = await jetonShopify(env);
        const d = await shopify(env, jeton, REQ_CLIENT, { id: idDemande });
        edition = d.customer;
        if (!edition) erreurEdition = "Client introuvable dans Shopify.";
      } catch (e) {
        erreurEdition = e.message;
      }
    }
  }
  const abonnes = clients.filter((c) => c.emailMarketingConsent?.marketingState === "SUBSCRIBED").length;
  const total = clients.reduce((s, c) => s + Number(c.amountSpent?.amount || 0), 0);
  return `
  ${message || ""}
  <div class="actions"><a class="envoyer" href="?cle=${cle}&page=clients&nouveau=1">Ajouter un nouveau client</a></div>
  ${erreurEdition ? `<div class="alerte">${echapper(erreurEdition)}</div>` : ""}
  ${nouveau || edition ? `<section><h2>${edition ? "Modifier le client" : "Nouveau client"}</h2>
    <div class="note" style="margin-bottom:14px">La fiche est enregistr\xE9e directement dans Shopify. Si vous cochez l'abonnement email, le contact est aussi synchronis\xE9 avec la liste Brevo.</div>
    <form class="f" method="POST" action="?cle=${cle}&page=clients&action=enregistrer_client">
      <input type="hidden" name="customer_id" value="${echapper(edition?.id || "")}">
      <label>Pr\xE9nom<input name="prenom" value="${echapper(edition?.firstName || "")}"></label>
      <label>Nom<input name="nom" value="${echapper(edition?.lastName || "")}"></label>
      <label>Email<input name="email" type="email" required value="${echapper(edition?.email || "")}"></label>
      <label>T\xE9l\xE9phone<input name="telephone" value="${echapper(edition?.phone || "")}" placeholder="+33..."></label>
      <label class="large">Tags, s\xE9par\xE9s par des virgules<input name="tags" value="${echapper((edition?.tags || []).join(", "))}"></label>
      <label class="large">Note client<textarea name="note">${echapper(edition?.note || "")}</textarea></label>
      <label class="large"><input type="checkbox" name="abonner_email" value="1" ${edition?.emailMarketingConsent?.marketingState === "SUBSCRIBED" ? "checked" : ""}> Abonner le client aux emails et le synchroniser avec Brevo</label>
      <button class="envoyer large" type="submit">${edition ? "Enregistrer les modifications" : "Cr\xE9er le client"}</button>
    </form></section>` : ""}
  <section><div class="grille">
    <div class="carte neutre"><div class="k">Clients affich\xE9s</div><div class="v">${clients.length}</div>
      <div class="s">les 50 plus r\xE9cents</div></div>
    <div class="carte bon"><div class="k">Abonn\xE9s email</div><div class="v">${abonnes}</div></div>
    <div class="carte neutre"><div class="k">Chiffre d'affaires</div><div class="v">${euros3(total)}</div>
      <div class="s">sur ces clients</div></div>
  </div></section>
  <section>${tableauHtml(
    [
      { nom: "Client" },
      { nom: "Cr\xE9\xE9 le", classe: "nowrap" },
      { nom: "Commandes", classe: "num" },
      { nom: "D\xE9pens\xE9", classe: "num" },
      { nom: "Email" },
      { nom: "SMS" },
      { nom: "" }
    ],
    clients.map((c) => `<tr>
      <td><b><a href="https://admin.shopify.com/store/${boutique}/customers/${c.id.split("/").pop()}" target="_blank" rel="noopener">${echapper(c.displayName || c.email || "\u2014")}</a></b><br>
        <span class="sec">${echapper(c.email || "")}</span>
        ${c.phone ? `<br><span class="sec">${echapper(c.phone)}</span>` : ""}</td>
      <td class="nowrap">${dateFr2(c.createdAt, false)}</td>
      <td class="num">${c.numberOfOrders ?? 0}</td>
      <td class="num">${euros3(c.amountSpent?.amount)}</td>
      <td>${pastille(c.emailMarketingConsent?.marketingState === "SUBSCRIBED" ? "abonn\xE9" : c.emailMarketingConsent?.marketingState === "NOT_SUBSCRIBED" ? "non abonn\xE9" : c.emailMarketingConsent?.marketingState)}</td>
      <td>${pastille(c.smsMarketingConsent?.marketingState === "SUBSCRIBED" ? "abonn\xE9" : c.smsMarketingConsent?.marketingState === "NOT_SUBSCRIBED" ? "non abonn\xE9" : c.smsMarketingConsent?.marketingState)}</td>
      <td><a class="bouton" href="?cle=${cle}&page=clients&id=${encodeURIComponent(c.id)}">Modifier</a></td>
    </tr>`),
    "Aucun client."
  )}</section>`;
}
__name(pageClients, "pageClients");
__name2(pageClients, "pageClients");
__name22(pageClients, "pageClients");
async function pageFacturation(env) {
  const cle = encodeURIComponent(env.CLE_TEST);
  const boutique = env.SHOPIFY_STORE.split(".")[0];
  const [factures, { donnees, erreur }] = await Promise.all([
    listeFactures(env.DB, 100),
    depuisShopify(env, REQ_FACTURATION)
  ]);
  const somme = /* @__PURE__ */ __name22((liste) => liste.reduce((t, f) => t + Number(f.montant || 0), 0), "somme");
  const encaissees = factures.filter((f) => f.statut === "pay\xE9e");
  const envoyees = factures.filter((f) => f.statut === "envoy\xE9e");
  const brouillons = factures.filter((f) => f.statut === "brouillon");
  const facture = /* @__PURE__ */ __name22((f) => `<tr>
      <td class="nowrap"><b>n\xB0 ${f.numero}</b></td>
      <td>${echapper(f.client_nom)}${f.client_societe ? `<br><span class="sec">${echapper(f.client_societe)}</span>` : ""}
        <br><span class="sec">${echapper(f.client_email)}</span></td>
      <td>${echapper(f.prestation)}</td>
      <td class="nowrap">${dateFr2(f.date_facture, false)}</td>
      <td class="num"><b>${euros3(f.montant)}</b></td>
      <td>${pastille(f.statut)}</td>
      <td class="nowrap">${f.commande_shopify_id ? `<a href="https://admin.shopify.com/store/${boutique}/orders/${echapper(f.commande_shopify_id)}" target="_blank" rel="noopener">${echapper(f.commande_shopify)}</a>` : "\u2014"}</td>
      <td class="nowrap"><a class="bouton pale" href="?cle=${cle}&page=facture&numero=${f.numero}">Ouvrir</a></td>
    </tr>`, "facture");
  const mesFactures = `
  <section><div class="grille">
    <div class="carte bon"><div class="k">Encaiss\xE9</div><div class="v">${euros3(somme(encaissees))}</div>
      <div class="s">${encaissees.length} facture(s) pay\xE9e(s)</div></div>
    <div class="carte ${envoyees.length ? "moyen" : "neutre"}"><div class="k">En attente de r\xE8glement</div>
      <div class="v">${euros3(somme(envoyees))}</div>
      <div class="s">${envoyees.length} facture(s) envoy\xE9e(s)</div></div>
    <div class="carte neutre"><div class="k">Brouillons</div><div class="v">${brouillons.length}</div>
      <div class="s">pas encore envoy\xE9s</div></div>
  </div></section>

  <section><div class="actions" style="margin-bottom:13px">
      <a class="bouton gros" href="?cle=${cle}&page=facture">${ic("plus")} Nouvelle facture</a></div>
    ${tableauHtml(
    [
      { nom: "N\xB0" },
      { nom: "Client" },
      { nom: "Prestation" },
      { nom: "Date", classe: "nowrap" },
      { nom: "Montant", classe: "num" },
      { nom: "Statut" },
      { nom: "Commande" },
      { nom: "" }
    ],
    factures.map(facture),
    "Aucune facture \xE9mise. La premi\xE8re portera le num\xE9ro 6968, dans la continuit\xE9 de vos factures manuelles.",
    "tab-factures"
  )}
  </section>`;
  if (erreur) {
    return `${mesFactures}
    <section><details><summary>Suivi de la boutique Shopify</summary>
      <div class="dedans"><div class="alerte">Shopify n'a pas r\xE9pondu.<br>
        <span class="sec">${echapper(erreur)}</span></div></div></details></section>`;
  }
  const ouverts = donnees.draftOrders.nodes.filter((d) => d.status === "OPEN");
  const commandes = donnees.orders.nodes;
  const devis = ouverts.filter((d) => Number(d.totalPriceSet.shopMoney.amount) > 0);
  const rdv = ouverts.filter((d) => Number(d.totalPriceSet.shopMoney.amount) === 0);
  const encaisseBoutique = commandes.filter((o) => o.displayFinancialStatus === "PAID").reduce((t, o) => t + Number(o.totalPriceSet.shopMoney.amount), 0);
  const lienDraft = /* @__PURE__ */ __name22((d, texte) => `<a class="bouton pale" href="https://admin.shopify.com/store/${boutique}/draft_orders/${d.id.split("/").pop()}" target="_blank" rel="noopener">${texte}</a>`, "lienDraft");
  return `${mesFactures}

  <section><details><summary>Suivi de la boutique Shopify
      <span class="sec" style="font-weight:400"> \u2014 ${devis.length} devis, ${rdv.length} rendez-vous ouverts</span></summary>
    <div class="dedans">
      <div class="note">Ces lignes viennent de Shopify, pas de vos factures.
        Les <b>rendez-vous \xE0 0 \u20AC</b> sont les brouillons cr\xE9\xE9s automatiquement \xE0 chaque r\xE9servation
        Calendly : ils servent de fiche prospect, pas de devis.</div>

      <div class="grille">
        <div class="carte bon"><div class="k">Encaiss\xE9 dans la boutique</div>
          <div class="v">${euros3(encaisseBoutique)}</div>
          <div class="s">30 derni\xE8res commandes</div></div>
        <div class="carte ${devis.length ? "moyen" : "neutre"}"><div class="k">Devis chiffr\xE9s</div>
          <div class="v">${euros3(devis.reduce((t, d) => t + Number(d.totalPriceSet.shopMoney.amount), 0))}</div>
          <div class="s">${devis.length} brouillon(s)</div></div>
        <div class="carte neutre"><div class="k">Rendez-vous ouverts</div><div class="v">${rdv.length}</div>
          <div class="s">brouillons \xE0 0 \u20AC</div></div>
      </div>

      <div><h2>Devis \xE0 facturer</h2>${tableauHtml(
    [
      { nom: "Devis" },
      { nom: "Client" },
      { nom: "Cr\xE9\xE9 le", classe: "nowrap" },
      { nom: "Montant", classe: "num" },
      { nom: "" }
    ],
    devis.map((d) => `<tr>
          <td class="nowrap"><b>${echapper(d.name)}</b></td>
          <td>${echapper(d.customer?.displayName || d.customer?.email || "\u2014")}</td>
          <td class="nowrap">${dateFr2(d.createdAt, false)}</td>
          <td class="num"><b>${euros3(d.totalPriceSet.shopMoney.amount)}</b></td>
          <td class="nowrap">${lienDraft(d, "Facturer \u2192")}</td></tr>`),
    "Aucun devis chiffr\xE9 dans Shopify."
  )}</div>

      <div><h2>Rendez-vous en cours</h2>${tableauHtml(
    [{ nom: "Brouillon" }, { nom: "Client" }, { nom: "Cr\xE9\xE9 le", classe: "nowrap" }, { nom: "" }],
    rdv.map((d) => `<tr>
          <td class="nowrap">${echapper(d.name)}</td>
          <td>${echapper(d.customer?.displayName || d.customer?.email || "\u2014")}</td>
          <td class="nowrap">${dateFr2(d.createdAt, false)}</td>
          <td class="nowrap">${lienDraft(d, "Chiffrer \u2192")}</td></tr>`),
    "Aucun rendez-vous ouvert.",
    "tab-rdv-shopify"
  )}</div>

      <div><h2>Commandes de la boutique</h2>${tableauHtml(
    [
      { nom: "Commande" },
      { nom: "Client" },
      { nom: "Date", classe: "nowrap" },
      { nom: "Montant", classe: "num" },
      { nom: "Paiement" }
    ],
    commandes.map((o) => `<tr>
          <td class="nowrap"><a href="https://admin.shopify.com/store/${boutique}/orders/${o.id.split("/").pop()}" target="_blank" rel="noopener"><b>${echapper(o.name)}</b></a></td>
          <td>${echapper(o.customer?.displayName || o.customer?.email || "\u2014")}</td>
          <td class="nowrap">${dateFr2(o.createdAt, false)}</td>
          <td class="num">${euros3(o.totalPriceSet.shopMoney.amount)}</td>
          <td>${pastille(o.displayFinancialStatus === "PAID" ? "pay\xE9e" : o.displayFinancialStatus)}</td></tr>`),
    "Aucune commande.",
    "tab-commandes"
  )}</div>
    </div></details></section>`;
}
__name(pageFacturation, "pageFacturation");
__name2(pageFacturation, "pageFacturation");
__name22(pageFacturation, "pageFacturation");
var pourcent = /* @__PURE__ */ __name22((v) => v === null || v === void 0 ? "\u2014" : `${(v * 100).toFixed(1).replace(".", ",")} %`, "pourcent");
async function pageNewsletter(env, url, message) {
  const cle = encodeURIComponent(env.CLE_TEST);
  const choisie = url?.searchParams.get("campagne");
  const camps = await tous2(
    env.DB,
    "SELECT id,titre,lien,destinataires,envoyee_le FROM campagnes ORDER BY envoyee_le DESC LIMIT 50"
  );
  let stats = /* @__PURE__ */ new Map(), erreurStats = null;
  try {
    stats = await statistiques(env);
  } catch (e) {
    erreurStats = e.message;
  }
  if (choisie) return pageCampagne(env, url, message, camps, stats, erreurStats);
  const [[exec], nbExec] = await Promise.all([
    tous2(env.DB, "SELECT quand,statut,message,duree_ms FROM executions WHERE domaine IN ('blog','newsletter') ORDER BY quand DESC LIMIT 1"),
    tous2(env.DB, "SELECT COUNT(*) AS n FROM executions WHERE domaine IN ('blog','newsletter')")
  ]);
  const ok = exec?.statut === "ok";
  const muet = exec && Date.now() - new Date(exec.quand).getTime() > 9e5 * 3;
  const enAttente = await tous2(env.DB, "SELECT guid,titre,lien,statut,cree_le,erreur FROM newsletter_envois WHERE statut NOT IN ('envoyee','ignoree','ses_envoi') ORDER BY cree_le").catch(() => []);
  const autoActif = await emailAutorise(env, "blog_newsletter");
  const envoisSes = sesActif(env) ? await tous2(env.DB, "SELECT titre,lien,statut,destinataires,ses_envoyes,ses_erreurs,erreur,maj_le,envoyee_le FROM newsletter_envois WHERE campagne_id='ses' ORDER BY maj_le DESC LIMIT 10").catch(() => []) : [];
  const suivies = camps.map((c) => stats.get(String(c.id))).filter(Boolean);
  const livres = suivies.reduce((t, s) => t + s.livres, 0);
  const ouvreurs = suivies.reduce((t, s) => t + s.ouvreurs, 0);
  const cliqueurs = suivies.reduce((t, s) => t + s.cliqueurs, 0);
  const desabos = suivies.reduce((t, s) => t + s.desabonnements, 0);
  const sesOk = sesActif(env);
  const lienArticle = (t, l) => l ? `<a class="nl-titre" href="${echapper(l)}" target="_blank" rel="noopener">${echapper(t || "—")}</a>` : `<span class="nl-titre">${echapper(t || "—")}</span>`;
  const barre = (v, couleur) => `<span class="nl-barre"><span style="width:${Math.max(2, Math.min(100, Math.round((v || 0) * 100)))}%;background:${couleur}"></span></span>`;
  const bouton = (action, guid, libelle, classe, confirmer) => `<form method="POST" action="?cle=${cle}&page=newsletter&action=${action}"${confirmer ? ` onsubmit="return confirm('${confirmer}')"` : ""}>
      <input type="hidden" name="guid" value="${echapper(guid)}"><button type="submit" class="${classe}">${libelle}</button></form>`;
  const etatAuto = !exec || !ok ? ["rouge", "Surveillance du blog en erreur", exec?.message ? echapper(exec.message).slice(0, 160) : "Aucune v\xE9rification pour l'instant."] : muet ? ["orange", "Surveillance du blog silencieuse", `Derni\xE8re v\xE9rification ${depuis(exec.quand)}.`] : autoActif ? ["vert", "Envoi automatique activ\xE9", `Chaque nouvel article part le jour m\xEAme${sesOk ? " par Amazon SES, 15 contacts par minute" : ""}. Derni\xE8re v\xE9rification ${depuis(exec.quand)}.`] : ["gris", "Envoi automatique en pause", `Rien ne part sans votre accord. Derni\xE8re v\xE9rification du blog ${depuis(exec.quand)}.`];
  const carteStat = (k, v, s, barreHtml = "") => `<div class="nl-stat"><div class="nl-k">${k}</div><div class="nl-v">${v}</div>${barreHtml}<div class="nl-s">${s}</div></div>`;
  return `
  <style>
    .nl{--nl-encre:#2B2A27;--nl-doux:#6F6B63;--nl-trait:#E7E2D8;--nl-fond:#FFFFFF;--nl-creme:#FAF8F3;font-size:15px;line-height:1.6;color:var(--nl-encre);max-width:1040px}
    .nl h2.nl-h{font:600 18px/1.3 Helvetica,Arial,sans-serif;letter-spacing:-.01em;text-transform:none;color:var(--nl-encre);margin:36px 0 6px;display:flex;align-items:center;gap:10px}
    .nl h2.nl-h::after{display:none}
    .nl .nl-sous{color:var(--nl-doux);margin:0 0 14px}
    .nl .nl-pastille{font:600 12px/1 Helvetica,Arial,sans-serif;background:#FFF1C2;color:#7A5B00;border-radius:999px;padding:5px 10px}
    .nl .nl-etat{display:flex;gap:14px;align-items:flex-start;background:var(--nl-fond);border:1px solid var(--nl-trait);border-radius:14px;padding:18px 20px;margin-top:8px}
    .nl .nl-point{width:12px;height:12px;border-radius:50%;margin-top:6px;flex:none}
    .nl .nl-point.vert{background:#3F8F5A}.nl .nl-point.gris{background:#A8A398}.nl .nl-point.orange{background:#D08A1E}.nl .nl-point.rouge{background:#C2453A}
    .nl .nl-etat b{font-size:16px}.nl .nl-etat p{margin:2px 0 0;color:var(--nl-doux)}
    .nl .nl-etat a{margin-left:auto;white-space:nowrap;align-self:center}
    .nl .nl-liste{background:var(--nl-fond);border:1px solid var(--nl-trait);border-radius:14px;overflow:hidden}
    .nl .nl-ligne{display:flex;gap:16px;align-items:center;padding:16px 20px;border-top:1px solid var(--nl-trait)}
    .nl .nl-ligne:first-child{border-top:0}
    .nl .nl-corps{flex:1;min-width:0}
    .nl .nl-titre{font-weight:600;color:var(--nl-encre);text-decoration:none;font-size:15.5px}
    .nl a.nl-titre:hover{text-decoration:underline}
    .nl .nl-meta{color:var(--nl-doux);font-size:13.5px;margin-top:3px}
    .nl .nl-actions{display:flex;gap:8px;flex:none}
    .nl .nl-actions form{margin:0}
    .nl button.nl-oui,.nl button.nl-non,.nl a.nl-lien{font:600 14px/1 Helvetica,Arial,sans-serif;border-radius:8px;padding:11px 16px;cursor:pointer;border:1px solid transparent}
    .nl button.nl-oui{background:#2F6F4A;color:#fff}.nl button.nl-oui:hover{background:#275D3E}
    .nl button.nl-non{background:transparent;color:var(--nl-doux);border-color:var(--nl-trait)}.nl button.nl-non:hover{background:var(--nl-creme);color:var(--nl-encre)}
    .nl a.nl-lien{color:var(--nl-encre);border-color:var(--nl-trait);text-decoration:none;background:var(--nl-fond);display:inline-block}
    .nl a.nl-lien:hover{background:var(--nl-creme)}
    .nl .nl-pied{display:flex;justify-content:flex-end;margin-top:10px}
    .nl .nl-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .nl .nl-stat{background:var(--nl-fond);border:1px solid var(--nl-trait);border-radius:14px;padding:16px 18px}
    .nl .nl-k{color:var(--nl-doux);font-size:14px}.nl .nl-v{font:700 28px/1.2 Helvetica,Arial,sans-serif;margin:4px 0}
    .nl .nl-s{color:var(--nl-doux);font-size:13.5px}
    .nl .nl-barre{display:block;height:6px;border-radius:3px;background:#EFEBE2;overflow:hidden;margin:6px 0}
    .nl .nl-barre>span{display:block;height:100%;border-radius:3px}
    .nl .nl-chiffres{display:flex;gap:22px;flex:none;text-align:right}
    .nl .nl-chiffres div{min-width:74px}.nl .nl-chiffres b{display:block;font-size:16px}.nl .nl-chiffres span{color:var(--nl-doux);font-size:12.5px}
    .nl .nl-progres{width:180px;flex:none}
    .nl .nl-erreur{color:#A33A30;font-size:13.5px;margin-top:4px}
    .nl details.nl-aide{margin-top:36px;background:var(--nl-creme);border:1px solid var(--nl-trait);border-radius:14px;padding:14px 20px;color:var(--nl-doux)}
    .nl details.nl-aide summary{cursor:pointer;font-weight:600;color:var(--nl-encre)}
    .nl details.nl-aide p{margin:10px 0 0}
    @media (max-width:820px){.nl .nl-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.nl .nl-ligne,.nl .nl-etat{flex-wrap:wrap}.nl .nl-corps{flex-basis:100%}.nl .nl-etat>div{flex:1 1 200px}.nl .nl-etat a{margin-left:0}.nl .nl-chiffres{text-align:left}.nl .nl-progres{width:100%}}
    .nl details.nl-aide summary{background:none;border:0;padding:0;box-shadow:none}
  </style>
  <div class="nl">
  ${message || ""}
  ${erreurStats ? `<div class="alerte">Les statistiques d'ouverture n'ont pas pu \xEAtre lues.<br><span class="sec">${echapper(erreurStats)}</span></div>` : ""}

  <div class="nl-etat"><span class="nl-point ${etatAuto[0]}"></span>
    <div><b>${etatAuto[1]}</b><p>${etatAuto[2]}</p></div>
    <a class="nl-lien" href="?cle=${cle}&page=emails">${autoActif ? "Mettre en pause" : "Activer"}</a></div>

  ${enAttente.length ? `<h2 class="nl-h">\xC0 envoyer <span class="nl-pastille">${enAttente.length}</span></h2>
  <p class="nl-sous">${autoActif ? "Ces articles ne sont pas partis le jour de leur publication : ils attendent votre d\xE9cision." : "Envoi automatique en pause : ces articles attendent votre d\xE9cision."}</p>
  <div class="nl-liste">${enAttente.map((e) => `<div class="nl-ligne">
      <div class="nl-corps">${lienArticle(e.titre, e.lien)}<div class="nl-meta">D\xE9tect\xE9 le ${dateFr2(e.cree_le, false)}</div></div>
      <div class="nl-actions">${bouton("nl_envoyer", e.guid, "Envoyer", "nl-oui", "Envoyer cet article \\xE0 toute votre liste ?")}${bouton("nl_ignorer", e.guid, "Ne pas envoyer", "nl-non")}</div>
    </div>`).join("")}</div>
  ${enAttente.length > 1 ? `<div class="nl-pied"><form method="POST" action="?cle=${cle}&page=newsletter&action=nl_ignorer" onsubmit="return confirm('Retirer les ${enAttente.length} articles de la file ?')">
    ${enAttente.map((e) => `<input type="hidden" name="guid" value="${echapper(e.guid)}">`).join("")}<button type="submit" class="nl-non">Ne rien envoyer de cette liste</button></form></div>` : ""}` : ""}

  ${envoisSes.length ? `<h2 class="nl-h">Envois par Amazon SES</h2>
  <div class="nl-liste">${envoisSes.map((e) => {
    const total = e.destinataires || 0, fait = e.ses_envoyes || 0;
    return `<div class="nl-ligne">
      <div class="nl-corps">${lienArticle(e.titre, e.lien)}<div class="nl-meta">${e.statut === "envoyee" ? `Termin\xE9 le ${dateFr2(e.envoyee_le || e.maj_le)}` : "En cours d'envoi"}${e.ses_erreurs ? ` \xB7 ${e.ses_erreurs} adresse(s) en erreur` : ""}</div>
        ${e.erreur ? `<div class="nl-erreur">${echapper(e.erreur).slice(0, 200)}</div>` : ""}</div>
      <div class="nl-progres">${barre(total ? fait / total : 0, e.statut === "envoyee" ? "#3F8F5A" : "#D9A520")}<div class="nl-meta">${fait} / ${total || "?"} envoy\xE9s</div></div>
    </div>`;
  }).join("")}</div>` : ""}

  <h2 class="nl-h">R\xE9sultats</h2>
  <p class="nl-sous">Sur ${suivies.length} article(s) envoy\xE9(s) par Brevo.</p>
  <div class="nl-stats">
    ${carteStat("Emails livr\xE9s", String(livres), "au total")}
    ${carteStat("Ont ouvert", String(ouvreurs), livres ? pourcent(ouvreurs / livres) + " des lecteurs" : "—", barre(livres ? ouvreurs / livres : 0, "#6E9BC7"))}
    ${carteStat("Ont cliqu\xE9", String(cliqueurs), livres ? pourcent(cliqueurs / livres) + " des lecteurs" : "—", barre(livres ? cliqueurs / livres : 0, "#3F8F5A"))}
    ${carteStat("D\xE9sabonnements", String(desabos), "sur la p\xE9riode")}
  </div>

  <h2 class="nl-h">Articles envoy\xE9s</h2>
  ${camps.length ? `<div class="nl-liste">${camps.map((c) => {
    const st = stats.get(String(c.id));
    return `<div class="nl-ligne">
      <div class="nl-corps">${lienArticle(c.titre, c.lien)}<div class="nl-meta">Envoy\xE9 le ${dateFr2(c.envoyee_le, false)} \xB7 ${st ? st.livres : c.destinataires ?? "?"} livr\xE9s${st?.desabonnements ? ` \xB7 ${st.desabonnements} d\xE9sabonnement(s)` : ""}</div></div>
      <div class="nl-chiffres">
        <div><b>${st ? pourcent(st.tauxOuverture) : "—"}</b><span>ouverture</span></div>
        <div><b>${st ? pourcent(st.tauxClic) : "—"}</b><span>clic</span></div>
      </div>
      <a class="nl-lien" href="?cle=${cle}&page=newsletter&campagne=${encodeURIComponent(c.id)}">D\xE9tail</a>
    </div>`;
  }).join("")}</div>` : `<p class="nl-sous">Aucun article envoy\xE9 pour l'instant.</p>`}

  <details class="nl-aide"><summary>Comment \xE7a marche</summary>
    <p>Toutes les 15 minutes, l'application lit le flux de votre blog. Un nouvel article part le jour m\xEAme${sesOk ? " par Amazon SES vers chaque contact de votre liste Brevo, avec un lien de d\xE9sinscription" : " en campagne Brevo"}. S'il n'est pas parti ce jour-l\xE0, il passe dans \xAB \xC0 envoyer \xBB.</p>
    <p>Le taux de clic est l'indicateur le plus fiable : Apple Mail pr\xE9charge les images, ce qui compte comme une ouverture m\xEAme si personne n'a lu.</p>
    <p style="font-size:13px">Flux : ${echapper(env.FEED_URL || "non configur\xE9")} \xB7 liste ${echapper(env.BREVO_LIST || "—")} \xB7 exp\xE9diteur ${echapper(env.SENDER_EMAIL || "—")} \xB7 ${nbExec[0]?.n ?? 0} v\xE9rifications</p>
  </details>
  </div>`;
}
__name(pageNewsletter, "pageNewsletter");
__name2(pageNewsletter, "pageNewsletter");
__name22(pageNewsletter, "pageNewsletter");
async function pageCampagne(env, url, message, camps, stats, erreurStats) {
  const cle = encodeURIComponent(env.CLE_TEST);
  const id = url.searchParams.get("campagne");
  const c = camps.find((x) => String(x.id) === String(id));
  const st = stats.get(String(id));
  const [parLien, exports] = await Promise.all([
    liens(env, id).catch(() => null),
    lireExports(env.DB, id)
  ]);
  const bloc = /* @__PURE__ */ __name22((type) => {
    const e = exports[type];
    const t = TYPES[type];
    const form = /* @__PURE__ */ __name22((libelle, principal = false) => `<form method="POST" style="display:inline"
        action="?cle=${cle}&page=newsletter&campagne=${encodeURIComponent(id)}&action=export_contacts&type=${type}">
        <button class="envoyer${principal ? "" : " discret"}" type="submit">${libelle}</button></form>`, "form");
    if (!e) {
      return `<div class="dedans" style="border-radius:var(--r);border-top:1px solid var(--trait)">
        <p style="margin:0">Brevo pr\xE9pare cette liste \xE0 la demande. Elle est pr\xEAte en quelques
          secondes, et reste consultable ensuite.</p>
        <div class="actions">${form(`Demander la liste de ceux qui ${t.nom}`, true)}</div></div>`;
    }
    if (e.statut === "\xE9chec") {
      return `<div class="dedans" style="border-radius:var(--r);border-top:1px solid var(--trait)">
        <div class="alerte">${echapper(e.message || "Brevo a refus\xE9 l'export.")}</div>
        <div class="actions">${form("R\xE9essayer", true)}</div></div>`;
    }
    if (e.statut !== "pr\xEAt") {
      return `<div class="dedans" style="border-radius:var(--r);border-top:1px solid var(--trait)">
        <p style="margin:0"><b>Export en pr\xE9paration chez Brevo.</b> Demand\xE9 ${depuis(e.demande_le)}.</p>
        <div class="actions">
          <a class="bouton gros" href="?cle=${cle}&page=newsletter&campagne=${encodeURIComponent(id)}&verifier=${type}">V\xE9rifier maintenant</a>
          ${form("Relancer l'export")}</div></div>`;
    }
    let adresses = [];
    try {
      adresses = JSON.parse(e.contacts || "[]");
    } catch {
    }
    return `<div class="dedans" style="border-radius:var(--r);border-top:1px solid var(--trait)">
      <div class="actions" style="justify-content:space-between">
        <span class="sec">${adresses.length} adresse${adresses.length > 1 ? "s" : ""}
          \xB7 liste \xE9tablie ${depuis(e.fini_le)}</span>
        ${form("Actualiser")}</div>
      ${tableauHtml(
      [{ nom: "Adresse" }],
      adresses.map((a) => `<tr><td>${echapper(a)}</td></tr>`),
      "Personne, pour cette campagne.",
      `tab-${type}`
    )}</div>`;
  }, "bloc");
  return `
    ${message || ""}
    <section><div class="actions">
      <a class="bouton pale" href="?cle=${cle}&page=newsletter">\u2190 Toutes les campagnes</a>
      ${c?.lien ? `<a class="bouton pale" href="${echapper(c.lien)}" target="_blank" rel="noopener">Voir l'article</a>` : ""}
    </div></section>

    <section><h2>Article</h2>
      <div class="titre-campagne">${echapper(c?.titre || `Campagne ${id}`)}</div>
      ${erreurStats ? `<div class="alerte">Statistiques indisponibles \u2014 <span class="sec">${echapper(erreurStats)}</span></div>` : !st ? `<div class="note">Brevo ne rend plus de statistiques pour cette campagne.
          Les donn\xE9es d'ouverture ne remontent que sur les six derniers mois.</div>` : `<div class="grille">
        ${carteHtml("Emails livr\xE9s", String(st.livres), `${st.envoyes} envoy\xE9(s)`)}
        ${carteHtml("Ont ouvert", String(st.ouvreurs), `${pourcent(st.tauxOuverture)} \xB7 ${st.ouvertures} ouverture(s)`, st.ouvreurs ? "bon" : "neutre")}
        ${carteHtml("Ont cliqu\xE9", String(st.cliqueurs), `${pourcent(st.tauxClic)} \xB7 ${st.clics} clic(s)`, st.cliqueurs ? "bon" : "neutre")}
        ${carteHtml("D\xE9sabonnements", String(st.desabonnements), `${st.rebonds} rebond(s) \xB7 ${st.plaintes} plainte(s)`, st.desabonnements ? "moyen" : "neutre")}
      </div>`}
    </section>

    ${parLien && parLien.length ? `<section><h2>Liens cliqu\xE9s</h2>${tableauHtml(
    [{ nom: "Lien" }, { nom: "Clics", classe: "num" }],
    parLien.map((l) => `<tr>
        <td><a href="${echapper(l.url)}" target="_blank" rel="noopener">${echapper(l.url)}</a></td>
        <td class="num"><b>${l.clics}</b></td></tr>`),
    "Aucun lien cliqu\xE9."
  )}</section>` : ""}

    <section><h2>Qui a ouvert</h2>${bloc("openers")}</section>
    <section><h2>Qui a cliqu\xE9</h2>${bloc("clickers")}</section>`;
}
__name(pageCampagne, "pageCampagne");
__name2(pageCampagne, "pageCampagne");
__name22(pageCampagne, "pageCampagne");
async function pageJournal(env) {
  const incidents = await tous2(env.DB, "SELECT quand,domaine,sujet,message FROM incidents ORDER BY quand DESC LIMIT 40");
  const execs = await tous2(env.DB, "SELECT domaine,quand,duree_ms,statut,message FROM executions ORDER BY quand DESC LIMIT 30");
  return `
  <section><h2>Incidents</h2>${tableauHtml(
    [{ nom: "Quand", classe: "nowrap" }, { nom: "Origine" }, { nom: "Sujet" }, { nom: "Message" }],
    incidents.map((i) => `<tr>
      <td class="nowrap">${dateFr2(i.quand)}</td>
      <td>${echapper(i.domaine)}</td>
      <td>${echapper(i.sujet || "\u2014")}</td>
      <td><span class="sec">${echapper(i.message)}</span></td></tr>`),
    "Aucun incident. C'est le r\xE9sultat attendu.",
    "tab-incidents"
  )}</section>
  <section><h2>Derni\xE8res ex\xE9cutions</h2>${tableauHtml(
    [{ nom: "Quand", classe: "nowrap" }, { nom: "Automatisation" }, { nom: "Dur\xE9e", classe: "num" }, { nom: "Statut" }],
    execs.map((e) => `<tr>
      <td class="nowrap">${dateFr2(e.quand)}</td>
      <td>${echapper(e.domaine)}</td>
      <td class="num">${e.duree_ms ?? "?"} ms</td>
      <td>${pastille(e.statut === "ok" ? "ok" : e.message || "erreur")}</td></tr>`),
    "Aucune ex\xE9cution enregistr\xE9e."
  )}</section>`;
}
__name(pageJournal, "pageJournal");
__name2(pageJournal, "pageJournal");
__name22(pageJournal, "pageJournal");
async function pageFacture(env, url, message) {
  const cle = encodeURIComponent(env.CLE_TEST);
  const numero = url.searchParams.get("numero");
  if (numero) {
    const f = await lireFacture(env.DB, Number(numero));
    if (!f) return `<div class="alerte">Facture n\xB0 ${echapper(numero)} introuvable.</div>`;
    const lien = `${url.origin}/f/${f.jeton}`;
    const annulee = f.statut === "annul\xE9e";
    const modifiable = f.statut === "brouillon";
    if (url.searchParams.get("edit") && modifiable) {
      return `${message || ""}
        <form class="f" method="POST" action="?cle=${cle}&page=facture&numero=${f.numero}&action=modifier_facture">
          <label>Nom du client<input name="client_nom" required value="${echapper(f.client_nom)}"></label>
          <label>Soci\xE9t\xE9<input name="client_societe" value="${echapper(f.client_societe || "")}"></label>
          <label>Email<input name="client_email" type="email" required value="${echapper(f.client_email)}"></label>
          <label>Date<input name="date_facture" type="date" required value="${echapper(String(f.date_facture).slice(0, 10))}"></label>
          <label class="large">Prestation<input name="prestation" required value="${echapper(f.prestation)}"></label>
          <label class="large">Description<textarea name="description" required>${echapper(f.description)}</textarea></label>
          <label>Montant TTC<input name="montant" required value="${f.montant}"></label>
          <div></div>
          <button class="envoyer large" type="submit">Enregistrer les modifications</button>
        </form>
        <div class="actions"><a class="bouton" href="?cle=${cle}&page=facture&numero=${f.numero}">Annuler la modification</a></div>`;
    }
    return `
      ${message || ""}
      <section><div class="grille">
        <div class="carte neutre"><div class="k">Facture</div><div class="v">n\xB0 ${f.numero}</div></div>
        <div class="carte neutre"><div class="k">Montant</div><div class="v">${euros3(f.montant)}</div></div>
        <div class="carte ${f.statut === "pay\xE9e" ? "bon" : f.statut === "envoy\xE9e" ? "moyen" : "neutre"}">
          <div class="k">Statut</div><div class="v txt">${echapper(f.statut)}</div>
          <div class="s">${f.payee_le ? `encaiss\xE9e le ${dateFr2(f.payee_le)}` : f.envoyee_le ? `envoy\xE9e le ${dateFr2(f.envoyee_le)}` : "pas encore envoy\xE9e"}</div></div>
        ${f.commande_shopify_id ? `<div class="carte bon"><div class="k">Commande Shopify</div>
          <div class="v txt"><a href="https://admin.shopify.com/store/${env.SHOPIFY_STORE.split(".")[0]}/orders/${echapper(f.commande_shopify_id)}" target="_blank" rel="noopener">${echapper(f.commande_shopify)}</a></div>
          <div class="s">pay\xE9e \xB7 compt\xE9e dans le chiffre d'affaires</div></div>` : ""}
      </div></section>

      <section><div class="actions">
        ${annulee ? "" : `
        <form method="POST" action="?cle=${cle}&page=facture&numero=${f.numero}&action=envoyer" style="display:inline">
          <button class="envoyer" type="submit"
            onclick="return confirm('Envoyer la facture n\xB0 ${f.numero} \xE0 ${echapperJs(f.client_email)} ?')">
            ${ic("envoi")} ${f.statut === "brouillon" ? "Envoyer \xE0" : "Renvoyer \xE0"} ${echapper(f.client_email)}</button>
        </form>`}
        ${modifiable ? `<a class="bouton" style="padding:13px 24px;font-size:14px"
          href="?cle=${cle}&page=facture&numero=${f.numero}&edit=1">${ic("crayon")} Modifier</a>` : ""}
        ${f.commande_shopify_id ? "" : `
        <form method="POST" action="?cle=${cle}&page=facture&numero=${f.numero}&action=payee" style="display:inline">
          <button class="envoyer" type="submit" style="background:#3F7A34;color:#fff"
            onclick="return confirm('Marquer la facture n\xB0 ${f.numero} comme pay\xE9e ?

Une vraie commande de ${euros3(f.montant)} sera cr\xE9\xE9e dans Shopify et comptera dans votre chiffre d'affaires.${f.client_email ? `\n\nUn email de confirmation de paiement sera envoy\xE9 \xE0 ${echapper(f.client_email)}.` : ""}')">
            ${ic("valide")} Marquer comme pay\xE9e</button>
        </form>`}
        <a class="bouton" href="${lien}" target="_blank" rel="noopener">Ouvrir / imprimer</a>
        <a class="bouton" href="?cle=${cle}&page=facturation">Retour aux factures</a>
      </div>

      ${annulee ? `<div class="alerte" style="margin-top:16px"><b>Facture annul\xE9e</b>
        le ${dateFr2(f.annulee_le)}${f.motif_annulation ? ` \u2014 ${echapper(f.motif_annulation)}` : ""}.
        Elle conserve son num\xE9ro : la s\xE9quence reste continue.</div>` : f.commande_shopify_id ? `<div class="note" style="margin-top:16px">
          Facture encaiss\xE9e. Pour l'annuler, annulez ou remboursez d'abord la commande
          <b>${echapper(f.commande_shopify)}</b> dans Shopify.</div>` : `<details style="margin-top:16px"><summary>Annuler cette facture</summary>
          <div class="dedans">
          <form class="f" method="POST" style="border:0;padding:0;background:none"
            action="?cle=${cle}&page=facture&numero=${f.numero}&action=annuler_facture">
            <label class="large">Motif <span style="font-weight:400">(appara\xEEtra dans l'email au client)</span>
              <input name="motif" placeholder="Erreur de montant"></label>
            ${f.statut === "envoy\xE9e" ? `<label class="large" style="flex-direction:row;align-items:center;gap:9px">
              <input type="checkbox" name="prevenir" value="1" checked style="width:auto">
              Pr\xE9venir le client par email</label>` : ""}
            <button class="envoyer large" type="submit" style="background:var(--rouge);color:#fff"
              onclick="return confirm('Annuler d\xE9finitivement la facture n\xB0 ${f.numero} ?')">
              Annuler la facture</button>
          </form></div></details>`}
      </section>

      <section><h2>Aper\xE7u</h2>
        <div class="apercu"><iframe src="${lien}" title="Facture n\xB0 ${f.numero}"></iframe></div>
      </section>`;
  }
  const clients = await clientsShopify(env);
  const aujourdhui2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  return `
    ${message || ""}
    <form class="f" method="POST" action="?cle=${cle}&page=facture&action=creer">
      <label class="large">Client existant
        <select id="choix" onchange="remplir()">
          <option value="">\u2014 Nouveau client, \xE0 saisir ci-dessous \u2014</option>
          ${clients.map((c) => `<option value="${echapper(c.email)}" data-nom="${echapper(c.displayName || "")}">
            ${echapper(c.displayName || c.email)} \u2014 ${echapper(c.email)}</option>`).join("")}
        </select></label>

      <label>Nom du client<input name="client_nom" id="nom" required placeholder="Nicolas Visine"></label>
      <label>Soci\xE9t\xE9 <span style="font-weight:400">(facultatif)</span>
        <input name="client_societe" placeholder="T\xF6sty.fr"></label>
      <label>Email du client<input name="client_email" id="email" type="email" required placeholder="client@exemple.com"></label>
      <label>Date<input name="date_facture" type="date" value="${aujourdhui2}" required></label>

      <label class="large">Nom de la prestation
        <input name="prestation" required placeholder="Accompagnement complet \u2014 1 mois"></label>
      <label class="large">Description d\xE9taill\xE9e
        <textarea name="description" required placeholder="Accompagnement complet \u2026&#10;&#10;L'objectif de cet accompagnement est \u2026"></textarea></label>
      <label>Montant TTC en euros<input name="montant" required inputmode="decimal" placeholder="400"></label>
      <div></div>
      <button class="envoyer large" type="submit">G\xE9n\xE9rer la facture</button>
    </form>
    <script>
      function remplir(){
        const o = document.getElementById('choix').selectedOptions[0];
        if(!o.value) return;
        document.getElementById('email').value = o.value;
        document.getElementById('nom').value = o.dataset.nom || '';
      }
    <\/script>`;
}
__name(pageFacture, "pageFacture");
__name2(pageFacture, "pageFacture");
__name22(pageFacture, "pageFacture");
async function pageDevis(env, url, message) {
  await assurerDevisSchema(env.DB);
  const cle = encodeURIComponent(env.CLE_TEST);
  const numero = url.searchParams.get("numero");
  const formulaire = /* @__PURE__ */ __name22((d, action, clients) => {
    const val = /* @__PURE__ */ __name22((k, def = "") => echapper(d && d[k] != null ? d[k] : def), "val");
    const aujourdhui = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const acompte = d ? Number(d.acompte_pct) : 50;
    return `
    <form class="f" method="POST" action="?cle=${cle}&page=devis${d ? `&numero=${d.numero}` : ""}&action=${action}"
      onsubmit="if(this.dataset.envoi){return false;}this.dataset.envoi='1';var b=this.querySelector('button[type=submit]');b.disabled=true;b.textContent='${d ? "Enregistrement" : "Cr\xE9ation du devis"} en cours\u2026';">
      ${clients && clients.length ? `<label class="large">Client existant
        <select id="choixD" onchange="remplirD()">
          <option value="">— Nouveau client, \xE0 saisir ci-dessous —</option>
          ${clients.map((c) => `<option value="${echapper(c.email)}" data-nom="${echapper(c.displayName || "")}">
            ${echapper(c.displayName || c.email)} — ${echapper(c.email)}</option>`).join("")}
        </select></label>` : ""}
      <label>Nom du client<input name="client_nom" id="nomD" required value="${val("client_nom")}" placeholder="Nicolas Visine"></label>
      <label>Soci\xE9t\xE9 <span style="font-weight:400">(facultatif)</span>
        <input name="client_societe" value="${val("client_societe")}" placeholder="T\xF6sty.fr"></label>
      <label>Email du client <span style="font-weight:400">(facultatif)</span><input name="client_email" id="emailD" type="email" value="${val("client_email")}" placeholder="client@exemple.com"></label>
      <label>T\xE9l\xE9phone <span style="font-weight:400">(facultatif)</span>
        <input name="client_telephone" value="${val("client_telephone")}" placeholder="+33 6 12 34 56 78"></label>
      <label class="large">Adresse du client <span style="font-weight:400">(facultatif)</span>
        <textarea name="client_adresse" style="min-height:70px" placeholder="12 rue de la Paix&#10;75002 Paris">${val("client_adresse")}</textarea></label>

      <label class="large">Titre du projet
        <input name="titre" required value="${val("titre")}" placeholder="Refonte compl\xE8te de la boutique Shopify"></label>
      <label class="large">Ce qui est inclus <span style="font-weight:400">(collez votre texte, la mise en forme est automatique)</span>
        <textarea name="contenu" required style="min-height:260px" placeholder="DESIGN&#10;- Refonte de la page d'accueil&#10;- Page produit optimis\xE9e pour la conversion — 350 €&#10;&#10;TECHNIQUE :&#10;- Installation des applications&#10;- Optimisation de la vitesse">${val("contenu")}</textarea></label>
      <p class="sec large" style="margin:-6px 0 4px;font-size:12.5px">Astuce : une ligne qui commence par \xAB - \xBB devient une puce coch\xE9e,
        une ligne en MAJUSCULES ou termin\xE9e par \xAB : \xBB devient un intertitre, un prix en fin de ligne (\xAB — 150 € \xBB) s'aligne \xE0 droite.</p>

      <label>Prix total TTC en euros<input name="montant" required inputmode="decimal" value="${val("montant")}" placeholder="1200"></label>
      <label>D\xE9lai de livraison<input name="delai_livraison" required value="${val("delai_livraison")}" placeholder="15 jours ouvr\xE9s"></label>
      <label>Acompte \xE0 la signature<select name="acompte_pct">
        ${[0, 30, 40, 50, 100].map((v) => `<option value="${v}"${v === acompte ? " selected" : ""}>${v === 0 ? "Aucun (100 % \xE0 la livraison)" : v === 100 ? "100 % \xE0 la signature" : `${v} %`}</option>`).join("")}
      </select></label>
      <label class="large" style="flex-direction:row;align-items:center;gap:10px">
        <input type="checkbox" name="express" value="1" style="width:auto" ${d && d.express_prix ? "checked" : ""}
          onchange="document.getElementById('blocExpress').style.display=this.checked?'contents':'none'">
        Proposer une livraison express (en option)</label>
      <div id="blocExpress" style="display:${d && d.express_prix ? "contents" : "none"}">
        <label>D\xE9lai en express<input name="express_delai" value="${val("express_delai")}" placeholder="5 jours ouvr\xE9s"></label>
        <label>Tarif de l'express en euros <span style="font-weight:400">(en plus du prix)</span>
          <input name="express_prix" inputmode="decimal" value="${val("express_prix")}" placeholder="200"></label>
      </div>
      <label>Validit\xE9 du devis (en jours)<input name="validite_jours" type="number" min="1" max="365" step="1" required
        value="${Number(d ? d.validite_jours : 30)}" placeholder="30"></label>
      <label>Date du devis<input name="date_devis" type="date" required value="${val("date_devis", aujourdhui).slice(0, 10)}"></label>
      <div></div>
      <label class="large">Conditions particuli\xE8res <span style="font-weight:400">(facultatif)</span>
        <textarea name="conditions" style="min-height:80px" placeholder="2 allers-retours de modifications inclus. Les contenus (textes, photos) sont fournis par le client.">${val("conditions")}</textarea></label>
      <button class="envoyer large" type="submit">${d ? "Enregistrer les modifications" : "G\xE9n\xE9rer le devis"}</button>
      <script>window.addEventListener("pageshow",function(){document.querySelectorAll("form[data-envoi]").forEach(function(f){delete f.dataset.envoi;var b=f.querySelector("button[type=submit]");b.disabled=false;b.textContent=${d ? '"Enregistrer les modifications"' : '"G\xE9n\xE9rer le devis"'};});});</script>
    </form>
    <script>
      function remplirD(){
        const o = document.getElementById('choixD').selectedOptions[0];
        if(!o.value) return;
        document.getElementById('emailD').value = o.value;
        document.getElementById('nomD').value = o.dataset.nom || '';
      }
    <\/script>`;
  }, "formulaire");

  if (numero === "nouveau") {
    return `${message || ""}${formulaire(null, "creer_devis", await clientsShopify(env))}`;
  }
  if (numero) {
    const d = await lireDevis(env.DB, Number(numero));
    if (!d) return `<div class="alerte">Devis introuvable.</div>`;
    const num = numeroDevis(d);
    const lien = `${url.origin}/d/${d.jeton}`;
    const verrouille = !!d.facture_numero;
    await assurerContratsSchema(env.DB);
    const contrat = await lireContrat(env.DB, d.numero);
    if (url.searchParams.get("edit")) {
      return `${message || ""}${formulaire(d, "modifier_devis", null)}
        <div class="actions"><a class="bouton" href="?cle=${cle}&page=devis&numero=${d.numero}">Annuler la modification</a></div>`;
    }
    const expire = !["accept\xE9", "factur\xE9"].includes(d.statut) && finValiditeDevis(d) < (/* @__PURE__ */ new Date()).toISOString();
    const boutonStatut = /* @__PURE__ */ __name22((st, libelle, style = "") => `
      <form method="POST" action="?cle=${cle}&page=devis&numero=${d.numero}&action=statut_devis&statut=${encodeURIComponent(st)}" style="display:inline">
        <button class="envoyer" type="submit" style="${style}">${libelle}</button></form>`, "boutonStatut");
    return `
      ${message || ""}
      <section><div class="grille">
        <div class="carte neutre"><div class="k">Devis</div><div class="v txt">n\xB0 ${num}</div>
          <div class="s">${echapper(d.titre)}</div></div>
        <div class="carte neutre"><div class="k">Montant</div><div class="v">${euros3(d.montant)}</div>
          <div class="s">livraison : ${echapper(d.delai_livraison)}</div></div>
        <div class="carte ${d.statut === "accept\xE9" || d.statut === "factur\xE9" ? "bon" : d.statut === "envoy\xE9" ? "moyen" : "neutre"}">
          <div class="k">Statut</div><div class="v txt">${echapper(d.statut)}</div>
          <div class="s">${expire ? "validit\xE9 d\xE9pass\xE9e" : `valable jusqu'au ${dateFr(finValiditeDevis(d))}`}${d.envoye_le ? ` \xB7 envoy\xE9 le ${dateFr2(d.envoye_le)}` : ""}</div></div>
        ${d.facture_numero ? `<div class="carte bon"><div class="k">Facture</div>
          <div class="v txt"><a href="?cle=${cle}&page=facture&numero=${d.facture_numero}">n\xB0 ${d.facture_numero}</a></div></div>` : ""}
      </div></section>

      <section><div class="actions">
        ${d.client_email ? `<form method="POST" action="?cle=${cle}&page=devis&numero=${d.numero}&action=envoyer_devis" style="display:inline">
          <button class="envoyer" type="submit"
            onclick="return confirm('Envoyer le devis n\xB0 ${num} \xE0 ${echapperJs(d.client_email)} ?')">
            ${ic("envoi")} ${d.envoye_le ? "Renvoyer \xE0" : "Envoyer \xE0"} ${echapper(d.client_email)}</button>
        </form>` : ""}
        <a class="bouton" href="${lien}?telecharger=1" target="_blank" rel="noopener">T\xE9l\xE9charger le PDF</a>
        <a class="bouton" href="${lien}" target="_blank" rel="noopener">Ouvrir / imprimer</a>
        <a class="bouton" style="padding:13px 24px;font-size:14px"
          href="?cle=${cle}&page=devis&numero=${d.numero}&edit=1">${ic("crayon")} Modifier</a>
        <a class="bouton" href="?cle=${cle}&page=${contrat ? `contrats&devis=${d.numero}` : `contrats&action=creer_contrat&devis=${d.numero}`}"
          ${contrat ? "" : `onclick="event.preventDefault();document.getElementById('fcontrat').submit()"`}>${contrat ? "Voir le contrat" : "Cr\xE9er le contrat"}</a>
        <a class="bouton" href="?cle=${cle}&page=devis">Retour aux devis</a>
      </div>
      <form id="fcontrat" method="POST" action="?cle=${cle}&page=contrats&action=creer_contrat&devis=${d.numero}" style="display:none"></form>
      <div class="actions" style="margin-top:12px">
        ${verrouille ? "" : `${d.statut !== "accept\xE9" ? boutonStatut("accept\xE9", `${ic("valide")} Le client accepte`, "background:#3F7A34;color:#fff") : ""}
        ${d.statut !== "refus\xE9" ? boutonStatut("refus\xE9", "Le client refuse", "background:var(--surface2);color:var(--encre)") : ""}
        <form method="POST" action="?cle=${cle}&page=devis&numero=${d.numero}&action=facturer_devis" style="display:inline">
          <button class="envoyer" type="submit" style="background:var(--encre);color:var(--fond)"
            onclick="return confirm('Cr\xE9er une facture (brouillon) de ${euros3(d.montant)} \xE0 partir de ce devis ?')">
            Transformer en facture</button></form>`}
        <form method="POST" action="?cle=${cle}&page=devis&numero=${d.numero}&action=supprimer_devis" style="display:inline">
          <button class="envoyer" type="submit" style="background:var(--rouge);color:#fff"
            onclick="return confirm('Supprimer d\xE9finitivement le devis n\xB0 ${num} ?${verrouille ? ` La facture n\xB0 ${d.facture_numero} est conserv\xE9e.` : ""}')">Supprimer</button></form>
      </div>
      </section>

      <section><h2>Aper\xE7u</h2>
        <div class="apercu"><iframe src="${lien}" title="Devis n\xB0 ${num}"></iframe></div>
      </section>`;
  }
  const { results: tousDevis = [] } = await env.DB.prepare(`SELECT numero, date_devis, validite_jours, client_nom, client_societe, client_email,
      titre, montant, statut, facture_numero, jeton FROM devis ORDER BY numero DESC LIMIT 100`).all();
  const somme = /* @__PURE__ */ __name22((l) => l.reduce((t, d) => t + Number(d.montant || 0), 0), "somme");
  const enCours = tousDevis.filter((d) => d.statut === "brouillon" || d.statut === "envoy\xE9");
  const gagnes = tousDevis.filter((d) => d.statut === "accept\xE9" || d.statut === "factur\xE9");
  const decides = tousDevis.filter((d) => d.statut === "accept\xE9" || d.statut === "factur\xE9" || d.statut === "refus\xE9");
  const ligne = /* @__PURE__ */ __name22((d) => `<tr>
      <td class="nowrap"><b>${numeroDevis(d)}</b></td>
      <td>${echapper(d.client_nom)}${d.client_societe ? `<br><span class="sec">${echapper(d.client_societe)}</span>` : ""}</td>
      <td>${echapper(d.titre)}</td>
      <td class="nowrap">${dateFr2(d.date_devis, false)}</td>
      <td class="num"><b>${euros3(d.montant)}</b></td>
      <td>${pastille(d.statut)}</td>
      <td class="nowrap"><div style="display:flex;gap:6px;flex-wrap:wrap">
        <a class="bouton pale" href="?cle=${cle}&page=devis&numero=${d.numero}">Ouvrir</a>
        <a class="bouton pale" href="?cle=${cle}&page=devis&numero=${d.numero}&edit=1">${ic("crayon")} Modifier</a>
        <a class="bouton pale" href="/d/${echapper(d.jeton)}?telecharger=1" target="_blank" rel="noopener">PDF</a>
        <form method="POST" action="?cle=${cle}&page=devis&numero=${d.numero}&action=supprimer_devis" style="display:inline;margin:0">
          <button class="bouton pale" type="submit" style="color:var(--rouge);cursor:pointer"
            onclick="return confirm('Supprimer d\xE9finitivement le devis n\xB0 ${numeroDevis(d)} ?')">Supprimer</button></form>
      </div></td>
    </tr>`, "ligne");
  return `
  ${message || ""}
  <section><div class="grille">
    <div class="carte ${enCours.length ? "moyen" : "neutre"}"><div class="k">En attente de r\xE9ponse</div>
      <div class="v">${euros3(somme(enCours))}</div><div class="s">${enCours.length} devis</div></div>
    <div class="carte bon"><div class="k">Accept\xE9s</div><div class="v">${euros3(somme(gagnes))}</div>
      <div class="s">${gagnes.length} devis</div></div>
    <div class="carte neutre"><div class="k">Taux d'acceptation</div>
      <div class="v">${decides.length ? Math.round(gagnes.length / decides.length * 100) + " %" : "—"}</div>
      <div class="s">sur ${decides.length} devis tranch\xE9(s)</div></div>
  </div></section>

  <section><div class="actions" style="margin-bottom:13px">
      <a class="bouton gros" href="?cle=${cle}&page=devis&numero=nouveau">${ic("plus")} Nouveau devis</a></div>
    ${tableauHtml(
    [
      { nom: "N\xB0" },
      { nom: "Client" },
      { nom: "Projet" },
      { nom: "Date", classe: "nowrap" },
      { nom: "Montant", classe: "num" },
      { nom: "Statut" },
      { nom: "" }
    ],
    tousDevis.map(ligne),
    "Aucun devis pour l'instant. Cliquez sur \xAB Nouveau devis \xBB, collez ce qui est inclus, et l'application le met en page.",
    "tab-devis"
  )}
  </section>`;
}
__name22(pageDevis, "pageDevis");
async function pageContrats(env, url, message) {
  await assurerContratsSchema(env.DB);
  const cle = encodeURIComponent(env.CLE_TEST);
  const numero = Number(url.searchParams.get("devis") || 0);
  if (numero) {
    const c = await lireContrat(env.DB, numero);
    const d = await lireDevis(env.DB, numero);
    if (!c || !d) return `<div class="alerte">Contrat introuvable.</div>`;
    const num = numeroDevis(d);
    const lien = `${url.origin}/c/${c.jeton}`;
    const st = statutContrat(c);
    const act = /* @__PURE__ */ __name22((a) => `?cle=${cle}&page=contrats&devis=${numero}&action=${a}`, "act");
    return `
      ${message || ""}
      <style>${STYLE_PAVE}</style>
      <section><div class="grille">
        <div class="carte neutre"><div class="k">Contrat</div><div class="v txt">n\xB0 ${num}</div>
          <div class="s">${echapper(d.titre)} \xB7 ${euros3(d.montant)}</div></div>
        <div class="carte ${c.presta_signature ? "bon" : "moyen"}"><div class="k">Votre signature</div>
          <div class="v txt">${c.presta_signature ? "sign\xE9" : "\xE0 faire"}</div>
          <div class="s">${c.presta_signe_le ? `le ${dateFr2(c.presta_signe_le)}` : "signez ci-dessous"}</div></div>
        <div class="carte ${c.client_signature ? "bon" : "neutre"}"><div class="k">Signature du client</div>
          <div class="v txt">${c.client_signature ? "sign\xE9" : "en attente"}</div>
          <div class="s">${c.client_signe_le ? `${echapper(c.client_signataire || "")} \xB7 le ${dateFr2(c.client_signe_le)}` : c.envoye_le ? `envoy\xE9 le ${dateFr2(c.envoye_le)}` : "pas encore envoy\xE9"}</div></div>
      </div></section>

      <section><div class="actions">
        ${c.client_signature ? "" : `${d.client_email ? `<form method="POST" action="${act("envoyer_contrat")}" style="display:inline">
          <button class="envoyer" type="submit"
            onclick="return confirm('Envoyer le contrat \xE0 signer \xE0 ${echapperJs(d.client_email)} ?')">
            ${ic("envoi")} ${c.envoye_le ? "Renvoyer" : "Envoyer"} \xE0 signer \xE0 ${echapper(d.client_email)}</button></form>` : ""}
        <button class="bouton" type="button" onclick="navigator.clipboard.writeText('${lien}').then(function(){alert('Lien de signature copi\xE9 : vous pouvez l\\'envoyer par WhatsApp ou email.')})">Copier le lien de signature</button>`}
        <a class="bouton" href="${lien}?telecharger=1" target="_blank" rel="noopener">T\xE9l\xE9charger le PDF</a>
        <a class="bouton" href="?cle=${cle}&page=devis&numero=${numero}">Voir le devis</a>
        <a class="bouton" href="?cle=${cle}&page=contrats">Retour aux contrats</a>
      </div></section>

      <section><h2>${c.presta_signature ? "Votre signature" : "Signer le contrat"}</h2>
        ${c.presta_signature ? `<img src="${echapper(c.presta_signature)}" alt="Votre signature"
            style="height:80px;background:#fff;border:1px solid var(--trait);border-radius:9px;padding:6px 10px">
          <details style="margin-top:10px"><summary>Refaire ma signature</summary><div class="dedans">` : ""}
        <form method="POST" action="${act("signer_contrat")}"
          onsubmit="if(!document.getElementById('sig').value){alert('Dessinez votre signature dans le cadre.');return false;}">
          <p class="sec" style="margin:0 0 8px">Dessinez votre signature \xE0 la souris ou au doigt, puis validez.</p>
          ${PAVE_SIGNATURE}
          <button class="envoyer" type="submit" style="margin-top:12px">${ic("valide")} Signer en tant que prestataire</button>
        </form>
        ${c.presta_signature ? `</div></details>` : ""}
      </section>

      ${c.client_signature ? `<div class="note">Le client a sign\xE9 : le contrat ne peut plus \xEAtre modifi\xE9.</div>` : `
      <section><details><summary>Modifier les clauses du contrat</summary><div class="dedans">
        <form class="f" method="POST" action="${act("modifier_contrat")}" style="border:0;padding:0;background:none">
          <label>Signataire pour le prestataire<input name="presta_nom" value="${echapper(c.presta_nom || "")}"></label>
          <div></div>
          <label class="large">Clauses <span style="font-weight:400">(une ligne en MAJUSCULES devient un titre d'article)</span>
            <textarea name="clauses" style="min-height:420px">${echapper(c.clauses)}</textarea></label>
          <p class="sec large" style="margin:-4px 0 0;font-size:12.5px">Modifier le texte annule votre signature : vous re-signez la version finale.</p>
          <button class="envoyer large" type="submit">Enregistrer les clauses</button>
        </form></div></details></section>`}

      <section><details><summary>Supprimer ce contrat</summary><div class="dedans">
        <form method="POST" action="${act("supprimer_contrat")}" style="display:inline">
          <button class="envoyer" type="submit" style="background:var(--rouge);color:#fff"
            onclick="return confirm('Supprimer le contrat n\xB0 ${num} ? Les signatures seront perdues. Le devis est conserv\xE9.')">Supprimer le contrat</button></form>
      </div></details></section>

      <section><h2>Aper\xE7u</h2>
        <div class="apercu"><iframe src="${lien}?apercu=1" title="Contrat n\xB0 ${num}"></iframe></div>
      </section>`;
  }
  const { results: lignes = [] } = await env.DB.prepare(`SELECT c.devis_numero, c.presta_signe_le, c.client_signe_le, c.envoye_le, c.jeton,
      (c.presta_signature IS NOT NULL) AS ps, (c.client_signature IS NOT NULL) AS cs,
      d.date_devis, d.client_nom, d.client_societe, d.titre, d.montant
    FROM contrats c JOIN devis d ON d.numero = c.devis_numero ORDER BY c.devis_numero DESC LIMIT 100`).all();
  const { results: sansContrat = [] } = await env.DB.prepare(`SELECT numero, date_devis, client_nom, titre, montant FROM devis
    WHERE numero NOT IN (SELECT devis_numero FROM contrats) ORDER BY numero DESC LIMIT 100`).all();
  const statutL = /* @__PURE__ */ __name22((l) => statutContrat({ presta_signature: l.ps, client_signature: l.cs, envoye_le: l.envoye_le }), "statutL");
  const ligne = /* @__PURE__ */ __name22((l) => `<tr>
      <td class="nowrap"><b>${numeroDevis({ numero: l.devis_numero })}</b></td>
      <td>${echapper(l.client_nom)}${l.client_societe ? `<br><span class="sec">${echapper(l.client_societe)}</span>` : ""}</td>
      <td>${echapper(l.titre)}</td>
      <td class="num"><b>${euros3(l.montant)}</b></td>
      <td>${pastille(statutL(l))}</td>
      <td class="nowrap"><div style="display:flex;gap:6px;flex-wrap:wrap">
        <a class="bouton pale" href="?cle=${cle}&page=contrats&devis=${l.devis_numero}">Ouvrir</a>
        <a class="bouton pale" href="/c/${echapper(l.jeton)}?telecharger=1" target="_blank" rel="noopener">PDF</a>
      </div></td>
    </tr>`, "ligne");
  const signes = lignes.filter((l) => l.ps && l.cs);
  return `
  ${message || ""}
  <section><div class="grille">
    <div class="carte neutre"><div class="k">Contrats</div><div class="v">${lignes.length}</div></div>
    <div class="carte ${lignes.length - signes.length ? "moyen" : "neutre"}"><div class="k">En attente de signature</div>
      <div class="v">${lignes.length - signes.length}</div></div>
    <div class="carte bon"><div class="k">Sign\xE9s par les deux parties</div><div class="v">${signes.length}</div>
      <div class="s">${euros3(signes.reduce((t, l) => t + Number(l.montant || 0), 0))}</div></div>
  </div></section>

  <section><h2>Nouveau contrat</h2>
    ${sansContrat.length ? `<form class="f" method="POST" action="?cle=${cle}&page=contrats&action=creer_contrat">
      <label class="large">\xC0 partir du devis
        <select name="devis" required>
          ${sansContrat.map((d) => `<option value="${d.numero}">n\xB0 ${numeroDevis(d)} — ${echapper(d.client_nom)} — ${echapper(d.titre)} — ${euros3(d.montant)}</option>`).join("")}
        </select></label>
      <button class="envoyer large" type="submit">G\xE9n\xE9rer le contrat</button>
    </form>` : `<div class="note">Tous vos devis ont d\xE9j\xE0 un contrat. <a href="?cle=${cle}&page=devis&numero=nouveau">Cr\xE9er un devis →</a></div>`}
  </section>

  <section><h2>Mes contrats</h2>
    ${tableauHtml(
    [{ nom: "N\xB0" }, { nom: "Client" }, { nom: "Projet" }, { nom: "Montant", classe: "num" }, { nom: "Statut" }, { nom: "" }],
    lignes.map(ligne),
    "Aucun contrat pour l'instant. Choisissez un devis ci-dessus pour g\xE9n\xE9rer le premier.",
    "tab-contrats"
  )}</section>`;
}
__name22(pageContrats, "pageContrats");
async function pageMeeting(env, url, message) {
  const cle = encodeURIComponent(env.CLE_TEST);
  const id = url.searchParams.get("id");
  if (id) {
    const m = await lireMeeting(env.DB, Number(id));
    if (!m) return `<div class="alerte">Rendez-vous introuvable.</div>`;
    const annule = m.statut === "annul\xE9";
    const d = new Date(m.debut);
    const partie = /* @__PURE__ */ __name22((opt) => new Intl.DateTimeFormat("sv-SE", { timeZone: m.fuseau, ...opt }).format(d), "partie");
    if (url.searchParams.get("edit") && !annule) {
      return `${message || ""}
        <form class="f" method="POST" action="?cle=${cle}&page=meeting&id=${m.id}&action=modifier_meeting">
          <label>Nom<input name="client_nom" required value="${echapper(m.client_nom)}"></label>
          <label>Email<input name="client_email" type="email" required value="${echapper(m.client_email)}"></label>
          <label class="large">Sujet<input name="sujet" required value="${echapper(m.sujet)}"></label>
          <label>Date<input name="date" type="date" required value="${partie({ year: "numeric", month: "2-digit", day: "2-digit" })}"></label>
          <label>Heure<input name="heure" type="time" required value="${partie({ hour: "2-digit", minute: "2-digit", hour12: false })}"></label>
          <label>Dur\xE9e<select name="duree_min">
            ${[15, 30, 45, 60].map((v) => `<option value="${v}"${v === m.duree_min ? " selected" : ""}>${v} minutes</option>`).join("")}
          </select></label>
          <label>Fuseau<select name="fuseau">
            ${["Africa/Casablanca", "Europe/Paris", "Europe/Berlin", "Europe/London"].map((v) => `<option value="${v}"${v === m.fuseau ? " selected" : ""}>${v.split("/")[1]}</option>`).join("")}
          </select></label>
          <label class="large">Message<textarea name="note" style="min-height:100px">${echapper(m.note || "")}</textarea></label>
          <button class="envoyer large" type="submit">Enregistrer${m.google_event_id ? " et mettre \xE0 jour l'agenda" : ""}</button>
        </form>
        <div class="actions"><a class="bouton" href="?cle=${cle}&page=meeting&id=${m.id}">Annuler la modification</a></div>`;
    }
    return `
      ${message || ""}
      <section><div class="grille">
        <div class="carte neutre"><div class="k">Sujet</div><div class="v txt">${echapper(m.sujet)}</div></div>
        <div class="carte neutre"><div class="k">Quand</div><div class="v txt">${echapper(quandFr(m.debut, m.fuseau))}</div>
          <div class="s">${m.duree_min} minutes \xB7 ${echapper(m.fuseau)}</div></div>
        <div class="carte ${m.statut === "envoy\xE9" ? "bon" : "moyen"}">
          <div class="k">Statut</div><div class="v txt">${echapper(m.statut)}</div>
          <div class="s">${m.envoye_le ? dateFr2(m.envoye_le) : "invitation pas encore envoy\xE9e"}</div></div>
      </div></section>

      <section><div class="actions">
        ${annule ? "" : `
        <form method="POST" action="?cle=${cle}&page=meeting&id=${m.id}&action=envoyer_meeting" style="display:inline">
          <button class="envoyer" type="submit"
            onclick="return confirm('Envoyer l'invitation \xE0 ${echapperJs(m.client_email)} ?')">
            ${ic("envoi")} ${m.statut === "envoy\xE9" ? "Renvoyer" : "Envoyer"} l'invitation</button>
        </form>
        <a class="bouton" style="padding:13px 24px;font-size:14px"
          href="?cle=${cle}&page=meeting&id=${m.id}&edit=1">${ic("crayon")} Modifier</a>`}
        ${m.lien_meet ? `<a class="bouton" href="${echapper(m.lien_meet)}" target="_blank" rel="noopener">Ouvrir la visio</a>` : ""}
        <a class="bouton" href="?cle=${cle}&page=meeting">Retour</a>
      </div>

      ${annule ? `<div class="alerte" style="margin-top:16px"><b>Rendez-vous annul\xE9</b>
        le ${dateFr2(m.annule_le)}.${m.google_event_id ? " L'\xE9v\xE9nement a \xE9t\xE9 retir\xE9 de votre agenda." : ""}</div>` : ""}

      <details style="margin-top:16px"><summary>${annule ? "Supprimer ce rendez-vous" : "Annuler ou supprimer ce rendez-vous"}</summary>
        <div class="dedans"><div class="actions">
          ${annule ? "" : `
          <form method="POST" action="?cle=${cle}&page=meeting&id=${m.id}&action=annuler_meeting" style="display:inline">
            ${m.statut === "envoy\xE9" ? `<label style="font-size:13px;display:block;margin-bottom:9px">
              <input type="checkbox" name="prevenir" value="1" checked> Pr\xE9venir le client par email</label>` : ""}
            <button class="envoyer" type="submit" style="background:var(--rouge);color:#fff"
              onclick="return confirm('Annuler ce rendez-vous ?${m.google_event_id ? " L'\xE9v\xE9nement sera retir\xE9 de votre agenda Google." : ""}')">
              Annuler le rendez-vous</button></form>`}
          <form method="POST" action="?cle=${cle}&page=meeting&id=${m.id}&action=supprimer_meeting" style="display:inline">
            <button class="envoyer" type="submit" style="background:var(--surface2);color:var(--encre)"
              onclick="return confirm('Supprimer d\xE9finitivement ce rendez-vous ? Aucune trace ne sera conserv\xE9e.')">
              Supprimer</button></form>
        </div></div></details>
      </section>

      <section><h2>Aper\xE7u de l'invitation</h2>
        <div class="apercu" style="padding:0">
          <iframe style="height:760px" srcdoc="${echapper(gabaritInvitation(m, env))}" title="Invitation"></iframe>
        </div></section>`;
  }
  const clients = await clientsShopify(env);
  const meetings = await listeMeetings(env.DB, 40);
  const google = await etatGoogle(env.DB);
  const maintenant = new Date(Date.now() + 864e5);
  const demain = maintenant.toISOString().slice(0, 10);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const aVenir = meetings.filter((m) => m.debut >= nowIso && m.statut !== "annul\xE9").sort((a, b) => a.debut.localeCompare(b.debut));
  const passes = meetings.filter((m) => m.debut < nowIso || m.statut === "annul\xE9");
  const ligneM = /* @__PURE__ */ __name22((m) => `<tr>
      <td><b>${echapper(m.sujet)}</b></td>
      <td>${echapper(m.client_nom)}<br><span class="sec">${echapper(m.client_email)}</span></td>
      <td class="nowrap">${echapper(quandFr(m.debut, m.fuseau))}</td>
      <td class="num">${m.duree_min} min</td>
      <td>${pastille(m.statut)}</td>
      <td class="nowrap"><a class="bouton pale" href="?cle=${cle}&page=meeting&id=${m.id}">Ouvrir</a></td>
    </tr>`, "ligneM");
  const ENTETES_M = [
    { nom: "Sujet" },
    { nom: "Client" },
    { nom: "Quand", classe: "nowrap" },
    { nom: "Dur\xE9e", classe: "num" },
    { nom: "Statut" },
    { nom: "" }
  ];
  return `
    ${message || ""}
    ${google.connecte ? `<div class="reussite">Agenda Google connect\xE9${google.compte ? ` \u2014 <b>${echapper(google.compte)}</b>` : ""}.
          Le lien Meet et l'\xE9v\xE9nement dans votre agenda seront cr\xE9\xE9s automatiquement.</div>` : `<div class="note">Agenda Google non connect\xE9 : vous devez fournir un lien de visio.
          <a href="?cle=${cle}&page=google">Connecter l'agenda \u2192</a></div>`}
    <section><h2>Prochains rendez-vous</h2>${tableauHtml(
    ENTETES_M,
    aVenir.map(ligneM),
    "Rien de pr\xE9vu. Utilisez un des deux formulaires ci-dessous.",
    "tab-avenir"
  )}</section>

    <section><h2>Rendez-vous imm\xE9diat</h2>
    <p class="sec" style="margin:-4px 0 11px">Le lien est g\xE9n\xE9r\xE9, l'invitation part aussit\xF4t, et le client peut vous rejoindre dans la minute.</p>
    <form class="f" method="POST" action="?cle=${cle}&page=meeting&action=meeting_now"
      style="border-left:4px solid var(--jaune)">
      <label class="large">Client existant
        <select id="choixN" onchange="remplirN()">
          <option value="">\u2014 Nouveau contact \u2014</option>
          ${clients.map((c) => `<option value="${echapper(c.email)}" data-nom="${echapper(c.displayName || "")}">
            ${echapper(c.displayName || c.email)} \u2014 ${echapper(c.email)}</option>`).join("")}
        </select></label>
      <label>Nom<input name="client_nom" id="nomN" required placeholder="Nicolas Visine"></label>
      <label>Email<input name="client_email" id="emailN" type="email" required placeholder="client@exemple.com"></label>
      <label>Sujet<input name="sujet" value="Appel AdamEcom"></label>
      <label>Dur\xE9e pr\xE9vue<select name="duree_min">
        <option value="15">15 minutes</option><option value="30" selected>30 minutes</option>
        <option value="45">45 minutes</option><option value="60">1 heure</option></select></label>
      ${google.connecte ? "" : `<label class="large">Lien de visioconf\xE9rence
        <input name="lien_meet" required placeholder="https://meet.google.com/abc-defg-hij"></label>`}
      <button class="envoyer large" type="submit"
        onclick="return confirm('Cr\xE9er le rendez-vous et envoyer l'invitation tout de suite ?')">
        ${ic("eclair")} D\xE9marrer et envoyer l'invitation</button>
    </form>
    <script>
      function remplirN(){
        const o=document.getElementById('choixN').selectedOptions[0];
        if(!o.value) return;
        document.getElementById('emailN').value=o.value;
        document.getElementById('nomN').value=o.dataset.nom||'';
      }
    <\/script></section>

    <section><h2>Programmer un rendez-vous</h2>
    <form class="f" method="POST" action="?cle=${cle}&page=meeting&action=creer_meeting">
      <label class="large">Client existant
        <select id="choixM" onchange="remplirM()">
          <option value="">\u2014 Nouveau contact, \xE0 saisir ci-dessous \u2014</option>
          ${clients.map((c) => `<option value="${echapper(c.email)}" data-nom="${echapper(c.displayName || "")}">
            ${echapper(c.displayName || c.email)} \u2014 ${echapper(c.email)}</option>`).join("")}
        </select></label>

      <label>Nom<input name="client_nom" id="nomM" required placeholder="Nicolas Visine"></label>
      <label>Email<input name="client_email" id="emailM" type="email" required placeholder="client@exemple.com"></label>

      <label class="large">Sujet du rendez-vous
        <input name="sujet" required placeholder="Point mensuel \u2014 performances et prochaines actions"></label>

      <label>Date<input name="date" type="date" value="${demain}" required></label>
      <label>Heure<input name="heure" type="time" value="15:00" required></label>

      <label>Dur\xE9e
        <select name="duree_min">
          <option value="15">15 minutes</option>
          <option value="30" selected>30 minutes</option>
          <option value="45">45 minutes</option>
          <option value="60">1 heure</option>
        </select></label>
      <label>Fuseau horaire
        <select name="fuseau">
          <option value="Africa/Casablanca" selected>Casablanca</option>
          <option value="Europe/Paris">Paris</option>
          <option value="Europe/Berlin">Berlin</option>
          <option value="Europe/London">Londres</option>
        </select></label>

      <label class="large">Lien de visioconf\xE9rence
        ${google.connecte ? `<span style="font-weight:400;color:var(--gris);font-size:12px">
            Laissez vide : Google cr\xE9era une salle Meet d\xE9di\xE9e \xE0 ce rendez-vous.</span>` : ""}
        <input name="lien_meet" ${google.connecte ? "" : "required"}
          placeholder="${google.connecte ? "g\xE9n\xE9r\xE9 automatiquement par Google" : "https://meet.google.com/abc-defg-hij"}"
          value="${echapper(google.connecte ? "" : env.LIEN_MEET_DEFAUT || "")}"></label>
      <label class="large">Message pour le client <span style="font-weight:400">(facultatif)</span>
        <textarea name="note" style="min-height:100px" placeholder="Pr\xE9parez si possible vos chiffres du mois\u2026"></textarea></label>

      <button class="envoyer large" type="submit">Cr\xE9er l'invitation</button>
    </form>
    <script>
      function remplirM(){
        const o=document.getElementById('choixM').selectedOptions[0];
        if(!o.value) return;
        document.getElementById('emailM').value=o.value;
        document.getElementById('nomM').value=o.dataset.nom||'';
      }
    <\/script></section>

    <section><details><summary>Rendez-vous pass\xE9s et annul\xE9s
      <span class="sec" style="font-weight:400"> \u2014 ${passes.length}</span></summary>
      <div class="dedans">${tableauHtml(
    ENTETES_M,
    passes.map(ligneM),
    "Aucun rendez-vous pass\xE9.",
    "tab-passes"
  )}</div></details></section>`;
}
__name(pageMeeting, "pageMeeting");
__name2(pageMeeting, "pageMeeting");
__name22(pageMeeting, "pageMeeting");
var RADAR_HOTES_EXCLUS = /* @__PURE__ */ new Set([
  "facebook.com",
  "fb.me",
  "fb.com",
  "m.me",
  "messenger.com",
  "instagram.com",
  "l.facebook.com",
  "lm.facebook.com",
  "wa.me",
  "whatsapp.com",
  "linktr.ee",
  "bit.ly",
  "tinyurl.com",
  "linkin.bio",
  "beacons.ai",
  "taplink.cc",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "pinterest.com",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "snapchat.com",
  "google.com",
  "goo.gl",
  "shopify.com",
  "myshopify.com",
  "amazon.fr",
  "amazon.com",
  "etsy.com",
  "ebay.fr",
  "ebay.com",
  "cdiscount.com",
  "fnac.com",
  "aliexpress.com",
  "temu.com",
  "rakuten.com",
  "walmart.com",
  "leboncoin.fr",
  "minea.com",
  "selfnamed.com",
  "fudge.ai",
  "eachspy.com",
  "themeforest.net",
  "fuelthemes.net",
  "inspiredtheme.com",
  "status.brave.app"
]);
function radarNormaliserDomaine(brut) {
  if (!brut) return null;
  let s = String(brut).trim().toLowerCase();
  s = s.replace(/^[«"'\s]+|[»"'\s.,;:!?]+$/g, "");
  s = s.replace(/^https?:\/\//, "").replace(/^\/\//, "");
  s = s.split(/[/?#\s]/)[0].replace(/^www\./, "");
  if (!s || s.length > 253) return null;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(s)) return null;
  if (RADAR_HOTES_EXCLUS.has(s)) return null;
  for (const h of RADAR_HOTES_EXCLUS) if (s.endsWith("." + h)) return null;
  return s;
}
__name(radarNormaliserDomaine, "radarNormaliserDomaine");
__name2(radarNormaliserDomaine, "radarNormaliserDomaine");
function radarEstSourceWeb(source) {
  return source === "google_gemini" || source === "web_brave" || source === "common_crawl";
}
__name(radarEstSourceWeb, "radarEstSourceWeb");
__name2(radarEstSourceWeb, "radarEstSourceWeb");
function radarLibelleSource(source) {
  return source === "meta" ? "Meta Ad Library" : source === "google_gemini" ? "Google via Gemini" : source === "common_crawl" ? "Index Shopify public" : "Recherche web";
}
__name(radarLibelleSource, "radarLibelleSource");
__name2(radarLibelleSource, "radarLibelleSource");
var RADAR_CHAMPS = [
  { cle: "ad_creative_link_captions", methode: "caption", confiance: 92 },
  { cle: "ad_creative_link_titles", methode: "titre", confiance: 70 },
  { cle: "ad_creative_link_descriptions", methode: "description", confiance: 62 },
  { cle: "ad_creative_bodies", methode: "texte", confiance: 55 }
];
function radarDomaineDepuisPub(pub) {
  for (const { cle, methode, confiance } of RADAR_CHAMPS) {
    for (const v of [].concat(pub?.[cle] || [])) {
      for (const jeton of String(v).split(/[\s,;()<>[\]"«»]+/)) {
        const d = radarNormaliserDomaine(jeton);
        if (d) return { domaine: d, confiance, methode, raisons: ["trouv\xE9 dans " + methode] };
      }
    }
  }
  return { domaine: null, confiance: 0, methode: null, raisons: ["aucun domaine dans le texte"] };
}
__name(radarDomaineDepuisPub, "radarDomaineDepuisPub");
__name2(radarDomaineDepuisPub, "radarDomaineDepuisPub");
var RADAR_SIGNES_SHOPIFY = [
  [/cdn\.shopify\.com/i, 40, "cdn.shopify.com"],
  [/\/cdn\/shop\//i, 30, "chemin /cdn/shop/"],
  [/window\.Shopify\b/i, 30, "objet window.Shopify"],
  [/Shopify\.theme\b/i, 25, "Shopify.theme"],
  [/myshopify\.com/i, 25, "domaine myshopify.com"],
  [/shopify-features/i, 15, "script shopify-features"]
];
function radarDetecterShopify(html, entetes) {
  let points = 0;
  const preuves = [];
  for (const [re, p, nom] of RADAR_SIGNES_SHOPIFY) {
    if (re.test(html || "")) {
      points += p;
      preuves.push(nom);
    }
  }
  for (const [k, v] of Object.entries(entetes || {})) {
    const cle = k.toLowerCase();
    if (cle === "x-shopid" || cle === "x-shopify-stage" || cle === "x-sorting-hat-shopid") {
      points += 65;
      preuves.push("en-t\xEAte " + cle);
    }
    if (cle === "powered-by" && /shopify/i.test(String(v))) {
      points += 65;
      preuves.push("en-t\xEAte powered-by");
    }
  }
  const confiance = Math.min(100, points);
  return { statut: confiance >= 60 ? "oui" : confiance >= 25 ? "incertain" : "non", confiance, preuves };
}
__name(radarDetecterShopify, "radarDetecterShopify");
__name2(radarDetecterShopify, "radarDetecterShopify");
var RADAR_TECHNOS = [
  ["Klaviyo", /static\.klaviyo\.com|klaviyo\.js|_learnq/i],
  ["Loox", /loox\.io|loox-/i],
  ["Judge.me", /judge\.me|judgeme/i],
  ["Yotpo", /yotpo\.com|yotpo-/i],
  ["Recharge", /rechargepayments|recharge-/i],
  ["WideBundle", /widebundle/i],
  ["Meta Pixel", /connect\.facebook\.net|fbq\s*\(/i],
  ["Google Tag Manager", /googletagmanager\.com\/gtm\.js/i],
  ["Google Analytics", /gtag\/js\?id=G-|google-analytics\.com/i],
  ["Google Ads", /googleadservices\.com|gtag\/js\?id=AW-|['"]AW-\d{6,}/i],
  ["TikTok Pixel", /analytics\.tiktok\.com|ttq\.load/i],
  ["Gorgias", /gorgias\.(chat|com)/i]
];
function radarDetecterTechnos(html) {
  return RADAR_TECHNOS.map(([nom, re]) => ({ nom, detecte: re.test(html || "") }));
}
__name(radarDetecterTechnos, "radarDetecterTechnos");
__name2(radarDetecterTechnos, "radarDetecterTechnos");
var RADAR_CRO = [
  ["avis", /judge\.me|loox|yotpo|stamped|okendo|avis vérifiés|★/i],
  ["sticky_atc", /sticky[-_ ]?(add|atc|cart|buy)/i],
  ["faq", /\bf\.?a\.?q\.?\b|questions fréquentes/i],
  ["livraison", /livraison (gratuite|offerte|en \d)|délai de livraison/i],
  ["retour", /retours? (gratuits?|sous \d+)|satisfait ou rembours/i],
  ["reassurance", /paiement (sécurisé|100%)|garantie|service client/i],
  ["bundles", /lot de \d|pack de \d|bundle|économisez/i],
  ["video", /<video|youtube\.com\/embed|vimeo\.com\/video/i],
  ["panier", /add[-_ ]?to[-_ ]?cart|ajouter au panier|\/cart\/add/i],
  ["paiement", /visa|mastercard|paypal|apple ?pay|klarna|alma/i]
];
function radarSignauxCro(html) {
  const out = {};
  for (const [nom, re] of RADAR_CRO) out[nom] = re.test(html || "");
  return out;
}
__name(radarSignauxCro, "radarSignauxCro");
__name2(radarSignauxCro, "radarSignauxCro");
function radarNombreAvis(html) {
  let max = 0;
  const texte = String(html || "");
  const motifs = [
    /(\d{1,3}(?:[\s.,\u202f\u00a0]\d{3})*|\d+)\s*(?:avis|reviews?|\u00e9valuations|commentaires clients)/gi,
    /data-number-of-reviews=["'](\d+)/gi,
    /"reviewCount"\s*:\s*"?(\d+)/gi
  ];
  for (const re of motifs) {
    for (const m of texte.matchAll(re)) {
      const n = Number(String(m[1]).replace(/[^\d]/g, ""));
      if (n > max && n < 1e6) max = n;
    }
  }
  return max;
}
__name(radarNombreAvis, "radarNombreAvis");
__name2(radarNombreAvis, "radarNombreAvis");
function radarEvaluerMarche(html, domaine, pays) {
  if ((pays || "FR") !== "FR") return { statut: "oui", confiance: 100, preuves: [pays] };
  let points = 0;
  const preuves = [];
  let franceDirecte = false;
  const ajouter = /* @__PURE__ */ __name2((p, preuve) => {
    points += p;
    preuves.push(preuve);
  }, "ajouter");
  if (String(domaine || "").endsWith(".fr")) {
    franceDirecte = true;
    ajouter(60, "domaine .fr");
  }
  if (/france m(?:\xE9|e)tropolitaine|livraison[^<]{0,100}\bfrance\b|exp(?:\xE9|e)di(?:\xE9|e)[^<]{0,100}\bfrance\b|(?:pays|country)[^<]{0,120}>\s*france/i.test(html || "")) {
    franceDirecte = true;
    ajouter(30, "march\xE9 France explicite");
  }
  if (/<html[^>]+lang=["']fr(?:-|["'])/i.test(html || "")) ajouter(45, "langue fran\xE7aise");
  if (/hreflang=["']fr(?:-|["'])/i.test(html || "")) ajouter(25, "version fran\xE7aise");
  const signaux = [
    [/ajouter au panier|votre panier|passer la commande/i, "parcours d'achat fran\xE7ais"],
    [/retours? (?:gratuits?|sous)|satisfait ou rembours/i, "retours en fran\xE7ais"],
    [/€|\beur\b|euro/i, "prix en euros"]
  ];
  for (const [re, preuve] of signaux) if (re.test(html || "")) ajouter(10, preuve);
  const confiance = Math.min(100, points);
  return { statut: franceDirecte && confiance >= 60 ? "oui" : confiance >= 35 ? "incertain" : "non", confiance, preuves };
}
__name(radarEvaluerMarche, "radarEvaluerMarche");
__name2(radarEvaluerMarche, "radarEvaluerMarche");
var RADAR_MOTS_FR = /\b(le|la|les|des|du|une|et|pour|avec|vous|votre|vos|nos|notre|sur|dans|livraison|panier|commande|ajouter|produits?|gratuite?|nouveautés|découvrir|acheter)\b/gi;
var RADAR_MOTS_EN = /\b(the|and|for|with|you|your|our|shop|shipping|cart|free|add|new|arrivals|discover|buy|now|best|sellers?|order|products?)\b/gi;
var RADAR_OUTILS_PRO = [
  ["Klaviyo", /klaviyo/i],
  ["Rebuy", /rebuyengine|rebuy\.io/i],
  ["Abonnements", /rechargecdn|rechargepayments|skio\.com|loopsubscriptions|stay\.ai/i],
  ["Gorgias", /gorgias/i],
  ["Avis premium", /okendo|yotpo|stamped\.io|reviews\.io|trustpilot\.com\/.*widget/i],
  ["SMS marketing", /attentivemobile|postscript\.io|smsbump/i],
  ["Analytics pro", /triplewhale|triple-whale|northbeam|elevar/i]
];
var RADAR_AB_TEST = /intelligems|shoplift|visualwebsiteoptimizer|\bvwo\b|convert\.com\/js|abtasty|kameleoon|optimizely|dynamicyield/i;
var RADAR_THEMES_COURANTS = /^(shrine|booster|debutify|kalles|minimog|wokiee|ella|shella|electro|turbo|flex|dropshipping|ecomus|eurus)/i;
function radarEvaluerQualite(html, pubsActives, avis, pays) {
  const brut = String(html || "");
  const langAttr = (brut.match(/<html[^>]*\slang=["']?([a-z]{2})/i) || [])[1]?.toLowerCase() || null;
  const texte = brut.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").slice(0, 2e5);
  const fr = (texte.match(RADAR_MOTS_FR) || []).length;
  const en = (texte.match(RADAR_MOTS_EN) || []).length;
  let langue = langAttr;
  if (fr + en >= 12) langue = fr >= en * 0.6 ? "fr" : en >= fr * 1.5 ? "en" : langAttr || "fr";
  else if (!langue) langue = fr >= en ? "fr" : "en";
  let theme = null, themeStoreId = null;
  const m = brut.match(/Shopify\.theme\s*=\s*(\{[^;<]{0,800}?\})\s*;/);
  if (m) {
    try {
      const t = JSON.parse(m[1]);
      theme = String(t.schema_name || t.name || "").slice(0, 60) || null;
      themeStoreId = t.theme_store_id ?? null;
    } catch {
      theme = (m[1].match(/"(?:schema_name|name)"\s*:\s*"([^"]{1,60})"/) || [])[1] || null;
      themeStoreId = /"theme_store_id"\s*:\s*\d+/.test(m[1]) ? 1 : null;
    }
  }
  const themePerso = Boolean(m) && themeStoreId === null && !RADAR_THEMES_COURANTS.test(theme || "");
  const cro = radarSignauxCro(brut);
  const croNiveau = ["avis", "sticky_atc", "faq", "livraison", "retour", "reassurance", "bundles", "video"].filter((k) => cro[k]).length;
  const outils = RADAR_OUTILS_PRO.filter(([, re]) => re.test(brut)).map(([nom]) => nom);
  const abTest = RADAR_AB_TEST.test(brut);
  const pubs = Number(pubsActives || 0), nbAvis = Number(avis || 0);
  let exclusion = null;
  if ((pays || "FR") === "FR" && langue !== "fr") exclusion = { statut: "non pertinent", motif: "auto : boutique pas en français" };
  else if (nbAvis >= 5e3 || pubs >= 150) exclusion = { statut: "non pertinent", motif: "auto : marque trop importante" };
  else if (abTest || croNiveau >= 6 && outils.length >= 3 || croNiveau >= 5 && themePerso && outils.length >= 2)
    exclusion = { statut: "déjà optimisé", motif: "auto : boutique déjà très optimisée" + (abTest ? " (tests A/B)" : "") };
  return { langue, theme, themePerso, croNiveau, outils, abTest, exclusion };
}
__name(radarEvaluerQualite, "radarEvaluerQualite");
__name2(radarEvaluerQualite, "radarEvaluerQualite");
async function radarEnregistrerQualite(db, prospect, q) {
  const maintenant = (/* @__PURE__ */ new Date()).toISOString();
  await db.prepare("UPDATE radar_prospects SET langue=?, theme_nom=?, theme_perso=?, outils_pro=?, qualite_exclusion=?, qualite_verifiee_le=? WHERE id=?").bind(q.langue, q.theme, q.themePerso ? 1 : 0, q.outils.join(", ") || null, q.exclusion?.motif || null, maintenant, prospect.id).run();
  if (!q.exclusion || !prospect.presente_le || !["nouveau", "à vérifier", "à contacter"].includes(prospect.statut)) return;
  await db.prepare("UPDATE radar_prospects SET statut=?, motif_rejet=?, email_programme_le=NULL WHERE id=?").bind(q.exclusion.statut, q.exclusion.motif, prospect.id).run();
  await db.prepare(`INSERT INTO radar_historique (prospect_id, ancien_statut, nouveau_statut, motif, quand) VALUES (?, ?, ?, ?, ?)`).bind(prospect.id, prospect.statut, q.exclusion.statut, q.exclusion.motif, maintenant).run();
}
__name(radarEnregistrerQualite, "radarEnregistrerQualite");
__name2(radarEnregistrerQualite, "radarEnregistrerQualite");
function radarEvaluerPertinence(html, mot, niche) {
  const texte = radarSansAccents(String(html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
  const expression = radarSansAccents(mot).trim();
  const tokens = radarTokensNiche(mot, niche);
  let points = expression.length >= 3 && texte.includes(expression) ? 60 : 0;
  const trouves = [];
  for (const token of tokens) {
    if (token.length < 3 || !texte.includes(token)) continue;
    points += 12;
    trouves.push(token);
    if (trouves.length >= 5) break;
  }
  return { confiance: Math.min(100, points), preuves: trouves };
}
__name(radarEvaluerPertinence, "radarEvaluerPertinence");
__name2(radarEvaluerPertinence, "radarEvaluerPertinence");
function radarJoursDepuis(iso) {
  if (!iso) return null;
  const t = Date.parse(String(iso).length <= 10 ? iso + "T12:00:00Z" : iso);
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 864e5);
}
__name(radarJoursDepuis, "radarJoursDepuis");
__name2(radarJoursDepuis, "radarJoursDepuis");
function radarCategoriser(joursDomaine, joursPub) {
  if (joursPub === null) return null;
  if (joursDomaine === null) return "ind\xE9termin\xE9e";
  return joursDomaine >= 180 ? "A" : "B";
}
__name(radarCategoriser, "radarCategoriser");
__name2(radarCategoriser, "radarCategoriser");
async function assurerRadarSchema(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS radar_annonceurs (
    page_id TEXT PRIMARY KEY,
    page_name TEXT,
    premiere_pub_vue TEXT,
    derniere_pub_vue TEXT,
    pubs_actives INTEGER DEFAULT 0,
    portee_ue INTEGER,
    pays TEXT,
    niche TEXT,
    vu_le TEXT NOT NULL,
    maj_le TEXT
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS radar_motscles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mot TEXT NOT NULL,
    niche TEXT NOT NULL,
    actif INTEGER NOT NULL DEFAULT 1,
    priorite TEXT NOT NULL DEFAULT 'normale',
    dernier_passage TEXT,
    UNIQUE (mot, niche)
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS radar_prospects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL DEFAULT 'meta',
    source_url TEXT,
    marque TEXT,
    domaine TEXT,
    domaine_confiance INTEGER,
    domaine_methode TEXT,
    domaine_cree_le TEXT,
    registrar TEXT,
    pays TEXT,
    marche_statut TEXT,
    marche_confiance INTEGER,
    marche_preuves TEXT,
    niche TEXT,
    pertinence_niche INTEGER,
    categorie TEXT,
    shopify_statut TEXT,
    shopify_confiance INTEGER,
    pagespeed_score INTEGER,
    lcp REAL, cls REAL, fcp REAL, tbt REAL, si REAL,
    cro_signaux TEXT,
    score INTEGER,
    score_detail TEXT,
    statut TEXT NOT NULL DEFAULT 'nouveau',
    motif_rejet TEXT,
    etape TEXT NOT NULL DEFAULT 'a_resoudre',
    derniere_erreur TEXT,
    presente_le TEXT,
    cree_le TEXT NOT NULL,
    analyse_le TEXT
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS radar_pubs (
    ad_id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL,
    debut TEXT,
    fin TEXT,
    active INTEGER DEFAULT 1,
    texte TEXT,
    titre TEXT,
    caption TEXT,
    description TEXT,
    snapshot_url TEXT,
    plateformes TEXT,
    portee_ue INTEGER,
    mot_cle TEXT,
    collecte_le TEXT NOT NULL
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS radar_technos (
    prospect_id INTEGER NOT NULL,
    techno TEXT NOT NULL,
    detecte INTEGER NOT NULL,
    PRIMARY KEY (prospect_id, techno)
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS radar_historique (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prospect_id INTEGER NOT NULL,
    ancien_statut TEXT,
    nouveau_statut TEXT,
    motif TEXT,
    note TEXT,
    quand TEXT NOT NULL
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS radar_reglages (
    cle TEXT PRIMARY KEY,
    valeur TEXT NOT NULL,
    maj_le TEXT NOT NULL
  )`).run();
  const colonnes = new Set((await tous2(db, "PRAGMA table_info(radar_prospects)")).map((c) => c.name));
  const ajouts = [
    ["source", "TEXT NOT NULL DEFAULT 'meta'"],
    ["source_url", "TEXT"],
    ["marche_statut", "TEXT"],
    ["marche_confiance", "INTEGER"],
    ["marche_preuves", "TEXT"],
    ["pertinence_niche", "INTEGER"],
    ["premiere_pub_vue", "TEXT"],
    ["derniere_pub_vue", "TEXT"],
    ["pubs_actives", "INTEGER NOT NULL DEFAULT 0"],
    ["portee_ue", "INTEGER"],
    ["technos_n", "INTEGER NOT NULL DEFAULT 0"],
    ["email_contact", "TEXT"],
    ["instagram", "TEXT"],
    ["contacts_verifies_le", "TEXT"],
    ["contacts_essais", "INTEGER NOT NULL DEFAULT 0"],
    ["contacts_erreur", "TEXT"],
    ["telephone", "TEXT"],
    ["whatsapp", "INTEGER NOT NULL DEFAULT 0"],
    ["contacts_version", "INTEGER NOT NULL DEFAULT 0"],
    ["contacts_prochain_essai", "TEXT"],
    ["suivi_jeton", "TEXT"],
    ["email_envoye_le", "TEXT"],
    ["email_ouvert_le", "TEXT"],
    ["email_ouvertures", "INTEGER NOT NULL DEFAULT 0"],
    ["email_clique_le", "TEXT"],
    ["email_clics", "INTEGER NOT NULL DEFAULT 0"],
    ["email_programme_le", "TEXT"],
    ["email_erreur", "TEXT"],
    ["langue", "TEXT"],
    ["theme_nom", "TEXT"],
    ["theme_perso", "INTEGER"],
    ["outils_pro", "TEXT"],
    ["qualite_exclusion", "TEXT"],
    ["qualite_verifiee_le", "TEXT"],
    ["ia_decision", "TEXT"],
    ["ia_analyse", "TEXT"]
  ];
  for (const [nom, type] of ajouts) {
    if (!colonnes.has(nom)) await db.prepare(`ALTER TABLE radar_prospects ADD COLUMN ${nom} ${type}`).run();
  }
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_radar_prospects_score ON radar_prospects(statut,score DESC)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_radar_prospects_suivi ON radar_prospects(suivi_jeton)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_radar_prospects_presente ON radar_prospects(presente_le)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_radar_prospects_programme ON radar_prospects(email_programme_le)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_radar_pubs_page ON radar_pubs(page_id,active)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_radar_motscles_passage ON radar_motscles(actif,dernier_passage)").run();
}
__name(assurerRadarSchema, "assurerRadarSchema");
__name2(assurerRadarSchema, "assurerRadarSchema");
async function radarReglages(db) {
  const r = await tous2(db, "SELECT cle, valeur FROM radar_reglages");
  const o = {};
  for (const x of r) o[x.cle] = x.valeur;
  const n = /* @__PURE__ */ __name2((k, d) => o[k] === void 0 ? d : Number(o[k]), "n");
  return {
    brut: o,
    pays: o.pays || "FR",
    parJour: n("prospects_par_jour", 10),
    scoreMin: n("score_minimum", 60),
    scoreComplement: n("score_minimum_complement", 45),
    shopifyObligatoire: o.shopify_obligatoire !== "0",
    pubsMin: n("pubs_actives_min", 2),
    pubAncienneteMin: n("pub_anciennete_min_jours", 7),
    p: {
      pub30: n("pts_pub_moins30", 15),
      pub60: n("pts_pub_30_60", 10),
      pub90: n("pts_pub_60_90", 5),
      crea10: n("pts_creatives_10plus", 10),
      crea5: n("pts_creatives_5_9", 7),
      crea2: n("pts_creatives_2_4", 4),
      portee: n("pts_portee_max", 5),
      shopOui: n("pts_shopify_oui", 15),
      shopProb: n("pts_shopify_probable", 8),
      ps40: n("pts_ps_sous40", 20),
      ps55: n("pts_ps_40_55", 15),
      ps70: n("pts_ps_56_70", 8),
      ps85: n("pts_ps_71_85", 3),
      croAvis: n("pts_cro_sans_avis", 5),
      croSticky: n("pts_cro_sans_sticky", 3),
      croReass: n("pts_cro_reassurance", 4),
      croLivr: n("pts_cro_livraison", 3),
      croBuy: n("pts_cro_buybox", 5),
      sourceGoogle: n("pts_source_google", 20),
      marcheFr: n("pts_marche_fr", 10),
      pertinenceNiche: n("pts_pertinence_niche", 10),
      maturite: n("pts_maturite_max", 10),
      timing: n("pts_timing_max", 5),
      googleAds: n("pts_google_ads", 5),
      traction: n("pts_traction_max", 8)
    }
  };
}
__name(radarReglages, "radarReglages");
__name2(radarReglages, "radarReglages");
function radarScorer(p, reg) {
  const P = reg.p, d = {};
  const sourceWeb = radarEstSourceWeb(p.source);
  const jPub = radarJoursDepuis(p.premiere_pub_vue);
  const crea = Number(p.pubs_actives || 0);
  let pub = 0;
  if (jPub !== null) pub += jPub >= 7 ? P.pub30 : jPub >= 3 ? P.pub60 : jPub >= 1 ? P.pub90 : 0;
  if (p.google_ads) pub += P.googleAds;
  pub += crea >= 10 ? P.crea10 : crea >= 5 ? P.crea5 : crea >= 2 ? P.crea2 : 0;
  if (p.portee_ue > 0) pub += Math.min(P.portee, Math.round(Math.log10(p.portee_ue) - 2));
  d["Meta Ads"] = Math.max(0, pub);
  if (sourceWeb) {
    delete d["Meta Ads"];
    d["D\xE9couverte web"] = P.sourceGoogle;
    d["March\xE9 FR"] = p.marche_statut === "oui" ? P.marcheFr : p.marche_statut === "incertain" ? Math.ceil(P.marcheFr / 2) : 0;
    d["Pertinence niche"] = Number(p.pertinence_niche || 0) >= 60 ? P.pertinenceNiche : 0;
  }
  d["Shopify"] = p.shopify_statut === "oui" ? P.shopOui : p.shopify_statut === "incertain" ? P.shopProb : 0;
  const ps = p.pagespeed_score;
  d["Performance"] = ps === null || ps === void 0 ? 0 : ps < 40 ? P.ps40 : ps <= 55 ? P.ps55 : ps <= 70 ? P.ps70 : ps <= 85 ? P.ps85 : 0;
  let cro = 0;
  let s = {};
  try {
    s = JSON.parse(p.cro_signaux || "{}");
  } catch {
    s = {};
  }
  if (Object.keys(s).length) {
    if (!s.avis) cro += P.croAvis;
    if (!s.sticky_atc) cro += P.croSticky;
    if (!s.reassurance) cro += P.croReass;
    if (!s.livraison) cro += P.croLivr;
    if (!s.panier || !s.paiement) cro += P.croBuy;
  }
  d["CRO"] = cro;
  let mat = 0;
  if (crea >= 3) mat += 3;
  if (p.domaine && !/\.(myshopify|wixsite|shopifypreview)\./.test(p.domaine)) mat += 2;
  if (p.technos_n >= 3) mat += 3;
  if (p.domaine_confiance >= 80) mat += 2;
  d["Maturit\xE9"] = Math.min(P.maturite, mat);
  const jDom = radarJoursDepuis(p.domaine_cree_le);
  d["Timing"] = jDom !== null && jDom >= 365 ? P.timing : 0;
  const avis = Number(p.nombre_avis || 0);
  d["Traction"] = avis >= 200 ? P.traction : avis >= 50 ? Math.ceil(P.traction * 0.6) : avis >= 10 ? Math.ceil(P.traction * 0.3) : 0;
  const total = Object.values(d).reduce((a, b) => a + b, 0);
  return { score: Math.max(0, Math.min(100, Math.round(total))), detail: d };
}
__name(radarScorer, "radarScorer");
__name2(radarScorer, "radarScorer");
function radarPremierTexte(valeur) {
  return [].concat(valeur || []).map((v) => String(v || "").trim()).filter(Boolean)[0] || null;
}
__name(radarPremierTexte, "radarPremierTexte");
__name2(radarPremierTexte, "radarPremierTexte");
function radarDateMin(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return Date.parse(a) <= Date.parse(b) ? a : b;
}
__name(radarDateMin, "radarDateMin");
__name2(radarDateMin, "radarDateMin");
function radarDateMax(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}
__name(radarDateMax, "radarDateMax");
__name2(radarDateMax, "radarDateMax");
async function radarRechercheMeta(env, mot, pays, apres) {
  if (!env.META_TOKEN) throw new Error("Le jeton Meta Ad Library n'est pas encore configur\xE9.");
  const version = /^v\d+\.\d+$/.test(String(env.META_API_VERSION || "")) ? env.META_API_VERSION : "v26.0";
  const champs2 = [
    "id",
    "page_id",
    "page_name",
    "ad_creation_time",
    "ad_delivery_start_time",
    "ad_delivery_stop_time",
    "ad_creative_bodies",
    "ad_creative_link_captions",
    "ad_creative_link_descriptions",
    "ad_creative_link_titles",
    "ad_snapshot_url",
    "publisher_platforms",
    "eu_total_reach"
  ];
  const interroger = /* @__PURE__ */ __name2(async (listeChamps) => {
    const params = new URLSearchParams({
      search_terms: mot,
      ad_type: "ALL",
      ad_active_status: "ACTIVE",
      ad_reached_countries: JSON.stringify([pays || "FR"]),
      fields: listeChamps.join(","),
      limit: "100"
    });
    if (apres) params.set("after", apres);
    const reponse2 = await fetch(`https://graph.facebook.com/${version}/ads_archive?${params}`, {
      headers: { authorization: `Bearer ${env.META_TOKEN}` },
      signal: AbortSignal.timeout(25e3)
    });
    return { reponse: reponse2, donnees: await reponse2.json().catch(() => ({})) };
  }, "interroger");
  let { reponse, donnees } = await interroger(champs2);
  const erreurChamp = Number(donnees?.error?.code || 0) === 100 && /eu_total_reach|field|champ/i.test(String(donnees?.error?.message || ""));
  if ((!reponse.ok || donnees.error) && erreurChamp) {
    ({ reponse, donnees } = await interroger(champs2.filter((champ) => champ !== "eu_total_reach")));
  }
  if (!reponse.ok || donnees.error) {
    const code = donnees?.error?.code ? ` (code ${donnees.error.code})` : "";
    if (Number(donnees?.error?.code || 0) === 10 && Number(donnees?.error?.error_subcode || 0) === 2332002) {
      throw new Error("Meta Ad Library n'est pas encore autoris\xE9e pour ce compte. Confirmez l'identit\xE9 et la localisation sur Facebook.com/ID, puis renouvelez le jeton Meta.");
    }
    throw new Error(`Meta Ad Library${code} : ${donnees?.error?.message || `HTTP ${reponse.status}`}`);
  }
  const pubs = Array.isArray(donnees.data) ? donnees.data : [];
  pubs.suivant = donnees?.paging?.next ? donnees?.paging?.cursors?.after || null : null;
  return pubs;
}
__name(radarRechercheMeta, "radarRechercheMeta");
__name2(radarRechercheMeta, "radarRechercheMeta");
async function radarRechercheGoogleGemini(env, mot, niche, pays) {
  if (!env.GEMINI_API_KEY) throw new Error("La connexion Gemini n'est pas configur\xE9e.");
  const modele = String(env.GEMINI_RADAR_MODEL || "gemini-2.5-flash-lite");
  const schema = {
    type: "object",
    properties: {
      candidats: {
        type: "array",
        items: {
          type: "object",
          properties: {
            nom: { type: "string" },
            url: { type: "string" },
            raison: { type: "string" }
          },
          required: ["nom", "url", "raison"]
        }
      }
    },
    required: ["candidats"]
  };
  const prompt = `Tu aides Prospect Radar d'AdamEcom \xE0 identifier des boutiques e-commerce publiques qui pourraient avoir besoin d'optimisation CRO.

Recherche Google demand\xE9e : ${mot}
Niche : ${niche || "e-commerce"}
March\xE9 : ${pays || "FR"}, avec vente ou livraison en France.

Trouve au maximum 10 boutiques ind\xE9pendantes qui vendent directement des produits correspondant pr\xE9cis\xE9ment \xE0 cette recherche. Privil\xE9gie les sites dont les r\xE9sultats publics montrent des signes Shopify, notamment cdn.shopify.com, /cdn/shop/ ou myshopify.com.

Exclus strictement les marketplaces, comparateurs, annuaires, m\xE9dias, blogs, agences, outils SaaS, r\xE9seaux sociaux et pages de r\xE9sultats. Retourne uniquement l'URL publique r\xE9ellement trouv\xE9e de la boutique, jamais une URL suppos\xE9e ou reconstruite. Ne d\xE9duis pas qu'un site est Shopify : Prospect Radar le v\xE9rifiera lui-m\xEAme. Si aucun candidat fiable n'est trouv\xE9, retourne une liste vide.`;
  const reponse = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": env.GEMINI_API_KEY
    },
    body: JSON.stringify({
      model: modele,
      input: prompt,
      tools: [{ type: "google_search" }],
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema
      }
    }),
    signal: AbortSignal.timeout(9e4)
  });
  const payload = await reponse.json().catch(() => null);
  if (!reponse.ok) throw new Error(`Recherche Google/Gemini : ${erreurInteractionGemini(payload)}`);
  const texte = texteInteractionGemini(payload);
  if (!texte) throw new Error("La recherche Google/Gemini n'a renvoy\xE9 aucun r\xE9sultat exploitable.");
  let donnees;
  try {
    donnees = JSON.parse(texte);
  } catch {
    throw new Error("La recherche Google/Gemini n'a pas renvoy\xE9 un JSON valide.");
  }
  const domaines = /* @__PURE__ */ new Map();
  for (const candidat of Array.isArray(donnees?.candidats) ? donnees.candidats : []) {
    let urlCandidat;
    try {
      urlCandidat = new URL(String(candidat?.url || "").trim());
    } catch {
      continue;
    }
    if (!/^https?:$/.test(urlCandidat.protocol)) continue;
    const domaine = radarNormaliserDomaine(urlCandidat.hostname);
    if (!domaine || domaines.has(domaine)) continue;
    domaines.set(domaine, {
      pageId: `web:${domaine}`,
      source: "google_gemini",
      sourceUrl: urlCandidat.href,
      nom: String(candidat?.nom || domaine).trim().slice(0, 180) || domaine,
      niche,
      domaine,
      confiance: 98,
      methode: "Google + v\xE9rification Shopify",
      raisonSource: String(candidat?.raison || "").trim().slice(0, 500),
      pertinenceIndex: true,
      premierePub: null,
      dernierePub: null,
      portee: 0,
      pubsActives: 0
    });
  }
  return [...domaines.values()];
}
__name(radarRechercheGoogleGemini, "radarRechercheGoogleGemini");
__name2(radarRechercheGoogleGemini, "radarRechercheGoogleGemini");
function radarDecoderLienWeb(valeur) {
  return String(valeur || "").replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/").replace(/&#47;/g, "/");
}
__name(radarDecoderLienWeb, "radarDecoderLienWeb");
__name2(radarDecoderLienWeb, "radarDecoderLienWeb");
async function radarRechercheBrave(env, mot, niche, pays) {
  const requete = `"cdn.shopify.com/s/files" "${String(mot || "").replace(/["\r\n]+/g, " ").slice(0, 100)}" boutique ${pays === "FR" ? "France" : pays || "France"} ${niche || ""}`.trim();
  let liens2 = [];
  if (env.BRAVE_SEARCH_API_KEY) {
    const params = new URLSearchParams({
      q: requete,
      count: "12",
      country: String(pays || "FR").toLowerCase(),
      search_lang: "fr",
      safesearch: "moderate"
    });
    const reponse = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        accept: "application/json",
        "x-subscription-token": env.BRAVE_SEARCH_API_KEY
      },
      signal: AbortSignal.timeout(25e3)
    });
    const donnees = await reponse.json().catch(() => null);
    if (!reponse.ok) throw new Error(`Brave Search API : ${donnees?.message || `HTTP ${reponse.status}`}`);
    liens2 = (donnees?.web?.results || []).map((r) => ({ url: r.url, nom: r.title }));
  } else {
    const params = new URLSearchParams({ q: requete, source: "web" });
    const reponse = await fetch(`https://search.brave.com/search?${params}`, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "fr-FR,fr;q=0.9,en;q=0.7",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(25e3)
    });
    if (!reponse.ok) throw new Error(`Recherche web temporairement indisponible (HTTP ${reponse.status}).`);
    const html = (await reponse.text()).slice(0, 2e6);
    if (/captcha|challenge-form|unusual traffic/i.test(html)) throw new Error("La recherche web demande une v\xE9rification temporaire.");
    liens2 = [...html.matchAll(/href="(https?:[^"#]+)"/gi)].map((m) => ({ url: radarDecoderLienWeb(m[1]), nom: null }));
  }
  const domaines = /* @__PURE__ */ new Map();
  for (const lien of liens2) {
    let urlCandidat;
    try {
      urlCandidat = new URL(String(lien?.url || "").trim());
    } catch {
      continue;
    }
    if (!/^https?:$/.test(urlCandidat.protocol)) continue;
    const domaine = radarNormaliserDomaine(urlCandidat.hostname);
    if (!domaine || domaines.has(domaine)) continue;
    domaines.set(domaine, {
      pageId: `web:${domaine}`,
      source: "web_brave",
      sourceUrl: urlCandidat.href,
      nom: String(lien?.nom || domaine).replace(/<[^>]+>/g, " ").trim().slice(0, 180) || domaine,
      niche,
      domaine,
      confiance: 94,
      methode: "Recherche web + v\xE9rification Shopify",
      pertinenceIndex: true,
      premierePub: null,
      dernierePub: null,
      portee: 0,
      pubsActives: 0
    });
    if (domaines.size >= 12) break;
  }
  if (!domaines.size) throw new Error("La recherche web n'a renvoy\xE9 aucune boutique exploitable pour ce mot-cl\xE9.");
  return [...domaines.values()];
}
__name(radarRechercheBrave, "radarRechercheBrave");
__name2(radarRechercheBrave, "radarRechercheBrave");
function radarSansAccents(valeur) {
  return String(valeur || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
__name(radarSansAccents, "radarSansAccents");
__name2(radarSansAccents, "radarSansAccents");
function radarTokensNiche(mot, niche) {
  const familles = {
    beaute: ["beauty", "beaute", "belle", "skin", "skincare", "cosmetic", "cosmetique", "serum", "soin", "visage", "peau", "cream", "creme", "hair", "cheveux", "capillaire", "shampoo", "parfum", "beard", "barbe"],
    bijoux: ["bijoux", "jewel", "jewelry", "bracelet", "necklace", "collier", "ring", "bague", "earring", "boucle", "pendentif", "watch", "montre"],
    mode: ["mode", "fashion", "vetement", "clothing", "apparel", "dress", "robe", "pantalon", "shoe", "chaussure", "sneaker", "lingerie", "swim", "maillot", "bag", "sac"],
    maison: ["maison", "home", "decor", "decoration", "kitchen", "cuisine", "storage", "rangement", "lamp", "lampe", "light", "garden", "jardin", "furniture", "mobilier", "nettoyage"],
    sport: ["sport", "fitness", "gym", "muscle", "musculation", "massage", "recovery", "recuperation", "training", "entrainement"]
  };
  const cleNiche = radarSansAccents(niche).replace(/[^a-z0-9]+/g, "");
  const mots = radarSansAccents(mot).split(/[^a-z0-9]+/).filter((x) => x.length >= 3);
  return [.../* @__PURE__ */ new Set([...mots, ...familles[cleNiche] || []])];
}
__name(radarTokensNiche, "radarTokensNiche");
__name2(radarTokensNiche, "radarTokensNiche");
async function radarRechercheCommonCrawl(env, mot, niche, pays, identifiantMot) {
  const collinfo = await fetch("https://index.commoncrawl.org/collinfo.json", {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8e3)
  }).catch(() => null);
  const collections = collinfo?.ok ? await collinfo.json().catch(() => []) : [];
  const indexUrls = [...new Set([
    "https://index.commoncrawl.org/CC-MAIN-2026-30-index",
    ...(Array.isArray(collections) ? collections : []).slice(0, 3).map((c) => String(c?.["cdx-api"] || "").replace(/\/$/, "")),
    "https://index.commoncrawl.org/CC-MAIN-2026-34-index"
  ].filter((u) => u.startsWith("https://index.commoncrawl.org/")))];
  if (!indexUrls.length) throw new Error("Index Shopify public invalide.");
  const page2 = Math.abs(Number(identifiantMot || 1) - 1) % 5;
  let reponse = null;
  let dernierStatut = 0;
  for (const pageCandidate of [page2, (page2 + 1) % 5]) {
    const params = new URLSearchParams({
      url: "*.myshopify.com/robots.txt",
      output: "json",
      fl: "url,redirect,status",
      collapse: "urlkey",
      page: String(pageCandidate)
    });
    params.append("filter", "status:301");
    for (const indexUrl of indexUrls) {
      const essai = await fetch(`${indexUrl}?${params}`, {
        headers: {
          accept: "application/x-ndjson,text/plain",
          "user-agent": "AdamEcom-Prospect-Radar/1.0"
        },
        signal: AbortSignal.timeout(18e3)
      }).catch(() => null);
      dernierStatut = Number(essai?.status || 0);
      if (essai?.ok && essai.body) {
        reponse = essai;
        break;
      }
    }
    if (reponse) break;
  }
  if (!reponse?.body) throw new Error(`Index Shopify public indisponible${dernierStatut ? ` (HTTP ${dernierStatut})` : ""}.`);
  const connus = new Set((await tous2(env.DB, "SELECT domaine FROM radar_prospects WHERE domaine IS NOT NULL")).map((p) => p.domaine));
  const tokens = radarTokensNiche(mot, niche);
  const trouves = /* @__PURE__ */ new Map();
  const secoursFr = /* @__PURE__ */ new Map();
  const lecteur = reponse.body.getReader();
  const decodeur = new TextDecoder();
  let tampon = "";
  let lignesLues = 0;
  const examiner = /* @__PURE__ */ __name2((ligne) => {
    if (!ligne) return;
    let entree;
    try {
      entree = JSON.parse(ligne);
    } catch {
      return;
    }
    let cible;
    try {
      cible = new URL(String(entree?.redirect || ""));
    } catch {
      return;
    }
    const domaine = radarNormaliserDomaine(cible.hostname);
    if (!domaine || connus.has(domaine) || trouves.has(domaine)) return;
    const contexte = radarSansAccents(`${entree.url || ""} ${entree.redirect || ""}`);
    const pertinent = tokens.some((token) => contexte.includes(token));
    const candidat = {
      pageId: `web:${domaine}`,
      source: "common_crawl",
      sourceUrl: cible.href,
      nom: domaine.split(".")[0].replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      niche,
      domaine,
      confiance: 96,
      methode: "Redirection Shopify publique + v\xE9rification du site",
      premierePub: null,
      dernierePub: null,
      portee: 0,
      pubsActives: 0
    };
    candidat.pertinenceIndex = pertinent;
    if (pertinent && trouves.size < 50) trouves.set(domaine, candidat);
    if ((pays || "FR") === "FR" && domaine.endsWith(".fr") && secoursFr.size < 30) secoursFr.set(domaine, candidat);
  }, "examiner");
  try {
    while (secoursFr.size < 12 && lignesLues < 3e4) {
      const { value, done } = await lecteur.read();
      tampon += decodeur.decode(value || new Uint8Array(), { stream: !done });
      const lignes = tampon.split("\n");
      tampon = lignes.pop() || "";
      for (const ligne of lignes) {
        lignesLues += 1;
        examiner(ligne);
        if (secoursFr.size >= 12 || lignesLues >= 3e4) break;
      }
      if (done) {
        examiner(tampon);
        break;
      }
    }
  } finally {
    await lecteur.cancel().catch(() => {
    });
  }
  const resultat = /* @__PURE__ */ new Map([...secoursFr, ...trouves]);
  if (!resultat.size) throw new Error("L'index Shopify public n'a renvoy\xE9 aucun nouveau domaine pertinent pour ce passage.");
  const rang = /* @__PURE__ */ __name2((c) => Number(Boolean(c.pertinenceIndex)) * 2 + Number(c.domaine.endsWith(".fr")), "rang");
  return [...resultat.values()].sort((a, b) => rang(b) - rang(a)).slice(0, 12);
}
__name(radarRechercheCommonCrawl, "radarRechercheCommonCrawl");
__name2(radarRechercheCommonCrawl, "radarRechercheCommonCrawl");
// Les textes d'annonces Meta peuvent d\xE9passer 60 000 caract\xE8res : on n'en garde que le d\xE9but,
// sinon la base D1 (500 Mo sur le plan gratuit) se remplit et plus rien ne peut s'y \xE9crire.
var radarCourt = /* @__PURE__ */ __name2((t, n) => t ? String(t).slice(0, n) : null, "radarCourt");
async function radarEnregistrerPub(db, pub, motCle, maintenant) {
  const adId = String(pub?.id || "").trim();
  const pageId = String(pub?.page_id || "").trim();
  if (!adId || !pageId) return false;
  await db.prepare(`INSERT INTO radar_pubs
    (ad_id,page_id,debut,fin,active,texte,titre,caption,description,snapshot_url,plateformes,portee_ue,mot_cle,collecte_le)
    VALUES (?,?,?,?,1,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(ad_id) DO UPDATE SET
      page_id=excluded.page_id,debut=excluded.debut,fin=excluded.fin,active=1,texte=excluded.texte,
      titre=excluded.titre,caption=excluded.caption,description=excluded.description,
      snapshot_url=excluded.snapshot_url,plateformes=excluded.plateformes,portee_ue=excluded.portee_ue,
      mot_cle=excluded.mot_cle,collecte_le=excluded.collecte_le`).bind(
    adId,
    pageId,
    pub.ad_delivery_start_time || pub.ad_creation_time || null,
    pub.ad_delivery_stop_time || null,
    radarCourt(radarPremierTexte(pub.ad_creative_bodies), 500),
    radarCourt(radarPremierTexte(pub.ad_creative_link_titles), 200),
    radarCourt(radarPremierTexte(pub.ad_creative_link_captions), 200),
    radarCourt(radarPremierTexte(pub.ad_creative_link_descriptions), 200),
    pub.ad_snapshot_url || null,
    [].concat(pub.publisher_platforms || []).join(","),
    Number(pub.eu_total_reach || 0) || null,
    motCle,
    maintenant
  ).run();
  return true;
}
__name(radarEnregistrerPub, "radarEnregistrerPub");
__name2(radarEnregistrerPub, "radarEnregistrerPub");
async function radarLireRdap(domaine) {
  try {
    const reponse = await fetch(`https://rdap.org/domain/${encodeURIComponent(domaine)}`, {
      headers: { accept: "application/rdap+json, application/json" },
      signal: AbortSignal.timeout(12e3)
    });
    if (!reponse.ok) return { creeLe: null, registrar: null };
    const d = await reponse.json();
    const creation = (d.events || []).find((e) => ["registration", "registered"].includes(String(e.eventAction || "").toLowerCase()));
    let registrar = null;
    for (const entite of d.entities || []) {
      if (!(entite.roles || []).includes("registrar")) continue;
      const vcard = entite.vcardArray?.[1] || [];
      registrar = vcard.find((x) => x?.[0] === "fn")?.[3] || entite.handle || null;
      if (registrar) break;
    }
    return { creeLe: creation?.eventDate || null, registrar };
  } catch {
    return { creeLe: null, registrar: null };
  }
}
__name(radarLireRdap, "radarLireRdap");
__name2(radarLireRdap, "radarLireRdap");
async function radarLirePageSpeed(env, domaine) {
  try {
    const params = new URLSearchParams({
      url: `https://${domaine}`,
      strategy: "mobile",
      category: "performance"
    });
    if (env.PAGESPEED_API_KEY) params.set("key", env.PAGESPEED_API_KEY);
    const reponse = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, {
      signal: AbortSignal.timeout(35e3)
    });
    if (!reponse.ok) return null;
    const d = await reponse.json();
    const audits = d?.lighthouseResult?.audits || {};
    const secondes = /* @__PURE__ */ __name2((id) => audits[id]?.numericValue === void 0 ? null : Math.round(Number(audits[id].numericValue) / 10) / 100, "secondes");
    return {
      score: Math.round(Number(d?.lighthouseResult?.categories?.performance?.score || 0) * 100),
      lcp: secondes("largest-contentful-paint"),
      cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
      fcp: secondes("first-contentful-paint"),
      tbt: audits["total-blocking-time"]?.numericValue ?? null,
      si: secondes("speed-index")
    };
  } catch {
    return null;
  }
}
__name(radarLirePageSpeed, "radarLirePageSpeed");
__name2(radarLirePageSpeed, "radarLirePageSpeed");
async function radarChargerSite(domaine) {
  const reponse = await fetch(`https://${domaine}`, {
    redirect: "follow",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
    },
    signal: AbortSignal.timeout(15e3)
  });
  if (!reponse.ok) throw new Error(`Boutique inaccessible (HTTP ${reponse.status}).`);
  const type = reponse.headers.get("content-type") || "";
  if (!/text\/html|application\/xhtml/i.test(type)) throw new Error("La destination n'est pas une page HTML.");
  const html = (await reponse.text()).slice(0, 15e5);
  return { html, entetes: Object.fromEntries(reponse.headers.entries()) };
}
__name(radarChargerSite, "radarChargerSite");
__name2(radarChargerSite, "radarChargerSite");
var RADAR_EMAILS_IGNORES = /(\.(png|jpe?g|gif|webp|svg|css|js)$|example\.|sentry|wixpress|shopify\.com$|domain\.com$|email\.com$|votre|your|test@|noreply|no-reply|@2x)/i;
var RADAR_INSTA_IGNORES = /^(p|reel|reels|explore|stories|accounts|tv|about|developer|legal|shopify|instagram)$/i;
var RADAR_EMAILS_PERSO = /@(gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|icloud|me|mac|aol|orange|wanadoo|free|sfr|neuf|laposte|bbox|proton|protonmail|gmx)\./i;
function radarRangEmail(e, racine) {
  if (RADAR_EMAILS_PERSO.test(e)) return 0;
  const hote = e.split("@")[1] || "";
  return hote === racine || hote.endsWith("." + racine) ? 1 : 2;
}
__name(radarRangEmail, "radarRangEmail");
__name2(radarRangEmail, "radarRangEmail");
function radarNormaliserTelephone(brut) {
  let d = String(brut || "").replace(/[^\d+]/g, "");
  if (d.startsWith("00")) d = "+" + d.slice(2);
  if (/^0[1-9]\d{8}$/.test(d)) d = "+33" + d.slice(1);
  if (/^33[1-9]\d{8}$/.test(d)) d = "+" + d;
  if (!d.startsWith("+")) d = "+" + d;
  const chiffres = d.replace(/\D/g, "");
  if (chiffres.length < 9 || chiffres.length > 15 || /^(\d)\1+$/.test(chiffres)) return null;
  return d;
}
__name(radarNormaliserTelephone, "radarNormaliserTelephone");
__name2(radarNormaliserTelephone, "radarNormaliserTelephone");
function radarNettoyerEmail(e) {
  let x = String(e || "").trim().toLowerCase();
  while (x.startsWith("mailto:")) x = x.slice(7);
  const m = x.match(/^(?:adresse|courriel)[:._-]?(.+@.+)$/) || x.match(/^e-?mail[:_-](.+@.+)$/);
  if (m && m[1].split("@")[0].length >= 2) x = m[1];
  return x;
}
function radarExtraireContacts(html, domaine) {
  const texte = String(html || "").replace(/&#64;|&commat;|\[at\]|\(at\)/gi, "@").replace(/&#43;/g, "+");
  const emails = /* @__PURE__ */ new Set();
  for (const m of texte.matchAll(/mailto:([^"'?>\s]+)/gi)) {
    try {
      emails.add(decodeURIComponent(m[1]).toLowerCase());
    } catch {
    }
  }
  for (const m of texte.matchAll(/[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi)) emails.add(m[0].toLowerCase());
  const racine = String(domaine || "").replace(/^www\./, "").split("/")[0].split(".").slice(-2).join(".");
  const valides = [...new Set([...emails].map(radarNettoyerEmail))].filter((e) => /^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(e) && !RADAR_EMAILS_IGNORES.test(e));
  valides.sort((x, y) => radarRangEmail(x, racine) - radarRangEmail(y, racine));
  let instagram = null;
  for (const m of texte.matchAll(/instagram\.com\/([A-Za-z0-9_.]{2,30})/gi)) {
    const pseudo = m[1].replace(/\.+$/, "");
    if (!RADAR_INSTA_IGNORES.test(pseudo)) {
      instagram = pseudo;
      break;
    }
  }
  let telephone = null;
  let whatsapp = false;
  for (const m of texte.matchAll(/(?:wa\.me\/|whatsapp\.com\/send\/?\?phone=|whatsapp:\/\/send\?phone=)\+?(\d{8,15})/gi)) {
    telephone = radarNormaliserTelephone("+" + m[1]);
    if (telephone) {
      whatsapp = true;
      break;
    }
  }
  if (!telephone) {
    for (const m of texte.matchAll(/href=["']tel:([^"']+)/gi)) {
      telephone = radarNormaliserTelephone(decodeURIComponent(m[1]));
      if (telephone) break;
    }
  }
  if (!telephone) {
    const visible = texte.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
    const m = visible.match(/(?:\+33\s?|0033\s?|\b0)[67](?:[\s.-]?\d{2}){4}\b/) || visible.match(/(?:\+33\s?|0033\s?|\b0)[1-9](?:[\s.-]?\d{2}){4}\b/) || visible.match(/\+\d{2,3}[\s.-]?\d(?:[\s.-]?\d){7,11}\b/);
    if (m) telephone = radarNormaliserTelephone(m[0]);
  }
  return { emails: valides, email: valides[0] || null, instagram, telephone, whatsapp };
}
__name(radarExtraireContacts, "radarExtraireContacts");
__name2(radarExtraireContacts, "radarExtraireContacts");
var RADAR_ERREUR_REESSAYER = /HTTP 429|HTTP 503|Too many subrequests|timed out|aborted|network/i;
var RADAR_CONTACTS_ESSAIS_MAX = 6;
var RADAR_CONTACTS_PAR_MINUTE = 2;
var RADAR_PAGES_CONTACT = ["/policies/contact-information", "/policies/privacy-policy", "", "/pages/contact", "/pages/contactez-nous", "/policies/legal-notice", "/pages/mentions-legales", "/policies/terms-of-service"];
async function radarTrouverContacts(domaine, htmlAccueil) {
  const racine = String(domaine || "").replace(/^www\./, "").split(".").slice(-2).join(".");
  const emails = [];
  let instagram = null;
  let telephone = null;
  let whatsapp = false;
  let pagesLues = 0;
  let derniereErreur = null;
  for (const chemin of RADAR_PAGES_CONTACT) {
    const meilleur = emails.length ? radarRangEmail(emails[0], racine) : 9;
    if (meilleur === 0 && telephone && instagram) break;
    let html;
    if (chemin === "" && htmlAccueil !== void 0) html = htmlAccueil;
    else {
      try {
        html = (await radarChargerSite(domaine + chemin)).html;
      } catch (e) {
        derniereErreur = e;
        if (RADAR_ERREUR_REESSAYER.test(String(e?.message))) throw e;
        continue;
      }
    }
    pagesLues += 1;
    const t = radarExtraireContacts(html, domaine);
    for (const e of t.emails) if (!emails.includes(e)) emails.push(e);
    emails.sort((x, y) => radarRangEmail(x, racine) - radarRangEmail(y, racine));
    instagram = instagram || t.instagram;
    if (t.telephone && (!telephone || t.whatsapp && !whatsapp)) {
      telephone = t.telephone;
      whatsapp = t.whatsapp;
    }
  }
  if (!pagesLues && derniereErreur) throw derniereErreur;
  return { email: emails[0] || null, instagram, telephone, whatsapp };
}
__name(radarTrouverContacts, "radarTrouverContacts");
__name2(radarTrouverContacts, "radarTrouverContacts");
async function radarEnregistrerContacts(db, prospectId, domaine, htmlAccueil) {
  let contacts = { email: null, instagram: null, telephone: null, whatsapp: false };
  try {
    contacts = await radarTrouverContacts(domaine, htmlAccueil);
  } catch (e) {
    const message = String(e?.message || e);
    if (/Too many subrequests/i.test(message)) {
      await db.prepare("UPDATE radar_prospects SET contacts_erreur=?, contacts_prochain_essai=? WHERE id=?").bind(message.slice(0, 200), new Date(Date.now() + 6e4).toISOString(), prospectId).run();
      return contacts;
    }
    const essais = await db.prepare("UPDATE radar_prospects SET contacts_essais=contacts_essais+1, contacts_erreur=? WHERE id=? RETURNING contacts_essais").bind(message.slice(0, 200), prospectId).first();
    const n = Number(essais?.contacts_essais || 0);
    if (n < RADAR_CONTACTS_ESSAIS_MAX) {
      const attente = [5, 15, 60, 180, 360][Math.min(n - 1, 4)] * 6e4;
      await db.prepare("UPDATE radar_prospects SET contacts_prochain_essai=? WHERE id=?").bind(new Date(Date.now() + attente).toISOString(), prospectId).run();
      return contacts;
    }
  }
  await db.prepare("UPDATE radar_prospects SET email_contact=COALESCE(?,email_contact), instagram=COALESCE(?,instagram), telephone=COALESCE(?,telephone), whatsapp=?, contacts_version=2, contacts_verifies_le=?, contacts_prochain_essai=NULL WHERE id=?").bind(contacts.email, contacts.instagram, contacts.telephone, contacts.whatsapp ? 1 : 0, (/* @__PURE__ */ new Date()).toISOString(), prospectId).run();
  return contacts;
}
__name(radarEnregistrerContacts, "radarEnregistrerContacts");
__name2(radarEnregistrerContacts, "radarEnregistrerContacts");
function radarRacineBoutique(domaine) {
  const parties = String(domaine || "").toLowerCase().replace(/^(www|fr|shop|boutique|store)\./, "").split(".");
  if (parties.length < 2) return null;
  const racine = parties.length >= 3 && parties.slice(-2).join(".") === "myshopify.com" ? parties[parties.length - 3] : parties[0];
  return racine && racine.length >= 4 ? racine : null;
}
async function radarMemeBoutiqueConnue(db, domaine, pageId) {
  const racine = radarRacineBoutique(domaine);
  if (!racine) return false;
  const plages = ["", "www.", "fr.", "shop.", "boutique.", "store."].map((p) => p + racine);
  const r = await db.prepare(`SELECT 1 FROM radar_prospects WHERE page_id<>? AND domaine<>? AND (${plages.map(() => "(domaine>? AND domaine<?)").join(" OR ")}) LIMIT 1`).bind(
    pageId,
    domaine,
    ...plages.flatMap((p) => [p + ".", p + "/"])
  ).first();
  return !!r;
}
var RADAR_IA_REGLES = "Tu es le moteur de qualification commerciale de Prospect Radar pour AdamEcom.\n\nTA MISSION\n\nIdentifier uniquement des boutiques Shopify qui repr\u00e9sentent une vraie opportunit\u00e9 commerciale pour un consultant sp\u00e9cialis\u00e9 en CRO et optimisation Shopify.\n\nJe ne cherche PAS :\n- toutes les boutiques Shopify ;\n- toutes les entreprises qui font de la publicit\u00e9 ;\n- les boutiques simplement \u201cmoches\u201d ;\n- les boutiques d\u00e9butantes sans activit\u00e9 r\u00e9elle ;\n- les grandes marques dont le site est d\u00e9j\u00e0 fortement optimis\u00e9.\n\nJe cherche le profil pr\u00e9cis suivant :\n\nUne boutique Shopify ACTIVE et suffisamment s\u00e9rieuse, qui investit d\u00e9j\u00e0 dans l\u2019acquisition payante ou montre des signes clairs d\u2019activit\u00e9 commerciale, mais dont le site pr\u00e9sente plusieurs frictions CRO visibles susceptibles de limiter la conversion.\n\nIMPORTANT :\nTu ne connais pas le taux de conversion r\u00e9el de la boutique.\nTu ne dois donc JAMAIS affirmer que \u201cla boutique ne convertit pas\u201d ou \u201cperd des ventes\u201d.\nTu dois uniquement juger les \u00e9l\u00e9ments visibles du site et parler de \u201cfrictions CRO\u201d, \u201copportunit\u00e9s d\u2019am\u00e9lioration\u201d ou \u201csignaux susceptibles de r\u00e9duire la conversion\u201d.\n\n\u00c9TAPE 1 \u2014 CONDITIONS OBLIGATOIRES\n\nLe prospect doit id\u00e9alement respecter ces conditions :\n1. La boutique utilise Shopify.\n2. Elle vend r\u00e9ellement des produits en ligne.\n3. Elle poss\u00e8de son propre nom de domaine.\n4. Elle semble encore active et entretenue.\n5. Elle diffuse actuellement des publicit\u00e9s ou poss\u00e8de des signaux r\u00e9cents et cr\u00e9dibles d\u2019acquisition payante.\n6. L\u2019activit\u00e9 semble suffisamment s\u00e9rieuse pour pouvoir investir dans une prestation professionnelle.\n7. Le site pr\u00e9sente plusieurs opportunit\u00e9s CRO concr\u00e8tes.\n\nSi la boutique ne respecte pas les crit\u00e8res 1, 2 ou 7 : REJETER.\nSi aucune preuve cr\u00e9dible de publicit\u00e9 ou d\u2019activit\u00e9 commerciale n\u2019est trouv\u00e9e : fortement r\u00e9duire le score.\n\n\u00c9TAPE 2 \u2014 ANALYSE CRO\n\nAnalyse en priorit\u00e9 : homepage ; page produit principale ; zone d\u2019achat ; panier / cart drawer ; navigation ; exp\u00e9rience mobile si disponible ; \u00e9l\u00e9ments de confiance ; offre commerciale ; preuves sociales.\n\nCherche notamment les probl\u00e8mes suivants.\n\nA. PROPOSITION DE VALEUR : proposition de valeur absente ; g\u00e9n\u00e9rique ; impossible de comprendre rapidement pourquoi acheter cette marque ; hero centr\u00e9 uniquement sur le produit sans b\u00e9n\u00e9fice client ; offre difficile \u00e0 comprendre en quelques secondes.\n\nB. PAGE PRODUIT / ABOVE THE FOLD : b\u00e9n\u00e9fices du produit peu visibles ; description uniquement technique ; CTA mal mis en avant ; prix ou variantes confus ; aucune r\u00e9assurance pr\u00e8s du CTA ; livraison ou retours difficiles \u00e0 trouver ; manque de preuves sociales pr\u00e8s de la zone d\u2019achat ; photos insuffisantes ou peu convaincantes ; absence d\u2019\u00e9l\u00e9ments permettant de comprendre rapidement le produit.\n\nC. PREUVES ET CONFIANCE : absence d\u2019avis ; tr\u00e8s peu d\u2019avis ; avis plac\u00e9s trop loin de la d\u00e9cision d\u2019achat ; absence d\u2019UGC ; absence de t\u00e9moignages cr\u00e9dibles ; garanties peu visibles ; politique livraison/retours difficile \u00e0 comprendre ; manque d\u2019\u00e9l\u00e9ments de r\u00e9assurance.\n\nD. OFFRE : aucune offre claire ; aucune diff\u00e9rence visible par rapport aux concurrents ; absence de bundle alors que le produit s\u2019y pr\u00eate ; absence d\u2019offre quantit\u00e9 lorsque pertinente ; absence d\u2019incitation \u00e0 augmenter le panier moyen ; promotions excessives qui peuvent r\u00e9duire la valeur per\u00e7ue.\n\nE. PANIER : panier Shopify tr\u00e8s basique ; absence de cross-sell ; absence d\u2019upsell pertinent ; absence de seuil de livraison offerte lorsque pertinent ; informations importantes uniquement d\u00e9couvertes tardivement ; panier peu rassurant ; parcours inutilement complexe.\n\nF. MOBILE : textes trop petits ; CTA difficilement accessible ; sections excessivement longues ; mauvaise hi\u00e9rarchie visuelle ; popups intrusives ; \u00e9l\u00e9ments cass\u00e9s ou mal align\u00e9s ; informations essentielles trop \u00e9loign\u00e9es ; page produit p\u00e9nible \u00e0 parcourir.\n\nG. BRANDING / VALEUR PER\u00c7UE : incoh\u00e9rence graphique ; visuels faibles ; photos ressemblant \u00e0 des images fournisseur ; manque d\u2019identit\u00e9 ; faible perception de qualit\u00e9 par rapport au prix demand\u00e9 ; pr\u00e9sentation g\u00e9n\u00e9rique ou interchangeable avec de nombreux concurrents.\n\n\u00c9TAPE 3 \u2014 NE PAS CONFONDRE UN D\u00c9TAIL AVEC UN PROBL\u00c8ME CRO\n\nUn seul \u00e9l\u00e9ment manquant ne suffit PAS \u00e0 qualifier la boutique.\n\u201cPas de sticky Add to Cart\u201d seul = PAS suffisant. \u201cPas de bundle\u201d seul = PAS suffisant. \u201cPeu d\u2019avis\u201d seul = PAS suffisant.\nPour consid\u00e9rer qu\u2019il existe une vraie opportunit\u00e9 CRO, trouver au minimum 3 probl\u00e8mes significatifs ET au moins 1 probl\u00e8me important concernant la page produit, la zone d\u2019achat, la confiance ou le panier.\nLes probl\u00e8mes doivent \u00eatre pr\u00e9cis et observables. Ne donne pas de points pour des suppositions.\n\n\u00c9TAPE 4 \u2014 D\u00c9TECTER LES BOUTIQUES D\u00c9J\u00c0 TR\u00c8S OPTIMIS\u00c9ES\n\nRecherche \u00e9galement les signaux POSITIFS suivants : proposition de valeur imm\u00e9diatement claire ; excellente coh\u00e9rence de marque ; tr\u00e8s bons visuels produits ; nombreux avis cr\u00e9dibles ; UGC bien int\u00e9gr\u00e9 ; avantages produits tr\u00e8s bien structur\u00e9s ; informations livraison/retour pr\u00e8s du CTA ; garanties visibles ; sticky Add to Cart correctement ex\u00e9cut\u00e9 ; bundles ; offres quantit\u00e9 ; cross-sells pertinents ; upsells pertinents ; panier tiroir avanc\u00e9 ; barre de livraison offerte ; FAQ produit ; comparaison produit ; traitement clair des objections ; navigation excellente ; pages collections travaill\u00e9es ; bonne exp\u00e9rience mobile ; storytelling solide ; excellente hi\u00e9rarchie des informations.\nSi la boutique poss\u00e8de d\u00e9j\u00e0 un grand nombre de ces \u00e9l\u00e9ments correctement ex\u00e9cut\u00e9s, consid\u00e8re qu\u2019elle est D\u00c9J\u00c0 FORTEMENT OPTIMIS\u00c9E. Dans ce cas, ne la consid\u00e8re pas comme prospect prioritaire m\u00eame si elle fait beaucoup de publicit\u00e9.\nUne forte d\u00e9pense publicitaire ne doit JAMAIS compenser l\u2019absence de besoin CRO.\n\n\u00c9TAPE 5 \u2014 \u00c9VALUER LA QUALIT\u00c9 COMMERCIALE DE L\u2019ENTREPRISE\n\nUne mauvaise boutique n\u2019est pas forc\u00e9ment un bon prospect.\nFavoriser : branding d\u00e9j\u00e0 commenc\u00e9 ; catalogue coh\u00e9rent ; domaine professionnel ; email professionnel ; activit\u00e9 r\u00e9cente ; plusieurs publicit\u00e9s ; plusieurs produits coh\u00e9rents ; pr\u00e9sence sociale r\u00e9elle ; prix permettant probablement une marge suffisante ; pages l\u00e9gales ; marque identifiable ; site r\u00e9guli\u00e8rement entretenu.\nR\u00e9duire fortement le score pour : general stores ; boutiques manifestement abandonn\u00e9es ; sites presque vides ; produits totalement incoh\u00e9rents entre eux ; contenu grossi\u00e8rement copi\u00e9 ; promotions permanentes extr\u00eamement agressives ; faux compteurs ou techniques douteuses ; domaine suspect ; absence totale d\u2019identit\u00e9 ; boutiques lanc\u00e9es tr\u00e8s r\u00e9cemment sans signe d\u2019activit\u00e9 ; projets qui semblent \u00eatre de simples tests dropshipping sans v\u00e9ritable marque.\nJe cherche une entreprise suffisamment mature pour investir dans son site, mais dont le CRO n\u2019est pas encore au niveau de son acquisition.\n\n\u00c9TAPE 6 \u2014 SCORING\n\nAttribue quatre scores ind\u00e9pendants :\nADS_SCORE /100 : force des signaux indiquant que l\u2019entreprise investit actuellement dans l\u2019acquisition.\nCRO_GAP_SCORE /100 : quantit\u00e9 ET importance des opportunit\u00e9s CRO visibles. C\u2019est le score le plus important.\nBUSINESS_FIT_SCORE /100 : l\u2019entreprise semble suffisamment s\u00e9rieuse, active et mature pour travailler avec AdamEcom.\nCONTACT_SCORE /100 : facilit\u00e9 \u00e0 identifier un d\u00e9cideur ou un moyen de contact professionnel.\nAjoute \u00e9galement CRO_MATURITY_SCORE /100 : plus il est \u00e9lev\u00e9, plus la boutique est d\u00e9j\u00e0 correctement optimis\u00e9e.\n\n\u00c9TAPE 7 \u2014 R\u00c8GLES DE D\u00c9CISION\n\nPRIORIT\u00c9 HAUTE uniquement si : ADS_SCORE >= 60 ; CRO_GAP_SCORE >= 65 ; BUSINESS_FIT_SCORE >= 55 ; au moins 3 probl\u00e8mes CRO significatifs ; au moins 1 probl\u00e8me important dans la zone d\u2019achat / page produit / confiance / panier ; CRO_MATURITY_SCORE < 75.\nPRIORIT\u00c9 MOYENNE si la boutique semble int\u00e9ressante mais certains \u00e9l\u00e9ments n\u00e9cessitent une v\u00e9rification humaine.\nREJET si : CRO_GAP_SCORE < 45 ; ou CRO_MATURITY_SCORE >= 80 ; ou aucun probl\u00e8me CRO important ; ou boutique trop immature ; ou boutique non Shopify ; ou activit\u00e9 commerciale douteuse ; ou boutique d\u00e9j\u00e0 extr\u00eamement travaill\u00e9e.\nUne boutique connue, importante ou disposant de beaucoup de publicit\u00e9s ne doit PAS automatiquement recevoir un bon score.\n\n\u00c9TAPE 8 \u2014 CALCUL DU SCORE FINAL\n\nOPPORTUNITY_SCORE = 0.20 \u00d7 ADS_SCORE + 0.50 \u00d7 CRO_GAP_SCORE + 0.20 \u00d7 BUSINESS_FIT_SCORE + 0.10 \u00d7 CONTACT_SCORE\nP\u00e9nalit\u00e9 de maturit\u00e9 : CRO_MATURITY_SCORE >= 80 : \u00d7 0.35 ; entre 70 et 79 : \u00d7 0.60 ; entre 60 et 69 : \u00d7 0.80.\n\n\u00c9TAPE 9 \u2014 CLASSIFICATION\n\n75 \u00e0 100 : HOT_PROSPECT. 60 \u00e0 74 : MANUAL_REVIEW. 0 \u00e0 59 : REJECT.\nUne boutique ne peut jamais \u00eatre HOT_PROSPECT si CRO_GAP_SCORE < 65.\n\n\u00c9TAPE 10 \u2014 JUSTIFICATION\n\nPour chaque boutique retenue, donne exactement les 3 \u00e0 5 meilleures raisons observables qui justifient la prospection. Les raisons doivent \u00eatre sp\u00e9cifiques.\nMAUVAIS : \u201cLe site pourrait \u00eatre am\u00e9lior\u00e9.\u201d\nBON : \u201cLes avis clients sont absents de la zone d\u2019achat de la page produit.\u201d\nBON : \u201cLes informations de livraison ne sont pas visibles \u00e0 proximit\u00e9 du bouton Ajouter au panier.\u201d\nBON : \u201cLe panier ne propose aucun produit compl\u00e9mentaire malgr\u00e9 un catalogue compatible avec le cross-sell.\u201d\nNe jamais inventer un probl\u00e8me.\n\nDERNI\u00c8RE R\u00c8GLE\n\nLa qualit\u00e9 est plus importante que la quantit\u00e9. Sois s\u00e9v\u00e8re.\nEn cas de doute entre HOT_PROSPECT et MANUAL_REVIEW : choisis MANUAL_REVIEW.\nEn cas de doute entre MANUAL_REVIEW et REJECT : choisis REJECT.";
var RADAR_IA_ZONES_ACHAT = ["product_page", "buy_box", "trust", "cart"];
function radarTexteVisible(html, max) {
  return String(html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<svg[\s\S]*?<\/svg>/gi, " ").replace(/<(h[1-6]|button|li|p|div|section|a)\b[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").replace(/\n{2,}/g, "\n").trim().slice(0, max);
}
async function radarChargerPageProduit(domaine, html) {
  const liens = [...String(html || "").matchAll(/href=["'](?:https?:\/\/[^"'/]+)?(\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?products\/[a-z0-9][a-z0-9\-_%]*)["'?#]/gi)].map((m) => m[1]);
  const lien = liens.find((l) => !/\.(js|json|oembed)$/i.test(l));
  if (!lien) return null;
  try {
    const reponse = await fetch(`https://${domaine}${lien}`, {
      redirect: "follow",
      headers: { accept: "text/html", "accept-language": "fr-FR,fr;q=0.9", "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36" },
      signal: AbortSignal.timeout(12e3)
    });
    if (!reponse.ok) return null;
    return { url: `https://${domaine}${lien}`, html: (await reponse.text()).slice(0, 15e5) };
  } catch {
    return null;
  }
}
function radarIaScore(n) {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
}
function radarIaDecision(r, shopifyOui) {
  const ads = radarIaScore(r.ads_score), gap = radarIaScore(r.cro_gap_score), fit = radarIaScore(r.business_fit_score);
  const contact = radarIaScore(r.contact_score), maturite = radarIaScore(r.cro_maturity_score);
  let score = 0.2 * ads + 0.5 * gap + 0.2 * fit + 0.1 * contact;
  if (maturite >= 80) score *= 0.35;
  else if (maturite >= 70) score *= 0.6;
  else if (maturite >= 60) score *= 0.8;
  score = Math.round(score);
  const problemes = (Array.isArray(r.main_cro_issues) ? r.main_cro_issues : []).filter((i) => i && String(i.issue || "").trim());
  const significatifs = problemes.filter((i) => i.severity === "high" || i.severity === "medium");
  const achat = significatifs.some((i) => RADAR_IA_ZONES_ACHAT.includes(i.location));
  let decision = score >= 75 ? "HOT_PROSPECT" : score >= 60 ? "MANUAL_REVIEW" : "REJECT";
  const raisonsRejet = [];
  if (!shopifyOui || r.shopify_confirmed === false) raisonsRejet.push("boutique non Shopify");
  if (gap < 45) raisonsRejet.push("peu d'opportunit\xE9s CRO visibles");
  if (maturite >= 80) raisonsRejet.push("boutique d\xE9j\xE0 tr\xE8s optimis\xE9e");
  if (!achat) raisonsRejet.push("aucun probl\xE8me important sur la page produit, la confiance ou le panier");
  if (significatifs.length < 3) raisonsRejet.push("moins de 3 probl\xE8mes CRO significatifs");
  if (r.decision === "REJECT") raisonsRejet.push(String(r.rejection_reason || "rejet\xE9e par l'analyse").slice(0, 200));
  if (raisonsRejet.length) decision = "REJECT";
  else if (decision === "HOT_PROSPECT" && !(ads >= 60 && gap >= 65 && fit >= 55 && maturite < 75 && r.decision === "HOT_PROSPECT")) decision = "MANUAL_REVIEW";
  return { decision, score, raisonRejet: raisonsRejet[0] || (decision === "REJECT" ? `score d'opportunit\xE9 insuffisant (${score}/100)` : null), ads, gap, fit, contact, maturite };
}
async function radarQualifierIa(env, contexte) {
  const schema = {
    type: "object",
    properties: {
      decision: { type: "string", enum: ["HOT_PROSPECT", "MANUAL_REVIEW", "REJECT"] },
      opportunity_score: { type: "integer" },
      ads_score: { type: "integer" },
      cro_gap_score: { type: "integer" },
      cro_maturity_score: { type: "integer" },
      business_fit_score: { type: "integer" },
      contact_score: { type: "integer" },
      shopify_confirmed: { type: "boolean" },
      paid_ads_detected: { type: "boolean" },
      main_cro_issues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            issue: { type: "string" },
            severity: { type: "string", enum: ["high", "medium", "low"] },
            location: { type: "string", enum: ["homepage", "product_page", "buy_box", "cart", "mobile", "navigation", "trust"] }
          },
          required: ["issue", "severity", "location"]
        }
      },
      positive_cro_signals: { type: "array", items: { type: "string" } },
      business_quality_signals: { type: "array", items: { type: "string" } },
      rejection_reason: { type: "string" },
      outreach_angles: { type: "array", items: { type: "string" } },
      summary: { type: "string" }
    },
    required: ["decision", "opportunity_score", "ads_score", "cro_gap_score", "cro_maturity_score", "business_fit_score", "contact_score", "shopify_confirmed", "paid_ads_detected", "main_cro_issues", "positive_cro_signals", "business_quality_signals", "rejection_reason", "outreach_angles", "summary"]
  };
  const input = `${RADAR_IA_REGLES}

==================================================
CE QUE TU PEUX OBSERVER POUR CETTE BOUTIQUE
==================================================

Tu re\xE7ois le texte visible de la page d'accueil et d'une page produit, extrait du HTML, ainsi que des signaux d\xE9tect\xE9s automatiquement. Tu ne vois ni les images ni le rendu mobile ni le panier rempli : ne juge pas ce que tu ne peux pas observer (visuels, mobile, panier) et ne compte aucun probl\xE8me suppos\xE9. R\xE9dige tout en fran\xE7ais. Retourne uniquement le JSON demand\xE9 (decision, opportunity_score, ads_score, cro_gap_score, cro_maturity_score, business_fit_score, contact_score, shopify_confirmed, paid_ads_detected, main_cro_issues, positive_cro_signals, business_quality_signals, rejection_reason, outreach_angles, summary).

${contexte}`;
  const essais = [env.GEMINI_QUALIF_MODEL, "gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite"].filter(Boolean);
  let payload = null, derniereErreur = "";
  for (const [n, modele] of essais.entries()) {
    if (n > 0) await new Promise((r) => setTimeout(r, 1500));
    const reponse = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({ model: modele, input, response_format: { type: "text", mime_type: "application/json", schema } }),
      signal: AbortSignal.timeout(6e4)
    }).catch((e) => ({ ok: false, status: 0, json: async () => ({ message: String(e?.message || e) }) }));
    const corps = await reponse.json().catch(() => null);
    if (reponse.ok) {
      payload = corps;
      break;
    }
    derniereErreur = erreurInteractionGemini(corps);
    if (![0, 404, 429, 500, 503].includes(reponse.status) && !/demand|overload|unavailable|quota|not found|no longer available/i.test(derniereErreur)) break;
  }
  if (!payload) throw new Error(`Analyse IA : ${derniereErreur}`);
  const texte = texteInteractionGemini(payload);
  try {
    return JSON.parse(texte);
  } catch {
    throw new Error("Analyse IA : r\xE9ponse illisible.");
  }
}
function radarContexteIa(annonceur, site, produit, technos, avis, qualite, contacts) {
  const croAccueil = radarSignauxCro(site.html), croProduit = produit ? radarSignauxCro(produit.html) : {};
  const oui = (o) => Object.entries(o).filter(([, v]) => v).map(([k]) => k).join(", ") || "aucun";
  const pub = radarEstSourceWeb(annonceur.source) ? `Boutique trouv\xE9e par recherche web (${radarLibelleSource(annonceur.source)}) : aucune publicit\xE9 Meta observ\xE9e directement.` : `Meta Ad Library : ${annonceur.pubsActives || 0} publicit\xE9(s) active(s)${annonceur.premierePub ? `, premi\xE8re pub vue le ${String(annonceur.premierePub).slice(0, 10)}` : ""}${annonceur.portee ? `, port\xE9e UE ${annonceur.portee}` : ""}.`;
  return `Boutique : ${annonceur.nom || annonceur.domaine}
Domaine : ${annonceur.domaine}
Acquisition : ${pub}
Outils d\xE9tect\xE9s dans le code : ${technos.filter((t) => t.detecte).map((t) => t.nom).join(", ") || "aucun"}${qualite.outils?.length ? ", " + qualite.outils.join(", ") : ""}
Th\xE8me Shopify : ${qualite.theme || "inconnu"}${qualite.themePerso ? " (personnalis\xE9)" : ""}
Nombre d'avis d\xE9tect\xE9 : ${avis || 0}
Contacts trouv\xE9s : ${contacts || "aucun sur la page d'accueil"}
Signaux CRO pr\xE9sents (accueil) : ${oui(croAccueil)}
Signaux CRO pr\xE9sents (page produit) : ${produit ? oui(croProduit) : "page produit non trouv\xE9e"}

--- TEXTE DE LA PAGE D'ACCUEIL ---
${radarTexteVisible(site.html, 7e3)}

--- TEXTE DE LA PAGE PRODUIT${produit ? ` (${produit.url})` : ""} ---
${produit ? radarTexteVisible(produit.html, 9e3) : "Aucune page produit trouv\xE9e depuis l'accueil."}`;
}
function radarIaResume(r, d) {
  const liste = (a, n, max) => (Array.isArray(a) ? a : []).slice(0, n).map((x) => String(x).slice(0, max));
  return JSON.stringify({
    decision: d.decision,
    score: d.score,
    ads: d.ads,
    gap: d.gap,
    fit: d.fit,
    contact: d.contact,
    maturite: d.maturite,
    pubs: !!r.paid_ads_detected,
    problemes: (Array.isArray(r.main_cro_issues) ? r.main_cro_issues : []).slice(0, 6).map((i) => ({ p: String(i.issue || "").slice(0, 220), g: i.severity, z: i.location })),
    positifs: liste(r.positive_cro_signals, 5, 120),
    business: liste(r.business_quality_signals, 4, 120),
    angles: liste(r.outreach_angles, 3, 220),
    resume: String(r.summary || "").slice(0, 500),
    rejet: d.raisonRejet
  });
}
var RADAR_IA_LIBELLES = { HOT_PROSPECT: ["\u{1F525} Prospect chaud", "vert"], MANUAL_REVIEW: ["\u{1F50D} \xC0 v\xE9rifier", "jaune"], REJECT: ["Rejet\xE9", "rouge"] };
var RADAR_IA_ZONES = { homepage: "accueil", product_page: "page produit", buy_box: "zone d'achat", cart: "panier", mobile: "mobile", navigation: "navigation", trust: "confiance" };
function radarIaBloc(p, complet) {
  const a = radarIaLire(p);
  if (!a) return p?.ia_decision === "ERREUR" && complet ? `<div class="alerte">Analyse IA impossible : ${echapper(p.derniere_erreur || "erreur inconnue")}</div>` : "";
  const [lib, ton] = RADAR_IA_LIBELLES[a.decision] || [a.decision, ""];
  const problemes = (a.problemes || []).filter((x) => x.g !== "low");
  if (!complet) {
    return `<div class="jr-ia"><span class="jr-tag ${ton}">${lib}</span>
      ${problemes.length ? `<ul>${problemes.slice(0, 3).map((x) => `<li>${echapper(x.p)}</li>`).join("")}</ul>` : ""}
      ${a.angles?.[0] ? `<div class="sec">Angle d'approche : ${echapper(a.angles[0])}</div>` : ""}</div>`;
  }
  const ligne = (k, v) => `<tr><td>${k}</td><td><b>${v}</b>/100</td></tr>`;
  return `<section><h2>Analyse IA</h2>
    <p><span class="jr-tag ${ton}">${lib}</span> Score d'opportunit\xE9 <b>${a.score}</b>/100${a.rejet ? ` \xB7 ${echapper(a.rejet)}` : ""}</p>
    ${a.resume ? `<p>${echapper(a.resume)}</p>` : ""}
    <div class="tw"><table><tbody>
      ${ligne("Opportunit\xE9s CRO (le plus important)", a.gap)}${ligne("Publicit\xE9 / acquisition", a.ads)}${ligne("S\xE9rieux de l'entreprise", a.fit)}${ligne("Contact", a.contact)}${ligne("Maturit\xE9 CRO (\xE9lev\xE9 = d\xE9j\xE0 optimis\xE9e)", a.maturite)}
    </tbody></table></div>
    ${(a.problemes || []).length ? `<h3>Frictions CRO observ\xE9es</h3><ul>${a.problemes.map((x) => `<li><b>${x.g === "high" ? "Important" : x.g === "medium" ? "Moyen" : "Mineur"}</b> \xB7 ${echapper(RADAR_IA_ZONES[x.z] || x.z || "")} : ${echapper(x.p)}</li>`).join("")}</ul>` : ""}
    ${(a.angles || []).length ? `<h3>Angles d'approche</h3><ul>${a.angles.map((x) => `<li>${echapper(x)}</li>`).join("")}</ul>` : ""}
    ${(a.positifs || []).length ? `<h3>D\xE9j\xE0 bien fait</h3><ul>${a.positifs.map((x) => `<li>${echapper(x)}</li>`).join("")}</ul>` : ""}
    ${(a.business || []).length ? `<h3>Signaux business</h3><ul>${a.business.map((x) => `<li>${echapper(x)}</li>`).join("")}</ul>` : ""}
  </section>`;
}
function radarIaLire(p) {
  try {
    return p?.ia_analyse ? JSON.parse(p.ia_analyse) : null;
  } catch {
    return null;
  }
}
async function radarAnalyserAnnonceur(env, annonceur, reg) {
  const db = env.DB;
  const maintenant = (/* @__PURE__ */ new Date()).toISOString();
  if (!annonceur.domaine) return { analyse: false, raison: "domaine_non_resolu" };
  const doublon = await db.prepare("SELECT page_id FROM radar_prospects WHERE domaine=? AND page_id<>? LIMIT 1").bind(
    annonceur.domaine,
    annonceur.pageId
  ).first();
  if (doublon) return { analyse: false, raison: "doublon_domaine" };
  if (await radarMemeBoutiqueConnue(db, annonceur.domaine, annonceur.pageId)) return { analyse: false, raison: "doublon_boutique" };
  try {
    const site = await radarChargerSite(annonceur.domaine);
    const shopify2 = radarDetecterShopify(site.html, site.entetes);
    const technos = radarDetecterTechnos(site.html);
    const cro = radarSignauxCro(site.html);
    const marche = radarEvaluerMarche(site.html, annonceur.domaine, reg.pays);
    const pertinence = radarEvaluerPertinence(site.html, annonceur.motCle || "", annonceur.niche);
    if (annonceur.pertinenceIndex) pertinence.confiance = Math.max(60, pertinence.confiance);
    const [rdap, pagespeed] = await Promise.all([
      radarLireRdap(annonceur.domaine),
      reg.brut.pagespeed_actif === "0" || !env.PAGESPEED_API_KEY ? null : radarLirePageSpeed(env, annonceur.domaine)
    ]);
    const temporaire = {
      source: annonceur.source || "meta",
      marche_statut: marche.statut,
      pertinence_niche: pertinence.confiance,
      premiere_pub_vue: annonceur.premierePub,
      pubs_actives: annonceur.pubsActives,
      portee_ue: annonceur.portee,
      shopify_statut: shopify2.statut,
      pagespeed_score: pagespeed?.score ?? null,
      cro_signaux: JSON.stringify(cro),
      domaine: annonceur.domaine,
      domaine_confiance: annonceur.confiance,
      technos_n: technos.filter((t) => t.detecte).length,
      domaine_cree_le: rdap.creeLe,
      google_ads: technos.some((t) => t.nom === "Google Ads" && t.detecte),
      nombre_avis: radarNombreAvis(site.html)
    };
    const resultatScore = radarScorer(temporaire, reg);
    const joursPub = radarJoursDepuis(annonceur.premierePub);
    const joursDomaine = radarJoursDepuis(rdap.creeLe);
    const sourceWeb = radarEstSourceWeb(annonceur.source);
    const activiteValide = sourceWeb || annonceur.pubsActives >= reg.pubsMin && (joursPub === null || joursPub >= reg.pubAncienneteMin);
    const marcheValide = !sourceWeb || marche.statut === "oui";
    const nicheValide = !sourceWeb || pertinence.confiance >= 60;
    const qualite = radarEvaluerQualite(site.html, annonceur.pubsActives, temporaire.nombre_avis, reg.pays);
    let qualifie = !qualite.exclusion && resultatScore.score >= reg.scoreMin && activiteValide && marcheValide && nicheValide && (!reg.shopifyObligatoire || shopify2.statut === "oui");
    let ia = null;
    const activiteIa = sourceWeb || annonceur.pubsActives >= reg.pubsMin;
    if (env.GEMINI_API_KEY && !qualite.exclusion && activiteIa && marcheValide && nicheValide && shopify2.statut === "oui") {
      try {
        const produit = await radarChargerPageProduit(annonceur.domaine, site.html);
        const contactsAccueil = radarExtraireContacts(site.html, annonceur.domaine);
        const contactsTexte = [...(contactsAccueil.emails || []).slice(0, 2), contactsAccueil.telephone, contactsAccueil.instagram && "Instagram @" + contactsAccueil.instagram].filter(Boolean).join(", ");
        const brutIa = await radarQualifierIa(env, radarContexteIa(annonceur, site, produit, technos, temporaire.nombre_avis, qualite, contactsTexte));
        const d = radarIaDecision(brutIa, shopify2.statut === "oui");
        ia = { decision: d.decision, score: d.score, json: radarIaResume(brutIa, d), rejet: d.raisonRejet };
        resultatScore.score = d.score;
        qualifie = d.decision !== "REJECT";
        if (d.decision === "REJECT") qualite.exclusion = { statut: "non pertinent", motif: `auto : IA, ${d.raisonRejet || "pas d'opportunit\xE9 CRO suffisante"}`.slice(0, 200) };
      } catch (e) {
        ia = { decision: "ERREUR", score: null, json: null, rejet: String(e?.message || e).slice(0, 300) };
        qualifie = false;
      }
    } else if (env.GEMINI_API_KEY) {
      qualifie = false;
    }
    await db.prepare(`INSERT INTO radar_prospects
      (page_id,source,source_url,marque,domaine,domaine_confiance,domaine_methode,domaine_cree_le,registrar,pays,
       marche_statut,marche_confiance,marche_preuves,niche,pertinence_niche,categorie,
       shopify_statut,shopify_confiance,pagespeed_score,lcp,cls,fcp,tbt,si,cro_signaux,score,score_detail,statut,
       etape,derniere_erreur,presente_le,cree_le,analyse_le,premiere_pub_vue,derniere_pub_vue,pubs_actives,portee_ue,technos_n)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'nouveau','analyse',NULL,?,?,?,?,?,?,?,?)
      ON CONFLICT(page_id) DO UPDATE SET
       source=excluded.source,source_url=COALESCE(excluded.source_url,radar_prospects.source_url),
       marque=excluded.marque,domaine=excluded.domaine,domaine_confiance=excluded.domaine_confiance,
       domaine_methode=excluded.domaine_methode,domaine_cree_le=excluded.domaine_cree_le,registrar=excluded.registrar,
       pays=excluded.pays,marche_statut=excluded.marche_statut,marche_confiance=excluded.marche_confiance,
       marche_preuves=excluded.marche_preuves,niche=excluded.niche,pertinence_niche=excluded.pertinence_niche,
       categorie=excluded.categorie,shopify_statut=excluded.shopify_statut,
       shopify_confiance=excluded.shopify_confiance,pagespeed_score=excluded.pagespeed_score,lcp=excluded.lcp,
       cls=excluded.cls,fcp=excluded.fcp,tbt=excluded.tbt,si=excluded.si,cro_signaux=excluded.cro_signaux,
       score=excluded.score,score_detail=excluded.score_detail,etape='analyse',derniere_erreur=NULL,
       presente_le=COALESCE(radar_prospects.presente_le,excluded.presente_le),analyse_le=excluded.analyse_le,
       premiere_pub_vue=excluded.premiere_pub_vue,derniere_pub_vue=excluded.derniere_pub_vue,
       pubs_actives=excluded.pubs_actives,portee_ue=excluded.portee_ue,technos_n=excluded.technos_n`).bind(
      annonceur.pageId,
      annonceur.source || "meta",
      annonceur.sourceUrl || null,
      annonceur.nom,
      annonceur.domaine,
      annonceur.confiance,
      annonceur.methode,
      rdap.creeLe,
      rdap.registrar,
      reg.pays,
      marche.statut,
      marche.confiance,
      JSON.stringify(marche.preuves),
      annonceur.niche,
      pertinence.confiance,
      radarCategoriser(joursDomaine, joursPub),
      shopify2.statut,
      shopify2.confiance,
      pagespeed?.score ?? null,
      pagespeed?.lcp ?? null,
      pagespeed?.cls ?? null,
      pagespeed?.fcp ?? null,
      pagespeed?.tbt ?? null,
      pagespeed?.si ?? null,
      JSON.stringify(cro),
      resultatScore.score,
      JSON.stringify(resultatScore.detail),
      qualifie ? maintenant.slice(0, 10) : null,
      maintenant,
      maintenant,
      annonceur.premierePub,
      annonceur.dernierePub,
      annonceur.pubsActives,
      annonceur.portee || null,
      technos.filter((t) => t.detecte).length
    ).run();
    const prospect = await db.prepare("SELECT id, statut, presente_le FROM radar_prospects WHERE page_id=?").bind(annonceur.pageId).first();
    if (prospect?.id && ia) await db.prepare("UPDATE radar_prospects SET ia_decision=?, ia_analyse=?, derniere_erreur=? WHERE id=?").bind(ia.decision, ia.json, ia.decision === "ERREUR" ? ia.rejet : null, prospect.id).run();
    if (prospect?.id) await radarEnregistrerQualite(db, prospect, qualite);
    if (prospect?.id && qualifie) await radarEnregistrerContacts(db, prospect.id, annonceur.domaine, site.html);
    if (prospect?.id) {
      for (const techno of technos) {
        await db.prepare(`INSERT INTO radar_technos (prospect_id,techno,detecte) VALUES (?,?,?)
          ON CONFLICT(prospect_id,techno) DO UPDATE SET detecte=excluded.detecte`).bind(
          prospect.id,
          techno.nom,
          techno.detecte ? 1 : 0
        ).run();
      }
    }
    return { analyse: true, qualifie, score: resultatScore.score, ia: ia?.decision || null, iaErreur: ia?.decision === "ERREUR" ? ia.rejet : null };
  } catch (e) {
    const erreur = String(e?.message || e).slice(0, 500);
    await db.prepare(`INSERT INTO radar_prospects
      (page_id,source,source_url,marque,domaine,domaine_confiance,domaine_methode,pays,niche,score,statut,etape,derniere_erreur,
       cree_le,analyse_le,premiere_pub_vue,derniere_pub_vue,pubs_actives,portee_ue,technos_n)
      VALUES (?,?,?,?,?,?,?,?,?,0,'nouveau','erreur',?,?,?,?,?,?,?,0)
      ON CONFLICT(page_id) DO UPDATE SET source=excluded.source,
       source_url=COALESCE(excluded.source_url,radar_prospects.source_url),
       domaine=excluded.domaine,domaine_confiance=excluded.domaine_confiance,
       domaine_methode=excluded.domaine_methode,etape='erreur',derniere_erreur=excluded.derniere_erreur,
       analyse_le=excluded.analyse_le,premiere_pub_vue=excluded.premiere_pub_vue,
       derniere_pub_vue=excluded.derniere_pub_vue,pubs_actives=excluded.pubs_actives`).bind(
      annonceur.pageId,
      annonceur.source || "meta",
      annonceur.sourceUrl || null,
      annonceur.nom,
      annonceur.domaine,
      annonceur.confiance,
      annonceur.methode,
      reg.pays,
      annonceur.niche,
      erreur,
      maintenant,
      maintenant,
      annonceur.premierePub,
      annonceur.dernierePub,
      annonceur.pubsActives,
      annonceur.portee || null
    ).run();
    return { analyse: false, raison: erreur };
  }
}
__name(radarAnalyserAnnonceur, "radarAnalyserAnnonceur");
__name2(radarAnalyserAnnonceur, "radarAnalyserAnnonceur");
async function executerRadar(env, objectifJour) {
  await assurerRadarSchema(env.DB);
  const db = env.DB;
  const reg = await radarReglages(db);
  if (objectifJour) reg.parJour = objectifJour;
  const motCle = await db.prepare(`SELECT * FROM radar_motscles WHERE actif=1
    ORDER BY CASE WHEN priorite='haute' THEN 0 ELSE 1 END,COALESCE(dernier_passage,'') ASC,id ASC LIMIT 1`).first();
  if (!motCle) return { bloque: "Aucun mot-cl\xE9 actif" };
  const maintenant = (/* @__PURE__ */ new Date()).toISOString();
  let source = env.META_TOKEN ? "meta" : env.GEMINI_API_KEY ? "google_gemini" : "web_brave";
  const avertissements = [];
  let pubs = [];
  let candidatsWeb = [];
  if (source === "meta") {
    try {
      const cleCurseur = `meta_curseur_${motCle.id}`;
      pubs = await radarRechercheMeta(env, motCle.mot, reg.pays, reg.brut[cleCurseur] || null);
      await db.prepare("INSERT OR REPLACE INTO radar_reglages (cle, valeur, maj_le) VALUES (?, ?, ?)").bind(cleCurseur, pubs.suivant || "", maintenant).run();
      if (!pubs.length) {
        source = env.GEMINI_API_KEY ? "google_gemini" : "web_brave";
        avertissements.push("Meta n'a renvoy\xE9 aucune annonce pour ce mot-cl\xE9.");
      }
    } catch (e) {
      source = env.GEMINI_API_KEY ? "google_gemini" : "web_brave";
      avertissements.push(String(e?.message || e).slice(0, 300));
    }
  }
  if (source === "google_gemini") {
    try {
      candidatsWeb = await radarRechercheGoogleGemini(env, motCle.mot, motCle.niche, reg.pays);
      if (!candidatsWeb.length) {
        source = "web_brave";
        avertissements.push("Gemini n'a renvoy\xE9 aucune boutique pour ce mot-cl\xE9.");
      }
    } catch (e) {
      source = "web_brave";
      avertissements.push(String(e?.message || e).slice(0, 300));
    }
  }
  if (source === "web_brave") {
    try {
      candidatsWeb = await radarRechercheBrave(env, motCle.mot, motCle.niche, reg.pays);
    } catch (e) {
      source = "common_crawl";
      avertissements.push(String(e?.message || e).slice(0, 300));
    }
  }
  if (source === "common_crawl") {
    try {
      candidatsWeb = await radarRechercheCommonCrawl(env, motCle.mot, motCle.niche, reg.pays, motCle.id);
    } catch (e) {
      avertissements.push(`Common Crawl : ${String(e?.message || e).slice(0, 200)}`);
      throw new Error(avertissements.join(" \u2014 "));
    }
  }
  const groupes = /* @__PURE__ */ new Map();
  if (source === "meta") {
    for (const pub of pubs) {
      if (!await radarEnregistrerPub(db, pub, motCle.mot, maintenant)) continue;
      const pageId = String(pub.page_id);
      const domaine = radarDomaineDepuisPub(pub);
      const debut = pub.ad_delivery_start_time || pub.ad_creation_time || null;
      const courant = groupes.get(pageId) || {
        pageId,
        source: "meta",
        sourceUrl: pub.ad_snapshot_url || null,
        nom: pub.page_name || pageId,
        motCle: motCle.mot,
        niche: motCle.niche,
        premierePub: null,
        dernierePub: null,
        domaine: null,
        confiance: 0,
        methode: null,
        portee: 0,
        pubsActives: 0
      };
      courant.premierePub = radarDateMin(courant.premierePub, debut);
      courant.dernierePub = radarDateMax(courant.dernierePub, debut);
      courant.portee += Number(pub.eu_total_reach || 0) || 0;
      courant.pubsActives += 1;
      if (domaine.domaine && domaine.confiance > courant.confiance) {
        courant.domaine = domaine.domaine;
        courant.confiance = domaine.confiance;
        courant.methode = domaine.methode;
      }
      groupes.set(pageId, courant);
    }
  } else {
    for (const candidat of candidatsWeb) {
      candidat.motCle = motCle.mot;
      groupes.set(candidat.pageId, candidat);
    }
  }
  await db.prepare("UPDATE radar_motscles SET dernier_passage=? WHERE id=?").bind(maintenant, motCle.id).run();
  if (source === "meta") {
    for (const annonceur of groupes.values()) {
      const total = await db.prepare("SELECT COUNT(*) AS n FROM radar_pubs WHERE page_id=? AND active=1").bind(annonceur.pageId).first();
      annonceur.pubsActives = Number(total?.n || annonceur.pubsActives || 0);
      await db.prepare(`INSERT INTO radar_annonceurs
        (page_id,page_name,premiere_pub_vue,derniere_pub_vue,pubs_actives,portee_ue,pays,niche,vu_le,maj_le)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(page_id) DO UPDATE SET page_name=excluded.page_name,
         premiere_pub_vue=CASE WHEN radar_annonceurs.premiere_pub_vue IS NULL OR excluded.premiere_pub_vue < radar_annonceurs.premiere_pub_vue THEN excluded.premiere_pub_vue ELSE radar_annonceurs.premiere_pub_vue END,
         derniere_pub_vue=CASE WHEN radar_annonceurs.derniere_pub_vue IS NULL OR excluded.derniere_pub_vue > radar_annonceurs.derniere_pub_vue THEN excluded.derniere_pub_vue ELSE radar_annonceurs.derniere_pub_vue END,
         pubs_actives=excluded.pubs_actives,portee_ue=MAX(COALESCE(radar_annonceurs.portee_ue,0),COALESCE(excluded.portee_ue,0)),
         niche=COALESCE(radar_annonceurs.niche,excluded.niche),maj_le=excluded.maj_le
        RETURNING premiere_pub_vue`).bind(
        annonceur.pageId,
        annonceur.nom,
        annonceur.premierePub,
        annonceur.dernierePub,
        annonceur.pubsActives,
        annonceur.portee || null,
        reg.pays,
        annonceur.niche,
        maintenant,
        maintenant
      ).first().then((h) => {
        if (h?.premiere_pub_vue) annonceur.premierePub = radarDateMin(annonceur.premierePub, h.premiere_pub_vue);
      });
    }
  }
  const limite = Math.max(1, Math.min(env.GEMINI_API_KEY ? 3 : 10, Number(reg.brut.candidats_par_passage || 5)));
  const avecDomaine = [...groupes.values()].filter((a) => a.domaine);
  const deja = /* @__PURE__ */ new Set();
  for (let i = 0; i < avecDomaine.length; i += 40) {
    const lot = avecDomaine.slice(i, i + 40);
    const marques = lot.map(() => "?").join(",");
    const connus = await tous2(db, `SELECT page_id, domaine FROM radar_prospects
      WHERE (domaine IN (${marques}) OR page_id IN (${marques}))
        AND (presente_le IS NOT NULL OR ia_decision IN ('HOT_PROSPECT','MANUAL_REVIEW','REJECT') OR statut<>'nouveau' OR julianday('now')-julianday(cree_le)>30)`, ...lot.map((a) => a.domaine), ...lot.map((a) => a.pageId));
    for (const c of connus) deja.add(c.domaine).add(c.page_id);
  }
  const candidats = avecDomaine.filter((a) => !deja.has(a.domaine) && !deja.has(a.pageId)).sort((a, b) => b.pubsActives - a.pubsActives).slice(0, limite);
  let analyses = 0;
  let qualifies = 0;
  let iaRejets = 0;
  for (const candidat of candidats) {
    const r = await radarAnalyserAnnonceur(env, candidat, reg);
    if (r.analyse) analyses += 1;
    if (r.qualifie) qualifies += 1;
    if (r.ia === "REJECT") iaRejets += 1;
    if (r.iaErreur && !avertissements.some((a) => a.startsWith("Analyse IA"))) avertissements.push(r.iaErreur);
  }
  qualifies += await radarCompleterJour(db, reg, !!env.GEMINI_API_KEY);
  return {
    source,
    motCle: motCle.mot,
    annonces: pubs.length,
    resultats: source === "meta" ? pubs.length : candidatsWeb.length,
    annonceurs: groupes.size,
    analyses,
    qualifies,
    iaRejets,
    avertissement: avertissements.join(" | ") || null
  };
}
__name(executerRadar, "executerRadar");
__name2(executerRadar, "executerRadar");
async function radarCompleterJour(db, reg, exigerIa = false) {
  const jour = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const deja = await db.prepare("SELECT COUNT(*) AS n FROM radar_prospects WHERE presente_le=? AND statut NOT IN ('non pertinent','d\xE9j\xE0 optimis\xE9','supprim\xE9')").bind(jour).first();
  const manque = reg.parJour - Number(deja?.n || 0);
  if (manque <= 0) return 0;
  const r = await db.prepare(`UPDATE radar_prospects SET presente_le=? WHERE id IN (
      SELECT id FROM radar_prospects
      WHERE presente_le IS NULL AND statut='nouveau' AND etape='analyse' AND score>=?
        AND qualite_verifiee_le IS NOT NULL AND qualite_exclusion IS NULL AND julianday('now')-julianday(cree_le)<=7
        AND (source IN ('google_gemini','web_brave','common_crawl') OR (COALESCE(source,'meta')='meta' AND pubs_actives>=?
          AND (premiere_pub_vue IS NULL OR julianday('now')-julianday(premiere_pub_vue)>=?)))
        AND (?=0 OR shopify_statut='oui')
        AND (?=0 OR ia_decision IN ('HOT_PROSPECT','MANUAL_REVIEW'))
      ORDER BY ia_decision='HOT_PROSPECT' DESC, score DESC, id DESC LIMIT ?)`).bind(
    jour,
    exigerIa ? 60 : reg.scoreComplement,
    reg.pubsMin,
    reg.pubAncienneteMin,
    reg.shopifyObligatoire ? 1 : 0,
    exigerIa ? 1 : 0,
    manque
  ).run();
  return Number(r?.meta?.changes || 0);
}
__name(radarCompleterJour, "radarCompleterJour");
__name2(radarCompleterJour, "radarCompleterJour");
var RADAR_RECHERCHE_PASSES_MAX = 400;
var RADAR_PASSES_PAR_JOUR = 150;
function radarEtatRecherche(reg) {
  try {
    return reg?.brut?.recherche_manuelle ? JSON.parse(reg.brut.recherche_manuelle) : null;
  } catch {
    return null;
  }
}
async function radarEcrireRecherche(db, etat) {
  await db.prepare("INSERT OR REPLACE INTO radar_reglages (cle, valeur, maj_le) VALUES ('recherche_manuelle', ?, ?)").bind(JSON.stringify(etat), (/* @__PURE__ */ new Date()).toISOString()).run();
}
async function radarProposesAujourdhui(db) {
  const jour = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const r = await db.prepare("SELECT COUNT(*) AS n FROM radar_prospects WHERE presente_le=? AND statut NOT IN ('non pertinent','d\xE9j\xE0 optimis\xE9','supprim\xE9')").bind(jour).first();
  return Number(r?.n || 0);
}
async function radarModeAuto(db) {
  const r = await db.prepare("SELECT valeur FROM radar_reglages WHERE cle='mode_collecte'").first().catch(() => null);
  return r?.valeur === "auto";
}
async function radarDemarrerRecherche(env) {
  const reg = await radarReglages(env.DB);
  const etat = radarEtatRecherche(reg);
  if (etat && !etat.fin) return { erreur: "Une recherche est d\xE9j\xE0 en cours." };
  const trouves = await radarProposesAujourdhui(env.DB);
  await radarEcrireRecherche(env.DB, { debut: (/* @__PURE__ */ new Date()).toISOString(), passes: 0, max: RADAR_RECHERCHE_PASSES_MAX, depart: trouves, trouves, erreurs: 0 });
  return { ok: true };
}
async function radarRechercheEtape(env) {
  try {
    const db = env.DB;
    const brut = await db.prepare("SELECT valeur FROM radar_reglages WHERE cle='recherche_manuelle'").first().catch(() => null);
    if (!brut?.valeur || brut.valeur.includes('"fin"')) return;
    const reg = await radarReglages(db);
    const etat = radarEtatRecherche(reg);
    if (!etat || etat.fin) return;
    if (etat.verrou && Date.parse(etat.verrou) > Date.now()) return;
    const terminer = /* @__PURE__ */ __name2(async () => {
      etat.fin = (/* @__PURE__ */ new Date()).toISOString();
      etat.verrou = null;
      await radarEcrireRecherche(db, etat);
    }, "terminer");
    const objectif = (etat.depart || 0) + reg.parJour;
    etat.trouves = await radarProposesAujourdhui(db);
    if (etat.trouves >= objectif || etat.passes >= etat.max) return await terminer();
    const jour = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    let compteur = {};
    try {
      compteur = JSON.parse(reg.brut.recherche_jour || "{}");
    } catch {
    }
    const passesJour = compteur.jour === jour ? Number(compteur.passes || 0) : 0;
    if (passesJour >= RADAR_PASSES_PAR_JOUR) {
      etat.erreur = `limite de ${RADAR_PASSES_PAR_JOUR} passages par jour atteinte (protection de l'app), relancez demain`;
      return await terminer();
    }
    await db.prepare("INSERT OR REPLACE INTO radar_reglages (cle, valeur, maj_le) VALUES ('recherche_jour', ?, ?)").bind(JSON.stringify({ jour, passes: passesJour + 1 }), (/* @__PURE__ */ new Date()).toISOString()).run();
    etat.verrou = new Date(Date.now() + 4 * 6e4).toISOString();
    await radarEcrireRecherche(db, etat);
    const debut = Date.now();
    try {
      const r = await executerRadar(env, objectif);
      if (r.bloque) {
        etat.erreur = r.bloque;
        return await terminer();
      }
      etat.dernier = radarResumeCollecte(r);
      etat.erreurs = 0;
      await noterExecution(db, "radar", Date.now() - debut, "ok", etat.dernier);
    } catch (e) {
      etat.erreurs = (etat.erreurs || 0) + 1;
      await noterExecution(db, "radar", Date.now() - debut, "erreur", String(e?.message || e).slice(0, 500));
      if (etat.erreurs >= 3) etat.erreur = String(e?.message || e).slice(0, 300);
    }
    etat.passes += 1;
    etat.verrou = null;
    etat.trouves = await radarProposesAujourdhui(db);
    if (etat.trouves >= objectif || etat.passes >= etat.max || etat.erreurs >= 3) return await terminer();
    await radarEcrireRecherche(db, etat);
  } catch (e) {
    console.error("recherche manuelle radar", e?.message || e);
  }
}
function radarResumeCollecte(r) {
  if (!r) return "Collecte termin\xE9e.";
  const origine = radarLibelleSource(r.source);
  const unite = r.source === "meta" ? "annonce(s)" : "boutique(s) trouv\xE9e(s)";
  const secours = r.avertissement ? " \xB7 source de secours utilis\xE9e" : "";
  return `${origine} \xB7 ${r.motCle} : ${r.resultats ?? r.annonces ?? 0} ${unite}, ${r.annonceurs || 0} candidat(s), ${r.analyses || 0} analyse(s), ${r.qualifies || 0} retenu(s)${r.iaRejets ? `, ${r.iaRejets} rejet\xE9(s) par l'IA` : ""}${secours}`;
}
__name(radarResumeCollecte, "radarResumeCollecte");
__name2(radarResumeCollecte, "radarResumeCollecte");
var RADAR_STATUTS = ["nouveau", "\xE0 v\xE9rifier", "\xE0 contacter", "contact\xE9", "r\xE9pondu", "rdv", "client", "non pertinent", "d\xE9j\xE0 optimis\xE9"];
var RADAR_SORTIS = ["contact\xE9", "r\xE9pondu", "rdv", "client", "non pertinent", "d\xE9j\xE0 optimis\xE9"];
var RADAR_MOTIFS = [
  "d\xE9j\xE0 contact\xE9",
  "trop petite",
  "mauvaise niche",
  "hors Shopify",
  "d\xE9j\xE0 optimis\xE9e",
  "aucun besoin CRO",
  "marque trop importante",
  "budget probablement insuffisant",
  "dropshipping trop amateur",
  "autre"
];
function radarPriorite(s) {
  if (s >= 85) return { icone: "\u{1F525}", nom: "Tr\xE8s forte", classe: "bon" };
  if (s >= 70) return { icone: "\u{1F7E0}", nom: "Int\xE9ressante", classe: "moyen" };
  return { icone: "\u26AA", nom: "Faible", classe: "neutre" };
}
__name(radarPriorite, "radarPriorite");
__name2(radarPriorite, "radarPriorite");
var RADAR_EMAIL_OBJET_DEFAUT = "Vous payez des clics qui n'ach\xE8tent pas ?";
var RADAR_EMAIL_CORPS_DEFAUT = `Bonjour,

J'ai d\xE9couvert {Nom de la boutique} via l'une de vos publicit\xE9s.

Vous investissez d\xE9j\xE0 pour attirer du trafic.

Sur beaucoup de boutiques qui font de la pub, je retrouve les m\xEAmes frictions entre le clic et l'achat, surtout sur la page produit et la r\xE9assurance.

C'est pr\xE9cis\xE9ment le type de probl\xE9matique sur lequel je travaille avec des boutiques Shopify.

Est-ce que l'am\xE9lioration de votre taux de conversion est un sujet sur lequel vous travaillez actuellement ?

Bonne journ\xE9e,

Adam
Fondateur \u2014 AdamEcom
Consultant Shopify \xB7 Conversion & CRO
adam-ecom.com
info@adam-ecom.com`;
async function radarEnvoyerProspect(env, p, a, objet, texte, origine) {
  const jeton = crypto.randomUUID().replace(/-/g, "");
  try {
    await envoyerEmail(env, {
      de: env.SENDER_EMAIL,
      deNom: env.SENDER_NAME || "AdamEcom",
      a,
      objet,
      html: radarHtmlEmail(texte, { origine, jeton }),
      repondreA: { email: env.SENDER_EMAIL, name: env.SENDER_NAME || "AdamEcom" }
    });
  } catch (e) {
    await noterEnvoi(env, "radar", a, objet, "\xE9chec", e.message);
    throw e;
  }
  const maintenant = (/* @__PURE__ */ new Date()).toISOString();
  await noterEnvoi(env, "radar", a, objet, "envoy\xE9", null);
  await env.DB.prepare("UPDATE radar_prospects SET statut='contact\xE9', email_contact=COALESCE(email_contact, ?), suivi_jeton=?, email_envoye_le=?, email_ouvert_le=NULL, email_ouvertures=0, email_clique_le=NULL, email_clics=0, email_programme_le=NULL, email_erreur=NULL WHERE id=?").bind(a, jeton, maintenant, p.id).run();
  await env.DB.prepare(`INSERT INTO radar_historique
    (prospect_id, ancien_statut, nouveau_statut, motif, quand) VALUES (?, ?, ?, ?, ?)`).bind(p.id, p.statut || null, "contact\xE9", "email envoy\xE9 \xE0 " + a, maintenant).run();
}
async function radarContactsEnAttente(env) {
  try {
    const maintenant = (/* @__PURE__ */ new Date()).toISOString();
    const file = await env.DB.prepare(`SELECT id, domaine FROM radar_prospects
      WHERE presente_le IS NOT NULL AND (contacts_verifies_le IS NULL OR contacts_version < 2) AND domaine IS NOT NULL
        AND statut IN ('nouveau','\xE0 v\xE9rifier','\xE0 contacter')
        AND (contacts_prochain_essai IS NULL OR contacts_prochain_essai <= ?)
      ORDER BY presente_le DESC, score DESC LIMIT ?`).bind(maintenant, RADAR_CONTACTS_PAR_MINUTE).all().catch(() => null);
    for (const p of file?.results || []) await radarEnregistrerContacts(env.DB, p.id, p.domaine);
  } catch (e) {
    console.error("recherche contacts", e?.message || e);
  }
}
var RADAR_QUALITE_PAR_MINUTE = 2;
async function radarQualiteEnAttente(env) {
  try {
    const fini = await env.DB.prepare("SELECT valeur FROM radar_reglages WHERE cle='qualite_rattrapage'").first().catch(() => null);
    if (fini?.valeur === "1") return;
    const file = await env.DB.prepare(`SELECT id, statut, domaine, pubs_actives, presente_le FROM radar_prospects
      WHERE qualite_verifiee_le IS NULL AND domaine IS NOT NULL AND etape='analyse'
        AND (statut IN ('\xE0 v\xE9rifier','\xE0 contacter') OR statut='nouveau' AND (presente_le IS NOT NULL OR julianday('now')-julianday(cree_le)<=7))
      ORDER BY presente_le IS NULL, presente_le DESC, score DESC LIMIT ?`).bind(RADAR_QUALITE_PAR_MINUTE).all();
    const liste = file?.results || [];
    if (!liste.length) {
      await env.DB.prepare("INSERT INTO radar_reglages (cle, valeur, maj_le) VALUES ('qualite_rattrapage', '1', ?) ON CONFLICT(cle) DO UPDATE SET valeur='1', maj_le=excluded.maj_le").bind((/* @__PURE__ */ new Date()).toISOString()).run();
      return;
    }
    const pays = (await env.DB.prepare("SELECT valeur FROM radar_reglages WHERE cle='pays'").first().catch(() => null))?.valeur || "FR";
    for (const p of liste) {
      let html;
      try {
        html = (await radarChargerSite(p.domaine)).html;
      } catch (e) {
        await env.DB.prepare("UPDATE radar_prospects SET qualite_verifiee_le=? WHERE id=?").bind((/* @__PURE__ */ new Date()).toISOString(), p.id).run();
        continue;
      }
      await radarEnregistrerQualite(env.DB, p, radarEvaluerQualite(html, p.pubs_actives, radarNombreAvis(html), pays));
    }
  } catch (e) {
    console.error("v\xE9rification qualit\xE9", e?.message || e);
  }
}
var RADAR_ENVOIS_PAR_MINUTE = 5;
async function radarEnvoisProgrammes(env) {
  try {
    const file = await env.DB.prepare(`SELECT id, statut, marque, domaine, email_contact FROM radar_prospects
      WHERE email_programme_le IS NOT NULL ORDER BY email_programme_le, id LIMIT ?`).bind(RADAR_ENVOIS_PAR_MINUTE).all().catch(() => null);
    if (!file?.results?.length) return;
    const reg = await radarReglages(env.DB);
    const origine = reg?.brut?.app_origine || "https://app.adam-ecom.online";
    for (const p of file.results) {
      if (!p.email_contact || ["contact\xE9", "r\xE9pondu", "rdv", "client"].includes(p.statut)) {
        await env.DB.prepare("UPDATE radar_prospects SET email_programme_le=NULL WHERE id=?").bind(p.id).run();
        continue;
      }
      const modele = radarModeleEmail(p, reg);
      try {
        await radarEnvoyerProspect(env, p, p.email_contact, modele.objet, modele.corps, origine);
      } catch (e) {
        await env.DB.prepare("UPDATE radar_prospects SET email_programme_le=NULL, email_erreur=? WHERE id=?").bind(String(e?.message || e).slice(0, 300), p.id).run();
      }
    }
  } catch (e) {
    console.error("envois programm\xE9s", e?.message || e);
  }
}
async function smtpTestEnAttente(env) {
  try {
    const demande = await env.DB.prepare("SELECT valeur FROM radar_reglages WHERE cle='smtp_test'").first();
    if (!demande?.valeur) return;
    await env.DB.prepare("DELETE FROM radar_reglages WHERE cle='smtp_test'").run();
    const reg = await radarReglages(env.DB);
    const modele = radarModeleEmail({ marque: "Boutique Exemple" }, reg);
    let statut = "envoy\xE9", message = null;
    try {
      await envoyerEmail(env, { de: env.SENDER_EMAIL, deNom: env.SENDER_NAME || "AdamEcom", a: demande.valeur, objet: "[TEST] " + modele.objet, html: radarHtmlEmail(modele.corps), repondreA: { email: env.SENDER_EMAIL, name: env.SENDER_NAME || "AdamEcom" } });
    } catch (e) {
      statut = "\xE9chec";
      message = String(e?.message || e);
    }
    await noterEnvoi(env, "radar_test", demande.valeur, modele.objet, statut, message);
  } catch (e) {
    console.error("smtp test", e?.message || e);
  }
}
__name(smtpTestEnAttente, "smtpTestEnAttente");
__name2(smtpTestEnAttente, "smtpTestEnAttente");
// Test Amazon SES : radar_reglages cle='ses_test' = adresse. Envoie le dernier article du blog,
// résultat dans emails_envoyes (modèle « blog_newsletter_test »).
async function sesTestEnAttente(env) {
  if (!sesActif(env)) return;
  try {
    const demande = await env.DB.prepare("SELECT valeur FROM radar_reglages WHERE cle='ses_test'").first();
    if (!demande?.valeur) return;
    await env.DB.prepare("DELETE FROM radar_reglages WHERE cle='ses_test'").run();
    const dernier = await env.DB.prepare("SELECT titre, lien FROM newsletter_envois ORDER BY cree_le DESC LIMIT 1").first().catch(() => null);
    const article = { titre: dernier?.titre || "Test de la newsletter AdamEcom", lien: dernier?.lien || "https://adam-ecom.com", extrait: "Ceci est un email de test envoy\xE9 par Amazon SES depuis votre application.", image: null, date: null };
    const lien = await lienDesabo(env, demande.valeur);
    let statut = "envoy\xE9", message = null;
    try {
      message = "Amazon SES " + await envoyerSes(env, {
        de: env.SENDER_EMAIL,
        deNom: env.SENDER_NAME || "AdamEcom",
        a: demande.valeur,
        objet: "[TEST] " + article.titre,
        html: construireEmail(env, article).replace("{{ unsubscribe }}", echapper(lien)),
        entetes: [{ Name: "List-Unsubscribe", Value: `<${lien}>` }, { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" }]
      });
    } catch (e) {
      statut = "\xE9chec";
      message = String(e?.message || e);
    }
    await noterEnvoi(env, "blog_newsletter_test", demande.valeur, "[TEST] " + article.titre, statut, message);
  } catch (e) {
    console.error("ses test", e?.message || e);
  }
}
__name(sesTestEnAttente, "sesTestEnAttente");
function radarHtmlEmail(texte, suivi) {
  if (!suivi) return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${echapper(texte).replace(/\n/g, "<br>")}</div>`;
  const base = `${suivi.origine}/r/${suivi.jeton}`;
  const lien = /(https?:\/\/[^\s<>"]+|(?<![@\w.-])(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"]*)?)/gi;
  const corps = String(texte).split(lien).map((morceau, i) => {
    if (i % 2 === 0) return echapper(morceau);
    const [, texteLien, fin] = morceau.match(/^(.*?)([.,;:!?)]*)$/);
    const cible = /^https?:\/\//i.test(texteLien) ? texteLien : "https://" + texteLien;
    return `<a href="${base}/c?u=${encodeURIComponent(cible)}">${echapper(texteLien)}</a>${echapper(fin)}`;
  }).join("").replace(/\n/g, "<br>");
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${corps}</div><img src="${base}/o.gif" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">`;
}
var RADAR_PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));
async function radarSuiviEmail(env, url) {
  const m = url.pathname.match(/^\/r\/([a-f0-9]{32})\/(o\.gif|c)$/);
  if (!m) return null;
  const [, jeton, type] = m;
  const maintenant = (/* @__PURE__ */ new Date()).toISOString();
  const p = await env.DB.prepare("SELECT id, email_envoye_le FROM radar_prospects WHERE suivi_jeton = ?").bind(jeton).first().catch(() => null);
  const trop_tot = p?.email_envoye_le && Date.now() - Date.parse(p.email_envoye_le) < 2e4;
  if (p && !trop_tot) {
    if (type === "c") await env.DB.prepare("UPDATE radar_prospects SET email_clics=email_clics+1, email_clique_le=COALESCE(email_clique_le, ?), email_ouvert_le=COALESCE(email_ouvert_le, ?), email_ouvertures=MAX(email_ouvertures, 1) WHERE id=?").bind(maintenant, maintenant, p.id).run();
    else await env.DB.prepare("UPDATE radar_prospects SET email_ouvertures=email_ouvertures+1, email_ouvert_le=COALESCE(email_ouvert_le, ?) WHERE id=?").bind(maintenant, p.id).run();
  }
  if (type === "c") {
    const cible = url.searchParams.get("u") || "";
    if (!p || !/^https?:\/\//i.test(cible)) return new Response("Lien introuvable", { status: 404 });
    return Response.redirect(cible, 302);
  }
  return new Response(RADAR_PIXEL, { headers: { "content-type": "image/gif", "cache-control": "no-store, max-age=0" } });
}
function radarIlYa(iso) {
  if (!iso) return "";
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 6e4));
  if (min < 1) return "\xE0 l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return j === 1 ? "hier" : j < 30 ? `il y a ${j} jours` : dateFr2(iso, false);
}
var RADAR_CT_STATUTS = {
  "contact\xE9": { lib: "En attente de r\xE9ponse", ton: "neutre" },
  "r\xE9pondu": { lib: "A r\xE9pondu", ton: "bleu" },
  rdv: { lib: "Rendez-vous", ton: "jaune" },
  client: { lib: "Client", ton: "vert" }
};
var RADAR_JR_CSS = `<style>
.ct-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.ct-kpi div{background:var(--surface);border:1px solid var(--trait);border-radius:var(--r);padding:16px 18px}
.ct-kpi b{display:block;font-size:28px;font-weight:700;letter-spacing:-.04em;line-height:1.1}
.ct-kpi span{font-size:12.5px;color:var(--gris)}
.ct-kpi em{font-style:normal;font-size:13px;color:var(--doux);margin-left:6px;font-weight:500}
.jr-radar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin-top:12px;padding:10px 14px;border:1px solid var(--trait);border-radius:var(--r);background:var(--surface2);font-size:12.5px;color:var(--doux)}
.jr-point{width:8px;height:8px;border-radius:50%;background:var(--vert);flex-shrink:0}
.jr-point.rouge{background:var(--rouge)}
.jr-radar-actions{margin-left:auto;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.jr-radar-actions form{margin:0}
.jr-recherche{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin-top:12px;font-size:13px;color:var(--doux)}
.jr-recherche form{margin:0}
.jr-ia{margin:6px 0 2px;font-size:13px}
.jr-ia ul{margin:6px 0 4px;padding-left:18px}
.jr-ia li{margin:2px 0}
.jr-recherche button{font:inherit;font-size:14px;font-weight:600;padding:10px 18px;border-radius:9px;border:0;background:var(--encre);color:var(--surface);cursor:pointer}
.jr-recherche button:disabled{opacity:.6;cursor:default}
.jr-recherche button.discret{background:transparent;color:var(--doux);border:1px solid var(--trait-fort);font-weight:500;padding:8px 14px}
.jr-radar-actions a,.jr-radar-actions button{font:inherit;font-size:12.5px;padding:5px 11px;border-radius:7px;border:1px solid var(--trait-fort);background:var(--surface);color:var(--encre);text-decoration:none;cursor:pointer;white-space:nowrap}
.jr-radar-actions a:hover,.jr-radar-actions button:hover{background:var(--surface3)}
.jr-intro{margin:-4px 0 14px;font-size:13.5px;color:var(--gris)}
.jr-groupe{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;margin:0 0 12px;padding:12px 16px;background:var(--jaune-p);border:1px solid var(--trait);border-radius:var(--r);position:sticky;top:8px;z-index:5}
.jr-tout{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;cursor:pointer}
.jr-info{font-size:13px;color:var(--doux)}
.jr-groupe .envoyer{margin-left:auto}
.jr-liste{background:var(--surface);border:1px solid var(--trait);border-radius:var(--r);overflow:hidden}
.jr-ligne{display:grid;grid-template-columns:28px 64px minmax(0,1fr);gap:16px;padding:18px 20px;border-bottom:1px solid var(--trait);align-items:start}
.jr-ligne:last-child{border-bottom:0}
.jr-ligne:hover{background:var(--surface2)}
.jr-ligne:has(.coche-groupe:checked){background:var(--jaune-p)}
.jr-coche{padding-top:18px}
.jr-coche input,.jr-tout input{width:18px;height:18px;accent-color:var(--encre);cursor:pointer;margin:0}
.jr-score{width:64px;height:64px;border-radius:14px;background:var(--surface3);display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}
.jr-score b{font-size:22px;font-weight:700;letter-spacing:-.04em}
.jr-score span{font-size:10.5px;color:var(--gris);margin-top:3px}
.jr-score.fort{background:var(--vertf);color:var(--vert)}
.jr-score.moyen{background:var(--jaune-p);color:var(--jaune-f)}
.jr-corps{min-width:0;display:flex;flex-direction:column;gap:8px}
.jr-tete{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px}
.jr-nom{font-size:17px;font-weight:650;letter-spacing:-.015em;text-decoration:none}
.jr-nom:hover{text-decoration:underline;text-underline-offset:3px}
.jr-dom{font-size:13px;color:var(--gris);text-decoration:none}
.jr-dom:hover{color:var(--encre)}
.jr-tags{display:flex;flex-wrap:wrap;gap:6px}
.jr-tag{font-size:12px;padding:3px 9px;border-radius:999px;background:var(--surface3);color:var(--doux);white-space:nowrap}
.jr-tag.vert{background:var(--vertf);color:var(--vert);font-weight:600}
.jr-tag.jaune{background:var(--jaune-p);color:var(--jaune-f)}
.jr-tag.rouge{background:var(--rougef);color:var(--rouge)}
.jr-contacts{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:13.5px}
.jr-c{color:var(--gris);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.jr-c.ok{color:var(--encre);font-weight:500;text-decoration:none}
.jr-c.ok:hover{text-decoration:underline;text-underline-offset:3px}
.jr-etat{font-size:13px;color:var(--jaune-f);font-weight:500}
.jr-etat.rouge{color:var(--rouge)}
.jr-outils{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:2px}
.jr-outils details[open]{flex-basis:100%;order:10}
.jr-outils summary::before,.jr-outils summary::after{display:none!important}
.jr-outils details summary{display:inline-flex}
.jr-outils summary{list-style:none;cursor:pointer;font-size:13px;font-weight:500;padding:6px 12px;border-radius:8px;border:1px solid var(--trait-fort);background:var(--surface);user-select:none}
.jr-outils summary::-webkit-details-marker{display:none}
.jr-outils summary:hover,.jr-btn:hover{background:var(--surface3)}
.jr-btn{font-size:13px;font-weight:500;padding:6px 12px;border-radius:8px;border:1px solid var(--trait-fort);background:var(--surface);color:var(--encre);text-decoration:none;white-space:nowrap}
.jr-outils details[open] summary{background:var(--encre);color:var(--fond);border-color:var(--encre)}
.jr-outils details.ecarter summary{color:var(--rouge)}
.jr-outils details.ecarter[open] summary{background:var(--rouge);border-color:var(--rouge);color:#fff}
.jr-outils details form{max-width:none;width:100%;margin:10px 0 0;padding:16px;border:1px solid var(--trait);border-radius:var(--r);background:var(--surface2)}
.jr-lien{margin-left:auto;font-size:13px;color:var(--gris);text-decoration:none}
.jr-lien:hover{color:var(--encre)}
.jr-ligne .meta{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:12px;color:var(--gris)}
@media(max-width:700px){.ct-kpi{grid-template-columns:1fr 1fr}.jr-ligne{grid-template-columns:22px 52px minmax(0,1fr);gap:12px;padding:16px 14px}.jr-score{width:52px;height:52px}.jr-score b{font-size:18px}.jr-radar-actions{margin-left:0}.jr-groupe .envoyer{margin-left:0;width:100%}}
</style>`;
function radarVueContactes(liste, cle) {
  const n = liste.length;
  const envoyes = liste.filter((p) => p.email_envoye_le);
  const ouverts = envoyes.filter((p) => p.email_ouvertures > 0).length;
  const cliques = envoyes.filter((p) => p.email_clics > 0).length;
  const reponses = liste.filter((p) => p.statut !== "contact\xE9").length;
  const pct = (a, b) => b ? Math.round(a / b * 100) + " %" : "\u2014";
  const etape = (fait, lib, detail) => `<span class="ct-etape${fait ? " fait" : ""}"><i></i>${lib}${detail ? `<small>${detail}</small>` : ""}</span>`;
  const ligne = (p) => {
    const nom = p.marque || p.domaine || p.page_id || "Boutique";
    const st = RADAR_CT_STATUTS[p.statut] || { lib: p.statut, ton: "neutre" };
    const filtres = [p.email_ouvertures > 0 ? "ouvert" : "non-ouvert", p.email_clics > 0 ? "clique" : "", p.statut !== "contact\xE9" ? "reponse" : ""].join(" ");
    const action = (statut, lib) => p.statut === statut ? "" : `<form method="POST" action="?cle=${cle}&page=radar&prospect=${p.id}&action=radar_statut&statut=${encodeURIComponent(statut)}&onglet=contactes"><button type="submit">${lib}</button></form>`;
    return `<article class="ct-ligne" data-f="${filtres}" data-q="${echapper((nom + " " + (p.domaine || "") + " " + (p.email_contact || "")).toLowerCase())}">
      <div class="ct-id">
        <input type="checkbox" class="ct-coche" name="ids" value="${p.id}" form="ct-suppr" aria-label="S\xE9lectionner ${echapper(nom)}">
        <span class="ct-av">${echapper(nom.trim().charAt(0).toUpperCase() || "?")}</span>
        <div class="ct-nom">
          <a href="?cle=${cle}&page=radar&prospect=${p.id}"><b>${echapper(nom)}</b></a>
          <span>${p.domaine ? `<a href="https://${echapper(p.domaine)}" target="_blank" rel="noopener">${echapper(p.domaine)}</a>` : ""}${p.email_contact ? ` \xB7 <a href="mailto:${echapper(p.email_contact)}">${echapper(p.email_contact)}</a>` : ""}</span>
        </div>
      </div>
      <div class="ct-suivi">${p.email_envoye_le ? etape(true, "Envoy\xE9", radarIlYa(p.email_envoye_le)) + etape(p.email_ouvertures > 0, "Ouvert", p.email_ouvertures > 0 ? `${p.email_ouvertures}\xD7 \xB7 ${radarIlYa(p.email_ouvert_le)}` : "") + etape(p.email_clics > 0, "Cliqu\xE9", p.email_clics > 0 ? `${p.email_clics}\xD7` : "") : `<span class="ct-vide">Contact\xE9 ${radarIlYa(p.change_le) || ""} \xB7 sans suivi d'email</span>`}</div>
      <div class="ct-statut"><span class="ct-pill ${st.ton}">${echapper(st.lib)}</span></div>
      <div class="ct-actions">${action("r\xE9pondu", "A r\xE9pondu")}${action("rdv", "RDV")}${action("client", "Client")}
        <form method="POST" action="?cle=${cle}&page=radar&action=radar_supprimer" onsubmit="return confirm('Supprimer cette boutique de la liste ?')"><input type="hidden" name="ids" value="${p.id}"><button type="submit" class="ct-suppr">Supprimer</button></form></div>
    </article>`;
  };
  return `<style>
.ct-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.ct-kpi div{background:var(--surface);border:1px solid var(--trait);border-radius:var(--r);padding:16px 18px}
.ct-kpi b{display:block;font-size:28px;font-weight:700;letter-spacing:-.04em;line-height:1.1}
.ct-kpi span{font-size:12.5px;color:var(--gris)}
.ct-kpi em{font-style:normal;font-size:13px;color:var(--doux);margin-left:6px;font-weight:500}
.ct-barre{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:22px 0 12px}
.ct-filtres{display:flex;flex-wrap:wrap;gap:6px}
.ct-filtres button{font:inherit;font-size:13px;padding:6px 13px;border-radius:999px;border:1px solid var(--trait-fort);background:var(--surface);color:var(--doux);cursor:pointer}
.ct-filtres button.on{background:var(--encre);color:var(--fond);border-color:var(--encre)}
.ct-chercher{margin-left:auto;font:inherit;font-size:13.5px;padding:7px 12px;border-radius:8px;border:1px solid var(--trait-fort);background:var(--surface);color:var(--encre);min-width:220px}
.ct-liste{background:var(--surface);border:1px solid var(--trait);border-radius:var(--r);overflow:hidden}
.ct-ligne{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1.5fr) 180px 220px;gap:18px;align-items:center;padding:16px 20px;border-bottom:1px solid var(--trait)}
.ct-ligne:last-child{border-bottom:0}
.ct-ligne[hidden],.ct-rien[hidden]{display:none}
.ct-ligne:hover{background:var(--surface2)}
.ct-id{display:flex;gap:12px;align-items:center;min-width:0}
.ct-av{width:38px;height:38px;border-radius:10px;background:var(--surface3);color:var(--doux);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0}
.ct-nom{min-width:0;display:flex;flex-direction:column;gap:2px}
.ct-nom b{font-size:15px;font-weight:600;letter-spacing:-.01em}
.ct-nom a{text-decoration:none}
.ct-nom a:hover{text-decoration:underline;text-underline-offset:3px}
.ct-nom span{font-size:12.5px;color:var(--gris);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ct-suivi{display:flex;align-items:flex-start;gap:0}
.ct-etape{flex:1;display:flex;flex-direction:column;gap:3px;font-size:12.5px;font-weight:500;color:var(--gris);position:relative;padding-top:16px}
.ct-etape i{position:absolute;top:0;left:0;width:10px;height:10px;border-radius:50%;border:2px solid var(--trait-fort);background:var(--surface)}
.ct-etape::before{content:"";position:absolute;top:5px;left:12px;right:4px;height:2px;background:var(--trait)}
.ct-etape:last-child::before{display:none}
.ct-etape.fait{color:var(--encre)}
.ct-etape.fait i{background:var(--vert);border-color:var(--vert)}
.ct-etape.fait::before{background:var(--vert);opacity:.35}
.ct-etape small{font-size:11.5px;font-weight:400;color:var(--gris)}
.ct-vide{font-size:12.5px;color:var(--gris)}
.ct-pill{display:inline-block;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;background:var(--surface3);color:var(--doux);white-space:nowrap}
.ct-pill.bleu{background:#E6EEF8;color:#1F4E8C}
.ct-pill.jaune{background:var(--jaune-p);color:var(--jaune-f)}
.ct-pill.vert{background:var(--vertf);color:var(--vert)}
@media(prefers-color-scheme:dark){.ct-pill.bleu{background:#16202E;color:#9DBBE6}}
.ct-actions{display:flex;gap:6px;justify-content:flex-end}
.ct-actions form{margin:0}
.ct-actions button{font:inherit;font-size:12px;padding:5px 10px;border-radius:7px;border:1px solid var(--trait-fort);background:var(--surface);color:var(--doux);cursor:pointer;white-space:nowrap}
.ct-actions button:hover{background:var(--surface2);color:var(--encre)}
.ct-rien{padding:36px 20px;text-align:center;color:var(--gris);font-size:14px}
.ct-coche{width:16px;height:16px;flex-shrink:0;cursor:pointer}
.ct-actions button.ct-suppr,.ct-groupe .ct-suppr{color:var(--rouge);border-color:var(--rouge)}
.ct-groupe{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 12px;padding:10px 14px;border:1px solid var(--trait-fort);border-radius:var(--r);background:var(--surface2);font-size:13px}
.ct-groupe[hidden]{display:none}
.ct-groupe button{font:inherit;font-size:12.5px;padding:6px 12px;border-radius:7px;border:1px solid var(--trait-fort);background:var(--surface);color:var(--doux);cursor:pointer}
@media(max-width:1100px){.ct-ligne{grid-template-columns:1fr 1fr}.ct-actions{justify-content:flex-start}}
@media(max-width:700px){.ct-kpi{grid-template-columns:1fr 1fr}.ct-ligne{grid-template-columns:1fr}.ct-chercher{margin-left:0;width:100%}}
</style>
<section>
  <h2>Boutiques contact\xE9es</h2>
  <div class="ct-kpi">
    <div><b>${n}</b><span>boutiques contact\xE9es</span></div>
    <div><b>${ouverts}<em>${pct(ouverts, envoyes.length)}</em></b><span>emails ouverts</span></div>
    <div><b>${cliques}<em>${pct(cliques, envoyes.length)}</em></b><span>ont cliqu\xE9</span></div>
    <div><b>${reponses}<em>${pct(reponses, n)}</em></b><span>r\xE9ponses, RDV ou clients</span></div>
  </div>
  <div class="ct-barre">
    <div class="ct-filtres" id="ct-filtres">
      <button type="button" class="on" data-f="">Toutes (${n})</button>
      <button type="button" data-f="ouvert">Ouvert</button>
      <button type="button" data-f="non-ouvert">Pas encore ouvert</button>
      <button type="button" data-f="clique">A cliqu\xE9</button>
      <button type="button" data-f="reponse">R\xE9ponse / RDV / client</button>
    </div>
    <input class="ct-chercher" id="ct-chercher" type="search" placeholder="Rechercher une boutique…">
  </div>
  <form id="ct-suppr" class="ct-groupe" method="POST" action="?cle=${cle}&page=radar&action=radar_supprimer" hidden
    onsubmit="return confirm('Supprimer les boutiques s\xE9lectionn\xE9es de la liste ?')">
    <span id="ct-nb"></span><button type="submit" class="ct-suppr">Supprimer la s\xE9lection</button>
    <button type="button" id="ct-aucun">Tout d\xE9cocher</button>
  </form>
  <div class="ct-liste" id="ct-liste">
    ${n ? liste.map(ligne).join("") : ""}
    <div class="ct-rien" id="ct-rien"${n ? ' hidden' : ""}>${n ? "Aucune boutique ne correspond." : "Aucune boutique contact\xE9e pour le moment."}</div>
  </div>
</section>
<script>
(function(){var f="",q="",bs=document.querySelectorAll("#ct-filtres button"),ls=document.querySelectorAll(".ct-ligne"),r=document.getElementById("ct-rien");
function maj(){var k=0;ls.forEach(function(l){var ok=(!f||(" "+l.dataset.f+" ").indexOf(" "+f+" ")>-1)&&(!q||l.dataset.q.indexOf(q)>-1);l.hidden=!ok;if(ok)k++});if(r&&ls.length)r.hidden=k>0}
bs.forEach(function(b){b.onclick=function(){bs.forEach(function(x){x.classList.remove("on")});b.classList.add("on");f=b.dataset.f;maj()}});
document.getElementById("ct-chercher").oninput=function(e){q=e.target.value.trim().toLowerCase();maj()};
var g=document.getElementById("ct-suppr"),cs=document.querySelectorAll(".ct-coche");function sel(){var n=0;cs.forEach(function(c){if(c.checked)n++});g.hidden=!n;document.getElementById("ct-nb").textContent=n+" boutique(s) s\xE9lectionn\xE9e(s)"}
cs.forEach(function(c){c.onchange=sel});document.getElementById("ct-aucun").onclick=function(){cs.forEach(function(c){c.checked=false});sel()};})();
</script>`;
}
function radarSuiviBadges(p) {
  if (!p.email_envoye_le) return "";
  return `<span>\u{1F4E8} envoy\xE9 le ${dateFr2(p.email_envoye_le, false)}</span>` + (p.email_ouvertures ? `<span class="prio encours">\u{1F440} ouvert ${p.email_ouvertures} fois (le ${dateFr2(p.email_ouvert_le, false)})</span>` : `<span class="sec">pas encore ouvert</span>`) + (p.email_clics ? `<span class="prio haute">\u{1F517} cliqu\xE9 ${p.email_clics} fois</span>` : "");
}
__name(radarHtmlEmail, "radarHtmlEmail");
__name2(radarHtmlEmail, "radarHtmlEmail");
function radarModeleEmail(p, reg) {
  const nom = p.marque || p.domaine || "votre boutique";
  const remplir = /* @__PURE__ */ __name2((t) => String(t).replace(/\{\s*nom de la boutique\s*\}/gi, nom), "remplir");
  return {
    objet: remplir(reg?.brut?.email_objet || RADAR_EMAIL_OBJET_DEFAUT),
    corps: remplir((reg?.brut?.email_corps || RADAR_EMAIL_CORPS_DEFAUT).replace(/\r\n/g, "\n"))
  };
}
__name(radarModeleEmail, "radarModeleEmail");
__name2(radarModeleEmail, "radarModeleEmail");
async function pageRadar(env, url, message) {
  const cle = encodeURIComponent(env.CLE_TEST);
  await assurerRadarSchema(env.DB);
  const reg = await radarReglages(env.DB);
  const vue = url.searchParams.get("vue") || "jour";
  const id = url.searchParams.get("prospect");
  const [motscles, compteurs, prospects, executionsRadar] = await Promise.all([
    tous2(env.DB, "SELECT * FROM radar_motscles ORDER BY niche, mot"),
    tous2(env.DB, "SELECT statut, COUNT(*) AS n FROM radar_prospects GROUP BY statut"),
    tous2(
      env.DB,
      `SELECT * FROM radar_prospects
       WHERE statut NOT IN ('contact\xE9','r\xE9pondu','rdv','client','non pertinent','d\xE9j\xE0 optimis\xE9','supprim\xE9')
         AND etape='analyse' AND presente_le=?
         AND (?=0 OR shopify_statut='oui')
       ORDER BY score DESC, id DESC LIMIT 50`,
      (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
      reg.shopifyObligatoire ? 1 : 0
    ),
    tous2(env.DB, "SELECT quand,statut,message,duree_ms FROM executions WHERE domaine='radar' ORDER BY quand DESC LIMIT 1")
  ]);
  const executionRadar = executionsRadar[0] || null;
  const recherche = radarEtatRecherche(reg);
  const rechercheEnCours = !!(recherche && !recherche.fin);
  const modeAuto = reg.brut.mode_collecte === "auto";
  const par = {};
  for (const c of compteurs) par[c.statut] = c.n;
  const totalProspects = compteurs.reduce((t, c) => t + c.n, 0);
  const sansJeton = !env.META_TOKEN;
  const sourceDisponible = true;
  const installation = `
    <div class="reussite"><b>Prospect Radar est actif avec la recherche web.</b>
      Il recherche des boutiques publiques, v\xE9rifie directement qu'elles utilisent Shopify, puis mesure leurs signaux CRO et leur performance.
      ${env.GEMINI_API_KEY ? "Gemini est essay\xE9 en priorit\xE9 et la recherche web prend automatiquement le relais si son quota est atteint." : "La recherche web fonctionne sans connexion suppl\xE9mentaire."}
      Meta reste facultatif : lorsqu'il sera disponible, il enrichira le score avec les publicit\xE9s actives.</div>`;
  if (id) {
    const p = await env.DB.prepare("SELECT * FROM radar_prospects WHERE id = ?").bind(Number(id)).first();
    if (!p) return `<div class="alerte">Prospect introuvable.</div>`;
    const pubs = await tous2(env.DB, "SELECT * FROM radar_pubs WHERE page_id = ? ORDER BY debut DESC LIMIT 12", p.page_id);
    const technos = await tous2(env.DB, "SELECT * FROM radar_technos WHERE prospect_id = ?", p.id);
    let detail2 = {};
    try {
      detail2 = JSON.parse(p.score_detail || "{}");
    } catch {
    }
    let cro = {};
    try {
      cro = JSON.parse(p.cro_signaux || "{}");
    } catch {
    }
    const prio = radarPriorite(p.score || 0);
    const estWeb = radarEstSourceWeb(p.source);
    const jPub = radarJoursDepuis(p.premiere_pub_vue);
    const jDom = radarJoursDepuis(p.domaine_cree_le);
    const bouton = /* @__PURE__ */ __name2((statut, libelle, style) => `<form method="POST" style="display:inline"
      action="?cle=${cle}&page=radar&prospect=${p.id}&action=radar_statut&statut=${encodeURIComponent(statut)}">
      <button class="envoyer${style ? "" : " discret"}" type="submit">${libelle}</button></form>`, "bouton");
    return `${message || ""}
      <section><div class="actions">
        <a class="bouton pale" href="?cle=${cle}&page=radar">\u2190 Prospects du jour</a>
        ${p.domaine ? `<a class="bouton pale" href="https://${echapper(p.domaine)}" target="_blank" rel="noopener">\u{1F310} Visiter la boutique</a>` : ""}
        ${estWeb ? "" : `<a class="bouton pale" target="_blank" rel="noopener"
           href="https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${echapper(reg.pays)}&view_all_page_id=${echapper(p.page_id)}">\u{1F4E2} Voir les publicit\xE9s</a>
        `}
      </div></section>

      <section><h2>Prospect</h2>
        <div class="titre-campagne">${prio.icone} ${echapper(p.marque || p.domaine || p.page_id)}</div>
        <div class="sec" style="margin:-2px 0 4px">${echapper(p.domaine || "domaine non r\xE9solu")}
          ${p.domaine_confiance ? ` \xB7 confiance ${p.domaine_confiance}% (${echapper(p.domaine_methode || "")})` : ""}</div>
        <div class="grille">
          ${carteHtml("Score", String(p.score ?? "\u2014") + "/100", prio.nom, prio.classe)}
          ${carteHtml(
      "Shopify",
      p.shopify_statut || "\u2014",
      p.shopify_confiance ? `confiance ${p.shopify_confiance}%` : "",
      p.shopify_statut === "oui" ? "bon" : "neutre"
    )}
          ${estWeb ? carteHtml(
      "March\xE9 FR",
      p.marche_statut || "\u2014",
      p.marche_confiance ? `confiance ${p.marche_confiance}%` : "non confirm\xE9",
      p.marche_statut === "oui" ? "bon" : "neutre"
    ) : ""}
          ${estWeb ? carteHtml("Origine", radarLibelleSource(p.source), "boutique publique v\xE9rifi\xE9e", "bon") : carteHtml(
      "Publicit\xE9s actives",
      String(p.pubs_actives ?? "\u2014"),
      jPub !== null ? `premi\xE8re d\xE9tect\xE9e il y a ${jPub} j` : ""
    )}
          ${carteHtml(
      "PageSpeed mobile",
      p.pagespeed_score ?? "\u2014",
      p.lcp ? `LCP ${p.lcp} s` : "non mesur\xE9",
      p.pagespeed_score === null ? "neutre" : p.pagespeed_score < 40 ? "mauvais" : p.pagespeed_score < 70 ? "moyen" : "bon"
    )}
        </div>
      </section>

      ${radarIaBloc(p, true)}
      <section><h2>D\xE9tail du score</h2><div class="tw"><table>
        <thead><tr><th>Famille</th><th class="num">Points</th></tr></thead>
        <tbody>${Object.entries(detail2).map(([k, v]) => `<tr><td>${echapper(k)}</td><td class="num"><b>${v}</b></td></tr>`).join("") || `<tr><td colspan="2"><span class="sec">Pas encore calcul\xE9.</span></td></tr>`}</tbody>
      </table></div></section>

      <section><h2>Identit\xE9</h2><div class="tw"><table><tbody>
        <tr><td>Source</td><td><b>${echapper(radarLibelleSource(p.source))}</b> <span class="sec">${echapper(p.page_id)}</span></td></tr>
        <tr><td>Domaine cr\xE9\xE9</td><td>${p.domaine_cree_le ? `${dateFr2(p.domaine_cree_le, false)} <span class="sec">\xB7 anciennet\xE9 ${jDom} jours</span>` : '<span class="sec">non d\xE9termin\xE9</span>'}</td></tr>
        <tr><td>Cat\xE9gorie</td><td>${estWeb ? "\u{1F50E} Boutique d\xE9couverte sur le web" : p.categorie === "A" ? "\u{1F525} Nouvelle acquisition \u2014 marque install\xE9e qui investit" : p.categorie === "B" ? "\u{1F195} Nouvelle boutique" : '<span class="sec">ind\xE9termin\xE9e</span>'}</td></tr>
        <tr><td>Niche</td><td>${echapper(p.niche || "\u2014")}</td></tr>
        <tr><td>Pertinence niche</td><td>${p.pertinence_niche ?? "\u2014"}/100</td></tr>
        <tr><td>March\xE9 vis\xE9</td><td>${p.marche_statut === "oui" ? "France confirm\xE9e" : p.marche_statut === "incertain" ? "France possible" : "France non confirm\xE9e"}${p.marche_confiance ? ` <span class="sec">\xB7 confiance ${p.marche_confiance}%</span>` : ""}</td></tr>
        <tr><td>Port\xE9e UE cumul\xE9e</td><td>${p.portee_ue ? p.portee_ue.toLocaleString("fr-FR") : '<span class="sec">non disponible</span>'}</td></tr>
      </tbody></table></div></section>

      <section><h2>Technologies</h2><div class="tw"><table>
        <thead><tr><th>Outil</th><th>\xC9tat</th></tr></thead>
        <tbody>${technos.length ? technos.map((t) => `<tr><td>${echapper(t.techno)}</td>
          <td>${t.detecte ? pastille("d\xE9tect\xE9") : `<span class="sec">non d\xE9tect\xE9</span>`}</td></tr>`).join("") : `<tr><td colspan="2"><span class="sec">Boutique pas encore analys\xE9e.</span></td></tr>`}</tbody>
      </table></div>
      <div class="note">Une absence de d\xE9tection ne prouve pas l'absence de l'outil : ce qui est
        charg\xE9 c\xF4t\xE9 navigateur \xE9chappe \xE0 cette lecture.</div></section>

      ${Object.keys(cro).length ? `<section><h2>Signaux CRO d\xE9tect\xE9s</h2><div class="tw"><table>
        <thead><tr><th>\xC9l\xE9ment</th><th>D\xE9tect\xE9</th></tr></thead><tbody>
        ${Object.entries(cro).map(([k, v]) => `<tr><td>${echapper(k.replace(/_/g, " "))}</td>
          <td>${v ? pastille("oui") : `<span class="sec">non d\xE9tect\xE9</span>`}</td></tr>`).join("")}
        </tbody></table></div></section>` : ""}

      ${pubs.length ? `<section><h2>Publicit\xE9s collect\xE9es</h2>${tableauHtml(
      [{ nom: "Titre" }, { nom: "Premi\xE8re diffusion vue", classe: "nowrap" }, { nom: "" }],
      pubs.map((a) => `<tr>
          <td>${echapper(a.titre || a.texte || "\u2014").slice(0, 120)}</td>
          <td class="nowrap">${a.debut ? dateFr2(a.debut, false) : "\u2014"}</td>
          <td class="nowrap">${a.snapshot_url ? `<a class="bouton pale" href="${echapper(a.snapshot_url)}" target="_blank" rel="noopener">Voir</a>` : ""}</td>
        </tr>`),
      "Aucune publicit\xE9 enregistr\xE9e."
    )}</section>` : ""}

      <section><h2>D\xE9cision</h2>
        <div class="actions">
          ${bouton("\xE0 contacter", "\u2705 \xC0 contacter", true)}
          ${bouton("\xE0 v\xE9rifier", "\u{1F50E} \xC0 v\xE9rifier")}
          ${bouton("contact\xE9", "Marquer contact\xE9")}
          ${bouton("rdv", "Rendez-vous obtenu")}
          ${bouton("client", "Devenu client")}
        </div>
        <details style="margin-top:14px"><summary>\xC9carter ce prospect</summary>
          <div class="dedans">
            <form class="f" method="POST" style="border:0;padding:0;background:none"
              action="?cle=${cle}&page=radar&prospect=${p.id}&action=radar_statut&statut=${encodeURIComponent("non pertinent")}">
              <label class="large">Motif <span style="font-weight:400">(sert \xE0 affiner le scoring plus tard)</span>
                <select name="motif">${RADAR_MOTIFS.map((m) => `<option>${m}</option>`).join("")}</select></label>
              <button class="envoyer large" type="submit" style="background:var(--rouge);color:#fff">
                \u274C \xC9carter d\xE9finitivement</button>
            </form>
            <p class="sec" style="margin:0">Un prospect \xE9cart\xE9 ne r\xE9appara\xEEtra jamais dans le Top 10.</p>
          </div></details>
        ${p.statut !== "nouveau" ? `<div class="reussite" style="margin-top:14px">Statut actuel : <b>${echapper(p.statut)}</b>${p.motif_rejet ? ` \u2014 ${echapper(p.motif_rejet)}` : ""}</div>` : ""}
      </section>`;
  }
  if (vue === "reglages") {
    const parNiche = {};
    for (const m of motscles) (parNiche[m.niche] = parNiche[m.niche] || []).push(m);
    return `${message || ""}
      <section><div class="actions">
        <a class="bouton pale" href="?cle=${cle}&page=radar">\u2190 Prospects du jour</a></div></section>

      <section><h2>Mots-cl\xE9s surveill\xE9s</h2>
        <p class="sec" style="margin:-4px 0 0">Le radar ne trouve que ce que ces mots-cl\xE9s font remonter.
          C'est le r\xE9glage qui compte le plus.</p>
        <form class="f rapide" method="POST" action="?cle=${cle}&page=radar&action=radar_motcle_ajout">
          <label class="large">Nouveau mot-cl\xE9<input name="mot" required placeholder="huile visage"></label>
          <label>Niche<input name="niche" required list="niches" placeholder="Beaut\xE9">
            <datalist id="niches">${Object.keys(parNiche).map((n) => `<option value="${echapper(n)}">`).join("")}</datalist></label>
          <label>Priorit\xE9<select name="priorite">
            <option value="normale">normale</option><option value="haute">haute</option></select></label>
          <button class="envoyer" type="submit">Ajouter</button>
        </form>
        ${Object.entries(parNiche).map(([niche, mots]) => `
          <div style="margin-top:16px"><h2>${echapper(niche)} <span class="sec" style="letter-spacing:0">${mots.length}</span></h2>
          ${tableauHtml(
      [{ nom: "Mot-cl\xE9" }, { nom: "Priorit\xE9" }, { nom: "\xC9tat" }, { nom: "" }],
      mots.map((m) => `<tr>
              <td><b>${echapper(m.mot)}</b></td>
              <td>${echapper(m.priorite)}</td>
              <td>${m.actif ? pastille("actif") : `<span class="sec">d\xE9sactiv\xE9</span>`}</td>
              <td class="nowrap">
                <form method="POST" style="display:inline" action="?cle=${cle}&page=radar&action=radar_motcle_bascule&mot=${m.id}">
                  <button class="bouton pale" type="submit">${m.actif ? "D\xE9sactiver" : "Activer"}</button></form>
                <form method="POST" style="display:inline" action="?cle=${cle}&page=radar&action=radar_motcle_suppr&mot=${m.id}">
                  <button class="bouton pale" type="submit" onclick="return confirm('Supprimer ce mot-cl\xE9 ?')">Supprimer</button></form>
              </td></tr>`),
      "Aucun mot-cl\xE9."
    )}</div>`).join("")}
      </section>

      <section id="modele-email"><h2>Mod\xE8le d'email de prospection</h2>
        <p class="sec" style="margin:-4px 0 0">Pr\xE9-rempli sur chaque prospect. <b>{Nom de la boutique}</b> est remplac\xE9 automatiquement par le nom de la boutique. Vous pouvez encore ajuster chaque email avant l'envoi.</p>
        <form class="f" method="POST" action="?cle=${cle}&page=radar&action=radar_reglages">
          <label class="large">Objet<input name="email_objet" required value="${echapper(reg.brut.email_objet || RADAR_EMAIL_OBJET_DEFAUT)}"></label>
          <label class="large">Message<textarea name="email_corps" rows="18" required>${echapper(reg.brut.email_corps || RADAR_EMAIL_CORPS_DEFAUT)}</textarea></label>
          <button class="envoyer large" type="submit">Enregistrer le mod\xE8le</button>
        </form>
        <form class="f rapide" method="POST" action="?cle=${cle}&page=radar&action=radar_email_test">
          <label class="large">Envoyer un test \xE0<input name="a" type="email" required value="${echapper(env.NOTIF_EMAIL || env.SENDER_EMAIL || "")}"></label>
          <label>Nom de boutique d'exemple<input name="boutique" value="Boutique Exemple"></label>
          <button class="envoyer" type="submit">Envoyer un test</button>
        </form>
        <p class="sec" style="margin:0">Le test utilise le mod\xE8le enregistr\xE9 et ne touche \xE0 aucun prospect.
          Envoi actuel : <b>${env.RESEND_API_KEY ? `Resend (${echapper(env.SENDER_EMAIL || "")})` : env.SMTP_PASSWORD ? `Hostinger (${echapper(env.SMTP_USER || env.SENDER_EMAIL || "")})` : "Brevo \u2014 ajoutez le secret SMTP_PASSWORD pour passer par Hostinger"}</b>.</p>
      </section>

      <section><h2>R\xE9glages du radar</h2>
        <form class="f" method="POST" action="?cle=${cle}&page=radar&action=radar_reglages">
          <label>Pays<input name="pays" value="${echapper(reg.pays)}"></label>
          <label>Recherche des prospects<select name="mode_collecte">
            <option value="manuel"${reg.brut.mode_collecte === "auto" ? "" : " selected"}>manuelle (quand je clique)</option>
            <option value="auto"${reg.brut.mode_collecte === "auto" ? " selected" : ""}>automatique (toutes les 15 minutes)</option></select></label>
          <label>Prospects par jour<input name="prospects_par_jour" type="number" min="1" max="50" value="${reg.parJour}"></label>
          <label>Score minimum<input name="score_minimum" type="number" min="0" max="100" value="${reg.scoreMin}"></label>
          <label>Publicit\xE9s actives minimum<input name="pubs_actives_min" type="number" min="1" value="${reg.pubsMin}"></label>
          <label>Pubs actives depuis au moins (jours)<input name="pub_anciennete_min_jours" type="number" min="0" value="${reg.pubAncienneteMin}"></label>
          <label>Shopify obligatoire<select name="shopify_obligatoire">
            <option value="1"${reg.shopifyObligatoire ? " selected" : ""}>oui</option>
            <option value="0"${reg.shopifyObligatoire ? "" : " selected"}>non</option></select></label>
          <button class="envoyer large" type="submit">Enregistrer</button>
        </form>
      </section>

      <section><h2>Coefficients du score</h2>
        <p class="sec" style="margin:-4px 0 0">Modifiables sans d\xE9veloppeur. Un mauvais PageSpeed
          augmente le potentiel d'intervention : c'est volontaire.</p>
        <form class="f" method="POST" action="?cle=${cle}&page=radar&action=radar_reglages">
          ${[
      ["pts_pub_moins30", "Pubs actives depuis 7 jours et +"],
      ["pts_pub_30_60", "Pubs actives depuis 3\u20137 jours"],
      ["pts_pub_60_90", "Pubs actives depuis 1\u20133 jours"],
      ["pts_google_ads", "Balise Google Ads d\xE9tect\xE9e"],
      ["pts_traction_max", "Traction : avis clients (max)"],
      ["pts_creatives_10plus", "10 cr\xE9atives ou +"],
      ["pts_creatives_5_9", "5 \xE0 9 cr\xE9atives"],
      ["pts_creatives_2_4", "2 \xE0 4 cr\xE9atives"],
      ["pts_shopify_oui", "Shopify confirm\xE9"],
      ["pts_shopify_probable", "Shopify probable"],
      ["pts_ps_sous40", "PageSpeed < 40"],
      ["pts_ps_40_55", "PageSpeed 40\u201355"],
      ["pts_ps_56_70", "PageSpeed 56\u201370"],
      ["pts_ps_71_85", "PageSpeed 71\u201385"],
      ["pts_cro_sans_avis", "Aucun avis d\xE9tect\xE9"],
      ["pts_cro_sans_sticky", "Pas de sticky panier"],
      ["pts_cro_reassurance", "R\xE9assurance faible"],
      ["pts_cro_livraison", "Infos livraison absentes"],
      ["pts_cro_buybox", "Zone d'achat faible"],
      ["pts_source_google", "Boutique pertinente trouv\xE9e sur le web"],
      ["pts_marche_fr", "March\xE9 fran\xE7ais confirm\xE9"],
      ["pts_pertinence_niche", "Pertinence avec la niche"],
      ["pts_maturite_max", "Maturit\xE9 (max)"],
      ["pts_timing_max", "Domaine de plus d'un an"]
    ].map(([k, lib]) => `<label>${echapper(lib)}<input name="${k}" type="number" min="0" max="50" value="${reg.brut[k] ?? (k === "pts_source_google" ? 20 : ["pts_marche_fr", "pts_pertinence_niche"].includes(k) ? 10 : k === "pts_traction_max" ? 8 : k === "pts_google_ads" ? 5 : 0)}"></label>`).join("")}
          <button class="envoyer large" type="submit">Enregistrer les coefficients</button>
        </form>
      </section>`;
  }
  const barreGroupe = (liste) => {
    const n = liste.filter((p) => p.email_contact && !p.email_programme_le && !["contact\xE9", "r\xE9pondu", "rdv", "client"].includes(p.statut)).length;
    if (!n) return "";
    return `<form id="envoi-groupe" class="jr-groupe" method="POST"
        action="?cle=${cle}&page=radar&vue=${encodeURIComponent(vue)}&action=radar_email_groupe"
        onsubmit="var k=document.querySelectorAll('.coche-groupe:checked').length;if(!k){alert('Cochez au moins un prospect.');return false}return confirm('Envoyer votre mod\\xE8le d\\x27email \\xE0 '+k+' boutique(s) ?')">
      <label class="jr-tout"><input type="checkbox" onchange="var c=this.checked;document.querySelectorAll('.coche-groupe').forEach(function(x){x.checked=c});this.form.querySelector('.jr-n').textContent=document.querySelectorAll('.coche-groupe:checked').length"> Tout s\xE9lectionner</label>
      <span class="jr-info"><b class="jr-n">0</b> s\xE9lectionn\xE9(s) sur ${n} avec email \xB7 envoi progressif, ${RADAR_ENVOIS_PAR_MINUTE} par minute</span>
      <button class="envoyer" type="submit">\u2709\uFE0F Envoyer le mod\xE8le \xE0 la s\xE9lection</button>
    </form>
    <script>document.addEventListener("change",function(e){if(e.target.classList&&e.target.classList.contains("coche-groupe")){var n=document.querySelector(".jr-n");if(n)n.textContent=document.querySelectorAll(".coche-groupe:checked").length}});</script>`;
  };
  const carte = /* @__PURE__ */ __name2((p) => {
    const jPub = radarJoursDepuis(p.premiere_pub_vue);
    const estWeb = radarEstSourceWeb(p.source);
    const cochable = p.email_contact && !p.email_programme_le && !["contact\xE9", "r\xE9pondu", "rdv", "client"].includes(p.statut);
    const sc = p.score ?? 0;
    const ton = sc >= 65 ? "fort" : sc >= 50 ? "moyen" : "";
    const nom = p.marque || p.domaine || p.page_id || "Boutique";
    const cherche = p.contacts_verifies_le ? "introuvable" : "en recherche";
    const tel = p.telephone ? String(p.telephone).replace(/\D/g, "") : "";
    const modele = radarModeleEmail(p, reg);
    return `<article class="jr-ligne${cochable ? " cochable" : ""}">
      <div class="jr-coche">${cochable ? `<input type="checkbox" name="ids" value="${p.id}" form="envoi-groupe" class="coche-groupe" aria-label="S\xE9lectionner ${echapper(nom)}">` : ""}</div>
      <div class="jr-score ${ton}" title="Score ${sc}/100"><b>${p.score ?? "\u2014"}</b><span>/100</span></div>
      <div class="jr-corps">
        <div class="jr-tete">
          <a class="jr-nom" href="?cle=${cle}&page=radar&prospect=${p.id}">${echapper(nom)}</a>
          ${p.domaine ? `<a class="jr-dom" href="https://${echapper(p.domaine)}" target="_blank" rel="noopener">${echapper(p.domaine)} \u2197</a>` : ""}
        </div>
        <div class="jr-tags">
          ${p.shopify_statut === "oui" ? `<span class="jr-tag vert">Shopify</span>` : ""}
          ${estWeb ? `<span class="jr-tag">${echapper(radarLibelleSource(p.source))}</span>` : `<span class="jr-tag">${p.pubs_actives ?? "?"} pubs actives</span>`}
          ${!estWeb && jPub !== null ? `<span class="jr-tag">pub depuis ${jPub} j</span>` : ""}
          ${p.categorie === "A" ? `<span class="jr-tag jaune">nouvelle acquisition</span>` : ""}
          ${p.niche ? `<span class="jr-tag">${echapper(p.niche)}</span>` : ""}
          ${p.pagespeed_score !== null && p.pagespeed_score !== void 0 ? `<span class="jr-tag${p.pagespeed_score < 40 ? " rouge" : ""}">PageSpeed ${p.pagespeed_score}</span>` : ""}
        </div>
        <div class="jr-contacts">
          ${p.email_contact ? `<a class="jr-c ok" href="mailto:${echapper(p.email_contact)}">\u2709\uFE0F ${echapper(p.email_contact)}</a>` : `<span class="jr-c">\u2709\uFE0F email ${cherche}</span>`}
          ${p.telephone ? `<a class="jr-c ok" href="https://wa.me/${echapper(tel)}" target="_blank" rel="noopener">${p.whatsapp ? "\u{1F4AC} WhatsApp" : "\u{1F4DE}"} ${echapper(p.telephone)}</a>` : `<span class="jr-c">\u{1F4DE} ${cherche}</span>`}
          ${p.instagram ? `<a class="jr-c ok" href="https://www.instagram.com/${echapper(p.instagram)}/" target="_blank" rel="noopener">\u{1F4F8} @${echapper(p.instagram)}</a>` : `<span class="jr-c">\u{1F4F8} ${cherche}</span>`}
        </div>
        ${radarIaBloc(p, false)}
        ${p.email_envoye_le ? `<div class="meta">${radarSuiviBadges(p)}</div>` : ""}
        ${p.email_programme_le ? `<div class="jr-etat">\u23F3 Envoi programm\xE9, il part dans quelques minutes</div>` : ""}
        ${p.email_erreur && !p.email_envoye_le ? `<div class="jr-etat rouge">\u26A0\uFE0F Envoi \xE9chou\xE9 : ${echapper(String(p.email_erreur).slice(0, 120))}</div>` : ""}
        <div class="jr-outils">
          <details><summary>\u2709\uFE0F Contacter</summary>
            <form class="f" method="POST" action="?cle=${cle}&page=radar&prospect=${p.id}&action=radar_email">
              <label class="large">Destinataire<input name="a" type="email" required value="${echapper(p.email_contact || "")}" placeholder="contact@boutique.com"></label>
              <label class="large">Objet<input name="objet" required value="${echapper(modele.objet)}"></label>
              <label class="large">Message<textarea name="message" rows="12" required>${echapper(modele.corps)}</textarea></label>
              <a class="sec" href="?cle=${cle}&page=radar&vue=reglages#modele-email">Modifier le mod\xE8le d'email</a>
              <button class="envoyer large" type="submit">Envoyer l'email</button>
            </form>
          </details>
          <details class="ecarter"><summary>\u274C \xC9carter</summary>
            <form class="f" method="POST" action="?cle=${cle}&page=radar&prospect=${p.id}&action=radar_statut&statut=${encodeURIComponent("non pertinent")}">
              <label class="large">Motif<select name="motif">${RADAR_MOTIFS.map((m) => `<option>${m}</option>`).join("")}</select></label>
              <button class="envoyer large" type="submit" style="background:var(--rouge);color:#fff">\xC9carter ce prospect</button>
            </form>
          </details>
          ${p.domaine ? `<a class="jr-btn" href="https://${echapper(p.domaine)}" target="_blank" rel="noopener">\u{1F310} Voir la boutique</a>` : ""}
          <a class="jr-btn" target="_blank" rel="noopener" href="https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${echapper(reg.pays || "FR")}&${!estWeb && p.page_id ? `view_all_page_id=${echapper(p.page_id)}` : `q=${encodeURIComponent(p.domaine || nom)}&search_type=keyword_unordered`}">\u{1F4E2} Voir les pubs</a>
          <a class="jr-lien" href="?cle=${cle}&page=radar&prospect=${p.id}">Voir l'analyse \u2192</a>
        </div>
      </div>
    </article>`;
  }, "carte");
  const onglets = `<section><div class="actions">
      ${[["jour", "Prospects du jour"], ["a_contacter", `\xC0 contacter (${par["\xE0 contacter"] || 0})`], ["contactes", `Contact\xE9s (${(par["contact\xE9"] || 0) + (par["r\xE9pondu"] || 0) + (par["rdv"] || 0) + (par["client"] || 0)})`], ["ecartes", `Boutiques \xE9cart\xE9es (${(par["non pertinent"] || 0) + (par["d\xE9j\xE0 optimis\xE9"] || 0)})`]].map(([v, lib]) => `<a class="bouton${vue === v ? "" : " pale"}" href="?cle=${cle}&page=radar&vue=${v}">${lib}</a>`).join("")}
    </div></section>`;
  const ONGLETS_STATUTS = {
    a_contacter: ["\xE0 contacter"],
    contactes: ["contact\xE9", "r\xE9pondu", "rdv", "client"],
    ecartes: ["non pertinent", "d\xE9j\xE0 optimis\xE9"]
  };
  if (ONGLETS_STATUTS[vue]) {
    const statuts = ONGLETS_STATUTS[vue];
    const liste = await tous2(env.DB, `SELECT p.*, (SELECT MAX(h.quand) FROM radar_historique h WHERE h.prospect_id=p.id) AS change_le
      FROM radar_prospects p WHERE p.statut IN (${statuts.map(() => "?").join(",")}) ORDER BY change_le DESC, p.id DESC LIMIT 200`, ...statuts);
    if (vue === "a_contacter") {
      return `${message || ""}${onglets}
        <section><h2>\xC0 contacter</h2>
          ${barreGroupe(liste)}
          ${RADAR_JR_CSS}
          ${liste.length ? `<div class="jr-liste">${liste.map(carte).join("")}</div>` : `<div class="tw"><div class="vide">Aucun prospect marqu\xE9 \xE0 contacter.</div></div>`}
        </section>`;
    }
    if (vue === "contactes") return `${message || ""}${onglets}${radarVueContactes(liste, cle)}`;
    const titre = vue === "ecartes" ? "Boutiques \xE9cart\xE9es" : "Boutiques contact\xE9es";
    return `${message || ""}${onglets}
      <section><h2>${titre}</h2>
        ${vue === "ecartes" ? `<p class="sec" style="margin:-4px 0 0">Elles ne r\xE9appara\xEEtront plus dans les prospects du jour. \xAB Remettre \xBB les renvoie dans la liste.</p>` : ""}
        ${tableauHtml(
      [{ nom: "Boutique" }, { nom: "Contact" }, { nom: vue === "ecartes" ? "Motif" : "Statut" }, ...vue === "ecartes" ? [] : [{ nom: "Suivi email" }], { nom: "Date", classe: "nowrap" }, { nom: "" }],
      liste.map((p) => `<tr>
          <td><a href="?cle=${cle}&page=radar&prospect=${p.id}"><b>${echapper(p.marque || p.domaine || p.page_id)}</b></a><br><span class="sec">${echapper(p.domaine || "")}</span></td>
          <td>${p.email_contact ? `<a href="mailto:${echapper(p.email_contact)}">${echapper(p.email_contact)}</a>` : '<span class="sec">\u2014</span>'}${p.telephone ? `<br><a href="https://wa.me/${echapper(String(p.telephone).replace(/\D/g, ""))}" target="_blank" rel="noopener">${echapper(p.telephone)}</a>` : ""}</td>
          <td>${echapper(vue === "ecartes" ? p.motif_rejet || p.statut : p.statut)}</td>
          ${vue === "ecartes" ? "" : `<td class="meta">${radarSuiviBadges(p) || '<span class="sec">\u2014</span>'}</td>`}
          <td class="nowrap">${p.change_le ? dateFr2(p.change_le, false) : "\u2014"}</td>
          <td class="nowrap">${vue === "ecartes" ? `<form method="POST" style="display:inline" action="?cle=${cle}&page=radar&prospect=${p.id}&action=radar_statut&statut=nouveau&onglet=ecartes"><button class="envoyer discret" type="submit">Remettre</button></form>` : `<a class="bouton pale" href="?cle=${cle}&page=radar&prospect=${p.id}">Ouvrir</a>`}</td>
        </tr>`),
      vue === "ecartes" ? "Aucune boutique \xE9cart\xE9e." : "Aucune boutique contact\xE9e pour le moment."
    )}
      </section>`;
  }
  return `${message || ""}
    ${onglets}
    ${sansJeton || !sourceDisponible ? installation : ""}

    ${RADAR_JR_CSS}
    <section>
      <div class="ct-kpi">
        <div><b>${prospects.length}<em>/ ${reg.parJour}</em></b><span>prospects propos\xE9s aujourd'hui</span></div>
        <div><b>${prospects.filter((p) => p.email_contact).length}</b><span>avec un email trouv\xE9</span></div>
        <div><b>${par["\xE0 contacter"] || 0}</b><span>\xE0 contacter</span></div>
        <div><b>${(par["contact\xE9"] || 0) + (par["r\xE9pondu"] || 0) + (par["rdv"] || 0) + (par["client"] || 0)}</b><span>contact\xE9s \xB7 ${par["rdv"] || 0} RDV</span></div>
      </div>
      <div class="jr-radar">
        <span class="jr-point ${!sourceDisponible || executionRadar?.statut === "erreur" ? "rouge" : "vert"}"></span>
        <span>Collecteur ${env.META_TOKEN ? "Meta + recherche web" : env.GEMINI_API_KEY ? "Gemini + recherche web" : "recherche web"} \xB7 ${executionRadar ? `derni\xE8re collecte ${depuis(executionRadar.quand)}` : "aucune collecte ex\xE9cut\xE9e"} \xB7 ${totalProspects} boutiques en base \xB7 ${motscles.filter((m) => m.actif).length} mots-cl\xE9s actifs</span>
        <span class="jr-radar-actions">
          <a href="?cle=${cle}&page=radar&vue=reglages">\u2699 R\xE9glages</a>
          <a href="?cle=${cle}&page=radar&vue=reglages#modele-email">\u270F\uFE0F Mod\xE8le d'email</a>
        </span>
      </div>
      ${sourceDisponible ? `<div class="jr-recherche">
        ${rechercheEnCours ? `<meta http-equiv="refresh" content="120">
          <button type="button" disabled>Recherche en cours\u2026</button>
          <form method="POST" action="?cle=${cle}&page=radar&action=radar_recherche_stop"><button type="submit" class="discret">Arr\xEAter</button></form>
          <span>${recherche.passes} passage(s) \xB7 ${Math.max(0, recherche.trouves - (recherche.depart || 0))} / ${reg.parJour} nouveaux prospects trouv\xE9s. La recherche continue jusqu'\xE0 trouver vos prospects du jour (au plus ${RADAR_PASSES_PAR_JOUR} passages par jour). La page se met \xE0 jour toutes les 2 minutes.</span>` : `<form method="POST" action="?cle=${cle}&page=radar&action=radar_recherche"
            onsubmit="var b=this.querySelector('button');if(b.disabled)return false;b.disabled=true;b.textContent='Lancement\u2026';">
            <button type="submit">\u{1F50E} Donnez-moi les prospects du jour</button></form>
          <span>${recherche?.fin ? `Derni\xE8re recherche ${depuis(recherche.fin)} : ${Math.max(0, recherche.trouves - (recherche.depart || 0))} nouveau(x) prospect(s)${recherche.erreur ? ` \xB7 arr\xEAt\xE9e : ${echapper(recherche.erreur.replace(/[.\s]+$/, ""))}` : ""}.` : ""} ${modeAuto ? "Le radar cherche aussi tout seul toutes les 15 minutes." : "Le radar ne cherche que quand vous cliquez."}</span>`}
      </div>` : ""}
    </section>

    <section><h2>Prospects du jour</h2>
      <p class="jr-intro">Class\xE9s du meilleur score au plus faible. Vous v\xE9rifiez, vous d\xE9cidez : rien ne part sans vous.</p>
      ${barreGroupe(prospects)}
      ${prospects.length ? `<div class="jr-liste">${[...prospects].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map(carte).join("")}</div>` : `<div class="tw"><div class="vide">${sourceDisponible ? (rechercheEnCours ? "Recherche en cours : les prospects apparaissent ici d\xE8s qu'ils sont qualifi\xE9s." : modeAuto ? "Aucun prospect qualifi\xE9 pour le moment. La prochaine collecte continuera la recherche." : "Aucun prospect pour le moment. Cliquez sur \xAB Donnez-moi les prospects du jour \xBB pour lancer la recherche.") : "Le collecteur attend une connexion Gemini ou Meta."}</div></div>`}
    </section>

    <div class="note"><b>Pas plus de prospects. De meilleurs prospects.</b>
      Le radar ne contacte personne : il cherche, il mesure, il classe. La d\xE9cision reste la v\xF4tre.</div>`;
}
__name(pageRadar, "pageRadar");
__name2(pageRadar, "pageRadar");
var AUTH_ITERATIONS = 6e4;
var AUTH_COOKIE = "adamecom_session";
var AUTH_DUREE = 30 * 864e5;
var hexDe = /* @__PURE__ */ __name2((buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""), "hexDe");
var octetsDe = /* @__PURE__ */ __name2((hex) => new Uint8Array((hex.match(/.{1,2}/g) || []).map((h) => parseInt(h, 16))), "octetsDe");
async function authEmpreinte(motDePasse, selHex, iterations) {
  const cle = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(motDePasse),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: octetsDe(selHex), iterations, hash: "SHA-256" },
    cle,
    256
  );
  return hexDe(bits);
}
__name(authEmpreinte, "authEmpreinte");
__name2(authEmpreinte, "authEmpreinte");
function authEgal(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
__name(authEgal, "authEgal");
__name2(authEgal, "authEgal");
async function authSigner(donnees, secret) {
  const cle = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return hexDe(await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(donnees)));
}
__name(authSigner, "authSigner");
__name2(authSigner, "authSigner");
async function authCreerJeton(email, secret) {
  const corps = `${email}.${Date.now() + AUTH_DUREE}`;
  return `${corps}.${await authSigner(corps, secret)}`;
}
__name(authCreerJeton, "authCreerJeton");
__name2(authCreerJeton, "authCreerJeton");
async function authVerifierJeton(jeton, secret) {
  if (!jeton) return null;
  const i = jeton.lastIndexOf(".");
  if (i < 1) return null;
  const corps = jeton.slice(0, i), signature = jeton.slice(i + 1);
  if (!authEgal(signature, await authSigner(corps, secret))) return null;
  const j = corps.lastIndexOf(".");
  const email = corps.slice(0, j), expire = Number(corps.slice(j + 1));
  if (!Number.isFinite(expire) || expire < Date.now()) return null;
  return email;
}
__name(authVerifierJeton, "authVerifierJeton");
__name2(authVerifierJeton, "authVerifierJeton");
var authCookies = /* @__PURE__ */ __name2((request) => Object.fromEntries(
  (request.headers.get("cookie") || "").split(";").map((c) => c.trim().split("=")).filter((p) => p.length === 2)
), "authCookies");
async function authJetonValide(db, jeton) {
  if (!jeton) return false;
  try {
    const r = await db.prepare("SELECT valeur FROM reglages WHERE cle = 'setup_token'").first();
    if (!r?.valeur) return false;
    const [attendu, expire] = String(r.valeur).split("|");
    if (!attendu || Number(expire) < Date.now()) return false;
    return authEgal(jeton, attendu);
  } catch {
    return false;
  }
}
__name(authJetonValide, "authJetonValide");
__name2(authJetonValide, "authJetonValide");
var authConsommerJeton = /* @__PURE__ */ __name2((db) => db.prepare("DELETE FROM reglages WHERE cle = 'setup_token'").run().catch(() => {
}), "authConsommerJeton");
async function authCompte(db) {
  try {
    return await db.prepare("SELECT * FROM app_comptes LIMIT 1").first();
  } catch {
    return null;
  }
}
__name(authCompte, "authCompte");
__name2(authCompte, "authCompte");
async function authNoter(env, email, reussie, request) {
  try {
    await env.DB.prepare(
      "INSERT INTO app_connexions (email, reussie, ip, agent, quand) VALUES (?, ?, ?, ?, ?)"
    ).bind(
      email || null,
      reussie ? 1 : 0,
      request.headers.get("cf-connecting-ip") || null,
      (request.headers.get("user-agent") || "").slice(0, 160),
      (/* @__PURE__ */ new Date()).toISOString()
    ).run();
  } catch {
  }
}
__name(authNoter, "authNoter");
__name2(authNoter, "authNoter");
async function authSession(request, env) {
  const jeton = authCookies(request)[AUTH_COOKIE];
  return jeton ? authVerifierJeton(decodeURIComponent(jeton), env.CLE_TEST) : null;
}
__name(authSession, "authSession");
__name2(authSession, "authSession");
function authPage(titre, contenu, env) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="light dark">
<meta name="referrer" content="no-referrer">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;450;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<title>AdamEcom \xB7 ${echapper(titre)}</title>
<style>${STYLE}
body{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
.porte{width:100%;max-width:420px;display:flex;flex-direction:column;gap:20px}
.porte .marque{display:flex;align-items:center;gap:11px;justify-content:center;text-decoration:none}
.porte .marque .t{width:30px;height:30px;border-radius:8px;background:var(--jaune);flex-shrink:0;
 display:flex;align-items:center;justify-content:center;color:#0C0B09;font-weight:800;font-size:17px}
.porte .marque b{font-size:19px;font-weight:700;letter-spacing:-.03em}
.porte form.f{grid-template-columns:1fr;box-shadow:var(--ombre)}
.porte .envoyer{width:100%;justify-content:center}
.porte h1{font-size:21px;text-align:center}
.porte .sous{text-align:center;max-width:none}
</style></head><body><div class="porte">
  <div class="marque"><div class="t">A</div><b>AdamEcom</b></div>
  ${contenu}
</div></body></html>`;
}
__name(authPage, "authPage");
__name2(authPage, "authPage");
function authFormulaire(env, url, compte, message) {
  const err = url.searchParams.get("err");
  const bandeau = err ? `<div class="alerte">${echapper(err)}</div>` : message ? `<div class="note">${message}</div>` : "";
  if (!compte) {
    const autorise = env.CLE_TEST && url.searchParams.get("cle") === env.CLE_TEST || url.autoriseSetup;
    if (!autorise) {
      return authPage("Connexion", `${bandeau}
        <div class="note">Aucun compte n'est encore cr\xE9\xE9. Ouvrez cette page depuis
          l'application, avec votre cl\xE9 d'acc\xE8s actuelle, pour d\xE9finir vos identifiants.</div>`, env);
    }
    return authPage("Cr\xE9er votre acc\xE8s", `
      <div><h1>Cr\xE9er votre acc\xE8s</h1>
        <p class="sous">Vous ne d\xE9finissez ces identifiants qu'une fois. Le mot de passe
          n'est enregistr\xE9 nulle part en clair.</p></div>
      ${bandeau}
      <form class="f" method="POST" action="/connexion?action=creer&${url.autoriseSetup ? `setup=${encodeURIComponent(url.searchParams.get("setup") || "")}` : `cle=${encodeURIComponent(env.CLE_TEST)}`}">
        <label>Adresse email<input name="email" type="email" required autocomplete="username"
          placeholder="vous@adam-ecom.com"></label>
        <label>Mot de passe<input name="motdepasse" type="password" required minlength="12"
          autocomplete="new-password" placeholder="au moins 12 caract\xE8res"></label>
        <label>Confirmation<input name="confirmation" type="password" required minlength="12"
          autocomplete="new-password"></label>
        <button class="envoyer" type="submit">Cr\xE9er mon acc\xE8s</button>
      </form>`, env);
  }
  return authPage("Connexion", `
    <div><h1>Connexion</h1></div>
    ${bandeau}
    <form class="f" method="POST" action="/connexion">
      <label>Adresse email<input name="email" type="email" required autocomplete="username"
        value="${echapper(url.searchParams.get("email") || "")}"></label>
      <label>Mot de passe<input name="motdepasse" type="password" required autocomplete="current-password"></label>
      <button class="envoyer" type="submit">Entrer</button>
    </form>`, env);
}
__name(authFormulaire, "authFormulaire");
__name2(authFormulaire, "authFormulaire");
async function authTraiter(request, env, url) {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const motDePasse = String(form.get("motdepasse") || "");
  const compte = await authCompte(env.DB);
  const echec = /* @__PURE__ */ __name2((m) => Response.redirect(`${url.origin}/connexion?err=${encodeURIComponent(m)}` + (email ? `&email=${encodeURIComponent(email)}` : ""), 303), "echec");
  if (url.searchParams.get("action") === "creer") {
    if (compte) return echec("Un compte existe d\xE9j\xE0.");
    const parJeton = await authJetonValide(env.DB, url.searchParams.get("setup"));
    if (!parJeton && (!env.CLE_TEST || url.searchParams.get("cle") !== env.CLE_TEST)) {
      return new Response("Non autoris\xE9", { status: 401 });
    }
    if (!email.includes("@")) return echec("Adresse email invalide.");
    if (motDePasse.length < 12) return echec("Le mot de passe doit faire au moins 12 caract\xE8res.");
    if (motDePasse !== String(form.get("confirmation") || "")) {
      return echec("Les deux mots de passe ne correspondent pas.");
    }
    const sel = hexDe(crypto.getRandomValues(new Uint8Array(16)));
    await env.DB.prepare(
      `INSERT INTO app_comptes (email, empreinte, sel, iterations, cree_le)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      email,
      await authEmpreinte(motDePasse, sel, AUTH_ITERATIONS),
      sel,
      AUTH_ITERATIONS,
      (/* @__PURE__ */ new Date()).toISOString()
    ).run();
    await authConsommerJeton(env.DB);
    await authNoter(env, email, true, request);
    return authRepondreConnecte(env, url, email);
  }
  if (!compte) return echec("Aucun compte n'existe encore.");
  const attendu = await authEmpreinte(motDePasse, compte.sel, compte.iterations);
  const bon = authEgal(email, compte.email) && authEgal(attendu, compte.empreinte);
  await authNoter(env, email, bon, request);
  if (!bon) return echec("Email ou mot de passe incorrect.");
  await env.DB.prepare("UPDATE app_comptes SET derniere_connexion=? WHERE email=?").bind((/* @__PURE__ */ new Date()).toISOString(), compte.email).run();
  return authRepondreConnecte(env, url, compte.email);
}
__name(authTraiter, "authTraiter");
__name2(authTraiter, "authTraiter");
async function authRepondreConnecte(env, url, email) {
  const jeton = await authCreerJeton(email, env.CLE_TEST);
  return new Response(null, {
    status: 303,
    headers: {
      location: `${url.origin}/`,
      "set-cookie": `${AUTH_COOKIE}=${encodeURIComponent(jeton)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.floor(AUTH_DUREE / 1e3)}`
    }
  });
}
__name(authRepondreConnecte, "authRepondreConnecte");
__name2(authRepondreConnecte, "authRepondreConnecte");
var authDeconnexion = /* @__PURE__ */ __name2((url) => new Response(null, {
  status: 303,
  headers: {
    location: `${url.origin}/connexion`,
    "set-cookie": `${AUTH_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  }
}), "authDeconnexion");
var PROFIL_DEFAUTS = /* @__PURE__ */ __name2((env) => ({
  profil_nom: "AdamEcom",
  profil_activite: "Consultant Shopify & CRO",
  profil_email: env.SENDER_EMAIL || "info@adam-ecom.com",
  profil_site: "adam-ecom.com",
  profil_telephone: "",
  profil_logo: LOGO,
  profil_mentions: "TVA non applicable \u2014 article 293 B du CGI. Paiement par virement bancaire.",
  profil_remerciement: "Adam Ecom vous remercie pour votre confiance.",
  banque_titulaire: env.BANQUE_TITULAIRE || "Mohamed Chaoui",
  banque_nom: env.BANQUE_NOM || "Clear Junction Limited",
  banque_iban: env.BANQUE_IBAN || "",
  banque_bic: env.BANQUE_BIC || "",
  banque_compte: env.BANQUE_COMPTE || "",
  banque_guichet: env.BANQUE_GUICHET || "",
  banque_adresse: env.BANQUE_ADRESSE || ""
}), "PROFIL_DEFAUTS");
async function chargerProfil(env) {
  if (env._profil) return env._profil;
  const p = { ...PROFIL_DEFAUTS(env) };
  try {
    const { results = [] } = await env.DB.prepare("SELECT cle, valeur FROM reglages WHERE cle LIKE 'profil_%' OR cle LIKE 'banque_%'").all();
    for (const r of results) if (r.valeur !== null && r.valeur !== "") p[r.cle] = r.valeur;
  } catch {
  }
  env._profil = p;
  return p;
}
__name(chargerProfil, "chargerProfil");
__name2(chargerProfil, "chargerProfil");
async function pageReglages(env, url, message) {
  const cle = encodeURIComponent(env.CLE_TEST);
  const p = await chargerProfil(env);
  const [compte, connexions] = await Promise.all([
    authCompte(env.DB),
    tous2(env.DB, "SELECT email, reussie, ip, quand FROM app_connexions ORDER BY quand DESC LIMIT 8")
  ]);
  const champ = /* @__PURE__ */ __name2((nom, libelle, valeur, type = "text", aide = "") => `<label${type === "textarea" ? ' class="large"' : ""}>${echapper(libelle)}
      ${aide ? `<span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--gris)">${echapper(aide)}</span>` : ""}
      ${type === "textarea" ? `<textarea name="${nom}" style="min-height:80px">${echapper(valeur || "")}</textarea>` : `<input name="${nom}" type="${type}" value="${echapper(valeur || "")}">`}</label>`, "champ");
  return `${message || ""}

  <section><h2>Mon profil</h2>
    <p class="sec" style="margin:-4px 0 0">Ces informations apparaissent sur vos factures
      et dans les invitations que re\xE7oivent vos clients.</p>
    <form class="f" method="POST" action="?cle=${cle}&page=reglages&action=reglages_profil">
      ${champ("profil_nom", "Nom commercial", p.profil_nom)}
      ${champ("profil_activite", "Activit\xE9", p.profil_activite)}
      ${champ("profil_email", "Email de contact", p.profil_email, "email")}
      ${champ("profil_site", "Site web", p.profil_site)}
      ${champ("profil_telephone", "T\xE9l\xE9phone", p.profil_telephone, "text", "(facultatif)")}
      <div></div>
      ${champ("profil_remerciement", "Phrase de remerciement", p.profil_remerciement, "textarea")}
      ${champ("profil_mentions", "Mentions l\xE9gales des factures", p.profil_mentions, "textarea")}
      <button class="envoyer large" type="submit">Enregistrer le profil</button>
    </form>
  </section>

  <section><h2>Logo</h2>
    <p class="sec" style="margin:-4px 0 0">Il doit \xEAtre accessible publiquement : vos clients le
      chargent depuis leur bo\xEEte mail. Le plus simple est de le d\xE9poser dans les fichiers Shopify
      et d'en copier l'adresse.</p>
    <div class="tw" style="padding:22px;text-align:center;background:#fff">
      <img src="${echapper(p.profil_logo)}" alt="Logo actuel"
        style="max-width:280px;max-height:110px;height:auto">
    </div>
    <form class="f" method="POST" action="?cle=${cle}&page=reglages&action=reglages_logo">
      ${champ("profil_logo", "Adresse du logo", p.profil_logo, "url")}
      <div></div>
      <button class="envoyer large" type="submit">Mettre \xE0 jour le logo</button>
    </form>
  </section>

  <section><h2>Coordonn\xE9es bancaires</h2>
    <p class="sec" style="margin:-4px 0 0">Imprim\xE9es sur chaque facture. V\xE9rifiez-les :
      une erreur ici, et vous n'\xEAtes pas pay\xE9.</p>
    <form class="f" method="POST" action="?cle=${cle}&page=reglages&action=reglages_banque">
      ${champ("banque_titulaire", "Titulaire", p.banque_titulaire)}
      ${champ("banque_nom", "Banque", p.banque_nom)}
      ${champ("banque_iban", "IBAN", p.banque_iban)}
      ${champ("banque_bic", "SWIFT / BIC", p.banque_bic)}
      ${champ("banque_compte", "N\xB0 de compte", p.banque_compte)}
      ${champ("banque_guichet", "Code guichet", p.banque_guichet)}
      ${champ("banque_adresse", "Adresse de la banque", p.banque_adresse, "textarea")}
      <button class="envoyer large" type="submit">Enregistrer les coordonn\xE9es</button>
    </form>
  </section>

  <section><h2>Compte et s\xE9curit\xE9</h2>
    <div class="grille">
      ${carteHtml(
    "Connect\xE9 en tant que",
    echapper(compte?.email || "\u2014"),
    compte?.derniere_connexion ? `derni\xE8re connexion ${dateFr2(compte.derniere_connexion)}` : "",
    "bon"
  )}
      ${carteHtml(
    "Robustesse du hachage",
    (compte?.iterations || 0).toLocaleString("fr-FR"),
    "it\xE9rations PBKDF2-SHA256"
  )}
      ${carteHtml(
    "Connexions enregistr\xE9es",
    String(connexions.length),
    connexions.filter((c) => !c.reussie).length ? `${connexions.filter((c) => !c.reussie).length} \xE9chec(s)` : "aucun \xE9chec",
    connexions.filter((c) => !c.reussie).length ? "moyen" : "neutre"
  )}
    </div>

    <form class="f" method="POST" action="?cle=${cle}&page=reglages&action=reglages_motdepasse">
      <label class="large">Changer le mot de passe
        <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--gris)">
          au moins 12 caract\xE8res</span></label>
      <label>Mot de passe actuel<input name="actuel" type="password" required
        autocomplete="current-password"></label>
      <div></div>
      <label>Nouveau mot de passe<input name="nouveau" type="password" required minlength="12"
        autocomplete="new-password"></label>
      <label>Confirmation<input name="confirmation" type="password" required minlength="12"
        autocomplete="new-password"></label>
      <button class="envoyer large" type="submit">Changer le mot de passe</button>
    </form>

    <details><summary>Derni\xE8res connexions</summary>
      <div class="dedans">${tableauHtml(
    [{ nom: "Quand", classe: "nowrap" }, { nom: "Email" }, { nom: "Adresse IP" }, { nom: "R\xE9sultat" }],
    connexions.map((c) => `<tr>
          <td class="nowrap">${dateFr2(c.quand)}</td>
          <td>${echapper(c.email || "\u2014")}</td>
          <td><span class="sec">${echapper(c.ip || "\u2014")}</span></td>
          <td>${c.reussie ? pastille("r\xE9ussie") : pastille("\xE9chec")}</td></tr>`),
    "Aucune connexion enregistr\xE9e."
  )}</div></details>

    <div class="actions" style="margin-top:6px">
      <a class="bouton gros pale" href="/deconnexion">Se d\xE9connecter</a>
      <span class="sec">la session dure 30 jours</span>
    </div>
  </section>

  <section><h2>Autres r\xE9glages</h2><div class="actions">
    <a class="bouton pale" href="?cle=${cle}&page=google">Agenda Google</a>
    <a class="bouton pale" href="?cle=${cle}&page=radar&vue=reglages">Mots-cl\xE9s du Radar</a>
    <a class="bouton pale" href="?cle=${cle}&page=journal">Journal technique</a>
  </div>
  <div class="note">La boutique, le flux du blog et la liste Brevo restent dans la configuration
    du Worker : ce sont des r\xE9glages d'installation, pas des pr\xE9f\xE9rences du quotidien.</div>
  </section>`;
}
__name(pageReglages, "pageReglages");
__name2(pageReglages, "pageReglages");
async function enregistrerReglages(env, form, prefixes) {
  const maintenant = (/* @__PURE__ */ new Date()).toISOString();
  const permises = Object.keys(PROFIL_DEFAUTS(env));
  let n = 0;
  for (const [k, v] of form.entries()) {
    if (!permises.includes(k)) continue;
    if (!prefixes.some((p) => k.startsWith(p))) continue;
    await env.DB.prepare("INSERT OR REPLACE INTO reglages (cle, valeur, maj_le) VALUES (?, ?, ?)").bind(k, String(v).trim(), maintenant).run();
    n++;
  }
  return n;
}
__name(enregistrerReglages, "enregistrerReglages");
__name2(enregistrerReglages, "enregistrerReglages");
async function changerMotDePasse(env, form) {
  const compte = await authCompte(env.DB);
  if (!compte) return { erreur: "Aucun compte." };
  const actuel = String(form.get("actuel") || "");
  const nouveau = String(form.get("nouveau") || "");
  if (nouveau.length < 12) return { erreur: "Le nouveau mot de passe doit faire au moins 12 caract\xE8res." };
  if (nouveau !== String(form.get("confirmation") || "")) {
    return { erreur: "Les deux nouveaux mots de passe ne correspondent pas." };
  }
  const verif = await authEmpreinte(actuel, compte.sel, compte.iterations);
  if (!authEgal(verif, compte.empreinte)) return { erreur: "Mot de passe actuel incorrect." };
  const sel = hexDe(crypto.getRandomValues(new Uint8Array(16)));
  await env.DB.prepare(
    "UPDATE app_comptes SET empreinte=?, sel=?, iterations=? WHERE email=?"
  ).bind(await authEmpreinte(nouveau, sel, AUTH_ITERATIONS), sel, AUTH_ITERATIONS, compte.email).run();
  return { ok: true };
}
__name(changerMotDePasse, "changerMotDePasse");
__name2(changerMotDePasse, "changerMotDePasse");
var EMAILS = [
  {
    id: "calendly_notif",
    nom: "R\xE9servation d'appel \u2014 pour vous",
    quand: "D\xE8s qu'un prospect r\xE9serve sur Calendly",
    vers: "Vous",
    auto: true,
    variables: ["{nom}", "{email}", "{quand}"],
    objet: "Appel r\xE9serv\xE9 \u2014 {nom} \u2014 {quand}",
    role: "Vous pr\xE9vient qu'un appel vient d'\xEAtre r\xE9serv\xE9, avec le r\xE9capitulatif du prospect."
  },
  {
    id: "calendly_qualif",
    nom: "Qualification du prospect",
    quand: "5 minutes apr\xE8s la r\xE9servation",
    vers: "Le prospect",
    auto: true,
    variables: ["{nom}"],
    objet: "Votre demande d'appel AdamEcom \u2014 \xE9tape obligatoire avant notre \xE9change",
    role: "Demande au prospect de remplir le formulaire de qualification avant l'appel."
  },
  {
    id: "blog_newsletter",
    nom: "Newsletter d'un nouvel article",
    quand: "D\xE8s qu'un article para\xEEt sur le blog",
    vers: "Votre liste Brevo",
    auto: true,
    variables: ["{titre}"],
    objet: "{titre}",
    role: "Envoie l'article en campagne \xE0 tous vos abonn\xE9s."
  },
  {
    id: "facture_envoi",
    nom: "Envoi d'une facture",
    quand: "Quand vous cliquez sur \xAB Envoyer \xBB",
    vers: "Le client",
    auto: false,
    variables: ["{numero}", "{client}", "{montant}", "{prestation}"],
    objet: "Facture n\xB0 {numero} \u2014 AdamEcom",
    intro: "Veuillez trouver ci-dessous la facture n\xB0 {numero} correspondant \xE0 la prestation \xAB {prestation} \xBB, d'un montant de {montant}.",
    role: "Transmet la facture au client, avec le lien vers sa version imprimable."
  },
  {
    id: "facture_payee",
    nom: "Confirmation de paiement",
    quand: "Quand vous cliquez sur \xAB Marquer comme pay\xE9e \xBB",
    vers: "Le client",
    auto: true,
    variables: ["{numero}", "{client}", "{montant}", "{prestation}"],
    objet: "Paiement bien re\xE7u \u2014 facture n\xB0 {numero}",
    intro: "Nous avons bien re\xE7u votre paiement de {montant} pour la facture n\xB0 {numero} (\xAB {prestation} \xBB). Merci pour votre confiance !",
    role: "Confirme au client que son paiement a bien \xE9t\xE9 re\xE7u, avec le lien vers sa facture."
  },
  {
    id: "facture_annulation",
    nom: "Annulation d'une facture",
    quand: "Quand vous annulez une facture d\xE9j\xE0 envoy\xE9e",
    vers: "Le client",
    auto: false,
    variables: ["{numero}", "{client}", "{montant}"],
    objet: "Annulation de la facture n\xB0 {numero} \u2014 AdamEcom",
    role: "Pr\xE9vient le client qu'une facture re\xE7ue ne doit pas \xEAtre r\xE9gl\xE9e."
  },
  {
    id: "devis_envoi",
    nom: "Envoi d'un devis",
    quand: "Quand vous cliquez sur \xAB Envoyer \xBB sur un devis",
    vers: "Le client",
    auto: false,
    variables: ["{numero}", "{client}", "{montant}", "{titre}"],
    objet: "Devis n\xB0 {numero} \u2014 {titre}",
    role: "Transmet le devis au client, avec le lien vers sa version imprimable."
  },
  {
    id: "contrat_envoi",
    nom: "Envoi d'un contrat \xE0 signer",
    quand: "Quand vous cliquez sur \xAB Envoyer \xE0 signer \xBB sur un contrat",
    vers: "Le client",
    auto: false,
    variables: ["{numero}", "{client}", "{titre}"],
    objet: "Contrat n\xB0 {numero} \xE0 signer \u2014 {titre}",
    role: "Envoie au client le lien pour lire et signer le contrat en ligne."
  },
  {
    id: "meeting_invitation",
    nom: "Invitation \xE0 un rendez-vous",
    quand: "Quand vous envoyez une invitation",
    vers: "Le client",
    auto: false,
    variables: ["{sujet}", "{quand}", "{client}"],
    objet: "Rendez-vous \u2014 {sujet} \u2014 {quand}",
    role: "Envoie le lien de visio et le fichier calendrier \xE0 joindre \xE0 son agenda."
  },
  {
    id: "meeting_annulation",
    nom: "Annulation d'un rendez-vous",
    quand: "Quand vous annulez un rendez-vous envoy\xE9",
    vers: "Le client",
    auto: false,
    variables: ["{sujet}", "{quand}"],
    objet: "Annulation \u2014 {sujet}",
    role: "Pr\xE9vient le client que le rendez-vous n'aura pas lieu."
  },
  {
    id: "creneau_proposition",
    nom: "Proposition d'un nouveau cr\xE9neau",
    quand: "Quand vous proposez un autre horaire \xE0 un prospect",
    vers: "Le prospect",
    auto: false,
    variables: ["{nom}"],
    objet: "Proposition d'un nouveau cr\xE9neau \u2014 AdamEcom",
    role: "Propose une nouvelle date \xE0 un prospect dont l'appel n'a pas abouti."
  }
];
var emailModele = /* @__PURE__ */ __name2((id) => EMAILS.find((m) => m.id === id), "emailModele");
async function chargerEmails(env) {
  if (env._emails) return env._emails;
  const par = {};
  try {
    const { results = [] } = await env.DB.prepare("SELECT * FROM emails_modeles").all();
    for (const r of results) par[r.id] = r;
  } catch {
  }
  env._emails = par;
  return par;
}
__name(chargerEmails, "chargerEmails");
__name2(chargerEmails, "chargerEmails");
function remplirGabarit(gabarit, valeurs) {
  return String(gabarit || "").replace(/\{(\w+)\}/g, (tout, cle) => valeurs[cle] !== void 0 && valeurs[cle] !== null ? String(valeurs[cle]) : tout);
}
__name(remplirGabarit, "remplirGabarit");
__name2(remplirGabarit, "remplirGabarit");
async function emailAutorise(env, id) {
  try {
    const r = await env.DB.prepare("SELECT actif FROM emails_modeles WHERE id = ?").bind(id).first();
    return !r || r.actif !== 0;
  } catch {
    return true;
  }
}
__name(emailAutorise, "emailAutorise");
__name2(emailAutorise, "emailAutorise");
async function objetEmail(env, id, defaut, valeurs = {}) {
  try {
    const r = await env.DB.prepare("SELECT objet FROM emails_modeles WHERE id = ?").bind(id).first();
    if (r?.objet) return remplirGabarit(r.objet, valeurs);
  } catch {
  }
  return defaut;
}
__name(objetEmail, "objetEmail");
__name2(objetEmail, "objetEmail");
var noterEnvoi = /* @__PURE__ */ __name2((env, modele, destinataire, objet, statut, message) => env.DB.prepare(
  "INSERT INTO emails_envoyes (modele, destinataire, objet, statut, message, quand) VALUES (?, ?, ?, ?, ?, ?)"
).bind(
  modele,
  destinataire || null,
  (objet || "").slice(0, 200),
  statut,
  message ? String(message).slice(0, 300) : null,
  (/* @__PURE__ */ new Date()).toISOString()
).run().catch(() => {
}), "noterEnvoi");
async function pageEmails(env, url, message) {
  const cle = encodeURIComponent(env.CLE_TEST);
  const reglages = await chargerEmails(env);
  const ouvert = url.searchParams.get("modele");
  const [stats, journal] = await Promise.all([
    tous2(env.DB, `SELECT modele, statut, COUNT(*) AS n, MAX(quand) AS dernier
                   FROM emails_envoyes GROUP BY modele, statut`),
    tous2(env.DB, `SELECT modele, destinataire, objet, statut, message, quand
                   FROM emails_envoyes ORDER BY quand DESC LIMIT 60`)
  ]);
  const par = {};
  for (const s of stats) {
    const e = par[s.modele] = par[s.modele] || { envoye: 0, bloque: 0, echec: 0, dernier: null };
    if (s.statut === "envoy\xE9") e.envoye = s.n;
    else if (s.statut === "bloqu\xE9") e.bloque = s.n;
    else e.echec += s.n;
    if (!e.dernier || s.dernier > e.dernier) e.dernier = s.dernier;
  }
  const enPause = EMAILS.filter((m) => reglages[m.id]?.actif === 0);
  const modifies = EMAILS.filter((m) => reglages[m.id]?.objet || reglages[m.id]?.intro);
  if (ouvert) {
    const m = emailModele(ouvert);
    if (!m) return `<div class="alerte">Mod\xE8le inconnu.</div>`;
    const r = reglages[m.id] || {};
    const actif = r.actif !== 0;
    const envois = journal.filter((j) => j.modele === m.id).slice(0, 12);
    return `${message || ""}
      <section><div class="actions">
        <a class="bouton pale" href="?cle=${cle}&page=emails">\u2190 Tous les emails</a>
        <form method="POST" style="display:inline"
          action="?cle=${cle}&page=emails&modele=${m.id}&action=email_bascule">
          <button class="envoyer${actif ? " discret" : ""}" type="submit">
            ${actif ? "Mettre en pause" : "R\xE9activer"}</button></form>
      </div></section>

      <section><h2>Email</h2>
        <div class="titre-campagne">${echapper(m.nom)}</div>
        <div class="sec" style="margin:-2px 0 4px">${echapper(m.role)}</div>
        <div class="grille">
          ${carteHtml(
      "\xC9tat",
      actif ? "actif" : "en pause",
      m.auto ? "envoi automatique" : "envoi sur votre action",
      actif ? "bon" : "mauvais"
    )}
          ${carteHtml("D\xE9clencheur", echapper(m.quand), "")}
          ${carteHtml("Destinataire", echapper(m.vers), "")}
          ${carteHtml(
      "Envoy\xE9",
      String(par[m.id]?.envoye || 0),
      par[m.id]?.dernier ? `dernier ${dateFr2(par[m.id].dernier)}` : "jamais"
    )}
        </div>
      </section>

      <section><h2>Personnalisation</h2>
        <form class="f" method="POST" action="?cle=${cle}&page=emails&modele=${m.id}&action=email_modele">
          <label class="large">Objet du message
            <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--gris)">
              laissez vide pour garder celui d'origine</span>
            <input name="objet" value="${echapper(r.objet || "")}"
              placeholder="${echapper(m.objet)}"></label>
          ${m.intro ? `<label class="large">Texte d'accroche
            <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--gris)">
              la phrase d'ouverture du message</span>
            <textarea name="intro" style="min-height:110px"
              placeholder="${echapper(m.intro)}">${echapper(r.intro || "")}</textarea></label>` : ""}
          <button class="envoyer large" type="submit">Enregistrer</button>
        </form>
        <div class="note"><b>Variables disponibles :</b>
          ${m.variables.map((v) => `<code style="background:var(--surface2);padding:2px 7px;border-radius:4px;margin-right:5px">${echapper(v)}</code>`).join("")}
          <br>Elles sont remplac\xE9es \xE0 l'envoi. Une variable inconnue reste affich\xE9e telle quelle,
          pour que l'erreur se voie.</div>
        <div class="note">La mise en page du message n'est pas modifiable ici, et c'est d\xE9lib\xE9r\xE9 :
          une facture dont on peut casser le gabarit est une facture qu'on finit par casser.</div>
      </section>

      <section><h2>Derniers envois de ce mod\xE8le</h2>${tableauHtml(
      [{ nom: "Quand", classe: "nowrap" }, { nom: "Destinataire" }, { nom: "Objet" }, { nom: "R\xE9sultat" }],
      envois.map((j) => `<tr>
          <td class="nowrap">${dateFr2(j.quand)}</td>
          <td><span class="sec">${echapper(j.destinataire || "\u2014")}</span></td>
          <td>${echapper(j.objet || "\u2014")}</td>
          <td>${pastille(j.statut)}${j.message ? `<br><span class="sec">${echapper(j.message).slice(0, 70)}</span>` : ""}</td>
        </tr>`),
      "Aucun envoi enregistr\xE9 pour ce mod\xE8le."
    )}</section>`;
  }
  const ligne = /* @__PURE__ */ __name2((m) => {
    const r = reglages[m.id] || {};
    const actif = r.actif !== 0;
    const s = par[m.id] || {};
    return `<div class="tache${actif ? "" : " ok"}">
      <div class="corps">
        <a class="t" href="?cle=${cle}&page=emails&modele=${m.id}">${echapper(m.nom)}</a>
        <div class="d">${echapper(m.role)}</div>
        <div class="meta">
          <span class="prio ${actif ? m.auto ? "encours" : "basse" : "haute"}">${actif ? m.auto ? "automatique" : "sur action" : "en pause"}</span>
          <span>vers ${echapper(m.vers.toLowerCase())}</span>
          <span>${echapper(m.quand)}</span>
          ${s.envoye ? `<span>${s.envoye} envoi(s)</span>` : `<span>jamais envoy\xE9</span>`}
          ${s.echec ? `<span class="retard">${s.echec} \xE9chec(s)</span>` : ""}
          ${r.objet || r.intro ? `<span>\u25C6 personnalis\xE9</span>` : ""}
        </div>
      </div>
      <div class="outils">
        <form method="POST" action="?cle=${cle}&page=emails&modele=${m.id}&action=email_bascule">
          <button class="bouton pale" type="submit">${actif ? "Pause" : "Activer"}</button></form>
        <a class="bouton pale" href="?cle=${cle}&page=emails&modele=${m.id}">Ouvrir</a>
      </div></div>`;
  }, "ligne");
  const total = Object.values(par).reduce((t, s) => t + (s.envoye || 0), 0);
  const echecs = Object.values(par).reduce((t, s) => t + (s.echec || 0), 0);
  return `${message || ""}
    <section><div class="grille">
      ${carteHtml(
    "Emails du catalogue",
    String(EMAILS.length),
    `${EMAILS.filter((m) => m.auto).length} automatiques`
  )}
      ${carteHtml(
    "En pause",
    String(enPause.length),
    enPause.length ? "ils ne partent plus" : "tous actifs",
    enPause.length ? "moyen" : "bon"
  )}
      ${carteHtml("Personnalis\xE9s", String(modifies.length), "objet ou texte modifi\xE9")}
      ${carteHtml(
    "Envois enregistr\xE9s",
    String(total),
    echecs ? `${echecs} \xE9chec(s)` : "aucun \xE9chec",
    echecs ? "mauvais" : "neutre"
  )}
    </div></section>

    <section><h2>Envois automatiques</h2>
      <p class="sec" style="margin:-4px 0 0">Ils partent sans que vous fassiez quoi que ce soit.
        Les mettre en pause les arr\xEAte imm\xE9diatement.</p>
      <div class="taches">${EMAILS.filter((m) => m.auto).map(ligne).join("")}</div>
    </section>

    <section><h2>Envois d\xE9clench\xE9s par vous</h2>
      <p class="sec" style="margin:-4px 0 0">Ils ne partent que sur un clic de votre part.</p>
      <div class="taches">${EMAILS.filter((m) => !m.auto).map(ligne).join("")}</div>
    </section>

    <section><h2>Journal des envois</h2>${tableauHtml(
    [
      { nom: "Quand", classe: "nowrap" },
      { nom: "Email" },
      { nom: "Destinataire" },
      { nom: "Objet" },
      { nom: "R\xE9sultat" }
    ],
    journal.map((j) => `<tr>
        <td class="nowrap">${dateFr2(j.quand)}</td>
        <td>${echapper(emailModele(j.modele)?.nom || j.modele)}</td>
        <td><span class="sec">${echapper(j.destinataire || "\u2014")}</span></td>
        <td>${echapper(j.objet || "\u2014")}</td>
        <td>${pastille(j.statut)}</td></tr>`),
    "Aucun envoi enregistr\xE9. Le journal se remplit \xE0 partir de maintenant.",
    "tab-emails"
  )}</section>

    <div class="note">Le journal ne remonte pas dans le pass\xE9 : il n'enregistre que les envois
      post\xE9rieurs \xE0 sa mise en service. Les campagnes du blog ont leur propre historique,
      avec les taux d'ouverture, dans <a href="?cle=${cle}&page=newsletter">Newsletter du blog</a>.</div>`;
}
__name(pageEmails, "pageEmails");
__name2(pageEmails, "pageEmails");
async function application(env, url, request) {
  await chargerProfil(env);
  const quelle = url.searchParams.get("page") || "apercu";
  const def = PAGES.find((p) => p.id === quelle) || PAGES[0];
  const cle = encodeURIComponent(env.CLE_TEST);
  let message = "";
  if (request?.method === "POST") {
    const action = url.searchParams.get("action");
    const form = await request.formData();
    if (action && action.startsWith("radar_")) {
      await assurerRadarSchema(env.DB);
      const retour = /* @__PURE__ */ __name2((q) => Response.redirect(`${url.origin}/?cle=${cle}&page=radar${q}`, 303), "retour");
      if (action === "radar_collecter") {
        const debut = Date.now();
        try {
          const r = await executerRadar(env);
          if (r.bloque) return retour("&err=" + encodeURIComponent(r.bloque));
          const resume = radarResumeCollecte(r);
          await noterExecution(env.DB, "radar", Date.now() - debut, "ok", resume);
          return retour("&rcollect=" + encodeURIComponent(resume));
        } catch (e) {
          await noterExecution(env.DB, "radar", Date.now() - debut, "erreur", String(e.message || e).slice(0, 500));
          return retour("&err=" + encodeURIComponent(String(e.message || e)));
        }
      }
      if (action === "radar_recherche_stop") {
        const etat = radarEtatRecherche(await radarReglages(env.DB));
        if (etat && !etat.fin) await radarEcrireRecherche(env.DB, { ...etat, fin: (/* @__PURE__ */ new Date()).toISOString(), verrou: null, erreur: "arr\xEAt\xE9e par vous" });
        return retour("");
      }
      if (action === "radar_recherche") {
        const r = await radarDemarrerRecherche(env);
        return retour(r.erreur ? "&err=" + encodeURIComponent(r.erreur) : "&rrecherche=1");
      }
      if (action === "radar_supprimer") {
        const ids = form.getAll("ids").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200);
        if (!ids.length) return retour("&vue=contactes");
        const maintenant = (/* @__PURE__ */ new Date()).toISOString();
        const marques = ids.map(() => "?").join(",");
        await env.DB.prepare(`INSERT INTO radar_historique (prospect_id, ancien_statut, nouveau_statut, motif, quand)
          SELECT id, statut, 'supprim\xE9', 'supprim\xE9 depuis Contact\xE9s', ? FROM radar_prospects WHERE id IN (${marques})`).bind(maintenant, ...ids).run();
        await env.DB.prepare(`UPDATE radar_prospects SET statut='supprim\xE9', email_programme_le=NULL WHERE id IN (${marques})`).bind(...ids).run();
        return retour(`&vue=contactes&rsupp=${ids.length}`);
      }
      if (action === "radar_statut") {
        const pid = Number(url.searchParams.get("prospect"));
        const st = url.searchParams.get("statut") || "nouveau";
        if (!RADAR_STATUTS.includes(st)) return retour("&err=" + encodeURIComponent("Statut inconnu."));
        const p = await env.DB.prepare("SELECT statut FROM radar_prospects WHERE id = ?").bind(pid).first();
        const motif = (form.get("motif") || "").trim() || null;
        await env.DB.prepare("UPDATE radar_prospects SET statut=?, motif_rejet=? WHERE id=?").bind(st, motif, pid).run();
        await env.DB.prepare(`INSERT INTO radar_historique
          (prospect_id, ancien_statut, nouveau_statut, motif, quand) VALUES (?, ?, ?, ?, ?)`).bind(pid, p?.statut || null, st, motif, (/* @__PURE__ */ new Date()).toISOString()).run();
        const onglet = url.searchParams.get("onglet");
        if (onglet && /^[a-z_]+$/.test(onglet)) return retour("&vue=" + onglet + "&rstat=" + encodeURIComponent(st));
        return retour(RADAR_SORTIS.includes(st) ? "&rstat=" + encodeURIComponent(st) : "&prospect=" + pid + "&rstat=" + encodeURIComponent(st));
      }
      if (action === "radar_email_test") {
        const a = String(form.get("a") || "").trim();
        if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(a)) return retour("&vue=reglages&err=" + encodeURIComponent("Adresse de test invalide."));
        const reg = await radarReglages(env.DB);
        const modele = radarModeleEmail({ marque: String(form.get("boutique") || "").trim() || "Boutique Exemple" }, reg);
        try {
          await envoyerEmail(env, {
            de: env.SENDER_EMAIL,
            deNom: env.SENDER_NAME || "AdamEcom",
            a,
            objet: "[TEST] " + modele.objet,
            html: radarHtmlEmail(modele.corps),
            repondreA: { email: env.SENDER_EMAIL, name: env.SENDER_NAME || "AdamEcom" }
          });
        } catch (e) {
          await noterEnvoi(env, "radar_test", a, modele.objet, "\xE9chec", e.message);
          return retour("&vue=reglages&err=" + encodeURIComponent("Envoi impossible : " + String(e.message || e).slice(0, 200)));
        }
        await noterEnvoi(env, "radar_test", a, modele.objet, "envoy\xE9", null);
        return retour("&vue=reglages&remail=" + encodeURIComponent(a) + "&rtest=1");
      }
      if (action === "radar_email") {
        const pid = Number(url.searchParams.get("prospect"));
        const p = await env.DB.prepare("SELECT id, statut, marque FROM radar_prospects WHERE id = ?").bind(pid).first();
        const a = String(form.get("a") || "").trim();
        const objet = String(form.get("objet") || "").trim();
        const texte = String(form.get("message") || "").trim();
        if (!p) return retour("&err=" + encodeURIComponent("Prospect introuvable."));
        if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(a) || !objet || !texte) return retour("&err=" + encodeURIComponent("Destinataire, objet et message sont n\xE9cessaires."));
        try {
          await radarEnvoyerProspect(env, p, a, objet, texte, url.origin);
        } catch (e) {
          return retour("&err=" + encodeURIComponent("Envoi impossible : " + String(e.message || e).slice(0, 200)));
        }
        return retour("&remail=" + encodeURIComponent(a));
      }
      if (action === "radar_email_groupe") {
        const ids = form.getAll("ids").map(Number).filter(Boolean).slice(0, 100);
        if (!ids.length) return retour("&err=" + encodeURIComponent("Cochez au moins un prospect."));
        const maintenant = (/* @__PURE__ */ new Date()).toISOString();
        const r = await env.DB.prepare(`UPDATE radar_prospects SET email_programme_le=?, email_erreur=NULL
          WHERE id IN (${ids.map(() => "?").join(",")}) AND email_contact IS NOT NULL AND email_programme_le IS NULL
          AND statut NOT IN ('contact\xE9','r\xE9pondu','rdv','client','supprim\xE9')`).bind(maintenant, ...ids).run();
        await env.DB.prepare("INSERT OR REPLACE INTO radar_reglages (cle, valeur, maj_le) VALUES ('app_origine', ?, ?)").bind(url.origin, maintenant).run();
        return retour(`&vue=${encodeURIComponent(url.searchParams.get("vue") || "jour")}&rgroupe=${r.meta?.changes ?? ids.length}`);
      }
      if (action === "radar_motcle_ajout") {
        const mot = (form.get("mot") || "").trim().toLowerCase();
        const niche = (form.get("niche") || "").trim();
        if (!mot || !niche) return retour("&vue=reglages&err=" + encodeURIComponent("Mot-cl\xE9 et niche sont n\xE9cessaires."));
        await env.DB.prepare(`INSERT OR IGNORE INTO radar_motscles (mot, niche, actif, priorite)
          VALUES (?, ?, 1, ?)`).bind(mot, niche, form.get("priorite") === "haute" ? "haute" : "normale").run();
        return retour("&vue=reglages&rmot=1");
      }
      if (action === "radar_motcle_bascule") {
        await env.DB.prepare("UPDATE radar_motscles SET actif = 1 - actif WHERE id = ?").bind(Number(url.searchParams.get("mot"))).run();
        return retour("&vue=reglages");
      }
      if (action === "radar_motcle_suppr") {
        await env.DB.prepare("DELETE FROM radar_motscles WHERE id = ?").bind(Number(url.searchParams.get("mot"))).run();
        return retour("&vue=reglages&rmot=2");
      }
      if (action === "radar_reglages") {
        const maintenant = (/* @__PURE__ */ new Date()).toISOString();
        for (const [k, v] of form.entries()) {
          if (!/^[a-z_0-9]+$/.test(k)) continue;
          await env.DB.prepare("INSERT OR REPLACE INTO radar_reglages (cle, valeur, maj_le) VALUES (?, ?, ?)").bind(k, String(v), maintenant).run();
        }
        return retour("&vue=reglages&rreg=1");
      }
      return retour("");
    }
    if (action === "email_bascule" || action === "email_modele") {
      const id = url.searchParams.get("modele") || "";
      if (!emailModele(id)) {
        return Response.redirect(`${url.origin}/?cle=${cle}&page=emails`, 303);
      }
      const maintenant = (/* @__PURE__ */ new Date()).toISOString();
      if (action === "email_bascule") {
        await env.DB.prepare(
          `INSERT INTO emails_modeles (id, actif, maj_le) VALUES (?, 0, ?)
           ON CONFLICT(id) DO UPDATE SET actif = 1 - actif, maj_le = ?`
        ).bind(id, maintenant, maintenant).run();
        return Response.redirect(`${url.origin}/?cle=${cle}&page=emails&modele=${id}&ebasc=1`, 303);
      }
      const objet = (form.get("objet") || "").trim() || null;
      const intro = (form.get("intro") || "").trim() || null;
      await env.DB.prepare(
        `INSERT INTO emails_modeles (id, actif, objet, intro, maj_le) VALUES (?, 1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET objet = ?, intro = ?, maj_le = ?`
      ).bind(id, objet, intro, maintenant, objet, intro, maintenant).run();
      return Response.redirect(`${url.origin}/?cle=${cle}&page=emails&modele=${id}&emod=1`, 303);
    }
    if (action && action.startsWith("reglages_")) {
      const retour = /* @__PURE__ */ __name2((q) => Response.redirect(`${url.origin}/?cle=${cle}&page=reglages${q}`, 303), "retour");
      if (action === "reglages_motdepasse") {
        const r = await changerMotDePasse(env, form);
        return retour(r.erreur ? "&err=" + encodeURIComponent(r.erreur) : "&mdp=1");
      }
      const lots = {
        reglages_profil: [
          "profil_nom",
          "profil_activite",
          "profil_email",
          "profil_site",
          "profil_telephone",
          "profil_remerciement",
          "profil_mentions"
        ],
        reglages_logo: ["profil_logo"],
        reglages_banque: ["banque_"]
      };
      const prefixes = lots[action];
      if (!prefixes) return retour("");
      const n = await enregistrerReglages(env, form, prefixes);
      return retour(`&reg=${n}`);
    }
    if (action === "seo_blog") {
      const r = await seoAnalyserBlog(env);
      const q = r.erreur ? "&err=" + encodeURIComponent(r.erreur) : `&seoblog=${r.ok}&seoko=${r.ko}`;
      return Response.redirect(`${url.origin}/?cle=${cle}&page=blog${q}`, 303);
    }
    if (action === "seo_analyser" || action === "seo_motcle") {
      const dossier = String(url.searchParams.get("dossier") || "");
      if (action === "seo_motcle") {
        await env.DB.prepare("UPDATE blog_dossiers SET mot_cle=? WHERE id=?").bind((form.get("mot_cle") || "").trim() || null, dossier).run();
      }
      const r = await seoAnalyserDossier(env, dossier);
      const q = r.erreur ? "&err=" + encodeURIComponent(r.erreur) : "&seo=" + r.score + (r.pageAnalysee ? "" : "&seopart=1");
      return Response.redirect(`${url.origin}/?cle=${cle}&page=blog${q}&dossier=${encodeURIComponent(dossier)}`, 303);
    }
    if (action === "valider_blog") {
      await assurerBlogSchema(env.DB);
      const id = String(form.get("id") || "").trim();
      const revision = Number.parseInt(String(form.get("revision") || ""), 10);
      if (!/^ADAMSEO-\d{8}-\d{2}$/.test(id) || !Number.isInteger(revision) || revision < 1) {
        return Response.redirect(`${url.origin}/?cle=${cle}&page=blog&err=${encodeURIComponent("Dossier de blog invalide.")}`, 303);
      }
      const r = await env.DB.prepare(`UPDATE blog_dossiers
        SET statut='valide', message=?, maj_le=?
        WHERE id=? AND revision=? AND statut='pret_validation' AND html_ok=1 AND image_ok=1`).bind(
        "Valid\xE9 directement depuis l\u2019application AdamEcom. Publication Shopify autoris\xE9e.",
        (/* @__PURE__ */ new Date()).toISOString(),
        id,
        revision
      ).run();
      if (!r.meta.changes) {
        return Response.redirect(`${url.origin}/?cle=${cle}&page=blog&err=${encodeURIComponent("Ce dossier n\u2019est plus validable ou sa derni\xE8re version n\u2019est pas compl\xE8te.")}`, 303);
      }
      return Response.redirect(`${url.origin}/?cle=${cle}&page=blog&blogvalide=${encodeURIComponent(id)}&dossier=${encodeURIComponent(id)}`, 303);
    } else if (action === "rediger_blog") {
      const r = await blogNouveauDossier(env, { manuel: true });
      const q = r.erreur ? `&err=${encodeURIComponent(r.erreur)}` : `&blogredac=${encodeURIComponent(r.id)}&dossier=${encodeURIComponent(r.id)}`;
      return Response.redirect(`${url.origin}/?cle=${cle}&page=blog${q}`, 303);
    } else if (action === "relancer_blog" || action === "supprimer_blog") {
      const id = String(form.get("id") || "").trim();
      const r = !/^ADAMSEO-\d{8}-\d{2}$/.test(id) ? { erreur: "Dossier de blog invalide." } : action === "relancer_blog" ? await blogRelancer(env.DB, id) : await blogSupprimer(env.DB, id);
      const q = r.erreur ? `&err=${encodeURIComponent(r.erreur)}&dossier=${encodeURIComponent(id)}` : action === "relancer_blog" ? `&blogrelance=1&dossier=${encodeURIComponent(id)}` : "&blogsupp=1";
      return Response.redirect(`${url.origin}/?cle=${cle}&page=blog${q}`, 303);
    } else if (action === "recherche_gemini") {
      const r = await lancerRechercheGemini(env, form.get("sujet"));
      const q = r.erreur ? `&err=${encodeURIComponent(r.erreur)}` : `&geminiok=${encodeURIComponent(String(r.id))}`;
      return Response.redirect(`${url.origin}/?cle=${cle}&page=blog${q}`, 303);
    } else if (action === "accepter_prospect") {
      const r = await accepterProspect(env, String(form.get("uri") || ""));
      const q = r.erreur ? `&err=${encodeURIComponent(r.erreur)}` : "&prospectok=accepte";
      return Response.redirect(`${url.origin}/?cle=${cle}&page=prospects${q}`, 303);
    } else if (action === "refuser_prospect") {
      const r = await refuserProspect(env, String(form.get("uri") || ""));
      const q = r.erreur ? `&err=${encodeURIComponent(r.erreur)}` : "&prospectok=refuse";
      return Response.redirect(`${url.origin}/?cle=${cle}&page=prospects${q}`, 303);
    } else if (action === "proposer_creneau") {
      const r = await proposerCreneauProspect(env, String(form.get("uri") || ""), form);
      const q = r.erreur ? `&err=${encodeURIComponent(r.erreur)}` : "&prospectok=creneau";
      return Response.redirect(`${url.origin}/?cle=${cle}&page=prospects${q}`, 303);
    } else if (action === "enregistrer_client") {
      const r = await enregistrerClient(env, form);
      const q = r.erreur ? `&err=${encodeURIComponent(r.erreur)}` : `&clientok=${encodeURIComponent(r.nom || "Client")}${r.brevo ? "&brevo=1" : ""}`;
      return Response.redirect(`${url.origin}/?cle=${cle}&page=clients${q}`, 303);
    } else if (action && action.endsWith("_contrat")) {
      const n = Number(url.searchParams.get("devis") || form.get("devis"));
      const retour = /* @__PURE__ */ __name2((q) => Response.redirect(`${url.origin}/?cle=${cle}&page=contrats${q}`, 303), "retour");
      const err = /* @__PURE__ */ __name2((e) => "&err=" + encodeURIComponent(e), "err");
      const fiche = `&devis=${n}`;
      let r;
      if (action === "creer_contrat") {
        r = await creerContrat(env, n);
        return retour(r.erreur ? err(r.erreur) : `${fiche}&ccree=1`);
      }
      if (action === "modifier_contrat") r = await modifierContrat(env, n, form);
      else if (action === "signer_contrat") r = await signerContratPresta(env, n, form);
      else if (action === "envoyer_contrat") r = await envoyerContrat(env, n, url.origin);
      else if (action === "supprimer_contrat") {
        await assurerContratsSchema(env.DB);
        await env.DB.prepare("DELETE FROM contrats WHERE devis_numero=?").bind(n).run();
        return retour("&csupp=1");
      } else return retour("");
      if (r.erreur) return retour(fiche + err(r.erreur));
      const ok = { modifier_contrat: "cmaj", signer_contrat: "csigne", envoyer_contrat: "cenvoye" }[action];
      return retour(`${fiche}&${ok}=${encodeURIComponent(r.email || "1")}`);
    } else if (action && action.endsWith("_devis")) {
      const n = Number(url.searchParams.get("numero"));
      const retour = /* @__PURE__ */ __name2((q) => Response.redirect(`${url.origin}/?cle=${cle}&page=devis${q}`, 303), "retour");
      const err = /* @__PURE__ */ __name2((e) => "&err=" + encodeURIComponent(e), "err");
      if (action === "creer_devis") {
        const r = await creerDevis(env, form);
        if (r.erreur) return retour(`&numero=nouveau${err(r.erreur)}`);
        return retour(`&numero=${r.numero}&dcree=1`);
      }
      if (action === "modifier_devis") {
        const r = await modifierDevis(env, n, form);
        return retour(`&numero=${n}${r.erreur ? `&edit=1${err(r.erreur)}` : "&dmaj=1"}`);
      }
      if (action === "envoyer_devis") {
        const r = await envoyerDevis(env, n, url.origin);
        return retour(`&numero=${n}${r.erreur ? err(r.erreur) : "&denvoye=" + encodeURIComponent(r.email)}`);
      }
      if (action === "statut_devis") {
        const st = url.searchParams.get("statut") || "";
        const r = await statutDevis(env, n, st);
        return retour(`&numero=${n}${r.erreur ? err(r.erreur) : "&dstat=" + encodeURIComponent(st)}`);
      }
      if (action === "facturer_devis") {
        const r = await facturerDevis(env, n);
        if (r.erreur) return retour(`&numero=${n}${err(r.erreur)}`);
        return Response.redirect(`${url.origin}/?cle=${cle}&page=facture&numero=${r.numero}&cree=1`, 303);
      }
      if (action === "supprimer_devis") {
        const r = await supprimerDevis(env, n);
        return retour(r.erreur ? `&numero=${n}${err(r.erreur)}` : "&dsupp=1");
      }
      return retour("");
    } else if (action === "creer") {
      const r = await creerFacture(env, form);
      if (r.erreur) message = `<div class="alerte">${echapper(r.erreur)}</div>`;
      else return Response.redirect(`${url.origin}/?cle=${cle}&page=facture&numero=${r.numero}&cree=1`, 303);
    } else if (action === "modifier_facture") {
      const n = Number(url.searchParams.get("numero"));
      const r = await modifierFacture(env, n, form);
      const q = r.erreur ? `&edit=1&err=${encodeURIComponent(r.erreur)}` : "&maj=1";
      return Response.redirect(`${url.origin}/?cle=${cle}&page=facture&numero=${n}${q}`, 303);
    } else if (action === "annuler_facture") {
      const n = Number(url.searchParams.get("numero"));
      const r = await annulerFacture(env, n, form.get("motif"), form.get("prevenir") === "1");
      const q = r.erreur ? `&err=${encodeURIComponent(r.erreur)}` : r.avertissement ? `&av=${encodeURIComponent(r.avertissement)}` : `&annul=${r.prevenu ? "prevenu" : "1"}`;
      return Response.redirect(`${url.origin}/?cle=${cle}&page=facture&numero=${n}${q}`, 303);
    } else if (action === "modifier_meeting") {
      const i = Number(url.searchParams.get("id"));
      const r = await modifierMeeting(env, i, form);
      const q = r.erreur ? `&edit=1&err=${encodeURIComponent(r.erreur)}` : r.avertissement ? `&av=${encodeURIComponent(r.avertissement)}` : `&maj=${r.google ? "google" : "1"}`;
      return Response.redirect(`${url.origin}/?cle=${cle}&page=meeting&id=${i}${q}`, 303);
    } else if (action === "annuler_meeting") {
      const i = Number(url.searchParams.get("id"));
      const r = await annulerMeeting(env, i, form.get("prevenir") === "1");
      const q = r.erreur ? `&err=${encodeURIComponent(r.erreur)}` : r.avertissement ? `&av=${encodeURIComponent(r.avertissement)}` : "&annul=1";
      return Response.redirect(`${url.origin}/?cle=${cle}&page=meeting&id=${i}${q}`, 303);
    } else if (action === "supprimer_meeting") {
      const r = await supprimerMeeting(env, Number(url.searchParams.get("id")));
      const q = r.erreur ? `&err=${encodeURIComponent(r.erreur)}` : "&supp=1";
      return Response.redirect(`${url.origin}/?cle=${cle}&page=meeting${q}`, 303);
    } else if (action === "creer_tache") {
      const r = await creerTache(env, form);
      const q = r.erreur ? `&err=${encodeURIComponent(r.erreur)}` : "&tache=1";
      return Response.redirect(`${url.origin}/?cle=${cle}&page=taches${q}`, 303);
    } else if (action === "modifier_tache") {
      const i = Number(url.searchParams.get("id"));
      const r = await modifierTache(env, i, form);
      const q = r.erreur ? `&id=${i}&err=${encodeURIComponent(r.erreur)}` : `&id=${i}&tmaj=1`;
      return Response.redirect(`${url.origin}/?cle=${cle}&page=taches${q}`, 303);
    } else if (action === "basculer_tache") {
      const i = Number(url.searchParams.get("id"));
      const r = await basculerTache(env, i);
      const ou = url.searchParams.get("retour") === "fiche" ? `&id=${i}` : "";
      const q = r.erreur ? `&err=${encodeURIComponent(r.erreur)}` : "";
      return Response.redirect(`${url.origin}/?cle=${cle}&page=taches${ou}${q}`, 303);
    } else if (action === "supprimer_tache") {
      const r = await supprimerTache(env, Number(url.searchParams.get("id")));
      const q = r.erreur ? `&err=${encodeURIComponent(r.erreur)}` : "&tsupp=1";
      return Response.redirect(`${url.origin}/?cle=${cle}&page=taches${q}`, 303);
    } else if (action === "purger_taches") {
      const r = await purgerTerminees(env);
      return Response.redirect(`${url.origin}/?cle=${cle}&page=taches&tpurge=${r.nb}`, 303);
    } else if (action === "nl_ignorer" || action === "nl_envoyer") {
      const r = await newsletterDecision(env, action === "nl_envoyer", form.getAll("guid").map(String).slice(0, 200));
      const q = r.erreur ? `&err=${encodeURIComponent(r.erreur)}` : `&nl=${action === "nl_envoyer" ? "envoi" : "ignore"}&n=${r.n}`;
      return Response.redirect(`${url.origin}/?cle=${cle}&page=newsletter${q}`, 303);
    } else if (action === "export_contacts") {
      const camp = url.searchParams.get("campagne");
      const type = url.searchParams.get("type");
      const r = await demanderExport(env, camp, type);
      if (r.ok) await avancerExport(env, camp, type).catch(() => {
      });
      const q = r.erreur ? `&err=${encodeURIComponent(r.erreur)}` : "&exp=1";
      return Response.redirect(
        `${url.origin}/?cle=${cle}&page=newsletter&campagne=${encodeURIComponent(camp)}${q}`,
        303
      );
    } else if (action === "google_ids") {
      const id = (form.get("client_id") || "").trim();
      const secret = (form.get("client_secret") || "").trim();
      if (id) await ecrireReglage(env.DB, "google_client_id", id);
      if (secret) await ecrireReglage(env.DB, "google_client_secret", secret);
      return Response.redirect(`${url.origin}/?cle=${cle}&page=google&ids=1`, 303);
    } else if (action === "google_test") {
      const r = await testerConnexion(env);
      const q = r.erreur ? `&err=${encodeURIComponent(r.erreur)}` : `&gtest=${encodeURIComponent(`${r.agenda} \xB7 ${r.fuseau}`)}`;
      return Response.redirect(`${url.origin}/?cle=${cle}&page=google${q}`, 303);
    } else if (action === "google_seo_selection") {
      const site = String(form.get("site_search_console") || "").trim();
      const propriete = String(form.get("propriete_analytics") || "").trim();
      const seo = await diagnosticSeoGoogle(env);
      if (site && !seo.sites.some((s) => s.url === site)) {
        return Response.redirect(`${url.origin}/?cle=${cle}&page=google&err=${encodeURIComponent("Site Search Console invalide.")}`, 303);
      }
      if (propriete && !seo.proprietes.some((p) => p.id === propriete)) {
        return Response.redirect(`${url.origin}/?cle=${cle}&page=google&err=${encodeURIComponent("Propri\xE9t\xE9 Analytics invalide.")}`, 303);
      }
      if (site) await ecrireReglage(env.DB, "google_search_console_site", site);
      if (propriete) await ecrireReglage(env.DB, "google_analytics_property", propriete);
      return Response.redirect(`${url.origin}/?cle=${cle}&page=google&seook=1`, 303);
    } else if (action === "google_deconnexion") {
      for (const k of ["google_refresh_token", "google_compte", "google_connecte_le", "google_scopes"]) {
        await supprimerReglage(env.DB, k);
      }
      return Response.redirect(`${url.origin}/?cle=${cle}&page=google&deco=1`, 303);
    } else if (action === "meeting_now") {
      const r = await meetingInstantane(env, form);
      if (r.erreur) message = `<div class="alerte">${echapper(r.erreur)}</div>`;
      else {
        const q = r.avertissement ? `&av=${encodeURIComponent(r.avertissement)}` : "&now=1";
        return Response.redirect(`${url.origin}/?cle=${cle}&page=meeting&id=${r.id}${q}`, 303);
      }
    } else if (action === "creer_meeting") {
      const r = await creerMeeting(env, form);
      if (r.erreur) message = `<div class="alerte">${echapper(r.erreur)}</div>`;
      else {
        const q = r.avertissement ? `&av=${encodeURIComponent(r.avertissement)}` : r.google ? "&cree=1&g=1" : "&cree=1";
        return Response.redirect(`${url.origin}/?cle=${cle}&page=meeting&id=${r.id}${q}`, 303);
      }
    } else if (action === "envoyer_meeting") {
      const r = await envoyerInvitation(env, Number(url.searchParams.get("id")));
      const q = r.erreur ? `&err=${encodeURIComponent(r.erreur)}` : "&envoye=1";
      return Response.redirect(`${url.origin}/?cle=${cle}&page=meeting&id=${url.searchParams.get("id")}${q}`, 303);
    } else if (action === "payee") {
      const r = await marquerPayee(env, Number(url.searchParams.get("numero")));
      let q = r.erreur ? `&err=${encodeURIComponent(r.erreur)}` : `&paye=${encodeURIComponent(r.commande)}`;
      if (!r.erreur) {
        const c = await envoyerConfirmationPaiement(env, Number(url.searchParams.get("numero")), url.origin);
        q += c.ok ? `&pmail=${encodeURIComponent(c.email)}` : c.pause ? "&pmail=pause" : `&pmailerr=${encodeURIComponent(c.erreur)}`;
      }
      return Response.redirect(`${url.origin}/?cle=${cle}&page=facture&numero=${url.searchParams.get("numero")}${q}`, 303);
    } else if (action === "envoyer") {
      const r = await envoyerFacture(env, Number(url.searchParams.get("numero")), url.origin);
      const q = r.erreur ? `&err=${encodeURIComponent(r.erreur)}` : "&envoye=1";
      return Response.redirect(`${url.origin}/?cle=${cle}&page=facture&numero=${url.searchParams.get("numero")}${q}`, 303);
    }
  }
  const aVerifier = url.searchParams.get("verifier");
  if (aVerifier && url.searchParams.get("campagne")) {
    const r = await avancerExport(env, url.searchParams.get("campagne"), aVerifier);
    const q = r.erreur ? `&err=${encodeURIComponent(r.erreur)}` : r.enCours ? "&attente=1" : "&exp=1";
    return Response.redirect(
      `${url.origin}/?cle=${cle}&page=newsletter&campagne=${encodeURIComponent(url.searchParams.get("campagne"))}${q}`,
      303
    );
  }
  if (url.searchParams.get("action") === "google_connexion") {
    const r = await debutAutorisation(env, url.origin);
    if (r.url) return Response.redirect(r.url, 302);
    message = `<div class="alerte">${echapper(r.erreur)}</div>`;
  }
  const surMeeting = quelle === "meeting";
  if (url.searchParams.get("g")) message = `<div class="reussite">Rendez-vous cr\xE9\xE9. <b>Google a g\xE9n\xE9r\xE9 le lien Meet</b> et l'\xE9v\xE9nement est dans votre agenda.</div>`;
  else if (url.searchParams.get("cree")) message = surMeeting ? `<div class="reussite">Invitation cr\xE9\xE9e. V\xE9rifiez l'aper\xE7u, puis envoyez-la.</div>` : `<div class="reussite">Facture cr\xE9\xE9e. V\xE9rifiez l'aper\xE7u, puis envoyez-la.</div>`;
  if (url.searchParams.get("envoye")) message = surMeeting ? `<div class="reussite">Invitation envoy\xE9e, avec le fichier calendrier en pi\xE8ce jointe.</div>` : `<div class="reussite">Facture envoy\xE9e au client.</div>`;
  if (url.searchParams.get("ids")) message = `<div class="reussite">Identifiants Google enregistr\xE9s. Passez \xE0 l'\xE9tape 3.</div>`;
  const gt = url.searchParams.get("gtest");
  if (gt) message = `<div class="reussite">Connexion v\xE9rifi\xE9e \u2014 agenda <b>${echapper(gt)}</b>. Les rendez-vous auront leur lien Meet automatiquement.</div>`;
  if (url.searchParams.get("deco")) message = `<div class="reussite">Agenda Google d\xE9connect\xE9.</div>`;
  if (url.searchParams.get("gok")) message = `<div class="reussite">Agenda Google connect\xE9. Les prochains rendez-vous auront leur lien Meet automatiquement.</div>`;
  if (url.searchParams.get("seook")) message = `<div class="reussite">Propri\xE9t\xE9s Search Console et Analytics enregistr\xE9es.</div>`;
  const prospectOk = url.searchParams.get("prospectok");
  if (prospectOk) message = `<div class="reussite">${prospectOk === "accepte" ? "Prospect accept\xE9 : Google Meet cr\xE9\xE9 et invitation envoy\xE9e." : prospectOk === "refuse" ? "Prospect marqu\xE9 comme refus\xE9." : "Proposition de nouveau cr\xE9neau envoy\xE9e par email."}</div>`;
  const clientOk = url.searchParams.get("clientok");
  if (clientOk) message = `<div class="reussite"><b>${echapper(clientOk)}</b> a \xE9t\xE9 enregistr\xE9 directement dans Shopify.${url.searchParams.get("brevo") ? " Le contact est aussi synchronis\xE9 avec Brevo." : ""}</div>`;
  const av = url.searchParams.get("av");
  if (av) message = `<div class="alerte">${echapper(av)}</div>`;
  if (url.searchParams.get("now")) message = `<div class="reussite"><b>Rendez-vous lanc\xE9.</b> L'invitation est partie \u2014 utilisez le bouton \xAB Ouvrir la visio \xBB ci-dessous pour rejoindre.</div>`;
  const maj = url.searchParams.get("maj");
  if (maj) message = maj === "google" ? `<div class="reussite">Modifications enregistr\xE9es, et l'\xE9v\xE9nement mis \xE0 jour dans votre agenda Google.</div>` : `<div class="reussite">Modifications enregistr\xE9es.</div>`;
  const annul = url.searchParams.get("annul");
  if (annul) message = annul === "prevenu" ? `<div class="reussite">Facture annul\xE9e. Le client a \xE9t\xE9 pr\xE9venu par email.</div>` : `<div class="reussite">${surMeeting ? "Rendez-vous annul\xE9." : "Facture annul\xE9e. Elle conserve son num\xE9ro."}</div>`;
  if (url.searchParams.get("supp")) message = `<div class="reussite">Rendez-vous supprim\xE9.</div>`;
  const blogValide = url.searchParams.get("blogvalide");
  if (blogValide) message = `<div class="reussite"><b>${echapper(blogValide)}</b> est valid\xE9. L'application le publie sur Shopify dans la minute : rafra\xEEchissez la page pour voir le lien de l'article.</div>`;
  if (url.searchParams.get("blogredac")) message = `<div class="reussite">R\xE9daction lanc\xE9e. Gemini \xE9crit l'article puis cr\xE9e l'image : comptez quelques minutes, puis rafra\xEEchissez la page.</div>`;
  if (url.searchParams.get("blogrelance")) message = `<div class="reussite">Dossier relanc\xE9.</div>`;
  if (url.searchParams.get("blogsupp")) message = `<div class="reussite">Dossier supprim\xE9.</div>`;
  const geminiOk = url.searchParams.get("geminiok");
  if (geminiOk) message = `<div class="reussite">Recherche Gemini termin\xE9e. Le nouveau brief SEO public est disponible ci-dessous.</div>`;
  const paye = url.searchParams.get("paye");
  if (paye) {
    const pmail = url.searchParams.get("pmail"), pmailerr = url.searchParams.get("pmailerr");
    const suite = pmail === "pause" ? " L'email de confirmation est en pause (Emails automatiques)." : pmail ? ` Confirmation de paiement envoy\xE9e \xE0 <b>${echapper(pmail)}</b>.` : pmailerr ? ` <span class="err">L'email de confirmation n'a pas pu partir : ${echapper(pmailerr)}</span>` : "";
    message = `<div class="reussite">Facture encaiss\xE9e. Commande <b>${echapper(paye)}</b> cr\xE9\xE9e dans Shopify.${suite}</div>`;
  }
  if (url.searchParams.get("ebasc")) message = `<div class="reussite">\xC9tat de l'email modifi\xE9.</div>`;
  if (url.searchParams.get("emod")) message = `<div class="reussite">Mod\xE8le enregistr\xE9.</div>`;
  const reg = url.searchParams.get("reg");
  if (reg) message = `<div class="reussite">${echapper(reg)} r\xE9glage(s) enregistr\xE9(s).</div>`;
  if (url.searchParams.get("mdp")) message = `<div class="reussite">Mot de passe chang\xE9. Votre session reste ouverte.</div>`;
  const seoB = url.searchParams.get("seoblog");
  if (seoB) message = `<div class="reussite">${echapper(seoB)} article(s) analys\xE9(s).${Number(url.searchParams.get("seoko")) ? ` ${echapper(url.searchParams.get("seoko"))} en \xE9chec.` : ""}</div>`;
  const seoN = url.searchParams.get("seo");
  if (seoN) message = `<div class="reussite">Analyse SEO termin\xE9e \u2014 <b>${echapper(seoN)}/100</b>.${url.searchParams.get("seopart") ? " La page publi\xE9e n'a pas pu \xEAtre charg\xE9e : les contr\xF4les techniques sont incomplets." : ""}</div>`;
  const rstat = url.searchParams.get("rstat");
  const remail = url.searchParams.get("remail");
  const rgroupe = url.searchParams.get("rgroupe");
  if (rgroupe !== null) message = `<div class="reussite"><b>${Number(rgroupe) || 0} email(s)</b> programm\xE9(s). Ils partent ${RADAR_ENVOIS_PAR_MINUTE} par minute avec votre mod\xE8le, chaque boutique passe ensuite dans \xAB Contact\xE9s \xBB.</div>`;
  if (remail) message = url.searchParams.get("rtest") ? `<div class="reussite">Email de test envoy\xE9 \xE0 <b>${echapper(remail)}</b>.</div>` : `<div class="reussite">Email envoy\xE9 \xE0 <b>${echapper(remail)}</b>. Le prospect est marqu\xE9 contact\xE9.</div>`;
  if (rstat) message = `<div class="reussite">Prospect marqu\xE9 <b>${echapper(rstat)}</b>.${RADAR_SORTIS.includes(rstat) ? " Il ne r\xE9appara\xEEtra plus dans le Top 10." : ""}</div>`;
  if (url.searchParams.get("rmot") === "1") message = `<div class="reussite">Mot-cl\xE9 ajout\xE9.</div>`;
  if (url.searchParams.get("rmot") === "2") message = `<div class="reussite">Mot-cl\xE9 supprim\xE9.</div>`;
  if (url.searchParams.get("rreg")) message = `<div class="reussite">R\xE9glages enregistr\xE9s.</div>`;
  const rcollect = url.searchParams.get("rcollect");
  if (url.searchParams.get("rsupp")) message = `<div class="reussite">${Number(url.searchParams.get("rsupp")) || 0} boutique(s) supprim\xE9e(s). Le Radar ne les reproposera pas.</div>`;
  if (rcollect) message = `<div class="reussite"><b>Collecte Prospect Radar termin\xE9e.</b> ${echapper(rcollect)}</div>`;
  if (url.searchParams.get("rrecherche")) message = `<div class="reussite"><b>Recherche lanc\xE9e.</b> Le radar cherche les prospects du jour, ils s'ajoutent ici au fur et \xE0 mesure (quelques minutes).</div>`;
  if (url.searchParams.get("tache")) message = `<div class="reussite">T\xE2che ajout\xE9e.</div>`;
  if (url.searchParams.get("tmaj")) message = `<div class="reussite">T\xE2che modifi\xE9e.</div>`;
  if (url.searchParams.get("tsupp")) message = `<div class="reussite">T\xE2che supprim\xE9e.</div>`;
  const tp = url.searchParams.get("tpurge");
  if (tp) message = `<div class="reussite">${echapper(tp)} t\xE2che(s) termin\xE9e(s) supprim\xE9e(s).</div>`;
  if (url.searchParams.get("nl")) message = url.searchParams.get("nl") === "envoi" ? `<div class="reussite">Envoi lanc\xE9 : ${SES_PAR_MINUTE} contacts par minute. Suivez-le dans \xAB Envois Amazon SES \xBB.</div>` : `<div class="reussite">${Number(url.searchParams.get("n")) || 0} article(s) retir\xE9(s) de la file. Ils ne partiront pas.</div>`;
  if (url.searchParams.get("exp")) message = `<div class="reussite">Liste r\xE9cup\xE9r\xE9e aupr\xE8s de Brevo.</div>`;
  if (url.searchParams.get("attente")) message = `<div class="note">Brevo pr\xE9pare encore le fichier.
    Patientez quelques secondes et cliquez de nouveau sur \xAB V\xE9rifier maintenant \xBB.</div>`;
  if (url.searchParams.get("dcree")) message = `<div class="reussite">Devis g\xE9n\xE9r\xE9. V\xE9rifiez l'aper\xE7u, puis envoyez-le ou t\xE9l\xE9chargez-le en PDF.</div>`;
  if (url.searchParams.get("dmaj")) message = `<div class="reussite">Devis mis \xE0 jour.</div>`;
  const denv = url.searchParams.get("denvoye");
  if (denv) message = `<div class="reussite">Devis envoy\xE9 \xE0 <b>${echapper(denv)}</b>.</div>`;
  const dstat = url.searchParams.get("dstat");
  if (dstat) message = `<div class="reussite">Devis marqu\xE9 <b>${echapper(dstat)}</b>.</div>`;
  if (url.searchParams.get("dsupp")) message = `<div class="reussite">Devis supprim\xE9.</div>`;
  if (url.searchParams.get("ccree")) message = `<div class="reussite">Contrat g\xE9n\xE9r\xE9 \xE0 partir du devis. Relisez-le, signez-le, puis envoyez-le au client.</div>`;
  if (url.searchParams.get("cmaj")) message = `<div class="reussite">Clauses enregistr\xE9es.</div>`;
  if (url.searchParams.get("csigne")) message = `<div class="reussite">Votre signature est enregistr\xE9e sur le contrat.</div>`;
  const cenv = url.searchParams.get("cenvoye");
  if (cenv) message = `<div class="reussite">Contrat envoy\xE9 \xE0 <b>${echapper(cenv)}</b> pour signature.</div>`;
  if (url.searchParams.get("csupp")) message = `<div class="reussite">Contrat supprim\xE9.</div>`;
  const err = url.searchParams.get("err");
  if (err) message = `<div class="alerte">${echapper(err)}</div>`;
  let contenu;
  try {
    contenu = def.id === "facture" ? await pageFacture(env, url, message) : def.id === "contrats" ? await pageContrats(env, url, message) : def.id === "devis" ? await pageDevis(env, url, message) : def.id === "meeting" ? await pageMeeting(env, url, message) : def.id === "google" ? await pageGoogle(env, url, message) : def.id === "analytics" ? await pageAnalytics(env, url) : def.id === "taches" ? await pageTaches(env, url, message, await clientsShopify(env), { carteHtml, dateFr: dateFr2 }) : def.id === "newsletter" ? await pageNewsletter(env, url, message) : def.id === "emails" ? await pageEmails(env, url, message) : def.id === "reglages" ? await pageReglages(env, url, message) : def.id === "radar" ? await pageRadar(env, url, message) : def.id === "blog" ? await pageBlog(env, url, message) : def.id === "prospects" ? await pageProspects(env, message) : def.id === "clients" ? await pageClients(env, url, message) : await {
      apercu: pageApercu,
      facturation: pageFacturation,
      journal: pageJournal
    }[def.id](env);
  } catch (e) {
    contenu = `<div class="note"><b>Cette page n'a pas pu \xEAtre construite.</b><br>
      <span class="sec">${echapper(e.message)}</span></div>`;
  }
  return new Response(page(env, def.id, def.nom, contenu), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
}
__name(application, "application");
__name2(application, "application");
__name22(application, "application");
async function lancer(nom, tache, env) {
  const debut = Date.now();
  try {
    const resultat = await tache(env);
    if (resultat?.bloque) throw new Error(resultat.bloque);
    const message = nom === "radar" ? radarResumeCollecte(resultat) : null;
    console.log(`\u2713 ${nom} \u2014 ${Date.now() - debut} ms`);
    await noterExecution(env.DB, nom, Date.now() - debut, "ok", message);
  } catch (e) {
    console.error(`\u2717 ${nom} \u2014 ${e.message}`);
    await noterExecution(env.DB, nom, Date.now() - debut, "erreur", e.message);
  }
}
__name(lancer, "lancer");
__name2(lancer, "lancer");
__name22(lancer, "lancer");
var index_default = {
  async scheduled(event, env, ctx) {
    if (event.cron === "*/15 * * * *") {
      ctx.waitUntil(Promise.all([
        lancer("newsletter", executer2, env),
        radarModeAuto(env.DB).then((auto) => auto ? lancer("radar", executerRadar, env) : null)
      ]));
    } else {
      ctx.waitUntil(Promise.all([lancer("calendly", executer, env), smtpTestEnAttente(env), radarEnvoisProgrammes(env), radarContactsEnAttente(env), radarQualiteEnAttente(env), radarRechercheEtape(env), newsletterSesEtape(env), sesTestEnAttente(env), blogRedactionEtape(env)]));
    }
  },
  // Déclenchement manuel, pratique pour tester sans attendre la planification.
  //   curl "https://<worker>.workers.dev/?tache=calendly&cle=<CLE_TEST>"
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/google/retour") {
      const code = url.searchParams.get("code");
      const refus = url.searchParams.get("error");
      const base = `${url.origin}/?cle=${encodeURIComponent(env.CLE_TEST)}&page=google`;
      if (refus) return Response.redirect(`${base}&err=${encodeURIComponent("Autorisation refus\xE9e : " + refus)}`, 302);
      if (!code) return Response.redirect(`${base}&err=${encodeURIComponent("Code d'autorisation absent.")}`, 302);
      const r = await finAutorisation(env, code, url.origin);
      return Response.redirect(r.ok ? `${base}&gok=1` : `${base}&err=${encodeURIComponent(r.erreur)}`, 302);
    }
    if (url.pathname === "/desabo") return pageDesabo(env, request, url);
    if (url.pathname.startsWith("/blog-image/")) return pageImageBlog(env, url);
    if (url.pathname.startsWith("/r/")) {
      const r = await radarSuiviEmail(env, url);
      if (r) return r;
    }
    if (url.pathname.startsWith("/f/")) {
      const f = await lireFactureParJeton(env.DB, url.pathname.slice(3));
      if (!f) return new Response("Facture introuvable", { status: 404 });
      await chargerProfil(env);
      return new Response(gabaritFacture(f, env), {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
      });
    }
    if (url.pathname.startsWith("/c/")) {
      await assurerContratsSchema(env.DB);
      const jeton = url.pathname.slice(3);
      let c = await lireContratParJeton(env.DB, jeton);
      if (!c) return new Response("Contrat introuvable", { status: 404 });
      let erreur = null;
      if (request.method === "POST") {
        const r = await signerContratClient(env, jeton, await request.formData(), request.headers.get("cf-connecting-ip"));
        if (!r.erreur) return Response.redirect(`${url.origin}/c/${jeton}?merci=1`, 303);
        erreur = r.erreur;
        c = await lireContratParJeton(env.DB, jeton);
      }
      const d = await lireDevis(env.DB, c.devis_numero);
      if (!d) return new Response("Devis introuvable", { status: 404 });
      await chargerProfil(env);
      return new Response(gabaritContrat(c, d, env, { public: !url.searchParams.get("apercu"), erreur, merci: !!url.searchParams.get("merci") }), {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
      });
    }
    if (url.pathname === "/logo-devis") {
      const p = await chargerProfil(env);
      const src = /^https?:/.test(p.profil_logo || "") ? p.profil_logo : LOGO;
      const r = await fetch(src).catch(() => null);
      if (!r || !r.ok) return new Response("Logo introuvable", { status: 404 });
      return new Response(r.body, {
        headers: { "content-type": r.headers.get("content-type") || "image/png", "cache-control": "public, max-age=86400" }
      });
    }
    if (url.pathname.startsWith("/d/")) {
      await assurerDevisSchema(env.DB);
      const d = await lireDevisParJeton(env.DB, url.pathname.slice(3));
      if (!d) return new Response("Devis introuvable", { status: 404 });
      await chargerProfil(env);
      return new Response(gabaritDevis(d, env), {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
      });
    }
    if (url.pathname === "/connexion") {
      if (request.method === "POST") {
        try {
          return await authTraiter(request, env, url);
        } catch (e) {
          return Response.redirect(
            `${url.origin}/connexion?err=${encodeURIComponent("\xC9chec technique : " + e.message)}`,
            303
          );
        }
      }
      url.autoriseSetup = await authJetonValide(env.DB, url.searchParams.get("setup"));
      const compte2 = await authCompte(env.DB);
      if (compte2 && await authSession(request, env)) return Response.redirect(`${url.origin}/`, 303);
      return new Response(authFormulaire(env, url, compte2, null), {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
      });
    }
    if (url.pathname === "/deconnexion") return authDeconnexion(url);
    const connecte = await authSession(request, env);
    const parCle = env.CLE_TEST && url.searchParams.get("cle") === env.CLE_TEST;
    if (!connecte && !parCle) {
      const compte3 = await authCompte(env.DB);
      if (compte3) return Response.redirect(`${url.origin}/connexion`, 303);
      return new Response("Non autoris\xE9", { status: 401 });
    }
    if (url.pathname === "/api/blog") return apiBlog(env, request);
    if (url.pathname === "/api/newsletter/status") {
      const diagnostic = await diagnosticNewsletter(env);
      return new Response(JSON.stringify(diagnostic), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
      });
    }
    if (url.pathname === "/" || url.pathname === "/tableau") return application(env, url, request);
    const quelle = url.searchParams.get("tache");
    const lignes = [];
    const origine = console.log;
    console.log = (...a) => {
      lignes.push(a.join(" "));
      origine(...a);
    };
    try {
      if (quelle === "newsletter") await executer2(env);
      else if (quelle === "calendly") await executer(env);
      else return new Response("Param\xE8tre tache= : calendly ou newsletter", { status: 400 });
      return new Response(lignes.join("\n") || "(aucune sortie)", {
        headers: { "content-type": "text/plain; charset=utf-8" }
      });
    } catch (e) {
      return new Response(`${lignes.join("\n")}
\u2717 ${e.message}`, {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" }
      });
    } finally {
      console.log = origine;
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=adamecom-worker-index.js.map
