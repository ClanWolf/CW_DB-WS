// models/AuxCampaignFaction.js
class AuxCampaignFaction {
  constructor(data) {
    this.id_campaignfaction = data.id_campaignfaction;
    this.campaign_id = data.campaign_id;
    this.faction_id = data.faction_id;
    this.metaData = {
      name: {
        de: data.Name_de,
        en: data.Name_en
      },
      logo: data.Logo
    };
    this.updated = data.updated;
  }
}

module.exports = AuxCampaignFaction;
