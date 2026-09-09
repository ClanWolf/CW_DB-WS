const { logger } = require("../logger.js");
const db = require("../db.js");
const AuxFight = require("../models/AuxFight");

const express = require("express");
const router = express.Router();

const TABLE_NAME = "aux_fights";
const PRIMARY_KEY_COLUMN = "id_fight";

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
    const fights = await db.pool.query(`SELECT * FROM ${TABLE_NAME}`);
    const auxFights = fights.map((fight) => new AuxFight(fight));
    logger.info("List of all auxfight records requested from ip: " + ip);

    res.status(200).send(auxFights);
  } catch (err) {
    logger.error("Failed to load auxfight records: " + err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", async (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;

  try {
    const fights = await db.pool.query(
      `SELECT * FROM aux_fights af LEFT JOIN aux_fightusers au ON af.id_fight = au.fight_id WHERE (af.confirmed = 0 OR af.winnerfaction_id NOT NULL) AND au.user_id = ? LIMIT 1`,
      [req.params.id]
    );

    logger.info(
      "Auxfight record with id " + req.params.id + " requested from ip: " + ip
    );

    fights.length > 0
      ? res.status(200).json(new AuxFight(fights[0]))
      : res.sendStatus(404);
  } catch (err) {
    logger.error("Failed to load auxfight record: " + err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", async (req, res) => {
  const ip =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;

  const {
    initiator_user_id,
    initiator_faction_id,
    opponent_user_id,
    opponent_faction_id,
    campaign_id = null,
    fight_name = "fight",
  } = req.body || {};

  let connection;

  try {
    // ---------------------------------------------------------
    // Validation
    // ---------------------------------------------------------

    if (
      !Number.isInteger(initiator_user_id) ||
      !Number.isInteger(opponent_user_id)
    ) {
      return res.status(400).json({
        message: "initiator_user_id and opponent_user_id are required",
      });
    }

    if (initiator_user_id === opponent_user_id) {
      return res.status(400).json({
        message: "Initiator and opponent must be different users",
      });
    }

    if (
      !Number.isInteger(initiator_faction_id) ||
      !Number.isInteger(opponent_faction_id)
    ) {
      return res.status(400).json({
        message:
          "initiator_faction_id and opponent_faction_id are required",
      });
    }

    if (campaign_id !== null && !Number.isInteger(campaign_id)) {
      return res.status(400).json({
        message: "campaign_id must be an integer or null",
      });
    }

    if (typeof fight_name !== "string" || fight_name.trim().length === 0) {
      return res.status(400).json({
        message: "fight_name must be a non-empty string",
      });
    }

    // ---------------------------------------------------------
    // Transaction
    // ---------------------------------------------------------

    connection = await db.pool.getConnection();

    await connection.beginTransaction();

    // ---------------------------------------------------------
    // Create fight
    // ---------------------------------------------------------

    const fightResult = await connection.query(
      `
        INSERT INTO aux_fights (
          fight_name,
          confirmed,
          capmaign_id,
          c3_attack_id,
          winnerfaction_id
        )
        VALUES (?, 0, ?, NULL, NULL)
      `,
      [fight_name.trim(), campaign_id]
    );

    const fightId = fightResult.insertId;

    // ---------------------------------------------------------
    // Add initiator
    // ---------------------------------------------------------

    await connection.query(
      `
        INSERT INTO aux_fightusers (
          fight_id,
          user_id,
          faction_id,
          fightcreator
        )
        VALUES (?, ?, ?, 1)
      `,
      [fightId, initiator_user_id, initiator_faction_id]
    );

    // ---------------------------------------------------------
    // Add opponent
    // ---------------------------------------------------------

    await connection.query(
      `
        INSERT INTO aux_fightusers (
          fight_id,
          user_id,
          faction_id,
          fightcreator
        )
        VALUES (?, ?, ?, 0)
      `,
      [fightId, opponent_user_id, opponent_faction_id]
    );

    // ---------------------------------------------------------
    // Commit
    // ---------------------------------------------------------

    await connection.commit();

    logger.info(
      `Auxfight ${fightId} created from ip: ${ip}. ` +
        `Initiator: ${initiator_user_id}, ` +
        `Opponent: ${opponent_user_id}`
    );

    return res.status(201).json({
      id_fight: fightId.toString(),
      fight_name: fight_name.trim(),
      confirmed: false,
      campaign_id,
      winnerfaction_id: null,
      users: [
        {
          user_id: initiator_user_id,
          faction_id: initiator_faction_id,
          fightcreator: true,
        },
        {
          user_id: opponent_user_id,
          faction_id: opponent_faction_id,
          fightcreator: false,
        },
      ],
    });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        logger.error(
          "Failed to rollback auxfight transaction: " +
            rollbackError.message
        );
      }
    }

    logger.error("Failed to create auxfight: " + err.message);

    return res.status(500).json({
      message: err.message,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
