CREATE TABLE amorcage (
  domaine TEXT PRIMARY KEY,
  fait_le TEXT NOT NULL
);

CREATE TABLE app_comptes (
  email        TEXT PRIMARY KEY,
  empreinte    TEXT NOT NULL,
  sel          TEXT NOT NULL,
  iterations   INTEGER NOT NULL,
  cree_le      TEXT NOT NULL,
  derniere_connexion TEXT
);

CREATE TABLE app_connexions (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  email   TEXT,
  reussie INTEGER NOT NULL,
  ip      TEXT,
  agent   TEXT,
  quand   TEXT NOT NULL
);

CREATE TABLE blog_config (
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
  );

CREATE TABLE blog_dossiers (
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
    cree_le TEXT NOT NULL,
    maj_le TEXT NOT NULL
  , seo_title TEXT, meta_description TEXT, resume TEXT, auteur TEXT, tags TEXT, alt_image TEXT, html TEXT, image_url TEXT, image_base64 TEXT, image_mime TEXT, image_nom TEXT, mot_cle        TEXT, score_seo      INTEGER, seo_detail     TEXT, seo_analyse_le TEXT);

CREATE TABLE blog_seo (
  handle      TEXT PRIMARY KEY,
  titre       TEXT,
  url         TEXT NOT NULL,
  score       INTEGER,
  a_corriger  INTEGER,
  mots        INTEGER,
  detail      TEXT,
  erreur      TEXT,
  analyse_le  TEXT
);

CREATE TABLE campagnes (
  id             TEXT PRIMARY KEY,
  titre          TEXT,
  lien           TEXT,
  destinataires  INTEGER,
  envoyee_le     TEXT NOT NULL
);

CREATE TABLE emails_envoyes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  modele       TEXT NOT NULL,
  destinataire TEXT,
  objet        TEXT,
  statut       TEXT NOT NULL,      -- envoyé | bloqué | échec
  message      TEXT,
  quand        TEXT NOT NULL
);

CREATE TABLE emails_modeles (
  id            TEXT PRIMARY KEY,
  actif         INTEGER NOT NULL DEFAULT 1,
  objet         TEXT,        -- surcharge du sujet ; NULL = celui du code
  intro         TEXT,        -- surcharge du texte d'accroche
  maj_le        TEXT
);

CREATE TABLE executions (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  domaine   TEXT NOT NULL,          -- calendly | blog
  quand     TEXT NOT NULL,
  duree_ms  INTEGER,
  statut    TEXT NOT NULL,          -- ok | erreur
  message   TEXT
);

CREATE TABLE exports_campagne (
  campagne   TEXT NOT NULL,
  type       TEXT NOT NULL,          -- openers | clickers
  process_id TEXT,
  statut     TEXT NOT NULL,          -- demandé | prêt | échec
  contacts   TEXT,                   -- JSON : les adresses
  nb         INTEGER,
  message    TEXT,
  demande_le TEXT NOT NULL,
  fini_le    TEXT,
  PRIMARY KEY (campagne, type)
);

CREATE TABLE factures (
  numero         INTEGER PRIMARY KEY AUTOINCREMENT,
  date_facture   TEXT NOT NULL,
  client_nom     TEXT NOT NULL,
  client_societe TEXT,
  client_email   TEXT NOT NULL,
  prestation     TEXT NOT NULL,
  description    TEXT NOT NULL,
  montant        REAL NOT NULL,
  statut         TEXT NOT NULL DEFAULT 'brouillon',   -- brouillon | envoyée
  envoyee_le     TEXT,
  jeton          TEXT NOT NULL,                        -- lien public, non devinable
  cree_le        TEXT NOT NULL
, payee_le TEXT, commande_shopify TEXT, commande_shopify_id TEXT, annulee_le TEXT, motif_annulation TEXT);

CREATE TABLE devis (
  numero           INTEGER PRIMARY KEY AUTOINCREMENT,
  date_devis       TEXT NOT NULL,
  validite_jours   INTEGER NOT NULL DEFAULT 30,
  client_nom       TEXT NOT NULL,
  client_societe   TEXT,
  client_email     TEXT NOT NULL,
  client_telephone TEXT,
  client_adresse   TEXT,
  titre            TEXT NOT NULL,
  contenu          TEXT NOT NULL,              -- texte collé, mis en forme à l'affichage
  montant          REAL NOT NULL,
  acompte_pct      INTEGER NOT NULL DEFAULT 50,
  delai_livraison  TEXT NOT NULL,
  conditions       TEXT,
  statut           TEXT NOT NULL DEFAULT 'brouillon',  -- brouillon | envoyé | accepté | refusé | facturé
  envoye_le        TEXT,
  facture_numero   INTEGER,
  jeton            TEXT NOT NULL,              -- lien public, non devinable
  cree_le          TEXT NOT NULL
);

