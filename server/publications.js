import { MagentoImportStatus } from "../lib/collections/schemas/magento.js";
import { Reaction } from "/server/api";

Meteor.publish("MagentoImportStatus", function () {
  const shopId = Reaction.getShopId();
  if (!shopId) {
    return this.ready();
  }
  return MagentoImportStatus.find({
    shopId: shopId
  });
});
