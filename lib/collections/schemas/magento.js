import { SimpleSchema } from "meteor/aldeed:simple-schema";
import { PackageConfig } from "/lib/collections/schemas/registry";
import { shopIdAutoValue } from "/lib/collections/schemas/helpers";

export const MagentoImportPackageConfig = new SimpleSchema([
  PackageConfig, {
    "settings.mode": {
      type: Boolean,
      defaultValue: true
    },
    "settings.host": {
      type: String,
      label: "Host",
      optional: false
    },
    "settings.port": {
      type: String,
      label: "Port",
      optional: false,
      defaultValue: "80"
    },
    "settings.path": {
      type: String,
      label: "Path",
      optional: true,
      defaultValue: "/api/xmlrpc"
    },
    "settings.user": {
      type: String,
      label: "User Name",
      optional: true
    },
    "settings.password": {
      type: String,
      label: "Password",
      optional: true
    },
    "settings.store": {
      type: String,
      label: "Magento Store Code",
    },
    "settings.category": {
      type: Number,
      label: "Magento Category Id"
    }
  }
]);

const MagentoImportStatusSchema = new SimpleSchema({
  shopId: {
    type: String,
    autoValue: shopIdAutoValue,
    index: 1,
    label: "Variant ShopId"
  },
  product_status: {
    type: String,
    optional: true,
    defaultValue: "No products imported"
  },
  import_log: {
    type: String,
    optional: true
  }
});

export const MagentoImportStatus = new Mongo.Collection("MagentoImportStatus");

MagentoImportStatus.attachSchema(MagentoImportStatusSchema);
