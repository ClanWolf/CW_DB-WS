const { logger } = require("../logger.js");
const db = require("../db.js");
const AuxCampaignFaction = require("../models/AuxCampaignFaction");

const express = require("express");
const router = express.Router();

const TABLE_NAME = "aux_campaignfactions";
const PRIMARY_KEY_COLUMN = "aux_campaignfaction_id";

function serializeInsertResult(result) {
  return {
    affectedRows: Number(result.affectedRows || 0),
    insertId: result.insertId ? result.insertId.toString() : null,
  };
}

async function getWritableColumns() {
  const columns = await db.pool.query(`SHOW COLUMNS FROM ${TABLE_NAME}`);

  return columns
    .filter((column) => !String(column.Extra || "").includes("auto_increment"))
    .map((column) => column.Field);
}

router.get("/", async (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;

  try {
    const campaignFactions = await db.pool.query(`SELECT ac.*, c.Name_en, c.Name_de  FROM ${TABLE_NAME} ac LEFT JOIN c3_FACTION c ON (ac.faction_id = c.ID)`);
    const auxCampaignFactions = campaignFactions.map((cf) => new AuxCampaignFaction(cf));
    logger.info("List of all auxcampaignfaction records requested from ip: " + ip);

    res.status(200).send(auxCampaignFactions);
  } catch (err) {
    logger.error("Failed to load auxcampaignfaction records: " + err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// seletiert alle factions anhand der campaign id
router.get("/:id", async (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;

  try {
    const campaignFactions = await db.pool.query(
      `SELECT ac.*, c.Name_en, c.Name_de FROM ${TABLE_NAME} ac LEFT JOIN c3_FACTION c ON (ac.faction_id = c.ID) WHERE ac.campaign_id = ?`,
      [req.params.id]
    );

    logger.info(
      "Auxcampaignfaction record with id " + req.params.id + " requested from ip: " + ip
    );

    campaignFactions.length > 0
      ? res.status(200).json(campaignFactions.map((cf) => new AuxCampaignFaction(cf)))
      : res.sendStatus(404);
  } catch (err) {
    logger.error("Failed to load auxcampaignfaction record: " + err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", async (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;
  const payload = req.body || {};

  try {
    if (Array.isArray(payload) || typeof payload !== "object") {
      return res.status(400).json({ message: "Request body must be an object" });
    }

    const writableColumns = await getWritableColumns();
    const requestColumns = Object.keys(payload);
    const unknownColumns = requestColumns.filter(
      (key) => !writableColumns.includes(key)
    );

    if (unknownColumns.length > 0) {
      return res.status(400).json({
        message: "Unknown or read-only auxcampaignfaction fields provided",
        fields: unknownColumns,
      });
    }

    const payloadColumns = requestColumns.filter((key) =>
      writableColumns.includes(key)
    );

    if (payloadColumns.length === 0) {
      return res
        .status(400)
        .json({ message: "No valid auxcampaignfaction fields provided" });
    }

    const columns = payloadColumns.map((column) => `\`${column}\``).join(", ");
    const placeholders = payloadColumns.map(() => "?").join(", ");
    const values = payloadColumns.map((column) => payload[column]);

    const result = await db.pool.query(
      `INSERT INTO ${TABLE_NAME} (${columns}) VALUES (${placeholders})`,
      values
    );

    logger.info("Auxcampaignfaction record created from ip: " + ip);

    res.status(201).json(serializeInsertResult(result));
  } catch (err) {
    logger.error("Failed to create auxcampaignfaction record: " + err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