CREATE TABLE file_emails (
  uri TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  nom TEXT,
  envoyer_a TEXT NOT NULL,
  essais INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE gemini_recherches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sujet TEXT NOT NULL,
    modele TEXT NOT NULL,
    statut TEXT NOT NULL,
    resultat_json TEXT,
    erreur TEXT,
    cree_le TEXT NOT NULL,
    maj_le TEXT NOT NULL
  );

CREATE TABLE incidents (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  quand    TEXT NOT NULL,
  domaine  TEXT NOT NULL,
  sujet    TEXT,
  message  TEXT NOT NULL
);

CREATE TABLE meetings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  client_nom   TEXT NOT NULL,
  client_email TEXT NOT NULL,
  sujet        TEXT NOT NULL,
  note         TEXT,
  debut        TEXT NOT NULL,          -- ISO 8601, en UTC
  duree_min    INTEGER NOT NULL DEFAULT 30,
  fuseau       TEXT NOT NULL DEFAULT 'Africa/Casablanca',
  lien_meet    TEXT NOT NULL,
  statut       TEXT NOT NULL DEFAULT 'brouillon',   -- brouillon | envoyé
  envoye_le    TEXT,
  jeton        TEXT NOT NULL,
  cree_le      TEXT NOT NULL
, google_event_id TEXT, google_lien TEXT, annule_le TEXT);

CREATE TABLE newsletter_envois (
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
  );

CREATE TABLE radar_annonceurs (
  page_id            TEXT PRIMARY KEY,
  page_name          TEXT,
  premiere_pub_vue   TEXT,      -- « détectée », jamais « commencée » (§7)
  derniere_pub_vue   TEXT,
  pubs_actives       INTEGER DEFAULT 0,
  portee_ue          INTEGER,
  pays               TEXT,
  niche              TEXT,
  vu_le              TEXT NOT NULL,
  maj_le             TEXT
);

CREATE TABLE radar_historique (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  prospect_id   INTEGER NOT NULL,
  ancien_statut TEXT,
  nouveau_statut TEXT,
  motif         TEXT,
  note          TEXT,
  quand         TEXT NOT NULL
);

CREATE TABLE radar_motscles (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  mot      TEXT NOT NULL,
  niche    TEXT NOT NULL,
  actif    INTEGER NOT NULL DEFAULT 1,
  priorite TEXT NOT NULL DEFAULT 'normale',
  dernier_passage TEXT,
  UNIQUE (mot, niche)
);

CREATE TABLE radar_prospects (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id            TEXT NOT NULL UNIQUE,
  marque             TEXT,
  domaine            TEXT,
  domaine_confiance  INTEGER,          -- 0-100 (§16)
  domaine_methode    TEXT,
  domaine_cree_le    TEXT,             -- RDAP (§19)
  registrar          TEXT,
  pays               TEXT,
  niche              TEXT,
  categorie          TEXT,             -- A = nouvelle acquisition, B = nouvelle boutique
  shopify_statut     TEXT,             -- oui | non | incertain (§17)
  shopify_confiance  INTEGER,
  pagespeed_score    INTEGER,
  lcp REAL, cls REAL, fcp REAL, tbt REAL, si REAL,
  cro_signaux        TEXT,             -- JSON (§23)
  score              INTEGER,
  score_detail       TEXT,             -- JSON par famille (§37)
  statut             TEXT NOT NULL DEFAULT 'nouveau',
  motif_rejet        TEXT,
  etape              TEXT NOT NULL DEFAULT 'a_resoudre',
  derniere_erreur    TEXT,
  presente_le        TEXT,             -- jour où il est entré dans un Top 10 (§32)
  cree_le            TEXT NOT NULL,
  analyse_le         TEXT
, premiere_pub_vue TEXT, derniere_pub_vue TEXT, pubs_actives INTEGER NOT NULL DEFAULT 0, portee_ue INTEGER, technos_n INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'meta', source_url TEXT, marche_statut TEXT, marche_confiance INTEGER, marche_preuves TEXT, pertinence_niche INTEGER);

