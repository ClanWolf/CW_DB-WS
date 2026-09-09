// models/AuxFight.js
class AuxFight {
  constructor(data) {
    this.id_fight = data.id_fight;
    this.fight_name = data.fight_name;
    this.confirmed = data.confirmed;
    this.campaign_id = data.campaign_id;
    this.c3_attack_id = data.c3_attack_id;
    this.winnerfaction_id = data.winnerfaction_id;
    this.fightcreator = data.fightcreator;
    this.updated = data.updated;
  }
}

module.exports = AuxFight;