CREATE TABLE radar_pubs (
  ad_id          TEXT PRIMARY KEY,
  page_id        TEXT NOT NULL,
  debut          TEXT,
  fin            TEXT,
  active         INTEGER DEFAULT 1,
  texte          TEXT,
  titre          TEXT,
  caption        TEXT,
  description    TEXT,
  snapshot_url   TEXT,
  plateformes    TEXT,
  portee_ue      INTEGER,
  mot_cle        TEXT,
  collecte_le    TEXT NOT NULL
);

CREATE TABLE radar_reglages (
  cle    TEXT PRIMARY KEY,
  valeur TEXT NOT NULL,
  maj_le TEXT NOT NULL
);

CREATE TABLE radar_technos (
  prospect_id INTEGER NOT NULL,
  techno      TEXT NOT NULL,
  detecte     INTEGER NOT NULL,
  PRIMARY KEY (prospect_id, techno)
);

CREATE TABLE reglages (
  cle     TEXT PRIMARY KEY,
  valeur  TEXT NOT NULL,
  maj_le  TEXT NOT NULL
);

CREATE TABLE reservations (
  uri            TEXT PRIMARY KEY,
  nom            TEXT,
  email          TEXT,
  telephone      TEXT,
  titre          TEXT,
  debut          TEXT,
  fuseau         TEXT,
  reponses       TEXT,              -- JSON des réponses au formulaire
  commande       TEXT,              -- #D33
  commande_id    TEXT,
  consent_email  TEXT,
  consent_sms    TEXT,
  email_qualif   TEXT,              -- programmé | envoyé | échec
  cree_le        TEXT NOT NULL
, decision TEXT NOT NULL DEFAULT 'a_traiter', decision_le TEXT, meeting_id INTEGER, proposition_debut TEXT, message_decision TEXT);

CREATE TABLE taches (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  titre        TEXT NOT NULL,
  detail       TEXT,
  echeance     TEXT,                              -- AAAA-MM-JJ, facultative
  priorite     TEXT NOT NULL DEFAULT 'normale',   -- haute | normale | basse
  statut       TEXT NOT NULL DEFAULT 'à faire',   -- à faire | en cours | faite
  client_nom   TEXT,
  client_email TEXT,
  faite_le     TEXT,
  cree_le      TEXT NOT NULL,
  maj_le       TEXT
, notes_projet    TEXT, date_validation TEXT, delai_jours     INTEGER, delai_type      TEXT);

CREATE TABLE traites (
  domaine TEXT NOT NULL,          -- 'calendly' ou 'blog'
  identifiant TEXT NOT NULL,      -- URI Calendly ou guid d'article
  traite_le TEXT NOT NULL,
  PRIMARY KEY (domaine, identifiant)
);

CREATE INDEX idx_app_connexions ON app_connexions (quand DESC);

CREATE INDEX idx_blog_dossiers_maj ON blog_dossiers(maj_le DESC);

CREATE INDEX idx_blog_seo_score ON blog_seo (score);

CREATE INDEX idx_campagnes ON campagnes (envoyee_le DESC);

CREATE INDEX idx_emails_envoyes ON emails_envoyes (quand DESC);

CREATE INDEX idx_emails_modele  ON emails_envoyes (modele, quand DESC);

CREATE INDEX idx_executions ON executions (domaine, quand DESC);

CREATE INDEX idx_factures ON factures (cree_le DESC);

CREATE UNIQUE INDEX idx_factures_jeton ON factures (jeton);

CREATE INDEX idx_gemini_recherches_maj ON gemini_recherches(maj_le DESC);

CREATE INDEX idx_incidents ON incidents (quand DESC);

CREATE INDEX idx_meetings ON meetings (debut DESC);

CREATE UNIQUE INDEX idx_meetings_jeton ON meetings (jeton);

CREATE INDEX idx_newsletter_envois_statut ON newsletter_envois(statut, maj_le);

CREATE INDEX idx_radar_hist ON radar_historique (prospect_id, quand DESC);

CREATE INDEX idx_radar_motscles_passage ON radar_motscles(actif,dernier_passage);

CREATE INDEX idx_radar_prospects_dom    ON radar_prospects (domaine);

CREATE INDEX idx_radar_prospects_etape  ON radar_prospects (etape);

CREATE INDEX idx_radar_prospects_score ON radar_prospects(statut,score DESC);

CREATE INDEX idx_radar_prospects_statut ON radar_prospects (statut, score DESC);

CREATE INDEX idx_radar_pubs_page ON radar_pubs (page_id, debut DESC);

CREATE INDEX idx_reservations ON reservations (cree_le DESC);

CREATE INDEX idx_taches_statut ON taches (statut, echeance);

